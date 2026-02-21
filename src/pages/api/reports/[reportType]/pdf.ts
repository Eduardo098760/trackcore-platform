import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/reports/[reportType]/pdf
 * Busca os dados do relatório via API interna e retorna um HTML imprimível
 * (o usuário abre no navegador e usa Ctrl+P → Salvar como PDF).
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

  const typeLabels: Record<string, string> = {
    trips: 'Viagens',
    stops: 'Paradas',
    events: 'Eventos',
    summary: 'Resumo',
  };
  const typeLabel = typeLabels[reportType] || reportType;

  // ── Geração do HTML por tipo ──────────────────────────────────────────────
  const buildTripsRows = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <h2>${device.deviceName}</h2>
        <div class="stats-row">
          <div class="stat-box"><span>Total de Viagens</span><strong>${device.trips?.length ?? 0}</strong></div>
          <div class="stat-box"><span>Distância Total</span><strong>${((device.totalDistance || 0) / 1000).toFixed(1)} km</strong></div>
          <div class="stat-box"><span>Velocidade Média</span><strong>${(device.averageSpeed || 0).toFixed(0)} km/h</strong></div>
        </div>
        <table>
          <thead><tr><th>Início</th><th>Endereço de Origem</th><th>Distância</th><th>Duração</th><th>Vel. Máx.</th></tr></thead>
          <tbody>
            ${(device.trips ?? []).map((t: any) => `
              <tr>
                <td>${formatDate(t.startTime)}</td>
                <td>${t.startAddress || '-'}</td>
                <td>${((t.distance || 0) / 1000).toFixed(1)} km</td>
                <td>${formatDuration(t.duration || 0)}</td>
                <td>${(t.maxSpeed || 0).toFixed(0)} km/h</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

  const buildStopsRows = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <h2>${device.deviceName}</h2>
        <div class="stats-row">
          <div class="stat-box"><span>Total de Paradas</span><strong>${device.totalStops}</strong></div>
          <div class="stat-box"><span>Tempo Total Parado</span><strong>${formatDuration(device.totalDuration || 0)}</strong></div>
        </div>
        <table>
          <thead><tr><th>Início</th><th>Endereço</th><th>Duração</th></tr></thead>
          <tbody>
            ${(device.stops ?? []).map((s: any) => `
              <tr>
                <td>${formatDate(s.startTime)}</td>
                <td>${s.address || '-'}</td>
                <td>${formatDuration(s.duration || 0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

  const buildEventsRows = (data: any[]) => `
    <table>
      <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Dispositivo</th></tr></thead>
      <tbody>
        ${data.map((e: any) => `
          <tr>
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
        ${data.map((s: any) => `
          <tr>
            <td>${s.deviceName}</td>
            <td>${((s.distance || 0) / 1000).toFixed(1)} km</td>
            <td>${(s.averageSpeed || 0).toFixed(0)} km/h</td>
            <td>${(s.maxSpeed || 0).toFixed(0)} km/h</td>
            <td>${(s.engineHours || 0).toFixed(1)} h</td>
            <td>${(s.spentFuel || 0).toFixed(1)} L</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  let bodyContent = '';
  if (reportType === 'trips') bodyContent = buildTripsRows(reportData);
  else if (reportType === 'stops') bodyContent = buildStopsRows(reportData);
  else if (reportType === 'events') bodyContent = buildEventsRows(reportData);
  else if (reportType === 'summary') bodyContent = buildSummaryRows(reportData);
  else bodyContent = `<pre>${JSON.stringify(reportData, null, 2)}</pre>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de ${typeLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
    header h1 { font-size: 20px; margin-bottom: 4px; }
    header p { color: #555; font-size: 11px; }
    .device-block { margin-bottom: 32px; }
    .device-block h2 { font-size: 15px; margin-bottom: 10px; color: #1a1a2e; border-left: 4px solid #3b82f6; padding-left: 8px; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
    .stat-box { background: #f0f4ff; border-radius: 6px; padding: 10px 16px; min-width: 130px; }
    .stat-box span { display: block; font-size: 10px; color: #666; margin-bottom: 4px; }
    .stat-box strong { font-size: 18px; color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #1d4ed8; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) td { background: #f9fafb; }
    footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #888; text-align: center; }
    @media print {
      body { padding: 0; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Relatório de ${typeLabel}</h1>
    <p>Período: ${fromLabel} até ${toLabel} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  </header>

  <div style="margin-bottom:16px">
    <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;cursor:pointer;">
      🖨 Imprimir / Salvar como PDF
    </button>
  </div>

  ${bodyContent || '<p style="color:#888;padding:24px 0">Nenhum dado encontrado para o período selecionado.</p>'}

  <footer>TrackCore Platform &nbsp;|&nbsp; Relatório de ${typeLabel} &nbsp;|&nbsp; ${fromLabel} – ${toLabel}</footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="relatorio-${reportType}-${new Date().toISOString().slice(0, 10)}.html"`
  );
  return res.status(200).send(html);
}
