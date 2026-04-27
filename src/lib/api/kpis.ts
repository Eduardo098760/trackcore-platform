import type { KPI, KPIEvaluationResult } from '@/types/kpi';

interface KPIListResponse {
  kpis: KPI[];
}

interface DispatchResponse {
  sent: number;
  results: Array<{
    kpiId: string;
    name: string;
    recipients: string[];
    status: 'sent' | 'skipped' | 'error';
    message?: string;
  }>;
}

export async function getKpis(organizationId?: number) {
  const searchParams = new URLSearchParams();
  if (organizationId != null) {
    searchParams.set('organizationId', String(organizationId));
  }

  const response = await fetch(`/api/kpis${searchParams.toString() ? `?${searchParams.toString()}` : ''}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Falha ao carregar KPIs');
  }

  return (await response.json()) as KPIListResponse;
}

export async function createKpi(input: Partial<KPI>) {
  const response = await fetch('/api/kpis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Falha ao criar KPI');
  }

  return (await response.json()) as KPI;
}

export async function updateKpi(id: string, input: Partial<KPI>) {
  const response = await fetch(`/api/kpis/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Falha ao atualizar KPI');
  }

  return (await response.json()) as KPI;
}

export async function deleteKpi(id: string) {
  const response = await fetch(`/api/kpis/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Falha ao excluir KPI');
  }
}

export async function dispatchKpiReports(payload: { kpiId?: string; force?: boolean; organizationId?: number }) {
  const response = await fetch('/api/kpis/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Falha ao enviar relatórios de KPI');
  }

  return (await response.json()) as DispatchResponse;
}