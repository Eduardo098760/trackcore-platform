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
} from 'lucide-react';
import { formatDate, getDeviceStatusColor } from '@/lib/utils';

interface VehicleDetailsPanelProps {
  device: Device | null;
  position: Position | null;
  onClose: () => void;
  onEdit: (device: Device) => void;
  onReplay: (deviceId: number) => void;
  onVideo: (deviceId: number) => void;
  onDetails: (deviceId: number) => void;
  onStreetView?: (lat: number, lng: number) => void;
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
  recentDistanceKm,
  recentTrail,
}: VehicleDetailsPanelProps) {
  if (!device || !position) return null;

  const recentDistanceText = useMemo(() => {
    const d = recentDistanceKm ?? 0;
    if (d < 1) return `${Math.round(d * 1000)} m`;
    return `${d.toFixed(3)} km`;
  }, [recentDistanceKm]);

  const recentPoints = recentTrail?.length ?? 0;

  const contactPhone = useMemo(() => {
    const phone = (device.phone || '').trim();
    if (phone) return phone;
    const contact = (device.contact || '').trim();
    // Se o contato for um telefone, mantém; se for nome/email, ainda mostramos como "Contato" sem ação
    return contact || '';
  }, [device.phone, device.contact]);

  const canCall = useMemo(() => {
    // Heurística simples: tenta ligar apenas se tiver dígitos suficientes
    const digits = contactPhone.replace(/\D/g, '');
    return digits.length >= 8;
  }, [contactPhone]);

  const speedExceeded = device.speedLimit && position.speed > device.speedLimit;
  const isMotion = position.attributes?.motion;
  const isIgnitionOn = position.attributes?.ignition;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-[900] bg-gradient-to-b from-gray-900 to-gray-950 border-l border-white/10 shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 p-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white truncate">{device.name || device.plate}</h2>
            <Badge className={getDeviceStatusColor(device.status)}>
              {device.status}
            </Badge>
          </div>
          {device.plate && (
            <p className="text-sm text-gray-400">{device.plate}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-0">
        {/* Hora e Localização */}
        <div className="space-y-3">
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Hora GPS</span>
            </div>
            <p className="text-sm text-white font-mono">
              {formatDate(position.fixTime)}
            </p>
          </div>

          <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-green-300">Endereço</span>
            </div>
            <p className="text-sm text-white">
              {position.address || 'Localização não disponível'}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </p>
          </div>
        </div>

        {/* Velocidade Destacada */}
        <div
          className={`rounded-lg p-4 border ${
            speedExceeded
              ? 'bg-red-600/10 border-red-500/30'
              : 'bg-purple-600/10 border-purple-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className={`w-5 h-5 ${speedExceeded ? 'text-red-400' : 'text-purple-400'}`} />
              <span className={`font-semibold ${speedExceeded ? 'text-red-300' : 'text-purple-300'}`}>
                Velocidade
              </span>
            </div>
            {speedExceeded && (
              <Badge className="bg-red-600 hover:bg-red-700">EXCEDIDO</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <p className={`text-2xl font-semibold ${speedExceeded ? 'text-red-400' : 'text-purple-400'}`}>
              {Math.round(position.speed)}
            </p>
            <span className="text-sm text-gray-300">km/h</span>
            {speedExceeded && (
              <Badge className="bg-red-600 hover:bg-red-700 text-xs px-2 py-0.5 ml-auto">EXCEDIDO</Badge>
            )}
          </div>
          {device.speedLimit && (
            <p className="text-xs text-gray-400 mt-1">
              Limite: {device.speedLimit} km/h
            </p>
          )}
        </div>

        {/* Distância Total */}
        <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-300">Distância Total</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-indigo-600/20"
              title="Reset do hodômetro"
            >
              <Settings className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xl font-bold text-indigo-400">
            {position.attributes?.totalDistance
              ? `${(position.attributes.totalDistance / 1000).toFixed(2)} km`
              : position.attributes?.odometer
                ? `${(position.attributes.odometer / 1000).toFixed(2)} km`
                : '0 km'}
          </p>
        </div>

        {/* Últimos 5 minutos */}
        <div className="bg-slate-600/10 border border-slate-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-300" />
              <span className="text-sm font-semibold text-slate-200">Últimos 5 min</span>
            </div>
            <span className="text-xs text-slate-300 font-mono">{recentPoints} pts</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-300">Distância</span>
            <span className="text-lg font-bold text-slate-100 font-mono">{recentDistanceText}</span>
          </div>
          {recentPoints < 2 && (
            <p className="text-[11px] text-gray-400 mt-1">Sem dados suficientes para trilha recente.</p>
          )}
        </div>



        {/* Info Técnicas - Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Movimento */}
          <div
            className={`rounded-lg p-3 border ${
              isMotion ? 'bg-blue-600/10 border-blue-500/30' : 'bg-gray-600/10 border-gray-500/30'
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Navigation2 className={`w-4 h-4 ${isMotion ? 'text-blue-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-300">Movimento</span>
            </div>
            <p className={`text-sm font-bold ${isMotion ? 'text-blue-400' : 'text-gray-400'}`}>
              {isMotion ? 'MOVENDO' : 'PARADO'}
            </p>
          </div>

          {/* Ignição */}
          <div
            className={`rounded-lg p-3 border ${
              isIgnitionOn ? 'bg-green-600/10 border-green-500/30' : 'bg-gray-600/10 border-gray-500/30'
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Zap className={`w-4 h-4 ${isIgnitionOn ? 'text-green-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-300">Ignição</span>
            </div>
            <p className={`text-sm font-bold ${isIgnitionOn ? 'text-green-400' : 'text-gray-400'}`}>
              {isIgnitionOn ? 'LIGADA' : 'DESLIGADA'}
            </p>
          </div>

          {/* Bateria */}
          <div className="rounded-lg p-3 border bg-yellow-600/10 border-yellow-500/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-lg">🔋</span>
              <span className="text-xs text-gray-300">Bateria</span>
            </div>
            <p className="text-sm font-bold text-yellow-400">
              {position.attributes?.batteryLevel || 0}%
            </p>
          </div>

          {/* GPS Satélites */}
          <div className="rounded-lg p-3 border bg-cyan-600/10 border-cyan-500/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-lg">🛰️</span>
              <span className="text-xs text-gray-300">GPS</span>
            </div>
            <p className="text-sm font-bold text-cyan-400">
              {position.attributes?.sat || 0} satélites
            </p>
          </div>
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
        <div className="border-t border-white/10"></div>

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
