import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getTenantConfig } from '@/config/tenants';

/**
 * POST /api/reports/[reportType]/pdf
 * Busca os dados do relatório via API interna e retorna um HTML imprimível
 * com design profissional e branding do tenant.
 * Suporta: trips | stops | events | summary
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { reportType } = req.query as { reportType: string };
  const { deviceIds, from, to } = req.body;

  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ message: 'deviceIds is required' });
  }
  if (!from || !to) {
    return res.status(400).json({ message: 'from and to dates are required' });
  }

  // Tenant branding
  const hostname = req.headers.host?.split(':')[0] || '';
  const tenant = getTenantConfig(hostname);
  const companyName = tenant.companyName;

  // Carregar logo como base64 para embutir no HTML
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logos', 'rastrear-icone-light.png');
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    // Logo não encontrado — continua sem logo
  }

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const baseUrl = `${proto}://${host}`;

  // Buscar dados via endpoint interno já existente
  const dataEndpoint = `${baseUrl}/api/reports/${reportType}`;
  let reportData: any[] = [];

  try {
    const dataRes = await fetch(dataEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
      },
      body: JSON.stringify({ deviceIds, from, to }),
    });

    if (dataRes.ok) {
      reportData = await dataRes.json();
    } else {
      const err = await dataRes.text().catch(() => '');
      console.error(`[PDF Export] Falha ao buscar dados (${dataRes.status}):`, err);
    }
  } catch (e: any) {
    console.error('[PDF Export] Erro ao buscar dados:', e.message);
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const fromLabel = formatDate(from);
  const toLabel = formatDate(to);
  const generatedAt = new Date().toLocaleString('pt-BR');

  const typeLabels: Record<string, string> = {
    trips: 'Viagens',
    stops: 'Paradas',
    events: 'Eventos',
    summary: 'Resumo',
  };
  const typeLabel = typeLabels[reportType] || reportType;

  const typeIcons: Record<string, string> = {
    trips: '&#xe558;',  // directions_car
    stops: '&#xe55f;',  // location_on
    events: '&#xe8b5;', // notification_important
    summary: '&#xe24b;', // assessment
  };

  // ── Geração do HTML por tipo ──────────────────────────────────────────────
  const buildTripsRows = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <div class="device-header">
          <div class="device-icon">&#xe558;</div>
          <h2>${device.deviceName}</h2>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-label">Total de Viagens</div>
            <div class="stat-value">${device.trips?.length ?? 0}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Distância Total</div>
            <div class="stat-value">${((device.totalDistance || 0) / 1000).toFixed(1)} <small>km</small></div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Velocidade Média</div>
            <div class="stat-value">${(device.averageSpeed || 0).toFixed(0)} <small>km/h</small></div>
          </div>
        </div>
        <table>
          <thead><tr><th>Início</th><th>Endereço de Origem</th><th>Distância</th><th>Duração</th><th>Vel. Máx.</th></tr></thead>
          <tbody>
            ${(device.trips ?? []).map((t: any, i: number) => `
              <tr class="${i % 2 === 1 ? 'alt' : ''}">
                <td>${formatDate(t.startTime)}</td>
                <td>${t.startAddress || '-'}</td>
                <td class="num">${((t.distance || 0) / 1000).toFixed(1)} km</td>
                <td class="num">${formatDuration(t.duration || 0)}</td>
                <td class="num">${(t.maxSpeed || 0).toFixed(0)} km/h</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

  const buildStopsRows = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <div class="device-header">
          <div class="device-icon">&#xe55f;</div>
          <h2>${device.deviceName}</h2>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-label">Total de Paradas</div>
            <div class="stat-value">${device.totalStops}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Tempo Total Parado</div>
            <div class="stat-value">${formatDuration(device.totalDuration || 0)}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Início</th><th>Endereço</th><th>Duração</th></tr></thead>
          <tbody>
            ${(device.stops ?? []).map((s: any, i: number) => `
              <tr class="${i % 2 === 1 ? 'alt' : ''}">
                <td>${formatDate(s.startTime)}</td>
                <td>${s.address || '-'}</td>
                <td class="num">${formatDuration(s.duration || 0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

  const buildEventsRows = (data: any[]) => `
    <table>
      <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Dispositivo</th></tr></thead>
      <tbody>
        ${data.map((e: any, i: number) => `
          <tr class="${i % 2 === 1 ? 'alt' : ''}">
            <td>${formatDate(e.serverTime)}</td>
            <td>${e.type || '-'}</td>
            <td>${e.deviceId || '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  const buildSummaryRows = (data: any[]) => `
    <table>
      <thead><tr><th>Veículo</th><th>Distância</th><th>Vel. Média</th><th>Vel. Máxima</th><th>Horas Motor</th><th>Combustível</th></tr></thead>
      <tbody>
        ${data.map((s: any, i: number) => `
          <tr class="${i % 2 === 1 ? 'alt' : ''}">
            <td><strong>${s.deviceName}</strong></td>
            <td class="num">${((s.distance || 0) / 1000).toFixed(1)} km</td>
            <td class="num">${(s.averageSpeed || 0).toFixed(0)} km/h</td>
            <td class="num">${(s.maxSpeed || 0).toFixed(0)} km/h</td>
            <td class="num">${(s.engineHours || 0).toFixed(1)} h</td>
            <td class="num">${(s.spentFuel || 0).toFixed(1)} L</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  let bodyContent = '';
  if (reportType === 'trips') bodyContent = buildTripsRows(reportData);
  else if (reportType === 'stops') bodyContent = buildStopsRows(reportData);
  else if (reportType === 'events') bodyContent = buildEventsRows(reportData);
  else if (reportType === 'summary') bodyContent = buildSummaryRows(reportData);
  else bodyContent = `<pre>${JSON.stringify(reportData, null, 2)}</pre>`;

  const totalDevices = reportData.length;

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${companyName}" class="logo" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} — Relatório de ${typeLabel}</title>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 20mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: #fff;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ───────────────────────────────── */
    .report-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%);
      color: #fff;
      padding: 28px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 0 0 12px 12px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .report-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255,255,255,0.03);
      border-radius: 50%;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1;
    }
    .logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      padding: 6px;
    }
    .header-brand h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 2px;
    }
    .header-brand .subtitle {
      font-size: 11px;
      opacity: 0.75;
      font-weight: 400;
    }
    .header-right {
      text-align: right;
      z-index: 1;
    }
    .report-type-badge {
      display: inline-block;
      background: rgba(255,255,255,0.18);
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 6px;
      backdrop-filter: blur(4px);
    }
    .header-meta {
      font-size: 10px;
      opacity: 0.7;
      line-height: 1.6;
    }

    /* ── Print Button ─────────────────────────── */
    .print-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      margin-bottom: 20px;
    }
    .print-btn {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(29,78,216,0.3);
      transition: all 0.2s;
    }
    .print-btn:hover {
      background: linear-gradient(135deg, #1e40af, #1d4ed8);
      box-shadow: 0 4px 12px rgba(29,78,216,0.4);
    }
    .print-summary {
      font-size: 11px;
      color: #64748b;
    }

    /* ── Content Area ─────────────────────────── */
    .content {
      padding: 0 32px;
    }

    /* ── Device Block ─────────────────────────── */
    .device-block {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .device-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .device-icon {
      font-family: 'Material Icons';
      font-size: 20px;
      color: #fff;
      background: linear-gradient(135deg, #1d4ed8, #3b82f6);
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .device-block h2 {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.2px;
    }

    /* ── Stats ────────────────────────────────── */
    .stats-row {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
      min-width: 140px;
      flex: 1;
    }
    .stat-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #1d4ed8;
      line-height: 1.2;
    }
    .stat-value small {
      font-size: 11px;
      font-weight: 500;
      color: #64748b;
    }

    /* ── Tables ───────────────────────────────── */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 4px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    thead tr {
      background: linear-gradient(135deg, #0f172a, #1e293b);
    }
    th {
      color: #fff;
      padding: 9px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 8px 12px;
      font-size: 11px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }
    td.num {
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    tr.alt td {
      background: #f8fafc;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }

    /* ── Footer ───────────────────────────────── */
    .report-footer {
      margin-top: 32px;
      padding: 16px 32px;
      border-top: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 9px;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-logo {
      width: 20px;
      height: 20px;
      object-fit: contain;
      opacity: 0.5;
    }
    .footer-center {
      text-align: center;
      line-height: 1.5;
    }
    .footer-right {
      text-align: right;
    }
    .confidential {
      display: inline-block;
      background: #f1f5f9;
      color: #64748b;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Empty State ──────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #94a3b8;
    }
    .empty-state .icon {
      font-family: 'Material Icons';
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.3;
    }

    /* ── Print overrides ─────────────────────── */
    @media print {
      .print-bar { display: none !important; }
      .report-header {
        border-radius: 0;
        margin-bottom: 16px;
        padding: 20px 24px;
      }
      .content { padding: 0 16px; }
      .report-footer { padding: 12px 16px; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="report-header">
    <div class="header-left">
      ${logoHtml}
      <div class="header-brand">
        <h1>${companyName}</h1>
        <div class="subtitle">Plataforma de Rastreamento Veicular</div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-type-badge">Relatório de ${typeLabel}</div>
      <div class="header-meta">
        Período: ${fromLabel} — ${toLabel}<br>
        Gerado em: ${generatedAt}
      </div>
    </div>
  </div>

  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">
      <span class="material-icons" style="font-size:18px">print</span>
      Imprimir / Salvar como PDF
    </button>
    <div class="print-summary">${totalDevices} veículo${totalDevices !== 1 ? 's' : ''} no relatório</div>
  </div>

  <div class="content">
    ${bodyContent || `
      <div class="empty-state">
        <div class="icon">&#xe88e;</div>
        <p>Nenhum dado encontrado para o período selecionado.</p>
      </div>`}
  </div>

  <div class="report-footer">
    <div class="footer-left">
      ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo" />` : ''}
      <span>${companyName}</span>
    </div>
    <div class="footer-center">
      <span class="confidential">Documento confidencial</span><br>
      Relatório de ${typeLabel} &nbsp;·&nbsp; ${fromLabel} — ${toLabel}
    </div>
    <div class="footer-right">
      ${generatedAt}
    </div>
  </div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="relatorio-${reportType}-${new Date().toISOString().slice(0, 10)}.html"`
  );
  return res.status(200).send(html);
}
