import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvents, getDevices, getPositions } from '@/lib/api';
import { notificationManager } from '@/lib/notifications';
import { Device, Event, SpeedAlert } from '@/types';

/**
 * Hook que monitora eventos do Traccar e dispara notificações automaticamente
 */
export function useEventNotifications(enabled: boolean = true) {
  const processedEvents = useRef(new Set<number>());
  const lastCheckTime = useRef<Date>(new Date());

  // Buscar lista de dispositivos para resolver nome + placa
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => getDevices(),
    enabled,
    staleTime: 60000, // Revalidar a cada 1 min
  });

  // Buscar eventos recentes a cada 5 segundos
  const { data: events = [] } = useQuery({
    queryKey: ['events', 'recent'],
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 5 * 60 * 1000); // Últimos 5 minutos
      
      try {
        const events = await getEvents({
          from: from.toISOString(),
          to: now.toISOString(),
        });
        return events || [];
      } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        return [];
      }
    },
    enabled,
    refetchInterval: 30_000, // Verificar a cada 30 segundos
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Filtrar apenas eventos novos (não processados)
    const newEvents = events.filter(event => {
      // Verificar se já foi processado
      if (processedEvents.current.has(event.id)) return false;
      
      // Verificar se é realmente novo (depois do último check)
      const eventTime = new Date(event.serverTime);
      if (eventTime < lastCheckTime.current) return false;
      
      return true;
    });

    if (newEvents.length === 0) return;

    console.log(`📊 ${newEvents.length} novo(s) evento(s) detectado(s)`);

    // Processar eventos um por vez com pequeno delay para evitar empilhamento
    newEvents.forEach((event, index) => {
      setTimeout(async () => {
        await processEvent(event, devices);
        processedEvents.current.add(event.id);
      }, index * 500); // 500ms entre cada notificação
    });

    // Atualizar tempo do último check
    lastCheckTime.current = new Date();

    // Limpar eventos processados antigos (manter apenas últimos 200)
    if (processedEvents.current.size > 200) {
      const eventsArray = Array.from(processedEvents.current);
      processedEvents.current = new Set(eventsArray.slice(-200));
    }
  }, [events, devices]);

  return { events };
}

/**
 * Processa um evento e cria notificação apropriada
 */
async function processEvent(event: Event, devices: Device[] = []) {
  console.log('📢 Processando evento:', event);

  // Resolver nome e placa a partir da lista de devices
  const matchedDevice = devices.find((d) => d.id === event.deviceId);
  const vehicleName = matchedDevice?.name || event.attributes?.deviceName || undefined;
  const deviceName = matchedDevice?.plate || matchedDevice?.uniqueId || event.attributes?.deviceName || `Veículo #${event.deviceId}`;
  const displayName = vehicleName || deviceName;

  let latitude: number | undefined;
  let longitude: number | undefined;
  let speedAlertId: string | undefined;

  // ──────────────────────────────────────────────────────────────────────────
  // EXCESSO DE VELOCIDADE: sempre salvar marcador no mapa, independente de
  // configurações de notificação, para o mapa exibir o ⚡ corretamente.
  // ──────────────────────────────────────────────────────────────────────────
  if (event.type === 'deviceOverspeed' || event.type === 'speedLimit') {
    try {
      const positions = await getPositions({ deviceId: event.deviceId });
      const position = positions?.[0];
      if (position) {
        latitude = position.latitude;
        longitude = position.longitude;

        const speed = Math.round(event.attributes?.speed || position.speed || 0);
        // Prioriza o limite configurado pelo usuário (já em km/h).
        // event.attributes.speedLimit vem do Traccar em KNOTS → converte * 1.852 apenas como fallback.
        const rawEventLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const speedLimit = matchedDevice?.speedLimit ||
          (rawEventLimit > 0 ? Math.round(rawEventLimit * 1.852) : 0);

        const alert: SpeedAlert = {
          id: `${Date.now()}-${event.id}`,
          deviceId: event.deviceId,
          deviceName,
          vehicleName,
          speed,
          speedLimit,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: event.serverTime,
        };
        speedAlertId = alert.id;

        try {
          const stored = localStorage.getItem('speedAlerts');
          const alerts: SpeedAlert[] = stored ? JSON.parse(stored) : [];
          alerts.unshift(alert);
          localStorage.setItem('speedAlerts', JSON.stringify(alerts.slice(0, 100)));
          window.dispatchEvent(new CustomEvent('speedAlertAdded', { detail: alert }));
          console.log('⚡ SpeedAlert registrado:', alert);
        } catch (storageErr) {
          console.error('[SpeedAlert] Erro ao salvar no localStorage:', storageErr);
        }
      }
    } catch (e) {
      console.error('[SpeedAlert] Erro ao buscar posição:', e);
    }
  }

  // ── Notificação in-app: respeita o filtro de "Tipos de Eventos" ──
  const eventTypeMap: Record<string, string> = {
    'ignitionOn': 'ignitionOn',
    'ignitionOff': 'ignitionOff',
    'deviceOnline': 'deviceOnline',
    'deviceOffline': 'deviceOffline',
    'geofenceEnter': 'geofenceEnter',
    'geofenceExit': 'geofenceExit',
    'alarm': 'sos',
    'deviceOverspeed': 'speedLimit',
    'speedLimit': 'speedLimit',
    'maintenance': 'maintenance',
    'deviceMoving': 'deviceMoving',
    'deviceStopped': 'deviceStopped',
    'commandResult': 'commandResult',
    'textMessage': 'textMessage',
    'lowBattery': 'lowBattery',
    'driverChanged': 'driverChanged',
    'media': 'media',
    'deviceBlocked': 'deviceBlocked',
    'deviceUnblocked': 'deviceUnblocked',
    'fuelDrop': 'fuelDrop',
    'fuelIncrease': 'fuelIncrease',
  };

  const internalType = eventTypeMap[event.type] || event.type;

  // Valores padrão para todos os tipos de evento
  const DEFAULT_EVENTS: Record<string, boolean> = {
    speedLimit: true,
    geofenceEnter: true,
    geofenceExit: true,
    ignitionOn: false,
    ignitionOff: false,
    deviceOffline: true,
    deviceOnline: false,
    deviceMoving: false,
    deviceStopped: false,
    lowBattery: true,
    maintenance: true,
    sos: true,
    commandResult: true,
    textMessage: true,
    driverChanged: false,
    fuelDrop: true,
    fuelIncrease: false,
    deviceBlocked: true,
    deviceUnblocked: true,
    media: false,
  };

  // Verificar se o tipo de evento está habilitado nas configurações do usuário.
  // Mescla defaults com o que está salvo → tipos novos nunca "escapam" por falta de chave.
  try {
    const settingsStr = localStorage.getItem('notificationSettings');
    const saved = settingsStr ? JSON.parse(settingsStr) : {};
    const eventsConfig: Record<string, boolean> = { ...DEFAULT_EVENTS, ...(saved.events || {}) };

    // 1) Verificar regras POR VEÍCULO (vehicleNotifRulesV2 do painel de detalhes)
    const vehicleRulesStr = localStorage.getItem('vehicleNotifRulesV2');
    const vehicleRulesAll: Record<string, Array<{ eventType: string }>> = vehicleRulesStr
      ? JSON.parse(vehicleRulesStr) : {};
    const deviceRules = vehicleRulesAll[String(event.deviceId)];

    if (deviceRules && deviceRules.length > 0) {
      // Dispositivo tem regras específicas — só disparar se o tipo consta nelas
      const hasRule = deviceRules.some(r => r.eventType === internalType);
      if (!hasRule) {
        console.debug(`[Notificações] Veículo #${event.deviceId}: tipo "${internalType}" não está nas regras do veículo — ignorado`);
        return;
      }
      // Tipo está permitido nas regras do veículo → prosseguir com notificação
    } else {
      // 2) Sem regras por veículo — usar configuração global
      const isEnabled = eventsConfig[internalType] ?? false;
      if (!isEnabled) {
        console.debug(`[Notificações] Tipo "${internalType}" desabilitado — ignorado`);
        return;
      }

      // 3) Verificar filtro por veículo da central (eventDevices)
      const eventDevices: Record<string, number[]> = saved.eventDevices || {};
      const allowedDevices = eventDevices[internalType];
      if (allowedDevices && allowedDevices.length > 0 && !allowedDevices.includes(event.deviceId)) {
        console.debug(`[Notificações] Veículo #${event.deviceId} não está na lista de "${internalType}" — ignorado`);
        return;
      }
    }
  } catch { /* se não conseguir ler, bloqueia por segurança */ return; }

  const notificationData = getNotificationDataForEvent(event, displayName, matchedDevice?.speedLimit);
  if (!notificationData) return;

  notificationManager.addNotification({
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    deviceId: event.deviceId,
    deviceName,
    vehicleName,
    eventType: internalType,
    latitude,
    longitude,
    speedAlertId,
  });
}

/**
 * Gera dados de notificação baseado no tipo de evento
 */
function getNotificationDataForEvent(event: Event, displayName: string, deviceSpeedLimit?: number) {
  const deviceName = displayName;
  
  const eventNotifications: Record<string, {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
  }> = {
    'ignitionOn': {
      type: 'info',
      title: '🔑 Ignição Ligada',
      message: `${deviceName} teve a ignição ligada`,
    },
    'ignitionOff': {
      type: 'info',
      title: '🔑 Ignição Desligada',
      message: `${deviceName} teve a ignição desligada`,
    },
    'deviceOnline': {
      type: 'success',
      title: '🟢 Dispositivo Online',
      message: `${deviceName} voltou a se comunicar`,
    },
    'deviceOffline': {
      type: 'error',
      title: '🔴 Dispositivo Offline',
      message: `${deviceName} parou de se comunicar`,
    },
    'geofenceEnter': {
      type: 'info',
      title: '📍 Entrada em Cerca',
      message: `${deviceName} entrou em ${event.attributes?.geofenceId ? 'cerca geográfica' : 'uma área monitorada'}`,
    },
    'geofenceExit': {
      type: 'warning',
      title: '📍 Saída de Cerca',
      message: `${deviceName} saiu de ${event.attributes?.geofenceId ? 'cerca geográfica' : 'uma área monitorada'}`,
    },
    'alarm': {
      type: 'error',
      title: '🚨 SOS / Alarme',
      message: `${deviceName} acionou o alarme de emergência`,
    },
    'deviceOverspeed': {
      type: 'warning',
      title: '⚡ Excesso de Velocidade',
      message: (() => {
        const speed = event.attributes?.speed ? Math.round(event.attributes.speed) : 0;
        // Prioriza o limite configurado pelo usuário (km/h).
        // Valor do evento Traccar vem em knots → converte * 1.852 apenas como fallback.
        const rawEvtLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const limit = deviceSpeedLimit ||
          (rawEvtLimit > 0 ? Math.round(rawEvtLimit * 1.852) : 0);
        if (speed && limit) {
          return `${deviceName} atingiu ${speed} km/h (limite: ${limit} km/h)`;
        }
        return `${deviceName} excedeu o limite de velocidade`;
      })(),
    },
    'speedLimit': {
      type: 'warning',
      title: '⚡ Excesso de Velocidade',
      message: (() => {
        const speed = event.attributes?.speed ? Math.round(event.attributes.speed) : 0;
        // Prioriza o limite configurado pelo usuário (km/h).
        // Valor do evento Traccar vem em knots → converte * 1.852 apenas como fallback.
        const rawEvtLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const limit = deviceSpeedLimit ||
          (rawEvtLimit > 0 ? Math.round(rawEvtLimit * 1.852) : 0);
        if (speed && limit) {
          return `${deviceName} atingiu ${speed} km/h (limite: ${limit} km/h)`;
        }
        return `${deviceName} excedeu o limite de velocidade`;
      })(),
    },
    'maintenance': {
      type: 'info',
      title: '🔧 Manutenção',
      message: `${deviceName} requer manutenção`,
    },
    'deviceMoving': {
      type: 'info',
      title: '🚗 Dispositivo em Movimento',
      message: `${deviceName} começou a se movimentar`,
    },
    'deviceStopped': {
      type: 'info',
      title: '🛑 Dispositivo Parado',
      message: `${deviceName} parou`,
    },
    'commandResult': {
      type: 'info',
      title: '📟 Resultado de Comando',
      message: event.attributes?.result
        ? `${deviceName}: ${String(event.attributes.result).slice(0, 80)}`
        : `${deviceName} respondeu ao comando`,
    },
    'textMessage': {
      type: 'info',
      title: '💬 Mensagem de Texto',
      message: event.attributes?.message
        ? `${deviceName}: ${String(event.attributes.message).slice(0, 80)}`
        : `${deviceName} enviou uma mensagem`,
    },
    'lowBattery': {
      type: 'warning',
      title: '🔋 Bateria Fraca',
      message: `${deviceName} está com bateria baixa`,
    },
    'driverChanged': {
      type: 'info',
      title: '👤 Motorista Alterado',
      message: `${deviceName} teve o motorista alterado`,
    },
    'fuelDrop': {
      type: 'warning',
      title: '⛽ Queda de Combustível',
      message: `${deviceName} registrou queda de combustível`,
    },
    'fuelIncrease': {
      type: 'success',
      title: '⛽ Abastecimento',
      message: `${deviceName} foi abastecido`,
    },
    'deviceBlocked': {
      type: 'error',
      title: '🔒 Veículo Bloqueado',
      message: `${deviceName} foi bloqueado`,
    },
    'deviceUnblocked': {
      type: 'success',
      title: '🔓 Veículo Desbloqueado',
      message: `${deviceName} foi desbloqueado`,
    },
    'media': {
      type: 'info',
      title: '📷 Mídia Recebida',
      message: `${deviceName} enviou uma mídia`,
    },
  };

  const notification = eventNotifications[event.type];
  
  if (!notification) {
    // Notificação genérica para tipos desconhecidos
    return {
      type: 'info' as const,
      title: `📢 ${event.type}`,
      message: `${deviceName} - ${event.type}`,
    };
  }

  return notification;
}
