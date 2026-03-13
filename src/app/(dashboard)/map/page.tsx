"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getDevices, getPositions, getDeviceRoute } from "@/lib/api";
import { updateDevice } from "@/lib/api/devices";
import { Device, Position, SpeedAlert } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Route, List, X, Navigation2 } from "lucide-react";
import { getVehicleIconSVG } from "@/lib/vehicle-icons";
import { bearingDeg, deriveDeviceStatus } from "@/lib/utils";
import { getPlannedRouteById, getRouteGeometry } from "@/lib/api/routes";

import { toast } from "sonner";
import {
  getGeofences,
  getDeviceGeofences,
  assignGeofenceToDevice,
  removeGeofenceFromDevice,
} from "@/lib/api/geofences";
import { parseWKT } from "@/lib/parse-wkt";
import type { Geofence } from "@/types";

// Map components
import { SpeedAlertMarker } from "@/components/map/speed-alert-marker";
import { MapStatusHeader } from "@/components/map/map-status-header";
import { MapStyleSelector } from "@/components/map/map-style-selector";
import { MapToolbar } from "@/components/map/map-toolbar";
import { VehicleListPanel } from "@/components/map/vehicle-list-panel";
import { EditVehicleDialog } from "@/components/map/edit-vehicle-dialog";
import { GeofenceManageDialog } from "@/components/map/geofence-manage-dialog";
import { SendCommandDialog } from "@/components/map/send-command-dialog";
import { MarkerClusterGroup } from "@/components/map/marker-cluster-group";
import { VehicleDetailsPanel } from "@/components/dashboard/vehicle-details-panel";
import { useMapState } from "@/lib/hooks/useMapState";
import { useMapWebSocket } from "@/lib/hooks/useMapWebSocket";
import {
  TILE_LAYERS,
  getMarkerColor,
} from "@/components/map/map-constants";

// Leaflet instance (client-only)
let L: any;
if (typeof window !== "undefined") {
  L = require("leaflet");
}
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);

const LeafletPolygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false },
);

const LeafletCircle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false },
);

const LeafletPopup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);

// ─── MapFollowHandler: segue automaticamente o veículo selecionado (modal aberto) ───
function MapFollowHandler({
  positions,
  selectedDeviceId,
}: {
  positions: Position[];
  selectedDeviceId: number | null;
}) {
  const { useMap } = require("react-leaflet");
  const map = useMap();
  const prev = useRef<{ lat: number; lng: number } | null>(null);
  const transitionRunning = useRef(false);
  const animatedSelectionForId = useRef<number | null>(null);

  // Reset quando veículo é desselecionado
  useEffect(() => {
    if (!selectedDeviceId) {
      animatedSelectionForId.current = null;
      prev.current = null;
    }
  }, [selectedDeviceId]);

  // Centralizar no alerta de velocidade
  useEffect(() => {
    if (!map) return;
    const handler = (e: Event) => {
      const alert = (e as CustomEvent<SpeedAlert>).detail;
      if (!alert?.latitude || !alert?.longitude) return;
      transitionRunning.current = true;
      try { map.stop?.(); } catch { /* ignore */ }
      try {
        map.flyTo([alert.latitude, alert.longitude], 17, { duration: 1.0 });
      } catch {
        try { map.setView([alert.latitude, alert.longitude], 17); } catch { /* ignore */ }
      }
      window.setTimeout(() => { transitionRunning.current = false; }, 1200);
    };
    window.addEventListener("speedAlertFocus", handler);
    return () => window.removeEventListener("speedAlertFocus", handler);
  }, [map]);

  // Animação inicial: flyTo zoom 17 quando um novo veículo é selecionado
  useEffect(() => {
    if (!map || !selectedDeviceId) return;
    if (animatedSelectionForId.current === selectedDeviceId) return;

    const pos = positions.find((p) => p.deviceId === selectedDeviceId);
    if (!pos) return;

    const lat = pos.latitude;
    const lng = pos.longitude;

    animatedSelectionForId.current = selectedDeviceId;
    transitionRunning.current = true;

    try { map.stop?.(); } catch { /* ignore */ }
    try {
      map.flyTo([lat, lng], 17, { duration: 1.2 });
    } catch {
      try { map.setView([lat, lng], 17); } catch { /* ignore */ }
    }

    const t = window.setTimeout(() => {
      transitionRunning.current = false;
      prev.current = { lat, lng };
    }, 1400);

    return () => {
      window.clearTimeout(t);
      transitionRunning.current = false;
    };
  }, [map, selectedDeviceId, positions]);

  // Follow contínuo: SEMPRE centraliza no veículo selecionado a cada nova posição
  useEffect(() => {
    if (!map || !selectedDeviceId) return;
    if (transitionRunning.current) return;

    const pos = positions.find((p) => p.deviceId === selectedDeviceId);
    if (!pos) return;

    const lat = pos.latitude;
    const lng = pos.longitude;

    // Ignora se não mudou (evita panTo desnecessário)
    if (
      prev.current &&
      Math.abs(prev.current.lat - lat) < 1e-6 &&
      Math.abs(prev.current.lng - lng) < 1e-6
    ) return;
    prev.current = { lat, lng };

    try {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    } catch {
      try { map.setView([lat, lng], map.getZoom()); } catch { /* ignore */ }
    }
  }, [positions, selectedDeviceId, map]);

  return null;
}

export default function MapPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mapState = useMapState();
  const [isVehicleListOpen, setIsVehicleListOpen] = useState(true);
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [commandDialogDevice, setCommandDialogDevice] = useState<Device | null>(null);
  const {
    searchParams,
    routeIdFromUrl,
    selectedDevice,
    setSelectedDevice,
    hasAppliedUrlDevice,
    isClient,
    isHighDpi,
    followVehicle,
    setFollowVehicle,
    deviceTrails,
    setDeviceTrails,
    deviceRecentDistance,
    setDeviceRecentDistance,
    isWsConnected,
    setIsWsConnected,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingDevice,
    editForm,
    setEditForm,
    handleEditDevice,
    geofenceDialogDevice,
    setGeofenceDialogDevice,
    assigningGeofenceId,
    setAssigningGeofenceId,
    showGeofences,
    setShowGeofences,
    showSpeedAlerts,
    setShowSpeedAlerts,
    showVehicleLabels,
    toggleVehicleLabels,
    speedAlerts,
    setSpeedAlerts,
    mapStyle,
    setMapStyle,
    plannedRouteGeometry,
    setPlannedRouteGeometry,
    plannedRouteName,
    setPlannedRouteName,
    showPlannedRouteLabel,
    setShowPlannedRouteLabel,
  } = mapState;

  // WebSocket real-time updates
  const onWsConnectionChange = useCallback(
    (connected: boolean) => setIsWsConnected(connected),
    [setIsWsConnected],
  );
  const { deviceTrailsRef, updateDevicesRef } = useMapWebSocket({
    onWsConnectionChange,
    setDeviceTrails,
    setDeviceRecentDistance,
  });

  // Keep trails ref in sync
  useEffect(() => {
    deviceTrailsRef.current = deviceTrails;
  }, [deviceTrails, deviceTrailsRef]);

  function MapResizeInvalidator() {
    const { useMap } = require("react-leaflet");
    const map = useMap();

    useEffect(() => {
      if (!map) return;
      if (typeof ResizeObserver === "undefined") return;

      const container: HTMLElement | undefined = map.getContainer?.();
      if (!container) return;

      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          try {
            map.invalidateSize?.({ animate: false });
          } catch {
            // no-op
          }
        });
      });

      ro.observe(container);
      return () => {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }, [map]);

    return null;
  }

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
    staleTime: 30_000,
    refetchInterval: 60_000, // safety net: refetch a cada 60s caso WS não envie devices
  });

  // Keep devicesRef in sync for WebSocket hook
  useEffect(() => {
    updateDevicesRef(devices);
  }, [devices, updateDevicesRef]);

  // IDs dos dispositivos que pertencem à conta logada (filtra alertas de outras contas)
  const userDeviceIds = useMemo(
    () => new Set(devices.map((d) => d.id)),
    [devices],
  );

  // Somente alertas cujo deviceId pertence a esta conta
  const visibleSpeedAlerts = useMemo(
    () => speedAlerts.filter((a) => userDeviceIds.has(a.deviceId)),
    [speedAlerts, userDeviceIds],
  );

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => getPositions(),
    staleTime: 5_000, // WS atualiza via cache — query só refetcha se stale
  });

  // Todas as cercas disponíveis
  const { data: allGeofences = [] } = useQuery({
    queryKey: ["geofences"],
    queryFn: () => getGeofences(),
    staleTime: 60_000,
    refetchOnMount: true,
  });

  // Cercas já vinculadas ao device do dialog
  const { data: deviceGeofences = [], refetch: refetchDeviceGeofences } =
    useQuery({
      queryKey: ["device-geofences", geofenceDialogDevice?.id],
      queryFn: () => getDeviceGeofences(geofenceDialogDevice!.id),
      enabled: !!geofenceDialogDevice,
    });

  const deviceGeofenceIds = new Set(deviceGeofences.map((g) => g.id));

  const handleToggleGeofence = async (geofenceId: number) => {
    if (!geofenceDialogDevice) return;
    setAssigningGeofenceId(geofenceId);
    try {
      if (deviceGeofenceIds.has(geofenceId)) {
        await removeGeofenceFromDevice(geofenceDialogDevice.id, geofenceId);
        toast.success("Cerca removida do veículo");
      } else {
        await assignGeofenceToDevice(geofenceDialogDevice.id, geofenceId);
        toast.success("Cerca aplicada ao veículo");
      }
      refetchDeviceGeofences();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao atualizar cerca";
      toast.error(msg);
    } finally {
      setAssigningGeofenceId(null);
    }
  };


  const { data: plannedRoute } = useQuery({
    queryKey: ["planned-route", routeIdFromUrl],
    queryFn: () => getPlannedRouteById(routeIdFromUrl as string),
    enabled: typeof routeIdFromUrl === "string" && routeIdFromUrl.length > 0,
  });

  useEffect(() => {
    if (!plannedRoute?.waypoints?.length) {
      setPlannedRouteGeometry([]);
      setPlannedRouteName(null);
      return;
    }
    setPlannedRouteName(plannedRoute.name);
    getRouteGeometry(plannedRoute.waypoints).then((coords) =>
      setPlannedRouteGeometry(coords),
    );
  }, [plannedRoute]);

  // Abrir mapa com veículo da URL (?deviceId=123): selecionar dispositivo e centralizar
  useEffect(() => {
    const deviceIdParam = searchParams?.get("deviceId");
    // Não exige positions.length > 0: a seleção pode acontecer antes das posições carregarem
    // O MapFollowHandler aguarda a posição antes de animar
    if (!deviceIdParam || !devices.length) return;
    const deviceId = parseInt(deviceIdParam, 10);
    if (!Number.isFinite(deviceId)) return;
    // Evitar re-aplicar o mesmo device (mas permitir trocar de device)
    if (hasAppliedUrlDevice.current === deviceId) return;
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    hasAppliedUrlDevice.current = deviceId;
    setSelectedDevice(device);
    setFollowVehicle(true);
  }, [searchParams, devices]);

  // Centralizar no local do excesso de velocidade quando alertId está na URL
  const hasAppliedUrlAlert = useRef<string | null>(null);
  useEffect(() => {
    const alertId = searchParams?.get("alertId");
    if (!alertId || hasAppliedUrlAlert.current === alertId) return;

    // Tentar encontrar o alerta no estado atual
    const tryFocus = () => {
      const alert = speedAlerts.find((a) => a.id === alertId);
      if (!alert) {
        // Ainda não sincronizou — tentar via localStorage diretamente
        try {
          const stored = localStorage.getItem("speedAlerts");
          const parsed: SpeedAlert[] = stored ? JSON.parse(stored) : [];
          const found = parsed.find((a) => a.id === alertId);
          if (found) {
            // Garantir que está no estado
            setSpeedAlerts((prev) => {
              if (prev.some((a) => a.id === found.id)) return prev;
              return [found, ...prev];
            });
            window.dispatchEvent(
              new CustomEvent("speedAlertFocus", { detail: found }),
            );
            hasAppliedUrlAlert.current = alertId;
          }
        } catch {
          /* ignore */
        }
        return;
      }
      window.dispatchEvent(
        new CustomEvent("speedAlertFocus", { detail: alert }),
      );
      hasAppliedUrlAlert.current = alertId;
    };

    // Pequeno delay para garantir que o mapa e os alertas já estão montados
    const t = window.setTimeout(tryFocus, 400);
    return () => window.clearTimeout(t);
  }, [searchParams, speedAlerts]);

  const tileLayerProps = useMemo(() => {
    const layer = TILE_LAYERS[mapStyle];
    const isCarto =
      mapStyle === "dark" || mapStyle === "light" || mapStyle === "streets";
    const isGoogle = mapStyle.startsWith("google");
    const url =
      isCarto && isHighDpi ? layer.url.replace(/\.png$/, "@2x.png") : layer.url;

    return {
      url,
      attribution: layer.attribution,
      // O mapa permite até 21; se o TileLayer tiver maxZoom menor, no zoom alto ele fica em branco.
      // maxNativeZoom controla até onde existem tiles "nativos"; acima disso, o Leaflet faz overzoom (scaling).
      maxZoom: 21,
      maxNativeZoom: layer.maxNativeZoom ?? 19,
      // Tiles HD (@2x) com tileSize/zoomOffset corretos para melhorar nitidez
      ...(isCarto && isHighDpi ? { tileSize: 512, zoomOffset: -1 } : {}),
      // Evita "branco" durante zoom/flyTo mantendo tiles carregando
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 6,
      eventHandlers: {
        tileerror: (e: any) => {
          try {
            const src = e?.tile?.src;
            // Ajuda a diagnosticar rapidamente 404/rate-limit no provider
            console.warn("[Tile error]", { mapStyle, src });
          } catch {
            // ignore
          }
        },
      },
      ...(layer.subdomains ? { subdomains: layer.subdomains as any } : {}),
    };
  }, [mapStyle, isHighDpi]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) =>
      updateDevice(id, data),
    onSuccess: (updatedDevice, variables) => {
      // Atualiza imediatamente o device no cache com os novos dados.
      // Usa variables.data.* como fonte PRIMÁRIA (o que o usuário digitou no form),
      // porque o Traccar pode retornar string vazia "" para campos customizados no root.
      queryClient.setQueryData(["devices"], (old: Device[] = []) =>
        old.map((d) => {
          if (d.id !== variables.id) return d;
          return {
            ...d,
            ...updatedDevice,
            plate:
              (variables.data as any).plate ||
              (updatedDevice as any).plate ||
              d.plate ||
              "",
            model:
              (variables.data as any).model ||
              (updatedDevice as any).model ||
              d.model ||
              "",
            color:
              (variables.data as any).color ||
              (updatedDevice as any).color ||
              d.color ||
              "",
            category:
              (variables.data as any).category ||
              (updatedDevice as any).category ||
              d.category ||
              "car",
            speedLimit: Math.round(
              (variables.data as any).speedLimit ??
                (updatedDevice as any).speedLimit ??
                d.speedLimit ??
                80,
            ),
          };
        }),
      );
      // refetchType: 'none' evita refetch imediato que sobrescreveria o setQueryData acima
      queryClient.invalidateQueries({
        queryKey: ["devices"],
        refetchType: "none",
      });
      toast.success("Veículo atualizado com sucesso!");
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar veículo");
    },
  });

  const handleSaveDevice = () => {
    if (editingDevice) {
      updateMutation.mutate({
        id: editingDevice.id,
        data: editForm,
      });
    }
  };

  const positionsMap = useMemo(
    () => new Map((positions as Position[]).map((p) => [p.deviceId, p])),
    [positions],
  );

  // Distância rápida (Haversine simplificado) entre dois pontos em metros
  const quickDistM = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const lat1 = (a[0] * Math.PI) / 180;
    const lat2 = (b[0] * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };

  // Remove outliers GPS (teleportações impossíveis — saltos > 2km entre pontos consecutivos)
  const filterOutliers = (coords: [number, number][]) => {
    if (coords.length < 2) return coords;
    const result: [number, number][] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const d = quickDistM(result[result.length - 1], coords[i]);
      if (d < 2000) result.push(coords[i]); // 2km threshold
    }
    return result;
  };

  // Divide trilha em segmentos onde há salto > 500m (evita linhas retas entre gaps GPS)
  const splitTrailSegments = (coords: [number, number][]) => {
    if (coords.length < 2) return [coords];
    const segments: [number, number][][] = [];
    let current: [number, number][] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      if (quickDistM(current[current.length - 1], coords[i]) > 500) {
        if (current.length >= 2) segments.push(current);
        current = [];
      }
      current.push(coords[i]);
    }
    if (current.length >= 2) segments.push(current);
    return segments;
  };

  // Interpolação Catmull-Rom: suaviza a trilha adicionando pontos entre posições GPS
  const interpolateSpline = (coords: [number, number][]) => {
    if (coords.length < 3) return coords;
    const result: [number, number][] = [];
    // Quantos pontos intermediários por segmento (baseado na distância)
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      result.push(p1);

      // Número de subdivisões proporcional à distância (mais distante = mais pontos)
      const dist = quickDistM(p1, p2);
      // 1 ponto a cada ~30m, mínimo 2, máximo 15
      const subdivisions = Math.min(15, Math.max(2, Math.round(dist / 30)));

      for (let t = 1; t < subdivisions; t++) {
        const s = t / subdivisions;
        const s2 = s * s;
        const s3 = s2 * s;
        // Catmull-Rom basis
        const h1 = -0.5 * s3 + s2 - 0.5 * s;
        const h2 = 1.5 * s3 - 2.5 * s2 + 1;
        const h3 = -1.5 * s3 + 2.0 * s2 + 0.5 * s;
        const h4 = 0.5 * s3 - 0.5 * s2;
        const lat = h1 * p0[0] + h2 * p1[0] + h3 * p2[0] + h4 * p3[0];
        const lng = h1 * p0[1] + h2 * p1[1] + h3 * p2[1] + h4 * p3[1];
        result.push([lat, lng]);
      }
    }
    result.push(coords[coords.length - 1]);
    return result;
  };

  // MapFollowHandler está definido no nível do módulo para manter refs estáveis entre renders

  // Debug: log quantos devices e positions estão sendo renderizados
  useEffect(() => {
    const trailPoints = Array.from(deviceTrails.values()).reduce(
      (sum, trail) => sum + trail.length,
      0,
    );
    console.debug(
      `[Map Render] ${devices.length} devices, ${positions.length} positions, ${trailPoints} trail points total`,
    );
  }, [devices.length, positions.length, deviceTrails.size]);

  const iconCacheRef = useRef(new Map<number, { key: string; icon: any }>());

  const createCustomIcon = (
    device: Device,
    position: Position,
    bearing?: number,
    showLabel = true,
  ) => {
    if (!L) return null;

    const effectiveStatus = deriveDeviceStatus(device.status, position, device.lastUpdate);
    const color = getMarkerColor(effectiveStatus);
    const isPulsing = effectiveStatus === "moving";
    const course = typeof bearing === "number" ? bearing : position.course || 0;
    const vehicleIcon = getVehicleIconSVG(device.category, "#ffffff", 0);
    const labelText = (device.plate || device.name || "").trim();
    const hasLabel = showLabel && !!labelText;
    // Placa posicionada logo abaixo do círculo (52px do topo do container 48px)
    const labelHtml = hasLabel
      ? `
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:52px;background:rgba(0,0,0,0.78);border:1px solid rgba(255,255,255,0.18);border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;color:#fff;font-family:monospace;letter-spacing:0.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;pointer-events:none;user-select:none;">
        ${labelText}
      </div>`
      : "";
    // Badge de velocidade: afasta mais quando a placa está visível
    const speedTop = hasLabel ? "70px" : "56px";
    const speedHtml =
      isPulsing && position.speed > 0
        ? `
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:${speedTop};background:#2563eb;color:#fff;font-size:11px;padding:1px 7px;border-radius:999px;white-space:nowrap;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.5);pointer-events:none;">
        ${Math.round(position.speed)} km/h
      </div>`
        : "";

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div class="relative flex items-center justify-center">
          ${isPulsing ? '<div class="absolute inset-0 w-12 h-12 rounded-full bg-blue-500 animate-ping opacity-50"></div>' : ""}

          ${
            typeof course === "number"
              ? `
            <div class="absolute" style="left:50%;top:50%;transform:translate(-50%,-50%)">
              <div style="transform: rotate(${course}deg); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2 L16 13 L12 10 L8 13 Z" fill="#ffffff" stroke="${color}" stroke-width="0.5" />
                </svg>
              </div>
            </div>
          `
              : ""
          }

          ${
            device.attributes.blocked
              ? `
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white z-10 flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
              </svg>
            </div>
          `
              : ""
          }
          
          <div class="relative w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/40" style="background: linear-gradient(135deg, ${color}, ${color}dd); box-shadow: 0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1);">
            ${vehicleIcon}
          </div>

          <div class="absolute w-16 h-16 rounded-full border border-white/20 pointer-events-none" style="left:50%;top:50%;transform:translate(-50%,-50%);"></div>
          <div class="absolute left-1/2 top-1/2" style="transform: translate(-50%,-50%) rotate(${course}deg) translateY(-28px); transform-origin: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2 L16 13 L12 10 L8 13 Z" fill="${color}" />
            </svg>
          </div>
          
          ${labelHtml}
          ${speedHtml}
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
    });
  };

  const getDeviceIcon = (
    device: Device,
    position: Position,
    bearing?: number,
    showLabel = true,
  ) => {
    if (!L) return null;

    const rawCourse =
      typeof bearing === "number"
        ? bearing
        : typeof position.course === "number"
          ? position.course
          : 0;
    const courseBucket = Math.round(rawCourse / 10) * 10;
    const effectiveStatus = deriveDeviceStatus(device.status, position, device.lastUpdate);
    const speedBucket =
      effectiveStatus === "moving"
        ? Math.round((position.speed || 0) / 5) * 5
        : Math.round(position.speed || 0);
    const blocked = device.attributes?.blocked ? 1 : 0;

    const labelText = (device.plate || device.name || "").trim();
    const cacheKey = `${effectiveStatus}|${blocked}|${device.category}|${courseBucket}|${speedBucket}|${showLabel ? 1 : 0}|${labelText}`;
    const cached = iconCacheRef.current.get(device.id);
    if (cached?.key === cacheKey) return cached.icon;

    const positionForIcon =
      position.speed === speedBucket
        ? position
        : ({ ...position, speed: speedBucket } as Position);

    const icon = createCustomIcon(
      device,
      positionForIcon,
      courseBucket,
      showLabel,
    );
    iconCacheRef.current.set(device.id, { key: cacheKey, icon });
    return icon;
  };

  const handleDeviceClick = useCallback(
    (device: Device) => {
      const position = positionsMap.get(device.id);
      if (!position) return;
      setSelectedDevice(device);
      setFollowVehicle(true);
    },
    [positionsMap],
  );

  // Wrapper que obtém a instância do mapa via useMap() e repassa para MarkerClusterGroup
  function VehicleClusterLayer(props: {
    devices: Device[];
    positionsMap: Map<number, Position>;
    deviceTrails: Map<number, { lat: number; lng: number; ts: number }[]>;
    showVehicleLabels: boolean;
    getDeviceIcon: (device: Device, position: Position, bearing?: number, showLabel?: boolean) => any;
    onDeviceClick: (device: Device) => void;
  }) {
    const { useMap } = require("react-leaflet");
    const map = useMap();
    return <MarkerClusterGroup {...props} map={map} />;
  }

  // Mostra trilhas para qualquer veículo que tenha dados de trail acumulados
  const devicesForTrails = useMemo(() => {
    const set = new Map<number, Device>();
    const devicesById = new Map(devices.map((d) => [d.id, d]));
    deviceTrails.forEach((trail, deviceId) => {
      if (trail.length >= 2) {
        const d = devicesById.get(deviceId);
        if (d) set.set(deviceId, d);
      }
    });
    if (selectedDevice) set.set(selectedDevice.id, selectedDevice);
    return Array.from(set.values());
  }, [devices, selectedDevice, deviceTrails]);

  // Busca rotas recentes (últimos 15 min) para qualquer device com posição conhecida
  const loadedTrailsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    // Qualquer device que não seja offline pode ter rota recente
    const candidateIds = new Set<number>();
    devices.forEach((d) => {
      if (d.status !== "offline") candidateIds.add(d.id);
    });
    if (selectedDevice) candidateIds.add(selectedDevice.id);

    const toLoad = Array.from(candidateIds).filter(
      (id) => !loadedTrailsRef.current.has(id),
    );
    if (toLoad.length === 0) return;

    const now = new Date();
    const from = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const to = now.toISOString();

    toLoad.forEach((id) => loadedTrailsRef.current.add(id));

    const batch = toLoad.slice(0, 5);
    Promise.allSettled(
      batch.map((id) => getDeviceRoute(id, from, to)),
    ).then((results) => {
      setDeviceTrails((prev) => {
        const trails = new Map(prev);
        results.forEach((result, i) => {
          if (result.status !== "fulfilled" || !result.value.length) return;
          const deviceId = batch[i];
          const existingTrail = trails.get(deviceId) || [];
          // Converte posições históricas para trail points
          const newPoints = result.value
            .map((pos) => ({
              lat: pos.latitude,
              lng: pos.longitude,
              ts: new Date(pos.fixTime || pos.serverTime || Date.now()).getTime() || Date.now(),
            }))
            .filter((p) => !isNaN(p.ts) && p.ts > 946684800000); // válido se > ano 2000
          if (newPoints.length === 0) return;
          const existingSet = new Set(
            existingTrail.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`),
          );
          const unique = newPoints.filter(
            (p) => !existingSet.has(`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`),
          );
          const merged = [...unique, ...existingTrail]
            .sort((a, b) => a.ts - b.ts)
            .slice(-100);
          trails.set(deviceId, merged);
        });
        return trails;
      });
    });
  }, [devices, selectedDevice, setDeviceTrails]);

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Compact Header */}
      <MapStatusHeader
        isWsConnected={isWsConnected}
        deviceCount={devices.length}
        selectedDevice={!!selectedDevice}
      />

      {/* Botão lista de veículos - só aparece quando fechado */}
      {!isVehicleListOpen && (
        <div className="absolute top-3 left-3 z-[1000]">
          <button
            type="button"
            onClick={() => setIsVehicleListOpen(true)}
            className="flex items-center gap-1.5 xl:gap-2 px-3 xl:px-4 py-2 xl:py-2.5 rounded-xl text-xs xl:text-sm font-semibold transition-all shadow-lg backdrop-blur-xl border bg-black/50 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
            title="Abrir lista de veículos"
          >
            <List className="w-4 h-4" />
            <span>Veículos</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] xl:min-w-[22px] xl:h-[22px] rounded-full bg-white/20 text-[10px] xl:text-[11px] font-bold px-1">
              {devices.length}
            </span>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </button>
        </div>
      )}

      {/* Toolbar superior centralizada */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 transition-all duration-300"
      >
        {plannedRouteName &&
          plannedRouteGeometry.length >= 2 &&
          showPlannedRouteLabel && (
            <Card className="backdrop-blur-xl bg-violet-900/80 border-violet-500/30 shadow-lg px-3 py-2 flex items-center gap-2 w-fit">
              <Route className="w-4 h-4 text-violet-300 shrink-0" />
              <span className="text-sm text-white truncate max-w-[180px]">
                Rota: {plannedRouteName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/80 hover:text-white shrink-0"
                onClick={() => {
                  router.push("/map");
                  setShowPlannedRouteLabel(false);
                }}
              >
                ×
              </Button>
            </Card>
          )}

        <div className="flex items-center gap-1 flex-wrap">
          <MapStyleSelector mapStyle={mapStyle} onStyleChange={setMapStyle} />
          <MapToolbar
            showGeofences={showGeofences}
            onToggleGeofences={() => setShowGeofences((v) => !v)}
            geofenceCount={allGeofences.length}
            showSpeedAlerts={showSpeedAlerts}
            onToggleSpeedAlerts={() => setShowSpeedAlerts((v) => !v)}
            speedAlertCount={visibleSpeedAlerts.length}
            showVehicleLabels={showVehicleLabels}
            onToggleVehicleLabels={() => {
              toggleVehicleLabels();
              iconCacheRef.current.clear();
            }}
          />
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={12}
        minZoom={3}
        maxZoom={21}
        zoomSnap={1}
        zoomDelta={1}
        wheelDebounceTime={80}
        wheelPxPerZoomLevel={120}
        zoomAnimation={true}
        markerZoomAnimation={true}
        fadeAnimation={true}
        style={{ width: "100%", height: "100%", background: "#0a0f1a" }}
        className="z-0 leaflet-map-quality"
        scrollWheelZoom={true}
      >
        <TileLayer key={mapStyle} {...tileLayerProps} />

        <MapResizeInvalidator />

        {/* ── Cercas Eletrônicas ── */}
        {showGeofences &&
          allGeofences.map((geofence) => {
            const parsed = parseWKT(geofence.area);
            if (!parsed) {
              if (geofence.area) {
                console.warn(
                  `[Map] Cerca ID=${geofence.id} ("${geofence.name}") não pôde ser renderizada. area="${geofence.area?.slice(0, 100)}"`,
                );
              }
              return null;
            }
            const color =
              (geofence.attributes?.color as string) ||
              geofence.color ||
              "#f97316";

            if (parsed.type === "polygon" && parsed.coordinates) {
              return (
                <LeafletPolygon
                  key={`geo-${geofence.id}`}
                  positions={parsed.coordinates}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    weight: 2.5,
                    opacity: 0.9,
                  }}
                />
              );
            }
            if (parsed.type === "circle" && parsed.center && parsed.radius) {
              return (
                <LeafletCircle
                  key={`geo-${geofence.id}`}
                  center={parsed.center}
                  radius={parsed.radius}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    weight: 2.5,
                    opacity: 0.9,
                  }}
                />
              );
            }
            return null;
          })}

        <MapFollowHandler
          positions={positions}
          selectedDeviceId={selectedDevice ? selectedDevice.id : null}
        />

        {/* Rota planejada (quando ?routeId= na URL) */}
        {plannedRouteGeometry.length >= 2 && (
          <>
            <Polyline
              positions={plannedRouteGeometry}
              pathOptions={{
                color: "#8b5cf6",
                weight: 5,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {L && (
              <>
                <Marker
                  position={plannedRouteGeometry[0]}
                  icon={L.divIcon({
                    className: "custom-marker",
                    html: '<div class="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                />
                <Marker
                  position={
                    plannedRouteGeometry[plannedRouteGeometry.length - 1]
                  }
                  icon={L.divIcon({
                    className: "custom-marker",
                    html: '<div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                />
              </>
            )}
          </>
        )}

        {/* Trilhas de movimento */}
        {devicesForTrails.map((device) => {
          const trail = deviceTrails.get(device.id) || [];
          if (trail.length < 2) return null;
          const rawCoords = trail.map(
            (p) => [p.lat, p.lng] as [number, number],
          );
          const filtered = filterOutliers(rawCoords);
          const segments = splitTrailSegments(filtered);
          if (segments.length === 0) return null;
          const pos = positionsMap.get(device.id);
          const trailColor = getMarkerColor(deriveDeviceStatus(device.status, pos, device.lastUpdate));
          return (
            <React.Fragment key={`trail-${device.id}`}>
              {segments.map((seg, si) => {
                // Interpola spline para suavizar a trilha entre pontos GPS
                const smooth = interpolateSpline(seg);
                return (
                <React.Fragment key={`seg-${device.id}-${si}`}>
                  <Polyline
                    positions={smooth}
                    pathOptions={{
                      color: trailColor,
                      weight: 4,
                      opacity: 0.95,
                      dashArray: "6, 8",
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                    smoothFactor={0}
                  />

                  {/* Setas ao longo do segmento (a cada ~8 pontos interpolados) */}
                  {smooth.map((c, i) => {
                    if (i === 0 || i % 8 !== 0 || i === smooth.length - 1)
                      return null;
                    const prev = smooth[i - 1];
                    const dx = c[1] - prev[1];
                    const dy = c[0] - prev[0];
                    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                    const arrowHtml = `
                      <div style="transform: rotate(${angle}deg);">
                        <svg width=12 height=12 viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                          <path d='M2 12 L18 12 L14 8 L14 16 Z' fill='white' stroke='${trailColor}' stroke-width='0.5'/>
                        </svg>
                      </div>`;
                    const icon = L.divIcon({
                      className: "arrow-marker",
                      html: arrowHtml,
                      iconSize: [12, 12],
                      iconAnchor: [6, 6],
                    });
                    return (
                      <Marker
                        key={`arrow-${device.id}-${si}-${i}`}
                        position={c}
                        icon={icon}
                        interactive={false}
                      />
                    );
                  })}
                </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* ⚡ Marcadores de Excesso de Velocidade — apenas dispositivos desta conta */}
        {showSpeedAlerts &&
          L &&
          visibleSpeedAlerts.map((alert) => (
            <SpeedAlertMarker key={alert.id} alert={alert} />
          ))}

        {/* Markers para cada dispositivo (com clustering) */}
        <VehicleClusterLayer
          devices={devices}
          positionsMap={positionsMap}
          deviceTrails={deviceTrails}
          showVehicleLabels={showVehicleLabels}
          getDeviceIcon={getDeviceIcon}
          onDeviceClick={handleDeviceClick}
        />
      </MapContainer>

      {/* Vehicle List Panel — slide-out drawer */}
      <VehicleListPanel
        devices={devices}
        positionsMap={positionsMap}
        selectedDeviceId={selectedDevice?.id ?? null}
        onDeviceClick={handleDeviceClick}
        isOpen={isVehicleListOpen}
        onToggle={() => setIsVehicleListOpen((v) => !v)}
      />

      {/* Edit Vehicle Dialog */}
      <EditVehicleDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editingDevice={editingDevice}
        editForm={editForm}
        onEditFormChange={setEditForm}
        onSave={handleSaveDevice}
        isPending={updateMutation.isPending}
      />

      {/* Vehicle Details Panel */}
      <VehicleDetailsPanel
        device={selectedDevice}
        position={
          selectedDevice ? positionsMap.get(selectedDevice.id) || null : null
        }
        recentDistanceKm={
          selectedDevice ? deviceRecentDistance.get(selectedDevice.id) || 0 : 0
        }
        recentTrail={
          selectedDevice ? deviceTrails.get(selectedDevice.id) || [] : []
        }
        onClose={() => setSelectedDevice(null)}
        onEdit={(device) => {
          handleEditDevice(device);
        }}
        onReplay={(deviceId) => router.push(`/replay?vehicle=${deviceId}`)}
        onVideo={(deviceId) => router.push(`/video?device=${deviceId}`)}
        onDetails={(deviceId) => router.push(`/vehicles/${deviceId}`)}
        onManageGeofences={(device) => setGeofenceDialogDevice(device)}
        onSendCommand={(device) => setCommandDialogDevice(device)}
        onFollow={() => setFollowVehicle(true)}
        onStreetView={() => setStreetViewActive((v) => !v)}
        streetViewActive={streetViewActive}
      />

      {/* Street View Embed */}
      {streetViewActive && selectedDevice && positionsMap.get(selectedDevice.id) && (
        <div
          className="absolute z-[1001] rounded-xl overflow-hidden shadow-2xl border border-white/10"
          style={{ bottom: 12, right: 350, width: 400, maxWidth: "50vw", height: 220 }}
        >
          <button
            type="button"
            className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
            onClick={() => setStreetViewActive(false)}
          >
            <X className="w-4 h-4" />
          </button>
          <iframe
            title="Street View"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            src={`https://www.google.com/maps/embed/v1/streetview?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&location=${positionsMap.get(selectedDevice.id)!.latitude},${positionsMap.get(selectedDevice.id)!.longitude}&heading=0&pitch=0&fov=90`}
          />
        </div>
      )}

      {/* Dialog: Enviar Comando */}
      <SendCommandDialog
        device={commandDialogDevice}
        open={!!commandDialogDevice}
        onOpenChange={(open) => {
          if (!open) setCommandDialogDevice(null);
        }}
      />

      {/* Dialog: Gerenciar Cercas do Veículo */}
      <GeofenceManageDialog
        device={geofenceDialogDevice}
        onOpenChange={(open) => {
          if (!open) setGeofenceDialogDevice(null);
        }}
        allGeofences={allGeofences}
        deviceGeofenceIds={deviceGeofenceIds}
        assigningGeofenceId={assigningGeofenceId}
        onToggleGeofence={handleToggleGeofence}
      />
    </div>
  );
}
