'use client';

import { useMemo } from 'react';
import { Device, Position } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRelativeTime } from '@/lib/hooks/useRelativeTime';
import {
  X,
  MapPin,
  Clock,
  Zap,
  Activity,
  Gauge,
  Navigation,
  Edit,
  History,
  Video,
  Navigation2,
  Phone,
  FileText,
  Loader2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Battery,
  Satellite,
  Radio,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { formatDate, getDeviceStatusColor, deriveDeviceStatus, getDeviceStatusLabel } from '@/lib/utils';
import { usePositionAddress } from '@/lib/hooks/usePositionAddress';
import { getVehicleIcon } from '@/lib/vehicle-icons';

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
  onSendCommand?: (device: Device) => void;
  recentDistanceKm?: number;
  recentTrail?: {lat:number; lng:number; ts:number}[];
}

function BatteryBar({ level }: { level: number }) {
  const color = level > 60 ? 'bg-green-500' : level > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(level, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{level}%</span>
    </div>
  );
}

function SensorPill({ icon: Icon, label, active, color }: { icon: React.ElementType; label: string; active: boolean; color?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
      <Icon className={`w-3.5 h-3.5 ${color || (active ? 'text-primary' : 'text-muted-foreground')}`} />
      {label}
    </div>
  );
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
  onSendCommand,
  recentDistanceKm,
  recentTrail,
}: VehicleDetailsPanelProps) {
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
    return contact || '';
  }, [device?.phone, device?.contact]);

  const canCall = useMemo(() => {
    const digits = contactPhone.replace(/\D/g, '');
    return digits.length >= 8;
  }, [contactPhone]);

  // Usa o mais recente entre device.lastUpdate e position.serverTime
  // + atualiza automaticamente a cada 30s para nunca mostrar tempo desatualizado
  const lastCommunication = useRelativeTime(device?.lastUpdate, position?.serverTime);

  if (!device || !position) return null;

  const speedExceeded = device.speedLimit && position.speed > device.speedLimit;
  const isMotion = position.attributes?.motion;
  const isIgnitionOn = position.attributes?.ignition;
  const batteryLevel = position.attributes?.batteryLevel ?? 0;
  const satCount = position.attributes?.sat ?? 0;
  const effectiveStatus = deriveDeviceStatus(device.status, position);
  const IconComponent = getVehicleIcon(device.category);
  const statusColor = effectiveStatus === 'moving' ? '#3b82f6' : effectiveStatus === 'online' || effectiveStatus === 'stopped' ? '#10b981' : '#6b7280';

  const handleCopyAddress = () => {
    const address = enrichedPosition?.address || `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
    navigator.clipboard.writeText(address);
  };

  const handleOpenMaps = () => {
    window.open(`https://www.google.com/maps?q=${position.latitude},${position.longitude}`, '_blank');
  };

  const totalDistanceKm = position.attributes?.totalDistance
    ? (position.attributes.totalDistance / 1000).toFixed(2)
    : position.attributes?.odometer
      ? (position.attributes.odometer / 1000).toFixed(2)
      : '0';

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[340px] z-[900] bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex-shrink-0 p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border" style={{ borderColor: `${statusColor}40`, background: `${statusColor}12` }}>
              <IconComponent className="w-5 h-5" style={{ color: statusColor }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate leading-tight">{device.name || device.plate}</h2>
              {device.plate && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{device.plate}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors flex-shrink-0 -mt-0.5 -mr-1"
            aria-label="Fechar detalhes"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getDeviceStatusColor(effectiveStatus)}>
            {getDeviceStatusLabel(effectiveStatus)}
          </Badge>
          {lastCommunication && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Radio className="w-3 h-3" />
              {lastCommunication}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Velocidade + Odômetro inline */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-3 border ${speedExceeded ? 'border-destructive/40 bg-destructive/5' : 'border-border/50 bg-card/60'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className={`w-3.5 h-3.5 ${speedExceeded ? 'text-destructive' : 'text-primary'}`} />
              <span className="text-[11px] text-muted-foreground font-medium">Velocidade</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold tabular-nums leading-none ${speedExceeded ? 'text-destructive' : ''}`}>
                {Math.round(position.speed)}
              </span>
              <span className="text-[10px] text-muted-foreground">km/h</span>
            </div>
            {device.speedLimit && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Limite: {device.speedLimit} km/h
                {speedExceeded && <span className="text-destructive font-medium ml-1">!</span>}
              </p>
            )}
          </div>
          <div className="rounded-xl p-3 border border-border/50 bg-card/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground font-medium">Odômetro</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums leading-none">{totalDistanceKm}</span>
              <span className="text-[10px] text-muted-foreground">km</span>
            </div>
          </div>
        </div>

        {/* Sensores em pills */}
        <div className="flex flex-wrap gap-1.5">
          <SensorPill icon={Activity} label={isMotion ? 'Movendo' : 'Parado'} active={!!isMotion} />
          <SensorPill icon={Zap} label={isIgnitionOn ? 'Ligada' : 'Desligada'} active={!!isIgnitionOn} color={isIgnitionOn ? 'text-yellow-500' : undefined} />
          <SensorPill icon={Satellite} label={`${satCount} sat`} active={satCount > 3} />
        </div>

        {/* Bateria */}
        <div className="rounded-xl p-3 border border-border/50 bg-card/60">
          <div className="flex items-center gap-1.5 mb-2">
            <Battery className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">Bateria</span>
          </div>
          <BatteryBar level={batteryLevel} />
        </div>

        {/* Localização */}
        <div className="rounded-xl p-3 border border-border/50 bg-card/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground font-medium">Localização</span>
              {isLoadingAddress && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex gap-0.5">
              <button onClick={handleCopyAddress} className="p-1 hover:bg-muted rounded-md transition-colors" title="Copiar endereço">
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              <button onClick={handleOpenMaps} className="p-1 hover:bg-muted rounded-md transition-colors" title="Abrir no Google Maps">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed">
            {isLoadingAddress ? 'Buscando endereço...' : enrichedPosition?.address || 'Localização não disponível'}
          </p>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</span>
          </div>
        </div>

        {/* GPS Time */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">GPS:</span>
          <span className="text-[11px] font-mono font-medium">{formatDate(position.fixTime)}</span>
        </div>

        {/* Últimos 5 min */}
        {recentPoints >= 2 && (
          <div className="rounded-xl p-3 border border-border/50 bg-card/60">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] text-muted-foreground font-medium">Últimos 5 min</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{recentPoints} pts</span>
            </div>
            <span className="text-lg font-bold tabular-nums">{recentDistanceText}</span>
          </div>
        )}

        {/* Info do veículo (compacto) */}
        {(device.model || device.year || device.color) && (
          <div className="rounded-xl p-3 border border-border/50 bg-card/60">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">Veículo</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {device.model && (
                <div><span className="text-muted-foreground">Modelo:</span> <span className="font-medium">{device.model}</span></div>
              )}
              {device.year && (
                <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium">{device.year}</span></div>
              )}
              {device.color && (
                <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium">{device.color}</span></div>
              )}
            </div>
          </div>
        )}

        {/* Mais Detalhes - Link principal */}
        <button
          onClick={() => onDetails(device.id)}
          className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Mais Detalhes</span>
          </div>
          <ChevronRight className="w-4 h-4 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Ações em grid */}
        <div className="grid grid-cols-4 gap-1.5">
          <ActionButton icon={History} label="Replay" onClick={() => onReplay(device.id)} color="text-purple-400" />
          <ActionButton icon={Video} label="Vídeo" onClick={() => onVideo(device.id)} color="text-green-400" />
          <ActionButton icon={Navigation2} label="Street" onClick={() => onStreetView?.(position.latitude, position.longitude)} color="text-cyan-400" />
          <ActionButton icon={Edit} label="Editar" onClick={() => onEdit(device)} color="text-yellow-400" />
        </div>

        {/* Ações secundárias */}
        <div className="flex gap-1.5">
          {onManageGeofences && (
            <Button
              onClick={() => onManageGeofences(device)}
              variant="ghost"
              size="sm"
              className="flex-1 h-9 text-xs text-orange-400 hover:bg-orange-500/10"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Cercas
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-xs text-cyan-400 hover:bg-cyan-500/10"
            onClick={() => onSendCommand?.(device)}
          >
            <Terminal className="w-3.5 h-3.5 mr-1" />
            Comandos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-xs hover:bg-muted"
            disabled={!canCall}
            onClick={() => {
              if (!canCall) return;
              window.open(`tel:${contactPhone}`, '_self');
            }}
            title={canCall ? `Ligar para ${contactPhone}` : 'Sem telefone cadastrado'}
          >
            <Phone className="w-3.5 h-3.5 mr-1" />
            Contato
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, color }: { icon: React.ElementType; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-border/50 bg-card/60 hover:bg-muted/80 transition-colors"
    >
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </button>
  );
}
