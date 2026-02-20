import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvents } from '@/lib/api';
import { notificationManager } from '@/lib/notifications';
import { Event } from '@/types';

/**
 * Hook que monitora eventos do Traccar e dispara notificações automaticamente
 */
export function useEventNotifications(enabled: boolean = true) {
  const processedEvents = useRef(new Set<number>());
  const lastCheckTime = useRef<Date>(new Date());

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
    refetchInterval: 5000, // Verificar a cada 5 segundos (mais responsivo)
    refetchOnWindowFocus: true, // Refetch quando voltar para janela
  });

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Filtrar apenas eventos novos (não processados)
    const newEvents = events.filter(event => {
      // Verificar se já foi processado
      if (processedEvents.current.has(event.id)) return false;
      
      // Verificar se é realmente novo (depois do último check)
      const eventTime = new Date(event.serverTime || event.fixTime);
      if (eventTime < lastCheckTime.current) return false;
      
      return true;
    });

    if (newEvents.length === 0) return;

    console.log(`📊 ${newEvents.length} novo(s) evento(s) detectado(s)`);

    // Processar eventos um por vez com pequeno delay para evitar empilhamento
    newEvents.forEach((event, index) => {
      setTimeout(() => {
        processEvent(event);
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
  }, [events]);

  return { events };
}

/**
 * Processa um evento e cria notificação apropriada
 */
function processEvent(event: Event) {
  console.log('📢 Processando evento:', event);

  // Verificar configurações do usuário
  const settingsStr = localStorage.getItem('notificationSettings');
  if (!settingsStr) return;

  const settings = JSON.parse(settingsStr);
  if (!settings.inApp?.enabled) {
    console.log('Notificações in-app desabilitadas');
    return;
  }

  // Mapear tipo de evento Traccar para tipo interno
  const eventTypeMap: Record<string, keyof typeof settings.events> = {
    'ignitionOn': 'ignitionOn',
    'ignitionOff': 'ignitionOff',
    'deviceOnline': 'deviceOnline',
    'deviceOffline': 'deviceOffline',
    'geofenceEnter': 'geofenceEnter',
    'geofenceExit': 'geofenceExit',
    'alarm': 'sos',
    'deviceOverspeed': 'speedLimit',
    'maintenance': 'maintenance',
  };

  const internalEventType = eventTypeMap[event.type];
  
  // Verificar se o tipo de evento está habilitado
  if (internalEventType && !settings.events[internalEventType]) {
    console.log(`Notificações para ${String(internalEventType)} desabilitadas`);
    return;
  }

  // Criar notificação baseada no tipo de evento
  const notificationData = getNotificationDataForEvent(event);
  if (notificationData) {
    notificationManager.addNotification({
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      deviceId: event.deviceId,
      deviceName: event.attributes?.deviceName || `Veículo #${event.deviceId}`,
      eventType: String(internalEventType || event.type),
    });
  }
}

/**
 * Gera dados de notificação baseado no tipo de evento
 */
function getNotificationDataForEvent(event: Event) {
  const deviceName = event.attributes?.deviceName || `Veículo #${event.deviceId}`;
  
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
        const speedLimit = event.attributes?.speedLimit || 0;
        if (speed && speedLimit) {
          return `${deviceName} atingiu ${speed} km/h (limite: ${speedLimit} km/h)`;
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
