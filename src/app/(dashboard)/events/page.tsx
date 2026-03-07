"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEvents,
  markEventAsResolved,
  getDevices,
  getClients,
  getPositions,
  getPositionById,
} from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  AlertTriangle,
  RefreshCw,
  Zap,
  MapPin,
  Siren,
  Wifi,
  WifiOff,
  Fuel,
} from "lucide-react";
import { Event, Device } from "@/types";
import { toast } from "sonner";
import { getEventTypeLabel } from "@/lib/utils";
import {
  EventFilters,
  EventList,
  PERIOD_OPTIONS,
  getDeviceIdsForUser,
} from "@/components/events";

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [periodDays, setPeriodDays] = useState("7");
  const [loadingMapEventId, setLoadingMapEventId] = useState<number | null>(
    null,
  );
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  // ─── Data fetching ───
  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(),
  });

  const deviceIds = useMemo(
    () => getDeviceIdsForUser(devices, user),
    [devices, user],
  );
  const deviceIdsKey = useMemo(
    () => [...deviceIds].sort((a, b) => a - b).join(","),
    [deviceIds],
  );
  const filteredDevices = useMemo(
    () => devices.filter((d) => deviceIds.includes(d.id)),
    [devices, deviceIds],
  );

  const period =
    PERIOD_OPTIONS.find((p) => p.value === periodDays) ?? PERIOD_OPTIONS[2];
  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["events", deviceIdsKey, period.days],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000);
      return getEvents({
        from: from.toISOString(),
        to: now.toISOString(),
        deviceIds,
      });
    },
    enabled: devices !== undefined && deviceIds.length >= 0,
    refetchInterval: 30000,
  });

  // ─── Mutations ───
  const markAsResolvedMutation = useMutation({
    mutationFn: markEventAsResolved,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento marcado como resolvido");
    },
    onError: () => {
      toast.error("Não foi possível marcar como resolvido");
    },
  });

  // ─── Event handlers ───
  const handleViewOnMap = useCallback(
    async (event: Event, device: Device | undefined) => {
      setLoadingMapEventId(event.id);
      try {
        let latitude: number | undefined;
        let longitude: number | undefined;

        if (event.positionId) {
          try {
            const pos = await getPositionById(event.positionId);
            if (pos) {
              latitude = pos.latitude;
              longitude = pos.longitude;
            }
          } catch {
            /* fallback */
          }
        }

        if (latitude == null) {
          try {
            const positions = await getPositions({ deviceId: event.deviceId });
            const pos = positions?.[0];
            if (pos) {
              latitude = pos.latitude;
              longitude = pos.longitude;
            }
          } catch {
            /* sem posição */
          }
        }

        // Para eventos de velocidade, criar marcador no mapa
        const isSpeedEvent = event.type === "speedLimit" || event.type === "deviceOverspeed";
        if (isSpeedEvent && latitude != null && longitude != null) {
          const rawSpeed = event.attributes?.speed || 0;
          const rawLimit = event.attributes?.speedLimit ?? event.attributes?.limit ?? 0;
          const alert = {
            id: `event-${event.id}`,
            deviceId: event.deviceId,
            deviceName:
              device?.plate || device?.uniqueId || `Veículo #${event.deviceId}`,
            vehicleName: device?.name,
            speed: rawSpeed > 0 ? Math.round(rawSpeed * 1.852) : 0,
            speedLimit: device?.speedLimit ?? (rawLimit > 0 ? Math.round(rawLimit * 1.852) : 0),
            latitude,
            longitude,
            timestamp: event.serverTime,
          };

          try {
            const stored = localStorage.getItem("speedAlerts");
            const alerts = stored ? JSON.parse(stored) : [];
            const filtered = alerts.filter(
              (a: { id: string }) => a.id !== alert.id,
            );
            filtered.unshift(alert);
            localStorage.setItem(
              "speedAlerts",
              JSON.stringify(filtered.slice(0, 100)),
            );
            window.dispatchEvent(
              new CustomEvent("speedAlertAdded", { detail: alert }),
            );
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* navega normalmente */
      }
      setLoadingMapEventId(null);
      router.push(`/map?deviceId=${event.deviceId}`);
    },
    [router],
  );

  // ─── Filtered & sorted events ───
  const filteredEvents = useMemo(() => {
    const deviceIdFilter =
      deviceFilter === "all" ? null : parseInt(deviceFilter, 10);

    const list = events.filter((event) => {
      const device = devices.find((d) => d.id === event.deviceId);
      const matchesSearch =
        !searchQuery.trim() ||
        (device &&
          (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.plate?.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !event.resolved) ||
        (statusFilter === "resolved" && event.resolved);
      const matchesType =
        typeFilter === "all" ||
        event.type === typeFilter ||
        // deviceOverspeed e speedLimit são o mesmo conceito
        (typeFilter === "speedLimit" && event.type === "deviceOverspeed") ||
        (typeFilter === "deviceOverspeed" && event.type === "speedLimit");
      const matchesDevice =
        !deviceIdFilter || event.deviceId === deviceIdFilter;
      return matchesSearch && matchesStatus && matchesType && matchesDevice;
    });

    list.sort(
      (a, b) =>
        new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime(),
    );
    return list;
  }, [events, devices, searchQuery, statusFilter, typeFilter, deviceFilter]);

  // ─── Stats ───
  const activeCount = events.filter((e) => !e.resolved).length;
  const resolvedCount = events.filter((e) => e.resolved).length;

  // Contagem por categoria
  const eventCounts = useMemo(() => {
    const counts = { speed: 0, geofence: 0, alarm: 0, online: 0, offline: 0, fuel: 0, other: 0 };
    for (const e of events) {
      if (e.type === "speedLimit" || e.type === "deviceOverspeed") counts.speed++;
      else if (e.type === "geofenceEnter" || e.type === "geofenceExit" || e.type === "geofence") counts.geofence++;
      else if (e.type === "alarm") counts.alarm++;
      else if (e.type === "deviceOnline" || e.type === "connectionRestored") counts.online++;
      else if (e.type === "deviceOffline" || e.type === "connectionLost") counts.offline++;
      else if (e.type === "fuelDrop" || e.type === "fuelIncrease") counts.fuel++;
      else counts.other++;
    }
    return counts;
  }, [events]);

  // ─── Quick filter helpers ───
  const handleQuickFilter = (type: string) => {
    setTypeFilter(typeFilter === type ? "all" : type);
  };

  // ─── Render ───
  return (
    <div className="space-y-4">
      <PageHeader
        icon={AlertTriangle}
        title="Eventos e Alertas"
        description="Monitore e gerencie todos os eventos e alertas dos veículos"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEvents()}
            disabled={eventsLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${eventsLoading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        }
        stats={[
          { label: "Ativos", value: activeCount, variant: "danger" },
          { label: "Resolvidos", value: resolvedCount, variant: "success" },
          {
            label: "Total no período",
            value: events.length,
            variant: "default",
          },
        ]}
      />

      {/* ─── Quick stats cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <QuickStatCard
          icon={<Zap className="w-4 h-4 text-amber-500" />}
          label="Velocidade"
          count={eventCounts.speed}
          active={typeFilter === "speedLimit"}
          onClick={() => handleQuickFilter("speedLimit")}
        />
        <QuickStatCard
          icon={<MapPin className="w-4 h-4 text-blue-500" />}
          label="Cercas"
          count={eventCounts.geofence}
          active={typeFilter === "geofenceEnter" || typeFilter === "geofenceExit"}
          onClick={() => handleQuickFilter("geofenceEnter")}
        />
        <QuickStatCard
          icon={<Siren className="w-4 h-4 text-red-500" />}
          label="Alarmes"
          count={eventCounts.alarm}
          active={typeFilter === "alarm"}
          onClick={() => handleQuickFilter("alarm")}
        />
        <QuickStatCard
          icon={<Wifi className="w-4 h-4 text-green-500" />}
          label="Online"
          count={eventCounts.online}
          active={typeFilter === "deviceOnline"}
          onClick={() => handleQuickFilter("deviceOnline")}
        />
        <QuickStatCard
          icon={<WifiOff className="w-4 h-4 text-red-500" />}
          label="Offline"
          count={eventCounts.offline}
          active={typeFilter === "deviceOffline"}
          onClick={() => handleQuickFilter("deviceOffline")}
        />
        <QuickStatCard
          icon={<Fuel className="w-4 h-4 text-purple-500" />}
          label="Combustível"
          count={eventCounts.fuel}
          active={typeFilter === "fuelDrop" || typeFilter === "fuelIncrease"}
          onClick={() => handleQuickFilter("fuelDrop")}
        />
      </div>

      <EventFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        deviceFilter={deviceFilter}
        onDeviceChange={setDeviceFilter}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
        devices={filteredDevices}
      />

      {/* Indicador de filtro ativo */}
      {typeFilter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Filtro: {getEventTypeLabel(typeFilter)}
            <button
              onClick={() => setTypeFilter("all")}
              className="ml-1 hover:text-foreground"
            >
              ×
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">
            {filteredEvents.length} evento{filteredEvents.length !== 1 ? "s" : ""} encontrado{filteredEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <EventList
        events={filteredEvents}
        devices={devices}
        clients={clients}
        isLoading={devicesLoading || eventsLoading}
        isResolvePending={markAsResolvedMutation.isPending}
        loadingMapEventId={loadingMapEventId}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        deviceFilter={deviceFilter}
        periodDays={periodDays}
        onResolve={(id) => markAsResolvedMutation.mutate(id)}
        onViewOnMap={handleViewOnMap}
      />
    </div>
  );
}

/** Card compacto para filtro rápido por categoria */
function QuickStatCard({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-sm ${
        active ? "ring-2 ring-primary border-primary" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none tabular-nums">{count}</p>
          <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
