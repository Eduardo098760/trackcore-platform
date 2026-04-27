import type { Device, Event, Position } from '@/types';
import type {
  KPI,
  KPIEvaluationResult,
  KPIReportFrequency,
  KPIReportPeriod,
  KPIReportSchedule,
} from '@/types/kpi';

interface KPIRuntimeData {
  devices: Device[];
  positions: Position[];
  events?: Event[];
  now?: Date;
}

type ScheduleTimingInput = Pick<KPIReportSchedule, 'frequency' | 'deliveryTime' | 'weeklyDay'>;
type ScheduleDispatchInput = Pick<KPIReportSchedule, 'enabled' | 'nextRunAt'>;

function parseDeliveryTime(value?: string) {
  const [rawHour = '18', rawMinute = '0'] = String(value || '18:00').split(':');
  const hour = Math.min(23, Math.max(0, Number(rawHour) || 18));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));
  return { hour, minute };
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = Number(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'sim', 'ativo'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'nao', 'não', 'inativo'].includes(normalized)) return false;
  }
  return null;
}

function humanizePeriod(period: KPI['period'] | KPIReportPeriod) {
  switch (period) {
    case '1h':
      return 'Última hora';
    case '24h':
      return 'Últimas 24h';
    case '7d':
      return 'Últimos 7 dias';
    case '15d':
      return 'Últimos 15 dias';
    case '30d':
      return 'Últimos 30 dias';
    case 'current':
      return 'Snapshot atual';
    case 'custom':
      return 'Período personalizado';
    default:
      return 'Período atual';
  }
}

function getValueFromSources(kpi: KPI, device: Device, position?: Position) {
  const deviceAttributes = (device as any)?.attributes || {};
  const positionAttributes = position?.attributes || {};
  const key = kpi.sensorKey;

  if (kpi.source === 'device') {
    return (device as any)[key] ?? deviceAttributes[key];
  }

  if (kpi.source === 'position') {
    return positionAttributes[key] ?? (position as any)?.[key];
  }

  return (
    positionAttributes[key] ??
    (position as any)?.[key] ??
    (device as any)[key] ??
    deviceAttributes[key]
  );
}

function formatResultValue(value: number | string, unit?: string) {
  if (typeof value === 'number') {
    const formatted = Number.isInteger(value)
      ? value.toLocaleString('pt-BR')
      : value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: value < 10 ? 2 : 0 });
    return unit ? `${formatted} ${unit}` : formatted;
  }

  return unit ? `${value} ${unit}` : value;
}

function aggregateKpi(kpi: KPI, values: unknown[]) {
  const type = kpi.sensorType || 'number';

  if (type === 'boolean') {
    const boolValues = values.map(toBoolean).filter((entry): entry is boolean => entry !== null);
    const positives = boolValues.filter(Boolean).length;

    switch (kpi.aggregation) {
      case 'avg':
        return boolValues.length ? (positives / boolValues.length) * 100 : 0;
      case 'min':
        return positives === boolValues.length && boolValues.length > 0 ? 1 : 0;
      case 'max':
        return positives > 0 ? 1 : 0;
      case 'sum':
      case 'count':
      default:
        return positives;
    }
  }

  if (type === 'string') {
    const stringValues = values
      .map((value) => (value == null ? '' : String(value).trim()))
      .filter(Boolean);

    if (kpi.aggregation === 'count') {
      return stringValues.length;
    }

    return stringValues[0] || 'Sem leitura';
  }

  const numericValues = values.map(toNumber).filter((entry): entry is number => entry !== null);
  if (numericValues.length === 0) return 0;

  switch (kpi.aggregation) {
    case 'sum':
      return numericValues.reduce((sum, value) => sum + value, 0);
    case 'avg':
      return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    case 'min':
      return Math.min(...numericValues);
    case 'max':
      return Math.max(...numericValues);
    case 'count':
    default:
      return numericValues.length;
  }
}

export function evaluateKpi(kpi: KPI, runtime: KPIRuntimeData): KPIEvaluationResult {
  const now = runtime.now ?? new Date();
  const positionMap = new Map(runtime.positions.map((position) => [position.deviceId, position]));
  const sampledValues = runtime.devices
    .map((device) => getValueFromSources(kpi, device, positionMap.get(device.id)))
    .filter((entry) => entry !== undefined && entry !== null && entry !== '');

  const rawValue = aggregateKpi(kpi, sampledValues);
  const periodLabel = humanizePeriod(kpi.period);
  const basis = kpi.period === 'custom' || kpi.period === '1h' || kpi.period === '24h' || kpi.period === '7d' || kpi.period === '15d' || kpi.period === '30d'
    ? `Base configurada: ${periodLabel.toLowerCase()} (${kpi.source === 'device' ? 'atributos do veículo' : kpi.source === 'position' ? 'telemetria atual' : 'atributo computado atual'})`
    : 'Base configurada: snapshot atual do atributo computado';

  return {
    kpiId: kpi.id,
    value: formatResultValue(rawValue, kpi.unit),
    rawValue,
    label: kpi.name,
    subtext: `${kpi.aggregation.toUpperCase()} em ${sampledValues.length} leitura(s)`,
    basis,
    periodLabel,
    sampleCount: sampledValues.length,
    timestamp: now.toISOString(),
  };
}

export function computeNextRunAt(schedule: ScheduleTimingInput, referenceDate = new Date()) {
  const { hour, minute } = parseDeliveryTime(schedule.deliveryTime);
  const next = new Date(referenceDate);
  next.setSeconds(0, 0);

  if (schedule.frequency === 'daily') {
    next.setHours(hour, minute, 0, 0);
    if (next <= referenceDate) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (schedule.frequency === 'weekly') {
    const weeklyDay = schedule.weeklyDay ?? 5;
    next.setHours(hour, minute, 0, 0);
    const distance = (weeklyDay - next.getDay() + 7) % 7;
    if (distance === 0 && next <= referenceDate) {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + distance);
    }
    return next.toISOString();
  }

  if (schedule.frequency === 'fortnightly') {
    next.setHours(hour, minute, 0, 0);
    next.setDate(next.getDate() + 15);
    return next.toISOString();
  }

  next.setMonth(next.getMonth() + 1, 0);
  next.setHours(hour, minute, 0, 0);
  if (next <= referenceDate) {
    next.setMonth(next.getMonth() + 2, 0);
    next.setHours(hour, minute, 0, 0);
  }
  return next.toISOString();
}

export function shouldDispatchSchedule(schedule: ScheduleDispatchInput | null | undefined, referenceDate = new Date()) {
  if (!schedule?.enabled || !schedule.nextRunAt) return false;
  const nextRunAt = new Date(schedule.nextRunAt);
  return Number.isFinite(nextRunAt.getTime()) && nextRunAt <= referenceDate;
}

export function normalizeSchedule(schedule: KPIReportSchedule | null | undefined) {
  if (!schedule) return null;

  return {
    ...schedule,
    recipients: schedule.recipients.filter(Boolean),
    nextRunAt: schedule.nextRunAt || computeNextRunAt(schedule),
  };
}

export function resolveReportWindow(period: KPIReportPeriod, referenceDate = new Date()) {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);

  switch (period) {
    case '24h':
      start.setDate(end.getDate() - 1);
      break;
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '15d':
      start.setDate(end.getDate() - 15);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case 'current':
    default:
      start.setMinutes(start.getMinutes() - 5);
      break;
  }

  return {
    label: humanizePeriod(period),
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export function getFrequencyLabel(frequency: KPIReportFrequency) {
  switch (frequency) {
    case 'daily':
      return 'todo final do dia';
    case 'weekly':
      return 'todo final da semana';
    case 'fortnightly':
      return 'a cada quinzena';
    case 'monthly':
      return 'todo final do mês';
    default:
      return frequency;
  }
}