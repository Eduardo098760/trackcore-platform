'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Organization } from '@/types';
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
import { Search, Plus, Edit, Trash2, Building2, Globe, Users, HardDrive, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// API functions
const getOrganizations = async (): Promise<Organization[]> => {
  const res = await fetch('/api/organizations');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const createOrganization = async (data: Partial<Organization>): Promise<Organization> => {
  const res = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
};

const updateOrganization = async (id: number, data: Partial<Organization>): Promise<Organization> => {
  const res = await fetch(`/api/organizations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
};

const deleteOrganization = async (id: number): Promise<void> => {
  const res = await fetch(`/api/organizations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    plan: 'professional' as 'basic' | 'professional' | 'enterprise',
    status: 'active' as 'active' | 'suspended' | 'trial',
    maxDevices: 50,
    maxUsers: 10,
    features: [] as string[]
  });

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: getOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organização criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao criar organização');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Organization> }) => 
      updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organização atualizada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar organização');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organização excluída com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir organização');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      domain: '',
      plan: 'professional',
      status: 'active',
      maxDevices: 50,
      maxUsers: 10,
      features: []
    });
    setEditingOrg(null);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      domain: org.domain || '',
      plan: org.plan,
      status: org.status,
      maxDevices: org.settings.maxDevices,
      maxUsers: org.settings.maxUsers,
      features: org.settings.features
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      settings: {
        maxDevices: formData.maxDevices,
        maxUsers: formData.maxUsers,
        features: formData.features
      }
    };

    if (editingOrg) {
      updateMutation.mutate({ id: editingOrg.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta organização?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         org.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      active: <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Ativo</Badge>,
      suspended: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Suspenso</Badge>,
      trial: <Badge variant="outline" className="text-amber-500"><Clock className="w-3 h-3 mr-1" />Trial</Badge>
    };
    return variants[status as keyof typeof variants] || <Badge variant="outline">{status}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const variants = {
      basic: <Badge variant="outline">Básico</Badge>,
      professional: <Badge variant="outline" className="text-blue-500 border-blue-500/50">Profissional</Badge>,
      enterprise: <Badge variant="outline" className="text-purple-500 border-purple-500/50">Enterprise</Badge>
    };
    return variants[plan as keyof typeof variants] || <Badge variant="outline">{plan}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizações (Multi-tenant)"
        description="Gerencie organizações e seus limites de recursos"
        icon={Building2}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.status === 'trial').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.status === 'suspended').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nome ou slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Organização
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingOrg ? 'Editar Organização' : 'Nova Organização'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">Nome da Organização *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Transportadora ABC"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug">Slug (URL) *</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                        placeholder="transportadora-abc"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Usado no subdomínio: {formData.slug || 'slug'}.trackcore.com
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="domain">Domínio Customizado</Label>
                      <Input
                        id="domain"
                        value={formData.domain}
                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                        placeholder="rastreamento.empresa.com.br"
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan">Plano</Label>
                      <Select value={formData.plan} onValueChange={(v: any) => setFormData({ ...formData, plan: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="suspended">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="maxDevices">Máximo de Dispositivos</Label>
                      <Input
                        id="maxDevices"
                        type="number"
                        value={formData.maxDevices}
                        onChange={(e) => setFormData({ ...formData, maxDevices: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxUsers">Máximo de Usuários</Label>
                      <Input
                        id="maxUsers"
                        type="number"
                        value={formData.maxUsers}
                        onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>
                      {editingOrg ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Table */}
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
                  <TableHead>Organização</TableHead>
                  <TableHead>Slug/Domínio</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Limites</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma organização encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-xs text-muted-foreground">ID: {org.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded block">
                            {org.slug}.trackcore.com
                          </code>
                          {org.domain && (
                            <code className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded block">
                              <Globe className="w-3 h-3 inline mr-1" />
                              {org.domain}
                            </code>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(org.plan)}</TableCell>
                      <TableCell>{getStatusBadge(org.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <HardDrive className="w-3 h-3 text-muted-foreground" />
                            <span>{org.settings.maxDevices} devices</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span>{org.settings.maxUsers} users</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(org.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(org)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(org.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
