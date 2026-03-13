import type { RoutePosition } from "@/types";
import jsPDF from "jspdf";

interface RouteSummary {
  totalDistanceKm: number;
  totalDurationSec: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  maxSpeed: number;
  avgSpeed: number;
  stopsCount: number;
  positionsCount: number;
  violationsCount: number;
  maxViolationSpeed: number;
  violationDistanceKm: number;
}

interface StopEvent {
  index: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  durationSec: number;
  latitude: number;
  longitude: number;
}

interface SpeedViolation {
  index: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  maxSpeed: number;
  durationSec: number;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPositionsCSV(
  positions: RoutePosition[],
  deviceName: string,
  dateFrom: string,
  dateTo: string,
) {
  const header = "Data/Hora;Latitude;Longitude;Velocidade (km/h);Ignicao;Odometro (km);Satelites;Bateria (%)";
  const rows = positions.map((p) => {
    const time = p.fixTime || p.serverTime;
    const dt = new Date(time).toLocaleString("pt-BR");
    const speed = Math.round(p.speed ?? 0);
    const ign = p.attributes?.ignition ? "Ligada" : "Desligada";
    const odo = p.attributes?.totalDistance
      ? (p.attributes.totalDistance / 1000).toFixed(2)
      : "";
    const sat = p.attributes?.sat ?? "";
    const bat = p.attributes?.batteryLevel ?? "";
    return `${dt};${p.latitude.toFixed(6)};${p.longitude.toFixed(6)};${speed};${ign};${odo};${sat};${bat}`;
  });
  const csv = [header, ...rows].join("\n");
  const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, "_");
  downloadFile(csv, `posicoes_${safeName}_${dateFrom}_${dateTo}.csv`);
}

export function exportSummaryReport(
  positions: RoutePosition[],
  summary: RouteSummary,
  stops: StopEvent[],
  violations: SpeedViolation[],
  deviceName: string,
  speedLimit: number,
  dateFrom: string,
  dateTo: string,
) {
  const lines: string[] = [];
  const sep = "========================================";

  lines.push("RELATORIO DE ROTA");
  lines.push(sep);
  lines.push(`Veiculo: ${deviceName}`);
  lines.push(`Periodo: ${dateFrom} -> ${dateTo}`);
  lines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  lines.push("");

  lines.push("RESUMO GERAL");
  lines.push("----------------------------------------");
  lines.push(`Distancia total: ${Math.round(summary.totalDistanceKm)} km`);
  lines.push(`Duracao total: ${fmtDuration(summary.totalDurationSec)}`);
  lines.push(`Em movimento: ${fmtDuration(summary.movingDurationSec)}`);
  lines.push(`Tempo parado: ${fmtDuration(summary.stoppedDurationSec)}`);
  lines.push(`Velocidade maxima: ${summary.maxSpeed} km/h`);
  lines.push(`Velocidade media: ${summary.avgSpeed} km/h`);
  lines.push(`Posicoes registradas: ${summary.positionsCount}`);
  lines.push(`Numero de paradas: ${summary.stopsCount}`);
  lines.push("");

  if (speedLimit > 0) {
    lines.push(`EXCESSOS DE VELOCIDADE (limite: ${speedLimit} km/h)`);
    lines.push("----------------------------------------");
    if (violations.length === 0) {
      lines.push("Nenhum excesso de velocidade detectado.");
    } else {
      lines.push(`Total de ocorrencias: ${violations.length}`);
      lines.push(`Pico maximo: ${summary.maxViolationSpeed} km/h`);
      lines.push(`Distancia em excesso: ${Math.round(summary.violationDistanceKm)} km`);
      lines.push("");
      violations.forEach((v, idx) => {
        lines.push(`  Excesso #${idx + 1}`);
        lines.push(`    Periodo: ${fmtTime(v.startTime)} -> ${fmtTime(v.endTime)}`);
        lines.push(`    Vel. maxima: ${v.maxSpeed} km/h (+${v.maxSpeed - speedLimit} km/h)`);
        lines.push(`    Duracao: ${fmtDuration(v.durationSec)}`);
        lines.push(`    Distancia: ${v.distanceKm.toFixed(2)} km`);
        lines.push(`    Local: ${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)}`);
      });
    }
    lines.push("");
  }

  if (stops.length > 0) {
    lines.push(`PARADAS DETECTADAS (${stops.length})`);
    lines.push("----------------------------------------");
    stops.forEach((s, idx) => {
      lines.push(`  Parada #${idx + 1}`);
      lines.push(`    Periodo: ${fmtTime(s.startTime)} -> ${fmtTime(s.endTime)}`);
      lines.push(`    Duracao: ${fmtDuration(s.durationSec)}`);
      lines.push(`    Local: ${s.latitude.toFixed(6)}, ${s.longitude.toFixed(6)}`);
    });
    lines.push("");
  }

  lines.push(sep);
  lines.push("Fim do relatorio.");

  const report = lines.join("\n");
  const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, "_");
  downloadFile(
    report,
    `relatorio_rota_${safeName}_${dateFrom}_${dateTo}.txt`,
    "text/plain;charset=utf-8;",
  );
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logos/rastrear-icone-light.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Gera uma imagem PNG do mapa com a rota completa desenhada.
 * Cria um canvas off-screen, busca tiles do CartoDB dark, desenha a rota e marcadores.
 * A amostragem é dinâmica: rotas curtas usam todos os pontos,
 * rotas longas são reduzidas proporcionalmente (min 200, max 800).
 */
export async function captureMapImage(
  positions: RoutePosition[],
  stops: { latitude: number; longitude: number }[] = [],
): Promise<string | null> {
  if (!positions || positions.length < 2) return null;

  try {
    const MAP_W = 1200;
    const MAP_H = 600;
    const TILE_SIZE = 256;
    const tileUrl = (x: number, y: number, z: number) =>
      `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`;

    // ── Sample positions (dinâmico) ──
    // Escala: até 200 pts → todos | 200-2000 → proporcional | 2000+ → cap em 800
    const total = positions.length;
    const sampleCount = total <= 200 ? total : Math.min(800, Math.max(200, Math.round(total * 0.4)));
    const step = total > sampleCount ? Math.ceil(total / sampleCount) : 1;
    const sampled: RoutePosition[] = [];
    for (let i = 0; i < positions.length; i += step) sampled.push(positions[i]);
    if (sampled[sampled.length - 1] !== positions[positions.length - 1]) {
      sampled.push(positions[positions.length - 1]);
    }

    // ── Calculate bounds ──
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of positions) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    // Padding 8%
    const latPad = (maxLat - minLat) * 0.08 || 0.005;
    const lngPad = (maxLng - minLng) * 0.08 || 0.005;
    minLat -= latPad; maxLat += latPad;
    minLng -= lngPad; maxLng += lngPad;

    // ── Determine zoom level ──
    const latToY = (lat: number, zoom: number) => {
      const sinLat = Math.sin((lat * Math.PI) / 180);
      return (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * (TILE_SIZE * Math.pow(2, zoom));
    };
    const lngToX = (lng: number, zoom: number) => {
      return ((lng + 180) / 360) * (TILE_SIZE * Math.pow(2, zoom));
    };

    let zoom = 18;
    for (let z = 18; z >= 1; z--) {
      const x1 = lngToX(minLng, z);
      const x2 = lngToX(maxLng, z);
      const y1 = latToY(maxLat, z);
      const y2 = latToY(minLat, z);
      if (x2 - x1 <= MAP_W && y2 - y1 <= MAP_H) {
        zoom = z;
        break;
      }
    }

    // ── Center and pixel offset ──
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const centerPxX = lngToX(centerLng, zoom);
    const centerPxY = latToY(centerLat, zoom);
    const topLeftPxX = centerPxX - MAP_W / 2;
    const topLeftPxY = centerPxY - MAP_H / 2;

    // ── Determine needed tiles ──
    const tileMinX = Math.floor(topLeftPxX / TILE_SIZE);
    const tileMaxX = Math.floor((topLeftPxX + MAP_W) / TILE_SIZE);
    const tileMinY = Math.floor(topLeftPxY / TILE_SIZE);
    const tileMaxY = Math.floor((topLeftPxY + MAP_H) / TILE_SIZE);

    // ── Fetch tiles ──
    const loadTile = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Tile failed: ${url}`));
        img.src = url;
      });

    const tilePromises: Promise<{ img: HTMLImageElement; dx: number; dy: number } | null>[] = [];
    for (let tx = tileMinX; tx <= tileMaxX; tx++) {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        const url = tileUrl(tx, ty, zoom);
        const dx = tx * TILE_SIZE - topLeftPxX;
        const dy = ty * TILE_SIZE - topLeftPxY;
        tilePromises.push(
          loadTile(url)
            .then((img) => ({ img, dx, dy }))
            .catch(() => null),
        );
      }
    }
    const tiles = await Promise.all(tilePromises);

    // ── Create canvas ──
    const canvas = document.createElement("canvas");
    canvas.width = MAP_W;
    canvas.height = MAP_H;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Draw tiles (they are @2x so 512px for 256 tile area)
    for (const tile of tiles) {
      if (tile) ctx.drawImage(tile.img, tile.dx, tile.dy, TILE_SIZE, TILE_SIZE);
    }

    // ── Convert lat/lng to canvas px ──
    const toCanvasX = (lng: number) => lngToX(lng, zoom) - topLeftPxX;
    const toCanvasY = (lat: number) => latToY(lat, zoom) - topLeftPxY;

    // ── Draw route shadow ──
    ctx.beginPath();
    ctx.strokeStyle = "rgba(30, 58, 138, 0.6)";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < sampled.length; i++) {
      const x = toCanvasX(sampled[i].longitude) + 2;
      const y = toCanvasY(sampled[i].latitude) + 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Draw route line ──
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < sampled.length; i++) {
      const x = toCanvasX(sampled[i].longitude);
      const y = toCanvasY(sampled[i].latitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Stop markers ──
    for (let i = 0; i < stops.length; i++) {
      const sx = toCanvasX(stops[i].longitude);
      const sy = toCanvasY(stops[i].latitude);
      // Outer circle
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#a855f7";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Number
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, sx, sy);
    }

    // ── Start marker ──
    const startX = toCanvasX(positions[0].longitude);
    const startY = toCanvasY(positions[0].latitude);
    ctx.beginPath();
    ctx.arc(startX, startY, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", startX, startY);

    // ── End marker ──
    const endP = positions[positions.length - 1];
    const endX = toCanvasX(endP.longitude);
    const endY = toCanvasY(endP.latitude);
    ctx.beginPath();
    ctx.arc(endX, endY, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("F", endX, endY);

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("[Map Render] Failed:", e);
    return null;
  }
}

export async function exportSummaryPDF(
  positions: RoutePosition[],
  summary: RouteSummary,
  stops: StopEvent[],
  violations: SpeedViolation[],
  deviceName: string,
  speedLimit: number,
  dateFrom: string,
  dateTo: string,
  mapImageBase64?: string | null,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 16;
  const marginR = 16;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const companyName = "Rastrear";
  const logoData = await loadLogoBase64();
  const generatedAt = new Date().toLocaleString("pt-BR");

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 22) {
      doc.addPage();
      y = 18;
    }
  };

  // ── Decorative side accent bar ──
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, 4, pageH, "F");

  // ── Header (taller, two-row layout) ──
  const headerH = 58;
  doc.setFillColor(15, 23, 42);
  doc.rect(4, 0, pageW - 4, headerH, "F");
  // Bottom accent stripe
  doc.setFillColor(29, 78, 216);
  doc.rect(4, headerH - 3, pageW - 4, 3, "F");
  // Subtle decorative circle
  doc.setFillColor(29, 78, 216);
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.circle(pageW - 30, 10, 40, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // ── Row 1: Company branding ──
  if (logoData) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginL, 8, 18, 18, 3, 3, "F");
    doc.addImage(logoData, "PNG", marginL + 2, 10, 14, 14);
  }

  const brandX = logoData ? marginL + 22 : marginL;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, brandX, 19);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Plataforma de Rastreamento Veicular", brandX, 25);

  // ── Row 2: Report details (below, with background strip) ──
  const detailY = 32;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(marginL, detailY, contentW, 18, 2, 2, "F");

  // Report type badge (left)
  const badgeText = "RELATORIO DE ROTA";
  doc.setFillColor(29, 78, 216);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const badgeW = doc.getTextWidth(badgeText) + 10;
  doc.roundedRect(marginL + 4, detailY + 3, badgeW, 6, 1.5, 1.5, "F");
  doc.setTextColor(219, 234, 254);
  doc.text(badgeText, marginL + 4 + badgeW / 2, detailY + 7.5, { align: "center" });

  // Vehicle name (center)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(deviceName, pageW / 2, detailY + 8, { align: "center" });

  // Period (below badge, left area)
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Periodo: ${dateFrom}  -  ${dateTo}`, marginL + 6, detailY + 14.5);

  // Generation date (right)
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado: ${generatedAt}`, pageW - marginR - 4, detailY + 14.5, { align: "right" });

  y = headerH + 8;

  // ── KM highlight card ──
  // Background card
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginL, y, contentW, 28, 4, 4, "F");
  // Inner blue gradient bar
  doc.setFillColor(29, 78, 216);
  doc.roundedRect(marginL + 2, y + 2, contentW - 4, 24, 3, 3, "F");
  // KM value
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(`${Math.round(summary.totalDistanceKm)} km`, pageW / 2, y + 16, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(191, 219, 254);
  doc.text("QUILOMETROS PERCORRIDOS", pageW / 2, y + 23, { align: "center" });
  y += 36;

  // ── Route Map (captured image from Leaflet) ──
  if (mapImageBase64) {
    const mapH = 90;
    checkPage(mapH + 14);

    // Section header
    doc.setFillColor(29, 78, 216);
    doc.circle(marginL + 2, y - 1, 2, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Mapa da Rota", marginL + 7, y);
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, marginL + contentW, y);
    y += 4;

    // Map image container with border
    doc.setFillColor(10, 15, 26);
    doc.roundedRect(marginL, y, contentW, mapH, 3, 3, "F");
    doc.addImage(mapImageBase64, "PNG", marginL + 0.5, y + 0.5, contentW - 1, mapH - 1);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.roundedRect(marginL, y, contentW, mapH, 3, 3, "S");

    y += mapH + 8;
  }

  // ── Summary section ──
  // Section header with icon dot
  doc.setFillColor(29, 78, 216);
  doc.circle(marginL + 2, y - 1, 2, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Geral", marginL + 7, y);
  y += 3;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginL + contentW, y);
  y += 8;

  // Metrics grid — 2x4 card layout
  const cardW = (contentW - 6) / 2;
  const cardH = 18;
  const metrics = [
    { label: "Duracao Total", value: fmtDuration(summary.totalDurationSec), color: [29, 78, 216] },
    { label: "Em Movimento", value: fmtDuration(summary.movingDurationSec), color: [22, 163, 74] },
    { label: "Tempo Parado", value: fmtDuration(summary.stoppedDurationSec), color: [234, 88, 12] },
    { label: "N. Paradas", value: String(summary.stopsCount), color: [168, 85, 247] },
    { label: "Vel. Maxima", value: `${summary.maxSpeed} km/h`, color: [220, 38, 38] },
    { label: "Vel. Media", value: `${summary.avgSpeed} km/h`, color: [29, 78, 216] },
    { label: "Posicoes", value: String(summary.positionsCount), color: [100, 116, 139] },
  ];

  for (let i = 0; i < metrics.length; i++) {
    const col = i % 2;
    const cx = marginL + col * (cardW + 6);

    checkPage(cardH + 4);

    // Card background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
    // Card left accent
    const [cr, cg, cb] = metrics[i].color;
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(cx, y, 1.5, cardH, 0.75, 0.75, "F");

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(metrics[i].label.toUpperCase(), cx + 6, y + 6);
    // Value
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cr, cg, cb);
    doc.text(metrics[i].value, cx + 6, y + 14);

    if (col === 1 || i === metrics.length - 1) {
      y += cardH + 4;
    }
  }
  y += 4;

  // ── Speed violations ──
  if (speedLimit > 0) {
    checkPage(22);
    doc.setFillColor(220, 38, 38);
    doc.circle(marginL + 2, y - 1, 2, "F");
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Excessos de Velocidade (limite: ${speedLimit} km/h)`, marginL + 7, y);
    y += 3;
    doc.setDrawColor(252, 165, 165);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + contentW, y);
    y += 7;

    doc.setFontSize(9);
    if (violations.length === 0) {
      checkPage(14);
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(marginL, y - 4, contentW, 14, 3, 3, "F");
      // Green checkmark accent
      doc.setFillColor(22, 163, 74);
      doc.circle(marginL + 7, y + 2, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("\u2713", marginL + 5.5, y + 4);
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(9);
      doc.text("Nenhum excesso de velocidade detectado", marginL + 14, y + 3);
      y += 17;
    } else {
      // Summary stats bar
      checkPage(12);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(marginL, y - 3, contentW, 10, 2, 2, "F");
      doc.setTextColor(127, 29, 29);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${violations.length} ocorrencia${violations.length > 1 ? "s" : ""}   \u2022   Pico: ${summary.maxViolationSpeed} km/h   \u2022   Distancia: ${Math.round(summary.violationDistanceKm)} km`,
        marginL + 4, y + 3,
      );
      y += 12;

      for (let i = 0; i < violations.length; i++) {
        checkPage(22);
        const v = violations[i];
        // Card
        doc.setFillColor(255, 245, 245);
        doc.roundedRect(marginL, y - 2, contentW, 18, 2, 2, "F");
        // Red left accent
        doc.setFillColor(220, 38, 38);
        doc.roundedRect(marginL, y - 2, 1.5, 18, 0.75, 0.75, "F");
        // Number badge
        doc.setFillColor(220, 38, 38);
        doc.roundedRect(marginL + 5, y, 12, 6, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(`#${i + 1}`, marginL + 11, y + 4, { align: "center" });
        // Details
        doc.setTextColor(127, 29, 29);
        doc.setFontSize(9);
        doc.text(`Pico: ${v.maxSpeed} km/h (+${v.maxSpeed - speedLimit})`, marginL + 20, y + 4);
        doc.setTextColor(100, 60, 60);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(
          `${fmtTime(v.startTime)} \u2192 ${fmtTime(v.endTime)}   \u2022   ${fmtDuration(v.durationSec)}   \u2022   ${v.distanceKm.toFixed(1)} km`,
          marginL + 20, y + 11,
        );
        y += 22;
      }
    }
    y += 4;
  }

  // ── Stops ──
  if (stops.length > 0) {
    checkPage(22);
    doc.setFillColor(234, 88, 12);
    doc.circle(marginL + 2, y - 1, 2, "F");
    doc.setTextColor(124, 45, 18);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Paradas Detectadas (${stops.length})`, marginL + 7, y);
    y += 3;
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + contentW, y);
    y += 7;

    doc.setFontSize(9);
    for (let i = 0; i < stops.length; i++) {
      checkPage(20);
      const s = stops[i];
      // Card
      doc.setFillColor(255, 251, 245);
      doc.roundedRect(marginL, y - 2, contentW, 16, 2, 2, "F");
      // Orange left accent
      doc.setFillColor(234, 88, 12);
      doc.roundedRect(marginL, y - 2, 1.5, 16, 0.75, 0.75, "F");
      // Number badge
      doc.setFillColor(234, 88, 12);
      doc.roundedRect(marginL + 5, y, 12, 6, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`#${i + 1}`, marginL + 11, y + 4, { align: "center" });
      // Duration bold
      doc.setTextColor(124, 45, 18);
      doc.setFontSize(9);
      doc.text(fmtDuration(s.durationSec), marginL + 20, y + 4);
      // Time + location
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 80, 40);
      doc.text(
        `${fmtTime(s.startTime)} \u2192 ${fmtTime(s.endTime)}   \u2022   ${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`,
        marginL + 20, y + 10,
      );
      y += 20;
    }
  }

  // ── Footer on all pages ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Footer separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 16, pageW - marginR, pageH - 16);

    // Left: company
    if (logoData) {
      doc.addImage(logoData, "PNG", marginL, pageH - 14, 6, 6);
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(companyName, marginL + (logoData ? 8 : 0), pageH - 10);

    // Center: confidential
    doc.setFillColor(241, 245, 249);
    const confText = "DOCUMENTO CONFIDENCIAL";
    const confW = doc.getTextWidth(confText) + 8;
    doc.roundedRect(pageW / 2 - confW / 2, pageH - 14, confW, 6, 1, 1, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(confText, pageW / 2, pageH - 10, { align: "center" });

    // Right: page
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pagina ${i}/${pages}`, pageW - marginR, pageH - 10, { align: "right" });

    // Side accent continues
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, 4, pageH, "F");
  }

  const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`relatorio_rota_${safeName}_${dateFrom}_${dateTo}.pdf`);
}
