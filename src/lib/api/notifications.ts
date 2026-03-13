/**
 * API de Notificações via Traccar real.
 *
 * O Traccar gerencia notificações como entidades próprias:
 *   GET    /notifications          – listar
 *   POST   /notifications          – criar
 *   PUT    /notifications/{id}     – atualizar
 *   DELETE /notifications/{id}     – remover
 *
 * Para vincular notificação a um device/group/user usa-se POST /permissions.
 * Tipos de notificação suportados pelo Traccar: web, mail, sms, firebase, traccar (push).
 * Tipos de evento: commandResult, deviceOnline, deviceUnknown, deviceOffline, deviceInactive,
 *   deviceMoving, deviceStopped, deviceOverspeed, ignitionOn, ignitionOff, geofenceEnter,
 *   geofenceExit, alarm, maintenance, driverChanged, textMessage, media.
 */
import { api } from './client';

// ─── Tipos do Traccar ──────────────────────────────────────────

/** Notificação no formato nativo Traccar */
export interface TraccarNotification {
  id: number;
  type: string;           // tipo de evento: deviceOverspeed, geofenceEnter, etc.
  always: boolean;        // true = dispara para todos os devices do user
  notificators: string;   // canais: "web,mail,sms,firebase" (comma-separated)
  calendarId?: number;    // restrição por calendário
  commandId?: number;     // comando a executar quando o evento ocorre
  attributes?: Record<string, any>;
}

/** Tipo de notificador suportado pelo Traccar */
export type TraccarNotificator = 'web' | 'mail' | 'sms' | 'firebase' | 'traccar';

/** Tipo de evento do Traccar */
export const TRACCAR_EVENT_TYPES = [
  'commandResult', 'deviceOnline', 'deviceUnknown', 'deviceOffline', 'deviceInactive',
  'deviceMoving', 'deviceStopped', 'deviceOverspeed', 'ignitionOn', 'ignitionOff',
  'geofenceEnter', 'geofenceExit', 'alarm', 'maintenance', 'driverChanged',
  'textMessage', 'media',
] as const;

// ─── CRUD ──────────────────────────────────────────────────────

/** Lista todas as notificações do usuário logado */
export async function getTraccarNotifications(): Promise<TraccarNotification[]> {
  return api.get<TraccarNotification[]>('/notifications');
}

/** Cria uma notificação no Traccar */
export async function createTraccarNotification(
  data: Omit<TraccarNotification, 'id'>,
): Promise<TraccarNotification> {
  return api.post<TraccarNotification>('/notifications', data);
}

/** Atualiza uma notificação existente */
export async function updateTraccarNotification(
  id: number,
  data: Partial<TraccarNotification> & { id: number },
): Promise<TraccarNotification> {
  return api.put<TraccarNotification>(`/notifications/${id}`, data);
}

/** Remove uma notificação */
export async function deleteTraccarNotification(id: number): Promise<void> {
  return api.delete<void>(`/notifications/${id}`);
}

/** Lista os tipos de notificadores disponíveis no servidor Traccar */
export async function getNotificatorTypes(): Promise<{ type: string; [k: string]: any }[]> {
  try {
    return await api.get<{ type: string }[]>('/notifications/types');
  } catch {
    // Fallback se o endpoint não existir
    return [
      { type: 'web' },
      { type: 'mail' },
      { type: 'sms' },
      { type: 'firebase' },
    ];
  }
}

/** Envia uma notificação de teste */
export async function testTraccarNotification(notificationId: number): Promise<void> {
  await api.post<void>(`/notifications/test/${notificationId}`, {});
}
