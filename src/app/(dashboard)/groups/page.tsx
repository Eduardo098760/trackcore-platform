"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderTree,
  Plus,
  Edit,
  Trash2,
  Search,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  Car,
  AlertCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Device } from "@/types";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  TraccarGroup,
} from "@/lib/api/groups";
import { getDevices } from "@/lib/api";
import { api } from "@/lib/api/client";
import { addUserGroup, removeUserGroup } from "@/lib/api/permissions";
import { User } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";

// Mapeia TraccarGroup (groupId) para o formato da UI
interface UIGroup {
  id: number;
  name: string;
  parentId?: number;
  description?: string;
  attributes?: Record<string, any>;
}

function toUI(g: TraccarGroup): UIGroup {
  return {
    id: g.id,
    name: g.name,
    parentId: g.groupId && g.groupId > 0 ? g.groupId : undefined,
    description: g.attributes?.description as string | undefined,
    attributes: g.attributes,
  };
}

function toApi(data: { name: string; parentId?: number; description?: string }, existingAttrs?: Record<string, any>): Omit<TraccarGroup, "id"> {
  return {
    name: data.name,
    groupId: data.parentId || 0,
    attributes: {
      ...(existingAttrs ?? {}),
      description: data.description || "",
    },
  };
}

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UIGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UIGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    parentId: undefined as number | undefined,
    description: "",
  });

  // ─── Queries ───────────────────────────────────────────────────────
  const { data: rawGroups = [], isLoading, error } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
    staleTime: 30000,
  });

  const groups = useMemo(() => rawGroups.map(toUI), [rawGroups]);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
    staleTime: 60000,
  });

  // Dispositivos por grupo (via device.groupId no Traccar)
  const devicesByGroup = useMemo(() => {
    const map = new Map<number, Device[]>();
    for (const d of devices) {
      const gid = (d as any).groupId as number | undefined;
      if (gid && gid > 0) {
        if (!map.has(gid)) map.set(gid, []);
        map.get(gid)!.push(d);
      }
    }
    return map;
  }, [devices]);

  // All users for user↔group management
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    staleTime: 60000,
  });

  // Users linked to a specific group (fetched when dialog opens)
  const { data: groupUsers = [], refetch: refetchGroupUsers } = useQuery({
    queryKey: ["groupUsers", selectedGroup?.id],
    queryFn: () => api.get<User[]>("/users", { groupId: selectedGroup!.id }),
    enabled: !!selectedGroup && isUserDialogOpen,
  });

  const linkUserMut = useMutation({
    mutationFn: ({ userId, groupId }: { userId: number; groupId: number }) =>
      addUserGroup(userId, groupId),
    onSuccess: () => {
      refetchGroupUsers();
      toast.success("Usuário vinculado ao grupo!");
    },
    onError: () => toast.error("Erro ao vincular usuário"),
  });

  const unlinkUserMut = useMutation({
    mutationFn: ({ userId, groupId }: { userId: number; groupId: number }) =>
      removeUserGroup(userId, groupId),
    onSuccess: () => {
      refetchGroupUsers();
      toast.success("Usuário removido do grupo!");
    },
    onError: () => toast.error("Erro ao remover vínculo"),
  });

  // ─── Mutations ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Omit<TraccarGroup, "id">) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo criado com sucesso!");
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao criar grupo: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TraccarGroup }) => updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo atualizado com sucesso!");
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro ao atualizar grupo: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo excluído com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro ao excluir grupo: ${err.message}`),
  });

  // ─── Filtros ───────────────────────────────────────────────────────
  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [groups, searchTerm],
  );

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingGroup(null);
    setFormData({ name: "", parentId: undefined, description: "" });
    setIsDialogOpen(true);
  };

  const handleEdit = (group: UIGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      parentId: group.parentId,
      description: group.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (group: UIGroup) => {
    const children = groups.filter((g) => g.parentId === group.id);
    if (children.length > 0) {
      toast.error("Remova os subgrupos antes de excluir este grupo.");
      return;
    }
    if (confirm(`Tem certeza que deseja excluir "${group.name}"?`)) {
      deleteMutation.mutate(group.id);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("O nome do grupo é obrigatório.");
      return;
    }
    if (editingGroup) {
      updateMutation.mutate({
        id: editingGroup.id,
        data: {
          id: editingGroup.id,
          ...toApi(formData, editingGroup.attributes),
        },
      });
    } else {
      createMutation.mutate(toApi(formData));
    }
  };

  const handleManageDevices = (group: UIGroup) => {
    setSelectedGroup(group);
    const current = devicesByGroup.get(group.id) ?? [];
    setSelectedDeviceIds(new Set(current.map((d) => d.id)));
    setIsDeviceDialogOpen(true);
  };

  const handleManageUsers = (group: UIGroup) => {
    setSelectedGroup(group);
    setIsUserDialogOpen(true);
  };

  const toggleExpand = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ─── Tree builder ──────────────────────────────────────────────────
  const buildTree = (parentId?: number, level = 0): React.ReactElement[] => {
    return filteredGroups
      .filter((g) => g.parentId === parentId)
      .map((group) => {
        const children = filteredGroups.filter((g) => g.parentId === group.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedGroups.has(group.id);
        const devicesInGroup = devicesByGroup.get(group.id) ?? [];

        return (
          <div key={group.id} className="border-l-2 border-gray-200 dark:border-gray-800">
            <div
              className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-r-lg group"
              style={{ marginLeft: `${level * 20}px` }}
            >
              <div className="flex items-center gap-2 flex-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(group.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <div className="w-6" />
                )}
                {isExpanded || !hasChildren ? (
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                ) : (
                  <Folder className="w-4 h-4 text-blue-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {devicesInGroup.length > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Car className="w-3 h-3" />
                      {devicesInGroup.length}
                    </Badge>
                  )}
                  {hasChildren && (
                    <Badge variant="outline" className="text-xs">
                      {children.length} {children.length === 1 ? "subgrupo" : "subgrupos"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Gerenciar veículos"
                  onClick={() => handleManageDevices(group)}
                >
                  <Car className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Gerenciar usuários"
                  onClick={() => handleManageUsers(group)}
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(group)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500"
                  onClick={() => handleDelete(group)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isExpanded && hasChildren && buildTree(group.id, level + 1)}
          </div>
        );
      });
  };

  // ─── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: groups.length,
      root: groups.filter((g) => !g.parentId).length,
      nested: groups.filter((g) => g.parentId).length,
      deviceCount: devices.filter((d: any) => d.groupId && d.groupId > 0).length,
    }),
    [groups, devices],
  );

  // ─── Render ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Grupos de Veículos"
          description="Organize seus veículos em grupos e frotas hierárquicas"
          icon={FolderTree}
        />
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="text-muted-foreground">Erro ao carregar grupos.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["groups"] })}>
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
        title="Grupos de Veículos"
        description="Organize seus veículos em grupos e frotas hierárquicas"
        icon={FolderTree}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Veículos em Grupos</CardTitle>
            <Car className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.deviceCount}</div>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando grupos...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10">
              <FolderTree className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum grupo cadastrado.</p>
              <Button onClick={handleAdd} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro grupo
              </Button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-10">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum grupo encontrado para &quot;{searchTerm}&quot;</p>
            </div>
          ) : (
            <div className="space-y-1">{buildTree()}</div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar Grupo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
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
                value={formData.parentId || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parentId: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum (Grupo Raiz)</option>
                {groups
                  .filter((g) => g.id !== editingGroup?.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
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
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
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

      {/* Dialog Gerenciar Veículos do Grupo */}
      <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Veículos do grupo &quot;{selectedGroup?.name}&quot;
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Para mover um veículo para este grupo, edite o campo &quot;groupId&quot; do dispositivo no Traccar.
              Abaixo estão os veículos atualmente neste grupo:
            </p>
            {selectedGroup && (devicesByGroup.get(selectedGroup.id) ?? []).length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum veículo neste grupo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedGroup &&
                  (devicesByGroup.get(selectedGroup.id) ?? []).map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{device.name}</p>
                          <p className="text-xs text-muted-foreground">{device.plate || device.uniqueId}</p>
                        </div>
                      </div>
                      <Badge
                        variant={device.status === "online" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {device.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Gerenciar Usuários do Grupo */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Usuários do grupo &quot;{selectedGroup?.name}&quot;
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Vincule usuários a este grupo. Eles poderão ver todos os dispositivos do grupo.
            </p>
            {selectedGroup && allUsers.length > 0 ? (
              <div className="space-y-2">
                {allUsers
                  .filter((u: User) => u.role !== "admin")
                  .map((user: User) => {
                    const isLinked = groupUsers.some((gu: User) => gu.id === user.id);
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isLinked}
                            onCheckedChange={(checked) => {
                              if (!selectedGroup) return;
                              if (checked) {
                                linkUserMut.mutate({ userId: user.id, groupId: selectedGroup.id });
                              } else {
                                unlinkUserMut.mutate({ userId: user.id, groupId: selectedGroup.id });
                              }
                            }}
                            disabled={linkUserMut.isPending || unlinkUserMut.isPending}
                          />
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        {isLinked && (
                          <Badge variant="secondary" className="text-xs">
                            Vinculado
                          </Badge>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum usuário disponível.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
