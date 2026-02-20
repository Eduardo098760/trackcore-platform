'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Copy,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { notificationManager } from '@/lib/notifications';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  messageTemplate: string;
  icon: string;
  enabled: boolean;
  customFields: {
    name: string;
    type: 'text' | 'number' | 'boolean' | 'date';
    required: boolean;
    defaultValue?: string;
  }[];
  createdAt: string;
}

const getTemplates = async (): Promise<NotificationTemplate[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const stored = localStorage.getItem('notificationTemplates');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Templates padrão
  return [
    {
      id: '1',
      name: 'Excesso de Velocidade',
      type: 'warning',
      title: '⚡ Velocidade Excedida',
      messageTemplate: '{{deviceName}} excedeu {{speed}} km/h no local {{location}}',
      icon: '⚡',
      enabled: true,
      customFields: [
        { name: 'speed', type: 'number', required: true },
        { name: 'location', type: 'text', required: false, defaultValue: 'local não especificado' },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Parada Prolongada',
      type: 'info',
      title: '🛑 Parada Prolongada',
      messageTemplate: '{{deviceName}} está parado há {{duration}} minutos em {{location}}',
      icon: '🛑',
      enabled: true,
      customFields: [
        { name: 'duration', type: 'number', required: true },
        { name: 'location', type: 'text', required: false },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
};

const saveTemplates = async (templates: NotificationTemplate[]): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  localStorage.setItem('notificationTemplates', JSON.stringify(templates));
};

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'info' as 'info' | 'warning' | 'error' | 'success',
    title: '',
    messageTemplate: '',
    icon: '📢',
    enabled: true,
    customFields: [] as NotificationTemplate['customFields'],
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['notificationTemplates'],
    queryFn: getTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: saveTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationTemplates'] });
      toast.success('Templates salvos com sucesso!');
    },
  });

  const handleCreate = () => {
    const newTemplate: NotificationTemplate = {
      id: Date.now().toString(),
      name: formData.name,
      type: formData.type,
      title: formData.title,
      messageTemplate: formData.messageTemplate,
      icon: formData.icon,
      enabled: formData.enabled,
      customFields: formData.customFields,
      createdAt: new Date().toISOString(),
    };

    const updated = editingTemplate
      ? templates.map(t => t.id === editingTemplate.id ? newTemplate : t)
      : [...templates, newTemplate];

    saveMutation.mutate(updated);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      const updated = templates.filter(t => t.id !== id);
      saveMutation.mutate(updated);
      toast.success('Template excluído');
    }
  };

  const handleDuplicate = (template: NotificationTemplate) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Cópia)`,
      createdAt: new Date().toISOString(),
    };
    saveMutation.mutate([...templates, newTemplate]);
    toast.success('Template duplicado');
  };

  const handleTest = (template: NotificationTemplate) => {
    // Substituir variáveis com valores de teste
    let message = template.messageTemplate;
    message = message.replace(/\{\{deviceName\}\}/g, 'ABC-1234');
    
    template.customFields.forEach(field => {
      const testValue = field.type === 'number' ? '100' 
        : field.type === 'boolean' ? 'true'
        : field.defaultValue || 'valor teste';
      message = message.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), testValue);
    });

    notificationManager.createCustomNotification(
      template.type,
      template.title,
      message,
      { deviceId: 1, deviceName: 'ABC-1234', eventType: 'custom' }
    );
    toast.success('Notificação de teste enviada!');
  };

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      title: template.title,
      messageTemplate: template.messageTemplate,
      icon: template.icon,
      enabled: template.enabled,
      customFields: template.customFields,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'info',
      title: '',
      messageTemplate: '',
      icon: '📢',
      enabled: true,
      customFields: [],
    });
    setEditingTemplate(null);
  };

  const addCustomField = () => {
    setFormData({
      ...formData,
      customFields: [
        ...formData.customFields,
        { name: '', type: 'text', required: false },
      ],
    });
  };

  const removeCustomField = (index: number) => {
    setFormData({
      ...formData,
      customFields: formData.customFields.filter((_, i) => i !== index),
    });
  };

  const updateCustomField = (index: number, updates: Partial<NotificationTemplate['customFields'][0]>) => {
    const updated = [...formData.customFields];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, customFields: updated });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de Notificações Customizadas"
        description="Crie e gerencie templates de notificações personalizadas com campos dinâmicos"
        icon={Sparkles}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Templates</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter(t => t.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Campos Custom</CardTitle>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter(t => t.customFields.length > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campos</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((acc, t) => acc + t.customFields.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Templates Configurados</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Editar Template' : 'Novo Template de Notificação'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure um template personalizado com campos dinâmicos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Template *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Excesso de Velocidade"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="icon">Ícone</Label>
                      <Input
                        id="icon"
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        placeholder="📢"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Título da Notificação *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: ⚡ Velocidade Excedida"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Alerta</Label>
                    <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info (Azul)</SelectItem>
                        <SelectItem value="success">Sucesso (Verde)</SelectItem>
                        <SelectItem value="warning">Aviso (Amarelo)</SelectItem>
                        <SelectItem value="error">Erro (Vermelho)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="messageTemplate">Template da Mensagem *</Label>
                    <Textarea
                      id="messageTemplate"
                      value={formData.messageTemplate}
                      onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                      placeholder="Use {{deviceName}} para o nome do veículo e {{nomeCampo}} para campos customizados"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use variáveis entre chaves duplas: {{`{{deviceName}}`}}, {{`{{speed}}`}}, {{`{{location}}`}}, etc.
                    </p>
                  </div>

                  {/* Custom Fields */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Campos Personalizados</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Campo
                      </Button>
                    </div>

                    {formData.customFields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum campo personalizado</p>
                        <p className="text-sm">Clique em "Adicionar Campo" para criar campos dinâmicos</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formData.customFields.map((field, index) => (
                          <div key={index} className="flex gap-2 p-3 border rounded-lg">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <Input
                                placeholder="Nome do campo"
                                value={field.name}
                                onChange={(e) => updateCustomField(index, { name: e.target.value })}
                              />
                              <Select
                                value={field.type}
                                onValueChange={(v: any) => updateCustomField(index, { type: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Texto</SelectItem>
                                  <SelectItem value="number">Número</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="date">Data</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Valor padrão"
                                value={field.defaultValue || ''}
                                onChange={(e) => updateCustomField(index, { defaultValue: e.target.value })}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCustomField(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={!formData.name || !formData.title || !formData.messageTemplate}>
                      {editingTemplate ? 'Atualizar' : 'Criar'} Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">Nenhum template criado ainda</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Campos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-muted-foreground">{template.title}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(template.type)}
                        <Badge variant="outline">{template.type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {template.messageTemplate.length > 50
                          ? template.messageTemplate.substring(0, 50) + '...'
                          : template.messageTemplate}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {template.customFields.length} campo{template.customFields.length !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(template)}
                          title="Testar notificação"
                        >
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(template)}
                          title="Duplicar template"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          title="Editar template"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                          title="Excluir template"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            Como Usar Templates Customizados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">1. Crie um Template</h3>
              <p className="text-sm text-muted-foreground">
                Defina nome, título, tipo de alerta e a mensagem com variáveis dinâmicas
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">2. Adicione Campos Personalizados</h3>
              <p className="text-sm text-muted-foreground">
                Crie quantos campos quiser: texto, número, booleano ou data
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">3. Use Variáveis na Mensagem</h3>
              <p className="text-sm text-muted-foreground">
                Insira {{`{{nomeDoCampo}}`}} na mensagem para inserir dados dinâmicos
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">4. Teste e Ajuste</h3>
              <p className="text-sm text-muted-foreground">
                Use o botão de teste para ver como a notificação ficará
              </p>
            </div>
          </div>
          
          <div className="rounded-lg bg-blue-500/10 p-4">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
              💡 Exemplo de Template
            </p>
            <div className="space-y-2 text-sm">
              <p><strong>Nome:</strong> Temperatura Alta do Motor</p>
              <p><strong>Título:</strong> 🌡️ Alerta de Temperatura</p>
              <p><strong>Mensagem:</strong> {{`{{deviceName}}`}} está com temperatura de {{`{{temperature}}`}}°C em {{`{{location}}`}}</p>
              <p><strong>Campos:</strong></p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>temperature (número, obrigatório)</li>
                <li>location (texto, opcional, padrão: "local desconhecido")</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
