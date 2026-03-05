'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePermissionsStore } from '@/lib/stores/permissions';
import { useImpersonation } from '@/lib/hooks/useImpersonation';
import { BulkPermissionDialog } from '@/components/layout/bulk-permission-dialog';
import { PermissionSheet } from '@/components/layout/permission-sheet';
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
import { Search, Plus, Edit, Trash2, Users, Shield, User as UserIcon, Mail, Phone, Lock, Car, KeyRound, Wifi, WifiOff, ShieldCheck, LayoutTemplate, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/lib/stores/auth';

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const permUsers = usePermissionsStore((s) => s.users);
  const { user: adminUser } = useAuthStore();
  const { loginAs } = useImpersonation();
  // Estado do dialog "Entrar como usuário"
  const [loginAsTarget, setLoginAsTarget] = useState<User | null>(null);
  const [loginAsLoading, setLoginAsLoading] = useState(false);

  const handleLoginAs = async () => {
    if (!loginAsTarget) return;
    setLoginAsLoading(true);
    try {
      await loginAs(loginAsTarget); // valida server-side, cria cookie HttpOnly, audit log
      setLoginAsTarget(null);
    } catch {
      // erro já exibido via toast dentro do hook
      setLoginAsLoading(false);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);
  const [isPermSheetOpen, setIsPermSheetOpen] = useState(false);
  const [permSheetUser, setPermSheetUser] = useState<User | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [isBulkPermOpen, setIsBulkPermOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user' as UserRole,
    phone: '',
    password: '',
    deviceLimit: -1 as number,  // -1 = ilimitado
    userLimit: 0 as number,     // 0 = não é gerente
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', isSuperAdmin ? 'all' : adminUser?.id],
    queryFn: () => getUsers(isSuperAdmin ? undefined : adminUser?.id ?? undefined),
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
    onSuccess: (updatedUser, variables) => {
      console.log('[UI] Usuário atualizado com sucesso');
      queryClient.setQueryData(['users'], (old: User[] = []) =>
        old.map(u => {
          if (u.id !== variables.id) return u;
          return {
            ...u,
            ...updatedUser,
            name:  (variables.data as any).name  ?? (updatedUser as any).name  ?? u.name,
            email: (variables.data as any).email ?? (updatedUser as any).email ?? u.email,
            role:  (variables.data as any).role  ?? (updatedUser as any).role  ?? u.role,
            phone: (variables.data as any).phone ?? (updatedUser as any).phone ?? u.phone,
          };
        })
      );
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'none' });
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
      role: 'user',
      phone: '',
      password: '',
      deviceLimit: -1,
      userLimit: 0,
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
      password: '',
      deviceLimit: user.deviceLimit ?? -1,
      userLimit: user.userLimit ?? 0,
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
      // Merge do usuário completo (preserva todos os campos do Traccar)
      // com apenas os campos editados pelo form
      const mergedData = {
        ...editingUser,
        name:        updateData.name,
        email:       updateData.email,
        role:        updateData.role,
        phone:       updateData.phone,
        deviceLimit: updateData.deviceLimit,
        userLimit:   updateData.userLimit,
        ...(password ? { password } : {}),
      };
      updateMutation.mutate({ 
        id: editingUser.id, 
        data: mergedData,
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

  // ── Seleção em massa ───────────────────────────────────────────
  const eligibleUsers  = filteredUsers.filter(u => u.role !== 'admin');
  const isAllSelected  = eligibleUsers.length > 0 && eligibleUsers.every(u => selectedUserIds.has(u.id));
  const isSomeSelected = eligibleUsers.some(u => selectedUserIds.has(u.id));

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(eligibleUsers.map(u => u.id)));
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><Shield className="w-3 h-3 mr-1" />Administrador</Badge>;
      case 'manager':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Shield className="w-3 h-3 mr-1" />Gerente</Badge>;
      case 'user':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><UserIcon className="w-3 h-3 mr-1" />Usuário</Badge>;
      case 'readonly':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20"><Users className="w-3 h-3 mr-1" />Somente Leitura</Badge>;
      case 'deviceReadonly':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Users className="w-3 h-3 mr-1" />Leit. Dispositivos</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':          return 'Administrador';
      case 'manager':        return 'Gerente';
      case 'user':           return 'Usuário';
      case 'readonly':       return 'Somente Leitura';
      case 'deviceReadonly': return 'Leit. Dispositivos';
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
    admins:    users.filter(u => u.role === 'admin' || u.role === 'manager').length,
    users:     users.filter(u => u.role === 'user').length,
    readonlys: users.filter(u => u.role === 'readonly' || u.role === 'deviceReadonly').length
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
            <CardTitle className="text-sm font-medium">Admins / Gerentes</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários</CardTitle>
            <UserIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Somente Leitura</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.readonlys}</div>
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
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="readonly">Somente Leitura</SelectItem>
                <SelectItem value="deviceReadonly">Leit. Dispositivos</SelectItem>
              </SelectContent>
            </Select>

            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => setIsBulkPermOpen(true)}
                className="gap-2 border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
              >
                <LayoutTemplate className="w-4 h-4" />
                Presets
              </Button>
            )}

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
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="readonly">Somente Leitura</SelectItem>
                        <SelectItem value="deviceReadonly">Leit. Dispositivos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Limites Traccar */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="deviceLimit" className="flex items-center gap-2 text-sm">
                        <Car className="w-4 h-4 text-blue-500" />
                        Limite de Veículos
                      </Label>
                      <Input
                        id="deviceLimit"
                        type="number"
                        min={-1}
                        value={formData.deviceLimit}
                        onChange={(e) => setFormData({ ...formData, deviceLimit: parseInt(e.target.value) || -1 })}
                      />
                      <p className="text-[11px] text-muted-foreground">-1 = ilimitado · 0 = sem cadastrar</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userLimit" className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-purple-500" />
                        Limite de Usuários
                      </Label>
                      <Input
                        id="userLimit"
                        type="number"
                        min={-1}
                        value={formData.userLimit}
                        onChange={(e) => setFormData({ ...formData, userLimit: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">-1 = ilimitado · 0 = não gerente</p>
                    </div>
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
              <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Gerenciar Veículos — {selectedUser?.name}
                  </DialogTitle>
                  <DialogDescription>
                    Selecione os veículos que este usuário pode visualizar e gerenciar
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 overflow-hidden flex-1 min-h-0">

                  {/* ── SEÇÃO: Selecionados ───────────────────────────────── */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        Selecionados
                      </span>
                      <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        {selectedDeviceIds.length}
                      </span>
                    </div>
                    {selectedDeviceIds.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-3">Nenhum veículo selecionado ainda</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 p-2 max-h-28 overflow-y-auto">
                        {allDevices
                          .filter((d) => selectedDeviceIds.includes(d.id))
                          .map((device) => (
                            <span
                              key={device.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-300"
                            >
                              <Car className="w-2.5 h-2.5" />
                              {device.name}
                              {device.plate && <span className="text-emerald-400/60">· {device.plate}</span>}
                              <button
                                onClick={() => toggleDeviceSelection(device.id)}
                                className="ml-0.5 hover:text-red-400 transition-colors"
                                title="Remover"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* ── SEÇÃO: Disponíveis ───────────────────────────────── */}
                  <div className="flex flex-col gap-2 overflow-hidden flex-1 min-h-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar por nome, placa ou ID..."
                        value={vehicleSearchQuery}
                        onChange={(e) => setVehicleSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {allDevices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Nenhum veículo cadastrado</div>
                    ) : (
                      <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
                        {(() => {
                          const filtered = allDevices.filter((device) => {
                            if (!vehicleSearchQuery) return true;
                            const s = vehicleSearchQuery.toLowerCase();
                            return (
                              device.name.toLowerCase().includes(s) ||
                              (device.plate && device.plate.toLowerCase().includes(s)) ||
                              (device.uniqueId && device.uniqueId.toLowerCase().includes(s)) ||
                              device.id.toString().includes(s)
                            );
                          });

                          // Colocar selecionados no topo dentro da lista de disponíveis
                          const selected    = filtered.filter((d) => selectedDeviceIds.includes(d.id));
                          const unselected  = filtered.filter((d) => !selectedDeviceIds.includes(d.id));
                          const ordered     = [...selected, ...unselected];

                          if (ordered.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhum veículo encontrado</p>
                              </div>
                            );
                          }

                          return ordered.map((device) => {
                            const isSelected = selectedDeviceIds.includes(device.id);
                            return (
                              <div
                                key={device.id}
                                onClick={() => toggleDeviceSelection(device.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-emerald-500/25 bg-emerald-500/8 hover:bg-emerald-500/12'
                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleDeviceSelection(device.id)}
                                  className={isSelected ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600' : ''}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{device.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {device.plate && <span>{device.plate} &bull; </span>}
                                    {device.uniqueId}
                                  </div>
                                </div>
                                <Badge variant={device.status === 'online' ? 'success' : 'secondary'} className="shrink-0">
                                  {device.status}
                                </Badge>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <Button
                      onClick={handleSubmitDevices}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={updateDevicesMutation.isPending}
                    >
                      {updateDevicesMutation.isPending ? 'Salvando...' : `Salvar — ${selectedDeviceIds.length} veículo(s)`}
                    </Button>
                    <Button variant="outline" onClick={() => setIsDevicesDialogOpen(false)} className="shrink-0">
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Selection Bar */}
      {isSuperAdmin && selectedUserIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold">
              {selectedUserIds.size}
            </div>
            <span className="text-sm text-gray-300">
              {selectedUserIds.size} usuário(s) selecionado(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBulkPermOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Aplicar Preset
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedUserIds(new Set())}
              className="border-white/10 text-gray-400 hover:bg-white/5 text-xs h-8"
            >
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

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
                  {isSuperAdmin && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                        onCheckedChange={() => toggleSelectAll()}
                        className="border-gray-500"
                      />
                    </TableHead>
                  )}
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  {isSuperAdmin && <TableHead>Limites</TableHead>}
                  {isSuperAdmin && <TableHead>Permissões</TableHead>}
                  <TableHead>Conexão</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const connectionStatus = getConnectionStatus(user);
                    const StatusIcon = connectionStatus.icon;
                    
                    return (
                      <TableRow key={user.id}>
                        {isSuperAdmin && (
                          <TableCell className="w-10">
                            {user.role !== 'admin' && (
                              <Checkbox
                                checked={selectedUserIds.has(user.id)}
                                onCheckedChange={() => toggleSelectUser(user.id)}
                                className="border-gray-500"
                              />
                            )}
                          </TableCell>
                        )}
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
                        {isSuperAdmin && (
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Car className="w-3 h-3 text-blue-400" />
                                {user.deviceLimit === -1 ? <span className="text-green-400">Ilimitado</span>
                                  : user.deviceLimit === 0 ? <span className="text-red-400">Bloqueado</span>
                                  : <span className="text-yellow-400">{user.deviceLimit} veíc.</span>}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Users className="w-3 h-3 text-purple-400" />
                                {user.userLimit === -1 ? <span className="text-green-400">Ilimitado</span>
                                  : user.userLimit === 0 ? <span className="text-gray-400">Nenhum</span>
                                  : <span className="text-yellow-400">{user.userLimit} usuár.</span>}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {isSuperAdmin && (() => {
                          const entry = permUsers[user.id];
                          if (user.role === 'admin') {
                            return (
                              <TableCell>
                                <span className="text-[11px] text-purple-400/70 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Irrestrito
                                </span>
                              </TableCell>
                            );
                          }
                          if (!entry) {
                            return (
                              <TableCell>
                                <span className="text-[11px] text-gray-500">Padrão</span>
                              </TableCell>
                            );
                          }
                          if (entry.inheritFromCompany) {
                            return (
                              <TableCell>
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-400">
                                  <Shield className="w-3 h-3" /> Empresa
                                </span>
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell>
                              <span
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 max-w-[140px] truncate"
                                title={entry.appliedPresetName ?? 'Customizado'}
                              >
                                <LayoutTemplate className="w-3 h-3 shrink-0" />
                                <span className="truncate">{entry.appliedPresetName ?? 'Customizado'}</span>
                              </span>
                            </TableCell>
                          );
                        })()}
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
                            {isSuperAdmin && user.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setLoginAsTarget(user);
                                }}
                                title={`Entrar como ${user.name}`}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              >
                                <LogIn className="w-4 h-4" />
                              </Button>
                            )}
                            {isSuperAdmin && user.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setPermSheetUser(user); setIsPermSheetOpen(true); }}
                                title="Controle de acesso"
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </Button>
                            )}
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
      {/* Permission Sheet - Super Admin only */}
      <PermissionSheet
        mode="user"
        targetId={permSheetUser?.id ?? null}
        targetName={permSheetUser?.name ?? ''}
        open={isPermSheetOpen}
        onClose={() => { setIsPermSheetOpen(false); setPermSheetUser(null); }}
      />

      {/* Bulk Permission Dialog - Super Admin only */}
      {isSuperAdmin && (
        <BulkPermissionDialog
          open={isBulkPermOpen}
          onClose={() => setIsBulkPermOpen(false)}
          selectedUserIds={Array.from(selectedUserIds)}
          onApplied={() => setSelectedUserIds(new Set())}
        />
      )}

      {/* Dialog: Entrar como usuário (impersonação local) */}
      <Dialog open={!!loginAsTarget} onOpenChange={(v) => { if (!v && !loginAsLoading) { setLoginAsTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <LogIn className="w-5 h-5" />
              Entrar como usuário
            </DialogTitle>
            <DialogDescription>
              Você entrará na plataforma <strong className="text-white">como {loginAsTarget?.name}</strong>.
              Um banner aparecerá no topo para você voltar ao admin a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Info do usuário alvo */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-300 font-bold text-sm shrink-0">
                {loginAsTarget?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{loginAsTarget?.name}</p>
                <p className="text-xs text-gray-400 truncate">{loginAsTarget?.email}</p>
              </div>
            </div>

            {/* Badge de acesso direto */}
            <p className="text-xs text-emerald-400/80 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Nenhuma senha necessária — acesso de superadmin.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => handleLoginAs()}
              disabled={loginAsLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {loginAsLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar como {loginAsTarget?.name?.split(' ')[0]}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setLoginAsTarget(null); }}
              disabled={loginAsLoading}
              className="shrink-0"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
