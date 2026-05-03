import type { AuditLog } from '@/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

// ── In-memory store (persists for the lifetime of the Node process) ──────────
let nextId = 1;
const store: AuditLog[] = [];
const AUDIT_STORE_FILE = resolve(process.cwd(), 'data', 'audit-logs.json');

// ── Seed com eventos realistas para não começar vazio ────────────────────────
const now = Date.now();
const seed: Omit<AuditLog, 'id'>[] = [
  {
    userId: 1,
    userName: 'Admin',
    action: 'LOGIN',
    resource: 'auth',
    details: 'Login realizado com sucesso',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(now - 1000 * 60 * 2).toISOString(),
  },
  {
    userId: 1,
    userName: 'Admin',
    action: 'VIEW',
    resource: 'devices',
    details: 'Listagem de dispositivos acessada',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(now - 1000 * 60 * 10).toISOString(),
  },
  {
    userId: 1,
    userName: 'Admin',
    action: 'VIEW',
    resource: 'reports',
    details: 'Relatório de viagens gerado',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date(now - 1000 * 60 * 30).toISOString(),
  },
];

function getLogSignature(log: Omit<AuditLog, 'id'>) {
  return [
    log.userId,
    log.userName,
    log.action,
    log.resource,
    log.resourceId ?? '',
    log.details,
    log.ipAddress,
    log.userAgent,
    log.timestamp,
  ].join('|');
}

function persistStore() {
  mkdirSync(dirname(AUDIT_STORE_FILE), { recursive: true });
  writeFileSync(AUDIT_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function loadInitialStore() {
  if (existsSync(AUDIT_STORE_FILE)) {
    try {
      const raw = readFileSync(AUDIT_STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as AuditLog[];
      if (Array.isArray(parsed)) {
        store.splice(0, store.length, ...parsed);
        const maxId = parsed.reduce((acc, log) => Math.max(acc, log.id || 0), 0);
        nextId = maxId + 1;
        return;
      }
    } catch {
      // fallback para seed abaixo
    }
  }

  for (const entry of seed) {
    store.push({ ...entry, id: nextId++ });
  }
  persistStore();
}

loadInitialStore();

// ── Tipos públicos ────────────────────────────────────────────────────────────
export interface AuditFilters {
  action?: string;
  resource?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Funções públicas ──────────────────────────────────────────────────────────
export function addAuditLog(entry: Omit<AuditLog, 'id'>): AuditLog {
  const existing = store.find((log) => getLogSignature(log) === getLogSignature(entry));
  if (existing) return existing;

  const log: AuditLog = { ...entry, id: nextId++ };
  store.unshift(log); // mais recente primeiro
  // Limitar a 5000 entradas para evitar crescimento ilimitado
  if (store.length > 5000) store.splice(5000);
  persistStore();
  return log;
}

export function getAuditLogs(filters: AuditFilters = {}): AuditPage {
  const {
    action,
    resource,
    search,
    from,
    to,
    page = 1,
    pageSize = 25,
  } = filters;

  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() : Infinity;
  const searchLower = search?.toLowerCase() ?? '';

  const filtered = store.filter((log) => {
    const ts = new Date(log.timestamp).getTime();
    if (ts < fromMs || ts > toMs) return false;
    if (action && action !== 'all' && log.action !== action) return false;
    if (resource && resource !== 'all' && log.resource !== resource) return false;
    if (searchLower) {
      const hay = `${log.userName} ${log.details} ${log.ipAddress} ${log.resource}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const logs = filtered.slice(start, start + pageSize);

  return { logs, total, page: safePage, pageSize, totalPages };
}

export function getUniqueActions(): string[] {
  return Array.from(new Set(store.map((l) => l.action))).sort();
}

export function getUniqueResources(): string[] {
  return Array.from(new Set(store.map((l) => l.resource))).sort();
}

export function getAuditStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    total: store.length,
    today: store.filter((l) => new Date(l.timestamp) >= todayStart).length,
    failedLogins: store.filter((l) => l.action === 'FAILED_LOGIN').length,
    uniqueUsers: new Set(store.map((l) => l.userId)).size,
  };
}
