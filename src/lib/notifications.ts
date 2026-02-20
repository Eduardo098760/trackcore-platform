import { InAppNotification } from '@/components/layout/notification-panel';

/**
 * Sistema de gerenciamento de notificações in-app
 */

export class NotificationManager {
  private static instance: NotificationManager;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Adiciona uma nova notificação
   */
  async addNotification(notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const newNotification: InAppNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Obter notificações existentes
    const stored = localStorage.getItem('inAppNotifications');
    const notifications: InAppNotification[] = stored ? JSON.parse(stored) : [];

    // Verificar se já existe notificação similar recente (últimos 5 segundos)
    const isDuplicate = notifications.some(n => 
      n.title === notification.title &&
      n.deviceId === notification.deviceId &&
      n.eventType === notification.eventType &&
      (Date.now() - new Date(n.timestamp).getTime()) < 5000
    );

    if (isDuplicate) {
      console.log('⚠️ Notificação duplicada detectada, ignorando');
      return;
    }

    // Adicionar nova notificação no início
    notifications.unshift(newNotification);

    // Manter apenas as últimas 50 notificações
    const trimmed = notifications.slice(0, 50);

    // Salvar
    localStorage.setItem('inAppNotifications', JSON.stringify(trimmed));

    // Disparar evento customizado para atualização imediata da UI
    window.dispatchEvent(new CustomEvent('notificationAdded', { 
      detail: newNotification 
    }));

    console.log('✅ Notificação criada:', newNotification.title);

    // Tocar som e mostrar notificação do navegador em paralelo
    Promise.all([
      this.playNotificationSound(),
      this.showBrowserNotification(newNotification)
    ]).catch(err => console.error('Erro ao processar notificação:', err));
  }

  /**
   * Toca som de notificação se habilitado
   */
  private async playNotificationSound(): Promise<void> {
    const settings = localStorage.getItem('notificationSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.inApp?.enabled && parsed.inApp?.sound) {
        // Criar e tocar som
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }
    }
  }

  /**
   * Mostra notificação do navegador se habilitado
   */
  private async showBrowserNotification(notification: InAppNotification): Promise<void> {
    const settings = localStorage.getItem('notificationSettings');
    if (!settings) return;

    const parsed = JSON.parse(settings);
    if (!parsed.inApp?.enabled || !parsed.inApp?.desktop) return;

    // Verificar permissão
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações desktop');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
        });
      }
    }
  }

  /**
   * Cria notificação customizada com dados dinâmicos
   */
  async createCustomNotification(
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string,
    customData?: Record<string, any>
  ): Promise<void> {
    await this.addNotification({
      type,
      title,
      message,
      deviceId: customData?.deviceId,
      deviceName: customData?.deviceName,
      eventType: customData?.eventType || 'custom',
    });
  }

  /**
   * Simula recebimento de notificações de eventos do Traccar
   */
  async simulateEvent(
    type: string,
    deviceName: string,
    deviceId: number,
    details?: string
  ): Promise<void> {
    const eventMap: Record<string, {
      type: 'info' | 'warning' | 'error' | 'success';
      title: string;
      message: string;
    }> = {
      speedLimit: {
        type: 'warning',
        title: '⚡ Velocidade Excedida',
        message: `${deviceName} ${details || 'excedeu o limite de velocidade'}`,
      },
      geofenceEnter: {
        type: 'info',
        title: 'Entrada em Cerca',
        message: `${deviceName} ${details || 'entrou em uma cerca geográfica'}`,
      },
      geofenceExit: {
        type: 'warning',
        title: 'Saída de Cerca',
        message: `${deviceName} ${details || 'saiu de uma cerca geográfica'}`,
      },
      deviceOffline: {
        type: 'error',
        title: 'Dispositivo Offline',
        message: `${deviceName} ${details || 'está sem comunicação'}`,
      },
      maintenance: {
        type: 'info',
        title: 'Manutenção',
        message: `${deviceName} ${details || 'requer manutenção'}`,
      },
      ignitionOn: {
        type: 'info',
        title: '🔑 Ignição Ligada',
        message: `${deviceName} ${details || 'teve a ignição ligada'}`,
      },
      ignitionOff: {
        type: 'info',
        title: '🔑 Ignição Desligada',
        message: `${deviceName} ${details || 'teve a ignição desligada'}`,
      },
    };

    const eventData = eventMap[type] || {
      type: 'info' as const,
      title: type,
      message: `${deviceName} ${details || '- evento customizado'}`,
    };

    await this.addNotification({
      type: eventData.type,
      title: eventData.title,
      message: eventData.message,
      deviceId,
      deviceName,
      eventType: type,
    });
  }

  /**
   * Limpa todas as notificações
   */
  clearAll(): void {
    localStorage.setItem('inAppNotifications', JSON.stringify([]));
  }

  /**
   * Obtém contagem de não lidas
   */
  getUnreadCount(): number {
    const stored = localStorage.getItem('inAppNotifications');
    if (!stored) return 0;

    const notifications: InAppNotification[] = JSON.parse(stored);
    return notifications.filter(n => !n.read).length;
  }
}

// Exportar instância singleton
export const notificationManager = NotificationManager.getInstance();
