"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Device, Position } from "@/types";
import { getPositions } from "@/lib/api";
import { getWebSocketClient } from "@/lib/websocket";
import { distanceKm } from "@/lib/utils";
import { toast } from "sonner";

interface UseMapWebSocketOptions {
  onWsConnectionChange: (connected: boolean) => void;
  setDeviceTrails: React.Dispatch<
    React.SetStateAction<
      Map<number, { lat: number; lng: number; ts: number }[]>
    >
  >;
  setDeviceRecentDistance: React.Dispatch<
    React.SetStateAction<Map<number, number>>
  >;
}

const TRAIL_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const TRAIL_MAX_POINTS = 100;
const FLUSH_INTERVAL_MS = 200;
const POLL_INTERVAL_ALWAYS = 3_000; // Sempre faz polling a cada 3s

/** Tenta extrair timestamp de um campo ISO ou epoch; retorna Date.now() se falhar */
function safeTimestamp(val: string | number | undefined | null): number {
  if (!val) return Date.now();
  const t = typeof val === "number" ? val : new Date(val).getTime();
  if (isNaN(t) || t < 946684800000) return Date.now(); // antes de 2000 = inválido
  return t;
}

/** Distância entre dois pontos em metros (fast approx) */
function approxDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function useMapWebSocket({
  onWsConnectionChange,
  setDeviceTrails,
  setDeviceRecentDistance,
}: UseMapWebSocketOptions) {
  const queryClient = useQueryClient();
  const devicesRef = useRef<Device[]>([]);
  const deviceTrailsRef = useRef<
    Map<number, { lat: number; lng: number; ts: number }[]>
  >(new Map());

  const pendingPositionsMap = useRef<Map<number, Position>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateDevicesRef = useCallback((devices: Device[]) => {
    devicesRef.current = devices;
  }, []);

  const updateTrailsRef = useCallback(
    (trails: Map<number, { lat: number; lng: number; ts: number }[]>) => {
      deviceTrailsRef.current = trails;
    },
    [],
  );

  useEffect(() => {
    const wsClient = getWebSocketClient();

    // ─── Processar batch de posições acumuladas ───
    const flushPositions = () => {
      const pending = pendingPositionsMap.current;
      if (pending.size === 0) return;

      const positionList = Array.from(pending.values());
      pendingPositionsMap.current = new Map();

      // 1. Atualiza React Query cache
      queryClient.setQueryData(["positions"], (old: Position[] = []) => {
        const posMap = new Map(old.map((p) => [p.deviceId, p]));
        positionList.forEach((p) => posMap.set(p.deviceId, p));
        return Array.from(posMap.values());
      });

      // 2. Atualiza trails — usa Date.now() como ts para garantir que nunca é filtrado
      setDeviceTrails((prev) => {
        const trails = new Map(prev);
        const now = Date.now();
        const cutoff = now - TRAIL_WINDOW_MS;

        positionList.forEach((position) => {
          if (!position.latitude || !position.longitude) return;

          const current = trails.get(position.deviceId) || [];
          const newPoint = {
            lat: position.latitude,
            lng: position.longitude,
            ts: now, // Usa timestamp local para evitar problemas de parsing
          };

          // Dedup: ignora se moveu menos de 5 metros
          const last = current[current.length - 1];
          if (last) {
            const dist = approxDistanceM(
              last.lat,
              last.lng,
              newPoint.lat,
              newPoint.lng,
            );
            if (dist < 5) return; // menos de 5m = mesma posição
          }

          const merged = [...current, newPoint]
            .filter((p) => p.ts >= cutoff)
            .slice(-TRAIL_MAX_POINTS);
          trails.set(position.deviceId, merged);
        });

        deviceTrailsRef.current = trails;
        return trails;
      });

      // 3. Atualiza distâncias recentes
      setDeviceRecentDistance((prevD) => {
        const m = new Map(prevD);
        positionList.forEach((position) => {
          const trail =
            deviceTrailsRef.current.get(position.deviceId) || [];
          if (trail.length < 2) {
            m.set(position.deviceId, 0);
            return;
          }
          let dKm = 0;
          for (let i = 1; i < trail.length; i++) {
            dKm += distanceKm(
              trail[i - 1].lat,
              trail[i - 1].lng,
              trail[i].lat,
              trail[i].lng,
            );
          }
          m.set(position.deviceId, dKm);
        });
        return m;
      });
    };

    // ─── Scheduler: flush periódico ───
    const flushInterval = setInterval(flushPositions, FLUSH_INTERVAL_MS);

    // ─── Acumula posição no batch ───
    const enqueuePositions = (positions: Position[]) => {
      positions.forEach((p) => {
        pendingPositionsMap.current.set(p.deviceId, p);
      });
    };

    // ─── WebSocket subscription ───
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === "positions") {
        enqueuePositions(message.data);
      } else if (message.type === "devices") {
        // Traccar envia apenas os devices que mudaram — merge com a lista existente
        queryClient.setQueryData(["devices"], (old: Device[] = []) => {
          const devMap = new Map(old.map((d) => [d.id, d]));
          message.data.forEach((d: Device) => devMap.set(d.id, d));
          return Array.from(devMap.values());
        });
      } else if (message.type === "events") {
        message.data.forEach(
          (event: { type: string; attributes: { message?: string } }) => {
            toast.info(`${event.type}: ${event.attributes.message || ""}`);
          },
        );
      }
    });

    // ─── Connection state ───
    const unsubscribeConnection = wsClient.onConnectionChange((connected) => {
      onWsConnectionChange(connected);
    });

    wsClient.connect();

    // ─── Polling SEMPRE ativo — é a fonte primária de dados ───
    pollingRef.current = setInterval(async () => {
      try {
        const freshPositions = await getPositions();
        if (freshPositions.length > 0) {
          enqueuePositions(freshPositions);
        }
      } catch {
        // silencioso
      }
    }, POLL_INTERVAL_ALWAYS);

    return () => {
      unsubscribe();
      unsubscribeConnection();
      clearInterval(flushInterval);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushPositions();
      wsClient.disconnect();
    };
  }, [
    queryClient,
    onWsConnectionChange,
    setDeviceTrails,
    setDeviceRecentDistance,
  ]);

  return { updateDevicesRef, updateTrailsRef, deviceTrailsRef };
}
