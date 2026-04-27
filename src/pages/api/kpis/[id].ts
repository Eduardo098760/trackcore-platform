import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteKpi, getKpi, updateKpi } from '@/lib/server/kpi-store';
import { computeNextRunAt } from '@/lib/kpi-engine';
import { ensureOrganizationAccess, getRequestAccessScope } from '@/lib/server/request-access';
import type { KPI } from '@/types/kpi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const scope = await getRequestAccessScope(req);
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'id é obrigatório' });
  }

  if (req.method === 'GET') {
    const item = getKpi(id);
    if (!item) return res.status(404).json({ error: 'KPI não encontrado' });
    if (!ensureOrganizationAccess(scope, item.organizationId)) {
      return res.status(403).json({ error: 'Acesso negado a KPI de outra organização.' });
    }
    return res.status(200).json(item);
  }

  if (req.method === 'PUT') {
    const current = getKpi(id);
    if (!current) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }
    if (!ensureOrganizationAccess(scope, current.organizationId)) {
      return res.status(403).json({ error: 'Acesso negado a KPI de outra organização.' });
    }

    const body = req.body as Partial<KPI>;
    if (!scope.isAdmin && body.organizationId != null && body.organizationId !== current.organizationId) {
      return res.status(403).json({ error: 'Não é permitido mover KPI para outra organização.' });
    }
    const reportSchedule = body.reportSchedule
      ? {
          ...body.reportSchedule,
          nextRunAt: body.reportSchedule.nextRunAt || computeNextRunAt(body.reportSchedule),
        }
      : body.reportSchedule === null
        ? null
        : undefined;

    const updated = updateKpi(id, {
      ...body,
      reportSchedule,
    });

    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const current = getKpi(id);
    if (!current) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }
    if (!ensureOrganizationAccess(scope, current.organizationId)) {
      return res.status(403).json({ error: 'Acesso negado a KPI de outra organização.' });
    }

    const deleted = deleteKpi(id);
    if (!deleted) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}