import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { KPI } from '@/types/kpi';
import { normalizeSchedule } from '@/lib/kpi-engine';

interface KPIStoreData {
  kpis: KPI[];
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'kpis.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): KPIStoreData {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) {
    return { kpis: [] };
  }

  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const items: Partial<KPI>[] = Array.isArray(parsed?.kpis) ? parsed.kpis : [];
    return {
      kpis: items.map((item) => ({
        ...item,
        reportSchedule: normalizeSchedule(item.reportSchedule),
      })) as KPI[],
    };
  } catch {
    return { kpis: [] };
  }
}

function writeStore(data: KPIStoreData) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function listKpis(organizationId?: number) {
  const store = readStore();
  if (organizationId == null) return store.kpis;
  return store.kpis.filter((kpi) => kpi.organizationId === organizationId);
}

export function getKpi(id: string) {
  return readStore().kpis.find((kpi) => kpi.id === id) || null;
}

export function createKpi(input: Omit<KPI, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const store = readStore();
  const item: KPI = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date(now) as any,
    updatedAt: new Date(now) as any,
    reportSchedule: normalizeSchedule(input.reportSchedule),
  };

  store.kpis.push(item);
  writeStore(store);
  return item;
}

export function updateKpi(id: string, input: Partial<KPI>) {
  const store = readStore();
  const index = store.kpis.findIndex((kpi) => kpi.id === id);
  if (index < 0) return null;

  const current = store.kpis[index];
  const updated: KPI = {
    ...current,
    ...input,
    id,
    updatedAt: new Date() as any,
    reportSchedule: input.reportSchedule !== undefined
      ? normalizeSchedule(input.reportSchedule)
      : current.reportSchedule,
  };

  store.kpis[index] = updated;
  writeStore(store);
  return updated;
}

export function deleteKpi(id: string) {
  const store = readStore();
  const nextItems = store.kpis.filter((kpi) => kpi.id !== id);
  if (nextItems.length === store.kpis.length) return false;
  writeStore({ kpis: nextItems });
  return true;
}

export function saveKpis(items: KPI[]) {
  writeStore({ kpis: items });
}