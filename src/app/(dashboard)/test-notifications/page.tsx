'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notificationManager } from '@/lib/notifications';
import { 
  Bell, 
  Play, 
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

type EventType = 'speedLimit' | 'geofenceEnter' | 'geofenceExit' | 'deviceOffline' | 'maintenance' | 'ignitionOn' | 'ignitionOff';

export default function TestNotificationsPage() {
  const [eventType, setEventType] = useState<EventType>('ignitionOn');
  const [deviceName, setDeviceName] = useState('ABC-1234');
  const [deviceId, setDeviceId] = useState(1);
  const [customMessage, setCustomMessage] = useState('');

  const handleSimulate = () => {
    notificationManager.simulateEvent(
      eventType,
      deviceName,
      deviceId,
      customMessage || undefined
    );
    toast.success('Notificação de teste enviada!');
  };

  const handleClearAll = () => {
    notificationManager.clearAll();
    toast.success('Todas as notificações foram limpas');
  };

  const eventOptions = [
    { value: 'ignitionOn', label: '🔑 Ignição Ligada', icon: CheckCircle2, color: 'text-green-500' },
    { value: 'ignitionOff', label: '🔑 Ignição Desligada', icon: Info, color: 'text-gray-500' },
    { value: 'speedLimit', label: '⚡ Excesso de Velocidade', icon: AlertTriangle, color: 'text-amber-500' },
    { value: 'geofenceEnter', label: '📍 Entrada em Cerca', icon: Info, color: 'text-blue-500' },
    { value: 'geofenceExit', label: '📍 Saída de Cerca', icon: AlertCircle, color: 'text-orange-500' },
    { value: 'deviceOffline', label: '🔴 Dispositivo Offline', icon: AlertCircle, color: 'text-red-500' },
    { value: 'maintenance', label: '🔧 Manutenção', icon: Info, color: 'text-blue-500' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testar Sistema de Notificações"
        description="Simule eventos e teste as notificações na plataforma"
        icon={Bell}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário de Teste */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-500" />
              Simular Evento
            </CardTitle>
            <CardDescription>
              Configure e envie uma notificação de teste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Tipo de Evento</Label>
              <Select value={eventType} onValueChange={(v: any) => setEventType(v)}>
                <SelectTrigger id="eventType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceName">Nome do Veículo</Label>
              <Input
                id="deviceName"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="ABC-1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceId">ID do Dispositivo</Label>
              <Input
                id="deviceId"
                type="number"
                value={deviceId}
                onChange={(e) => setDeviceId(parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customMessage">Mensagem Personalizada (opcional)</Label>
              <Input
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Ex: excedeu 100 km/h na BR-101"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSimulate} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Enviar Notificação Teste
              </Button>
              <Button onClick={handleClearAll} variant="outline">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Todas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              Como Usar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Passo 1: Configure o Evento
              </h3>
              <p className="text-muted-foreground">
                Selecione o tipo de evento que deseja simular e preencha os dados do veículo.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Passo 2: Envie a Notificação
              </h3>
              <p className="text-muted-foreground">
                Clique em "Enviar Notificação Teste" para criar a notificação.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Passo 3: Verifique a Notificação
              </h3>
              <p className="text-muted-foreground">
                Olhe no ícone 🔔 no header. Deve aparecer um badge com a quantidade de notificações não lidas.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                Passo 4: Abra o Painel
              </h3>
              <p className="text-muted-foreground">
                Clique no ícone do sino para abrir o painel de notificações e ver os detalhes.
              </p>
            </div>

            <div className="rounded-lg bg-amber-500/10 p-4 mt-4">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                💡 Dica Importante
              </p>
              <p className="text-sm text-muted-foreground">
                Para receber notificações automáticas de eventos reais do Traccar, certifique-se de:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Ter dispositivos cadastrados</li>
                <li>Ter as configurações de notificação ativas</li>
                <li>Os eventos configurados estarem habilitados em /notifications</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema de Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Notificações In-App</p>
                <p className="text-sm text-muted-foreground">Sistema ativo</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Info className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold">Monitoramento</p>
                <p className="text-sm text-muted-foreground">Verificando a cada 10s</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold">Contagem</p>
                <p className="text-sm text-muted-foreground">
                  {notificationManager.getUnreadCount()} não lidas
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
