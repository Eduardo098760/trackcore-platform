"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getDevices, getPositions } from "@/lib/api";
import { updateDevice } from "@/lib/api/devices";
import { Device, Position, VehicleCategory, SpeedAlert } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Navigation,
  Zap,
  ZapOff,
  Circle,
  Wifi,
  WifiOff,
  Edit,
  Gauge,
  Car,
  Calendar,
  Palette,
  Phone,
  Route,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { formatSpeed, formatDate, getDeviceStatusColor } from "@/lib/utils";
import { getVehicleIconSVG } from "@/lib/vehicle-icons";
import { getWebSocketClient } from "@/lib/websocket";
import { getPlannedRouteById, getRouteGeometry } from "@/lib/api/routes";
import { useSearchStore } from "@/lib/stores/search";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { VehicleDetailsPanel } from "@/components/dashboard/vehicle-details-panel";
import { toast } from "sonner";
import {
  getGeofences,
  getDeviceGeofences,
  assignGeofenceToDevice,
  removeGeofenceFromDevice,
} from "@/lib/api/geofences";
import { parseWKT } from "@/lib/parse-wkt";
import type { Geofence } from "@/types";

// Importar Leaflet apenas no cliente
let L: any;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

// Importar Leaflet dinamicamente para evitar problemas com SSR
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
});

const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});

const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });

const LeafletPolygon = dynamic(() => import("react-leaflet").then((mod) => mod.Polygon), {
  ssr: false,
});

const LeafletCircle = dynamic(() => import("react-leaflet").then((mod) => mod.Circle), {
  ssr: false,
});

const LeafletPopup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

type TileLayerKey = "dark" | "light" | "streets" | "satellite";

const TILE_LAYERS: Record<
  TileLayerKey,
  {
    url: string;
    attribution: string;
    label: string;
    subdomains?: string | string[];
    maxNativeZoom?: number;
  }
> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Escuro",
    subdomains: "abcd",
    // Em alguns ambientes com alta densidade (retina), o Leaflet pode tentar buscar tiles acima do limite.
    // Mantemos maxNativeZoom 18 para permitir overzoom por scaling e evitar tela "branca".
    maxNativeZoom: 18,
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Claro",
    subdomains: "abcd",
    maxNativeZoom: 18,
  },
  streets: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Ruas",
    subdomains: "abcd",
    maxNativeZoom: 18,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    label: "Satélite",
    // Em algumas regiões o Esri não entrega tiles no z=19; usar overzoom evita tela branca.
    maxNativeZoom: 18,
  },
};

// Componente de marcador de excesso de velocidade — FORA do MapPage para
// evitar que cada re-render crie uma nova referência de função e feche o popup
function SpeedAlertMarker({ alert }: { alert: SpeedAlert }) {
  const { useMap } = require("react-leaflet");
  const map = useMap();
  if (!L) return null;
  return (
    <Marker
      position={[alert.latitude, alert.longitude]}
      icon={L.divIcon({
        className: "speed-alert-icon",
        html: `<div style="
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: 2.5px solid #fff;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.35), 0 3px 10px rgba(0,0,0,0.7);
        ">&#x26A1;</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })}
    >
      <LeafletPopup minWidth={270} maxWidth={270} closeButton={false}>
        <div
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            background: "#111827",
            borderRadius: 12,
            overflow: "hidden",
            margin: "-14px -20px",
            width: 270,
            border: "1px solid #1a2535",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#0d1117",
              borderLeft: "3px solid #f59e0b",
              padding: "9px 10px 9px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fbbf24",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Excesso de Velocidade
              </span>
            </div>
            <button
              onClick={() => {
                try {
                  map.closePopup();
                } catch {
                  /* ignore */
                }
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#4b5563",
                fontSize: 20,
                lineHeight: 1,
                padding: "0 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#4b5563";
              }}
              title="Fechar"
            >
              ×
            </button>
          </div>

          <div
            style={{
              padding: "12px 14px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Nome do veículo + placa */}
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  lineHeight: 1.3,
                }}
              >
                {alert.vehicleName || alert.deviceName}
              </div>
              {alert.vehicleName && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#4b5563",
                    marginTop: 2,
                    fontFamily: "monospace",
                    letterSpacing: 0.5,
                  }}
                >
                  {alert.deviceName}
                </div>
              )}
            </div>

            {/* Divisória */}
            <div style={{ borderTop: "1px solid #1a2335" }} />

            {/* Velocidades lado a lado */}
            <div style={{ display: "flex", gap: 8 }}>
              {/* Registrado */}
              <div
                style={{
                  flex: 1,
                  background: "#0d1117",
                  borderRadius: 8,
                  padding: "8px 10px",
                  border: "1px solid #1a2535",
                  borderTop: "2px solid #f59e0b",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Registrado
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: "#fbbf24",
                      lineHeight: 1,
                    }}
                  >
                    {alert.speed}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>km/h</span>
                </div>
              </div>

              {/* Limite definido — sempre visível */}
              <div
                style={{
                  flex: 1,
                  background: "#0d1117",
                  borderRadius: 8,
                  padding: "8px 10px",
                  border: "1px solid #1a2535",
                  borderTop: "2px solid #2d3a4a",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Limite
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: "#94a3b8",
                      lineHeight: 1,
                    }}
                  >
                    {alert.speedLimit > 0 ? Math.round(alert.speedLimit) : "—"}
                  </span>
                  {alert.speedLimit > 0 && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>km/h</span>
                  )}
                </div>
              </div>
            </div>

            {/* Badge de excesso — sempre visível quando há limite */}
            {alert.speedLimit > 0 && (
              <div
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 11, color: "#6b7280" }}>Ultrapassou o limite em</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>
                  +{Math.max(0, Math.round(alert.speed - alert.speedLimit))} km/h
                </span>
              </div>
            )}

            {/* Data e hora */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#374151"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 11, color: "#4b5563" }}>
                {new Date(alert.timestamp).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </LeafletPopup>
    </Marker>
  );
}

export default function MapPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchTerm } = useSearchStore();
  const colors = useTenantColors();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const hasAppliedUrlDevice = useRef<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isHighDpi, setIsHighDpi] = useState(false);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [deviceTrails, setDeviceTrails] = useState<
    Map<number, { lat: number; lng: number; ts: number }[]>
  >(new Map());
  const [deviceRecentDistance, setDeviceRecentDistance] = useState<Map<number, number>>(new Map());
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Dialog de gerenciamento de cercas
  const [geofenceDialogDevice, setGeofenceDialogDevice] = useState<Device | null>(null);
  const [assigningGeofenceId, setAssigningGeofenceId] = useState<number | null>(null);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showSpeedAlerts, setShowSpeedAlerts] = useState(true);
  const [showVehicleLabels, setShowVehicleLabels] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("mapShowVehicleLabels") !== "false";
    } catch {
      return true;
    }
  });
  const [speedAlerts, setSpeedAlerts] = useState<SpeedAlert[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("speedAlerts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [editForm, setEditForm] = useState({
    name: "",
    uniqueId: "",
    plate: "",
    phone: "",
    category: "car" as VehicleCategory,
    model: "",
    year: new Date().getFullYear(),
    color: "",
    contact: "",
    speedLimit: 80,
    groupId: 0,
    expiryDate: "",
  });

  // Estilo do mapa (melhor qualidade visual + satélite)
  const [mapStyle, setMapStyle] = useState<TileLayerKey>("dark");

  // Trilhas são pesadas com muitos veículos: manter apenas do selecionado
  // Rota planejada (quando ?routeId= na URL)
  const routeIdFromUrl = searchParams?.get("routeId") || null;
  const [plannedRouteGeometry, setPlannedRouteGeometry] = useState<[number, number][]>([]);
  const [plannedRouteName, setPlannedRouteName] = useState<string | null>(null);
  const [showPlannedRouteLabel, setShowPlannedRouteLabel] = useState(true);

  useEffect(() => {
    setIsClient(true);
    try {
      setIsHighDpi(typeof window !== "undefined" && (window.devicePixelRatio || 1) > 1);
    } catch {
      setIsHighDpi(false);
    }
  }, []);

  // Ouvir novos SpeedAlerts e eventos de limpeza em tempo real
  useEffect(() => {
    const addHandler = (e: Event) => {
      const alert = (e as CustomEvent<SpeedAlert>).detail;
      setSpeedAlerts((prev) => {
        // Evitar duplicatas
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 100);
      });
    };

    // Limpar todos os alertas (notificações limpas no painel)
    const clearHandler = () => {
      setSpeedAlerts([]);
    };

    // Remover alerta individual (notificação excluída no painel)
    const removeHandler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setSpeedAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    window.addEventListener("speedAlertAdded", addHandler);
    window.addEventListener("speedAlertsCleared", clearHandler);
    window.addEventListener("speedAlertRemoved", removeHandler);

    // Re-sincronizar com localStorage ao montar (captura alertas criados antes da montagem,
    // ex: quando o usuário clica "Ver no mapa" na página de eventos e navega aqui)
    try {
      const stored = localStorage.getItem("speedAlerts");
      if (stored) {
        const parsed: SpeedAlert[] = JSON.parse(stored);
        if (parsed.length > 0) {
          setSpeedAlerts(parsed);
        }
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener("speedAlertAdded", addHandler);
      window.removeEventListener("speedAlertsCleared", clearHandler);
      window.removeEventListener("speedAlertRemoved", removeHandler);
    };
  }, []);

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
  });

  // IDs dos dispositivos que pertencem à conta logada (filtra alertas de outras contas)
  const userDeviceIds = useMemo(() => new Set(devices.map((d) => d.id)), [devices]);

  // Somente alertas cujo deviceId pertence a esta conta
  const visibleSpeedAlerts = useMemo(
    () => speedAlerts.filter((a) => userDeviceIds.has(a.deviceId)),
    [speedAlerts, userDeviceIds],
  );

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => getPositions(),
  });

  // Todas as cercas disponíveis
  const { data: allGeofences = [] } = useQuery({
    queryKey: ["geofences"],
    queryFn: () => getGeofences(),
    staleTime: 60_000,
    refetchOnMount: true,
  });

  // Cercas já vinculadas ao device do dialog
  const { data: deviceGeofences = [], refetch: refetchDeviceGeofences } = useQuery({
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
      const msg = err instanceof Error ? err.message : "Erro ao atualizar cerca";
      toast.error(msg);
    } finally {
      setAssigningGeofenceId(null);
    }
  };

  // Evita que o effect do WebSocket reconecte a cada mudança de `devices`
  const devicesRef = useRef<Device[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Corrige stale-closure ao calcular distância baseado em trilhas
  const deviceTrailsRef = useRef<Map<number, { lat: number; lng: number; ts: number }[]>>(
    new Map(),
  );
  useEffect(() => {
    deviceTrailsRef.current = deviceTrails;
  }, [deviceTrails]);

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
    getRouteGeometry(plannedRoute.waypoints).then((coords) => setPlannedRouteGeometry(coords));
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
            window.dispatchEvent(new CustomEvent("speedAlertFocus", { detail: found }));
            hasAppliedUrlAlert.current = alertId;
          }
        } catch {
          /* ignore */
        }
        return;
      }
      window.dispatchEvent(new CustomEvent("speedAlertFocus", { detail: alert }));
      hasAppliedUrlAlert.current = alertId;
    };

    // Pequeno delay para garantir que o mapa e os alertas já estão montados
    const t = window.setTimeout(tryFocus, 400);
    return () => window.clearTimeout(t);
  }, [searchParams, speedAlerts]);

  const tileLayerProps = useMemo(() => {
    const layer = TILE_LAYERS[mapStyle];
    const isCarto = mapStyle === "dark" || mapStyle === "light" || mapStyle === "streets";
    const url = isCarto && isHighDpi ? layer.url.replace(/\.png$/, "@2x.png") : layer.url;

    return {
      url,
      attribution: layer.attribution,
      // O mapa permite até 19; se o TileLayer tiver maxZoom menor, no zoom alto ele fica em branco.
      // maxNativeZoom controla até onde existem tiles "nativos"; acima disso, o Leaflet faz overzoom (scaling).
      maxZoom: 19,
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
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) => updateDevice(id, data),
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
            plate: (variables.data as any).plate || (updatedDevice as any).plate || d.plate || "",
            model: (variables.data as any).model || (updatedDevice as any).model || d.model || "",
            color: (variables.data as any).color || (updatedDevice as any).color || d.color || "",
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

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      uniqueId: device.uniqueId,
      plate: device.plate,
      phone: device.phone || "",
      category: device.category,
      model: device.model || "",
      year: device.year || new Date().getFullYear(),
      color: device.color || "",
      contact: device.contact || "",
      speedLimit: Math.round(device.speedLimit || 80),
      groupId: 0,
      expiryDate: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveDevice = () => {
    if (editingDevice) {
      updateMutation.mutate({
        id: editingDevice.id,
        data: editForm,
      });
    }
  };

  // WebSocket real-time updates + Polling Fallback (para TODOS os veículos)
  useEffect(() => {
    const wsClient = getWebSocketClient();
    let pollingInterval: NodeJS.Timeout | null = null;
    let lastMessageTime = Date.now();

    // Throttle de updates para não travar em bursts do WS
    let flushTimer: NodeJS.Timeout | null = null;
    let pendingPositions: Position[] | null = null;

    const processPositionUpdates = (positionList: Position[]) => {
      console.debug(
        `[Map] Processando ${positionList.length} posições para ${devicesRef.current.length} veículos`,
      );

      // Atualizar React Query com novas posições para TODOS os veículos
      queryClient.setQueryData(["positions"], (old: Position[] = []) => {
        const newPositions = [...old];
        positionList.forEach((newPos) => {
          const index = newPositions.findIndex((p) => p.deviceId === newPos.deviceId);
          if (index !== -1) {
            newPositions[index] = newPos;
          } else {
            newPositions.push(newPos);
          }
        });
        return newPositions;
      });

      // Atualizar trilhas de TODOS os veículos
      setDeviceTrails((prev) => {
        const trails = new Map(prev);
        positionList.forEach((position) => {
          const ts = position.fixTime
            ? new Date(position.fixTime).getTime()
            : position.serverTime
              ? new Date(position.serverTime).getTime()
              : Date.now();
          const current = trails.get(position.deviceId) || [];
          const newPoint = {
            lat: position.latitude,
            lng: position.longitude,
            ts,
          };
          const cutoff = Date.now() - 5 * 60 * 1000;
          const merged = [...current, newPoint];
          const updated = merged.filter((p) => p.ts >= cutoff).slice(-60);
          trails.set(position.deviceId, updated);
        });
        deviceTrailsRef.current = trails;
        return trails;
      });

      // Calcular distância para TODOS os veículos
      setDeviceRecentDistance((prevD) => {
        const m = new Map(prevD);
        try {
          const { distanceKm } = require("@/lib/utils");
          positionList.forEach((position) => {
            const current = deviceTrailsRef.current.get(position.deviceId) || [];
            let distKm = 0;
            for (let i = 1; i < current.length; i++) {
              const a = current[i - 1];
              const b = current[i];
              distKm += distanceKm(a.lat, a.lng, b.lat, b.lng);
            }
            m.set(position.deviceId, distKm);
          });
        } catch (err) {
          console.error("[Map] Erro ao calcular distância:", err);
        }
        return m;
      });
    };

    const scheduleProcessPositionUpdates = (positionList: Position[]) => {
      pendingPositions = positionList;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const pending = pendingPositions;
        pendingPositions = null;
        if (pending && pending.length) processPositionUpdates(pending);
      }, 250);
    };

    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === "positions") {
        console.debug("[WS] Posições recebidas:", message.data.length);
        lastMessageTime = Date.now();
        scheduleProcessPositionUpdates(message.data);
      } else if (message.type === "devices") {
        queryClient.setQueryData(["devices"], message.data);
      } else if (message.type === "events") {
        message.data.forEach((event) => {
          toast.info(`${event.type}: ${event.attributes.message || ""}`);
        });
      }
    });

    wsClient.connect();
    console.debug("[Map] WebSocket conectando...");

    // Fallback polling: se WebSocket não enviar mensagens por 10s, inicia polling
    const startPollingIfNeeded = () => {
      if (!wsClient.isConnected() || Date.now() - lastMessageTime > 10000) {
        if (!pollingInterval) {
          console.warn("[Map] Iniciando polling de emergência...");
          pollingInterval = setInterval(async () => {
            try {
              const freshPositions = await getPositions();
              if (freshPositions.length > 0) {
                console.debug("[Polling] Atualizando com", freshPositions.length, "posições");
                scheduleProcessPositionUpdates(freshPositions);
              }
            } catch (err) {
              console.error("[Polling] Erro:", err);
            }
          }, 3000);
        }
      }
    };

    const checkConnection = setInterval(() => {
      const isConnected = wsClient.isConnected();
      setIsWsConnected(isConnected);
      if (!isConnected && Date.now() - lastMessageTime > 10000) {
        startPollingIfNeeded();
      } else if (isConnected && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkConnection);
      if (pollingInterval) clearInterval(pollingInterval);
      if (flushTimer) clearTimeout(flushTimer);
      wsClient.disconnect();
    };
  }, [queryClient]);

  const positionsMap = useMemo(
    () => new Map((positions as Position[]).map((p) => [p.deviceId, p])),
    [positions],
  );

  // Smooth polyline helper (Chaikin's algorithm - simple smoothing)
  const smoothTrail = (coords: [number, number][], iterations = 1) => {
    if (!coords || coords.length < 3) return coords;
    let pts = coords.map((p) => [p[0], p[1]] as [number, number]);
    for (let it = 0; it < iterations; it++) {
      const next: [number, number][] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const q: [number, number] = [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]];
        const r: [number, number] = [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]];
        next.push(q, r);
      }
      pts = [pts[0], ...next, pts[pts.length - 1]];
    }
    return pts;
  };

  // Map follow handler component - centers map on a vehicle when `followVehicle` is true
  function MapFollowHandler({
    positions,
    devices,
    follow,
    selectedDeviceId,
  }: {
    positions: Position[];
    devices: Device[];
    follow: boolean;
    selectedDeviceId: number | null;
  }) {
    // require here to avoid SSR issues; hook must be called unconditionally
    const { useMap } = require("react-leaflet");
    const map = useMap();
    const prev = useRef<{ lat: number; lng: number } | null>(null);
    const transitionRunning = useRef(false);
    const animatedSelectionForId = useRef<number | null>(null);

    // Centralizar no local exato do excesso de velocidade ao receber speedAlertFocus
    useEffect(() => {
      if (!map) return;
      const handler = (e: Event) => {
        const alert = (e as CustomEvent<SpeedAlert>).detail;
        if (!alert?.latitude || !alert?.longitude) return;
        transitionRunning.current = true;
        try {
          map.stop?.();
        } catch {
          /* ignore */
        }
        try {
          map.flyTo([alert.latitude, alert.longitude], 17, { duration: 1.0 });
        } catch {
          try {
            map.setView([alert.latitude, alert.longitude], 17);
          } catch {
            /* ignore */
          }
        }
        window.setTimeout(() => {
          transitionRunning.current = false;
        }, 1200);
      };
      window.addEventListener("speedAlertFocus", handler);
      return () => window.removeEventListener("speedAlertFocus", handler);
    }, [map]);

    // Se o usuário mexer no mapa (drag/zoom), desativa o follow para não "brigar".
    useEffect(() => {
      if (!map) return;

      const disableFollowOnUserInput = () => {
        if (transitionRunning.current) return;
        setFollowVehicle(false);
      };

      map.on("dragstart", disableFollowOnUserInput);
      map.on("zoomstart", disableFollowOnUserInput);
      map.on("touchstart", disableFollowOnUserInput);

      return () => {
        map.off("dragstart", disableFollowOnUserInput);
        map.off("zoomstart", disableFollowOnUserInput);
        map.off("touchstart", disableFollowOnUserInput);
      };
    }, [map]);

    // Transição de seleção: roda uma única vez por veículo selecionado.
    useEffect(() => {
      if (!follow || !map || !selectedDeviceId) return;
      if (animatedSelectionForId.current === selectedDeviceId) return;

      const pos = positions.find((p) => p.deviceId === selectedDeviceId);
      if (!pos) return;

      const lat = pos.latitude;
      const lng = pos.longitude;

      animatedSelectionForId.current = selectedDeviceId;
      transitionRunning.current = true;

      let t1: number | undefined;
      let t2: number | undefined;

      try {
        try {
          map.stop?.();
        } catch {
          /* ignore */
        }
        const currentZoom = map.getZoom();
        const zoomOut = Math.max(13, Math.min(15, currentZoom - 3));
        map.flyTo([lat, lng], zoomOut, { duration: 0.65 });
      } catch {
        try {
          map.setView([lat, lng], map.getZoom());
        } catch {
          /* ignore */
        }
      }

      t1 = window.setTimeout(() => {
        try {
          try {
            map.stop?.();
          } catch {
            /* ignore */
          }
          map.flyTo([lat, lng], 17, { duration: 0.95 });
        } catch {
          try {
            map.setView([lat, lng], 17);
          } catch {
            /* ignore */
          }
        }
      }, 740);

      t2 = window.setTimeout(() => {
        transitionRunning.current = false;
        prev.current = { lat, lng };
        // libera zoom/pan manual depois da animação
        setFollowVehicle(false);
      }, 1900);

      return () => {
        if (t1) window.clearTimeout(t1);
        if (t2) window.clearTimeout(t2);
        transitionRunning.current = false;
      };
    }, [follow, map, selectedDeviceId, positions]);

    // Follow contínuo (opcional): apenas quando não há veículo selecionado.
    useEffect(() => {
      if (!follow || !map) return;
      if (selectedDeviceId) return;
      if (transitionRunning.current) return;

      // choose device to follow: moving device > first device
      const targetDevice = devices.find((d) => d.status === "moving") || devices[0];
      if (!targetDevice) return;

      const pos = positions.find((p) => p.deviceId === targetDevice.id);
      if (!pos) return;

      const lat = pos.latitude;
      const lng = pos.longitude;

      // avoid tiny updates
      if (
        prev.current &&
        Math.abs(prev.current.lat - lat) < 1e-6 &&
        Math.abs(prev.current.lng - lng) < 1e-6
      )
        return;
      prev.current = { lat, lng };

      try {
        map.flyTo([lat, lng], map.getZoom(), { duration: 0.6 });
      } catch {
        try {
          map.setView([lat, lng], map.getZoom());
        } catch {
          /* ignore */
        }
      }
    }, [positions, devices, follow, selectedDeviceId, map]);

    return null;
  }

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

  // parseWKT agora usa o utilitário compartilhado em @/lib/parse-wkt
  // que detecta automaticamente a ordem das coordenadas (lng lat vs lat lng)

  const getMarkerColor = (status: string) => {
    switch (status) {
      case "moving":
        return "#3b82f6"; // blue
      case "online":
      case "stopped":
        return "#10b981"; // green
      case "offline":
        return "#6b7280"; // gray
      case "blocked":
        return "#ef4444"; // red
      default:
        return "#6b7280";
    }
  };

  const iconCacheRef = useRef(new Map<number, { key: string; icon: any }>());

  const createCustomIcon = (
    device: Device,
    position: Position,
    bearing?: number,
    showLabel = true,
  ) => {
    if (!L) return null;

    const color = getMarkerColor(device.status);
    const isPulsing = device.status === "moving";
    const course = typeof bearing === "number" ? bearing : position.course || 0;
    const vehicleIcon = getVehicleIconSVG(device.category, "#ffffff", 0);
    const plate = (device.plate || "").trim();
    const hasLabel = showLabel && !!plate;
    // Placa posicionada logo abaixo do círculo (52px do topo do container 48px)
    const labelHtml = hasLabel
      ? `
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:52px;background:rgba(0,0,0,0.78);border:1px solid rgba(255,255,255,0.18);border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;color:#fff;font-family:monospace;letter-spacing:0.6px;white-space:nowrap;pointer-events:none;user-select:none;">
        ${plate}
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
    const speedBucket =
      device.status === "moving"
        ? Math.round((position.speed || 0) / 5) * 5
        : Math.round(position.speed || 0);
    const blocked = device.attributes?.blocked ? 1 : 0;

    const cacheKey = `${device.status}|${blocked}|${device.category}|${courseBucket}|${speedBucket}|${showLabel ? 1 : 0}`;
    const cached = iconCacheRef.current.get(device.id);
    if (cached?.key === cacheKey) return cached.icon;

    const positionForIcon =
      position.speed === speedBucket ? position : ({ ...position, speed: speedBucket } as Position);

    const icon = createCustomIcon(device, positionForIcon, courseBucket, showLabel);
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

  const visibleDevices = useMemo(() => {
    if (!searchTerm) return devices;
    const searchLower = searchTerm.toLowerCase();
    return devices.filter(
      (d) =>
        d.name?.toLowerCase().includes(searchLower) ||
        d.plate?.toLowerCase().includes(searchLower) ||
        d.uniqueId?.toLowerCase().includes(searchLower),
    );
  }, [devices, searchTerm]);

  const devicesForTrails = useMemo(() => {
    if (!selectedDevice) return [] as Device[];
    return [selectedDevice];
  }, [selectedDevice]);

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
      <div
        className={`absolute top-3 z-[1000] flex items-center gap-2 transition-all ${selectedDevice ? "right-[328px]" : "right-3"}`}
      >
        <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg">
          <div className="px-3 py-1.5 flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              {isWsConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-400">Real-time</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-400">Polling</span>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-200">Movimento</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-200">Parado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span className="text-xs text-gray-200">Offline</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <span className="text-xs text-blue-400 font-medium">{devices.length} veículos</span>
          </div>
        </Card>
      </div>

      {/* Canto superior esquerdo: rota planejada (se ativa) + seletor de estilo */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        {plannedRouteName && plannedRouteGeometry.length >= 2 && showPlannedRouteLabel && (
          <Card
            className="backdrop-blur-xl shadow-lg px-3 py-2 flex items-center gap-2 w-fit"
            style={{
              background: `hsla(${colors.primary.light}, 0.8)`,
              borderColor: `hsla(${colors.primary.light}, 0.3)`,
            }}
          >
            <Route
              className="w-4 h-4 shrink-0"
              style={{ color: `hsla(${colors.primary.light}, 0.6)` }}
            />
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
        {/* Seletor de estilo do mapa */}
        <div className="flex items-center gap-1">
          <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg overflow-hidden">
            <div className="flex rounded-lg overflow-hidden">
              {(["dark", "light", "streets", "satellite"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setMapStyle(style)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    mapStyle === style
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {TILE_LAYERS[style].label}
                </button>
              ))}
            </div>
          </Card>

          {/* Toggle de cercas */}
          <button
            type="button"
            onClick={() => setShowGeofences((v) => !v)}
            title={showGeofences ? "Ocultar cercas" : "Mostrar cercas"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
              showGeofences
                ? "bg-orange-500/80 border-orange-400/50 text-white"
                : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Cercas {allGeofences.length > 0 && `(${allGeofences.length})`}
          </button>

          {/* Toggle de alertas de velocidade */}
          <button
            type="button"
            onClick={() => setShowSpeedAlerts((v) => !v)}
            title={
              showSpeedAlerts ? "Ocultar alertas de velocidade" : "Mostrar alertas de velocidade"
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
              showSpeedAlerts && visibleSpeedAlerts.length > 0
                ? "bg-amber-500/80 border-amber-400/50 text-white"
                : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Excessos {visibleSpeedAlerts.length > 0 && `(${visibleSpeedAlerts.length})`}
          </button>

          {/* Toggle de placas nos marcadores */}
          <button
            type="button"
            onClick={() => {
              setShowVehicleLabels((v) => {
                const next = !v;
                try {
                  localStorage.setItem("mapShowVehicleLabels", next ? "true" : "false");
                } catch {
                  /* ignore */
                }
                return next;
              });
              // Limpar cache de ícones para forçar recriação com/sem label
              iconCacheRef.current.clear();
            }}
            title={
              showVehicleLabels ? "Ocultar placas nos marcadores" : "Mostrar placas nos marcadores"
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg backdrop-blur-xl border ${
              showVehicleLabels
                ? "bg-sky-500/80 border-sky-400/50 text-white"
                : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Placas
          </button>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={12}
        minZoom={3}
        maxZoom={19}
        style={{ width: "100%", height: "100%" }}
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
            const color = (geofence.attributes?.color as string) || geofence.color || "#f97316";

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
          devices={devices}
          follow={followVehicle}
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
                  position={plannedRouteGeometry[plannedRouteGeometry.length - 1]}
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

        {/* Trilhas de movimento (últimos 5 minutos) */}
        {devicesForTrails.map((device) => {
          const trail = deviceTrails.get(device.id) || [];
          if (trail.length < 1) return null; // Renderizar mesmo com 1 ponto
          const coords = trail.map((p) => [p.lat, p.lng] as [number, number]);
          const smoothCoords = smoothTrail(coords, 1);
          return (
            <div key={`trail-${device.id}`}>
              {smoothCoords.length >= 2 && (
                <Polyline
                  positions={smoothCoords}
                  pathOptions={{
                    color: getMarkerColor(device.status),
                    weight: 4,
                    opacity: 0.95,
                    dashArray: "6, 8",
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              {/* Setas ao longo da trilha */}
              {smoothCoords.map((c, i) => {
                if (i === 0 || i % 3 !== 0 || i === smoothCoords.length - 1) return null;
                const prev = smoothCoords[i - 1];
                const dx = c[1] - prev[1];
                const dy = c[0] - prev[0];
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                const arrowHtml = `
                  <div style="transform: rotate(${angle}deg);">
                    <svg width=12 height=12 viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                      <path d='M2 12 L18 12 L14 8 L14 16 Z' fill='white' stroke='${getMarkerColor(device.status)}' stroke-width='0.5'/>
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
                    key={`arrow-${device.id}-${i}`}
                    position={c}
                    icon={icon}
                    interactive={false}
                  />
                );
              })}
            </div>
          );
        })}

        {/* ⚡ Marcadores de Excesso de Velocidade — apenas dispositivos desta conta */}
        {showSpeedAlerts &&
          L &&
          visibleSpeedAlerts.map((alert) => <SpeedAlertMarker key={alert.id} alert={alert} />)}

        {/* Markers para cada dispositivo */}
        {devices.map((device) => {
          const position = positionsMap.get(device.id);
          if (!position) return null;
          // compute bearing fallback from recent trail if course not present
          let bearing: number | undefined = undefined;
          if (typeof position.course === "number") {
            bearing = position.course;
          } else {
            const trail = deviceTrails.get(device.id) || [];
            if (trail.length >= 2) {
              try {
                const { bearingDeg } = require("@/lib/utils");
                const a = trail[trail.length - 2];
                const b = trail[trail.length - 1];
                bearing = bearingDeg(a.lat, a.lng, b.lat, b.lng);
              } catch (e) {
                bearing = undefined;
              }
            }
          }

          return (
            <Marker
              key={device.id}
              position={[position.latitude, position.longitude]}
              icon={getDeviceIcon(device, position, bearing, showVehicleLabels)}
              eventHandlers={{
                click: () => handleDeviceClick(device),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Compact Vehicle List */}
      <div className="absolute bottom-3 left-3 w-64 max-h-[50vh] overflow-hidden z-[1000]">
        <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg">
          <div className="p-3">
            <h3 className="font-semibold text-sm mb-2 text-gray-200 flex items-center justify-between">
              <span>Veículos</span>
              <span className="text-xs text-blue-400">
                {searchTerm ? `${visibleDevices.length} / ${devices.length}` : devices.length}
              </span>
            </h3>

            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-600/30 scrollbar-track-transparent">
              {visibleDevices.map((device) => {
                const position = positionsMap.get(device.id);
                return (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceClick(device)}
                    className={`w-full px-2.5 py-2 rounded-md text-left transition-all ${
                      selectedDevice?.id === device.id
                        ? "bg-blue-600/80 text-white"
                        : "bg-white/5 hover:bg-white/10 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getMarkerColor(device.status),
                          }}
                        />
                        <span className="font-semibold truncate text-xs">
                          {device.name || device.plate}
                        </span>
                      </div>
                      {position && (
                        <span className="text-[10px] font-bold ml-2 flex-shrink-0">
                          {Math.round(position.speed)} km/h
                        </span>
                      )}
                    </div>
                    {device.name && device.plate && (
                      <div className="text-[9px] text-gray-400 ml-3 truncate">{device.plate}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Speed Limit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-purple-500" />
              Editar Veículo
            </DialogTitle>
          </DialogHeader>
          {editingDevice && (
            <div className="space-y-4 py-2">
              {/* Info atual */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">
                  Editando: {editingDevice.plate} - {editingDevice.name}
                </p>
              </div>

              {/* Grid de Campos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome do Veículo */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" />
                    Nome do Veículo *
                  </Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Ex: Caminhão Branco"
                    required
                  />
                </div>

                {/* Identificador (IMEI) */}
                <div className="space-y-2">
                  <Label htmlFor="uniqueId" className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-cyan-500" />
                    Identificador (IMEI) *
                  </Label>
                  <Input
                    id="uniqueId"
                    value={editForm.uniqueId}
                    onChange={(e) => setEditForm({ ...editForm, uniqueId: e.target.value })}
                    placeholder="Ex: 864943044660344"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    IMEI, número de serial ou outro ID único
                  </p>
                </div>

                {/* Placa */}
                <div className="space-y-2">
                  <Label htmlFor="plate" className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-green-500" />
                    Placa *
                  </Label>
                  <Input
                    id="plate"
                    value={editForm.plate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        plate: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="ABC-1234"
                    maxLength={8}
                    required
                  />
                </div>

                {/* Telefone (SIM) */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    Telefone (SIM Card)
                  </Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Ex: 5562999958024"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número do chip instalado no rastreador
                  </p>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-purple-500" />
                    Categoria *
                  </Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) =>
                      setEditForm({
                        ...editForm,
                        category: value as VehicleCategory,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Carro</SelectItem>
                      <SelectItem value="motorcycle">Moto</SelectItem>
                      <SelectItem value="truck">Caminhão</SelectItem>
                      <SelectItem value="bus">Ônibus</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="trailer">Carreta</SelectItem>
                      <SelectItem value="bicycle">Bicicleta</SelectItem>
                      <SelectItem value="boat">Barco</SelectItem>
                      <SelectItem value="airplane">Avião</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <Label htmlFor="model" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    Modelo
                  </Label>
                  <Input
                    id="model"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="Ex: KYX-5E62"
                  />
                </div>

                {/* Ano */}
                <div className="space-y-2">
                  <Label htmlFor="year" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Ano
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={editForm.year}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        year: parseInt(e.target.value) || 2024,
                      })
                    }
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                {/* Cor */}
                <div className="space-y-2">
                  <Label htmlFor="color" className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-500" />
                    Cor
                  </Label>
                  <Input
                    id="color"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    placeholder="Ex: Branco"
                  />
                </div>

                {/* Contato (ICCID) */}
                <div className="space-y-2">
                  <Label htmlFor="contact" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-500" />
                    Contato / ICCID
                  </Label>
                  <Input
                    id="contact"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    placeholder="Ex: ICCID 8955320210007029201Z"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome do responsável ou ICCID do chip
                  </p>
                </div>

                {/* Limite de Velocidade */}
                <div className="space-y-2">
                  <Label htmlFor="speedLimit" className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-yellow-500" />
                    Limite de Velocidade
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="speedLimit"
                      type="number"
                      value={editForm.speedLimit}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          speedLimit: parseInt(e.target.value) || 80,
                        })
                      }
                      min="10"
                      max="200"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">km/h</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alerta quando exceder {editForm.speedLimit} km/h
                  </p>
                </div>

                {/* Validade */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="expiryDate" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-500" />
                    Validade do Rastreador
                  </Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data de vencimento do contrato ou licença do dispositivo
                  </p>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSaveDevice}
                  style={{
                    background: `linear-gradient(to right, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
                  }}
                  className="flex-1 hover:shadow-lg transition-shadow"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Details Panel */}
      <VehicleDetailsPanel
        device={selectedDevice}
        position={selectedDevice ? positionsMap.get(selectedDevice.id) || null : null}
        recentDistanceKm={selectedDevice ? deviceRecentDistance.get(selectedDevice.id) || 0 : 0}
        recentTrail={selectedDevice ? deviceTrails.get(selectedDevice.id) || [] : []}
        onClose={() => setSelectedDevice(null)}
        onEdit={(device) => {
          handleEditDevice(device);
        }}
        onReplay={(deviceId) => router.push(`/replay?vehicle=${deviceId}`)}
        onVideo={(deviceId) => router.push(`/video?device=${deviceId}`)}
        onDetails={(deviceId) => router.push(`/vehicles/${deviceId}`)}
        onManageGeofences={(device) => setGeofenceDialogDevice(device)}
        onStreetView={(lat, lng) => {
          const url = `https://www.google.com/maps/@${lat},${lng},18z`;
          window.open(url, "_blank");
        }}
      />

      {/* Dialog: Gerenciar Cercas do Veículo */}
      <Dialog
        open={!!geofenceDialogDevice}
        onOpenChange={(open) => {
          if (!open) setGeofenceDialogDevice(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              Cercas de {geofenceDialogDevice?.name}
            </DialogTitle>
          </DialogHeader>

          {allGeofences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
              Nenhuma cerca cadastrada. Crie cercas em <strong>/geofences</strong>.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {allGeofences.map((geofence) => {
                const isLinked = deviceGeofenceIds.has(geofence.id);
                const isLoading = assigningGeofenceId === geofence.id;
                return (
                  <div
                    key={geofence.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isLinked
                        ? "border-orange-500/50 bg-orange-500/10"
                        : "border-border bg-card/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: geofence.color || "#3b82f6" }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{geofence.name}</p>
                        <p className="text-xs text-muted-foreground">{geofence.type}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isLinked ? "destructive" : "default"}
                      disabled={isLoading}
                      onClick={() => handleToggleGeofence(geofence.id)}
                      className="flex-shrink-0 ml-2"
                    >
                      {isLoading ? (
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : isLinked ? (
                        "Remover"
                      ) : (
                        "Aplicar"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
