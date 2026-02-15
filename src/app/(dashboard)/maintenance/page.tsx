'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevices } from '@/lib/api';
import { Maintenance } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Search, Plus, Edit, Trash2, Wrench, Calendar, DollarSign, Gauge, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Mock API
const getMaintenances = async (): Promise<Maintenance[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    {
      id: 1,
      deviceId: 1,
      deviceName: 'ABC-1234',
      type: 'oil_change',
      description: 'Troca de óleo e filtro',
      status: 'completed',
      scheduledDate: '2024-12-15T10:00:00Z',
      completedDate: '2024-12-15T14:30:00Z',
      cost: 350.00,
      odometer: 15000,
      nextOdometer: 20000,
      notes: 'Trocado óleo sintético 5W30',
      createdAt: '2024-12-01T10:00:00Z',
      updatedAt: '2024-12-15T14:30:00Z'
    },
    {
      id: 2,
      deviceId: 2,
      deviceName: 'XYZ-5678',
      type: 'tire_rotation',
      description: 'Rodízio de pneus',
      status: 'scheduled',
      scheduledDate: '2025-01-10T09:00:00Z',
      odometer: 25000,
      cost: 150.00,
      createdAt: '2024-12-20T15:00:00Z',
      updatedAt: '2024-12-20T15:00:00Z'
    },
    {
      id: 3,
      deviceId: 3,
      deviceName: 'DEF-9012',
      type: 'brake_service',
      description: 'Revisão de freios',
      status: 'in_progress',
      scheduledDate: '2024-12-30T08:00:00Z',
      cost: 800.00,
      odometer: 35000,
      createdAt: '2024-12-25T10:00:00Z',
      updatedAt: '2024-12-30T08:00:00Z'
    },
    {
      id: 4,
      deviceId: 1,
      deviceName: 'ABC-1234',
      type: 'general_inspection',
      description: 'Revisão geral periódica',
      status: 'overdue',
      scheduledDate: '2024-12-20T10:00:00Z',
      cost: 500.00,
      odometer: 20000,
      createdAt: '2024-12-10T10:00:00Z',
      updatedAt: '2024-12-20T10:00:00Z'
    }
  ];
};

const createMaintenance = async (data: Partial<Maintenance>): Promise<Maintenance> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { 
    id: Date.now(), 
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as Maintenance;
};

const updateMaintenance = async (id: number, data: Partial<Maintenance>): Promise<Maintenance> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { id, ...data, updatedAt: new Date().toISOString() } as Maintenance;
};

const deleteMaintenance = async (id: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [formData, setFormData] = useState({
    deviceId: 0,
    type: 'oil_change' as Maintenance['type'],
    description: '',
    scheduledDate: '',
    cost: 0,
    odometer: 0,
    nextOdometer: 0,
    notes: '',
    status: 'scheduled' as Maintenance['status']
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ['maintenances'],
    queryFn: getMaintenances,
  });

  const createMutation = useMutation({
    mutationFn: createMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast.success('Manutenção agendada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao agendar manutenção');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Maintenance> }) => updateMaintenance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast.success('Manutenção atualizada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar manutenção');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast.success('Manutenção excluída com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir manutenção');
    },
  });

  const resetForm = () => {
    setFormData({
      deviceId: 0,
      type: 'oil_change',
      description: '',
      scheduledDate: '',
      cost: 0,
      odometer: 0,
      nextOdometer: 0,
      notes: '',
      status: 'scheduled'
    });
    setEditingMaintenance(null);
  };

  const handleEdit = (maintenance: Maintenance) => {
    setEditingMaintenance(maintenance);
    setFormData({
      deviceId: maintenance.deviceId,
      type: maintenance.type,
      description: maintenance.description,
      scheduledDate: maintenance.scheduledDate?.split('T')[0] || '',
      cost: maintenance.cost || 0,
      odometer: maintenance.odometer || 0,
      nextOdometer: maintenance.nextOdometer || 0,
      notes: maintenance.notes || '',
      status: maintenance.status
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingMaintenance) {
      updateMutation.mutate({ id: editingMaintenance.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta manutenção?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredMaintenances = maintenances.filter(maintenance => {
    const matchesSearch = 
      maintenance.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (maintenance.deviceName && maintenance.deviceName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || maintenance.status === statusFilter;
    const matchesType = typeFilter === 'all' || maintenance.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: Maintenance['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Concluída</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Clock className="w-3 h-3 mr-1" />Agendada</Badge>;
      case 'in_progress':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20"><Wrench className="w-3 h-3 mr-1" />Em Andamento</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Atrasada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: Maintenance['type']) => {
    switch (type) {
      case 'oil_change': return 'Troca de Óleo';
      case 'tire_rotation': return 'Rodízio de Pneus';
      case 'brake_service': return 'Freios';
      case 'general_inspection': return 'Revisão Geral';
      case 'other': return 'Outro';
      default: return type;
    }
  };

  const stats = {
    total: maintenances.length,
    scheduled: maintenances.filter(m => m.status === 'scheduled').length,
    inProgress: maintenances.filter(m => m.status === 'in_progress').length,
    overdue: maintenances.filter(m => m.status === 'overdue').length,
    totalCost: maintenances
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + (m.cost || 0), 0)
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção"
        description="Gerencie manutenções preventivas e corretivas"
        icon={Wrench}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.scheduled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Wrench className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar manutenções..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="overdue">Atrasada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="oil_change">Troca de Óleo</SelectItem>
                <SelectItem value="tire_rotation">Rodízio de Pneus</SelectItem>
                <SelectItem value="brake_service">Freios</SelectItem>
                <SelectItem value="general_inspection">Revisão Geral</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Manutenção
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingMaintenance ? 'Editar Manutenção' : 'Nova Manutenção'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="deviceId">Veículo</Label>
                    <Select
                      value={formData.deviceId.toString()}
                      onValueChange={(value) => setFormData({ ...formData, deviceId: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((device) => (
                          <SelectItem key={device.id} value={device.id.toString()}>
                            {device.plate} - {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Manutenção</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oil_change">Troca de Óleo</SelectItem>
                        <SelectItem value="tire_rotation">Rodízio de Pneus</SelectItem>
                        <SelectItem value="brake_service">Freios</SelectItem>
                        <SelectItem value="general_inspection">Revisão Geral</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      Data Agendada
                    </Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ex: Troca de óleo e filtro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cost" className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      Custo (R$)
                    </Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="odometer" className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-purple-500" />
                      KM Atual
                    </Label>
                    <Input
                      id="odometer"
                      type="number"
                      value={formData.odometer}
                      onChange={(e) => setFormData({ ...formData, odometer: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nextOdometer">Próxima Manutenção (KM)</Label>
                    <Input
                      id="nextOdometer"
                      type="number"
                      value={formData.nextOdometer}
                      onChange={(e) => setFormData({ ...formData, nextOdometer: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  {editingMaintenance && (
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendada</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                          <SelectItem value="overdue">Atrasada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Detalhes adicionais sobre a manutenção..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingMaintenance ? 'Atualizar' : 'Agendar'} Manutenção
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Maintenances Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Agendada Para</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaintenances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma manutenção encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaintenances.map((maintenance) => (
                    <TableRow key={maintenance.id}>
                      <TableCell>
                        <div className="font-medium">{maintenance.deviceName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(maintenance.type)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {maintenance.description}
                      </TableCell>
                      <TableCell className="text-sm">
                        {maintenance.scheduledDate ? formatDate(maintenance.scheduledDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {maintenance.odometer ? `${maintenance.odometer.toLocaleString()} km` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {maintenance.cost ? `R$ ${maintenance.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(maintenance.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(maintenance)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(maintenance.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
