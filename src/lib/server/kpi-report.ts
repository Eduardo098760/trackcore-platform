import { jsPDF } from 'jspdf';
import type { KPI, KPIEvaluationResult } from '@/types/kpi';

export function buildKpiReportEmail(input: {
  kpi: KPI;
  result: KPIEvaluationResult;
  periodLabel: string;
  customMessage?: string;
}) {
  const text = [
    `Relatório KPI: ${input.kpi.name}`,
    `Período de análise: ${input.periodLabel}`,
    `Valor apurado: ${input.result.value}`,
    `Base de cálculo: ${input.result.basis}`,
    input.customMessage ? `Observações: ${input.customMessage}` : '',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;font-size:20px;">${input.kpi.name}</h2>
      <p style="margin:0 0 8px;"><strong>Período de análise:</strong> ${input.periodLabel}</p>
      <p style="margin:0 0 8px;"><strong>Valor apurado:</strong> ${input.result.value}</p>
      <p style="margin:0 0 8px;"><strong>Amostras consideradas:</strong> ${input.result.sampleCount}</p>
      <p style="margin:0 0 8px;"><strong>Base de cálculo:</strong> ${input.result.basis}</p>
      ${input.customMessage ? `<p style="margin:16px 0 0;"><strong>Observações:</strong><br>${input.customMessage}</p>` : ''}
      <p style="margin:16px 0 0;color:#475569;">Este relatório representa o fechamento configurado para o KPI e pode ser totalmente personalizado pela gestão.</p>
    </div>
  `;

  return {
    subject: `Relatório KPI • ${input.kpi.name}`,
    text,
    html,
  };
}

export function generateKpiPdfBuffer(input: {
  kpi: KPI;
  result: KPIEvaluationResult;
  periodLabel: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 20;

  doc.setFontSize(18);
  doc.text('TrackCore • Relatório KPI', 15, y);
  y += 12;

  doc.setFontSize(14);
  doc.text(input.kpi.name, 15, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Período de análise: ${input.periodLabel}`, 15, y);
  y += 7;
  doc.text(`Valor apurado: ${input.result.value}`, 15, y);
  y += 7;
  doc.text(`Amostras consideradas: ${input.result.sampleCount}`, 15, y);
  y += 7;
  doc.text(`Base de cálculo: ${input.result.basis}`, 15, y, { maxWidth: 180 });
  y += 16;

  doc.setFontSize(10);
  doc.text(`Agregação: ${input.kpi.aggregation.toUpperCase()}`, 15, y);
  y += 6;
  doc.text(`Atributo: ${input.kpi.sensorLabel || input.kpi.sensorKey}`, 15, y);
  y += 6;
  doc.text(`Gerado em: ${new Date(input.result.timestamp).toLocaleString('pt-BR')}`, 15, y);
  y += 10;

  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(15, y, 180, 35, 3, 3);
  doc.setFontSize(11);
  doc.text('Resumo executivo', 20, y + 8);
  doc.setFontSize(10);
  doc.text(
    [
      `O KPI ${input.kpi.name} foi apurado em ${input.result.value}.`,
      `A leitura foi consolidada com ${input.result.sampleCount} amostra(s).`,
      `Período de referência: ${input.periodLabel}.`,
    ],
    20,
    y + 16,
  );

  const buffer = doc.output('arraybuffer');
  return Buffer.from(buffer);
}