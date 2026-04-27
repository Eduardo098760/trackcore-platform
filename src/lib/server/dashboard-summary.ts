import type { NextApiRequest } from "next";
import { getTenantConfig, normalizeHostname } from "@/config/tenants";
import type { DashboardStats, Device, Event, Position } from "@/types";
import type { DashboardSummaryPayload, DashboardSummarySettings } from "@/types/dashboard-summary";
import type { KPIEvaluationResult, KPIReportFrequency, KPIReportPeriod } from "@/types/kpi";
import { computeNextRunAt, evaluateKpi, resolveReportWindow, shouldDispatchSchedule } from "@/lib/kpi-engine";
import { listKpis } from "@/lib/server/kpi-store";
import { deriveDeviceStatus, getDeviceStatusLabel, getEventTypeLabel } from "@/lib/utils";
import {
  getCurrentTraccarUser,
  getTraccarDevices,
  getTraccarEvents,
  getTraccarPositions,
  getTraccarUserOrganizationId,
  getTraccarUsers,
  updateTraccarUser,
} from "@/lib/server/traccar-server";
import { applyEmailBranding, sendPlatformEmail } from "@/lib/server/email";
import { generateDashboardSummaryPdfBuffer } from "@/lib/server/dashboard-summary-report";

const ATTR_KEY = "dashboardSummarySchedule";
const TRACKED_ISSUE_TYPES = new Set([
  "deviceOverspeed",
  "speedLimit",
  "alarm",
  "lowBattery",
  "connectionLost",
  "deviceOffline",
  "deviceInactive",
  "maintenance",
]);

function getDefaultSettings(recipientEmail: string): DashboardSummarySettings {
  return {
    enabled: false,
    recipientEmail,
    frequency: "weekly",
    period: "7d",
    deliveryTime: "18:00",
    weeklyDay: 5,
    lastSentAt: null,
    nextRunAt: null,
  };
}

function normalizeSettings(raw: unknown, recipientEmail: string): DashboardSummarySettings {
  const base = getDefaultSettings(recipientEmail);
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const next: DashboardSummarySettings = {
    enabled: Boolean(input.enabled),
    recipientEmail,
    frequency: (input.frequency as KPIReportFrequency) || base.frequency,
    period: (input.period as KPIReportPeriod) || base.period,
    deliveryTime: typeof input.deliveryTime === "string" && input.deliveryTime ? input.deliveryTime : base.deliveryTime,
    weeklyDay: Number.isFinite(Number(input.weeklyDay)) ? Number(input.weeklyDay) : base.weeklyDay,
    lastSentAt: typeof input.lastSentAt === "string" ? input.lastSentAt : null,
    nextRunAt: typeof input.nextRunAt === "string" ? input.nextRunAt : null,
  };

  if (next.enabled && !next.nextRunAt) {
    next.nextRunAt = computeNextRunAt(next, new Date());
  }

  return next;
}

function mergeSettings(current: DashboardSummarySettings, patch: Partial<DashboardSummarySettings>) {
  const merged = normalizeSettings({ ...current, ...patch }, current.recipientEmail);
  if (
    patch.frequency !== undefined ||
    patch.period !== undefined ||
    patch.deliveryTime !== undefined ||
    patch.weeklyDay !== undefined ||
    patch.enabled === true
  ) {
    merged.nextRunAt = computeNextRunAt(merged, new Date());
  }
  if (patch.enabled === false) {
    merged.nextRunAt = current.nextRunAt;
  }
  return merged;
}

function resolveOrganizationId(device: Record<string, unknown>) {
  return Number((device as any).clientId ?? (device as any).attributes?.clientId ?? (device as any).attributes?.organizationId ?? NaN);
}

function filterDevicesByOrganization(devices: Device[], organizationId?: number) {
  if (organizationId == null) return devices;
  return devices.filter((device) => resolveOrganizationId(device as unknown as Record<string, unknown>) === organizationId);
}

function buildStats(devices: Device[], positions: Position[], events: Event[]): DashboardStats {
  const positionsMap = new Map(positions.map((position) => [position.deviceId, position]));
  const stats = {
    devices: {
      total: devices.length,
      online: 0,
      offline: 0,
      moving: 0,
      stopped: 0,
      blocked: 0,
    },
    activeAlerts: events.filter((event) => !event.attributes?.resolved).length,
    eventsToday: 0,
    clients: 0,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  stats.eventsToday = events.filter((event) => new Date(event.serverTime) >= today).length;

  for (const device of devices) {
    if (device.attributes?.blocked) {
      stats.devices.blocked += 1;
    }
    const status = deriveDeviceStatus(device.status, positionsMap.get(device.id), device.lastUpdate);
    if (status === "moving") stats.devices.moving += 1;
    else if (status === "stopped") stats.devices.stopped += 1;
    else if (status === "offline") stats.devices.offline += 1;
  }

  stats.devices.online = stats.devices.total - stats.devices.offline;
  return stats;
}

function getOverspeedMetrics(event: Event, device?: Device) {
  const attrs = event.attributes || {};
  const speed = attrs.speed != null ? Math.round(Number(attrs.speed) * 1.852) : null;
  const limit = attrs.limit != null
    ? Math.round(Number(attrs.limit) * 1.852)
    : attrs.speedLimit != null
      ? Math.round(Number(attrs.speedLimit) * 1.852)
      : device?.speedLimit ?? null;
  const excess = speed != null && limit != null ? speed - limit : null;

  return {
    speed,
    limit,
    excess: excess != null && excess > 0 ? excess : null,
  };
}

function buildProblemSummary(devices: Device[], positions: Position[], events: Event[]) {
  const positionsMap = new Map(positions.map((position) => [position.deviceId, position]));
  const devicesMap = new Map(devices.map((device) => [device.id, device]));
  const problemEvents = events.filter((event) => TRACKED_ISSUE_TYPES.has(event.type));

  const issueTotals = {
    totalProblems: problemEvents.length,
    vehiclesAffected: 0,
    overspeedEvents: 0,
    alarms: 0,
    batteryAlerts: 0,
    connectivityIssues: 0,
    maintenanceAlerts: 0,
  };

  const byVehicle = new Map<number, DashboardSummaryPayload["problemVehicles"][number]>();

  for (const event of problemEvents) {
    const device = devicesMap.get(event.deviceId);
    const position = positionsMap.get(event.deviceId);
    const eventLabel = getEventTypeLabel(event.type);
    const currentStatus = device
      ? getDeviceStatusLabel(deriveDeviceStatus(device.status, position, device.lastUpdate))
      : "Sem status";

    const existing = byVehicle.get(event.deviceId) || {
      deviceId: event.deviceId,
      name: device?.name || `Veículo #${event.deviceId}`,
      plate: device?.plate || device?.name || `#${event.deviceId}`,
      currentStatus,
      issueCount: 0,
      overspeedCount: 0,
      alarmCount: 0,
      batteryCount: 0,
      connectivityCount: 0,
      maintenanceCount: 0,
      lastIssueAt: event.serverTime,
      issueLabels: [],
      latestIssueLabel: eventLabel,
      maxRecordedSpeed: null,
      maxAllowedSpeed: null,
      maxExcessSpeed: null,
    };

    existing.issueCount += 1;
    existing.currentStatus = currentStatus;
    if (!existing.issueLabels.includes(eventLabel)) {
      existing.issueLabels.push(eventLabel);
    }
    if (new Date(event.serverTime).getTime() >= new Date(existing.lastIssueAt).getTime()) {
      existing.lastIssueAt = event.serverTime;
      existing.latestIssueLabel = eventLabel;
    }

    if (event.type === "deviceOverspeed" || event.type === "speedLimit") {
      issueTotals.overspeedEvents += 1;
      existing.overspeedCount += 1;
      const metrics = getOverspeedMetrics(event, device);
      if ((metrics.speed ?? 0) > (existing.maxRecordedSpeed ?? 0)) {
        existing.maxRecordedSpeed = metrics.speed;
      }
      if ((metrics.limit ?? 0) > (existing.maxAllowedSpeed ?? 0)) {
        existing.maxAllowedSpeed = metrics.limit;
      }
      if ((metrics.excess ?? 0) > (existing.maxExcessSpeed ?? 0)) {
        existing.maxExcessSpeed = metrics.excess;
      }
    } else if (event.type === "alarm") {
      issueTotals.alarms += 1;
      existing.alarmCount += 1;
    } else if (event.type === "lowBattery") {
      issueTotals.batteryAlerts += 1;
      existing.batteryCount += 1;
    } else if (
      event.type === "connectionLost" ||
      event.type === "deviceOffline" ||
      event.type === "deviceInactive"
    ) {
      issueTotals.connectivityIssues += 1;
      existing.connectivityCount += 1;
    } else if (event.type === "maintenance") {
      issueTotals.maintenanceAlerts += 1;
      existing.maintenanceCount += 1;
    }

    byVehicle.set(event.deviceId, existing);
  }

  const problemVehicles = Array.from(byVehicle.values()).sort((left, right) => {
    if (right.issueCount !== left.issueCount) {
      return right.issueCount - left.issueCount;
    }
    if (right.overspeedCount !== left.overspeedCount) {
      return right.overspeedCount - left.overspeedCount;
    }
    return new Date(right.lastIssueAt).getTime() - new Date(left.lastIssueAt).getTime();
  });

  issueTotals.vehiclesAffected = problemVehicles.length;
  return {
    issueTotals,
    problemVehicles,
  };
}

function buildEmailContent(payload: DashboardSummaryPayload, settings: DashboardSummarySettings) {
  const stats = payload.stats;
  const topProblemVehicles = payload.problemVehicles.slice(0, 12);
  const overspeedHighlights = payload.problemVehicles.filter((vehicle) => vehicle.overspeedCount > 0).slice(0, 8);
  const kpisHtml = payload.customKpis.length
    ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Indicador</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Valor</th>
            <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Base</th>
          </tr>
        </thead>
        <tbody>
          ${payload.customKpis
            .map(
              (item) => `<tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${item.label}</td>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${item.value}</td>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${item.basis}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    : `<p style="margin-top:16px;color:#64748b;">Nenhum KPI personalizado habilitado na dashboard para compor este resumo.</p>`;

  const incidentCards = `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;">
      <div style="padding:14px;border-radius:14px;background:#fff7ed;">
        <div style="font-size:12px;color:#c2410c;">Excesso de velocidade</div>
        <div style="font-size:24px;font-weight:700;">${payload.issueTotals.overspeedEvents}</div>
        <div style="font-size:12px;color:#9a3412;">ocorrências em ${payload.periodLabel.toLowerCase()}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:#fef2f2;">
        <div style="font-size:12px;color:#b91c1c;">Veículos com problema</div>
        <div style="font-size:24px;font-weight:700;">${payload.issueTotals.vehiclesAffected}</div>
        <div style="font-size:12px;color:#991b1b;">unidades com incidência no período</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:#eff6ff;">
        <div style="font-size:12px;color:#1d4ed8;">Problemas totais</div>
        <div style="font-size:24px;font-weight:700;">${payload.issueTotals.totalProblems}</div>
        <div style="font-size:12px;color:#1e40af;">alarmes, bateria, conexão, manutenção e velocidade</div>
      </div>
    </div>
  `;

  const overspeedHtml = overspeedHighlights.length > 0
    ? `
      <div style="margin-top:20px;">
        <h3 style="margin:0 0 10px;font-size:16px;">Veículos com excesso de velocidade</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Veículo</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Ocorrências</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Pico</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Maior excesso</th>
            </tr>
          </thead>
          <tbody>
            ${overspeedHighlights
              .map(
                (vehicle) => `<tr>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;"><strong>${vehicle.plate}</strong><br><span style="font-size:12px;color:#64748b;">${vehicle.name}</span></td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${vehicle.overspeedCount}</td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${vehicle.maxRecordedSpeed ?? "-"} km/h</td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${vehicle.maxExcessSpeed != null ? `+${vehicle.maxExcessSpeed} km/h` : "-"}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p style="margin-top:20px;color:#047857;">Não houve registros de excesso de velocidade em ${payload.periodLabel.toLowerCase()}.</p>`;

  const problemsHtml = topProblemVehicles.length > 0
    ? `
      <div style="margin-top:20px;">
        <h3 style="margin:0 0 10px;font-size:16px;">Veículos que tiveram problemas no período</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Veículo</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Problemas</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Tipos</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Última ocorrência</th>
            </tr>
          </thead>
          <tbody>
            ${topProblemVehicles
              .map(
                (vehicle) => `<tr>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;"><strong>${vehicle.plate}</strong><br><span style="font-size:12px;color:#64748b;">${vehicle.name} • ${vehicle.currentStatus}</span></td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${vehicle.issueCount}</td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">${vehicle.issueLabels.join(", ")}</td>
                  <td style="padding:10px;border-bottom:1px solid #f1f5f9;">${new Date(vehicle.lastIssueAt).toLocaleString("pt-BR")}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p style="margin-top:20px;color:#047857;">Nenhum veículo apresentou problemas críticos em ${payload.periodLabel.toLowerCase()}.</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h2 style="margin:0 0 8px;">Resumo Programado da Dashboard</h2>
      <p style="margin:0 0 16px;color:#475569;">Período analisado: <strong>${payload.periodLabel}</strong></p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <div style="padding:14px;border-radius:14px;background:#eff6ff;">
          <div style="font-size:12px;color:#1d4ed8;">Veículos</div>
          <div style="font-size:28px;font-weight:700;">${stats.devices.total}</div>
          <div style="font-size:12px;color:#1e40af;">${stats.devices.online} online, ${stats.devices.offline} offline</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:#ecfdf5;">
          <div style="font-size:12px;color:#047857;">Operação</div>
          <div style="font-size:28px;font-weight:700;">${stats.devices.moving}</div>
          <div style="font-size:12px;color:#047857;">em movimento, ${stats.devices.stopped} parados</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:#fff7ed;">
          <div style="font-size:12px;color:#c2410c;">Alertas ativos</div>
          <div style="font-size:28px;font-weight:700;">${stats.activeAlerts}</div>
          <div style="font-size:12px;color:#9a3412;">pendências visíveis na dashboard</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:#f5f3ff;">
          <div style="font-size:12px;color:#6d28d9;">Eventos hoje</div>
          <div style="font-size:28px;font-weight:700;">${stats.eventsToday}</div>
          <div style="font-size:12px;color:#5b21b6;">email programado para ${settings.recipientEmail}</div>
        </div>
      </div>
      ${incidentCards}
      ${overspeedHtml}
      ${problemsHtml}
      ${kpisHtml}
      <p style="margin-top:20px;font-size:12px;color:#64748b;">Gerado em ${new Date(payload.generatedAt).toLocaleString("pt-BR")}.</p>
    </div>
  `;

  const text = [
    "Resumo Programado da Dashboard",
    "O relatório completo também segue anexado em PDF.",
    `Período analisado: ${payload.periodLabel}`,
    `Veículos: ${stats.devices.total}`,
    `Online: ${stats.devices.online} | Offline: ${stats.devices.offline}`,
    `Em movimento: ${stats.devices.moving} | Parados: ${stats.devices.stopped}`,
    `Alertas ativos: ${stats.activeAlerts}`,
    `Eventos hoje: ${stats.eventsToday}`,
    `Excesso de velocidade no período: ${payload.issueTotals.overspeedEvents}`,
    `Veículos com problemas no período: ${payload.issueTotals.vehiclesAffected}`,
    `Problemas totais no período: ${payload.issueTotals.totalProblems}`,
    payload.issueTotals.overspeedEvents > 0 ? "Veículos com excesso de velocidade:" : "Sem excesso de velocidade no período.",
    ...payload.problemVehicles
      .filter((item) => item.overspeedCount > 0)
      .slice(0, 8)
      .map((item) => `- ${item.plate}: ${item.overspeedCount} ocorrência(s), pico ${item.maxRecordedSpeed ?? "-"} km/h, maior excesso ${item.maxExcessSpeed != null ? `+${item.maxExcessSpeed} km/h` : "-"}`),
    payload.problemVehicles.length > 0 ? "Veículos com problemas:" : "Sem veículos com problemas críticos no período.",
    ...payload.problemVehicles
      .slice(0, 12)
      .map((item) => `- ${item.plate}: ${item.issueCount} problema(s) | ${item.issueLabels.join(", ")} | última ocorrência ${new Date(item.lastIssueAt).toLocaleString("pt-BR")}`),
    payload.customKpis.length > 0 ? "KPIs personalizados:" : "Nenhum KPI personalizado habilitado na dashboard.",
    ...payload.customKpis.map((item) => `- ${item.label}: ${item.value} (${item.basis})`),
  ].join("\n");

  return {
    subject: `Resumo da Dashboard • ${payload.periodLabel}`,
    text,
    html,
  };
}

export async function getCurrentDashboardSummarySettings(req: Pick<NextApiRequest, "headers">) {
  const user = await getCurrentTraccarUser(req);
  const recipientEmail = String(user.email || "").trim();
  const settings = normalizeSettings(user.attributes?.[ATTR_KEY], recipientEmail);
  return {
    user,
    settings,
    organizationId: getTraccarUserOrganizationId(user),
  };
}

export async function saveCurrentDashboardSummarySettings(req: Pick<NextApiRequest, "headers">, patch: Partial<DashboardSummarySettings>) {
  const { user, settings } = await getCurrentDashboardSummarySettings(req);
  if ((patch.enabled === true || settings.enabled) && !settings.recipientEmail && !String(user.email || "").trim()) {
    throw new Error("Sua conta precisa ter um email cadastrado antes de habilitar o resumo programado.");
  }
  const nextSettings = mergeSettings(settings, patch);

  if (nextSettings.enabled && !nextSettings.recipientEmail) {
    throw new Error("Sua conta precisa ter um email cadastrado antes de habilitar o resumo programado.");
  }

  await updateTraccarUser(
    user.id,
    {
      ...user,
      attributes: {
        ...(user.attributes || {}),
        [ATTR_KEY]: nextSettings,
      },
    },
    req,
  );

  return nextSettings;
}

async function buildDashboardSummaryPayload(
  req: Pick<NextApiRequest, "headers"> | undefined,
  organizationId: number | undefined,
  settings: DashboardSummarySettings,
) {
  const devices = filterDevicesByOrganization(await getTraccarDevices(req) as unknown as Device[], organizationId);
  const positions = await getTraccarPositions(req) as unknown as Position[];
  const periodWindow = resolveReportWindow(settings.period);
  const events = devices.length > 0
    ? await getTraccarEvents({ deviceIds: devices.map((device) => device.id), from: periodWindow.from, to: periodWindow.to }, req) as unknown as Event[]
    : [];

  const stats = buildStats(
    devices,
    positions.filter((position) => devices.some((device) => device.id === position.deviceId)),
    events,
  );

  const customKpis = listKpis(organizationId)
    .filter((kpi) => kpi.enabledOnDashboard !== false)
    .map((kpi) =>
      evaluateKpi(kpi, {
        devices,
        positions: positions.filter((position) => devices.some((device) => device.id === position.deviceId)),
        events,
      }),
    );

  const { issueTotals, problemVehicles } = buildProblemSummary(
    devices,
    positions.filter((position) => devices.some((device) => device.id === position.deviceId)),
    events,
  );

  return {
    stats,
    customKpis,
    issueTotals,
    problemVehicles,
    periodLabel: periodWindow.label,
    generatedAt: new Date().toISOString(),
  } satisfies DashboardSummaryPayload;
}

async function persistUserSettings(
  user: Record<string, unknown>,
  nextSettings: DashboardSummarySettings,
  req?: Pick<NextApiRequest, "headers">,
) {
  await updateTraccarUser(
    Number(user.id),
    {
      ...user,
      attributes: {
        ...(((user.attributes as Record<string, unknown> | undefined) || {})),
        [ATTR_KEY]: nextSettings,
      },
    },
    req,
  );
}

export async function dispatchDashboardSummaries(
  req: Pick<NextApiRequest, "headers"> | undefined,
  input?: { force?: boolean; currentUserOnly?: boolean },
) {
  const force = Boolean(input?.force);
  const currentUserOnly = Boolean(input?.currentUserOnly);

  const users = currentUserOnly
    ? [await getCurrentTraccarUser(req)]
    : await getTraccarUsers(req);

  const payloadCache = new Map<string, DashboardSummaryPayload>();
  const results: Array<{ userId: number; email: string; status: "sent" | "skipped" | "error"; message?: string }> = [];

  for (const user of users) {
    const recipientEmail = String(user.email || "").trim();
    const settings = normalizeSettings(user.attributes?.[ATTR_KEY], recipientEmail);

    if (!recipientEmail) {
      if (currentUserOnly) {
        results.push({ userId: user.id, email: "", status: "error", message: "Sua conta precisa ter um email cadastrado para receber o resumo." });
      }
      continue;
    }

    if (!force && (!settings.enabled || !shouldDispatchSchedule(settings))) {
      results.push({
        userId: user.id,
        email: recipientEmail,
        status: "skipped",
        message: settings.enabled ? "Agendamento ainda não está vencido." : "Resumo ainda não foi habilitado nesta conta.",
      });
      continue;
    }

    try {
      const organizationId = getTraccarUserOrganizationId(user);
      const cacheKey = `${organizationId ?? "global"}:${settings.period}`;
      let payload = payloadCache.get(cacheKey);
      if (!payload) {
        payload = await buildDashboardSummaryPayload(req, organizationId, settings);
        payloadCache.set(cacheKey, payload);
      }

      const message = buildEmailContent(payload, settings);
      const tenantName = getTenantConfig(normalizeHostname(String(req?.headers?.host || ""))).companyName;
      const pdfBuffer = generateDashboardSummaryPdfBuffer({
        payload,
        recipientEmail,
        tenantName,
      });
      await sendPlatformEmail(
        {
          to: recipientEmail,
          subject: message.subject,
          text: message.text,
          html: applyEmailBranding(message.html, req),
          attachments: [
            {
              filename: `resumo-dashboard-${payload.periodLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        },
        req,
      );

      const nextSettings = {
        ...settings,
        lastSentAt: new Date().toISOString(),
        nextRunAt: computeNextRunAt(settings, new Date()),
      };
      await persistUserSettings(user as unknown as Record<string, unknown>, nextSettings, req);

      results.push({ userId: user.id, email: recipientEmail, status: "sent" });
    } catch (error: any) {
      results.push({
        userId: user.id,
        email: recipientEmail,
        status: "error",
        message: error?.message || "Falha ao enviar resumo da dashboard.",
      });
    }
  }

  return {
    sent: results.filter((item) => item.status === "sent").length,
    results,
  };
}
