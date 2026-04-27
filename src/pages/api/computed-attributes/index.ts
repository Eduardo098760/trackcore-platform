import type { NextApiRequest, NextApiResponse } from 'next';
import {
  listComputedAttributeBindings,
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
  const scope = await getRequestAccessScope(req);

  if (req.method === 'GET') {
    const response = await fetchTraccarWithSession(req, '/attributes/computed', { method: 'GET' });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(response.status).json({ error: detail || 'Falha ao carregar atributos computados.' });
    }

    const attributes = await response.json() as Array<Record<string, any>>;
    const bindings = listComputedAttributeBindings();
    const bindingByAttributeId = new Map(bindings.map((binding) => [binding.attributeId, binding]));

    if (scope.isAdmin && scope.organizationId == null) {
      return res.status(200).json(
        attributes.map((attribute) => mergeAttributeBinding(attribute, bindingByAttributeId.get(Number(attribute.id)))),
      );
    }

    const allowedIds = new Set<number>();

    for (const binding of bindings) {
      if (!canAccessComputedAttributeBinding(scope, binding)) {
        continue;
      }

      if (scope.canManageUsers) {
        allowedIds.add(binding.attributeId);
        continue;
      }

      const assignedUserIds = Array.isArray(binding.assignedUserIds) ? binding.assignedUserIds : [];
      if (assignedUserIds.length === 0 || (scope.userId != null && assignedUserIds.includes(scope.userId))) {
        allowedIds.add(binding.attributeId);
      }
    }

    return res.status(200).json(
      attributes
        .filter((attribute) => allowedIds.has(Number(attribute.id)))
        .map((attribute) => mergeAttributeBinding(attribute, bindingByAttributeId.get(Number(attribute.id)))),
    );
  }

  if (req.method === 'POST') {
    if (scope.organizationId == null && !scope.isAdmin) {
      return res.status(403).json({ error: 'Usuário sem organização vinculada não pode criar atributos computados.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const assignedUserIds = scope.canManageUsers && scope.organizationId != null && Array.isArray(body.assignedUserIds)
      ? body.assignedUserIds
      : [];
    const payload = {
      description: body.description,
      attribute: body.attribute,
      expression: body.expression,
      type: body.type,
    };

    const response = await fetchTraccarWithSession(req, '/attributes/computed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return res.status(response.status).json({ error: detail || 'Falha ao criar atributo computado.' });
    }

    const created = await response.json() as Record<string, any>;
    if (scope.organizationId != null) {
      upsertComputedAttributeBinding({
        attributeId: Number(created.id),
        organizationId: scope.organizationId,
        createdByUserId: scope.userId,
        assignedUserIds,
      });
    }

    return res.status(201).json({
      ...created,
      assignedUserIds,
      organizationId: scope.organizationId,
      createdByUserId: scope.userId,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}