'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator, Plus, Edit, Trash2, Search, Code, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getComputedAttributes,
  createComputedAttribute,
  updateComputedAttribute,
  deleteComputedAttribute,
  TraccarComputedAttribute,
} from '@/lib/api/computed-attributes';

const exampleExpressions = [
  { label: 'Consumo (km/l)', value: 'totalDistance / fuelUsed' },
  { label: 'Velocidade > 80', value: 'speed > 80' },
  { label: 'Bateria Baixa', value: 'batteryLevel < 20' },
  { label: 'Tempo Parado (min)', value: 'stopDuration / 60' },
];

export default function ComputedAttributesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<TraccarComputedAttribute | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    attribute: '',
    expression: '',
    type: 'number' as 'string' | 'number' | 'boolean',
  });

  // ─── Queries ───────────────────────────────────────────────────────
  const { data: attributes = [], isLoading, error } = useQuery({
    queryKey: ['computed-attributes'],
    queryFn: getComputedAttributes,
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

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingAttribute(null);
    setFormData({ description: '', attribute: '', expression: '', type: 'number' });
    setIsDialogOpen(true);
  };

  const handleEdit = (attr: TraccarComputedAttribute) => {
    setEditingAttribute(attr);
    setFormData({
      description: attr.description,
      attribute: attr.attribute,
      expression: attr.expression,
      type: attr.type,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (attr: TraccarComputedAttribute) => {
    if (confirm(`Excluir o atributo "${attr.description}"?`)) {
      deleteMutation.mutate(attr.id);
    }
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

    if (editingAttribute) {
      updateMutation.mutate({
        id: editingAttribute.id,
        data: { id: editingAttribute.id, ...formData },
      });
    } else {
      createMutation.mutate(formData);
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
                      </div>
                      <div className="bg-muted/50 p-2 rounded font-mono text-xs">
                        <span className="text-blue-600 dark:text-blue-400">{attr.attribute}</span>
                        <span className="text-gray-500"> = </span>
                        <span className="text-green-600 dark:text-green-400">{attr.expression}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
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
    </div>
  );
}
