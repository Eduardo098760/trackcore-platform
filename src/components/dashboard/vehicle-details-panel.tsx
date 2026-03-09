'use client';

import { useMemo, useState, useCallback } from 'react';
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
  Bell,
  BellOff,
  ChevronDown,
  AlertCircle,
  Info,
  CheckCircle2,
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
  onStreetView?: () => void;
  onManageGeofences?: (device: Device) => void;
  onSendCommand?: (device: Device) => void;
  recentDistanceKm?: number;
  recentTrail?: {lat:number; lng:number; ts:number}[];
  streetViewActive?: boolean;
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
  streetViewActive,
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
          {device.attributes?.blocked && (
            <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              Bloqueado
            </Badge>
          )}
          {lastCommunication && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-[11px] font-medium text-primary">
              <Radio className="w-3 h-3 animate-pulse" />
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

        {/* Horários */}
        <div className="rounded-xl p-3 border border-border/50 bg-card/60">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">Horários</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dispositivo:</span>
              <span className="font-mono font-medium">{formatDate(position.deviceTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Servidor:</span>
              <span className="font-mono font-medium">{formatDate(position.serverTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GPS:</span>
              <span className="font-mono font-medium">{formatDate(position.fixTime)}</span>
            </div>
          </div>
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
          <ActionButton icon={Navigation2} label="Street" onClick={() => onStreetView?.()} color="text-cyan-400" active={streetViewActive} />
          <ActionButton icon={Edit} label="Editar" onClick={() => onEdit(device)} color="text-yellow-400" />
        </div>

        {/* Alertas por veículo */}
        <VehicleNotificationQuick deviceId={device.id} />

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

function ActionButton({ icon: Icon, label, onClick, color, active }: { icon: React.ElementType; label: string; onClick: () => void; color: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
        active
          ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30'
          : 'border-border/50 bg-card/60 hover:bg-muted/80'
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : color}`} />
      <span className={`text-[10px] font-medium ${active ? 'text-cyan-400' : 'text-muted-foreground'}`}>{label}</span>
    </button>
  );
}

// ─── Catálogo de tipos de evento ─────────────────
const NOTIFICATION_EVENT_CATALOG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  speedLimit:    { label: 'Excesso de Velocidade', icon: Activity,      color: 'text-amber-500' },
  geofenceEnter: { label: 'Entrada em Cerca',     icon: ShieldCheck,   color: 'text-blue-500' },
  geofenceExit:  { label: 'Saída de Cerca',       icon: ShieldCheck,   color: 'text-orange-500' },
  ignitionOn:    { label: 'Ignição Ligada',        icon: Zap,           color: 'text-green-500' },
  ignitionOff:   { label: 'Ignição Desligada',     icon: Zap,           color: 'text-gray-400' },
  deviceOffline: { label: 'Ficou Offline',         icon: AlertCircle,   color: 'text-red-500' },
  deviceOnline:  { label: 'Ficou Online',          icon: CheckCircle2,  color: 'text-green-500' },
  deviceMoving:  { label: 'Começou a Mover',       icon: Activity,      color: 'text-blue-400' },
  deviceStopped: { label: 'Parou',                 icon: Info,          color: 'text-gray-400' },
};

interface VehicleNotifRule {
  id: string;
  eventType: string;
  sound: boolean;
  createdAt: string;
}

function loadVehicleNotifRules(deviceId: number): VehicleNotifRule[] {
  try {
    const stored = localStorage.getItem('vehicleNotifRulesV2');
    const all: Record<string, VehicleNotifRule[]> = stored ? JSON.parse(stored) : {};
    return all[deviceId] || [];
  } catch { return []; }
}

function saveVehicleNotifRules(deviceId: number, rules: VehicleNotifRule[]) {
  try {
    const stored = localStorage.getItem('vehicleNotifRulesV2');
    const all: Record<string, VehicleNotifRule[]> = stored ? JSON.parse(stored) : {};
    all[deviceId] = rules;
    localStorage.setItem('vehicleNotifRulesV2', JSON.stringify(all));
    // Sincronizar com formato legado para o hook de notificações
    syncVehicleLegacy(all);
  } catch {}
}

function syncVehicleLegacy(all: Record<string, VehicleNotifRule[]>) {
  try {
    const legacy: Record<string, Record<string, boolean>> = {};
    for (const [devId, rules] of Object.entries(all)) {
      const devRules: Record<string, boolean> = {};
      for (const r of rules) devRules[r.eventType] = true;
      legacy[devId] = devRules;
    }
    localStorage.setItem('vehicleNotificationRules', JSON.stringify(legacy));
  } catch {}
}

function VehicleNotificationQuick({ deviceId }: { deviceId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [rules, setRules] = useState<VehicleNotifRule[]>(() => loadVehicleNotifRules(deviceId));

  const handleCreate = useCallback(() => {
    if (!selectedType) return;
    const newRule: VehicleNotifRule = {
      id: `${deviceId}-${selectedType}-${Date.now()}`,
      eventType: selectedType,
      sound: soundEnabled,
      createdAt: new Date().toISOString(),
    };
    const updated = [...rules, newRule];
    setRules(updated);
    saveVehicleNotifRules(deviceId, updated);
    setSelectedType('');
    setSoundEnabled(true);
    setIsCreating(false);
  }, [deviceId, selectedType, soundEnabled, rules]);

  const handleDelete = useCallback((ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    setRules(updated);
    saveVehicleNotifRules(deviceId, updated);
  }, [deviceId, rules]);

  // Tipos já configurados
  const configuredTypes = new Set(rules.map(r => r.eventType));
  const availableTypes = Object.entries(NOTIFICATION_EVENT_CATALOG).filter(([key]) => !configuredTypes.has(key));

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {rules.length > 0 ? (
            <Bell className="w-3.5 h-3.5 text-primary" />
          ) : (
            <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-medium">
            Notificações
            {rules.length > 0 && (
              <span className="ml-1.5 text-primary">({rules.length})</span>
            )}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {/* Lista das notificações configuradas */}
          {rules.length > 0 ? (
            <div className="space-y-1">
              {rules.map(rule => {
                const cat = NOTIFICATION_EVENT_CATALOG[rule.eventType];
                if (!cat) return null;
                const Icon = cat.icon;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10 group"
                  >
                    <Icon className={`w-3 h-3 flex-shrink-0 ${cat.color}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium truncate block">{cat.label}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {rule.sound ? '🔊 Som ativo' : '🔇 Sem som'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remover"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-1">
              Nenhuma notificação configurada
            </p>
          )}

          {/* Formulário de criação */}
          {isCreating ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-2">
              <p className="text-[10px] font-semibold text-primary">Nova notificação</p>

              {/* Seletor de tipo */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Tipo de evento:</p>
                <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                  {availableTypes.length > 0 ? availableTypes.map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedType(key)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors ${
                          selectedType === key
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <Icon className={`w-3 h-3 ${cat.color}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  }) : (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      Todos os tipos já foram configurados
                    </p>
                  )}
                </div>
              </div>

              {/* Som */}
              {selectedType && (
                <button
                  type="button"
                  onClick={() => setSoundEnabled(v => !v)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] w-full transition-colors ${
                    soundEnabled ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {soundEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  <span>{soundEnabled ? 'Som ativado' : 'Som desativado'}</span>
                </button>
              )}

              {/* Ações */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setSelectedType(''); }}
                  className="flex-1 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!selectedType}
                  className="flex-1 py-1.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Criar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-primary/30 text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <Bell className="w-3 h-3" />
              Criar notificação
            </button>
          )}
        </div>
      )}
    </div>
  );
}
