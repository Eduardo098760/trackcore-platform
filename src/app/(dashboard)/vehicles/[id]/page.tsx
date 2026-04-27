"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDevice } from "@/lib/api/devices";
import { getPositionByDevice, getEvents } from "@/lib/api";
import { usePositionAddress } from "@/lib/hooks/usePositionAddress";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import {
  getDeviceStatusColor,
  getDeviceStatusLabel,
  deriveDeviceStatus,
  formatDate,
  getEventTypeLabel,
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
  Server,
  Terminal,
  ChevronDown,
  ChevronUp,
  Shield,
  Compass,
  Signal,
  Bell,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Command } from "@/types";
import { usePermissions } from "@/lib/hooks/usePermissions";

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermissions();
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

  // Command history from localStorage
  const [commandHistory, setCommandHistory] = useState<Command[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("commandHistory");
      if (stored) {
        const all: Command[] = JSON.parse(stored);
        setCommandHistory(all.filter((c) => c.deviceId === deviceId).slice(0, 10));
      }
    } catch {}
  }, [deviceId]);

  // Recent events for this device
  const { data: recentEvents = [] } = useQuery({
    queryKey: ["device-events", deviceId],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return getEvents({ deviceId, from: from.toISOString(), to: now.toISOString() });
    },
    enabled: !!deviceId,
  });

  // Expanded sections state
  const [showRawAttrs, setShowRawAttrs] = useState(false);

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
            {can("commands") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/commands?deviceId=${device.id}`)}
              >
                <Terminal className="w-4 h-4 mr-1" />
                Enviar Comando
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/events?deviceId=${device.id}`)}
            >
              <Bell className="w-4 h-4 mr-1" />
              Ver Eventos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Servidor / Protocolo */}
      {position && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4" />
              Dados do Servidor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoRow icon={Shield} label="Protocolo" value={position.protocol || "—"} />
              <InfoRow icon={Clock} label="Hora do Servidor" value={formatDate(position.serverTime)} />
              <InfoRow icon={Clock} label="Hora do Dispositivo" value={formatDate(position.deviceTime)} />
              <InfoRow icon={Clock} label="Hora do GPS (Fix)" value={formatDate(position.fixTime)} />
              <InfoRow icon={Compass} label="Curso" value={`${position.course.toFixed(1)}°`} />
              <InfoRow icon={Signal} label="Precisão GPS" value={`${position.accuracy.toFixed(0)} m`} />
              <InfoRow icon={Navigation} label="Altitude" value={`${position.altitude.toFixed(0)} m`} />
              <InfoRow
                icon={CheckCircle}
                label="GPS Válido"
                value={position.valid ? "Sim" : "Não"}
              />
              <InfoRow
                icon={Wifi}
                label="Desatualizado"
                value={position.outdated ? "Sim" : "Não"}
              />
              {position.network && (
                <>
                  <InfoRow icon={Radio} label="Tipo de Rede" value={position.network.radioType || "—"} />
                  <InfoRow icon={Radio} label="Cell ID" value={String(position.network.cellId ?? "—")} />
                  <InfoRow icon={Radio} label="LAC" value={String(position.network.locationAreaCode ?? "—")} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atributos da Posição (dados brutos do rastreador) */}
      {position && (
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setShowRawAttrs(!showRawAttrs)}
            >
              <CardTitle className="text-sm flex items-center gap-2 flex-1">
                <Activity className="w-4 h-4" />
                Atributos do Rastreador
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {Object.keys(position.attributes).length} campos
                </Badge>
              </CardTitle>
              {showRawAttrs ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {showRawAttrs && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(position.attributes)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground font-mono">{key}</p>
                        <p className="text-sm font-medium truncate">
                          {value === true
                            ? "✓ Sim"
                            : value === false
                              ? "✗ Não"
                              : typeof value === "number"
                                ? String(Math.round(value * 100) / 100)
                                : String(value ?? "—")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Eventos Recentes */}
      {recentEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Eventos Recentes (7 dias)
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {recentEvents.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentEvents.slice(0, 20).map((evt) => (
                <div
                  key={evt.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                    evt.resolved
                      ? "bg-muted/30 border-border/50 opacity-70"
                      : "bg-card border-border"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    evt.resolved ? "bg-green-500" : "bg-amber-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getEventTypeLabel(evt.type)}
                      {evt.type === "alarm" && evt.attributes?.alarm && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({evt.attributes.alarm})
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(evt.serverTime)}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] shrink-0 ${
                      evt.resolved
                        ? "bg-green-500/10 text-green-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {evt.resolved ? "Resolvido" : "Ativo"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Comandos Enviados */}
      {commandHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Comandos Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {commandHistory.map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                >
                  <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cmd.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(cmd.sentTime)}
                    </p>
                    {cmd.providerResponse && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {cmd.providerResponse.situacao} · {cmd.providerResponse.codigo || "-"} · {cmd.providerResponse.id || "-"} · {cmd.providerResponse.descricao || "-"}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] shrink-0 ${
                      cmd.status === "sent" || cmd.status === "delivered"
                        ? "bg-green-500/10 text-green-600"
                        : cmd.status === "failed"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-yellow-500/10 text-yellow-600"
                    }`}
                  >
                    {cmd.status === "sent"
                      ? "Enviado"
                      : cmd.status === "delivered"
                        ? "Entregue"
                        : cmd.status === "failed"
                          ? "Falhou"
                          : "Pendente"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
