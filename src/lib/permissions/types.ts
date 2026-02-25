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
  | 'routes'
  | 'vehicles'
  | 'history'
  | 'events'
  | 'commands'
  // VideoTelemetria
  | 'video'
  | 'videoAlerts'
  | 'cameras'
  // Recursos Avançados
  | 'geofences'
  | 'notifications'
  | 'reports'
  | 'groups'
  | 'calendars'
  | 'computedAttributes'
  | 'obd'
  | 'statistics'
  // Gerenciamento
  | 'clients'
  | 'users'
  | 'audit'
  | 'settings'
  | 'accessControl';

/** Mapa de permissões: chave → liberado/bloqueado */
export type RoutePermissions = Record<RouteKey, boolean>;

/** Lista de todas as chaves (útil para iteração) */
export const ALL_ROUTE_KEYS: RouteKey[] = [
  'dashboard', 'map', 'routes', 'vehicles', 'history', 'events', 'commands',
  'video', 'videoAlerts', 'cameras',
  'geofences', 'notifications', 'reports', 'groups', 'calendars', 'computedAttributes', 'obd', 'statistics',
  'clients', 'users', 'audit', 'settings', 'accessControl',
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
