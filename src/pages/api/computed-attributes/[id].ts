import type { NextApiRequest, NextApiResponse } from 'next';
import {
  deleteComputedAttributeBinding,
  getComputedAttributeBinding,
  upsertComputedAttributeBinding,
} from '@/lib/server/computed-attribute-scope-store';
import { ensureOrganizationAccess, getRequestAccessScope } from '@/lib/server/request-access';
import { fetchTraccarWithSession } from '@/lib/server/traccar-server';

function canAccessComputedAttributeBinding(
  scope: Awaited<ReturnType<typeof getRequestAccessScope>>,
  binding: Record<string, any>,
) {
  const assignedUserIds = Array.isArray(binding.assignedUserIds) ? binding.assignedUserIds : [];
  const isAssignedUser = scope.userId != null && assignedUserIds.includes(scope.userId);
  const sameOrganization = binding.organizationId != null && ensureOrganizationAccess(scope, binding.organizationId);
  const isCreatorManager = scope.canManageUsers && scope.userId != null && binding.createdByUserId === scope.userId;

  if (scope.isAdmin && scope.organizationId == null) {
    return true;
  }

  if (scope.canManageUsers) {
    return sameOrganization || isCreatorManager || isAssignedUser;
  }

  if (isAssignedUser) {
    return true;
  }

  return assignedUserIds.length === 0 && sameOrganization;
}

function mergeAttributeBinding(attribute: Record<string, any>, binding?: Record<string, any> | null) {
  if (!binding) {
    return attribute;
  }

  return {
    ...attribute,
    organizationId: binding.organizationId,
    createdByUserId: binding.createdByUserId,
    assignedUserIds: Array.isArray(binding.assignedUserIds) ? binding.assignedUserIds : [],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  const scope = await getRequestAccessScope(req);
  const binding = getComputedAttributeBinding(id);

  if (!binding && !(scope.isAdmin && scope.organizationId == null)) {
    return res.status(404).json({ error: 'Atributo computado não encontrado.' });
  }

  if (binding && !canAccessComputedAttributeBinding(scope, binding)) {
    return res.status(403).json({ error: 'Acesso negado a atributo de outra conta.' });
  }

  if (req.method === 'PUT') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const assignedUserIds = scope.canManageUsers && binding && Array.isArray(body.assignedUserIds)
      ? body.assignedUserIds
      : binding?.assignedUserIds;
    const payload = {
      id,
      description: body.description,
      attribute: body.attribute,
      expression: body.expression,
      type: body.type,
    };

    const response = await fetchTraccarWithSession(req, `/attributes/computed/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(response.status).json({ error: detail || 'Falha ao atualizar atributo computado.' });
    }

    const updated = await response.json();

    if (binding) {
      upsertComputedAttributeBinding({
        attributeId: id,
        organizationId: binding.organizationId,
        createdByUserId: binding.createdByUserId,
        assignedUserIds,
      });
    }

    return res.status(200).json(mergeAttributeBinding(updated, getComputedAttributeBinding(id)));
  }

  if (req.method === 'DELETE') {
    const response = await fetchTraccarWithSession(req, `/attributes/computed/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(response.status).json({ error: detail || 'Falha ao excluir atributo computado.' });
    }

    deleteComputedAttributeBinding(id);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}