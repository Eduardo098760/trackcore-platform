'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevices, sendCommand, getCommands } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Terminal, Lock, Unlock, MapPin, RotateCcw, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Command } from '@/types';

export default function CommandsPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: commands = [] } = useQuery({
    queryKey: ['commands'],
    queryFn: getCommands,
    refetchInterval: 5000,
  });

  const sendCommandMutation = useMutation({
    mutationFn: ({ deviceId, type }: { deviceId: number; type: string }) => 
      sendCommand(deviceId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commands'] });
      setSelectedDeviceId('');
      setSelectedCommand('');
    },
  });

  const commandTypes = [
    { value: 'positionRequest', label: 'Solicitar Posição', icon: MapPin, color: 'from-blue-600 to-cyan-600' },
    { value: 'engineStop', label: 'Bloquear Veículo', icon: Lock, color: 'from-red-600 to-orange-600' },
    { value: 'engineResume', label: 'Desbloquear Veículo', icon: Unlock, color: 'from-green-600 to-emerald-600' },
    { value: 'deviceReboot', label: 'Reiniciar Rastreador', icon: RotateCcw, color: 'from-purple-600 to-pink-600' },
  ];

  const handleSendCommand = () => {
    if (selectedDeviceId && selectedCommand) {
      sendCommandMutation.mutate({
        deviceId: parseInt(selectedDeviceId),
        type: selectedCommand
      });
    }
  };

  const getStatusIcon = (status: Command['status']) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: Command['status']) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
      case 'sent':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Terminal}
        title="Comandos Remotos"
        description="Envie comandos para os rastreadores dos veículos"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Send Command Panel */}
        <Card className="backdrop-blur-xl bg-gradient-to-br from-white/90 to-gray-50/90 dark:from-gray-950/90 dark:to-gray-900/90 border-white/20">
          <CardHeader>
            <CardTitle className="text-xl">Enviar Novo Comando</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selecione o Veículo</label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="bg-white dark:bg-gray-900">
                  <SelectValue placeholder="Escolha um veículo..." />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.plate} - {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Selecione o Comando</label>
              <div className="grid grid-cols-2 gap-3">
                {commandTypes.map(cmd => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.value}
                      onClick={() => setSelectedCommand(cmd.value)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedCommand === cmd.value
                          ? `bg-gradient-to-r ${cmd.color} text-white border-transparent shadow-lg scale-105`
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${selectedCommand === cmd.value ? 'text-white' : ''}`} />
                      <p className={`text-xs font-medium text-center ${selectedCommand === cmd.value ? 'text-white' : ''}`}>
                        {cmd.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleSendCommand}
              disabled={!selectedDeviceId || !selectedCommand || sendCommandMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendCommandMutation.isPending ? 'Enviando...' : 'Enviar Comando'}
            </Button>

            {sendCommandMutation.isSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✓ Comando enviado com sucesso!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Command History */}
        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
          <CardHeader>
            <CardTitle className="text-xl">Histórico de Comandos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {commands.slice(0, 10).map(command => {
                const device = devices.find(d => d.id === command.deviceId);
                const cmdType = commandTypes.find(ct => ct.value === command.type);
                const Icon = cmdType?.icon || Terminal;

                return (
                  <div
                    key={command.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-900/50 dark:to-gray-950/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${cmdType?.color || 'from-gray-600 to-gray-700'}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">
                              {cmdType?.label || command.type}
                            </h4>
                            <Badge className={getStatusColor(command.status)}>
                              {getStatusIcon(command.status)}
                              <span className="ml-1">{command.status}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {device?.plate} - {device?.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {formatDate(command.sentTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {commands.length === 0 && (
                <div className="text-center py-8">
                  <Terminal className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Nenhum comando enviado ainda
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Card */}
      <Card className="backdrop-blur-xl bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-yellow-900 dark:text-yellow-200 mb-1">
                Atenção ao enviar comandos
              </h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Os comandos de bloqueio podem afetar o funcionamento do veículo. 
                Use com cautela e apenas quando necessário. Certifique-se de que o veículo 
                está em local seguro antes de enviar comandos de bloqueio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
