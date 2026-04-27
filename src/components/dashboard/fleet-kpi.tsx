"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Gauge, Route, AlertTriangle, Fuel, MapPin, Activity, Zap } from "lucide-react";
import type { Device, Position, Event } from "@/types";

interface FleetKpiProps {
  devices: Device[];
  positions: Position[];
  events: Event[];
}

interface KpiItem {
  label: string;
  value: string;
  subtext: string;
  basis: string;
  icon: typeof Gauge;
  color: string;
  bgColor: string;
}

type FleetKpiPeriod = "24h" | "7d" | "15d" | "30d";

const STORAGE_KEY = "fleetKpiPeriod";

const PERIOD_OPTIONS: Array<{ value: FleetKpiPeriod; label: string; ms: number }> = [
  { value: "24h", label: "Últimas 24h", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "15d", label: "Últimos 15 dias", ms: 15 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Últimos 30 dias", ms: 30 * 24 * 60 * 60 * 1000 },
];

export function FleetKpi({ devices, positions, events }: FleetKpiProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<FleetKpiPeriod>("7d");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as FleetKpiPeriod | null;
      if (stored && PERIOD_OPTIONS.some((option) => option.value === stored)) {
        setSelectedPeriod(stored);
      }
    } catch {}
  }, []);

  const periodMeta = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === selectedPeriod) ?? PERIOD_OPTIONS[1],
    [selectedPeriod],
  );

  const kpis = useMemo<KpiItem[]>(() => {
    const periodStart = Date.now() - periodMeta.ms;
    const filteredEvents = events.filter((event) => {
      const eventTime = new Date(event.serverTime).getTime();
      return Number.isFinite(eventTime) && eventTime >= periodStart;
    });

    // Fleet utilization: devices that are online or moving / total
    const activeDevices = devices.filter(
      (d) => d.status === "online" || d.status === "moving",
    ).length;
    const utilization = devices.length > 0 ? Math.round((activeDevices / devices.length) * 100) : 0;

    // Average speed of moving vehicles (positions já normalizadas para km/h)
    const movingPositions = positions.filter((p) => p.speed > 0);
    const avgSpeed =
      movingPositions.length > 0
        ? Math.round(movingPositions.reduce((sum, p) => sum + p.speed, 0) / movingPositions.length)
        : 0;

    // Max speed across fleet (já em km/h)
    const maxSpeed =
      positions.length > 0 ? Math.round(Math.max(...positions.map((p) => p.speed))) : 0;

    // Total distance traveled (Traccar totalDistance is in meters → ÷ 1000 = km)
    const totalDistanceKm = positions.reduce((sum, p) => {
      const distMeters = p.attributes?.totalDistance || 0;
      return sum + distMeters / 1000;
    }, 0);
    const totalDistanceFormatted =
      totalDistanceKm >= 1_000_000
        ? `${(totalDistanceKm / 1_000_000).toFixed(1)}M km`
        : totalDistanceKm >= 1_000
          ? `${(totalDistanceKm / 1_000).toFixed(0)}k km`
          : `${Math.round(totalDistanceKm)} km`;

    // Overspeed events today
    const overspeedEvents = filteredEvents.filter(
      (e) => e.type === "deviceOverspeed" || e.type === "speedLimit",
    ).length;

    const geofenceEvents = filteredEvents.filter(
      (e) => e.type === "geofenceEnter" || e.type === "geofenceExit" || e.type === "geofence",
    ).length;

    const fuelAlerts = filteredEvents.filter(
      (e) => e.type === "fuelDrop" || e.type === "fuelIncrease",
    ).length;

    // Devices with ignition on
    const ignitionOn = positions.filter((p) => p.attributes?.ignition === true).length;

    return [
      {
        label: "Utilização da Frota",
        value: `${utilization}%`,
        subtext: `${activeDevices} de ${devices.length} ativos`,
        basis: "Base: status atual em tempo real",
        icon: Activity,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
      },
      {
        label: "Velocidade Média",
        value: `${avgSpeed} km/h`,
        subtext: `Máx: ${maxSpeed} km/h`,
        basis: "Base: posições atuais da frota",
        icon: Gauge,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
      {
        label: "Distância Total",
        value: totalDistanceFormatted,
        subtext: "Acumulado da frota",
        basis: "Base: odômetro atual agregado",
        icon: Route,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
      },
      {
        label: "Alertas de Velocidade",
        value: `${overspeedEvents}`,
        subtext: periodMeta.label,
        basis: `Base: eventos filtrados em ${periodMeta.label.toLowerCase()}`,
        icon: AlertTriangle,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      {
        label: "Eventos Geocerca",
        value: `${geofenceEvents}`,
        subtext: "Entradas e saídas",
        basis: `Base: eventos filtrados em ${periodMeta.label.toLowerCase()}`,
        icon: MapPin,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
      {
        label: "Alertas Combustível",
        value: `${fuelAlerts}`,
        subtext: "Quedas e abastecimentos",
        basis: `Base: eventos filtrados em ${periodMeta.label.toLowerCase()}`,
        icon: Fuel,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      },
      {
        label: "Ignição Ligada",
        value: `${ignitionOn}`,
        subtext: `${devices.length > 0 ? Math.round((ignitionOn / devices.length) * 100) : 0}% da frota`,
        basis: "Base: ignição atual por posição",
        icon: Zap,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
      },
      {
        label: "Eficiência Online",
        value: `${devices.length > 0 ? Math.round((devices.filter((d) => d.status !== "offline").length / devices.length) * 100) : 0}%`,
        subtext: `${devices.filter((d) => d.status === "offline").length} offline`,
        basis: "Base: conectividade atual da frota",
        icon: TrendingUp,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      },
    ];
  }, [devices, positions, events, periodMeta]);

  const handlePeriodChange = (value: string) => {
    const nextValue = value as FleetKpiPeriod;
    setSelectedPeriod(nextValue);
    try {
      localStorage.setItem(STORAGE_KEY, nextValue);
    } catch {}
  };

  return (
    <Card className="lg:col-span-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            KPIs da Frota
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Período analítico configurável. Métricas instantâneas aparecem marcadas como tempo real.
          </p>
        </div>
        <div className="w-full sm:w-[220px]">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors"
              >
                <div className={`p-2 rounded-lg ${kpi.bgColor} shrink-0`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs font-medium text-foreground truncate">{kpi.label}</p>
                  <p className="text-[11px] text-muted-foreground">{kpi.subtext}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/80">{kpi.basis}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
