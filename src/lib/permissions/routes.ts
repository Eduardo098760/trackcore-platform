import { RouteKey } from './types';

/** Grupos de rotas para organização na UI */
export type RouteGroup = 'main' | 'monitoring' | 'control' | 'video' | 'advanced' | 'management';

export interface RouteConfig {
  key: RouteKey;
  name: string;
  href: string;
  group: RouteGroup;
}

/** Registro de todas as rotas da aplicação */
export const ROUTE_CONFIGS: RouteConfig[] = [
  // ── Principal ────────────────────────────────────────────────────
  { key: 'dashboard',          name: 'Dashboard',              href: '/dashboard',            group: 'main' },
  { key: 'map',                name: 'Mapa',                   href: '/map',                  group: 'main' },
  { key: 'vehicles',           name: 'Veículos',               href: '/vehicles',             group: 'main' },
  { key: 'drivers',            name: 'Motoristas',             href: '/drivers',              group: 'main' },
  // ── Monitoramento ────────────────────────────────────────────────
  { key: 'history',            name: 'Histórico',              href: '/history',              group: 'monitoring' },
  { key: 'replay',             name: 'Replay',                 href: '/replay',               group: 'monitoring' },
  { key: 'events',             name: 'Eventos',                href: '/events',               group: 'monitoring' },
  { key: 'reports',            name: 'Relatórios',             href: '/reports',              group: 'monitoring' },
  { key: 'statistics',         name: 'Estatísticas',           href: '/statistics',           group: 'monitoring' },
  // ── Controle ─────────────────────────────────────────────────────
  { key: 'commands',           name: 'Comandos',               href: '/commands',             group: 'control' },
  { key: 'savedCommands',      name: 'Comandos Salvos',        href: '/saved-commands',       group: 'control' },
  { key: 'geofences',          name: 'Cercas Geográficas',     href: '/geofences',            group: 'control' },
  { key: 'notifications',      name: 'Notificações',           href: '/notifications',        group: 'control' },
  { key: 'maintenance',        name: 'Manutenção',             href: '/maintenance',          group: 'control' },
  // ── VideoTelemetria ──────────────────────────────────────────────
  { key: 'video',              name: 'VideoTelemetria',        href: '/video',                group: 'video' },
  { key: 'videoAlerts',        name: 'Alertas de Vídeo',       href: '/video-alerts',         group: 'video' },
  { key: 'cameras',            name: 'Câmeras',                href: '/cameras',              group: 'video' },
  // ── Avançado ─────────────────────────────────────────────────────
  { key: 'routes',             name: 'Rotas',                  href: '/routes',               group: 'advanced' },
  { key: 'groups',             name: 'Grupos',                 href: '/groups',               group: 'advanced' },
  { key: 'calendars',          name: 'Calendários',            href: '/calendars',            group: 'advanced' },
  { key: 'computedAttributes', name: 'Atributos Computados',   href: '/computed-attributes',  group: 'advanced' },
  { key: 'obd',                name: 'Computador de Bordo',    href: '/obd',                  group: 'advanced' },
  // ── Gerenciamento ────────────────────────────────────────────────
  { key: 'clients',            name: 'Clientes',               href: '/clients',              group: 'management' },
  { key: 'users',              name: 'Usuários',               href: '/users',                group: 'management' },
  { key: 'settings',           name: 'Configurações',          href: '/settings',             group: 'management' },
  { key: 'serverConfig',       name: 'Config. Servidor',       href: '/server-config',        group: 'management' },
  { key: 'smsConfig',           name: 'Config. SMS',            href: '/sms-config',           group: 'management' },
  { key: 'accessControl',      name: 'Controle de Acesso',     href: '/access-control',       group: 'management' },
  { key: 'audit',              name: 'Logs de Auditoria',      href: '/audit',                group: 'management' },
  { key: 'organizations',      name: 'Organizações',           href: '/organizations',        group: 'management' },
  { key: 'notificationTemplates', name: 'Templates de Notificação', href: '/notification-templates', group: 'control' },
  { key: 'sharedAccess',       name: 'Acesso Compartilhado',   href: '/shared-access',        group: 'management' },
];

/** Mapa href → RouteKey para lookup rápido */
export const HREF_TO_KEY: Record<string, RouteKey> = Object.fromEntries(
  ROUTE_CONFIGS.map((r) => [r.href, r.key])
);

/** Labels dos grupos para exibição na UI */
export const GROUP_LABELS: Record<RouteGroup, string> = {
  main:       'Principal',
  monitoring: 'Monitoramento',
  control:    'Controle',
  video:      'VideoTelemetria',
  advanced:   'Avançado',
  management: 'Gerenciamento',
};

/**
 * Retorna a RouteKey correspondente a um pathname.
 * Suporta rotas aninhadas (ex: /vehicles/123 → 'vehicles').
 */
export function getRouteKeyForPath(pathname: string): RouteKey | null {
  if (HREF_TO_KEY[pathname]) return HREF_TO_KEY[pathname];
  for (const { href, key } of ROUTE_CONFIGS) {
    if (pathname.startsWith(`${href}/`)) return key;
  }
  return null;
}
