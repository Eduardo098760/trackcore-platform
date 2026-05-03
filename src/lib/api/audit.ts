import type { AuditLog } from '@/types';

type AuditPayload = Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent'> & {
  details?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function trackAuditEvent(payload: AuditPayload): Promise<void> {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...payload,
        details: payload.details ?? '',
        userAgent: payload.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      }),
    });
  } catch {
    // best effort: auditoria não deve quebrar fluxo principal
  }
}