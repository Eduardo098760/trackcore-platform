import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  language: string;
  mapProvider: 'mapbox' | 'google';
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  setTheme: (theme: Theme) => void;
  setLanguage: (language: string) => void;
  setMapProvider: (provider: 'mapbox' | 'google') => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'pt-BR',
      mapProvider: 'mapbox',
      autoRefresh: true,
      refreshInterval: 30,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setMapProvider: (provider) => set({ mapProvider: provider }),
      setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
    }),
    {
      name: 'settings-storage',
    }
  )
);
