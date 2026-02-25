import { RoutePermissions, ALL_ROUTE_KEYS } from './types';
import { SUPER_ADMIN_PERMISSIONS, DENIED_ALL_PERMISSIONS, CLIENT_PERMISSIONS } from './defaults';

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
 *   2. Sem NENHUMA configuração salva → libera tudo (open by default)
 *      Garante que ninguém perde acesso antes de qualquer definição no painel.
 *   3. Empresa define o teto máximo (ceiling)
 *   4. Usuário pode:
 *      a) Herdar as permissões da empresa (inheritFromCompany = true)
 *      b) Ter permissões customizadas — NUNCA superiores ao teto da empresa
 */
export function resolvePermissions(options: ResolveOptions): RoutePermissions {
  const { role, companyPermissions, userPermissions, isImpersonating = false } = options;

  // ── 1. SUPER_ADMIN: bypass total — NUNCA durante impersonação ─────────────
  if (!isImpersonating && role === 'superadmin') return { ...SUPER_ADMIN_PERMISSIONS };

  // ── 2. Sem nenhuma configuração salva ────────────────────────────────
  // Durante impersonação: CLIENT_PERMISSIONS (visão do cliente, não do admin)
  // Fora da impersonação: libera tudo (open by default para novos usuários)
  const hasCompanyConfig = companyPermissions !== undefined && companyPermissions !== null;
  const hasUserConfig    = userPermissions    !== undefined && userPermissions    !== null;

  if (!hasCompanyConfig && !hasUserConfig) {
    return isImpersonating
      ? { ...CLIENT_PERMISSIONS }
      : { ...SUPER_ADMIN_PERMISSIONS };
  }

  // ── 3. Teto da empresa ──────────────────────────────────────────
  // Se empresa não foi configurada ainda, usa tudo aberto como ceiling
  const ceiling: RoutePermissions = { ...SUPER_ADMIN_PERMISSIONS };
  if (hasCompanyConfig) {
    for (const key of ALL_ROUTE_KEYS) {
      ceiling[key] = companyPermissions![key] ?? true;
    }
  }

  // ── 4. Permissões do usuário ────────────────────────────────────
  // a) Sem config de usuário ou herda da empresa → retorna o teto da empresa
  if (!userPermissions || userPermissions.inheritFromCompany) {
    return ceiling;
  }

  // b) Customizado → interseção com o teto (usuário nunca supera a empresa)
  const result: RoutePermissions = { ...DENIED_ALL_PERMISSIONS };
  for (const key of ALL_ROUTE_KEYS) {
    const companyAllows = ceiling[key];
    const userAllows    = userPermissions.routes?.[key] ?? ceiling[key];
    result[key] = companyAllows && userAllows;
  }

  return result;
}
