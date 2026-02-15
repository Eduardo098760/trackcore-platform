import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

export interface ConnectionStatus {
  isOnline: boolean;
  lastCheck: Date | null;
  error: string | null;
}

export function useConnectionStatus(checkInterval: number = 30000) {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: false,
    lastCheck: null,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    try {
      // Tenta fazer uma chamada simples à API do Traccar
      const response = await fetch('/api/traccar/server', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
      });

      if (response.ok) {
        setStatus({
          isOnline: true,
          lastCheck: new Date(),
          error: null,
        });
      } else {
        setStatus({
          isOnline: false,
          lastCheck: new Date(),
          error: `Erro ${response.status}`,
        });
      }
    } catch (error) {
      setStatus({
        isOnline: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }, []);

  useEffect(() => {
    // Verifica imediatamente
    checkConnection();

    // Configura verificação periódica
    const interval = setInterval(checkConnection, checkInterval);

    return () => clearInterval(interval);
  }, [checkConnection, checkInterval]);

  return { ...status, refresh: checkConnection };
}
