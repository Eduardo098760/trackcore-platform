import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { RoutePermissions } from '@/lib/permissions/types';

export interface UserEntry {
  inheritFromCompany: boolean;
  routes: RoutePermissions;
  appliedPresetId?: string;
  appliedPresetName?: string;
}

export interface PermissionPreset {
  id: string;
  name: string;
  description?: string;
  routes: RoutePermissions;
  createdAt: string;
}

interface PermissionsState {
  /** Permissões por empresa: { [companyId]: RoutePermissions } */
  companies: Record<number, RoutePermissions>;
  /** Permissões por usuário: { [userId]: UserEntry } */
  users: Record<number, UserEntry>;
  /** Presets salvos: { [presetId]: PermissionPreset } */
  presets: Record<string, PermissionPreset>;

  // ── Mutações ──────────────────────────────────────────────────────
  setCompanyPermissions: (companyId: number, routes: RoutePermissions) => void;
  setUserPermissions: (userId: number, entry: UserEntry) => void;
  removeCompanyPermissions: (companyId: number) => void;
  removeUserPermissions: (userId: number) => void;
  setPreset: (preset: PermissionPreset) => void;
  removePreset: (id: string) => void;
  clearAll: () => void;
}

export const usePermissionsStore = create<PermissionsState>()(
  persist(
    (set) => ({
      companies: {},
      users: {},
      presets: {},

      setCompanyPermissions: (companyId, routes) =>
        set((state) => ({
          companies: { ...state.companies, [companyId]: routes },
        })),

      setUserPermissions: (userId, entry) =>
        set((state) => ({
          users: { ...state.users, [userId]: entry },
        })),

      removeCompanyPermissions: (companyId) =>
        set((state) => {
          const { [companyId]: _, ...rest } = state.companies;
          return { companies: rest };
        }),

      removeUserPermissions: (userId) =>
        set((state) => {
          const { [userId]: _, ...rest } = state.users;
          return { users: rest };
        }),

      setPreset: (preset) =>
        set((state) => ({
          presets: { ...state.presets, [preset.id]: preset },
        })),

      removePreset: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.presets;
          return { presets: rest };
        }),

      clearAll: () => set({ companies: {}, users: {}, presets: {} }),
    }),
    {
      name: 'permissions-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
