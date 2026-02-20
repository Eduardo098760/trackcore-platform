'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Check, 
  Trash2, 
  AlertCircle, 
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface InAppNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  deviceId?: number;
  deviceName?: string;
  eventType?: string;
}

// Mock API - substituir por API real
const getInAppNotifications = async (): Promise<InAppNotification[]> => {
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const stored = localStorage.getItem('inAppNotifications');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Notificações de exemplo
  return [
    {
      id: '1',
      type: 'warning',
      title: 'Velocidade Excedida',
      message: 'Veículo ABC-1234 excedeu 80 km/h na Via Expressa',
      read: false,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      deviceId: 1,
      deviceName: 'ABC-1234',
      eventType: 'speedLimit'
    },
    {
      id: '2',
      type: 'info',
      title: 'Entrada em Cerca',
      message: 'Veículo XYZ-5678 entrou na cerca "Depósito Central"',
      read: false,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      deviceId: 2,
      deviceName: 'XYZ-5678',
      eventType: 'geofenceEnter'
    },
    {
      id: '3',
      type: 'error',
      title: 'Dispositivo Offline',
      message: 'Veículo DEF-9012 está sem comunicação há 2 horas',
      read: true,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      deviceId: 3,
      deviceName: 'DEF-9012',
      eventType: 'deviceOffline'
    },
    {
      id: '4',
      type: 'success',
      title: 'Manutenção Concluída',
      message: 'Manutenção preventiva do veículo GHI-3456 foi concluída',
      read: true,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      deviceId: 4,
      deviceName: 'GHI-3456',
      eventType: 'maintenance'
    },
  ];
};

const markAsRead = async (id: string): Promise<void> => {
  const stored = localStorage.getItem('inAppNotifications');
  if (stored) {
    const notifications = JSON.parse(stored);
    const updated = notifications.map((n: InAppNotification) => 
      n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem('inAppNotifications', JSON.stringify(updated));
  }
};

const markAllAsRead = async (): Promise<void> => {
  const stored = localStorage.getItem('inAppNotifications');
  if (stored) {
    const notifications = JSON.parse(stored);
    const updated = notifications.map((n: InAppNotification) => ({ ...n, read: true }));
    localStorage.setItem('inAppNotifications', JSON.stringify(updated));
  }
};

const deleteNotification = async (id: string): Promise<void> => {
  const stored = localStorage.getItem('inAppNotifications');
  if (stored) {
    const notifications = JSON.parse(stored);
    const updated = notifications.filter((n: InAppNotification) => n.id !== id);
    localStorage.setItem('inAppNotifications', JSON.stringify(updated));
  }
};

const clearAllNotifications = async (): Promise<void> => {
  localStorage.setItem('inAppNotifications', JSON.stringify([]));
};

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['inAppNotifications'],
    queryFn: getInAppNotifications,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Escutar evento de nova notificação para atualizar imediatamente
  useEffect(() => {
    const handleNewNotification = () => {
      console.log('🔔 Nova notificação detectada, atualizando lista...');
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    };

    window.addEventListener('notificationAdded', handleNewNotification);
    
    return () => {
      window.removeEventListener('notificationAdded', handleNewNotification);
    };
  }, [queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
      toast.success('Todas as notificações foram marcadas como lidas');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
      toast.success('Notificação excluída');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
      toast.success('Todas as notificações foram excluídas');
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleNotificationClick = (notification: InAppNotification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Navegar para detalhes do dispositivo se disponível
    if (notification.deviceId) {
      onOpenChange(false);
      router.push(`/vehicles?device=${notification.deviceId}`);
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsReadMutation.mutate();
    }
  };

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja excluir todas as notificações?')) {
      clearAllMutation.mutate();
    }
  };

  const handleGoToSettings = () => {
    onOpenChange(false);
    router.push('/notifications');
  };

  // Salvar notificações no localStorage quando mudar
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem('inAppNotifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoToSettings}
              title="Configurações de notificações"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </SheetTitle>
          <SheetDescription>
            Acompanhe alertas e eventos dos seus veículos
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={notifications.length === 0 || clearAllMutation.isPending}
            className="flex-1"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar tudo
          </Button>
        </div>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-240px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Carregando...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">Nenhuma notificação</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você está em dia com todas as notificações
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    group relative p-4 rounded-lg border cursor-pointer
                    transition-all hover:shadow-md
                    ${notification.read 
                      ? 'bg-card/50 border-border/50' 
                      : 'bg-card border-border shadow-sm'
                    }
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-semibold text-sm ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(notification.id);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      {notification.deviceName && (
                        <Badge variant="outline" className="mt-2">
                          {notification.deviceName}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.timestamp), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
