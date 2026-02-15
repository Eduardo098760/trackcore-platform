'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevices } from '@/lib/api';
import {
  getPlannedRoutes,
  createPlannedRoute,
  updatePlannedRoute,
  deletePlannedRoute,
} from '@/lib/api/routes';
import type { PlannedRoute, PlannedRouteWaypoint } from '@/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Route, Plus, MapPin, Trash2, Edit, Car } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [waypoints, setWaypoints] = useState<PlannedRouteWaypoint[]>([
    { lat: 0, lng: 0, label: 'Início' },
    { lat: 0, lng: 0, label: 'Fim' },
  ]);

  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: getDevices });
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['planned-routes'],
    queryFn: getPlannedRoutes,
  });

  const createMutation = useMutation({
    mutationFn: createPlannedRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-routes'] });
      toast.success('Rota criada com sucesso');
      resetAndClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; deviceId?: number; waypoints?: PlannedRouteWaypoint[] } }) =>
      updatePlannedRoute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-routes'] });
      toast.success('Rota atualizada');
      resetAndClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlannedRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-routes'] });
      toast.success('Rota excluída');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetAndClose() {
    setName('');
    setDeviceId('');
    setWaypoints([
      { lat: 0, lng: 0, label: 'Início' },
      { lat: 0, lng: 0, label: 'Fim' },
    ]);
    setEditingId(null);
    setDialogOpen(false);
  }

  function openCreate() {
    setEditingId(null);
    setName('');
    setDeviceId('');
    setWaypoints([
      { lat: 0, lng: 0, label: 'Início' },
      { lat: 0, lng: 0, label: 'Fim' },
    ]);
    setDialogOpen(true);
  }

  function openEdit(route: PlannedRoute) {
    setEditingId(route.id);
    setName(route.name);
    setDeviceId(String(route.deviceId));
    setWaypoints(route.waypoints.length >= 2 ? [...route.waypoints] : [
      { lat: 0, lng: 0, label: 'Início' },
      { lat: 0, lng: 0, label: 'Fim' },
    ]);
    setDialogOpen(true);
  }

  function addWaypoint() {
    const last = waypoints[waypoints.length - 1];
    setWaypoints([...waypoints, { lat: last?.lat ?? 0, lng: last?.lng ?? 0, label: `Ponto ${waypoints.length + 1}` }]);
  }

  function removeWaypoint(index: number) {
    if (waypoints.length <= 2) return;
    setWaypoints(waypoints.filter((_, i) => i !== index));
  }

  function updateWaypoint(index: number, field: 'lat' | 'lng' | 'label', value: number | string) {
    const next = [...waypoints];
    if (field === 'lat') next[index] = { ...next[index], lat: Number(value) };
    else if (field === 'lng') next[index] = { ...next[index], lng: Number(value) };
    else next[index] = { ...next[index], label: String(value) };
    setWaypoints(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numDeviceId = parseInt(deviceId, 10);
    if (!name.trim() || !Number.isFinite(numDeviceId) || waypoints.length < 2) {
      toast.error('Preencha nome, veículo e pelo menos 2 waypoints.');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name: name.trim(), deviceId: numDeviceId, waypoints } });
    } else {
      createMutation.mutate({ name: name.trim(), deviceId: numDeviceId, waypoints });
    }
  }

  const getDeviceName = (id: number) => devices.find((d) => d.id === id)?.name ?? `Veículo #${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Route}
        title="Rotas planejadas"
        description="Defina rotas para os rastreadores e visualize no mapa"
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nova rota
          </Button>
        }
        stats={[
          { label: 'Rotas', value: routes.length, variant: 'default' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <Card key={route.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  {route.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(route)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm('Excluir esta rota?')) deleteMutation.mutate(route.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" />
                {getDeviceName(route.deviceId)}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {route.waypoints.length} pontos
              </p>
              <p className="text-xs text-muted-foreground">
                Criada em {formatDate(route.createdAt)}
              </p>
              <Button asChild variant="outline" size="sm" className="w-full mt-2">
                <Link href={`/map?routeId=${route.id}`}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Ver no mapa
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && routes.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Route className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma rota planejada ainda.</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira rota
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar rota' : 'Nova rota'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="route-name">Nome da rota</Label>
              <Input
                id="route-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Entrega Centro - Zona Sul"
                required
              />
            </div>
            <div>
              <Label>Veículo</Label>
              <Select value={deviceId} onValueChange={setDeviceId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} {d.plate ? `(${d.plate})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Waypoints (mín. 2)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWaypoint}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-medium w-8">{i + 1}.</span>
                    <Input
                      placeholder="Label"
                      value={wp.label ?? ''}
                      onChange={(e) => updateWaypoint(i, 'label', e.target.value)}
                      className="w-24"
                    />
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lat"
                      value={wp.lat || ''}
                      onChange={(e) => updateWaypoint(i, 'lat', e.target.value)}
                      className="w-24"
                    />
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lng"
                      value={wp.lng || ''}
                      onChange={(e) => updateWaypoint(i, 'lng', e.target.value)}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWaypoint(i)}
                      disabled={waypoints.length <= 2}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use coordenadas em graus decimais (ex: -23.55, -46.63). Depois visualize no mapa.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || waypoints.length < 2}
              >
                {editingId ? 'Salvar' : 'Criar rota'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
