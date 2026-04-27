import type { NextApiRequest } from 'next';
import { getCurrentTraccarUser, getTraccarUserOrganizationId, isTraccarAdmin } from '@/lib/server/traccar-server';

export interface RequestAccessScope {
  userId?: number;
  organizationId?: number;
  isAdmin: boolean;
  canManageUsers: boolean;
}

function canTraccarUserManageUsers(
  user: Awaited<ReturnType<typeof getCurrentTraccarUser>> | null | undefined,
) {
  if (!user) return false;

  if (isTraccarAdmin(user)) {
    return true;
  }

  const role = String(user.attributes?.role || '').trim().toLowerCase();
  if (role === 'manager') {
    return true;
  }

  const userLimit = Number(user.userLimit);
  return Number.isFinite(userLimit) && userLimit !== 0;
}

export async function getRequestAccessScope(req: Pick<NextApiRequest, 'headers'>): Promise<RequestAccessScope> {
  const user = await getCurrentTraccarUser(req);

  return {
    userId: typeof user?.id === 'number' ? user.id : undefined,
    organizationId: getTraccarUserOrganizationId(user),
    isAdmin: isTraccarAdmin(user),
    canManageUsers: canTraccarUserManageUsers(user),
  };
}

export function ensureOrganizationAccess(
  scope: RequestAccessScope,
  resourceOrganizationId?: number,
) {
  if (resourceOrganizationId == null) {
    return scope.isAdmin;
  }

  if (scope.isAdmin && scope.organizationId == null) {
    return true;
  }

  return scope.organizationId === resourceOrganizationId;
}