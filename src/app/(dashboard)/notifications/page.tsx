'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Save,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface NotificationSettings {
  inApp: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  email: {
    enabled: boolean;
    address: string;
    frequency: 'instant' | 'hourly' | 'daily';
  };
  sms: {
    enabled: boolean;
    phone: string;
  };
  push: {
    enabled: boolean;
  };
  events: {
    speedLimit: boolean;
    geofenceEnter: boolean;
    geofenceExit: boolean;
    ignitionOn: boolean;
    ignitionOff: boolean;
    deviceOffline: boolean;
    deviceOnline: boolean;
    lowBattery: boolean;
    maintenance: boolean;
    sos: boolean;
  };
}

const getSettings = async (): Promise<NotificationSettings> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const stored = localStorage.getItem('notificationSettings');
  if (stored) {
    return JSON.parse(stored);
  }
  
  return {
    inApp: {
      enabled: true,
      sound: true,
      desktop: false,
    },
    email: {
      enabled: false,
      address: '',
      frequency: 'instant',
    },
    sms: {
      enabled: false,
      phone: '',
    },
    push: {
      enabled: false,
    },
    events: {
      speedLimit: true,
      geofenceEnter: true,
      geofenceExit: true,
      ignitionOn: false,
      ignitionOff: false,
      deviceOffline: true,
      deviceOnline: false,
      lowBattery: true,
      maintenance: true,
      sos: true,
    },
  };
};

const saveSettings = async (settings: NotificationSettings): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  localStorage.setItem('notificationSettings', JSON.stringify(settings));
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: getSettings,
  });

  // Inicializar settings quando data estiver disponível
  if (data && !settings) {
    setSettings(data);
  }

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const updateInApp = (key: keyof NotificationSettings['inApp'], value: boolean) => {
    if (settings) {
      setSettings({
        ...settings,
        inApp: { ...settings.inApp, [key]: value },
      });
    }
  };

  const updateEmail = (key: keyof NotificationSettings['email'], value: any) => {
    if (settings) {
      setSettings({
        ...settings,
        email: { ...settings.email, [key]: value },
      });
    }
  };

  const updateSms = (key: keyof NotificationSettings['sms'], value: any) => {
    if (settings) {
      setSettings({
        ...settings,
        sms: { ...settings.sms, [key]: value },
      });
    }
  };

  const updatePush = (enabled: boolean) => {
    if (settings) {
      setSettings({
        ...settings,
        push: { enabled },
      });
    }
  };

  const updateEvent = (event: keyof NotificationSettings['events'], enabled: boolean) => {
    if (settings) {
      setSettings({
        ...settings,
        events: { ...settings.events, [event]: enabled },
      });
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Configurações de Notificações"
          description="Personalize como você recebe alertas e notificações"
          icon={Bell}
        />
        <div>Carregando...</div>
      </div>
    );
  }

  const eventLabels = {
    speedLimit: { label: 'Excesso de Velocidade', icon: AlertTriangle, color: 'text-amber-500' },
    geofenceEnter: { label: 'Entrada em Cerca', icon: Info, color: 'text-blue-500' },
    geofenceExit: { label: 'Saída de Cerca', icon: AlertCircle, color: 'text-orange-500' },
    ignitionOn: { label: 'Ignição Ligada', icon: CheckCircle2, color: 'text-green-500' },
    ignitionOff: { label: 'Ignição Desligada', icon: Info, color: 'text-gray-500' },
    deviceOffline: { label: 'Dispositivo Offline', icon: AlertCircle, color: 'text-red-500' },
    deviceOnline: { label: 'Dispositivo Online', icon: CheckCircle2, color: 'text-green-500' },
    lowBattery: { label: 'Bateria Fraca', icon: AlertTriangle, color: 'text-amber-500' },
    maintenance: { label: 'Manutenção', icon: Info, color: 'text-blue-500' },
    sos: { label: 'SOS / Emergência', icon: AlertCircle, color: 'text-red-500' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Notificações"
        description="Personalize como você recebe alertas e notificações"
        icon={Bell}
      />

      {/* Canais de Notificação */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* In-App Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              <CardTitle>Notificações na Plataforma</CardTitle>
            </div>
            <CardDescription>
              Receba notificações diretamente na plataforma em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar notificações na plataforma</Label>
                <p className="text-sm text-muted-foreground">
                  Exibir alertas no painel de notificações
                </p>
              </div>
              <Switch
                checked={settings.inApp.enabled}
                onCheckedChange={(checked) => updateInApp('enabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  {settings.inApp.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  Som de notificação
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reproduzir som ao receber notificações
                </p>
              </div>
              <Switch
                checked={settings.inApp.sound}
                onCheckedChange={(checked) => updateInApp('sound', checked)}
                disabled={!settings.inApp.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações do navegador</Label>
                <p className="text-sm text-muted-foreground">
                  Exibir notificações desktop do navegador
                </p>
              </div>
              <Switch
                checked={settings.inApp.desktop}
                onCheckedChange={(checked) => updateInApp('desktop', checked)}
                disabled={!settings.inApp.enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-500" />
              <CardTitle>Notificações por Email</CardTitle>
            </div>
            <CardDescription>
              Receba alertas importantes no seu email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar notificações por email</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar alertas para o email cadastrado
                </p>
              </div>
              <Switch
                checked={settings.email.enabled}
                onCheckedChange={(checked) => updateEmail('enabled', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="email">Endereço de Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={settings.email.address}
                onChange={(e) => updateEmail('address', e.target.value)}
                disabled={!settings.email.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequência de Envio</Label>
              <Select
                value={settings.email.frequency}
                onValueChange={(value: any) => updateEmail('frequency', value)}
                disabled={!settings.email.enabled}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instantâneo</SelectItem>
                  <SelectItem value="hourly">A cada hora</SelectItem>
                  <SelectItem value="daily">Resumo diário</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {settings.email.frequency === 'instant' && 'Enviar email imediatamente ao ocorrer evento'}
                {settings.email.frequency === 'hourly' && 'Agrupar eventos e enviar a cada hora'}
                {settings.email.frequency === 'daily' && 'Enviar resumo diário com todos os eventos'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-500" />
              <CardTitle>Notificações por SMS</CardTitle>
              <Badge variant="outline" className="ml-auto">Premium</Badge>
            </div>
            <CardDescription>
              Receba alertas críticos via mensagem de texto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar notificações por SMS</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar SMS para eventos críticos
                </p>
              </div>
              <Switch
                checked={settings.sms.enabled}
                onCheckedChange={(checked) => updateSms('enabled', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 (11) 99999-9999"
                value={settings.sms.phone}
                onChange={(e) => updateSms('phone', e.target.value)}
                disabled={!settings.sms.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Custos adicionais podem ser aplicados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              <CardTitle>Notificações Push</CardTitle>
            </div>
            <CardDescription>
              Receba notificações no seu dispositivo móvel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar notificações push</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar push para o aplicativo móvel
                </p>
              </div>
              <Switch
                checked={settings.push.enabled}
                onCheckedChange={updatePush}
              />
            </div>

            <Separator />

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Para receber notificações push, instale o aplicativo TrackCore em seu dispositivo móvel e faça login com sua conta.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tipos de Eventos */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Eventos</CardTitle>
          <CardDescription>
            Selecione quais tipos de eventos devem gerar notificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(eventLabels).map(([key, { label, icon: Icon, color }]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <Label className="cursor-pointer" htmlFor={key}>
                    {label}
                  </Label>
                </div>
                <Switch
                  id={key}
                  checked={settings.events[key as keyof typeof settings.events]}
                  onCheckedChange={(checked) => updateEvent(key as keyof typeof settings.events, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button
          onClick={() => {
            if (data) {
              setSettings(data);
              toast.info('Alterações descartadas');
            }
          }}
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
