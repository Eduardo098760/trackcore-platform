
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { getCurrentUser, login } from '@/lib/api/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useEventNotifications } from '@/lib/hooks/useEventNotifications';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setAuth, clearAuth, getCredentials, rememberMe } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  // Ativar monitoramento de eventos do Traccar para notificações
  useEventNotifications(isAuthenticated && !isValidating);

  const isMapRoute = !!pathname && (
    pathname === '/map' ||
    pathname.startsWith('/map/') ||
    pathname === '/geofences' ||
    pathname.startsWith('/geofences/')
  );

  useEffect(() => {
    const validateSession = async () => {
      if (!isAuthenticated) {
        // Aguarda re-hidratação do estado persistido antes de forçar logout
        const hasPersist = typeof window !== 'undefined' && !!localStorage.getItem('auth-storage');
        if (!hasPersist) {
          console.log('Não autenticado e sem persistência, redirecionando...');
          router.push('/login');
          setIsValidating(false);
          return;
        }
        console.log('Estado não autenticado, mas há dados persistidos — tentando validar sessão...');
      } else {
        console.log('Usuário autenticado, verificando sessão...');
      }
      
      try {
        // Verifica se a sessão do Traccar ainda é válida
        const user = await getCurrentUser();
        console.log('Sessão válida:', user.email);
        // Mantém autenticação
        setIsValidating(false);
      } catch (error) {
        console.log('Erro ao validar sessão:', error);
        
        // Tenta re-autenticar automaticamente
        const { email, password } = getCredentials();
        
        if (email && password && rememberMe) {
          console.log('Tentando re-autenticar com credenciais salvas...');
          try {
            const response = await login(email, password);
            console.log('Re-autenticação bem-sucedida');
            setAuth(response.user, response.token, email, password, true);
            setIsValidating(false);
          } catch (reloginError) {
            console.error('Re-autenticação falhou:', reloginError);
            clearAuth();
            router.push('/login');
          }
        } else {
          console.log('Sem credenciais salvas, fazendo logout');
          clearAuth();
          router.push('/login');
        }
      }
    };

    validateSession();

    // Renova a sessão a cada 15 minutos (menos agressivo)
    const interval = setInterval(async () => {
      try {
        await getCurrentUser();
        console.log('Sessão renovada');
      } catch (error) {
        console.log('Erro ao renovar sessão, tentando re-login...');
        const { email, password } = getCredentials();
        if (email && password && rememberMe) {
          try {
            await login(email, password);
            console.log('Re-login automático bem-sucedido');
          } catch (e) {
            console.error('Re-login falhou');
          }
        }
      }
    }, 15 * 60 * 1000); // 15 minutos

    return () => clearInterval(interval);
  }, [isAuthenticated, router, setAuth, clearAuth, getCredentials, rememberMe]);

  if (!isAuthenticated || isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className={isMapRoute ? 'flex-1 overflow-hidden p-0 bg-theme-background' : 'flex-1 overflow-y-auto p-6 bg-theme-background'}>
          {children}
        </main>
      </div>  
    </div>
  );
}
