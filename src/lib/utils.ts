import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Converte velocidade de knots (Traccar) para km/h */
export function knotsToKmh(knots: number): number {
  return knots * 1.852;
}

export function formatSpeed(speed: number): string {
  return `${Math.round(speed)} km/h`;
}

export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

export function getDeviceStatusColor(status: string): string {
  switch (status) {
    case 'online':
    case 'moving':
      return 'text-green-600 bg-green-50 dark:bg-green-950/20';
    case 'stopped':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20';
    case 'offline':
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
    case 'blocked':
      return 'text-red-600 bg-red-50 dark:bg-red-950/20';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
  }
}

/**
 * Deriva o status efetivo de um veículo combinando device.status + dados da posição.
 * O Traccar frequentemente retorna status='unknown' — nesse caso usamos a posição
 * para inferir se está em movimento, parado, online ou offline.
 */
export function deriveDeviceStatus(
  deviceStatus: string,
  position?: { fixTime?: string; deviceTime?: string; speed?: number; attributes?: { motion?: boolean; ignition?: boolean; blocked?: boolean } } | null
): string {
  // Status definitivos do Traccar têm prioridade
  if (deviceStatus === 'blocked') return 'blocked';
  if (deviceStatus === 'online' || deviceStatus === 'moving' || deviceStatus === 'stopped' || deviceStatus === 'offline') {
    // Mesmo com status definitivo, refina com dados da posição se disponível
    if (position) {
      if (position.attributes?.blocked) return 'blocked';
      if (position.attributes?.motion === true || (position.speed ?? 0) > 2) return 'moving';
      if (deviceStatus === 'online' || deviceStatus === 'moving' || deviceStatus === 'stopped') {
        return position.attributes?.ignition ? 'stopped' : 'online';
      }
    }
    return deviceStatus;
  }
  // Status 'unknown' ou ausente: inferir da posição
  if (!position) return 'offline';
  const ts = position.fixTime || position.deviceTime;
  const ageMin = ts ? (Date.now() - new Date(ts).getTime()) / 60_000 : Infinity;
  if (ageMin > 15) return 'offline';
  if (position.attributes?.blocked) return 'blocked';
  if (position.attributes?.motion === true || (position.speed ?? 0) > 2) return 'moving';
  if (position.attributes?.ignition) return 'stopped';
  return 'online';
}

export function getDeviceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    moving: 'Em movimento',
    stopped: 'Parado',
    blocked: 'Bloqueado'
  };
  return labels[status] || status;
}

export function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    // Conexão / Status
    commandResult: 'Resultado de comando',
    textMessage: 'Mensagem de texto',
    deviceOnline: 'Dispositivo online',
    deviceUnknown: 'Status desconhecido',
    deviceOffline: 'Dispositivo offline',
    deviceInactive: 'Dispositivo inativo',
    // Movimento
    deviceMoving: 'Em movimento',
    deviceStopped: 'Parado',
    deviceOverspeed: 'Excesso de velocidade',
    speedLimit: 'Excesso de velocidade',
    // Combustível
    fuelDrop: 'Queda de combustível',
    fuelIncrease: 'Abastecimento',
    // Ignição
    ignitionOn: 'Ignição ligada',
    ignitionOff: 'Ignição desligada',
    // Cercas
    geofence: 'Cerca eletrônica',
    geofenceEnter: 'Entrada em cerca',
    geofenceExit: 'Saída de cerca',
    // Alarmes
    alarm: 'Alarme',
    // Bateria
    lowBattery: 'Bateria fraca',
    // Conexão legado
    connectionLost: 'Conexão perdida',
    connectionRestored: 'Conexão restabelecida',
    // Bloqueio
    deviceBlocked: 'Veículo bloqueado',
    deviceUnblocked: 'Veículo desbloqueado',
    // Manutenção
    maintenance: 'Manutenção necessária',
    // Motorista
    driverChanged: 'Motorista alterado',
    // Mídia
    media: 'Mídia recebida',
  };
  return labels[type] || type;
}

export function getEventTypeColor(type: string): string {
  switch (type) {
    // Positivos (verde)
    case 'ignitionOn':
    case 'connectionRestored':
    case 'deviceUnblocked':
    case 'deviceOnline':
    case 'fuelIncrease':
      return 'text-green-600 bg-green-50 dark:bg-green-950/30';
    // Avisos (amarelo/amber)
    case 'speedLimit':
    case 'deviceOverspeed':
    case 'geofence':
    case 'geofenceEnter':
    case 'geofenceExit':
    case 'lowBattery':
    case 'maintenance':
    case 'deviceUnknown':
    case 'deviceInactive':
    case 'driverChanged':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/30';
    // Críticos (vermelho)
    case 'ignitionOff':
    case 'connectionLost':
    case 'deviceBlocked':
    case 'deviceOffline':
    case 'alarm':
    case 'fuelDrop':
      return 'text-red-600 bg-red-50 dark:bg-red-950/30';
    // Informativos (azul)
    case 'deviceMoving':
    case 'deviceStopped':
    case 'commandResult':
    case 'textMessage':
    case 'media':
    default:
      return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30';
  }
}

/**
 * Calcula a distância entre duas coordenadas usando a fórmula de Haversine.
 * Retorna distância em quilômetros.
 */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula o bearing (direção) em graus entre duas coordenadas.
 * Retorna valor em graus [0,360).
 */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = (toDeg(θ) + 360) % 360;
  return bearing;
}
