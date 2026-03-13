/**
 * API centralizada de permissões N:N do Traccar.
 *
 * Todas as relações usam POST /permissions (criar) e DELETE /permissions (remover).
 * Body: { userId?, deviceId?, groupId?, geofenceId?, notificationId?, maintenanceId?, calendarId?, driverId? }
 */
import { api } from './client';

// ─── Tipos de relação ──────────────────────────────────────────────
type PermissionPair = Record<string, number>;

async function linkPermission(pair: PermissionPair): Promise<void> {
  await api.post<void>('/permissions', pair);
}

async function unlinkPermission(pair: PermissionPair): Promise<void> {
  await api.delete<void>('/permissions', pair, true);
}

// ─── User ↔ Device ─────────────────────────────────────────────────
export const addUserDevice = (userId: number, deviceId: number) =>
  linkPermission({ userId, deviceId });
export const removeUserDevice = (userId: number, deviceId: number) =>
  unlinkPermission({ userId, deviceId });

// ─── User ↔ Group ──────────────────────────────────────────────────
export const addUserGroup = (userId: number, groupId: number) =>
  linkPermission({ userId, groupId });
export const removeUserGroup = (userId: number, groupId: number) =>
  unlinkPermission({ userId, groupId });

// ─── User ↔ Geofence ──────────────────────────────────────────────
export const addUserGeofence = (userId: number, geofenceId: number) =>
  linkPermission({ userId, geofenceId });
export const removeUserGeofence = (userId: number, geofenceId: number) =>
  unlinkPermission({ userId, geofenceId });

// ─── User ↔ Notification ──────────────────────────────────────────
export const addUserNotification = (userId: number, notificationId: number) =>
  linkPermission({ userId, notificationId });
export const removeUserNotification = (userId: number, notificationId: number) =>
  unlinkPermission({ userId, notificationId });

// ─── User ↔ Maintenance ───────────────────────────────────────────
export const addUserMaintenance = (userId: number, maintenanceId: number) =>
  linkPermission({ userId, maintenanceId });
export const removeUserMaintenance = (userId: number, maintenanceId: number) =>
  unlinkPermission({ userId, maintenanceId });

// ─── User ↔ Calendar ──────────────────────────────────────────────
export const addUserCalendar = (userId: number, calendarId: number) =>
  linkPermission({ userId, calendarId });
export const removeUserCalendar = (userId: number, calendarId: number) =>
  unlinkPermission({ userId, calendarId });

// ─── User ↔ Driver ────────────────────────────────────────────────
export const addUserDriver = (userId: number, driverId: number) =>
  linkPermission({ userId, driverId });
export const removeUserDriver = (userId: number, driverId: number) =>
  unlinkPermission({ userId, driverId });

// ─── Device ↔ Geofence ────────────────────────────────────────────
export const addDeviceGeofence = (deviceId: number, geofenceId: number) =>
  linkPermission({ deviceId, geofenceId });
export const removeDeviceGeofence = (deviceId: number, geofenceId: number) =>
  unlinkPermission({ deviceId, geofenceId });

// ─── Device ↔ Notification ────────────────────────────────────────
export const addDeviceNotification = (deviceId: number, notificationId: number) =>
  linkPermission({ deviceId, notificationId });
export const removeDeviceNotification = (deviceId: number, notificationId: number) =>
  unlinkPermission({ deviceId, notificationId });

// ─── Device ↔ Maintenance ─────────────────────────────────────────
export const addDeviceMaintenance = (deviceId: number, maintenanceId: number) =>
  linkPermission({ deviceId, maintenanceId });
export const removeDeviceMaintenance = (deviceId: number, maintenanceId: number) =>
  unlinkPermission({ deviceId, maintenanceId });

// ─── Device ↔ Driver ──────────────────────────────────────────────
export const addDeviceDriver = (deviceId: number, driverId: number) =>
  linkPermission({ deviceId, driverId });
export const removeDeviceDriver = (deviceId: number, driverId: number) =>
  unlinkPermission({ deviceId, driverId });

// ─── Device ↔ Calendar ────────────────────────────────────────────
export const addDeviceCalendar = (deviceId: number, calendarId: number) =>
  linkPermission({ deviceId, calendarId });
export const removeDeviceCalendar = (deviceId: number, calendarId: number) =>
  unlinkPermission({ deviceId, calendarId });

// ─── Group ↔ Geofence ─────────────────────────────────────────────
export const addGroupGeofence = (groupId: number, geofenceId: number) =>
  linkPermission({ groupId, geofenceId });
export const removeGroupGeofence = (groupId: number, geofenceId: number) =>
  unlinkPermission({ groupId, geofenceId });

// ─── Group ↔ Notification ─────────────────────────────────────────
export const addGroupNotification = (groupId: number, notificationId: number) =>
  linkPermission({ groupId, notificationId });
export const removeGroupNotification = (groupId: number, notificationId: number) =>
  unlinkPermission({ groupId, notificationId });

// ─── Group ↔ Maintenance ──────────────────────────────────────────
export const addGroupMaintenance = (groupId: number, maintenanceId: number) =>
  linkPermission({ groupId, maintenanceId });
export const removeGroupMaintenance = (groupId: number, maintenanceId: number) =>
  unlinkPermission({ groupId, maintenanceId });

// ─── Group ↔ Driver ───────────────────────────────────────────────
export const addGroupDriver = (groupId: number, driverId: number) =>
  linkPermission({ groupId, driverId });
export const removeGroupDriver = (groupId: number, driverId: number) =>
  unlinkPermission({ groupId, driverId });

// ─── Group ↔ Calendar ─────────────────────────────────────────────
export const addGroupCalendar = (groupId: number, calendarId: number) =>
  linkPermission({ groupId, calendarId });
export const removeGroupCalendar = (groupId: number, calendarId: number) =>
  unlinkPermission({ groupId, calendarId });

// ─── Utilitário: sincroniza lista de IDs ───────────────────────────
/**
 * Sincroniza uma relação N:N: adiciona os novos, remove os que não estão mais.
 */
export async function syncPermissions(
  currentIds: number[],
  newIds: number[],
  addFn: (id: number) => Promise<void>,
  removeFn: (id: number) => Promise<void>,
): Promise<void> {
  const toAdd = newIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !newIds.includes(id));
  await Promise.all([
    ...toAdd.map(addFn),
    ...toRemove.map(removeFn),
  ]);
}
