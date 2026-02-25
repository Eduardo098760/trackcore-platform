/**
 * Store de auditoria de impersonação.
 * Persiste os eventos no localStorage para histórico local.
 * Complementa o audit log server-side (console do servidor).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuditEventType = 'IMPERSONATION_START' | 'IMPERSONATION_STOP';

export interface AuditEvent {
  id:           string;
  type:         AuditEventType;
  actorId:      number;
  actorName:    string;
  actorEmail:   string;
  targetId:     number;
  targetName:   string;
  targetEmail:  string;
  timestamp:    string;
  durationSec?: number; // preenchido em IMPERSONATION_STOP
}

interface AuditState {
  events: AuditEvent[];
  addEvent:    (e: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (e) => {
        const event: AuditEvent = {
          ...e,
          id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        // Mantém os 500 eventos mais recentes
        set({ events: [event, ...get().events].slice(0, 500) });
      },

      clearEvents: () => set({ events: [] }),
    }),
    {
      name:    'trackcore-audit-log',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
