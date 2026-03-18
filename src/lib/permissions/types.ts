/**
 * Sistema de Controle de Acesso — TrackCore
 * 
 * Hierarquia:
 *   SUPER_ADMIN → acesso total irrestrito
 *   Empresa     → teto máximo de acesso (ceiling)
 *   Usuário     → herda da empresa ou tem permissões customizadas (nunca superiores à empresa)
 */

/** Chaves únicas para cada rota protegida */
export type RouteKey =
  // Navegação principal
  | 'dashboard'
  | 'map'
  | 'vehicles'
  | 'drivers'
  // Monitoramento
  | 'history'
  | 'replay'
  | 'events'
  | 'reports'
  | 'statistics'
  // Controle
  | 'commands'
  | 'savedCommands'
  | 'geofences'
  | 'notifications'
  | 'maintenance'
  // VideoTelemetria
  | 'video'
  | 'videoAlerts'
  | 'cameras'
  // Avançado
  | 'routes'
  | 'groups'
  | 'calendars'
  | 'computedAttributes'
  | 'obd'
  // Gerenciamento
  | 'clients'
  | 'users'
  | 'settings'
  | 'serverConfig'
  | 'smsConfig'
  | 'accessControl'
  | 'audit'
  | 'organizations'
  | 'notificationTemplates'
  | 'sharedAccess';

/** Mapa de permissões: chave → liberado/bloqueado */
export type RoutePermissions = Record<RouteKey, boolean>;

/** Lista de todas as chaves (útil para iteração) */
export const ALL_ROUTE_KEYS: RouteKey[] = [
  'dashboard', 'map', 'vehicles', 'drivers',
  'history', 'replay', 'events', 'reports', 'statistics',
  'commands', 'savedCommands', 'geofences', 'notifications', 'maintenance',
  'video', 'videoAlerts', 'cameras',
  'routes', 'groups', 'calendars', 'computedAttributes', 'obd',
  'clients', 'users', 'settings', 'serverConfig', 'smsConfig', 'accessControl', 'audit',
  'organizations', 'notificationTemplates', 'sharedAccess',
];

/** Record salvo no store por empresa */
export interface CompanyPermissionEntry {
  companyId: number;
  routes: RoutePermissions;
}

/** Record salvo no store por usuário */
export interface UserPermissionEntry {
  userId: number;
  /** Se true, usa as permissões da empresa sem customização */
  inheritFromCompany: boolean;
  /** Permissões customizadas (só aplicadas quando inheritFromCompany = false) */
  routes: RoutePermissions;
}
