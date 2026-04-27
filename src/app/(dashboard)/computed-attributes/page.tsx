'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator, Plus, Edit, Trash2, Search, Code, AlertCircle, Loader2, BarChart3, Send, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getUsers } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { createKpi, deleteKpi, dispatchKpiReports, getKpis, updateKpi } from '@/lib/api/kpis';
import {
  getComputedAttributes,
  createComputedAttribute,
  updateComputedAttribute,
  deleteComputedAttribute,
  TraccarComputedAttribute,
} from '@/lib/api/computed-attributes';
import {
  KPI,
  KPI_REPORT_FREQUENCY_OPTIONS,
  KPI_REPORT_PERIOD_OPTIONS,
  type AggregationType,
  type PeriodType,
  type KPIReportFrequency,
  type KPIReportPeriod,
} from '@/types/kpi';
import type { User } from '@/types';

const mapReportPeriodToKpiPeriod = (period: KPIReportPeriod): PeriodType => {
  if (period === 'current') return 'current';
  return period;
};

const exampleExpressions = [
  { label: 'Consumo (km/l)', value: 'totalDistance / fuelUsed' },
  { label: 'Velocidade > 80', value: 'speed > 80' },
  { label: 'Bateria Baixa', value: 'batteryLevel < 20' },
  { label: 'Tempo Parado (min)', value: 'stopDuration / 60' },
];

export default function ComputedAttributesPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserEmail = useAuthStore((state) => state.user?.email || state.email || '');
  const organizationId = useAuthStore((state) => state.organization?.id ?? state.user?.organizationId ?? state.user?.clientId);
  const isGlobalAdmin = currentUser?.role === 'admin' && organizationId == null;
  const canManageAssignments = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager' ||
    ((currentUser?.userLimit ?? 0) !== 0),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isKpiDialogOpen, setIsKpiDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<TraccarComputedAttribute | null>(null);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<TraccarComputedAttribute | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    attribute: '',
    expression: '',
    type: 'number' as 'string' | 'number' | 'boolean',
    organizationWide: true,
    assignedUserIds: [] as number[],
  });
  const [kpiForm, setKpiForm] = useState({
    name: '',
    aggregation: 'count' as AggregationType,
    unit: '',
    enabledOnDashboard: true,
    emailEnabled: false,
    recipients: '',
    frequency: 'weekly' as KPIReportFrequency,
    period: '7d' as KPIReportPeriod,
    deliveryTime: '18:00',
    weeklyDay: '5',
    sendPdf: true,
    customMessage: '',
  });

  // ─── Queries ───────────────────────────────────────────────────────
  const { data: attributes = [], isLoading, error } = useQuery({
    queryKey: ['computed-attributes', organizationId ?? 'no-org'],
    queryFn: getComputedAttributes,
    staleTime: 30000,
  });

  const { data: kpiResponse = { kpis: [] }, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['kpis', organizationId],
    queryFn: () => getKpis(organizationId),
  });

  const { data: assignableUsers = [], isLoading: isLoadingAssignableUsers } = useQuery<User[]>({
    queryKey: ['computed-attribute-assignable-users', currentUser?.id],
    queryFn: () => getUsers(isGlobalAdmin ? undefined : currentUser?.id),
    enabled: canManageAssignments,
    staleTime: 30000,
  });

  // ─── Mutations ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Omit<TraccarComputedAttribute, 'id'>) => createComputedAttribute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['computed-attributes'] });
      toast.success('Atributo computado criado com sucesso!');
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao criar atributo: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TraccarComputedAttribute }) => updateComputedAttribute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['computed-attributes'] });
      toast.success('Atributo atualizado com sucesso!');
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteComputedAttribute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['computed-attributes'] });
      toast.success('Atributo excluído com sucesso!');
    },
    onError: (err: any) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const createKpiMutation = useMutation({
    mutationFn: createKpi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      toast.success('KPI criado com sucesso!');
      setIsKpiDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao criar KPI: ${err.message}`),
  });

  const updateKpiMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KPI> }) => updateKpi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      toast.success('KPI atualizado com sucesso!');
      setIsKpiDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao atualizar KPI: ${err.message}`),
  });

  const deleteKpiMutation = useMutation({
    mutationFn: deleteKpi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      toast.success('KPI excluído com sucesso!');
      setIsKpiDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao excluir KPI: ${err.message}`),
  });

  const dispatchMutation = useMutation({
    mutationFn: (kpiId: string) => dispatchKpiReports({ kpiId, force: true, organizationId }),
    onSuccess: (response) => {
      const sent = response.results.filter((item) => item.status === 'sent').length;
      toast.success(sent > 0 ? 'Relatório enviado com sucesso!' : 'Nenhum relatório foi enviado.');
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
    },
    onError: (err: any) => toast.error(`Erro ao enviar relatório: ${err.message}`),
  });

  // ─── Filtros ───────────────────────────────────────────────────────
  const filteredAttributes = useMemo(
    () =>
      attributes.filter(
        (a) =>
          a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.attribute.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [attributes, searchTerm],
  );

  const linkedKpis = kpiResponse.kpis;
  const assignableUsersById = useMemo(
    () => new Map(assignableUsers.map((user) => [user.id, user])),
    [assignableUsers],
  );

  const linkedKpisByAttribute = useMemo(() => {
    return linkedKpis.reduce<Record<string, KPI[]>>((acc, item) => {
      const key = item.sensorKey;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [linkedKpis]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingAttribute(null);
    setFormData({
      description: '',
      attribute: '',
      expression: '',
      type: 'number',
      organizationWide: true,
      assignedUserIds: [],
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (attr: TraccarComputedAttribute) => {
    const assignedUserIds = Array.isArray(attr.assignedUserIds) ? attr.assignedUserIds : [];
    setEditingAttribute(attr);
    setFormData({
      description: attr.description,
      attribute: attr.attribute,
      expression: attr.expression,
      type: attr.type,
      organizationWide: assignedUserIds.length === 0,
      assignedUserIds,
    });
    setIsDialogOpen(true);
  };

  const toggleAssignedUser = (userId: number, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      assignedUserIds: checked
        ? Array.from(new Set([...prev.assignedUserIds, userId]))
        : prev.assignedUserIds.filter((id) => id !== userId),
    }));
  };

  const handleDelete = (attr: TraccarComputedAttribute) => {
    if (confirm(`Excluir o atributo "${attr.description}"?`)) {
      deleteMutation.mutate(attr.id);
    }
  };

  const handleOpenKpiDialog = (attribute: TraccarComputedAttribute, kpi?: KPI) => {
    setSelectedAttribute(attribute);
    setEditingKpi(kpi || null);
    setKpiForm({
      name: kpi?.name || attribute.description,
      aggregation: (kpi?.aggregation || (attribute.type === 'number' ? 'avg' : 'count')) as AggregationType,
      unit: kpi?.unit || '',
      enabledOnDashboard: kpi?.enabledOnDashboard ?? true,
      emailEnabled: Boolean(kpi?.reportSchedule?.enabled),
      recipients: currentUserEmail,
      frequency: kpi?.reportSchedule?.frequency || 'weekly',
      period: (kpi?.reportSchedule?.period || '7d') as KPIReportPeriod,
      deliveryTime: kpi?.reportSchedule?.deliveryTime || '18:00',
      weeklyDay: String(kpi?.reportSchedule?.weeklyDay ?? 5),
      sendPdf: kpi?.reportSchedule?.sendPdf ?? true,
      customMessage: kpi?.reportSchedule?.customMessage || '',
    });
    setIsKpiDialogOpen(true);
  };

  const handleDeleteKpi = (kpi: KPI) => {
    if (confirm(`Excluir o KPI "${kpi.name}"?`)) {
      deleteKpiMutation.mutate(kpi.id);
    }
  };

  const handleSaveKpi = () => {
    if (!selectedAttribute) {
      toast.error('Selecione um atributo para criar o KPI.');
      return;
    }

    if (!kpiForm.name.trim()) {
      toast.error('O nome do KPI é obrigatório.');
      return;
    }

    const recipients = currentUserEmail ? [currentUserEmail] : [];

    if (kpiForm.emailEnabled && recipients.length === 0) {
      toast.error('Não existe email cadastrado para o usuário atual.');
      return;
    }

    const payload: Partial<KPI> = {
      name: kpiForm.name.trim(),
      organizationId: organizationId ?? undefined,
      computedAttributeId: selectedAttribute.id,
      attributeName: selectedAttribute.attribute,
      sensorKey: selectedAttribute.attribute,
      sensorLabel: selectedAttribute.description,
      sensorType: selectedAttribute.type,
      source: 'auto',
      aggregation: kpiForm.aggregation,
      filter: '',
      period: mapReportPeriodToKpiPeriod(kpiForm.period),
      unit: kpiForm.unit.trim(),
      enabledOnDashboard: kpiForm.enabledOnDashboard,
      chart: 'card',
      groupBy: 'vehicle',
      reportSchedule: kpiForm.emailEnabled
        ? {
            enabled: true,
            recipients,
            frequency: kpiForm.frequency,
            period: kpiForm.period,
            deliveryTime: kpiForm.deliveryTime,
            weeklyDay: Number(kpiForm.weeklyDay),
            sendPdf: kpiForm.sendPdf,
            customMessage: kpiForm.customMessage.trim(),
          }
        : null,
    };

    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: payload });
      return;
    }

    createKpiMutation.mutate(payload);
  };

  const handleSave = () => {
    if (!formData.description.trim()) {
      toast.error('Descrição é obrigatória.');
      return;
    }
    if (!formData.attribute.trim()) {
      toast.error('Nome do atributo é obrigatório.');
      return;
    }
    if (!formData.expression.trim()) {
      toast.error('Expressão é obrigatória.');
      return;
    }

    if (canManageAssignments && !formData.organizationWide && formData.assignedUserIds.length === 0) {
      toast.error('Selecione ao menos um usuário para restringir o atributo.');
      return;
    }

    const payload = {
      description: formData.description,
      attribute: formData.attribute,
      expression: formData.expression,
      type: formData.type,
      assignedUserIds: canManageAssignments && !formData.organizationWide ? formData.assignedUserIds : [],
    };

    if (editingAttribute) {
      updateMutation.mutate({
        id: editingAttribute.id,
        data: { id: editingAttribute.id, ...payload },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const stats = useMemo(
    () => ({
      total: attributes.length,
      numbers: attributes.filter((a) => a.type === 'number').length,
      booleans: attributes.filter((a) => a.type === 'boolean').length,
    }),
    [attributes],
  );

  const getAssignedUsersLabel = (attribute: TraccarComputedAttribute) => {
    const assignedUserIds = Array.isArray(attribute.assignedUserIds) ? attribute.assignedUserIds : [];
    if (assignedUserIds.length === 0) {
      return 'Toda a organização';
    }

    const names = assignedUserIds
      .map((userId) => assignableUsersById.get(userId)?.name)
      .filter(Boolean) as string[];

    if (names.length === 0) {
      return `${assignedUserIds.length} usuário(s) selecionado(s)`;
    }

    return names.join(', ');
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Atributos Computados" description="Crie fórmulas customizadas para cálculos em tempo real" icon={Calculator} />
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="text-muted-foreground">Erro ao carregar atributos computados.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['computed-attributes'] })}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atributos Computados"
        description="Crie fórmulas customizadas para cálculos em tempo real"
        icon={Calculator}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Atributos</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Numéricos</CardTitle>
            <Code className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.numbers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booleanos</CardTitle>
            <Code className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.booleans}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar atributos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Atributo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Atributos Configurados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando atributos...</span>
            </div>
          ) : attributes.length === 0 ? (
            <div className="text-center py-10">
              <Calculator className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum atributo computado cadastrado.</p>
              <Button onClick={handleAdd} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro atributo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAttributes.map((attr) => (
                <div key={attr.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{attr.description}</h3>
                        <Badge variant="outline" className="text-xs">
                          {attr.type}
                        </Badge>
                        {canManageAssignments && (
                          <Badge variant="outline" className="text-xs">
                            <UsersIcon className="h-3 w-3 mr-1" />
                            {Array.isArray(attr.assignedUserIds) && attr.assignedUserIds.length > 0
                              ? `${attr.assignedUserIds.length} usuário(s)`
                              : 'Organização'}
                          </Badge>
                        )}
                        {(linkedKpisByAttribute[attr.attribute] || []).length > 0 && (
                          <Badge className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {(linkedKpisByAttribute[attr.attribute] || []).length} KPI(s)
                          </Badge>
                        )}
                      </div>
                      <div className="bg-muted/50 p-2 rounded font-mono text-xs">
                        <span className="text-blue-600 dark:text-blue-400">{attr.attribute}</span>
                        <span className="text-gray-500"> = </span>
                        <span className="text-green-600 dark:text-green-400">{attr.expression}</span>
                      </div>
                      {canManageAssignments && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Disponível para: {getAssignedUsersLabel(attr)}
                        </p>
                      )}
                      {(linkedKpisByAttribute[attr.attribute] || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {(linkedKpisByAttribute[attr.attribute] || []).map((kpi) => (
                            <div key={kpi.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{kpi.name}</Badge>
                              {kpi.enabledOnDashboard !== false && <Badge variant="outline">Dashboard</Badge>}
                              {kpi.reportSchedule?.enabled && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {KPI_REPORT_FREQUENCY_OPTIONS.find((item) => item.value === kpi.reportSchedule?.frequency)?.label || 'Relatório ativo'}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenKpiDialog(attr, linkedKpisByAttribute[attr.attribute]?.[0])}>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(attr)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(attr)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAttribute ? 'Editar Atributo Computado' : 'Novo Atributo Computado'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Nome *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Consumo Médio"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attribute">Nome do Atributo *</Label>
                <Input
                  id="attribute"
                  value={formData.attribute}
                  onChange={(e) => setFormData({ ...formData, attribute: e.target.value })}
                  placeholder="Ex: avgConsumption"
                />
                <p className="text-xs text-muted-foreground">Nome técnico sem espaços</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Retorno *</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="number">Número</option>
                  <option value="string">Texto</option>
                  <option value="boolean">Verdadeiro/Falso</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expression">Expressão de Cálculo *</Label>
              <Textarea
                id="expression"
                value={formData.expression}
                onChange={(e) => setFormData({ ...formData, expression: e.target.value })}
                placeholder="Ex: totalDistance / fuelUsed"
                rows={3}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <p className="text-xs text-muted-foreground w-full">Exemplos:</p>
                {exampleExpressions.map((ex) => (
                  <Button
                    key={ex.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setFormData({ ...formData, expression: ex.value })}
                  >
                    {ex.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  <p className="font-medium mb-1">Variáveis disponíveis:</p>
                  <p>speed, totalDistance, fuelUsed, ignition, batteryLevel, rpm, temperature, etc.</p>
                  <p className="mt-1">Operadores: +, -, *, /, ==, !=, &lt;, &gt;, &amp;&amp;, ||</p>
                </div>
              </div>
            </div>

            {canManageAssignments && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Disponibilizar para toda a organização</p>
                    <p className="text-xs text-muted-foreground">
                      Desative para escolher exatamente quais usuários poderão visualizar este atributo.
                    </p>
                  </div>
                  <Switch
                    checked={formData.organizationWide}
                    onCheckedChange={(checked) => setFormData((prev) => ({
                      ...prev,
                      organizationWide: checked,
                      assignedUserIds: checked ? [] : prev.assignedUserIds,
                    }))}
                  />
                </div>

                {!formData.organizationWide && (
                  <div className="space-y-3">
                    <div className="rounded-md border max-h-56 overflow-y-auto">
                      {isLoadingAssignableUsers ? (
                        <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando usuários...
                        </div>
                      ) : assignableUsers.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          Nenhum usuário subordinado disponível para atribuição.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {assignableUsers.map((user) => {
                            const isChecked = formData.assignedUserIds.includes(user.id);
                            return (
                              <label
                                key={user.id}
                                className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => toggleAssignedUser(user.id, checked === true)}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-none">{user.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{user.email || 'Sem email cadastrado'}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O administrador mantém acesso de gestão mesmo quando restringe a visualização para usuários específicos.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!formData.description || !formData.attribute || !formData.expression || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isKpiDialogOpen} onOpenChange={setIsKpiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingKpi ? 'Configurar KPI e Relatório' : 'Transformar em KPI'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Atributo de origem</p>
              <p>{selectedAttribute?.description || '-'}</p>
              <p className="text-xs mt-1">Chave técnica: {selectedAttribute?.attribute || '-'}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kpi-name">Nome do KPI *</Label>
                <Input
                  id="kpi-name"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  placeholder="Ex: Alarme diário da prancha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kpi-unit">Unidade / sufixo</Label>
                <Input
                  id="kpi-unit"
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  placeholder="Ex: %, km/h, alertas"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kpi-aggregation">Agregação</Label>
                <select
                  id="kpi-aggregation"
                  value={kpiForm.aggregation}
                  onChange={(e) => setKpiForm({ ...kpiForm, aggregation: e.target.value as AggregationType })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="count">Contagem</option>
                  <option value="sum">Soma</option>
                  <option value="avg">Média</option>
                  <option value="min">Mínimo</option>
                  <option value="max">Máximo</option>
                </select>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Exibir no dashboard</p>
                    <p className="text-xs text-muted-foreground">Torna o KPI visível para a gestão na dashboard principal.</p>
                  </div>
                  <Switch
                    checked={kpiForm.enabledOnDashboard}
                    onCheckedChange={(checked) => setKpiForm({ ...kpiForm, enabledOnDashboard: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Relatório automático por email</p>
                  <p className="text-xs text-muted-foreground">Envio gerencial com anexo PDF e base temporal clara.</p>
                </div>
                <Switch
                  checked={kpiForm.emailEnabled}
                  onCheckedChange={(checked) => setKpiForm({ ...kpiForm, emailEnabled: checked })}
                />
              </div>

              {kpiForm.emailEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="kpi-recipients">Emails de destino</Label>
                    <Input
                      id="kpi-recipients"
                      value={kpiForm.recipients}
                      readOnly
                      disabled
                      placeholder="email cadastrado do usuário"
                    />
                    <p className="text-xs text-muted-foreground">
                      O relatório será enviado sempre para o email cadastrado do usuário logado.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="kpi-frequency">Frequência</Label>
                      <select
                        id="kpi-frequency"
                        value={kpiForm.frequency}
                        onChange={(e) => setKpiForm({ ...kpiForm, frequency: e.target.value as KPIReportFrequency })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {KPI_REPORT_FREQUENCY_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi-period">Período de análise</Label>
                      <select
                        id="kpi-period"
                        value={kpiForm.period}
                        onChange={(e) => setKpiForm({ ...kpiForm, period: e.target.value as KPIReportPeriod })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {KPI_REPORT_PERIOD_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kpi-delivery">Hora do envio</Label>
                      <Input
                        id="kpi-delivery"
                        type="time"
                        value={kpiForm.deliveryTime}
                        onChange={(e) => setKpiForm({ ...kpiForm, deliveryTime: e.target.value })}
                      />
                    </div>
                  </div>

                  {kpiForm.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label htmlFor="kpi-weekday">Dia de fechamento semanal</Label>
                      <select
                        id="kpi-weekday"
                        value={kpiForm.weeklyDay}
                        onChange={(e) => setKpiForm({ ...kpiForm, weeklyDay: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="0">Domingo</option>
                        <option value="1">Segunda-feira</option>
                        <option value="2">Terça-feira</option>
                        <option value="3">Quarta-feira</option>
                        <option value="4">Quinta-feira</option>
                        <option value="5">Sexta-feira</option>
                        <option value="6">Sábado</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Anexar PDF</p>
                      <p className="text-xs text-muted-foreground">O email segue com o KPI no corpo e também em PDF.</p>
                    </div>
                    <Switch
                      checked={kpiForm.sendPdf}
                      onCheckedChange={(checked) => setKpiForm({ ...kpiForm, sendPdf: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-message">Mensagem para gestores</Label>
                    <Textarea
                      id="kpi-message"
                      rows={3}
                      value={kpiForm.customMessage}
                      onChange={(e) => setKpiForm({ ...kpiForm, customMessage: e.target.value })}
                      placeholder="Ex: validar operações da prancha e atuar em anomalias críticas antes da abertura do próximo turno."
                    />
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    O relatório deixa explícito o período configurado e a base de cálculo. Para automação recorrente fora do navegador, basta disparar a rota /api/kpis/dispatch por um cron seguro do servidor.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={handleSaveKpi}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={createKpiMutation.isPending || updateKpiMutation.isPending}
              >
                {(createKpiMutation.isPending || updateKpiMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar KPI
              </Button>

              {editingKpi && editingKpi.reportSchedule?.enabled && (
                <Button
                  variant="outline"
                  onClick={() => dispatchMutation.mutate(editingKpi.id)}
                  disabled={dispatchMutation.isPending}
                >
                  {dispatchMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar agora
                </Button>
              )}

              {editingKpi && (
                <Button variant="outline" className="text-red-500" onClick={() => handleDeleteKpi(editingKpi)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir KPI
                </Button>
              )}

              <Button variant="outline" onClick={() => setIsKpiDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
