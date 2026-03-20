"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Device, Position } from "@/types";
import { getPositions } from "@/lib/api";
import { normalizeDevice } from "@/lib/api/devices";
import { getWebSocketClient } from "@/lib/websocket";
import { distanceKm } from "@/lib/utils";

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

const TRAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const TRAIL_MAX_POINTS = 500;
const FLUSH_INTERVAL_MS = 200;
const POLL_FALLBACK_INTERVAL = 15_000; // Polling apenas quando WS desconectado

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
      // Atributo "sticky" para ignition — mantém o último valor conhecido se a
      // nova posição não trouxer o campo. Muitos rastreadores não enviam
      // `ignition` em todo pacote, fazendo o status oscilar.
      // NOTA: `blocked` NÃO é sticky aqui; bloqueio é controlado exclusivamente
      // por device.attributes.blocked (comando administrativo).
      queryClient.setQueryData(["positions"], (old: Position[] = []) => {
        const posMap = new Map(old.map((p) => [p.deviceId, p]));
        positionList.forEach((p) => {
          const prev = posMap.get(p.deviceId);
          if (prev && p.attributes) {
            // Herda ignition do pacote anterior quando ausente no novo
            if (p.attributes.ignition === undefined && prev.attributes?.ignition !== undefined) {
              p = { ...p, attributes: { ...p.attributes, ignition: prev.attributes.ignition } };
            }
          }
          posMap.set(p.deviceId, p);
        });
        return Array.from(posMap.values());
      });

      // 2. Atualiza trails — usa Date.now() como ts para garantir que nunca é filtrado
      setDeviceTrails((prev) => {
        const trails = new Map(prev);
        const now = Date.now();
        const cutoff = now - TRAIL_WINDOW_MS;

        positionList.forEach((position) => {
          if (!position.latitude || !position.longitude) return;

          // Filtrar posições inválidas ou com precisão ruim
          if (position.valid === false) return;
          if (position.accuracy && position.accuracy > 150) return; // accuracy > 150m = GPS impreciso

          const current = trails.get(position.deviceId) || [];
          const newPoint = {
            lat: position.latitude,
            lng: position.longitude,
            ts: now, // Usa timestamp local para evitar problemas de parsing
          };

          const last = current[current.length - 1];
          if (last) {
            const dist = approxDistanceM(
              last.lat,
              last.lng,
              newPoint.lat,
              newPoint.lng,
            );
            // Dedup: ignora se moveu menos de 5 metros
            if (dist < 5) return;

            // Filtrar teleportações: salto > 2km entre updates consecutivos (~200ms)
            // é fisicamente impossível para veículos terrestres
            if (dist > 2000) return;
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
        // Traccar envia apenas os devices que mudaram — normaliza e merge com a lista existente
        queryClient.setQueryData(["devices"], (old: Device[] = []) => {
          const devMap = new Map(old.map((d) => [d.id, d]));
          message.data.forEach((d: any) => {
            const existing = devMap.get(d.id);
            const normalized = normalizeDevice(d);
            // Preserva campos da plataforma já no cache (ex: speedLimit, plate)
            // caso o WS não traga attributes completos
            devMap.set(d.id, existing ? { ...existing, ...normalized } : normalized);
          });
          return Array.from(devMap.values());
        });
      } else if (message.type === "events") {
        message.data.forEach(
          (event: { id: number; type: string; deviceId: number; serverTime: string; attributes: Record<string, any> }) => {
            window.dispatchEvent(new CustomEvent('traccar-ws-event', { detail: event }));
          },
        );
      }
    });

    // ─── Connection state ───
    const unsubscribeConnection = wsClient.onConnectionChange((connected) => {
      onWsConnectionChange(connected);
    });

    wsClient.connect();

    // ─── Polling apenas como fallback quando WS desconectado ───
    const startFallbackPolling = () => {
      if (pollingRef.current) return; // já rodando
      pollingRef.current = setInterval(async () => {
        try {
          const freshPositions = await getPositions();
          if (freshPositions.length > 0) {
            enqueuePositions(freshPositions);
          }
        } catch {
          // silencioso
        }
      }, POLL_FALLBACK_INTERVAL);
    };
    const stopFallbackPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    // Inicia polling imediatamente (WS ainda não conectou)
    startFallbackPolling();

    // Gerencia polling baseado na conexão WS
    const unsubscribePolling = wsClient.onConnectionChange((connected) => {
      if (connected) {
        stopFallbackPolling();
      } else {
        startFallbackPolling();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeConnection();
      unsubscribePolling();
      clearInterval(flushInterval);
      stopFallbackPolling();
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
