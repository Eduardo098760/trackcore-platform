'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth';
import { login } from '@/lib/api/auth';

export function useAutoLogin() {
  const { isAuthenticated, getCredentials, setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const attemptAutoLogin = async () => {
      // Se já está autenticado, não faz nada
      if (isAuthenticated) {
        setIsLoading(false);
        return;
      }

      const { email, password } = getCredentials();

      // Se não tem credenciais salvas, não pode fazer auto-login
      if (!email || !password) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('[useAutoLogin] Tentando auto-login com', email);
        const response = await login(email, password);
        setAuth(response.user, response.token, email, password, true);
        console.log('[useAutoLogin] Auto-login bem-sucedido');
      } catch (err: any) {
        console.error('[useAutoLogin] Auto-login falhou:', err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    attemptAutoLogin();
  }, []);

  return { isLoading, error };
}
