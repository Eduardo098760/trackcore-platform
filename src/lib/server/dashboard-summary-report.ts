import { jsPDF } from "jspdf";
import type { DashboardSummaryPayload } from "@/types/dashboard-summary";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 15;

type CardPalette = { fill: [number, number, number]; text: [number, number, number] };
type MetricCardConfig = {
  title: string;
  value: string;
  caption: string;
  palette: CardPalette;
};

function ensureSpace(doc: jsPDF, currentY: number, neededHeight: number) {
  if (currentY + neededHeight <= PAGE_HEIGHT - PAGE_MARGIN) {
    return currentY;
  }

  doc.addPage();
  return PAGE_MARGIN + 8;
}

function addWrappedLines(doc: jsPDF, lines: string[], startX: number, startY: number, maxWidth: number, lineHeight = 5) {
  let y = startY;

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    doc.text(wrapped, startX, y);
    y += wrapped.length * lineHeight;
  }

  return y;
}

function getWrappedHeight(doc: jsPDF, lines: string[], maxWidth: number, lineHeight: number) {
  let total = 0;

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    total += Math.max(wrapped.length, 1) * lineHeight;
  }

  return total;
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(8, 15, 33);
  doc.roundedRect(PAGE_MARGIN, 12, PAGE_WIDTH - PAGE_MARGIN * 2, 28, 5, 5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 20, 24);
  doc.setFontSize(10);
  doc.setTextColor(191, 219, 254);
  doc.text(subtitle, 20, 31);
  return 48;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  const nextY = ensureSpace(doc, y, 12);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, PAGE_MARGIN, nextY);
  doc.setDrawColor(203, 213, 225);
  doc.line(PAGE_MARGIN, nextY + 2, PAGE_WIDTH - PAGE_MARGIN, nextY + 2);
  return nextY + 8;
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  value: string,
  caption: string,
  palette: CardPalette,
) {
  const titleLines = doc.splitTextToSize(title.toUpperCase(), width - 8);
  const captionLines = doc.splitTextToSize(caption, width - 8);
  const titleHeight = Math.max(titleLines.length, 1) * 3.4;
  const captionHeight = Math.max(captionLines.length, 1) * 3.4;
  const height = 8 + titleHeight + 8 + captionHeight + 4;

  doc.setFillColor(...palette.fill);
  doc.roundedRect(x, y, width, height, 4, 4, "F");
  doc.setTextColor(...palette.text);
  doc.setFontSize(8);
  doc.text(titleLines, x + 4, y + 6);
  doc.setFontSize(16);
  doc.text(value, x + 4, y + 6 + titleHeight + 5);
  doc.setFontSize(8);
  doc.text(captionLines, x + 4, y + 6 + titleHeight + 11);
  return height;
}

function drawInfoBox(doc: jsPDF, x: number, y: number, width: number, title: string, lines: string[]) {
  const height = 12 + getWrappedHeight(doc, lines, width - 8, 4.5);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(title, x + 4, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  addWrappedLines(doc, lines, x + 4, y + 12, width - 8, 4.5);
  return height;
}

function drawMetricRow(doc: jsPDF, y: number, cards: Array<{ x: number; width: number } & MetricCardConfig>) {
  const nextY = ensureSpace(doc, y, 32);
  const heights = cards.map((card) =>
    drawMetricCard(doc, card.x, nextY, card.width, card.title, card.value, card.caption, card.palette),
  );
  return nextY + Math.max(...heights) + 6;
}

function drawInfoRow(doc: jsPDF, y: number, boxes: Array<{ x: number; width: number; title: string; lines: string[] }>) {
  const estimatedHeight = Math.max(
    ...boxes.map((box) => 12 + getWrappedHeight(doc, box.lines, box.width - 8, 4.5)),
  );
  const nextY = ensureSpace(doc, y, estimatedHeight + 4);
  const heights = boxes.map((box) => drawInfoBox(doc, box.x, nextY, box.width, box.title, box.lines));
  return nextY + Math.max(...heights) + 6;
}

export function generateDashboardSummaryPdfBuffer(input: {
  payload: DashboardSummaryPayload;
  recipientEmail: string;
  tenantName: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { payload } = input;
  const overspeedVehicles = payload.problemVehicles.filter((vehicle) => vehicle.overspeedCount > 0).length;
  const alarmVehicles = payload.problemVehicles.filter((vehicle) => vehicle.alarmCount > 0).length;
  const batteryVehicles = payload.problemVehicles.filter((vehicle) => vehicle.batteryCount > 0).length;
  const connectivityVehicles = payload.problemVehicles.filter((vehicle) => vehicle.connectivityCount > 0).length;
  const maintenanceVehicles = payload.problemVehicles.filter((vehicle) => vehicle.maintenanceCount > 0).length;
  const highestPeak = payload.problemVehicles.reduce((max, vehicle) => Math.max(max, vehicle.maxRecordedSpeed ?? 0), 0);
  const highestExcess = payload.problemVehicles.reduce((max, vehicle) => Math.max(max, vehicle.maxExcessSpeed ?? 0), 0);
  const kpiHighlights = payload.customKpis.slice(0, 6);

  let y = drawHeader(
    doc,
    `${input.tenantName} • Relatório Executivo`,
    `${payload.periodLabel} • ${new Date(payload.generatedAt).toLocaleString("pt-BR")} • ${input.recipientEmail}`,
  );

  y = drawMetricRow(doc, y, [
    {
      x: 15,
      width: 42,
      title: "Veículos",
      value: String(payload.stats.devices.total),
      caption: `${payload.stats.devices.online} online`,
      palette: { fill: [239, 246, 255], text: [29, 78, 216] },
    },
    {
      x: 60,
      width: 42,
      title: "Problemas",
      value: String(payload.issueTotals.totalProblems),
      caption: `${payload.issueTotals.vehiclesAffected} afetados`,
      palette: { fill: [254, 242, 242], text: [185, 28, 28] },
    },
    {
      x: 105,
      width: 42,
      title: "Velocidade",
      value: String(payload.issueTotals.overspeedEvents),
      caption: `${overspeedVehicles} veículos`,
      palette: { fill: [255, 247, 237], text: [194, 65, 12] },
    },
    {
      x: 150,
      width: 45,
      title: "Eventos hoje",
      value: String(payload.stats.eventsToday),
      caption: `${payload.stats.activeAlerts} alertas ativos`,
      palette: { fill: [245, 243, 255], text: [109, 40, 217] },
    },
  ]);

  y = drawSectionTitle(doc, "Resumo executivo", y);
  y = drawInfoRow(doc, y, [
    {
      x: 15,
      width: 87,
      title: "Situação operacional",
      lines: [
        `Online: ${payload.stats.devices.online} • Offline: ${payload.stats.devices.offline}`,
        `Em movimento: ${payload.stats.devices.moving} • Parados: ${payload.stats.devices.stopped}`,
        `Bloqueados: ${payload.stats.devices.blocked} • Alertas ativos: ${payload.stats.activeAlerts}`,
      ],
    },
    {
      x: 108,
      width: 87,
      title: "Leitura executiva",
      lines: [
        `${payload.issueTotals.totalProblems} problemas registrados no período analisado.`,
        `${payload.issueTotals.vehiclesAffected} veículos tiveram alguma incidência crítica.`,
        `${payload.issueTotals.overspeedEvents} eventos de excesso de velocidade foram identificados.`,
      ],
    },
  ]);

  y = drawSectionTitle(doc, "Consolidação de ocorrências", y);
  y = drawMetricRow(doc, y, [
    {
      x: 15,
      width: 33,
      title: "Alarmes",
      value: String(payload.issueTotals.alarms),
      caption: `${alarmVehicles} veículos`,
      palette: { fill: [254, 242, 242], text: [185, 28, 28] },
    },
    {
      x: 51,
      width: 33,
      title: "Bateria",
      value: String(payload.issueTotals.batteryAlerts),
      caption: `${batteryVehicles} veículos`,
      palette: { fill: [254, 249, 195], text: [161, 98, 7] },
    },
    {
      x: 87,
      width: 33,
      title: "Conexão",
      value: String(payload.issueTotals.connectivityIssues),
      caption: `${connectivityVehicles} veículos`,
      palette: { fill: [239, 246, 255], text: [3, 105, 161] },
    },
    {
      x: 123,
      width: 33,
      title: "Manutenção",
      value: String(payload.issueTotals.maintenanceAlerts),
      caption: `${maintenanceVehicles} veículos`,
      palette: { fill: [238, 242, 255], text: [67, 56, 202] },
    },
    {
      x: 159,
      width: 36,
      title: "Pico de velocidade",
      value: highestPeak > 0 ? `${highestPeak} km/h` : "-",
      caption: highestExcess > 0 ? `Maior excesso +${highestExcess} km/h` : "Sem excesso relevante",
      palette: { fill: [255, 247, 237], text: [194, 65, 12] },
    },
  ]);

  y = drawSectionTitle(doc, "Velocidade e criticidade", y);
  y = drawInfoRow(doc, y, [
    {
      x: 15,
      width: 180,
      title: "Síntese gerencial",
      lines: [
        payload.issueTotals.overspeedEvents > 0
          ? `${overspeedVehicles} veículos registraram excesso de velocidade. O pico máximo do período foi ${highestPeak} km/h, com maior excesso de +${highestExcess} km/h sobre o limite configurado.`
          : "Não houve registros de excesso de velocidade no período analisado.",
        payload.issueTotals.vehiclesAffected > 0
          ? "As ocorrências foram consolidadas por categoria para leitura executiva, sem listagem individual de veículos com problemas neste relatório."
          : "Nenhum veículo apresentou incidência crítica no período analisado.",
      ],
    },
  ]);

  y = drawSectionTitle(doc, "KPIs personalizados", y);
  if (kpiHighlights.length === 0) {
    y = drawInfoRow(doc, y, [
      {
        x: 15,
        width: 180,
        title: "Indicadores",
        lines: ["Nenhum KPI personalizado habilitado no dashboard para compor este relatório."],
      },
    ]);
  } else {
    const firstColumn = kpiHighlights.filter((_, index) => index % 2 === 0).map((item) => `${item.label}: ${item.value}`);
    const secondColumn = kpiHighlights.filter((_, index) => index % 2 === 1).map((item) => `${item.label}: ${item.value}`);
    y = drawInfoRow(doc, y, [
      {
        x: 15,
        width: 87,
        title: "Indicadores-chave",
        lines: firstColumn,
      },
      {
        x: 108,
        width: 87,
        title: "Complementares",
        lines: secondColumn.length > 0 ? secondColumn : ["Sem indicadores adicionais nesta seleção."],
      },
    ]);
  }

  y = drawSectionTitle(doc, "Conclusão executiva", y);
  y = ensureSpace(doc, y, 18);
  addWrappedLines(doc, [
    `${payload.issueTotals.totalProblems > 0 ? "O período exige acompanhamento gerencial" : "O período permaneceu estável"} com foco principal em ${payload.issueTotals.overspeedEvents > 0 ? "eventos de velocidade e incidências operacionais" : "monitoramento preventivo e continuidade operacional"}.`,
    `Este PDF foi consolidado em formato executivo para leitura rápida, priorizando totais, criticidade e indicadores principais da operação.`,
  ], 15, y, 180, 5);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Documento gerado automaticamente para ${input.tenantName}.`, 15, PAGE_HEIGHT - 10);

  const buffer = doc.output("arraybuffer");
  return Buffer.from(buffer);
}
