/**
 * Tipos TypeScript para o Sistema de KPIs
 * Baseado em atributos computados do Traccar
 */

export interface KPI {
  id: string;
  name: string;
  organizationId?: number;
  computedAttributeId?: number;
  attributeName?: string;
  sensorKey: string;        // chave do atributo computado (ex: "batteryLow")
  sensorLabel?: string;
  sensorType?: 'string' | 'number' | 'boolean';
  source?: KPIValueSource;
  aggregation: AggregationType;
  filter?: string;          // filtro adicional (ex: "batteryLow == true")
  period: PeriodType;
  unit?: string;
  enabledOnDashboard?: boolean;
  reportSchedule?: KPIReportSchedule | null;
  customPeriod?: {
    start: Date;
    end: Date;
  };
  chart: ChartType;
  groupBy: GroupByType;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPICalculation {
  kpiId: string;
  value: number;
  label: string;
  timestamp: Date;
}

export interface KPIEvaluationResult {
  kpiId: string;
  value: string;
  rawValue: number | string;
  label: string;
  subtext: string;
  basis: string;
  periodLabel: string;
  sampleCount: number;
  timestamp: string;
}

export interface SensorData {
  sensor: {
    id: number;
    attribute: string;
    description: string;
    type: 'string' | 'number' | 'boolean';
  };
  lastValue: any;
  status: 'ativo' | 'inativo' | 'erro';
  deviceCount: number;
  lastUpdate: Date;
}

// Sensores externos — tipagem e leituras
export type ExternalSensorType =
  | 'temperature'
  | 'fuel'
  | 'tirePressure'
  | 'camera'
  | 'obd'
  | 'custom'

export type SensorUnit =
  | 'celsius'
  | 'fahrenheit'
  | 'percent'
  | 'psi'
  | 'rpm'
  | 'voltage'
  | 'boolean'
  | 'string'

export interface ExternalSensorConfig {
  id: string; // uuid
  key: string; // chave única (ex: external.temp.front)
  label: string; // nome amigável
  type: ExternalSensorType;
  unit?: SensorUnit;
  deviceAttribute?: string; // atributo do device (se aplicável)
  pollingIntervalSeconds?: number; // se for polled
  enabled: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SensorReading {
  sensorKey: string; // ref a ExternalSensorConfig.key
  vehicleId: number | string;
  timestamp: string; // ISO
  value: number | string | boolean;
  raw?: any; // payload cru do sensor
}

export interface SensorReadingStored extends SensorReading {
  id: string; // uuid
}

export type VehicleSensors = Record<string, ExternalSensorConfig[]>

export type KPIValueSource = 'auto' | 'device' | 'position';
export type KPIReportFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly';
export type KPIReportPeriod = 'current' | '24h' | '7d' | '15d' | '30d';

export interface KPIReportSchedule {
  enabled: boolean;
  recipients: string[];
  frequency: KPIReportFrequency;
  period: KPIReportPeriod;
  deliveryTime: string; // HH:mm
  weeklyDay?: number; // 0-6, usado apenas em frequência semanal
  sendPdf: boolean;
  subject?: string;
  customMessage?: string;
  lastSentAt?: string | null;
  nextRunAt?: string | null;
}

// Tipos enumerados
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type ChartType = 'bar' | 'line' | 'pie' | 'card';
export type PeriodType = 'current' | '1h' | '24h' | '7d' | '15d' | '30d' | 'custom';
export type GroupByType = 'vehicle' | 'day' | 'hour' | 'organization';

// Tipos para o builder de KPIs
export interface KPIBuilderData {
  name: string;
  organizationId?: number;
  computedAttributeId?: number;
  attributeName?: string;
  sensorKey: string;
  sensorLabel?: string;
  sensorType?: 'string' | 'number' | 'boolean';
  source?: KPIValueSource;
  aggregation: AggregationType;
  filter: string;
  period: PeriodType;
  unit?: string;
  enabledOnDashboard?: boolean;
  reportSchedule?: KPIReportSchedule | null;
  customPeriod?: {
    start: Date;
    end: Date;
  };
  chart: ChartType;
  groupBy: GroupByType;
}

// Tipos para preview de gráfico
export interface ChartPreviewData {
  labels: string[];
  values: number[];
  type: ChartType;
}

// Validações
export const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'count', label: 'Contagem' },
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Média' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
];

export const CHART_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'card', label: 'Card (Número)', icon: '📊' },
  { value: 'bar', label: 'Barras', icon: '📊' },
  { value: 'line', label: 'Linha', icon: '📈' },
  { value: 'pie', label: 'Pizza', icon: '🥧' },
];

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'current', label: 'Snapshot atual' },
  { value: '1h', label: 'Última hora' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '15d', label: 'Últimos 15 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Período customizado' },
];

export const GROUP_BY_OPTIONS: { value: GroupByType; label: string }[] = [
  { value: 'vehicle', label: 'Veículo' },
  { value: 'day', label: 'Dia' },
  { value: 'hour', label: 'Hora' },
  { value: 'organization', label: 'Organização' },
];

export const KPI_REPORT_FREQUENCY_OPTIONS: { value: KPIReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Todo final do dia' },
  { value: 'weekly', label: 'Todo final da semana' },
  { value: 'fortnightly', label: 'A cada quinzena' },
  { value: 'monthly', label: 'Todo final do mês' },
];

export const KPI_REPORT_PERIOD_OPTIONS: { value: KPIReportPeriod; label: string }[] = [
  { value: 'current', label: 'Snapshot atual' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '15d', label: 'Últimos 15 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];