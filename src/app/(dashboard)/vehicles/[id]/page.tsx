"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDevice } from "@/lib/api/devices";
import { getPositionByDevice } from "@/lib/api";
import { usePositionAddress } from "@/lib/hooks/usePositionAddress";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import {
  getDeviceStatusColor,
  getDeviceStatusLabel,
  deriveDeviceStatus,
  formatDate,
} from "@/lib/utils";
import { getVehicleIcon } from "@/lib/vehicle-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Gauge,
  Navigation,
  Zap,
  Activity,
  Battery,
  Satellite,
  Radio,
  FileText,
  Phone,
  Copy,
  ExternalLink,
  History,
  Video,
  Edit,
  Loader2,
  Car,
  Hash,
  Smartphone,
  User,
  Palette,
  Calendar,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const deviceId = Number(params?.id);

  const {
    data: device,
    isLoading: loadingDevice,
    error: deviceError,
  } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => getDevice(deviceId),
    enabled: !!deviceId,
    refetchInterval: 30_000,
  });

  const {
    data: position,
    isLoading: loadingPosition,
  } = useQuery({
    queryKey: ["position", deviceId],
    queryFn: () => getPositionByDevice(deviceId),
    enabled: !!deviceId,
    refetchInterval: 10_000,
  });

  const { enrichedPosition, isLoadingAddress } = usePositionAddress(position ?? null);

  const lastUpdateLabel = useRelativeTime(device?.lastUpdate, position?.serverTime) || "Sem dados";

  useEffect(() => {
    if (deviceError) {
      toast.error("Veículo não encontrado");
      router.push("/vehicles");
    }
  }, [deviceError, router]);

  if (loadingDevice || loadingPosition) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!device) return null;

  const effectiveStatus = deriveDeviceStatus(device.status, position);
  const IconComponent = getVehicleIcon(device.category);
  const isMotion = position?.attributes?.motion;
  const isIgnitionOn = position?.attributes?.ignition;
  const batteryLevel = position?.attributes?.batteryLevel ?? 0;
  const satCount = position?.attributes?.sat ?? 0;
  const speedExceeded = device.speedLimit && position && position.speed > device.speedLimit;
  const batteryColor = batteryLevel > 60 ? "text-green-500" : batteryLevel > 30 ? "text-yellow-500" : "text-red-500";

  const address =
    enrichedPosition?.address ||
    (position
      ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
      : "Sem posição");

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const totalDistanceKm = position?.attributes?.totalDistance
    ? (position.attributes.totalDistance / 1000).toFixed(2)
    : position?.attributes?.odometer
      ? (position.attributes.odometer / 1000).toFixed(2)
      : "0.00";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div
            className="w-12 h-12 rounded-full flex items-center justify-center border-2"
            style={{
              borderColor:
                effectiveStatus === "moving"
                  ? "#3b82f6"
                  : effectiveStatus === "online" || effectiveStatus === "stopped"
                    ? "#10b981"
                    : "#6b7280",
              background: `${effectiveStatus === "moving" ? "#3b82f6" : effectiveStatus === "online" || effectiveStatus === "stopped" ? "#10b981" : "#6b7280"}15`,
            }}
          >
            <IconComponent
              className="w-6 h-6"
              style={{
                color:
                  effectiveStatus === "moving"
                    ? "#3b82f6"
                    : effectiveStatus === "online" || effectiveStatus === "stopped"
                      ? "#10b981"
                      : "#6b7280",
              }}
            />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{device.name}</h1>
              <Badge className={getDeviceStatusColor(effectiveStatus)}>
                {getDeviceStatusLabel(effectiveStatus)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {device.plate && (
                <span className="font-mono font-medium">{device.plate}</span>
              )}
              {device.model && (
                <>
                  <span>•</span>
                  <span>{device.model}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/map?device=${device.id}`)}
          >
            <MapPin className="w-4 h-4 mr-1" />
            Ver no Mapa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/replay?deviceId=${device.id}`)}
          >
            <History className="w-4 h-4 mr-1" />
            Replay
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Última comunicação:</span>
          <span className="text-sm font-medium">{lastUpdateLabel}</span>
        </div>
        {position && (
          <>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">GPS:</span>
              <span className="text-sm font-mono">{formatDate(position.fixTime)}</span>
            </div>
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Velocidade */}
        <Card className={speedExceeded ? "border-destructive/50" : undefined}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gauge className={`w-5 h-5 ${speedExceeded ? "text-destructive" : "text-primary"}`} />
                <span className="text-sm font-medium">Velocidade</span>
              </div>
              {speedExceeded && <Badge variant="destructive">EXCEDIDO</Badge>}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tabular-nums ${speedExceeded ? "text-destructive" : ""}`}>
                {position ? Math.round(position.speed) : 0}
              </span>
              <span className="text-sm text-muted-foreground">km/h</span>
            </div>
            {device.speedLimit && (
              <p className="text-xs text-muted-foreground mt-2">
                Limite: {device.speedLimit} km/h
              </p>
            )}
          </CardContent>
        </Card>

        {/* Distância */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Navigation className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Distância Total</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{totalDistanceKm}</span>
              <span className="text-sm text-muted-foreground">km</span>
            </div>
          </CardContent>
        </Card>

        {/* Sensores */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Sensores</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${isMotion ? "text-blue-500" : "text-muted-foreground"}`} />
                <span className="text-sm">{isMotion ? "Movendo" : "Parado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${isIgnitionOn ? "text-yellow-500" : "text-muted-foreground"}`} />
                <span className="text-sm">{isIgnitionOn ? "Ligada" : "Desligada"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Battery className={`w-4 h-4 ${batteryColor}`} />
                <span className="text-sm">{batteryLevel}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{satCount} sat</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="md:col-span-2 lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Localização</span>
                {isLoadingAddress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(address)} title="Copiar">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                {position && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(`https://www.google.com/maps?q=${position.latitude},${position.longitude}`, "_blank")}
                    title="Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              {isLoadingAddress ? "Buscando endereço..." : address}
            </p>
            {position && (
              <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)} | Alt: {position.altitude.toFixed(0)}m | Precisão: {position.accuracy.toFixed(0)}m
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Informações do Veículo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Informações do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow icon={Car} label="Categoria" value={device.category} />
            {device.model && <InfoRow icon={Car} label="Modelo" value={device.model} />}
            {device.year && <InfoRow icon={Calendar} label="Ano" value={String(device.year)} />}
            {device.color && <InfoRow icon={Palette} label="Cor" value={device.color} />}
            <InfoRow icon={Hash} label="IMEI" value={device.uniqueId} copyable onCopy={handleCopy} />
            {device.plate && <InfoRow icon={FileText} label="Placa" value={device.plate} />}
            {device.phone && <InfoRow icon={Smartphone} label="Chip (SIM)" value={device.phone} />}
            {device.contact && <InfoRow icon={User} label="Contato" value={device.contact} />}
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/replay?deviceId=${device.id}`)}
            >
              <History className="w-4 h-4 mr-1" />
              Replay
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/video?deviceId=${device.id}`)}
            >
              <Video className="w-4 h-4 mr-1" />
              Vídeo
            </Button>
            {position && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude},${position.longitude}`,
                    "_blank"
                  )
                }
              >
                <MapPin className="w-4 h-4 mr-1" />
                Street View
              </Button>
            )}
            {device.contact && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`tel:${device.contact}`, "_self")}
              >
                <Phone className="w-4 h-4 mr-1" />
                Ligar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable,
  onCopy,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: (text: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      {copyable && onCopy && (
        <button
          onClick={() => onCopy(value)}
          className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
          title="Copiar"
        >
          <Copy className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
