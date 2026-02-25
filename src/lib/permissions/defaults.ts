import { RoutePermissions } from './types';

/** SUPER_ADMIN: acesso irrestrito a tudo */
export const SUPER_ADMIN_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, history: true, events: true, commands: true,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, reports: true, groups: true, calendars: true,
  computedAttributes: true, obd: true, statistics: true,
  clients: true, users: true, audit: true, settings: true, accessControl: true,
};

/** Admin: quase tudo, sem controle de acesso e logs de auditoria */
export const ADMIN_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, history: true, events: true, commands: true,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, reports: true, groups: true, calendars: true,
  computedAttributes: true, obd: true, statistics: true,
  clients: true, users: true, audit: false, settings: true, accessControl: false,
};

/** Operador: acesso operacional, sem gerenciamento */
export const OPERATOR_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: true, vehicles: true, history: true, events: true, commands: true,
  video: true, videoAlerts: true, cameras: true,
  geofences: true, notifications: true, reports: true, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: true,
  clients: false, users: false, audit: false, settings: false, accessControl: false,
};

/** Cliente: visualização básica de seus veículos */
export const CLIENT_PERMISSIONS: RoutePermissions = {
  dashboard: true, map: true, routes: false, vehicles: true, history: true, events: false, commands: false,
  video: false, videoAlerts: false, cameras: false,
  geofences: false, notifications: false, reports: true, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: false,
  clients: false, users: false, audit: false, settings: false, accessControl: false,
};

/** Todas as rotas bloqueadas (fallback para usuário não autenticado) */
export const DENIED_ALL_PERMISSIONS: RoutePermissions = {
  dashboard: false, map: false, routes: false, vehicles: false, history: false, events: false, commands: false,
  video: false, videoAlerts: false, cameras: false,
  geofences: false, notifications: false, reports: false, groups: false, calendars: false,
  computedAttributes: false, obd: false, statistics: false,
  clients: false, users: false, audit: false, settings: false, accessControl: false,
};

/** Retorna as permissões padrão de acordo com o role do usuário */
export function getDefaultPermissionsByRole(role: string): RoutePermissions {
  switch (role) {
    case 'superadmin': return SUPER_ADMIN_PERMISSIONS;
    case 'admin':      return ADMIN_PERMISSIONS;
    case 'operator':   return OPERATOR_PERMISSIONS;
    case 'client':     return CLIENT_PERMISSIONS;
    default:           return CLIENT_PERMISSIONS;
  }
}
