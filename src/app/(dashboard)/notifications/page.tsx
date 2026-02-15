'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Notification, NotificationEvent, NotificationType } from '@/types';
import { getNotifications, createNotification, updateNotification, deleteNotification } from '@/lib/api/notifications';
import { getDevices } from '@/lib/api/devices';
import { getGeofences } from '@/lib/api/geofences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit, Plus, Bell, Mail, Smartphone, Webhook } from 'lucide-react';
import { toast } from 'sonner';

const eventLabels: Record<NotificationEvent, string> = {
  ignitionOn: 'Ignição ligada',
  ignitionOff: 'Ignição desligada',
  speedLimit: 'Limite de velocidade',
  geofenceEnter: 'Entrada em cerca',
  geofenceExit: 'Saída de cerca',
  lowBattery: 'Bateria fraca',
  sos: 'SOS',
  deviceOnline: 'Dispositivo online',
  deviceOffline: 'Dispositivo offline',
  maintenance: 'Manutenção',
  alarm: 'Alarme',
  deviceMoving: 'Dispositivo em movimento',
  deviceStopped: 'Dispositivo parado',
};

const typeIcons = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
  webhook: Webhook,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'push' as NotificationType,
    event: 'speedLimit' as NotificationEvent,
    deviceIds: [] as number[],
    geofenceIds: [] as number[],
    enabled: true,
    attributes: {
      email: '',
      phone: '',
      webhookUrl: '',
      message: '',
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: geofences = [] } = useQuery({
    queryKey: ['geofences'],
    queryFn: getGeofences,
  });

  const createMutation = useMutation({
    mutationFn: createNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notificação criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao criar notificação');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Notification> }) => 
      updateNotification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notificação atualizada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar notificação');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notificação removida com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover notificação');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'push',
      event: 'speedLimit',
      deviceIds: [],
      geofenceIds: [],
      enabled: true,
      attributes: {
        email: '',
        phone: '',
        webhookUrl: '',
        message: '',
      },
    });
    setEditingNotification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const notificationData = formData;

    if (editingNotification) {
      updateMutation.mutate({ id: editingNotification.id, data: notificationData });
    } else {
      createMutation.mutate(notificationData);
    }
  };

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification);
    setFormData({
      name: notification.name,
      type: notification.type,
      event: notification.event,
      deviceIds: notification.deviceIds || [],
      geofenceIds: notification.geofenceIds || [],
      enabled: notification.enabled,
      attributes: notification.attributes,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja remover esta notificação?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Configure alertas por email, SMS ou push
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Notificação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingNotification ? 'Editar Notificação' : 'Nova Notificação'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Tipo de Notificação</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: NotificationType) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="event">Evento</Label>
                  <Select
                    value={formData.event}
                    onValueChange={(value: NotificationEvent) => setFormData({ ...formData, event: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === 'email' && (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.attributes.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      attributes: { ...formData.attributes, email: e.target.value }
                    })}
                  />
                </div>
              )}

              {formData.type === 'sms' && (
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.attributes.phone}
                    onChange={(e) => setFormData({
                      ...formData,
                      attributes: { ...formData.attributes, phone: e.target.value }
                    })}
                  />
                </div>
              )}

              {formData.type === 'webhook' && (
                <div>
                  <Label htmlFor="webhookUrl">URL do Webhook</Label>
                  <Input
                    id="webhookUrl"
                    value={formData.attributes.webhookUrl}
                    onChange={(e) => setFormData({
                      ...formData,
                      attributes: { ...formData.attributes, webhookUrl: e.target.value }
                    })}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="message">Mensagem Personalizada</Label>
                <Textarea
                  id="message"
                  value={formData.attributes.message}
                  onChange={(e) => setFormData({
                    ...formData,
                    attributes: { ...formData.attributes, message: e.target.value }
                  })}
                  placeholder="Use {device} para nome do veículo, {speed} para velocidade, etc."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Habilitada</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingNotification ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notifications.map((notification) => {
          const Icon = typeIcons[notification.type];
          return (
            <Card key={notification.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <CardTitle className="text-base">{notification.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(notification)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(notification.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Evento:</span>{' '}
                    {eventLabels[notification.event]}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{' '}
                    {notification.type.toUpperCase()}
                  </div>
                  {notification.enabled ? (
                    <span className="text-xs text-green-500">✓ Habilitada</span>
                  ) : (
                    <span className="text-xs text-gray-500">✗ Desabilitada</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
