'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevices, getPositions } from '@/lib/api';
import { createDevice, updateDevice, deleteDevice } from '@/lib/api/devices';
import { Device } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, History, Terminal, Filter, Plus, Edit, Trash2, Car, Gauge, Zap, Activity, Satellite } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceStatusColor, getDeviceStatusLabel, formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    uniqueId: '',
    phone: '',
    model: '',
    contact: '',
    category: 'car' as const,
    plate: '',
    speedLimit: 80,
    attributes: {} as Record<string, any>,
  });

  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      console.log('🚗 Buscando dispositivos...');
      try {
        const result = await getDevices();
        console.log('✅ Dispositivos recebidos:', result);
        return result;
      } catch (err) {
        console.error('❌ Erro ao buscar dispositivos:', err);
        throw err;
      }
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: (createdDevice, variables) => {
      // Adiciona o novo device ao cache imediatamente.
      // Campos customizados (plate, color, etc.) podem não vir no root da resposta POST
      // do Traccar — por isso usa variables (formData enviado) como fonte primária.
      queryClient.setQueryData(['devices'], (old: Device[] = []) => [
        ...old,
        {
          ...createdDevice,
          plate:      (variables as any).plate      ?? (createdDevice as any).plate      ?? '',
          model:      (variables as any).model      ?? (createdDevice as any).model      ?? '',
          color:      (variables as any).color      ?? (createdDevice as any).color      ?? '',
          contact:    (variables as any).contact    ?? (createdDevice as any).contact    ?? '',
          category:   (variables as any).category   ?? (createdDevice as any).category   ?? 'car',
          speedLimit: Math.round((variables as any).speedLimit ?? (createdDevice as any).speedLimit ?? 80),
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['devices'], refetchType: 'none' });
      toast.success('Veículo criado com sucesso!');      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao criar veículo');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) => 
      updateDevice(id, data),
    onSuccess: (updatedDevice, variables) => {
      // Atualiza o cache imediatamente.
      // Campos customizados (plate, speedLimit, etc.) ficam em `attributes` no Traccar
      // e podem não vir no nível raiz da resposta PUT — por isso usamos variables.data
      // como fonte confiável para esses campos.
      queryClient.setQueryData(['devices'], (old: Device[] = []) =>
        old.map(d => {
          if (d.id !== variables.id) return d;
          return {
            ...d,
            ...updatedDevice,
            plate:      (variables.data as any).plate      ?? (updatedDevice as any).plate      ?? d.plate,
            model:      (variables.data as any).model      ?? (updatedDevice as any).model      ?? d.model,
            color:      (variables.data as any).color      ?? (updatedDevice as any).color      ?? d.color,
            contact:    (variables.data as any).contact    ?? (updatedDevice as any).contact    ?? d.contact,
            category:   (variables.data as any).category   ?? (updatedDevice as any).category   ?? d.category,
            speedLimit: Math.round((variables.data as any).speedLimit ?? (updatedDevice as any).speedLimit ?? d.speedLimit ?? 80),
          };
        })
      );
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Veículo atualizado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar veículo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Veículo removido com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover veículo');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      uniqueId: '',
      phone: '',
      model: '',
      contact: '',
      category: 'car',
      plate: '',
      speedLimit: 80,
      attributes: {},
    });
    setEditingDevice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDevice) {
      // Para update: preservar campos existentes do device e não sobrescrever campos read-only
      const updateData = {
        ...editingDevice,   // garante groupId, geofenceIds, positionId, etc.
        ...formData,        // aplica as alterações do formulário
        id: editingDevice.id,
        disabled: editingDevice.disabled ?? false,
      };
      updateMutation.mutate({ id: editingDevice.id, data: updateData });
    } else {
      const deviceData = {
        ...formData,
        status: 'offline' as const,
        lastUpdate: new Date().toISOString(),
        disabled: false,
      };
      createMutation.mutate(deviceData);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name ?? '',
      uniqueId: device.uniqueId ?? '',
      phone: device.phone ?? '',
      model: device.model ?? '',
      contact: device.contact ?? '',
      category: device.category ?? 'car',
      plate: device.plate ?? '',
      speedLimit: device.speedLimit ?? 80,
      attributes: device.attributes ?? {},
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja remover este veículo?')) {
      deleteMutation.mutate(id);
    }
  };

  const positionsMap = new Map(positions.map(p => [p.deviceId, p]));

  const filteredDevices = devices.filter(device => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (device.name ?? '').toLowerCase().includes(q) ||
      (device.plate ?? '').toLowerCase().includes(q) ||
      (device.uniqueId ?? '').toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || device.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Mensagem de erro se houver */}
      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-red-500">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-900">Erro ao carregar veículos</h3>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : 'Erro desconhecido'}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Verifique se você está autenticado e se o servidor Traccar está acessível.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PageHeader
        icon={Car}
        title="Gerenciamento de Veículos"
        description={`${filteredDevices.length} veículos encontrados`}
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Veículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDevice ? 'Editar Veículo' : 'Novo Veículo'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome do Veículo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Veículo 001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="plate">Placa *</Label>
                    <Input
                      id="plate"
                      value={formData.plate}
                      onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                      placeholder="Ex: ABC-1234"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="uniqueId">IMEI / ID do Rastreador *</Label>
                    <Input
                      id="uniqueId"
                      value={formData.uniqueId}
                      onChange={(e) => setFormData({ ...formData, uniqueId: e.target.value })}
                      placeholder="Ex: 123456789012345"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Identificador único do dispositivo GPS
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Número do Chip (SIM)</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Ex: +5511999999999"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Número do chip GSM do rastreador
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="model">Modelo do Rastreador</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Ex: GT06, TK103, Concox"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Carro</SelectItem>
                        <SelectItem value="motorcycle">Moto</SelectItem>
                        <SelectItem value="truck">Caminhão</SelectItem>
                        <SelectItem value="bus">Ônibus</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="trailer">Carreta</SelectItem>
                        <SelectItem value="bicycle">Bicicleta</SelectItem>
                        <SelectItem value="boat">Barco</SelectItem>
                        <SelectItem value="airplane">Avião</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact">Contato / Responsável</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Ex: João Silva - Motorista"
                  />
                </div>

                <div>
                  <Label htmlFor="speedLimit">Limite de Velocidade (km/h) *</Label>
                  <Input
                    id="speedLimit"
                    type="number"
                    value={formData.speedLimit}
                    onChange={(e) => setFormData({ ...formData, speedLimit: parseInt(e.target.value) || 80 })}
                    placeholder="80"
                    min="10"
                    max="200"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Alerta quando o veículo exceder este limite
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingDevice ? 'Atualizar Veículo' : 'Criar Veículo'}
                  </Button>
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
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por placa ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-900"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="moving">Em movimento</SelectItem>
                <SelectItem value="stopped">Parado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-white dark:bg-gray-900">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="car">Carro</SelectItem>
                <SelectItem value="motorcycle">Moto</SelectItem>
                <SelectItem value="truck">Caminhão</SelectItem>
                <SelectItem value="bus">Ônibus</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="trailer">Carreta</SelectItem>
                <SelectItem value="bicycle">Bicicleta</SelectItem>
                <SelectItem value="boat">Barco</SelectItem>
                <SelectItem value="airplane">Avião</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-800">
                  <TableHead className="font-bold">Placa</TableHead>
                  <TableHead className="font-bold">Nome</TableHead>
                  <TableHead className="font-bold">IMEI / ID</TableHead>
                  <TableHead className="font-bold">Chip (SIM)</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Hodômetro</TableHead>
                  <TableHead className="font-bold">Sensores</TableHead>
                  <TableHead className="font-bold">Última Atualização</TableHead>
                  <TableHead className="font-bold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => {
                  const position = positionsMap.get(device.id);
                  return (
                    <TableRow 
                      key={device.id}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-950/20 dark:hover:to-purple-950/20 transition-all"
                    >
                      <TableCell className="font-bold">{device.plate}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-xs text-gray-500">{device.model}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {device.uniqueId}
                        </code>
                      </TableCell>
                      <TableCell>
                        {device.phone ? (
                          <span className="text-xs">{device.phone}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getDeviceStatusColor(device.status)}>
                          {getDeviceStatusLabel(device.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {position?.attributes.totalDistance 
                              ? `${(position.attributes.totalDistance / 1000).toFixed(1)} km`
                              : position?.attributes.odometer
                                ? `${position.attributes.odometer.toLocaleString('pt-BR')} km`
                                : '0 km'
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${position?.attributes.ignition ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            <Zap className="w-3 h-3" />
                            {position?.attributes.ignition ? 'ON' : 'OFF'}
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${position?.attributes.motion ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            <Activity className="w-3 h-3" />
                            {position?.attributes.motion ? 'MOV' : 'STOP'}
                          </div>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                            <Satellite className="w-3 h-3" />
                            {position?.attributes.sat || 0}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(device.lastUpdate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(device)}
                            className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-purple-50 dark:hover:bg-purple-950/20"
                          >
                            <MapPin className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(device.id)}
                            className="hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredDevices.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum veículo encontrado com os filtros aplicados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
