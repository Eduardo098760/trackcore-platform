"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Gauge,
  Route,
  AlertTriangle,
  Fuel,
  MapPin,
  Activity,
  Zap,
} from "lucide-react";
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
  icon: typeof Gauge;
  color: string;
  bgColor: string;
}

export function FleetKpi({ devices, positions, events }: FleetKpiProps) {
  const kpis = useMemo<KpiItem[]>(() => {
    const posMap = new Map(positions.map((p) => [p.deviceId, p]));

    // Fleet utilization: devices that are online or moving / total
    const activeDevices = devices.filter(
      (d) => d.status === "online" || d.status === "moving",
    ).length;
    const utilization =
      devices.length > 0
        ? Math.round((activeDevices / devices.length) * 100)
        : 0;

    // Average speed of moving vehicles (Traccar speed is in knots → × 1.852 = km/h)
    const KNOTS_TO_KMH = 1.852;
    const movingPositions = positions.filter((p) => p.speed > 0);
    const avgSpeed =
      movingPositions.length > 0
        ? Math.round(
            (movingPositions.reduce((sum, p) => sum + p.speed, 0) *
              KNOTS_TO_KMH) /
              movingPositions.length,
          )
        : 0;

    // Max speed across fleet (knots → km/h)
    const maxSpeed =
      positions.length > 0
        ? Math.round(
            Math.max(...positions.map((p) => p.speed)) * KNOTS_TO_KMH,
          )
        : 0;

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
    const overspeedEvents = events.filter(
      (e) => e.type === "deviceOverspeed" || e.type === "speedLimit",
    ).length;

    // Geofence events today
    const geofenceEvents = events.filter(
      (e) =>
        e.type === "geofenceEnter" ||
        e.type === "geofenceExit" ||
        e.type === "geofence",
    ).length;

    // Fuel alerts
    const fuelAlerts = events.filter(
      (e) => e.type === "fuelDrop" || e.type === "fuelIncrease",
    ).length;

    // Devices with ignition on
    const ignitionOn = positions.filter(
      (p) => p.attributes?.ignition === true,
    ).length;

    return [
      {
        label: "Utilização da Frota",
        value: `${utilization}%`,
        subtext: `${activeDevices} de ${devices.length} ativos`,
        icon: Activity,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
      },
      {
        label: "Velocidade Média",
        value: `${avgSpeed} km/h`,
        subtext: `Máx: ${maxSpeed} km/h`,
        icon: Gauge,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
      {
        label: "Distância Total",
        value: totalDistanceFormatted,
        subtext: "Acumulado da frota",
        icon: Route,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
      },
      {
        label: "Alertas de Velocidade",
        value: `${overspeedEvents}`,
        subtext: "No período",
        icon: AlertTriangle,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      {
        label: "Eventos Geocerca",
        value: `${geofenceEvents}`,
        subtext: "Entradas e saídas",
        icon: MapPin,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
      {
        label: "Alertas Combustível",
        value: `${fuelAlerts}`,
        subtext: "Quedas e abastecimentos",
        icon: Fuel,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      },
      {
        label: "Ignição Ligada",
        value: `${ignitionOn}`,
        subtext: `${devices.length > 0 ? Math.round((ignitionOn / devices.length) * 100) : 0}% da frota`,
        icon: Zap,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
      },
      {
        label: "Eficiência Online",
        value: `${devices.length > 0 ? Math.round((devices.filter((d) => d.status !== "offline").length / devices.length) * 100) : 0}%`,
        subtext: `${devices.filter((d) => d.status === "offline").length} offline`,
        icon: TrendingUp,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      },
    ];
  }, [devices, positions, events]);

  return (
    <Card className="lg:col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          KPIs da Frota
        </CardTitle>
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
                  <p className={`text-lg font-bold ${kpi.color}`}>
                    {kpi.value}
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">
                    {kpi.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {kpi.subtext}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
