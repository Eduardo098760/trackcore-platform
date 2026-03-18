import { RoutePermissions } from './types';

/**
 * Permissões padrão por role — alinhadas ao modelo nativo do Traccar:
 *
 *   admin          → administrator: true  → acesso irrestrito
 *   manager        → userLimit != 0        → gerencia usuários e dispositivos
 *   user           → usuário regular       → acesso operacional
 *   readonly       → readonly: true        → somente leitura
 *   deviceReadonly → deviceReadonly: true  → leitura de dispositivos
 */

/** ADMIN (Traccar administrator): acesso irrestrito a tudo */
export const SUPER_ADMIN_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, drivers: true, history: true, replay: true, events: true, commands: true, savedCommands: true,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, maintenance: true, reports: true, groups: true, calendars: true,
  computedAttributes: true, obd: true, statistics: true,
  clients: true, users: true, audit: true, settings: true, serverConfig: true, smsConfig: true, accessControl: true,
  organizations: true, notificationTemplates: true, sharedAccess: true,
};

/** MANAGER (Traccar userLimit != 0): gerencia usuários e dispositivos, sem auditoria e controle de acesso */
export const MANAGER_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, drivers: true, history: true, replay: true, events: true, commands: true, savedCommands: true,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, maintenance: true, reports: true, groups: true, calendars: true,
  computedAttributes: true, obd: true, statistics: true,
  clients: true, users: true, audit: false, settings: true, serverConfig: false, smsConfig: false, accessControl: false,
  organizations: false, notificationTemplates: true, sharedAccess: true,
};

/** USER (usuário regular Traccar): acesso operacional aos próprios recursos */
export const USER_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, drivers: false, history: true, replay: true, events: true, commands: true, savedCommands: false,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, maintenance: false, reports: true, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: true,
  clients: false, users: false, audit: false, settings: false, serverConfig: false, smsConfig: false, accessControl: false,
  organizations: false, notificationTemplates: false, sharedAccess: false,
};

/** READONLY (Traccar readonly: true): somente leitura — monitora mas não modifica nada */
export const READONLY_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, drivers: false, history: true, replay: true, events: true, commands: false, savedCommands: false,
  video: true, videoAlerts: true, cameras: false,
  geofences: false, notifications: false, maintenance: false, reports: true, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: true,
  clients: false, users: false, audit: false, settings: false, serverConfig: false, smsConfig: false, accessControl: false,
  organizations: false, notificationTemplates: false, sharedAccess: false,
};

/** DEVICE_READONLY (Traccar deviceReadonly: true): operacional mas sem editar dispositivos */
export const DEVICE_READONLY_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, drivers: false, history: true, replay: true, events: true, commands: false, savedCommands: false,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, maintenance: false, reports: true, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: true,
  clients: false, users: false, audit: false, settings: false, serverConfig: false, smsConfig: false, accessControl: false,
  organizations: false, notificationTemplates: false, sharedAccess: false,
};

/** Todas as rotas bloqueadas (fallback para usuário não autenticado) */
export const DENIED_ALL_PERMISSIONS: RoutePermissions = {
  dashboard: false, map: false, routes: false, vehicles: false, drivers: false, history: false, replay: false, events: false, commands: false, savedCommands: false,
  video: false, videoAlerts: false, cameras: false,
  geofences: false, notifications: false, maintenance: false, reports: false, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: false,
  clients: false, users: false, audit: false, settings: false, serverConfig: false, smsConfig: false, accessControl: false,
  organizations: false, notificationTemplates: false, sharedAccess: false,
};

// Aliases retrocompatíveis (não remover sem migrar todos os importadores)
/** @deprecated Use MANAGER_PERMISSIONS */
export const ADMIN_PERMISSIONS = MANAGER_PERMISSIONS;
/** @deprecated Use USER_PERMISSIONS */
export const OPERATOR_PERMISSIONS = USER_PERMISSIONS;
/** @deprecated Use READONLY_PERMISSIONS */
export const CLIENT_PERMISSIONS = READONLY_PERMISSIONS;

/** Retorna as permissões padrão de acordo com o role do usuário */
export function getDefaultPermissionsByRole(role: string): RoutePermissions {
  switch (role) {
    case 'admin':          return SUPER_ADMIN_PERMISSIONS;
    case 'manager':        return MANAGER_PERMISSIONS;
    case 'user':           return USER_PERMISSIONS;
    case 'readonly':       return READONLY_PERMISSIONS;
    case 'deviceReadonly': return DEVICE_READONLY_PERMISSIONS;
    // retrocompatibilidade com roles antigas salvas no banco
    case 'superadmin':     return SUPER_ADMIN_PERMISSIONS;
    case 'operator':       return USER_PERMISSIONS;
    case 'client':         return READONLY_PERMISSIONS;
    default:               return READONLY_PERMISSIONS;
  }
}
