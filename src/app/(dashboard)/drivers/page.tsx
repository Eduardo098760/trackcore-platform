'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Driver } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Search, Plus, Edit, Trash2, Users, IdCard, Phone, Mail, Calendar, Car, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Mock API
const getDrivers = async (): Promise<Driver[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    {
      id: 1,
      name: 'João da Silva',
      document: '123.456.789-00',
      licenseNumber: '12345678900',
      licenseCategory: 'D',
      licenseExpiry: '2026-06-15',
      phone: '(11) 98765-4321',
      email: 'joao.silva@email.com',
      photo: '',
      status: 'active',
      currentDeviceId: 1,
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-12-20T15:30:00Z'
    },
    {
      id: 2,
      name: 'Maria Santos',
      document: '987.654.321-00',
      licenseNumber: '98765432100',
      licenseCategory: 'E',
      licenseExpiry: '2025-03-20',
      phone: '(11) 97654-3210',
      email: 'maria.santos@email.com',
      photo: '',
      status: 'active',
      currentDeviceId: 2,
      createdAt: '2024-02-15T09:00:00Z',
      updatedAt: '2024-12-22T10:20:00Z'
    },
    {
      id: 3,
      name: 'Carlos Oliveira',
      document: '456.789.123-00',
      licenseNumber: '45678912300',
      licenseCategory: 'C',
      licenseExpiry: '2024-12-31',
      phone: '(21) 96543-2109',
      email: 'carlos@email.com',
      photo: '',
      status: 'active',
      createdAt: '2024-03-20T14:30:00Z',
      updatedAt: '2024-12-25T08:45:00Z'
    },
    {
      id: 4,
      name: 'Ana Paula Costa',
      document: '321.654.987-00',
      licenseNumber: '32165498700',
      licenseCategory: 'B',
      licenseExpiry: '2027-08-10',
      phone: '(31) 95432-1098',
      status: 'suspended',
      createdAt: '2024-04-10T11:15:00Z',
      updatedAt: '2024-12-15T16:00:00Z'
    },
    {
      id: 5,
      name: 'Pedro Henrique',
      document: '789.123.456-00',
      licenseNumber: '78912345600',
      licenseCategory: 'AB',
      licenseExpiry: '2026-02-28',
      phone: '(41) 94321-0987',
      email: 'pedro@email.com',
      status: 'inactive',
      createdAt: '2024-05-05T13:45:00Z',
      updatedAt: '2024-11-30T09:30:00Z'
    }
  ];
};

const createDriver = async (data: Partial<Driver>): Promise<Driver> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { 
    id: Date.now(), 
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as Driver;
};

const updateDriver = async (id: number, data: Partial<Driver>): Promise<Driver> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { id, ...data, updatedAt: new Date().toISOString() } as Driver;
};

const deleteDriver = async (id: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    licenseNumber: '',
    licenseCategory: 'B' as Driver['licenseCategory'],
    licenseExpiry: '',
    phone: '',
    email: '',
    status: 'active' as Driver['status']
  });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: getDrivers,
  });

  const createMutation = useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista cadastrado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao cadastrar motorista');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Driver> }) => updateDriver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista atualizado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar motorista');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir motorista');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      licenseNumber: '',
      licenseCategory: 'B',
      licenseExpiry: '',
      phone: '',
      email: '',
      status: 'active'
    });
    setEditingDriver(null);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      document: driver.document,
      licenseNumber: driver.licenseNumber,
      licenseCategory: driver.licenseCategory,
      licenseExpiry: driver.licenseExpiry,
      phone: driver.phone,
      email: driver.email || '',
      status: driver.status
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este motorista?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.document.includes(searchQuery) ||
      driver.licenseNumber.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Driver['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20"><AlertCircle className="w-3 h-3 mr-1" />Suspenso</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20"><XCircle className="w-3 h-3 mr-1" />Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isLicenseExpiring = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isLicenseExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    suspended: drivers.filter(d => d.status === 'suspended').length,
    expiring: drivers.filter(d => isLicenseExpiring(d.licenseExpiry) && !isLicenseExpired(d.licenseExpiry)).length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Gerencie motoristas e habilitações"
        icon={Users}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Motoristas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motoristas Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.suspended}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CNH a Vencer</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.expiring}</div>
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
                placeholder="Buscar motoristas..."
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
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Motorista
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: João da Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document" className="flex items-center gap-2">
                      <IdCard className="w-4 h-4 text-blue-500" />
                      CPF
                    </Label>
                    <Input
                      id="document"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber" className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-purple-500" />
                      Número da CNH
                    </Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="00000000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseCategory">Categoria CNH</Label>
                    <Select
                      value={formData.licenseCategory}
                      onValueChange={(value) => setFormData({ ...formData, licenseCategory: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Motos</SelectItem>
                        <SelectItem value="B">B - Carros</SelectItem>
                        <SelectItem value="C">C - Veículos de Carga</SelectItem>
                        <SelectItem value="D">D - Ônibus</SelectItem>
                        <SelectItem value="E">E - Carretas</SelectItem>
                        <SelectItem value="AB">AB - A + B</SelectItem>
                        <SelectItem value="AC">AC - A + C</SelectItem>
                        <SelectItem value="AD">AD - A + D</SelectItem>
                        <SelectItem value="AE">AE - A + E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseExpiry" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-red-500" />
                      Validade CNH
                    </Label>
                    <Input
                      id="licenseExpiry"
                      type="date"
                      value={formData.licenseExpiry}
                      onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-500" />
                      Telefone
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-orange-500" />
                      Email (opcional)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="motorista@email.com"
                    />
                  </div>

                  {editingDriver && (
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
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="suspended">Suspenso</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingDriver ? 'Atualizar' : 'Cadastrar'} Motorista
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

      {/* Drivers Table */}
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
                  <TableHead>Motorista</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>CNH</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Validade CNH</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum motorista encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={driver.photo} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                              {getInitials(driver.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{driver.name}</div>
                            {driver.email && (
                              <div className="text-xs text-muted-foreground">{driver.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{driver.document}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{driver.licenseNumber}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{driver.licenseCategory}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatDate(driver.licenseExpiry)}</span>
                          {isLicenseExpired(driver.licenseExpiry) && (
                            <Badge variant="destructive" className="text-xs">Vencida</Badge>
                          )}
                          {isLicenseExpiring(driver.licenseExpiry) && !isLicenseExpired(driver.licenseExpiry) && (
                            <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">A vencer</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{driver.phone}</TableCell>
                      <TableCell>{getStatusBadge(driver.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(driver)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(driver.id)}
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
