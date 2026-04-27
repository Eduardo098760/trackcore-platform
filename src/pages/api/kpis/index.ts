import type { NextApiRequest, NextApiResponse } from 'next';
import { createKpi, listKpis } from '@/lib/server/kpi-store';
import { computeNextRunAt } from '@/lib/kpi-engine';
import { getRequestAccessScope } from '@/lib/server/request-access';
import type { KPI } from '@/types/kpi';

function parseOrganizationId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const scope = await getRequestAccessScope(req);

  if (req.method === 'GET') {
    const requestedOrganizationId = parseOrganizationId(req.query.organizationId);
    const organizationId = scope.isAdmin && scope.organizationId == null
      ? requestedOrganizationId
      : scope.organizationId;

    if (!scope.isAdmin && organizationId == null) {
      return res.status(403).json({ error: 'Organização não identificada para listar KPIs.' });
    }

    return res.status(200).json({ kpis: listKpis(organizationId) });
  }

  if (req.method === 'POST') {
    const body = req.body as Partial<KPI>;
    if (!body?.name || !body?.sensorKey) {
      return res.status(400).json({ error: 'name e sensorKey são obrigatórios' });
    }

    const targetOrganizationId = scope.organizationId ?? body.organizationId;
    if (targetOrganizationId == null && !scope.isAdmin) {
      return res.status(403).json({ error: 'Organização não identificada para criar KPI.' });
    }

    if (!scope.isAdmin && body.organizationId != null && body.organizationId !== scope.organizationId) {
      return res.status(403).json({ error: 'Não é permitido criar KPI em outra organização.' });
    }

    const reportSchedule = body.reportSchedule
      ? {
          ...body.reportSchedule,
          nextRunAt: body.reportSchedule.nextRunAt || computeNextRunAt(body.reportSchedule),
        }
      : null;

    const created = createKpi({
      name: body.name,
      organizationId: targetOrganizationId,
      computedAttributeId: body.computedAttributeId,
      attributeName: body.attributeName,
      sensorKey: body.sensorKey,
      sensorLabel: body.sensorLabel || body.name,
      sensorType: body.sensorType || 'number',
      source: body.source || 'auto',
      aggregation: body.aggregation || 'count',
      filter: body.filter || '',
      period: body.period || '24h',
      unit: body.unit || '',
      enabledOnDashboard: body.enabledOnDashboard ?? true,
      reportSchedule,
      chart: body.chart || 'card',
      groupBy: body.groupBy || 'vehicle',
      customPeriod: body.customPeriod,
    });

    return res.status(201).json(created);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}