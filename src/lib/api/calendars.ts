/**
 * API de Calendários via Traccar real.
 *
 * GET    /calendars         – listar
 * POST   /calendars         – criar
 * PUT    /calendars/{id}    – atualizar
 * DELETE /calendars/{id}    – remover
 *
 * O campo `data` contém um iCal (VCALENDAR) codificado em Base64.
 */
import { api } from './client';

export interface TraccarCalendar {
  id: number;
  name: string;
  data: string;  // iCal VCALENDAR em Base64
  attributes?: Record<string, any>;
}

/** Codifica string iCal para Base64 (formato esperado pelo Traccar) */
export function encodeCalendarData(ical: string): string {
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(ical)));
  }
  return Buffer.from(ical, 'utf-8').toString('base64');
}

/** Decodifica Base64 do Traccar para string iCal legível */
export function decodeCalendarData(base64: string): string {
  try {
    if (typeof window !== 'undefined') {
      return decodeURIComponent(escape(atob(base64)));
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return base64; // se já está em texto puro
  }
}

/** Gera uma string VCALENDAR iCal a partir de dias/horas */
export function buildICalData(
  startTime: string,
  endTime: string,
  days: string[],
): string {
  const byday = days.join(',');
  const dtstart = `20240101T${startTime.replace(':', '')}00`;
  const dtend = `20240101T${endTime.replace(':', '')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrackCore//Calendar//PT',
    'BEGIN:VEVENT',
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function getCalendars(): Promise<TraccarCalendar[]> {
  return api.get<TraccarCalendar[]>('/calendars');
}

export async function createCalendar(
  data: Omit<TraccarCalendar, 'id'>,
): Promise<TraccarCalendar> {
  return api.post<TraccarCalendar>('/calendars', data);
}

export async function updateCalendar(
  id: number,
  data: TraccarCalendar,
): Promise<TraccarCalendar> {
  return api.put<TraccarCalendar>(`/calendars/${id}`, data);
}

export async function deleteCalendar(id: number): Promise<void> {
  return api.delete<void>(`/calendars/${id}`);
}
