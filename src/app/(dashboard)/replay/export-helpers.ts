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

export function exportSummaryPDF(
  positions: RoutePosition[],
  summary: RouteSummary,
  stops: StopEvent[],
  violations: SpeedViolation[],
  deviceName: string,
  speedLimit: number,
  dateFrom: string,
  dateTo: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatorio de Rota", marginL, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Veiculo: ${deviceName}`, marginL, 26);
  doc.text(`Periodo: ${dateFrom}  ->  ${dateTo}`, marginL, 32);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, marginL, 37);
  y = 50;

  // KM destaque
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(marginL, y, contentW, 22, 3, 3, "F");
  doc.setTextColor(147, 197, 253);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(`${Math.round(summary.totalDistanceKm)} km`, pageW / 2, y + 14, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("QUILOMETROS PERCORRIDOS", pageW / 2, y + 20, { align: "center" });
  y += 30;

  // Resumo Geral
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Geral", marginL, y);
  y += 2;
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, marginL + contentW, y);
  y += 7;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const metricsGrid = [
    ["Duracao total", fmtDuration(summary.totalDurationSec), "Em movimento", fmtDuration(summary.movingDurationSec)],
    ["Tempo parado", fmtDuration(summary.stoppedDurationSec), "N. paradas", String(summary.stopsCount)],
    ["Vel. maxima", `${summary.maxSpeed} km/h`, "Vel. media", `${summary.avgSpeed} km/h`],
    ["Posicoes", String(summary.positionsCount), "", ""],
  ];

  const colW = contentW / 2;
  for (const row of metricsGrid) {
    checkPage(8);
    for (let c = 0; c < 2; c++) {
      const label = row[c * 2];
      const value = row[c * 2 + 1];
      if (!label) continue;
      const x = marginL + c * colW;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label + ":", x, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(value, x + 35, y);
    }
    y += 7;
  }
  y += 5;

  // Excessos de velocidade
  if (speedLimit > 0) {
    checkPage(20);
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Excessos de Velocidade (limite: ${speedLimit} km/h)`, marginL, y);
    y += 2;
    doc.setDrawColor(220, 38, 38);
    doc.line(marginL, y, marginL + contentW, y);
    y += 7;

    doc.setFontSize(9);
    if (violations.length === 0) {
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(marginL, y - 4, contentW, 12, 2, 2, "F");
      doc.setTextColor(22, 101, 52);
      doc.setFont("helvetica", "bold");
      doc.text("Velocidade respeitada - Nenhum excesso detectado", marginL + 5, y + 3);
      y += 15;
    } else {
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "normal");
      doc.text(`Ocorrencias: ${violations.length}  |  Pico maximo: ${summary.maxViolationSpeed} km/h  |  Distancia em excesso: ${Math.round(summary.violationDistanceKm)} km`, marginL, y);
      y += 8;

      for (let i = 0; i < violations.length; i++) {
        checkPage(20);
        const v = violations[i];
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(marginL, y - 3, contentW, 16, 2, 2, "F");
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");
        doc.text(`Excesso #${i + 1}`, marginL + 3, y + 2);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 60, 60);
        doc.text(`${fmtTime(v.startTime)} -> ${fmtTime(v.endTime)}  |  Pico: ${v.maxSpeed} km/h (+${v.maxSpeed - speedLimit})  |  ${fmtDuration(v.durationSec)}  |  ${v.distanceKm.toFixed(1)} km`, marginL + 3, y + 9);
        doc.setFontSize(9);
        y += 20;
      }
    }
    y += 3;
  }

  // Paradas
  if (stops.length > 0) {
    checkPage(20);
    doc.setTextColor(234, 88, 12);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Paradas Detectadas (${stops.length})`, marginL, y);
    y += 2;
    doc.setDrawColor(234, 88, 12);
    doc.line(marginL, y, marginL + contentW, y);
    y += 7;

    doc.setFontSize(9);
    for (let i = 0; i < stops.length; i++) {
      checkPage(18);
      const s = stops[i];
      doc.setFillColor(255, 247, 237);
      doc.roundedRect(marginL, y - 3, contentW, 14, 2, 2, "F");
      doc.setTextColor(154, 52, 18);
      doc.setFont("helvetica", "bold");
      doc.text(`Parada #${i + 1}`, marginL + 3, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 60, 30);
      doc.text(`${fmtTime(s.startTime)} -> ${fmtTime(s.endTime)}  |  Duracao: ${fmtDuration(s.durationSec)}  |  Local: ${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`, marginL + 3, y + 8);
      doc.setFontSize(9);
      y += 18;
    }
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`TrackCore Platform - Pagina ${i}/${pages}`, pageW / 2, 290, { align: "center" });
  }

  const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`relatorio_rota_${safeName}_${dateFrom}_${dateTo}.pdf`);
}
