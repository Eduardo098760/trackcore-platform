'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  Search, Shield, User, Settings, Trash2, Edit, Eye, Database,
  ChevronLeft, ChevronRight, RefreshCw, LogIn, LogOut, AlertTriangle,
  Wifi, WifiOff, Zap, ZapOff, MapPin, Bell, Clock
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditLog } from '@/types';

// ── Constantes de UI ──────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  CREATE:       'bg-green-500',
  UPDATE:       'bg-blue-500',
  DELETE:       'bg-red-500',
  VIEW:         'bg-slate-500',
  LOGIN:        'bg-purple-500',
  LOGOUT:       'bg-purple-400',
  FAILED_LOGIN: 'bg-red-600',
  CONNECT:      'bg-emerald-500',
  DISCONNECT:   'bg-orange-500',
  MOVING:       'bg-cyan-500',
  STOPPED:      'bg-yellow-500',
  IGNITION_ON:  'bg-green-600',
  IGNITION_OFF: 'bg-gray-500',
  OVERSPEED:    'bg-red-500',
  ENTER:        'bg-teal-500',
  EXIT:         'bg-pink-500',
  ALARM:        'bg-red-700',
  FUEL_DROP:    'bg-amber-500',
  EVENT:        'bg-slate-400',
};

const ACTION_ICONS: Record<string, any> = {
  CREATE:       Database,
  UPDATE:       Edit,
  DELETE:       Trash2,
  VIEW:         Eye,
  LOGIN:        LogIn,
  LOGOUT:       LogOut,
  FAILED_LOGIN: Shield,
  CONNECT:      Wifi,
  DISCONNECT:   WifiOff,
  MOVING:       MapPin,
  STOPPED:      Clock,
  IGNITION_ON:  Zap,
  IGNITION_OFF: ZapOff,
  OVERSPEED:    AlertTriangle,
  ENTER:        MapPin,
  EXIT:         MapPin,
  ALARM:        Bell,
};

const ACTION_LABELS: Record<string, string> = {
  CREATE:       'Criação',
  UPDATE:       'Atualização',
  DELETE:       'Exclusão',
  VIEW:         'Visualização',
  LOGIN:        'Login',
  LOGOUT:       'Logout',
  FAILED_LOGIN: 'Login Falho',
  CONNECT:      'Conexão',
  DISCONNECT:   'Desconexão',
  MOVING:       'Em Movimento',
  STOPPED:      'Parado',
  IGNITION_ON:  'Ignição Ligada',
  IGNITION_OFF: 'Ignição Desligada',
  OVERSPEED:    'Excesso Velocidade',
  ENTER:        'Entrou Cerca',
  EXIT:         'Saiu Cerca',
  ALARM:        'Alarme',
  FUEL_DROP:    'Queda Combustível',
};

const RESOURCE_LABELS: Record<string, string> = {
  auth:     'Autenticação',
  device:   'Dispositivo',
  geofence: 'Cerca Virtual',
  report:   'Relatório',
  settings: 'Configurações',
  driver:   'Motorista',
  devices:  'Dispositivos',
  reports:  'Relatórios',
};

const DATE_PRESETS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Tudo', value: 'all' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPresetDates(preset: string): { from: string; to: string } | null {
  const now = new Date();
  if (preset === 'today')
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (preset === 'yesterday') {
    const y = subDays(now, 1);
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
  }
  if (preset === '7d')
    return { from: subDays(now, 7).toISOString(), to: now.toISOString() };
  if (preset === '30d')
    return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
  return null; // 'all'
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch { return ts; }
}

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchMeta() {
  const r = await fetch('/api/audit?meta=1&syncTraccar=1');
  if (!r.ok) throw new Error('Falha ao carregar metadados');
  return r.json() as Promise<{ actions: string[]; resources: string[]; stats: { total: number; today: number; failedLogins: number; uniqueUsers: number } }>;
}

async function fetchLogs(params: URLSearchParams) {
  params.set('syncTraccar', '1');
  const r = await fetch(`/api/audit?${params}`);
  if (!r.ok) throw new Error('Falha ao carregar logs');
  return r.json() as Promise<{ logs: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }>;
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function AuditPage() {
  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction]     = useState('all');
  const [filterResource, setFilterResource] = useState('all');
  const [datePreset, setDatePreset]   = useState('7d');
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 20;

  const dates = getPresetDates(datePreset);

  const logsParams = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) p.set('search', search);
    if (filterAction !== 'all') p.set('action', filterAction);
    if (filterResource !== 'all') p.set('resource', filterResource);
    if (dates) { p.set('from', dates.from); p.set('to', dates.to); }
    return p;
  }, [search, filterAction, filterResource, dates, page]);

  const { data: meta, refetch: refetchMeta } = useQuery({
    queryKey: ['audit-meta'],
    queryFn: fetchMeta,
    staleTime: 30_000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', search, filterAction, filterResource, datePreset, page],
    queryFn: () => fetchLogs(logsParams()),
    staleTime: 15_000,
  });

  const handleRefresh = () => { refetch(); refetchMeta(); };

  const stats = meta?.stats ?? { total: 0, today: 0, failedLogins: 0, uniqueUsers: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de Auditoria"
        description="Histórico completo de ações e eventos do sistema"
        icon={Shield}
      />

      {/* ── Stats ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Hoje</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logins Falhos</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failedLogins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <User className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.uniqueUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por usuário, ação, IP..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>

            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {(meta?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterResource} onValueChange={(v) => { setFilterResource(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Recurso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os recursos</SelectItem>
                {(meta?.resources ?? []).map((r) => (
                  <SelectItem key={r} value={r}>{RESOURCE_LABELS[r] ?? r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Timeline ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de Eventos</CardTitle>
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.total.toLocaleString('pt-BR')} evento{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-red-500 mb-2">Erro ao carregar logs</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>Tentar novamente</Button>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <div className="space-y-3">
                {(data?.logs ?? []).map((log) => {
                  const ActionIcon = ACTION_ICONS[log.action] ?? Settings;
                  const color = ACTION_COLORS[log.action] ?? 'bg-slate-400';
                  return (
                    <div
                      key={log.id}
                      className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {/* Ícone */}
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                          <ActionIcon className="h-5 w-5 text-white" />
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${color} text-white text-xs`}>
                              {ACTION_LABELS[log.action] ?? log.action}
                            </Badge>
                            <span className="text-sm font-medium">{log.userName}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {RESOURCE_LABELS[log.resource] ?? log.resource}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 truncate" title={log.details}>
                          {log.details}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.ipAddress}
                          </span>
                          {log.userAgent && log.userAgent !== 'Traccar Server' && (
                            <span className="truncate max-w-xs" title={log.userAgent}>
                              {log.userAgent.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(data?.logs ?? []).length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum evento encontrado para os filtros selecionados</p>
                </div>
              )}

              {/* ── Paginação ── */}
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {data.page} de {data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={data.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={data.page >= data.totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
