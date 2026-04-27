import type { NextApiRequest, NextApiResponse } from 'next';
import type { Device, Event, Position } from '@/types';
import type { KPI } from '@/types/kpi';
import {
  computeNextRunAt,
  evaluateKpi,
  getFrequencyLabel,
  resolveReportWindow,
  shouldDispatchSchedule,
} from '@/lib/kpi-engine';
import { listKpis, saveKpis } from '@/lib/server/kpi-store';
import { buildKpiReportEmail, generateKpiPdfBuffer } from '@/lib/server/kpi-report';
import { applyEmailBranding, sendPlatformEmail } from '@/lib/server/email';
import { getRequestAccessScope } from '@/lib/server/request-access';
import { getTraccarDevices, getTraccarEvents, getTraccarPositions } from '@/lib/server/traccar-server';

function resolveOrganizationId(device: Record<string, any>) {
  return device.clientId ?? device.attributes?.clientId ?? device.attributes?.organizationId ?? null;
}

function filterDevicesByOrganization(devices: Record<string, any>[], organizationId?: number) {
  if (organizationId == null) return devices;
  return devices.filter((device) => Number(resolveOrganizationId(device)) === organizationId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const scope = await getRequestAccessScope(req);
  const { kpiId, force = false } = req.body || {};
  const organizationId = scope.isAdmin && scope.organizationId == null
    ? req.body?.organizationId
    : scope.organizationId;

  if (!scope.isAdmin && organizationId == null) {
    return res.status(403).json({ error: 'Organização não identificada para disparar relatórios.' });
  }

  const candidates = listKpis(organizationId)
    .filter((kpi) => !kpiId || kpi.id === kpiId)
    .filter((kpi) => kpi.reportSchedule?.enabled);

  if (candidates.length === 0) {
    return res.status(200).json({ sent: 0, results: [] });
  }

  const allDevices = filterDevicesByOrganization(await getTraccarDevices(req), organizationId) as unknown as Device[];
  const positions = await getTraccarPositions(req) as unknown as Position[];

  const touchedKpis = new Map<string, KPI>();
  const results: Array<{
    kpiId: string;
    name: string;
    recipients: string[];
    status: 'sent' | 'skipped' | 'error';
    message?: string;
  }> = [];

  for (const kpi of candidates) {
    const schedule = kpi.reportSchedule;
    if (!schedule) continue;

    if (!force && !shouldDispatchSchedule(schedule)) {
      results.push({
        kpiId: kpi.id,
        name: kpi.name,
        recipients: schedule.recipients,
        status: 'skipped',
        message: 'Agendamento ainda não está vencido.',
      });
      continue;
    }

    try {
      const scopedDevices = kpi.organizationId == null
        ? allDevices
        : allDevices.filter((device) => Number(resolveOrganizationId(device as any)) === kpi.organizationId);
      const scopedDeviceIds = scopedDevices.map((device) => device.id);
      const reportWindow = resolveReportWindow(schedule.period);
      const scopedEvents = scopedDeviceIds.length > 0
        ? await getTraccarEvents({ deviceIds: scopedDeviceIds, from: reportWindow.from, to: reportWindow.to }, req) as unknown as Event[]
        : [];

      const result = evaluateKpi(kpi, {
        devices: scopedDevices,
        positions: positions.filter((position) => scopedDeviceIds.includes(position.deviceId)),
        events: scopedEvents,
      });

      const emailMessage = buildKpiReportEmail({
        kpi,
        result,
        periodLabel: reportWindow.label,
        customMessage: schedule.customMessage,
      });

      const attachments = schedule.sendPdf
        ? [
            {
              filename: `${kpi.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-relatorio.pdf`,
              content: generateKpiPdfBuffer({ kpi, result, periodLabel: reportWindow.label }),
              contentType: 'application/pdf',
            },
          ]
        : undefined;

      await sendPlatformEmail(
        {
          to: schedule.recipients.join(', '),
          subject: schedule.subject?.trim() || `${emailMessage.subject} • ${getFrequencyLabel(schedule.frequency)}`,
          text: emailMessage.text,
          html: applyEmailBranding(emailMessage.html, req),
          attachments,
        },
        req,
      );

      const updatedKpi: KPI = {
        ...kpi,
        reportSchedule: {
          ...schedule,
          lastSentAt: new Date().toISOString(),
          nextRunAt: computeNextRunAt(schedule, new Date()),
        },
      };

      touchedKpis.set(kpi.id, updatedKpi);
      results.push({
        kpiId: kpi.id,
        name: kpi.name,
        recipients: schedule.recipients,
        status: 'sent',
      });
    } catch (error: any) {
      results.push({
        kpiId: kpi.id,
        name: kpi.name,
        recipients: schedule.recipients,
        status: 'error',
        message: error?.message || 'Falha no envio do relatório.',
      });
    }
  }

  if (touchedKpis.size > 0) {
    const allKpis = listKpis();
    saveKpis(allKpis.map((kpi) => touchedKpis.get(kpi.id) || kpi));
  }

  return res.status(200).json({
    sent: results.filter((item) => item.status === 'sent').length,
    results,
  });
}