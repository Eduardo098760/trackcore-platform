'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FolderTree, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Group } from '@/types';

// Mock data
const mockGroups: Group[] = [
  { id: 1, name: 'Frota Principal', description: 'Veículos da frota principal', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 2, name: 'Frota Sul', parentId: 1, description: 'Veículos da região sul', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 3, name: 'Frota Sudeste', parentId: 1, description: 'Veículos da região sudeste', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 4, name: 'São Paulo', parentId: 3, description: 'Veículos de SP', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 5, name: 'Rio de Janeiro', parentId: 3, description: 'Veículos do RJ', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 6, name: 'Caminhões', description: 'Todos os caminhões', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set([1, 3]));
  const [formData, setFormData] = useState({
    name: '',
    parentId: undefined as number | undefined,
    description: ''
  });

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingGroup(null);
    setFormData({ name: '', parentId: undefined, description: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      parentId: group.parentId,
      description: group.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este grupo?')) {
      setGroups(groups.filter(g => g.id !== id && g.parentId !== id));
    }
  };

  const handleSave = () => {
    if (editingGroup) {
      setGroups(groups.map(g => 
        g.id === editingGroup.id 
          ? { ...g, ...formData, updatedAt: new Date().toISOString() }
          : g
      ));
    } else {
      const newGroup: Group = {
        id: Math.max(...groups.map(g => g.id), 0) + 1,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setGroups([...groups, newGroup]);
    }
    setIsDialogOpen(false);
  };

  const toggleExpand = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const buildTree = (parentId?: number, level = 0): JSX.Element[] => {
    return filteredGroups
      .filter(g => g.parentId === parentId)
      .map(group => {
        const children = filteredGroups.filter(g => g.parentId === group.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedGroups.has(group.id);

        return (
          <div key={group.id} className="border-l-2 border-gray-200 dark:border-gray-800">
            <div 
              className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-r-lg group"
              style={{ marginLeft: `${level * 20}px` }}
            >
              <div className="flex items-center gap-2 flex-1">
                {hasChildren && (
                  <button onClick={() => toggleExpand(group.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
                {!hasChildren && <div className="w-6" />}
                {isExpanded || !hasChildren ? 
                  <FolderOpen className="w-4 h-4 text-blue-500" /> : 
                  <Folder className="w-4 h-4 text-blue-500" />
                }
                <div className="flex-1">
                  <p className="font-medium">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {children.length} {children.length === 1 ? 'subgrupo' : 'subgrupos'}
                </Badge>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(group)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isExpanded && hasChildren && buildTree(group.id, level + 1)}
          </div>
        );
      });
  };

  const stats = {
    total: groups.length,
    root: groups.filter(g => !g.parentId).length,
    nested: groups.filter(g => g.parentId).length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos de Veículos"
        description="Organize seus veículos em grupos e frotas hierárquicas"
        icon={FolderTree}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grupos Raiz</CardTitle>
            <Folder className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.root}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subgrupos</CardTitle>
            <FolderOpen className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.nested}</div>
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
                placeholder="Buscar grupos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <CardTitle>Hierarquia de Grupos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {buildTree()}
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Frota Sul"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Grupo Pai</Label>
              <select
                id="parent"
                value={formData.parentId || ''}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value ? parseInt(e.target.value) : undefined })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum (Grupo Raiz)</option>
                {groups
                  .filter(g => g.id !== editingGroup?.id)
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do grupo"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">
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
