'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Geofence, GeofenceType, Device } from '@/types';
import { getGeofences, createGeofence, updateGeofence, deleteGeofence, assignGeofenceToDevice, removeGeofenceFromDevice, getDevicesForGeofence } from '@/lib/api/geofences';
import { getDevices } from '@/lib/api/devices';
import { parseWKT } from '@/lib/parse-wkt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Trash2, Edit, Plus, ShieldCheck, Car, Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ParsedGeofenceItem } from './geofence-view-map';

const GeofenceDrawMap = dynamic(() => import('./geofence-draw-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">Carregando mapa...</div>,
});

const GeofenceViewMap = dynamic(() => import('./geofence-view-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">Carregando mapa...</div>,
});

export default function GeofencesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
  const [circleRadius, setCircleRadius] = useState<number>(0);

  // Selecao de veiculos
  const [assignToAll, setAssignToAll] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // Guard contra race conditions em handleEdit (async)
  const editSessionRef = useRef(0);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: GeofenceType;
    area: string;
    color: string;
    active: boolean;
  }>({
    name: '',
    description: '',
    type: 'polygon',
    area: '',
    color: '#3b82f6',
    active: true,
  });

  const { data: geofences = [], isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: getGeofences,
  });

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => getDevices(),
  });

  // Calcula contagem de veículos por cerca a partir dos attributes (sem chamada extra à API)
  const getGeofenceVehicleCount = (geofence: Geofence): number => {
    if (geofence.attributes?.assignToAll === true) return devices.length;
    const ids = geofence.attributes?.linkedDeviceIds;
    if (Array.isArray(ids)) return ids.length;
    return 0;
  };

  const resetForm = () => {
    editSessionRef.current++; // cancela qualquer async pendente
    setFormData({ name: '', description: '', type: 'polygon', area: '', color: '#3b82f6', active: true });
    setEditingGeofence(null);
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
    setAssignToAll(false);
    setSelectedDeviceIds([]);
    setShowDeviceList(false);
  };

  const syncDevicePermissions = async (geofenceId: number, newDeviceIds: number[]) => {
    let currentIds: number[] = [];
    try { currentIds = await getDevicesForGeofence(geofenceId); } catch { currentIds = []; }
    const toAdd = newDeviceIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !newDeviceIds.includes(id));
    await Promise.all([
      ...toAdd.map((did) => assignGeofenceToDevice(did, geofenceId)),
      ...toRemove.map((did) => removeGeofenceFromDevice(did, geofenceId)),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.area && drawingPoints.length === 0 && !circleCenter) { toast.error('Desenhe uma area no mapa primeiro'); return; }
    if (formData.type === 'polygon' && drawingPoints.length > 0 && !formData.area) { toast.error('Finalize o desenho do poligono antes de salvar'); return; }
    if (formData.type === 'circle' && circleCenter && !formData.area) { toast.error('Clique novamente no mapa para definir o raio'); return; }
    if (formData.type === 'rectangle' && drawingPoints.length === 1) { toast.error('Clique no canto oposto para finalizar o retangulo'); return; }

    const targetDeviceIds = assignToAll ? devices.map((d) => d.id) : selectedDeviceIds;

    setIsSaving(true);
    try {
      let savedGeofence: Geofence;
      // Salva o intent de atribuição nos attributes para recuperar corretamente no edit
      const geofencePayload = {
        ...formData,
        clientId: 1,
        assignToAll,
        linkedDeviceIds: assignToAll ? [] : selectedDeviceIds,
      };
      if (editingGeofence) {
        savedGeofence = await updateGeofence(editingGeofence.id, geofencePayload);
        toast.success('Cerca atualizada com sucesso!');
      } else {
        savedGeofence = await createGeofence(geofencePayload);
        toast.success('Cerca criada com sucesso!');
      }
      // Sincroniza permissões device-geofence no Traccar
      await syncDevicePermissions(savedGeofence.id, targetDeviceIds);
      if (targetDeviceIds.length > 0) {
        toast.success(assignToAll ? `Cerca aplicada a todos os ${devices.length} veiculos` : `Cerca aplicada a ${targetDeviceIds.length} veiculo(s)`);
      }
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['geofence-device-counts'] });
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cerca');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (geofence: Geofence) => {
    const session = ++editSessionRef.current;

    // 1. Reseta estado imediatamente (síncrono) — evita race condition
    setAssignToAll(false);
    setSelectedDeviceIds([]);
    setShowDeviceList(false);
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      type: geofence.type,
      area: geofence.area,
      color: geofence.color || '#3b82f6',
      active: geofence.active,
    });

    // 2. Carrega intent de atribuição salvo nos attributes (sem async)
    const storedAssignToAll = geofence.attributes?.assignToAll === true;
    const storedLinkedIds = Array.isArray(geofence.attributes?.linkedDeviceIds)
      ? (geofence.attributes!.linkedDeviceIds as number[])
      : null;

    if (storedLinkedIds !== null) {
      // Tem dados salvos — usa direto, sem precisar de chamada à API
      setAssignToAll(storedAssignToAll);
      setSelectedDeviceIds(storedAssignToAll ? [] : storedLinkedIds);
      if (storedAssignToAll || storedLinkedIds.length > 0) setShowDeviceList(true);
      setIsDialogOpen(true);
    } else {
      // Geofence antiga (sem attributes) — abre dialog já e tenta buscar via API
      setIsDialogOpen(true);
      try {
        const linked = await getDevicesForGeofence(geofence.id);
        if (editSessionRef.current !== session) return; // descarta resultado obsoleto
        // Só marca "todos" se linked === devices E ambos > 0
        const isAll = linked.length > 0 && devices.length > 0 && linked.length >= devices.length;
        setAssignToAll(isAll);
        setSelectedDeviceIds(isAll ? [] : linked);
        if (linked.length > 0) setShowDeviceList(true);
      } catch {
        if (editSessionRef.current !== session) return;
        setSelectedDeviceIds([]);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover esta cerca?')) return;
    try {
      await deleteGeofence(id);
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['geofence-device-counts'] });
      toast.success('Cerca removida com sucesso!');
    } catch { toast.error('Erro ao remover cerca'); }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (formData.type === 'polygon') {
      setDrawingPoints((prev) => [...prev, [lat, lng]]);
    } else if (formData.type === 'circle') {
      if (!circleCenter) {
        setCircleCenter([lat, lng]);
        toast.info('Clique novamente para definir o raio');
      } else {
        const R = 6371e3;
        const p1 = circleCenter[0] * Math.PI / 180, p2 = lat * Math.PI / 180;
        const dp = (lat - circleCenter[0]) * Math.PI / 180, dl = (lng - circleCenter[1]) * Math.PI / 180;
        const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
        const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setCircleRadius(radius);
        setFormData((prev) => ({ ...prev, area: `CIRCLE((${circleCenter[1]} ${circleCenter[0]}),${radius.toFixed(2)})` }));
        toast.success(`Circulo criado com raio de ${radius.toFixed(0)}m`);
      }
    } else if (formData.type === 'rectangle') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([[lat, lng]]);
        toast.info('Clique no canto oposto do retangulo');
      } else {
        const p1 = drawingPoints[0], p2: [number, number] = [lat, lng];
        const rect: [number, number][] = [[p1[0], p1[1]], [p1[0], p2[1]], [p2[0], p2[1]], [p2[0], p1[1]]];
        setDrawingPoints(rect);
        const wktPoints = rect.map((p) => `${p[1]} ${p[0]}`).join(', ');
        setFormData((prev) => ({ ...prev, area: `POLYGON((${wktPoints}, ${rect[0][1]} ${rect[0][0]}))` }));
        toast.success('Retangulo criado');
      }
    }
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) { toast.error('Desenhe pelo menos 3 pontos'); return; }
    const wktPoints = drawingPoints.map((p) => `${p[1]} ${p[0]}`).join(', ');
    setFormData((prev) => ({ ...prev, area: `POLYGON((${wktPoints}, ${drawingPoints[0][1]} ${drawingPoints[0][0]}))` }));
    toast.success(`Area desenhada com ${drawingPoints.length} pontos`);
  };

  const handleClearDrawing = () => {
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
    setFormData((prev) => ({ ...prev, area: '' }));
  };

  const toggleDevice = (deviceId: number) => {
    setSelectedDeviceIds((prev) => prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]);
  };

  // parseWKT vem do utilitario compartilhado @/lib/parse-wkt
  // com deteccao automatica da ordem das coordenadas (lng lat vs lat lng)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader icon={ShieldCheck} title="Cercas Eletronicas" description="Gerencie zonas de alerta e controle" />

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-[92vw] w-[92vw] h-[88vh] max-h-[88vh] p-0 gap-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex-shrink-0">
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {editingGeofence ? 'Editar Cerca Eletronica' : 'Nova Cerca Eletronica'}
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Mapa de desenho */}
              <div className="flex-1 relative">
                <GeofenceDrawMap
                  color={formData.color}
                  type={formData.type}
                  drawingPoints={drawingPoints}
                  circleCenter={circleCenter}
                  circleRadius={circleRadius}
                  onMapClick={handleMapClick}
                />
                <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
                  {formData.type === 'polygon' && `Clique no mapa para marcar pontos (${drawingPoints.length} pontos)`}
                  {formData.type === 'circle' && !circleCenter && 'Clique para marcar o centro do circulo'}
                  {formData.type === 'circle' && circleCenter && !circleRadius && 'Clique para definir o raio'}
                  {formData.type === 'rectangle' && drawingPoints.length === 0 && 'Clique no primeiro canto do retangulo'}
                  {formData.type === 'rectangle' && drawingPoints.length === 1 && 'Clique no canto oposto'}
                </div>
                {(drawingPoints.length > 0 || circleCenter) && (
                  <div className="absolute top-16 left-4 flex gap-2 z-[1000]">
                    {formData.type === 'polygon' && (
                      <Button onClick={handleFinishDrawing} disabled={drawingPoints.length < 3} className="bg-green-600 hover:bg-green-700">
                        Finalizar ({drawingPoints.length} pontos)
                      </Button>
                    )}
                    <Button variant="destructive" onClick={handleClearDrawing}>Limpar</Button>
                  </div>
                )}
              </div>

              {/* Formulario lateral */}
              <div className="w-96 border-l bg-card flex flex-col" style={{ minHeight: 0 }}>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <form id="geofence-form" onSubmit={handleSubmit} className="p-4 space-y-4">

                    <div>
                      <Label htmlFor="name" className="text-sm font-medium">Nome *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Ex: Area de Entrega" className="mt-1" />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-sm font-medium">Descricao</Label>
                      <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Informacoes adicionais" rows={2} className="mt-1" />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Tipo de Cerca</Label>
                      <Select value={formData.type} onValueChange={(v: GeofenceType) => setFormData({ ...formData, type: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="polygon">Poligono</SelectItem>
                          <SelectItem value="circle">Circulo</SelectItem>
                          <SelectItem value="rectangle">Retangulo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Cor da Cerca</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-16 h-10 p-1 cursor-pointer" />
                        <Input value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} placeholder="#3b82f6" className="flex-1 font-mono text-xs" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <Switch id="active" checked={formData.active} onCheckedChange={(v) => setFormData({ ...formData, active: v })} />
                      <Label htmlFor="active" className="cursor-pointer text-sm">Cerca ativa</Label>
                    </div>

                    {/* Veiculos vinculados */}
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowDeviceList((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-blue-500" />
                          Veiculos vinculados
                          {(assignToAll || selectedDeviceIds.length > 0) && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              {assignToAll ? `Todos (${devices.length})` : `${selectedDeviceIds.length} selecionado(s)`}
                            </span>
                          )}
                        </span>
                        {showDeviceList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showDeviceList && (
                        <div className="p-3 space-y-2 border-t">

                          {/* Todos */}
                          <div
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${assignToAll ? 'bg-blue-500/10 border-blue-500/40' : 'border-transparent hover:bg-muted/50'}`}
                            onClick={() => { setAssignToAll(true); setSelectedDeviceIds([]); }}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${assignToAll ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground'}`}>
                              {assignToAll && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                            </div>
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium">Todos os veiculos ({devices.length})</span>
                          </div>

                          {/* Nenhum */}
                          <div
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${!assignToAll && selectedDeviceIds.length === 0 ? 'bg-muted/30 border-muted' : 'border-transparent hover:bg-muted/50'}`}
                            onClick={() => { setAssignToAll(false); setSelectedDeviceIds([]); }}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${!assignToAll && selectedDeviceIds.length === 0 ? 'bg-muted-foreground/40 border-muted-foreground/40' : 'border-muted-foreground'}`}>
                              {!assignToAll && selectedDeviceIds.length === 0 && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                            </div>
                            <Car className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Nenhum veiculo</span>
                          </div>

                          <p className="text-xs text-muted-foreground px-1 font-medium border-t pt-2">Ou selecione especificos:</p>

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                            {devices.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum veiculo cadastrado</p>}
                            {devices.map((device) => {
                              const checked = !assignToAll && selectedDeviceIds.includes(device.id);
                              return (
                                <div
                                  key={device.id}
                                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${checked ? 'bg-blue-500/10 border-blue-500/40' : 'border-transparent hover:bg-muted/50'}`}
                                  onClick={() => { setAssignToAll(false); toggleDevice(device.id); }}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground'}`}>
                                    {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                                  </div>
                                  <Car className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm truncate font-medium">{device.name}</p>
                                    {device.uniqueId && <p className="text-xs text-muted-foreground truncate">{device.uniqueId}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      {formData.area ? (
                        <p className="text-xs text-green-500">Area desenhada com sucesso</p>
                      ) : (
                        <p className="text-xs text-yellow-500">Desenhe a area no mapa a esquerda</p>
                      )}
                    </div>
                  </form>
                </div>

                <div className="p-4 border-t space-y-2 flex-shrink-0">
                  <Button type="submit" form="geofence-form" disabled={!formData.name || !formData.area || isSaving} className="w-full">
                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : editingGeofence ? 'Atualizar Cerca' : 'Criar Cerca'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full">Cancelar</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>

        {/* Layout principal */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r bg-card flex flex-col overflow-hidden">
            <div className="p-3 border-b flex-shrink-0">
              <DialogTrigger asChild>
                <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Nova Cerca</Button>
              </DialogTrigger>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto flex-1">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-2">Carregando...</p>
              ) : geofences.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhuma cerca criada ainda</p>
              ) : (
                geofences.map((geofence) => {
                  const vehicleCount = getGeofenceVehicleCount(geofence);
                  const isAll = geofence.attributes?.assignToAll === true;
                  return (
                    <Card key={geofence.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: geofence.color || '#3b82f6' }} />
                            <h3 className="font-semibold text-sm truncate">{geofence.name}</h3>
                          </div>
                          {geofence.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{geofence.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded capitalize">{geofence.type}</span>
                            {geofence.active ? <span className="text-xs text-green-500">Ativa</span> : <span className="text-xs text-gray-500">Inativa</span>}
                            <span className={`text-xs flex items-center gap-1 font-medium ${
                              isAll ? 'text-blue-400' : vehicleCount > 0 ? 'text-blue-400' : 'text-muted-foreground'
                            }`}>
                              <Car className="w-3 h-3" />
                              {isAll
                                ? `${devices.length} / ${devices.length}`
                                : `${vehicleCount} / ${devices.length}`
                              }
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(geofence)} title="Editar"><Edit className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(geofence.id)} title="Remover"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <GeofenceViewMap
              items={geofences
                .map((g): ParsedGeofenceItem | null => {
                  const parsed = parseWKT(g.area);
                  if (!parsed) return null;
                  return { id: g.id, color: g.color || '#3b82f6', ...parsed };
                })
                .filter((x): x is ParsedGeofenceItem => x !== null)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
