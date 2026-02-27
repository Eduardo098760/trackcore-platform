'use client';

import { useMemo } from 'react';
import { Device, Position } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  MapPin,
  Clock,
  Zap,
  Activity,
  Gauge,
  Navigation,
  Edit,
  Lock,
  Ban,
  History,
  Video,
  Navigation2,
  Phone,
  FileText,
  Settings,
  Loader2,
  Copy,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { formatDate, getDeviceStatusColor, deriveDeviceStatus, getDeviceStatusLabel } from '@/lib/utils';
import { usePositionAddress } from '@/lib/hooks/usePositionAddress';

interface VehicleDetailsPanelProps {
  device: Device | null;
  position: Position | null;
  onClose: () => void;
  onEdit: (device: Device) => void;
  onReplay: (deviceId: number) => void;
  onVideo: (deviceId: number) => void;
  onDetails: (deviceId: number) => void;
  onStreetView?: (lat: number, lng: number) => void;
  onManageGeofences?: (device: Device) => void;
  recentDistanceKm?: number;
  recentTrail?: {lat:number; lng:number; ts:number}[];
}

export function VehicleDetailsPanel({
  device,
  position,
  onClose,
  onEdit,
  onReplay,
  onVideo,
  onDetails,
  onStreetView,
  onManageGeofences,
  recentDistanceKm,
  recentTrail,
}: VehicleDetailsPanelProps) {
  // Enriquecer posição com endereço via reverse geocoding
  const { enrichedPosition, isLoadingAddress } = usePositionAddress(position);
  
  const recentDistanceText = useMemo(() => {
    const d = recentDistanceKm ?? 0;
    if (d < 1) return `${Math.round(d * 1000)} m`;
    return `${d.toFixed(3)} km`;
  }, [recentDistanceKm]);

  const recentPoints = recentTrail?.length ?? 0;

  const contactPhone = useMemo(() => {
    const phone = (device?.phone || '').trim();
    if (phone) return phone;
    const contact = (device?.contact || '').trim();
    // Se o contato for um telefone, mantém; se for nome/email, ainda mostramos como "Contato" sem ação
    return contact || '';
  }, [device?.phone, device?.contact]);

  const canCall = useMemo(() => {
    // Heurística simples: tenta ligar apenas se tiver dígitos suficientes
    const digits = contactPhone.replace(/\D/g, '');
    return digits.length >= 8;
  }, [contactPhone]);

  if (!device || !position) return null;

  const speedExceeded = device.speedLimit && position.speed > device.speedLimit;
  const isMotion = position.attributes?.motion;
  const isIgnitionOn = position.attributes?.ignition;

  const handleCopyAddress = () => {
    const address = enrichedPosition?.address || `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
    navigator.clipboard.writeText(address);
  };

  const handleOpenMaps = () => {
    window.open(`https://www.google.com/maps?q=${position.latitude},${position.longitude}`, '_blank');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-[900] bg-background/95 backdrop-blur-md border-l border-border shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold truncate">{device.name || device.plate}</h2>
            {(() => {
              const effectiveStatus = deriveDeviceStatus(device.status, position);
              return (
                <Badge className={getDeviceStatusColor(effectiveStatus)}>
                  {getDeviceStatusLabel(effectiveStatus)}
                </Badge>
              );
            })()}
          </div>
          {device.plate && (
            <p className="text-sm text-muted-foreground">{device.plate}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
          aria-label="Fechar detalhes"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Hora e Localização */}
        <div className="grid gap-3">
          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Hora GPS</span>
            </div>
            <p className="text-sm font-mono">
              {formatDate(position.fixTime)}
            </p>
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Endereço</span>
                {isLoadingAddress && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Copiar endereço"
                >
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  onClick={handleOpenMaps}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Abrir no Google Maps"
                >
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              {isLoadingAddress 
                ? 'Buscando endereço...' 
                : enrichedPosition?.address || 'Localização não disponível'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </p>
            </CardContent>
          </Card>
        </div>

        {/* Velocidade Destacada */}
        <Card className={speedExceeded ? 'border-destructive/40 bg-card/60' : 'bg-card/60'}>
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className={`w-5 h-5 ${speedExceeded ? 'text-destructive' : 'text-primary'}`} />
              <span className="font-medium">
                Velocidade
              </span>
            </div>
            {speedExceeded && (
              <Badge variant="destructive">EXCEDIDO</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <p className={`text-2xl font-semibold ${speedExceeded ? 'text-destructive' : ''}`}>
              {Math.round(position.speed)}
            </p>
            <span className="text-sm text-muted-foreground">km/h</span>
          </div>
          {device.speedLimit && (
            <p className="text-xs text-muted-foreground mt-1">
              Limite: {device.speedLimit} km/h
            </p>
          )}
          </CardContent>
        </Card>

        {/* Distância Total */}
        <Card className="bg-card/60">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Distância Total</span>
              </div>
            </div>
            <p className="text-xl font-semibold">
              {position.attributes?.totalDistance
                ? `${(position.attributes.totalDistance / 1000).toFixed(2)} km`
                : position.attributes?.odometer
                  ? `${(position.attributes.odometer / 1000).toFixed(2)} km`
                  : '0 km'}
            </p>
          </CardContent>
        </Card>

        {/* Últimos 5 minutos */}
        <Card className="bg-card/60">
          <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Últimos 5 min</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{recentPoints} pts</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Distância</span>
            <span className="text-lg font-semibold font-mono">{recentDistanceText}</span>
          </div>
          {recentPoints < 2 && (
            <p className="text-[11px] text-muted-foreground mt-1">Sem dados suficientes para trilha recente.</p>
          )}
          </CardContent>
        </Card>



        {/* Info Técnicas - Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Movimento */}
          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Navigation2 className={`w-4 h-4 ${isMotion ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Movimento</span>
            </div>
            <p className="text-sm font-semibold">
              {isMotion ? 'MOVENDO' : 'PARADO'}
            </p>
            </CardContent>
          </Card>

          {/* Ignição */}
          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <Zap className={`w-4 h-4 ${isIgnitionOn ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Ignição</span>
            </div>
            <p className="text-sm font-semibold">
              {isIgnitionOn ? 'LIGADA' : 'DESLIGADA'}
            </p>
            </CardContent>
          </Card>

          {/* Bateria */}
          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-lg">🔋</span>
              <span className="text-xs text-muted-foreground">Bateria</span>
            </div>
            <p className="text-sm font-semibold">
              {position.attributes?.batteryLevel || 0}%
            </p>
            </CardContent>
          </Card>

          {/* GPS Satélites */}
          <Card className="bg-card/60">
            <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-lg">🛰️</span>
              <span className="text-xs text-muted-foreground">GPS</span>
            </div>
            <p className="text-sm font-semibold">
              {position.attributes?.sat || 0} satélites
            </p>
            </CardContent>
          </Card>
        </div>

        {/* Informações do Veículo */}
        {(device.model || device.year || device.color) && (
          <Card className="bg-gray-800/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Informações do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {device.model && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Modelo:</span>
                  <span className="text-white font-medium">{device.model}</span>
                </div>
              )}
              {device.year && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Ano:</span>
                  <span className="text-white font-medium">{device.year}</span>
                </div>
              )}
              {device.color && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Cor:</span>
                  <span className="text-white font-medium">{device.color}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* Botões Principais */}
        <div className="space-y-2">
          <Button
            onClick={() => onDetails(device.id)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            Mais Detalhes
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onReplay(device.id)}
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-600/20"
            >
              <History className="w-4 h-4 mr-1" />
              Replay
            </Button>
            <Button
              onClick={() => onVideo(device.id)}
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-600/20"
            >
              <Video className="w-4 h-4 mr-1" />
              Vídeo
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onStreetView?.(position.latitude, position.longitude)}
              variant="outline"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20"
            >
              <Navigation2 className="w-4 h-4 mr-1" />
              Street View
            </Button>
            <Button
              onClick={() => onEdit(device)}
              variant="outline"
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/20"
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </div>

          {onManageGeofences && (
            <Button
              onClick={() => onManageGeofences(device)}
              variant="outline"
              className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-600/20"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Gerenciar Cercas
            </Button>
          )}
        </div>

        {/* Botões de Controle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-600/20"
          >
            <Ban className="w-4 h-4 mr-1" />
            Bloquear
          </Button>
          <Button
            variant="outline"
            className="border-green-500/30 text-green-400 hover:bg-green-600/20"
            disabled={!canCall}
            onClick={() => {
              if (!canCall) return;
              window.open(`tel:${contactPhone}`, '_self');
            }}
            title={canCall ? `Ligar para ${contactPhone}` : 'Sem telefone cadastrado'}
          >
            <Phone className="w-4 h-4 mr-1" />
            Contato
          </Button>
        </div>
      </div>
    </div>
  );
}
