import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, TenantContext } from '@/types';

interface TenantState {
  organization: Organization | null;
  context: TenantContext | null;
  setOrganization: (organization: Organization | null) => void;
  setContext: (context: TenantContext | null) => void;
  clear: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      organization: null,
      context: null,
      setOrganization: (organization) => set({ organization }),
      setContext: (context) => set({ context }),
      clear: () => set({ organization: null, context: null }),
    }),
    {
      name: 'tenant-storage',
    }
  )
);
