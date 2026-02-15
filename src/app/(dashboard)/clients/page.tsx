'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Search, Plus, Edit, Trash2, Users, Building2, Mail, Phone, MapPin, CreditCard, Ban, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Mock API functions - replace with real API calls
const getClients = async (): Promise<Client[]> => {
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    {
      id: 1,
      name: 'Transportadora ABC Ltda',
      document: '12.345.678/0001-90',
      email: 'contato@abctransportes.com.br',
      phone: '(11) 98765-4321',
      address: 'Rua das Flores, 123 - São Paulo, SP',
      plan: 'professional',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      devicesCount: 15
    },
    {
      id: 2,
      name: 'Logística XYZ S.A.',
      document: '98.765.432/0001-10',
      email: 'admin@logisticaxyz.com',
      phone: '(11) 91234-5678',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
      plan: 'enterprise',
      status: 'active',
      createdAt: '2023-11-20T08:30:00Z',
      devicesCount: 45
    },
    {
      id: 3,
      name: 'Entregas Rápidas Ltda',
      document: '11.222.333/0001-44',
      email: 'contato@entregasrapidas.com',
      phone: '(21) 97777-8888',
      address: 'Rua do Comércio, 456 - Rio de Janeiro, RJ',
      plan: 'basic',
      status: 'active',
      createdAt: '2024-03-10T14:20:00Z',
      devicesCount: 8
    },
    {
      id: 4,
      name: 'Frota Express',
      document: '55.666.777/0001-88',
      email: 'info@frotaexpress.com.br',
      phone: '(31) 99999-0000',
      address: 'Av. Afonso Pena, 789 - Belo Horizonte, MG',
      plan: 'professional',
      status: 'suspended',
      createdAt: '2023-08-05T09:15:00Z',
      devicesCount: 22
    }
  ];
};

const createClient = async (data: Partial<Client>): Promise<Client> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { id: Date.now(), ...data, createdAt: new Date().toISOString(), devicesCount: 0 } as Client;
};

const updateClient = async (id: number, data: Partial<Client>): Promise<Client> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { id, ...data } as Client;
};

const deleteClient = async (id: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    plan: 'basic' as 'basic' | 'professional' | 'enterprise',
    status: 'active' as 'active' | 'suspended' | 'canceled'
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente criado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao criar cliente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Client> }) => updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente atualizado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar cliente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir cliente');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      email: '',
      phone: '',
      address: '',
      plan: 'basic',
      status: 'active'
    });
    setEditingClient(null);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      document: client.document,
      email: client.email,
      phone: client.phone,
      address: client.address || '',
      plan: client.plan,
      status: client.status
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.document.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    const matchesPlan = planFilter === 'all' || client.plan === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Check className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20"><Ban className="w-3 h-3 mr-1" />Suspenso</Badge>;
      case 'canceled':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><Trash2 className="w-3 h-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'basic':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/50">Básico</Badge>;
      case 'professional':
        return <Badge variant="outline" className="text-purple-500 border-purple-500/50">Profissional</Badge>;
      case 'enterprise':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/50">Empresarial</Badge>;
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    suspended: clients.filter(c => c.status === 'suspended').length,
    totalDevices: clients.reduce((sum, c) => sum + c.devicesCount, 0)
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes e planos de monitoramento"
        icon={Users}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            <Ban className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.suspended}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDevices}</div>
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
                placeholder="Buscar clientes..."
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
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Planos</SelectItem>
                <SelectItem value="basic">Básico</SelectItem>
                <SelectItem value="professional">Profissional</SelectItem>
                <SelectItem value="enterprise">Empresarial</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      Nome/Razão Social
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Transportadora ABC Ltda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-green-500" />
                      CPF/CNPJ
                    </Label>
                    <Input
                      id="document"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-500" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@empresa.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-cyan-500" />
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
                    <Label htmlFor="plan">Plano</Label>
                    <Select
                      value={formData.plan}
                      onValueChange={(value) => setFormData({ ...formData, plan: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Básico</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="enterprise">Empresarial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      Endereço
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, número - Cidade, UF"
                    />
                  </div>

                  {editingClient && (
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
                          <SelectItem value="canceled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingClient ? 'Atualizar' : 'Criar'} Cliente
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

      {/* Clients Table */}
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Veículos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{client.document}</code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {client.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(client.plan)}</TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{client.devicesCount}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(client)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(client.id)}
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
