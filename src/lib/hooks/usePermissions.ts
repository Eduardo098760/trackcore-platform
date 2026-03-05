import { useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/auth';
import { usePermissionsStore } from '@/lib/stores/permissions';
import { resolvePermissions } from '@/lib/permissions/resolver';
import { RouteKey, RoutePermissions } from '@/lib/permissions/types';
import { getRouteKeyForPath } from '@/lib/permissions/routes';
import { DENIED_ALL_PERMISSIONS } from '@/lib/permissions/defaults';

export interface UsePermissionsReturn {
  /** Mapa final de permissões resolvidas para o usuário atual */
  permissions: RoutePermissions;
  /** Verifica se o usuário pode acessar uma rota pela sua RouteKey */
  can: (key: RouteKey) => boolean;
  /** Verifica se o usuário pode acessar uma rota pelo seu pathname (/map, /vehicles etc.) */
  canAccessPath: (pathname: string) => boolean;
  /** True se o usuário é SUPER_ADMIN (bypass total) */
  isSuperAdmin: boolean;
}

/**
 * Hook que expõe as permissões resolvidas do usuário autenticado.
 *
 * Segue a hierarquia:
 *   SUPER_ADMIN → tudo liberado
 *   Empresa     → teto máximo
 *   Usuário     → herda da empresa ou customizado (nunca supera a empresa)
 */
export function usePermissions(): UsePermissionsReturn {
  const user         = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  // Durante impersonação, aplicar as permissões DO CLIENTE, não do admin
  const isImpersonating = useAuthStore((s) => s.isImpersonating);

  const companyPerms = usePermissionsStore(
    (s) => (organization ? s.companies[organization.id] : undefined)
  );
  const userPerms = usePermissionsStore(
    (s) => (user ? s.users[user.id] : undefined)
  );

  const permissions = useMemo((): RoutePermissions => {
    if (!user) return { ...DENIED_ALL_PERMISSIONS };

    return resolvePermissions({
      role: user.role,
      companyPermissions:  companyPerms,
      userPermissions:     userPerms,
      // Bloqueia bypass admin e usa READONLY_PERMISSIONS como fallback durante impersonação
      isImpersonating,
    });
  }, [user, companyPerms, userPerms, isImpersonating]);

  // Durante impersonação: isSuperAdmin é SEMPRE false, independente da role do alvo
  // 'admin' = Traccar administrator (acesso irrestrito); 'manager' usa o sistema de permissões normalmente
  const isSuperAdmin = !isImpersonating && user?.role === 'admin';

  const can = (key: RouteKey): boolean => {
    if (isSuperAdmin) return true;
    return permissions[key] ?? false;
  };

  const canAccessPath = (pathname: string): boolean => {
    if (isSuperAdmin) return true;
    const key = getRouteKeyForPath(pathname);
    if (!key) return true;
    return permissions[key] ?? false;
  };

  return { permissions, can, canAccessPath, isSuperAdmin };
}
