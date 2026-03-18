"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventTypeLabel, getEventTypeColor, formatDate } from "@/lib/utils";
import { ALARM_SUBTYPES } from "./event-constants";
import {
  AlertTriangle,
  CheckCircle,
  Bell,
  Zap,
  Shield,
  Battery,
  Radio,
  MapPin,
  Car,
  User,
  Calendar,
  Wifi,
  WifiOff,
  Key,
  Wrench,
  Fuel,
  Navigation,
  CircleStop,
  Siren,
  Camera,
  Terminal,
  MessageSquare,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Event, Device } from "@/types";

function getEventIcon(type: string, alarmType?: string) {
  switch (type) {
    case "speedLimit":
    case "deviceOverspeed":
      return <Zap className="w-5 h-5" />;
    case "deviceBlocked":
    case "deviceUnblocked":
      return <Shield className="w-5 h-5" />;
    case "lowBattery":
      return <Battery className="w-5 h-5" />;
    case "connectionLost":
    case "deviceOffline":
      return <WifiOff className="w-5 h-5" />;
    case "connectionRestored":
    case "deviceOnline":
      return <Wifi className="w-5 h-5" />;
    case "deviceUnknown":
    case "deviceInactive":
      return <Clock className="w-5 h-5" />;
    case "geofence":
    case "geofenceEnter":
    case "geofenceExit":
      return <MapPin className="w-5 h-5" />;
    case "ignitionOn":
    case "ignitionOff":
      return <Key className="w-5 h-5" />;
    case "deviceMoving":
      return <Navigation className="w-5 h-5" />;
    case "deviceStopped":
      return <CircleStop className="w-5 h-5" />;
    case "maintenance":
      return <Wrench className="w-5 h-5" />;
    case "fuelDrop":
      return <TrendingDown className="w-5 h-5" />;
    case "fuelIncrease":
      return <TrendingUp className="w-5 h-5" />;
    case "alarm":
      if (alarmType === "sos") return <Siren className="w-5 h-5" />;
      return <AlertTriangle className="w-5 h-5" />;
    case "driverChanged":
      return <UserCheck className="w-5 h-5" />;
    case "commandResult":
      return <Terminal className="w-5 h-5" />;
    case "textMessage":
      return <MessageSquare className="w-5 h-5" />;
    case "media":
      return <Camera className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
}

/** Retorna a cor da borda esquerda conforme severidade */
function getEventSeverityBorder(type: string): string {
  switch (type) {
    case "alarm":
    case "deviceOffline":
    case "connectionLost":
    case "fuelDrop":
    case "deviceBlocked":
      return "border-l-red-500";
    case "speedLimit":
    case "deviceOverspeed":
    case "geofenceExit":
    case "lowBattery":
    case "maintenance":
    case "deviceInactive":
      return "border-l-amber-500";
    case "deviceOnline":
    case "connectionRestored":
    case "deviceUnblocked":
    case "ignitionOn":
    case "fuelIncrease":
      return "border-l-green-500";
    default:
      return "border-l-blue-500";
  }
}

interface EventCardProps {
  event: Event;
  device: Device | undefined;
  clientName: string | null;
  isResolvePending: boolean;
  isLoadingMap: boolean;
  onResolve: (eventId: number) => void;
  onViewOnMap: (event: Event, device: Device | undefined) => void;
}

export const EventCard = React.memo(function EventCard({
  event,
  device,
  clientName,
  isResolvePending,
  isLoadingMap,
  onResolve,
  onViewOnMap,
}: EventCardProps) {
  const vehicleLabel = device
    ? `${device.name}${device.plate ? ` · ${device.plate}` : ""}`
    : `Veículo #${event.deviceId}`;

  const isSpeedEvent =
    event.type === "speedLimit" || event.type === "deviceOverspeed";
  const isGeofenceEvent =
    event.type === "geofenceEnter" || event.type === "geofenceExit" || event.type === "geofence";

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md border-l-4 ${getEventSeverityBorder(event.type)} ${
        event.resolved
          ? "bg-card/80 border-border opacity-75"
          : "bg-card border-border"
      }`}
    >
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4">
          <div className="flex flex-1 gap-3 min-w-0">
            <div
              className={`shrink-0 p-2.5 rounded-lg ${getEventTypeColor(event.type)}`}
            >
              {getEventIcon(event.type, event.attributes?.alarm)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {getEventTypeLabel(event.type)}
                </h3>
                {event.type === "alarm" && event.attributes?.alarm && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {ALARM_SUBTYPES[event.attributes.alarm] || event.attributes.alarm}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    event.resolved
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {event.resolved ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-0.5" /> Resolvido
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 mr-0.5" /> Ativo
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span
                  className="flex items-center gap-1"
                  title={vehicleLabel}
                >
                  <Car className="w-3 h-3" />
                  <span className="truncate font-medium text-foreground/80">
                    {vehicleLabel}
                  </span>
                </span>
                {clientName && (
                  <span
                    className="flex items-center gap-1"
                    title={clientName}
                  >
                    <User className="w-3 h-3" />
                    <span className="truncate">{clientName}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(event.serverTime)}
                </span>
              </div>
              <EventDetails event={event} device={device} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!event.resolved && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={() => onResolve(event.id)}
                disabled={isResolvePending}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Resolver
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={isLoadingMap}
              onClick={() => onViewOnMap(event, device)}
            >
              <MapPin className="w-3.5 h-3.5 mr-1" />
              {isLoadingMap ? "Abrindo..." : "Ver no mapa"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

/** Detalhes extras dependendo do tipo de evento */
const EventDetails = React.memo(function EventDetails({
  event,
  device,
}: {
  event: Event;
  device?: Device;
}) {
  const attrs = event.attributes || {};
  const type = event.type;

  // Excesso de velocidade
  if (
    (type === "speedLimit" || type === "deviceOverspeed") &&
    (attrs.speed != null || attrs.limit != null)
  ) {
    const speed = attrs.speed != null ? Math.round(attrs.speed * 1.852) : null;
    const limit = attrs.limit != null
      ? Math.round(attrs.limit * 1.852)
      : attrs.speedLimit != null
        ? Math.round(attrs.speedLimit * 1.852)
        : device?.speedLimit ?? null;
    const excess = speed != null && limit != null ? speed - limit : null;

    return (
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {speed != null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-semibold">
            <Zap className="w-3 h-3" />
            {speed} km/h
          </span>
        )}
        {limit != null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Limite: {limit} km/h
          </span>
        )}
        {excess != null && excess > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
            +{excess} km/h acima
          </span>
        )}
      </div>
    );
  }

  // Bateria fraca
  if (type === "lowBattery" && attrs.batteryLevel != null) {
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
          <Battery className="w-3 h-3" />
          Bateria: {attrs.batteryLevel}%
        </span>
      </div>
    );
  }

  // Geocercas
  if (
    (type === "geofence" || type === "geofenceEnter" || type === "geofenceExit") &&
    attrs.geofenceName
  ) {
    const isExit = type === "geofenceExit";
    return (
      <div className="mt-2 text-xs">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
          isExit ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
        } font-medium`}>
          <MapPin className="w-3 h-3" />
          {isExit ? "Saiu de" : "Entrou em"}: {attrs.geofenceName}
        </span>
      </div>
    );
  }

  // Alarme
  if (type === "alarm" && attrs.alarm) {
    const alarmLabel = ALARM_SUBTYPES[attrs.alarm] || attrs.alarm;
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
          <Siren className="w-3 h-3" />
          {alarmLabel}
        </span>
      </div>
    );
  }

  // Combustível
  if ((type === "fuelDrop" || type === "fuelIncrease") && attrs.fuelLevel != null) {
    const isFuelDrop = type === "fuelDrop";
    return (
      <div className="mt-2 text-xs">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
          isFuelDrop ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-green-500/10 text-green-600 dark:text-green-400"
        } font-medium`}>
          <Fuel className="w-3 h-3" />
          Combustível: {Math.round(attrs.fuelLevel)}%
        </span>
      </div>
    );
  }

  // Manutenção
  if (type === "maintenance" && attrs.maintenanceName) {
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
          <Wrench className="w-3 h-3" />
          {attrs.maintenanceName}
        </span>
      </div>
    );
  }

  // Motorista alterado
  if (type === "driverChanged" && attrs.driverUniqueId) {
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
          <UserCheck className="w-3 h-3" />
          Motorista: {attrs.driverUniqueId}
        </span>
      </div>
    );
  }

  // Resultado de comando
  if (type === "commandResult" && attrs.result) {
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
          <Terminal className="w-3 h-3" />
          {String(attrs.result).slice(0, 100)}
        </span>
      </div>
    );
  }

  // Mensagem de texto
  if (type === "textMessage" && attrs.message) {
    return (
      <div className="mt-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
          <MessageSquare className="w-3 h-3" />
          {String(attrs.message).slice(0, 120)}
        </span>
      </div>
    );
  }

  return null;
});
