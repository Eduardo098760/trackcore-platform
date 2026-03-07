'use client';

import { useState, useEffect } from 'react';
import { Bell, Moon, Sun, LogOut, User, Settings, UserCheck, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/auth';

import { ConnectionStatus } from '@/components/ui/connection-status';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { NotificationPanel } from '@/components/layout/notification-panel';
import { useImpersonation } from '@/lib/hooks/useImpersonation';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { user, clearAuth, isImpersonating, adminSnapshot } = useAuthStore();
  const { returnToAdmin, loading: impersonationLoading } = useImpersonation();

  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  // Título da página baseado na rota atual
  const pageTitle = (() => {
    const routes: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/map': 'Mapa',
      '/routes': 'Rotas',
      '/vehicles': 'Veículos',
      '/history': 'Histórico',
      '/events': 'Eventos',
      '/commands': 'Comandos',
      '/video': 'VideoTelemetria',
      '/video-alerts': 'Alertas de Vídeo',
      '/cameras': 'Câmeras',
      '/geofences': 'Cercas Eletrônicas',
      '/notifications': 'Notificações',
      '/reports': 'Relatórios',
      '/groups': 'Grupos',
      '/calendars': 'Calendários',
      '/computed-attributes': 'Atributos Computados',
      '/obd': 'Computador de Bordo',
      '/statistics': 'Estatísticas',
      '/clients': 'Clientes',
      '/users': 'Usuários',
      '/audit': 'Logs de Auditoria',
      '/settings': 'Configurações',
      '/access-control': 'Controle de Acesso',
      '/drivers': 'Motoristas',
      '/maintenance': 'Manutenção',
      '/organizations': 'Organizações',
      '/shared-access': 'Acesso Compartilhado',
      '/replay': 'Replay',
      '/notification-templates': 'Templates de Notificação',
    };
    if (!pathname) return '';
    return routes[pathname] || '';
  })();

  // Query para buscar notificações não lidas
  const { data: notifications = [] } = useQuery({
    queryKey: ['inAppNotifications'],
    queryFn: async () => {
      const stored = localStorage.getItem('inAppNotifications');
      return stored ? JSON.parse(stored) : [];
    },
    refetchInterval: 10000,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Listener SEMPRE ATIVO (Header nunca desmonta) para atualizar badge e cache
  // assim que uma notificação é criada ou limpada (troca de usuário / logout)
  useEffect(() => {
    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    };
    const handleCleared = () => {
      // Remove imediatamente do cache sem buscar localStorage (já foi apagado)
      queryClient.setQueryData(['inAppNotifications'], []);
    };
    window.addEventListener('notificationAdded', handleNewNotification);
    window.addEventListener('notificationsCleared', handleCleared);
    return () => {
      window.removeEventListener('notificationAdded', handleNewNotification);
      window.removeEventListener('notificationsCleared', handleCleared);
    };
  }, [queryClient]);

  const handleLogout = () => {
    queryClient.clear(); // limpa todo o cache ao sair
    clearAuth();
    router.push('/login');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin:          'Administrador',
      manager:        'Gerente',
      user:           'Usuário',
      readonly:       'Somente Leitura',
      deviceReadonly: 'Leit. Dispositivos',
      // retrocompat
      superadmin: 'Administrador',
      operator:   'Usuário',
      client:     'Somente Leitura',
    };
    return labels[role] || role;
  };

  return (
    <>
      {/* Banner de impersonação — aparece quando admin entra como outro usuário */}
      {isImpersonating && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500 text-amber-950 text-sm font-medium z-50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>
              Você está visualizando como <strong>{user?.name}</strong>
              {adminSnapshot?.user?.name && (
                <span className="font-normal opacity-75"> · Admin: {adminSnapshot.user.name}</span>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => returnToAdmin()}
            disabled={impersonationLoading}
            className="h-7 px-3 text-xs text-amber-950 hover:bg-amber-400/60 font-semibold gap-1.5"
          >
            {impersonationLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <LogOut className="w-3.5 h-3.5" />}
            {impersonationLoading ? 'Saindo...' : 'Voltar ao Admin'}
          </Button>
        </div>
      )}

    <header className="relative flex items-center justify-between h-14 px-4 bg-gray-950/95 dark:bg-black/95 border-b border-white/[0.06] backdrop-blur-xl">
      {/* Left: Page title */}
      <div className="flex items-center gap-3 min-w-0">
        {pageTitle && (
          <h1 className="text-sm font-semibold text-gray-200 truncate">{pageTitle}</h1>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Connection Status */}
        <ConnectionStatus />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative h-8 w-8 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <NotificationBadge 
          count={unreadCount} 
          onClick={() => setNotificationPanelOpen(true)} 
        />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:ring-2 hover:ring-blue-500/30 transition-all ml-1">
              <Avatar className="h-9 w-9 ring-2 ring-white/10">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-xs font-bold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground mt-1">
                  {user?.role && getRoleLabel(user.role)}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notification Panel */}
      <NotificationPanel 
        open={notificationPanelOpen} 
        onOpenChange={setNotificationPanelOpen} 
      />
    </header>
    </>
  );
}
