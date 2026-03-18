import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getTenantConfig } from '@/config/tenants';

/**
 * POST /api/reports/[reportType]/pdf
 * Gera um HTML imprimivel com design profissional e branding do tenant.
 * Suporta: combined | trips | stops | events | summary | route | chart | geofence | ignition | fuel
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

  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logos', 'rastrear-icone-light.png');
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch { /* sem logo */ }

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const baseUrl = `${proto}://${host}`;
  const cookie = req.headers.cookie || '';

  // ---- Helpers de fetch ----
  const fetchJSON = async (url: string, body?: any): Promise<any> => {
    try {
      const opts: RequestInit = {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Accept: 'application/json' },
      };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      if (!r.ok) { console.error(`[PDF] ${url} -> ${r.status}`); return null; }
      return r.json();
    } catch (e: any) {
      console.error(`[PDF] ${url} erro:`, e.message);
      return null;
    }
  };

  const fetchReport = async (endpoint: string): Promise<any[]> => {
    const data = await fetchJSON(`${baseUrl}/api/reports/${endpoint}`, { deviceIds, from, to });
    return Array.isArray(data) ? data : [];
  };

  // positions (route) usa deviceId singular
  const fetchPositions = async (): Promise<any[]> => {
    const all: any[] = [];
    for (const did of deviceIds) {
      const data = await fetchJSON(`${baseUrl}/api/reports/positions`, { deviceId: did, from, to });
      if (Array.isArray(data)) all.push(...data);
    }
    return all;
  };

  // ---- Buscar dados ----
  let tripsData: any[] = [];
  let stopsData: any[] = [];
  let eventsData: any[] = [];
  let summaryData: any[] = [];
  let routeData: any[] = [];
  const isCombined = reportType === 'combined';

  if (isCombined) {
    [summaryData, tripsData, stopsData, eventsData] = await Promise.all([
      fetchReport('summary'), fetchReport('trips'), fetchReport('stops'), fetchReport('events'),
    ]);
  } else if (reportType === 'trips') {
    tripsData = await fetchReport('trips');
  } else if (reportType === 'stops') {
    stopsData = await fetchReport('stops');
  } else if (reportType === 'events') {
    eventsData = await fetchReport('events');
  } else if (reportType === 'summary') {
    summaryData = await fetchReport('summary');
  } else if (reportType === 'route' || reportType === 'chart') {
    routeData = await fetchPositions();
  } else if (reportType === 'geofence') {
    eventsData = (await fetchReport('events')).filter(
      (e: any) => e.type === 'geofenceEnter' || e.type === 'geofenceExit');
  } else if (reportType === 'ignition') {
    eventsData = (await fetchReport('events')).filter(
      (e: any) => e.type === 'ignitionOn' || e.type === 'ignitionOff');
  } else if (reportType === 'fuel') {
    eventsData = (await fetchReport('events')).filter(
      (e: any) => e.type === 'fuelDrop' || e.type === 'fuelIncrease');
  }

  // ---- Formatadores ----
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return iso; }
  };
  const fmtDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const fromLabel = fmtDate(from);
  const toLabel = fmtDate(to);
  const generatedAt = new Date().toLocaleString('pt-BR');

  const typeLabels: Record<string, string> = {
    combined: 'Completo', trips: 'Viagens', stops: 'Paradas', events: 'Eventos',
    summary: 'Resumo', route: 'Rota', chart: 'Grafico',
    geofence: 'Geocercas', ignition: 'Ignicao', fuel: 'Combustivel',
  };
  const typeLabel = typeLabels[reportType] || reportType;

  // ---- Builders de HTML ----
  const buildTrips = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <div class="device-header"><div class="device-icon">&#xe558;</div><h2>${device.deviceName || 'Veiculo'}</h2></div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-label">Viagens</div><div class="stat-value">${device.trips?.length ?? 0}</div></div>
          <div class="stat-box"><div class="stat-label">Distancia Total</div><div class="stat-value">${((device.totalDistance || 0) / 1000).toFixed(1)} <small>km</small></div></div>
          <div class="stat-box"><div class="stat-label">Velocidade Media</div><div class="stat-value">${(device.averageSpeed || 0).toFixed(0)} <small>km/h</small></div></div>
        </div>
        <table>
          <thead><tr><th>Inicio</th><th>Endereco Origem</th><th>Distancia</th><th>Duracao</th><th>Vel. Max.</th></tr></thead>
          <tbody>${(device.trips ?? []).map((t: any, i: number) => `
            <tr class="${i % 2 === 1 ? 'alt' : ''}">
              <td>${fmtDate(t.startTime)}</td><td>${t.startAddress || '-'}</td>
              <td class="num">${((t.distance || 0) / 1000).toFixed(1)} km</td>
              <td class="num">${fmtDuration(t.duration || 0)}</td>
              <td class="num">${(t.maxSpeed || 0).toFixed(0)} km/h</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`).join('');

  const buildStops = (data: any[]) =>
    data.map((device) => `
      <div class="device-block">
        <div class="device-header"><div class="device-icon">&#xe55f;</div><h2>${device.deviceName || 'Veiculo'}</h2></div>
        <div class="stats-row">
          <div class="stat-box"><div class="stat-label">Paradas</div><div class="stat-value">${device.totalStops ?? 0}</div></div>
          <div class="stat-box"><div class="stat-label">Tempo Parado</div><div class="stat-value">${fmtDuration(device.totalDuration || 0)}</div></div>
        </div>
        <table>
          <thead><tr><th>Inicio</th><th>Endereco</th><th>Duracao</th></tr></thead>
          <tbody>${(device.stops ?? []).map((s: any, i: number) => `
            <tr class="${i % 2 === 1 ? 'alt' : ''}">
              <td>${fmtDate(s.startTime)}</td><td>${s.address || '-'}</td>
              <td class="num">${fmtDuration(s.duration || 0)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`).join('');

  const evtLabels: Record<string, string> = {
    deviceOnline: 'Online', deviceOffline: 'Offline', deviceMoving: 'Em Movimento',
    deviceStopped: 'Parado', deviceOverspeed: 'Excesso Velocidade',
    ignitionOn: 'Ignicao Ligada', ignitionOff: 'Ignicao Desligada',
    geofenceEnter: 'Entrou Geocerca', geofenceExit: 'Saiu Geocerca',
    alarm: 'Alarme', fuelDrop: 'Queda Combustivel', fuelIncrease: 'Abastecimento',
  };

  const buildEvents = (data: any[]) => `
    <table>
      <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Dispositivo</th></tr></thead>
      <tbody>${data.length === 0
        ? '<tr><td colspan="3" style="text-align:center;padding:16px;color:#94a3b8">Nenhum evento</td></tr>'
        : data.map((e: any, i: number) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td>${fmtDate(e.serverTime || e.eventTime)}</td>
          <td>${evtLabels[e.type] || e.type || '-'}</td>
          <td>${e.deviceId || '-'}</td>
        </tr>`).join('')}</tbody>
    </table>`;

  const buildSummary = (data: any[]) => `
    <table>
      <thead><tr><th>Veiculo</th><th>Distancia</th><th>Vel. Media</th><th>Vel. Maxima</th><th>Horas Motor</th><th>Combustivel</th></tr></thead>
      <tbody>${data.map((s: any, i: number) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td><strong>${s.deviceName || 'Veiculo'}</strong></td>
          <td class="num">${((s.distance || 0) / 1000).toFixed(1)} km</td>
          <td class="num">${(s.averageSpeed || 0).toFixed(0)} km/h</td>
          <td class="num">${(s.maxSpeed || 0).toFixed(0)} km/h</td>
          <td class="num">${(s.engineHours || 0).toFixed(1)} h</td>
          <td class="num">${(s.spentFuel || 0).toFixed(1)} L</td>
        </tr>`).join('')}</tbody>
    </table>`;

  const buildRoute = (data: any[]) => {
    const speeds = data.map(p => Math.round(p.speed * 1.852 || p.speed || 0));
    const maxSpd = speeds.length > 0 ? Math.max(...speeds) : 0;
    const avgSpd = speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
    const step = Math.max(1, Math.floor(data.length / 200));
    const sampled = data.filter((_: any, i: number) => i % step === 0);
    return `
      <div class="stats-row">
        <div class="stat-box"><div class="stat-label">Posicoes</div><div class="stat-value">${data.length}</div></div>
        <div class="stat-box"><div class="stat-label">Vel. Maxima</div><div class="stat-value">${maxSpd} <small>km/h</small></div></div>
        <div class="stat-box"><div class="stat-label">Vel. Media</div><div class="stat-value">${avgSpd} <small>km/h</small></div></div>
      </div>
      <table>
        <thead><tr><th>Data/Hora</th><th>Latitude</th><th>Longitude</th><th>Velocidade</th><th>Altitude</th></tr></thead>
        <tbody>${sampled.map((p: any, i: number) => `
          <tr class="${i % 2 === 1 ? 'alt' : ''}">
            <td>${fmtDate(p.fixTime || p.serverTime)}</td>
            <td class="num">${(p.latitude || 0).toFixed(5)}</td>
            <td class="num">${(p.longitude || 0).toFixed(5)}</td>
            <td class="num">${Math.round(p.speed * 1.852 || p.speed || 0)} km/h</td>
            <td class="num">${Math.round(p.altitude || 0)} m</td>
          </tr>`).join('')}</tbody>
      </table>
      ${data.length > 200 ? `<p style="text-align:center;color:#64748b;font-size:10px;margin-top:8px">Amostra: ${sampled.length} de ${data.length} posicoes</p>` : ''}`;
  };

  // ---- Montar body ----
  let bodyContent = '';

  if (isCombined) {
    const sections: string[] = [];
    if (summaryData.length > 0) sections.push(`<div class="section-title"><div class="device-icon">&#xe24b;</div><h2>Resumo</h2></div>${buildSummary(summaryData)}`);
    if (tripsData.length > 0) sections.push(`<div class="section-title"><div class="device-icon">&#xe558;</div><h2>Viagens</h2></div>${buildTrips(tripsData)}`);
    if (stopsData.length > 0) sections.push(`<div class="section-title"><div class="device-icon">&#xe55f;</div><h2>Paradas</h2></div>${buildStops(stopsData)}`);
    if (eventsData.length > 0) sections.push(`<div class="section-title"><div class="device-icon">&#xe8b5;</div><h2>Eventos</h2></div>${buildEvents(eventsData)}`);
    bodyContent = sections.join('<hr class="section-divider" />');
  } else if (reportType === 'trips') {
    bodyContent = buildTrips(tripsData);
  } else if (reportType === 'stops') {
    bodyContent = buildStops(stopsData);
  } else if (reportType === 'events' || reportType === 'geofence' || reportType === 'ignition' || reportType === 'fuel') {
    bodyContent = buildEvents(eventsData);
  } else if (reportType === 'summary') {
    bodyContent = buildSummary(summaryData);
  } else if (reportType === 'route' || reportType === 'chart') {
    bodyContent = buildRoute(routeData);
  }

  const totalDevices = isCombined
    ? Math.max(summaryData.length, tripsData.length, stopsData.length, 1)
    : deviceIds.length;

  const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="${companyName}" class="logo" />` : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${companyName} - Relatorio de ${typeLabel}</title>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    @page { size: A4; margin: 15mm 12mm 20mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI','Helvetica Neue',Arial,sans-serif; font-size: 11px; color: #1e293b; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-header { background: linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1d4ed8 100%); color:#fff; padding:28px 32px; display:flex; align-items:center; justify-content:space-between; border-radius:0 0 12px 12px; margin-bottom:24px; position:relative; overflow:hidden; }
    .report-header::before { content:''; position:absolute; top:-50%; right:-10%; width:300px; height:300px; background:rgba(255,255,255,0.03); border-radius:50%; }
    .header-left { display:flex; align-items:center; gap:16px; z-index:1; }
    .logo { width:52px; height:52px; object-fit:contain; background:rgba(255,255,255,0.15); border-radius:10px; padding:6px; }
    .header-brand h1 { font-size:22px; font-weight:700; margin-bottom:2px; }
    .header-brand .subtitle { font-size:11px; opacity:0.75; }
    .header-right { text-align:right; z-index:1; }
    .report-type-badge { display:inline-block; background:rgba(255,255,255,0.18); padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600; margin-bottom:6px; }
    .header-meta { font-size:10px; opacity:0.7; line-height:1.6; }
    .print-bar { display:flex; align-items:center; justify-content:space-between; padding:0 32px; margin-bottom:20px; }
    .print-btn { background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; border:none; border-radius:8px; padding:10px 24px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 2px 8px rgba(29,78,216,0.3); }
    .print-btn:hover { background:linear-gradient(135deg,#1e40af,#1d4ed8); }
    .print-summary { font-size:11px; color:#64748b; }
    .content { padding:0 32px; }
    .device-block { margin-bottom:28px; page-break-inside:avoid; }
    .device-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #e2e8f0; }
    .device-icon { font-family:'Material Icons'; font-size:20px; color:#fff; background:linear-gradient(135deg,#1d4ed8,#3b82f6); width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .device-block h2 { font-size:14px; font-weight:700; color:#0f172a; }
    .stats-row { display:flex; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
    .stat-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; min-width:140px; flex:1; }
    .stat-label { font-size:9px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:600; margin-bottom:4px; }
    .stat-value { font-size:20px; font-weight:700; color:#1d4ed8; line-height:1.2; }
    .stat-value small { font-size:11px; font-weight:500; color:#64748b; }
    table { width:100%; border-collapse:separate; border-spacing:0; margin-top:4px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; }
    thead tr { background:linear-gradient(135deg,#0f172a,#1e293b); }
    th { color:#fff; padding:9px 12px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    td { padding:8px 12px; font-size:11px; color:#334155; border-bottom:1px solid #f1f5f9; }
    td.num { font-variant-numeric:tabular-nums; font-weight:500; }
    tr.alt td { background:#f8fafc; }
    tbody tr:last-child td { border-bottom:none; }
    .report-footer { margin-top:32px; padding:16px 32px; border-top:2px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; color:#94a3b8; font-size:9px; }
    .footer-left { display:flex; align-items:center; gap:8px; }
    .footer-logo { width:20px; height:20px; object-fit:contain; opacity:0.5; }
    .footer-center { text-align:center; line-height:1.5; }
    .footer-right { text-align:right; }
    .confidential { display:inline-block; background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:4px; font-size:8px; font-weight:600; text-transform:uppercase; }
    .empty-state { text-align:center; padding:48px 24px; color:#94a3b8; }
    .empty-state .icon { font-family:'Material Icons'; font-size:48px; margin-bottom:12px; opacity:0.3; }
    .section-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; padding-bottom:10px; border-bottom:3px solid #1d4ed8; }
    .section-title h2 { font-size:16px; font-weight:700; color:#0f172a; }
    .section-divider { border:none; border-top:1px solid #e2e8f0; margin:32px 0; }
    @media print {
      .print-bar { display:none !important; }
      .report-header { border-radius:0; margin-bottom:16px; padding:20px 24px; }
      .content { padding:0 16px; }
      .report-footer { padding:12px 16px; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="header-left">
      ${logoHtml}
      <div class="header-brand"><h1>${companyName}</h1><div class="subtitle">Plataforma de Rastreamento Veicular</div></div>
    </div>
    <div class="header-right">
      <div class="report-type-badge">Relatorio de ${typeLabel}</div>
      <div class="header-meta">Periodo: ${fromLabel} - ${toLabel}<br>Gerado em: ${generatedAt}</div>
    </div>
  </div>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()"><span class="material-icons" style="font-size:18px">print</span> Imprimir / Salvar como PDF</button>
    <div class="print-summary">${totalDevices} veiculo${totalDevices !== 1 ? 's' : ''} no relatorio</div>
  </div>
  <div class="content">
    ${bodyContent || '<div class="empty-state"><div class="icon">&#xe88e;</div><p>Nenhum dado encontrado para o periodo selecionado.</p></div>'}
  </div>
  <div class="report-footer">
    <div class="footer-left">${logoBase64 ? `<img src="${logoBase64}" class="footer-logo" />` : ''}<span>${companyName}</span></div>
    <div class="footer-center"><span class="confidential">Documento confidencial</span><br>Relatorio de ${typeLabel} - ${fromLabel} - ${toLabel}</div>
    <div class="footer-right">${generatedAt}</div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}