"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Check,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Settings,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface InAppNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  deviceId?: number;
  deviceName?: string; // placa (ex: ABC-1234)
  vehicleName?: string; // nome descritivo (ex: Caminhão SP)
  eventType?: string;
  latitude?: number;
  longitude?: number;
  speedAlertId?: string;
}

// Lê notificações do localStorage (sem mock data)
const getInAppNotifications = async (): Promise<InAppNotification[]> => {
  const stored = localStorage.getItem("inAppNotifications");
  return stored ? JSON.parse(stored) : [];
};

const markAsRead = async (id: string): Promise<void> => {
  const stored = localStorage.getItem("inAppNotifications");
  if (stored) {
    const notifications = JSON.parse(stored);
    const updated = notifications.map((n: InAppNotification) =>
      n.id === id ? { ...n, read: true } : n,
    );
    localStorage.setItem("inAppNotifications", JSON.stringify(updated));
  }
};

const markAllAsRead = async (): Promise<void> => {
  const stored = localStorage.getItem("inAppNotifications");
  if (stored) {
    const notifications = JSON.parse(stored);
    const updated = notifications.map((n: InAppNotification) => ({
      ...n,
      read: true,
    }));
    localStorage.setItem("inAppNotifications", JSON.stringify(updated));
  }
};

const deleteNotification = async (id: string): Promise<void> => {
  const stored = localStorage.getItem("inAppNotifications");
  if (!stored) return;
  const notifications: InAppNotification[] = JSON.parse(stored);
  const toDelete = notifications.find((n) => n.id === id);
  const updated = notifications.filter((n) => n.id !== id);
  localStorage.setItem("inAppNotifications", JSON.stringify(updated));

  // Se a notificação tinha um SpeedAlert associado, removê-lo do mapa também
  if (toDelete?.speedAlertId) {
    try {
      const alerts = JSON.parse(localStorage.getItem("speedAlerts") || "[]");
      const updatedAlerts = alerts.filter(
        (a: { id: string }) => a.id !== toDelete.speedAlertId,
      );
      localStorage.setItem("speedAlerts", JSON.stringify(updatedAlerts));
      window.dispatchEvent(
        new CustomEvent("speedAlertRemoved", {
          detail: { id: toDelete.speedAlertId },
        }),
      );
    } catch {
      /* ignore */
    }
  }
};

const clearAllNotifications = async (): Promise<void> => {
  localStorage.setItem("inAppNotifications", JSON.stringify([]));
  localStorage.setItem("speedAlerts", JSON.stringify([]));
  window.dispatchEvent(new CustomEvent("speedAlertsCleared"));
};

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Extrai velocidade registrada da mensagem: "atingiu 95 km/h" → 95 */
function extractSpeedFromMessage(msg: string): number {
  const m =
    msg.match(/atingiu\s+(\d+)\s*km\/h/i) || msg.match(/(\d+)\s*km\/h/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Extrai limite de velocidade da mensagem: "limite: 80 km/h" → 80 */
function extractSpeedLimitFromMessage(msg: string): number {
  const m =
    msg.match(/limite[:\s]+(\d+)\s*km\/h/i) ||
    msg.match(/excedeu\s+(\d+)\s*km\/h/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function NotificationPanel({
  open,
  onOpenChange,
}: NotificationPanelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["inAppNotifications"],
    queryFn: () => getInAppNotifications(),
    refetchInterval: 10000,
    refetchOnMount: true,
  });

  // Nota: o listener 'notificationAdded' está no Header (sempre montado).
  // O painel re-renderiza automaticamente via cache compartilhado do React Query.

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
      toast.success("Todas as notificações foram marcadas como lidas");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
      toast.success("Notificação excluída");
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
      toast.success("Todas as notificações foram excluídas");
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: InAppNotification["type"]) => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleNotificationClick = (notification: InAppNotification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }

    if (!notification.deviceId) return;

    // Para notificações de excesso de velocidade: restaurar marcador ⚡ no mapa
    const isSpeedEvent =
      notification.eventType === "speedLimit" ||
      notification.eventType === "deviceOverspeed";
    let targetAlertId: string | null = null;

    if (
      isSpeedEvent &&
      notification.latitude != null &&
      notification.longitude != null
    ) {
      // Coordenadas registradas no momento do evento → criar/restaurar SpeedAlert
      try {
        const alertId = notification.speedAlertId || `notif-${notification.id}`;
        targetAlertId = alertId;
        const alert = {
          id: alertId,
          deviceId: notification.deviceId,
          deviceName:
            notification.deviceName || `Veículo #${notification.deviceId}`,
          vehicleName: notification.vehicleName,
          speed: extractSpeedFromMessage(notification.message),
          speedLimit: extractSpeedLimitFromMessage(notification.message),
          latitude: notification.latitude,
          longitude: notification.longitude,
          timestamp: notification.timestamp,
        };
        const stored = localStorage.getItem("speedAlerts");
        const alerts = stored ? JSON.parse(stored) : [];
        const filtered = alerts.filter(
          (a: { id: string }) => a.id !== alert.id,
        );
        filtered.unshift(alert);
        localStorage.setItem(
          "speedAlerts",
          JSON.stringify(filtered.slice(0, 100)),
        );
        window.dispatchEvent(
          new CustomEvent("speedAlertAdded", { detail: alert }),
        );
      } catch {
        /* ignore */
      }
    }

    onOpenChange(false);

    // Montar URL: para excesso com coordenadas, incluir alertId para o mapa centralizar
    if (targetAlertId) {
      router.push(
        `/map?deviceId=${notification.deviceId}&alertId=${encodeURIComponent(targetAlertId)}`,
      );
    } else {
      router.push(`/map?deviceId=${notification.deviceId}`);
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsReadMutation.mutate();
    }
  };

  const handleClearAll = () => {
    if (confirm("Tem certeza que deseja excluir todas as notificações?")) {
      clearAllMutation.mutate();
    }
  };

  const handleGoToSettings = () => {
    onOpenChange(false);
    router.push("/notifications");
  };

  // Salvar notificações no localStorage quando mudar
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem("inAppNotifications", JSON.stringify(notifications));
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
                    ${
                      notification.read
                        ? "bg-card/50 border-border/50"
                        : "bg-card border-border shadow-sm"
                    }
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`font-semibold text-sm ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}
                        >
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
                      {(notification.vehicleName ||
                        notification.deviceName) && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {notification.vehicleName && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-medium"
                            >
                              {notification.vehicleName}
                            </Badge>
                          )}
                          {notification.deviceName && (
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {notification.deviceName}
                            </Badge>
                          )}
                          {notification.deviceId && !notification.latitude && (
                            <span className="text-xs text-blue-500 flex items-center gap-0.5 hover:underline">
                              <MapPin className="w-3 h-3" />
                              Ver no mapa
                            </span>
                          )}
                          {notification.latitude && notification.longitude && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                              className="text-xs text-amber-500 flex items-center gap-0.5 hover:underline"
                            >
                              <MapPin className="w-3 h-3" />
                              Ver local do excesso
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
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
