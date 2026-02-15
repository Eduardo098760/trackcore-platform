'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator, Plus, Edit, Trash2, Search, Code, AlertCircle } from 'lucide-react';
import type { ComputedAttribute } from '@/types';

// Mock data
const mockAttributes: ComputedAttribute[] = [
  {
    id: 1,
    name: 'Consumo Médio',
    description: 'Calcula o consumo médio em km/l',
    attribute: 'avgConsumption',
    expression: 'totalDistance / fuelUsed',
    type: 'number',
    enabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 2,
    name: 'Custo por KM',
    description: 'Custo total dividido pela distância percorrida',
    attribute: 'costPerKm',
    expression: '(fuelCost + maintenanceCost) / totalDistance',
    type: 'number',
    enabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 3,
    name: 'Motor em Ralenti',
    description: 'Detecta se o motor está ligado mas velocidade = 0',
    attribute: 'isIdling',
    expression: 'ignition && speed == 0',
    type: 'boolean',
    enabled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

const exampleExpressions = [
  { label: 'Consumo (km/l)', value: 'totalDistance / fuelUsed' },
  { label: 'Velocidade > 80', value: 'speed > 80' },
  { label: 'Bateria Baixa', value: 'batteryLevel < 20' },
  { label: 'Tempo Parado (min)', value: 'stopDuration / 60' }
];

export default function ComputedAttributesPage() {
  const [attributes, setAttributes] = useState<ComputedAttribute[]>(mockAttributes);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<ComputedAttribute | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    attribute: '',
    expression: '',
    type: 'number' as 'string' | 'number' | 'boolean',
    enabled: true
  });

  const filteredAttributes = attributes.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingAttribute(null);
    setFormData({
      name: '',
      description: '',
      attribute: '',
      expression: '',
      type: 'number',
      enabled: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (attr: ComputedAttribute) => {
    setEditingAttribute(attr);
    setFormData({
      name: attr.name,
      description: attr.description || '',
      attribute: attr.attribute,
      expression: attr.expression,
      type: attr.type,
      enabled: attr.enabled
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este atributo computado?')) {
      setAttributes(attributes.filter(a => a.id !== id));
    }
  };

  const handleSave = () => {
    if (editingAttribute) {
      setAttributes(attributes.map(a => 
        a.id === editingAttribute.id 
          ? { ...a, ...formData, updatedAt: new Date().toISOString() }
          : a
      ));
    } else {
      const newAttribute: ComputedAttribute = {
        id: Math.max(...attributes.map(a => a.id), 0) + 1,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setAttributes([...attributes, newAttribute]);
    }
    setIsDialogOpen(false);
  };

  const toggleEnabled = (id: number) => {
    setAttributes(attributes.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const stats = {
    total: attributes.length,
    enabled: attributes.filter(a => a.enabled).length,
    disabled: attributes.filter(a => !a.enabled).length
  };

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
            <CardTitle className="text-sm font-medium">Habilitados</CardTitle>
            <Code className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.enabled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desabilitados</CardTitle>
            <Code className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.disabled}</div>
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
          <div className="space-y-3">
            {filteredAttributes.map((attr) => (
              <div key={attr.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{attr.name}</h3>
                      <Badge variant={attr.enabled ? 'default' : 'secondary'} className={attr.enabled ? 'bg-green-600' : ''}>
                        {attr.enabled ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {attr.type}
                      </Badge>
                    </div>
                    {attr.description && (
                      <p className="text-sm text-muted-foreground mb-2">{attr.description}</p>
                    )}
                    <div className="bg-muted/50 p-2 rounded font-mono text-xs">
                      <span className="text-blue-600 dark:text-blue-400">{attr.attribute}</span>
                      <span className="text-gray-500"> = </span>
                      <span className="text-green-600 dark:text-green-400">{attr.expression}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch checked={attr.enabled} onCheckedChange={() => toggleEnabled(attr.id)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(attr)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(attr.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Consumo Médio"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
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

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Habilitar imediatamente</Label>
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
                disabled={!formData.name || !formData.attribute || !formData.expression}
              >
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
