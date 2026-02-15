import { ReportFilter, TripReport, StopReport, Event } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function generateTripReport(filter: ReportFilter): Promise<TripReport[]> {
  const response = await fetch(`${API_URL}/reports/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(filter),
  });

  if (!response.ok) {
    throw new Error('Failed to generate trip report');
  }

  return response.json();
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
