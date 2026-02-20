import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Organization } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  email: string | null;
  password: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  setAuth: (user: User, token: string, organization?: Organization, email?: string, password?: string, rememberMe?: boolean) => void;
  clearAuth: () => void;
  getCredentials: () => { email: string | null; password: string | null };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      organization: null,
      email: null,
      password: null,
      isAuthenticated: false,
      rememberMe: false,
      setAuth: (user, token, organization, email, password, rememberMe = true) => {
        console.log('Salvando autenticação:', { email, rememberMe, organization: organization?.name });
        set({ 
          user, 
          token,
          organization: organization || null,
          email: rememberMe ? email : null,
          password: rememberMe ? password : null,
          isAuthenticated: true,
          rememberMe 
        });
      },
      clearAuth: () => {
        console.log('Limpando autenticação');
        set({ 
          user: null, 
          token: null,
          organization: null,
          email: null,
          password: null,
          isAuthenticated: false,
          rememberMe: false 
        });
      },
      getCredentials: () => ({
        email: get().email,
        password: get().password
      }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
