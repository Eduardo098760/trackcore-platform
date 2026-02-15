import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  email: string | null;
  password: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  setAuth: (user: User, token: string, email?: string, password?: string, rememberMe?: boolean) => void;
  clearAuth: () => void;
  getCredentials: () => { email: string | null; password: string | null };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      email: null,
      password: null,
      isAuthenticated: false,
      rememberMe: false,
      setAuth: (user, token, email, password, rememberMe = true) => {
        console.log('Salvando autenticação:', { email, rememberMe });
        set({ 
          user, 
          token, 
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
