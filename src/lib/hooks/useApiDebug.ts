'use client';

/**
 * Hook personalizado para debugar as chamadas à API
 * Use este componente na página de veículos para ver o que está acontecendo
 */

import { useEffect } from 'react';
import { api } from '@/lib/api/client';

export function useApiDebug() {
  useEffect(() => {
    console.log('🔧 API Debug Iniciado');
    console.log('📍 Base URL:', api.getConfig().baseURL);
    console.log('🔑 Auth Token:', api.getAuthToken() ? 'Presente' : 'Ausente');
    
    // Interceptar fetch para logar todas as chamadas
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      console.log('🌐 Fetch Request:', {
        url: typeof url === 'string' ? url : url.toString(),
        method: options?.method || 'GET',
        credentials: options?.credentials,
        headers: options?.headers,
      });
      
      try {
        const response = await originalFetch(...args);
        console.log('✅ Fetch Response:', {
          url: typeof url === 'string' ? url : url.toString(),
          status: response.status,
          ok: response.ok,
        });
        return response;
      } catch (error) {
        console.error('❌ Fetch Error:', {
          url: typeof url === 'string' ? url : url.toString(),
          error,
        });
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
}
