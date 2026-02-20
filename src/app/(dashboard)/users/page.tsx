'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, UserRole, Device } from '@/types';
import { 
  getUsers, 
  createUser as apiCreateUser, 
  updateUser as apiUpdateUser, 
  deleteUser as apiDeleteUser,
  getUserDevices,
  setUserDevices,
  updateUserPassword,
  getDevices
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Search, Plus, Edit, Trash2, Users, Shield, User as UserIcon, Mail, Phone, Lock, Car, KeyRound, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'operator' as UserRole,
    phone: '',
    password: ''
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const { data: allDevices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: userDevices = [] } = useQuery({
    queryKey: ['userDevices', selectedUser?.id],
    queryFn: () => selectedUser ? getUserDevices(selectedUser.id) : Promise.resolve([]),
    enabled: !!selectedUser && isDevicesDialogOpen,
  });

  // Sincronizar devices carregados do servidor com estado local
  // Carrega apenas quando o dialog abre pela primeira vez
  useEffect(() => {
    if (userDevices && userDevices.length > 0 && isDevicesDialogOpen && selectedDeviceIds.length === 0) {
      const deviceIds = userDevices.map(d => d.id);
      console.log(`[UI] useEffect - Carregando devices iniciais para ${selectedUser?.name}:`, deviceIds);
      setSelectedDeviceIds(deviceIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDevices]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🚀 [UI] createMutation.mutationFn CHAMADA!');
      console.log('🚀 [UI] Dados recebidos:', data);
      return apiCreateUser(data);
    },
    onSuccess: (data) => {
      console.log('[UI] Usuário criado com sucesso:', data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('[UI] Erro ao criar usuário:', error);
      console.error('[UI] Tipo do erro:', typeof error);
      console.error('[UI] JSON do erro:', JSON.stringify(error));
      const errorMessage = error?.message || error?.status || 'Erro ao criar usuário';
      toast.error(`Erro: ${errorMessage}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => apiUpdateUser(id, data),
    onSuccess: () => {
      console.log('[UI] Usuário atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('[UI] Erro ao atualizar usuário:', error);
      const errorMessage = error?.message || error?.status || 'Erro ao atualizar usuário';
      toast.error(`Erro: ${errorMessage}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir usuário');
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) => {
      console.log('Atualizando senha do usuário:', userId);
      return updateUserPassword(userId, password);
    },
    onSuccess: () => {
      console.log('Senha atualizada com sucesso!');
      toast.success('Senha atualizada com sucesso!');
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar senha:', error);
      const errorMessage = error?.message || 'Erro ao atualizar senha';
      toast.error(errorMessage);
    },
  });

  const updateDevicesMutation = useMutation({
    mutationFn: ({ userId, deviceIds }: { userId: number; deviceIds: number[] }) => {
      console.log('Atualizando veículos do usuário:', userId, 'Veículos:', deviceIds);
      return setUserDevices(userId, deviceIds);
    },
    onSuccess: () => {
      console.log('Veículos atualizados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['userDevices'] });
      toast.success('Veículos atualizados com sucesso!');
      setIsDevicesDialogOpen(false);
      setSelectedUser(null);
      setSelectedDeviceIds([]);
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar veículos:', error);
      const errorMessage = error?.message || 'Erro ao atualizar veículos';
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'operator',
      phone: '',
      password: ''
    });
    setEditingUser(null);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      password: ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    console.log('[UI] handleSubmit chamado');
    console.log('[UI] editingUser:', editingUser);
    console.log('[UI] formData:', formData);
    
    // Validação básica
    if (!formData.name || !formData.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    
    if (!editingUser && !formData.password) {
      toast.error('Senha é obrigatória para novos usuários');
      return;
    }
    
    if (editingUser) {
      console.log('[UI] Atualizando usuário existente:', editingUser.id);
      const { password, ...updateData } = formData;
      updateMutation.mutate({ 
        id: editingUser.id, 
        data: password ? formData : updateData 
      });
    } else {
      console.log('[UI] Criando novo usuário');
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleChangePassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsPasswordDialogOpen(true);
  };

  const handleSubmitPassword = () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    updatePasswordMutation.mutate({ userId: selectedUser.id, password: newPassword });
  };

  const handleManageDevices = (user: User) => {
    console.log(`[UI] handleManageDevices chamado para usuário ${user.id} - ${user.name}`);
    // Só limpar se for um usuário diferente
    if (selectedUser?.id !== user.id) {
      console.log('[UI] Mudando de usuário, limpando seleção anterior');
      setSelectedDeviceIds([]);
    }
    setSelectedUser(user);
    setVehicleSearchQuery(''); // Limpar busca ao abrir
    setIsDevicesDialogOpen(true);
    // userDevices será carregado automaticamente quando o dialog abrir
  };

  const handleSubmitDevices = () => {
    if (!selectedUser) return;
    console.log(`[UI] handleSubmitDevices - Salvando ${selectedDeviceIds.length} veículos para usuário ${selectedUser.id} - ${selectedUser.name}`);
    console.log('[UI] DeviceIds selecionados:', selectedDeviceIds);
    updateDevicesMutation.mutate({ userId: selectedUser.id, deviceIds: selectedDeviceIds });
  };

  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const getConnectionStatus = (user: User) => {
    if (!user.lastLogin) {
      return { status: 'Nunca conectado', variant: 'secondary' as const, icon: WifiOff };
    }
    
    const lastLogin = new Date(user.lastLogin);
    const now = new Date();
    const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLogin < 1) {
      return { status: 'Online', variant: 'success' as const, icon: Wifi };
    } else if (hoursSinceLogin < 24) {
      return { status: `Há ${Math.floor(hoursSinceLogin)}h`, variant: 'default' as const, icon: WifiOff };
    } else {
      const days = Math.floor(hoursSinceLogin / 24);
      return { status: `Há ${days}d`, variant: 'secondary' as const, icon: WifiOff };
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><Shield className="w-3 h-3 mr-1" />Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'operator':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><UserIcon className="w-3 h-3 mr-1" />Operador</Badge>;
      case 'client':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Users className="w-3 h-3 mr-1" />Cliente</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'superadmin': return 'Super Administrador';
      case 'admin': return 'Administrador';
      case 'operator': return 'Operador';
      case 'client': return 'Cliente';
      default: return role;
    }
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
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    operators: users.filter(u => u.role === 'operator').length,
    clients: users.filter(u => u.role === 'client').length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Gerencie usuários e permissões do sistema"
        icon={Users}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operadores</CardTitle>
            <UserIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.operators}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.clients}</div>
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
                placeholder="Buscar usuários..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Funções</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-blue-500" />
                      Nome Completo
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: João Silva"
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
                      placeholder="usuario@email.com"
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
                    <Label htmlFor="role" className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-500" />
                      Função
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superadmin">Super Administrador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-500" />
                      {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingUser ? 'Atualizar' : 'Criar'} Usuário
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Password Change Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5" />
                    Alterar Senha - {selectedUser?.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-500" />
                      Nova Senha
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    />
                    <p className="text-xs text-muted-foreground">
                      A senha deve ter no mínimo 6 caracteres
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSubmitPassword} 
                    className="flex-1"
                    disabled={updatePasswordMutation.isPending}
                  >
                    {updatePasswordMutation.isPending ? 'Atualizando...' : 'Atualizar Senha'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Devices Management Dialog */}
            <Dialog open={isDevicesDialogOpen} onOpenChange={(open) => {
              setIsDevicesDialogOpen(open);
              if (open && selectedUser) {
                console.log(`[UI] Abrindo dialog de veículos para usuário ${selectedUser.id} - ${selectedUser.name}`);
                // Devices serão carregados automaticamente pelo React Query
              } else if (!open) {
                // Apenas limpar a busca e o usuário selecionado
                console.log('[UI] Fechando dialog de veículos');
                setVehicleSearchQuery('');
                // Não limpar selectedDeviceIds para manter a última seleção
              }
            }}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Gerenciar Veículos - {selectedUser?.name}
                  </DialogTitle>
                  <DialogDescription>
                    Selecione os veículos que este usuário pode visualizar e gerenciar
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Campo de busca de veículos */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Buscar veículos por nome, placa ou ID..."
                      value={vehicleSearchQuery}
                      onChange={(e) => setVehicleSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {allDevices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum veículo cadastrado
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(() => {
                        const filteredDevices = allDevices.filter(device => {
                          if (!vehicleSearchQuery) return true;
                          const search = vehicleSearchQuery.toLowerCase();
                          return (
                            device.name.toLowerCase().includes(search) ||
                            (device.plate && device.plate.toLowerCase().includes(search)) ||
                            (device.uniqueId && device.uniqueId.toLowerCase().includes(search)) ||
                            device.id.toString().includes(search)
                          );
                        });

                        if (filteredDevices.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>Nenhum veículo encontrado</p>
                              <p className="text-sm">Tente buscar com outros termos</p>
                            </div>
                          );
                        }

                        return filteredDevices.map((device) => (
                          <div
                            key={device.id}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => toggleDeviceSelection(device.id)}
                          >
                            <Checkbox
                              checked={selectedDeviceIds.includes(device.id)}
                              onCheckedChange={() => toggleDeviceSelection(device.id)}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{device.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {device.plate} • {device.uniqueId}
                              </div>
                            </div>
                            <Badge variant={device.status === 'online' ? 'success' : 'secondary'}>
                              {device.status}
                            </Badge>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm text-muted-foreground">
                      {selectedDeviceIds.length} {selectedDeviceIds.length === 1 ? 'veículo selecionado' : 'veículos selecionados'}
                    </div>
                    {vehicleSearchQuery && (
                      <div className="text-sm text-muted-foreground">
                        {allDevices.filter(device => {
                          const search = vehicleSearchQuery.toLowerCase();
                          return (
                            device.name.toLowerCase().includes(search) ||
                            (device.plate && device.plate.toLowerCase().includes(search)) ||
                            (device.uniqueId && device.uniqueId.toLowerCase().includes(search)) ||
                            device.id.toString().includes(search)
                          );
                        }).length} {' '}
                        resultado(s) encontrado(s)
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSubmitDevices} 
                    className="flex-1"
                    disabled={updateDevicesMutation.isPending}
                  >
                    {updateDevicesMutation.isPending ? 'Salvando...' : 'Salvar Veículos'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDevicesDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
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
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const connectionStatus = getConnectionStatus(user);
                    const StatusIcon = connectionStatus.icon;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {user.phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Badge variant={connectionStatus.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {connectionStatus.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(user)}
                              title="Editar usuário"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleChangePassword(user)}
                              title="Alterar senha"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleManageDevices(user)}
                              title="Gerenciar veículos"
                            >
                              <Car className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(user.id)}
                              className="text-red-500 hover:text-red-600"
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
