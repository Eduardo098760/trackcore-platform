import { ReportFilter, TripReport, StopReport, Event } from '@/types';

const API_URL = '/api';

export async function generateTripReport(filter: ReportFilter): Promise<TripReport[]> {
  console.log('[generateTripReport] Iniciando requisição (trips-v2)...');
  console.log('[generateTripReport] URL:', `${API_URL}/reports/trips-v2`);
  console.log('[generateTripReport] Filter:', JSON.stringify(filter, null, 2));

  // Helper: fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(id);
    }
  };

  try {
    const response = await fetchWithTimeout(`${API_URL}/reports/trips-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(filter),
    }, 30000);

    console.log('[generateTripReport] trips-v2 status:', response.status, 'ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('[generateTripReport] trips-v2 data length:', Array.isArray(data) ? data.length : 'n/a');
      // If api returned empty or null, fallback to older endpoint
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('[generateTripReport] trips-v2 retornou vazio, tentando `/reports/trips` fallback');
      } else {
        return data;
      }
    } else {
      const errText = await response.text().catch(() => 'no body');
      console.warn('[generateTripReport] trips-v2 não OK:', response.status, errText);
    }
  } catch (err: any) {
    console.warn('[generateTripReport] trips-v2 falhou:', err?.message || err);
  }

  // Fallback: chamar o endpoint direto `/api/reports/trips` (mais direto)
  try {
    console.log('[generateTripReport] Tentando fallback /reports/trips');
    const fallbackResp = await fetchWithTimeout(`${API_URL}/reports/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(filter),
    }, 30000);

    console.log('[generateTripReport] fallback status:', fallbackResp.status);
    if (!fallbackResp.ok) {
      const txt = await fallbackResp.text().catch(() => 'no body');
      throw new Error('Fallback failed: ' + txt);
    }

    const fallbackData = await fallbackResp.json();
    console.log('[generateTripReport] fallback data recebida:', Array.isArray(fallbackData) ? fallbackData.length : 'n/a');
    return fallbackData;
  } catch (err: any) {
    console.error('[generateTripReport] Erro no fallback:', err?.message || err);
    throw new Error('Failed to generate trip report: ' + (err?.message || 'unknown'));
  }
}

export async function generateStopReport(filter: ReportFilter): Promise<StopReport[]> {
  const response = await fetch(`${API_URL}/reports/stops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to generate stop report');
  }

  return response.json();
}

export async function generateEventReport(filter: ReportFilter): Promise<Event[]> {
  const response = await fetch(`${API_URL}/reports/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to generate event report');
  }

  return response.json();
}

export async function exportReportPDF(reportType: string, filter: ReportFilter): Promise<Blob> {
  const response = await fetch(`${API_URL}/reports/${reportType}/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }

  return response.blob();
}

export async function exportReportExcel(reportType: string, filter: ReportFilter): Promise<Blob> {
  const response = await fetch(`${API_URL}/reports/${reportType}/excel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to export Excel');
  }

  return response.blob();
}

export async function generateSummaryReport(filter: ReportFilter): Promise<any[]> {
  const response = await fetch(`${API_URL}/reports/summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to generate summary report');
  }

  return response.json();
}
