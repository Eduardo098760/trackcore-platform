import { RouteKey, RoutePermissions, ALL_ROUTE_KEYS } from './types';
import {
  SUPER_ADMIN_PERMISSIONS,
  DENIED_ALL_PERMISSIONS,
  READONLY_PERMISSIONS,
  getDefaultPermissionsByRole,
} from './defaults';

const ADMIN_ONLY_KEYS: RouteKey[] = ['commands', 'savedCommands'];

function enforceAdminOnlyRoutes(
  role: string,
  permissions: RoutePermissions,
  isImpersonating: boolean,
): RoutePermissions {
  if (!isImpersonating && (role === 'admin' || role === 'superadmin')) {
    return permissions;
  }

  const restricted = { ...permissions };
  for (const key of ADMIN_ONLY_KEYS) {
    restricted[key] = false;
  }

  return restricted;
}

interface ResolveOptions {
  role: string;
  companyPermissions?: Partial<RoutePermissions>;
  userPermissions?: {
    inheritFromCompany: boolean;
    routes?: Partial<RoutePermissions>;
  };
  /**
   * Quando true (modo impersonação), desativa o bypass de super_admin e usa
   * CLIENT_PERMISSIONS como fallback em vez de SUPER_ADMIN_PERMISSIONS.
   * Garante que o admin nunca veja mais do que o cliente durante suporte.
   */
  isImpersonating?: boolean;
}

/**
 * Resolve as permissões finais de um usuário seguindo a hierarquia:
 *
 *   1. SUPER_ADMIN → tudo liberado, sem restrições
 *   2. Sem NENHUMA configuração salva → usa as permissões padrão da role
 *   3. Empresa define o teto máximo (ceiling)
 *   4. Usuário pode:
 *      a) Herdar as permissões da empresa (inheritFromCompany = true)
 *      b) Ter permissões customizadas — NUNCA superiores ao teto da empresa
 */
export function resolvePermissions(options: ResolveOptions): RoutePermissions {
  const { role, companyPermissions, userPermissions, isImpersonating = false } = options;

  // ── 1. ADMIN (Traccar administrator): bypass total — NUNCA durante impersonação ──
  if (!isImpersonating && role === 'admin') return { ...SUPER_ADMIN_PERMISSIONS };
  // retrocompatibilidade: 'superadmin' gravado no banco antes da migração
  if (!isImpersonating && role === 'superadmin') return { ...SUPER_ADMIN_PERMISSIONS };

  // ── 2. Sem nenhuma configuração salva ────────────────────────────────
  // Durante impersonação: READONLY_PERMISSIONS (visão do usuário somente leitura)
  // Fora da impersonação: usa o padrão da role do usuário
  const hasCompanyConfig = companyPermissions !== undefined && companyPermissions !== null;
  const hasUserConfig    = userPermissions    !== undefined && userPermissions    !== null;
  const roleDefaults = getDefaultPermissionsByRole(role);

  if (!hasCompanyConfig && !hasUserConfig) {
    return enforceAdminOnlyRoutes(
      role,
      isImpersonating
        ? { ...READONLY_PERMISSIONS }
        : { ...roleDefaults },
      isImpersonating,
    );
  }

  // ── 3. Teto da empresa ──────────────────────────────────────────
  // Se empresa não foi configurada ainda, usa o padrão da role como teto inicial
  const ceiling: RoutePermissions = { ...roleDefaults };
  if (hasCompanyConfig) {
    for (const key of ALL_ROUTE_KEYS) {
      ceiling[key] = companyPermissions![key] ?? roleDefaults[key];
    }
  }

  // ── 4. Permissões do usuário ────────────────────────────────────
  // a) Sem config de usuário ou herda da empresa → retorna o teto da empresa
  if (!userPermissions || userPermissions.inheritFromCompany) {
    return enforceAdminOnlyRoutes(role, ceiling, isImpersonating);
  }

  // b) Customizado → interseção com o teto (usuário nunca supera a empresa)
  const result: RoutePermissions = { ...DENIED_ALL_PERMISSIONS };
  for (const key of ALL_ROUTE_KEYS) {
    const companyAllows = ceiling[key];
    const userAllows    = userPermissions.routes?.[key] ?? ceiling[key];
    result[key] = companyAllows && userAllows;
  }

  return enforceAdminOnlyRoutes(role, result, isImpersonating);
}
