'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Geofence, GeofenceType } from '@/types';
import { getGeofences, createGeofence, updateGeofence, deleteGeofence } from '@/lib/api/geofences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Trash2, Edit, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ParsedGeofenceItem } from './geofence-view-map';

// Importação única e isolada dos componentes Leaflet (evita conflito removeChild)
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
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
  const [circleRadius, setCircleRadius] = useState<number>(0);
  
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

  const createMutation = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      toast.success('Cerca criada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao criar cerca');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Geofence> }) => 
      updateGeofence(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      toast.success('Cerca atualizada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar cerca');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGeofence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      toast.success('Cerca removida com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover cerca');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'polygon',
      area: '',
      color: '#3b82f6',
      active: true,
    });
    setEditingGeofence(null);
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (formData.type === 'polygon') {
      setDrawingPoints(prev => [...prev, [lat, lng]]);
    } else if (formData.type === 'circle') {
      if (!circleCenter) {
        setCircleCenter([lat, lng]);
        toast.info('Clique novamente para definir o raio');
      } else {
        // Calcular raio em metros
        const R = 6371e3; // Raio da Terra em metros
        const φ1 = circleCenter[0] * Math.PI / 180;
        const φ2 = lat * Math.PI / 180;
        const Δφ = (lat - circleCenter[0]) * Math.PI / 180;
        const Δλ = (lng - circleCenter[1]) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const radius = R * c;

        setCircleRadius(radius);
        
        // Converter para WKT (POINT com raio nos atributos)
        const wkt = `CIRCLE((${circleCenter[1]} ${circleCenter[0]}),${radius.toFixed(2)})`;
        setFormData(prev => ({ ...prev, area: wkt }));
        toast.success(`Círculo criado com raio de ${radius.toFixed(0)}m`);
      }
    } else if (formData.type === 'rectangle') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([[lat, lng]]);
        toast.info('Clique no canto oposto do retângulo');
      } else {
        const p1 = drawingPoints[0];
        const p2: [number, number] = [lat, lng];
        
        // Criar retângulo com os 4 cantos
        const rectPoints: [number, number][] = [
          [p1[0], p1[1]],
          [p1[0], p2[1]],
          [p2[0], p2[1]],
          [p2[0], p1[1]],
        ];
        
        setDrawingPoints(rectPoints);
        
        // Converter para WKT
        const wktPoints = rectPoints.map(p => `${p[1]} ${p[0]}`).join(', ');
        const wkt = `POLYGON((${wktPoints}, ${rectPoints[0][1]} ${rectPoints[0][0]}))`;
        setFormData(prev => ({ ...prev, area: wkt }));
        toast.success('Retângulo criado');
      }
    }
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) {
      toast.error('Desenhe pelo menos 3 pontos para criar um polígono');
      return;
    }
    
    // Converter pontos para WKT
    const wktPoints = drawingPoints.map(p => `${p[1]} ${p[0]}`).join(', ');
    const wkt = `POLYGON((${wktPoints}, ${drawingPoints[0][1]} ${drawingPoints[0][0]}))`;
    
    setFormData(prev => ({ ...prev, area: wkt }));
    toast.success(`Área desenhada com ${drawingPoints.length} pontos`);
  };

  const handleClearDrawing = () => {
    setDrawingPoints([]);
    setCircleCenter(null);
    setCircleRadius(0);
    setFormData(prev => ({ ...prev, area: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.area && drawingPoints.length === 0 && !circleCenter) {
      toast.error('Desenhe uma área no mapa primeiro');
      return;
    }

    // Se tem pontos mas não finalizou o desenho do polígono
    if (formData.type === 'polygon' && drawingPoints.length > 0 && !formData.area) {
      toast.error('Finalize o desenho do polígono antes de salvar');
      return;
    }

    // Se está desenhando círculo mas não definiu o raio
    if (formData.type === 'circle' && circleCenter && !formData.area) {
      toast.error('Clique novamente no mapa para definir o raio do círculo');
      return;
    }

    // Se está desenhando retângulo mas só tem 1 ponto
    if (formData.type === 'rectangle' && drawingPoints.length === 1) {
      toast.error('Clique no canto oposto para finalizar o retângulo');
      return;
    }

    const geofenceData = {
      ...formData,
      clientId: 1, // TODO: Get from auth context
    };

    if (editingGeofence) {
      updateMutation.mutate({ id: editingGeofence.id, data: geofenceData });
    } else {
      createMutation.mutate(geofenceData);
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      type: geofence.type,
      area: geofence.area,
      color: geofence.color || '#3b82f6',
      active: geofence.active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja remover esta cerca?')) {
      deleteMutation.mutate(id);
    }
  };

  // Parse WKT to Leaflet coordinates
  // Handles: POLYGON ((lng lat, ...)), POLYGON((lng lat,...)), CIRCLE ((lng lat), radius)
  const parseWKT = (wkt: string): {
    type: 'polygon' | 'circle';
    coordinates?: [number, number][];
    center?: [number, number];
    radius?: number;
  } | null => {
    if (!wkt || typeof wkt !== 'string') return null;
    try {
      const upper = wkt.trim().toUpperCase();

      if (upper.startsWith('POLYGON') || upper.startsWith('LINESTRING')) {
        // Extract all coordinate pairs — handles any spacing variant
        const inner = wkt.replace(/^[A-Za-z]+\s*\(\s*\(?\s*/, '').replace(/\s*\)?\s*\)\s*$/, '');
        const coords = inner
          .split(',')
          .map((pair): [number, number] | null => {
            const parts = pair.trim().split(/\s+/);
            if (parts.length < 2) return null;
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) return null;
            return [lat, lng];
          })
          .filter((c): c is [number, number] => c !== null);

        if (coords.length < 3) return null;
        return { type: 'polygon', coordinates: coords };
      }

      if (upper.startsWith('CIRCLE')) {
        // Traccar format: CIRCLE ((lng lat), radius) or CIRCLE (lng lat, radius)
        const inner = wkt.replace(/^CIRCLE\s*\(\s*\(?/i, '').replace(/\)?\s*\)\s*$/, '');
        const parts = inner.split(',');
        if (parts.length < 2) return null;
        const coordParts = parts[0].trim().split(/\s+/);
        const lng = parseFloat(coordParts[0]);
        const lat = parseFloat(coordParts[1]);
        const radius = parseFloat(parts[parts.length - 1]);
        if (isNaN(lat) || isNaN(lng) || isNaN(radius)) return null;
        return { type: 'circle', center: [lat, lng], radius };
      }
    } catch (error) {
      console.error('Failed to parse WKT:', error);
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={ShieldCheck}
        title="Cercas Eletrônicas"
        description="Gerencie zonas de alerta e controle"
      />

      {/* Dialog único — o Trigger fica no sidebar, o Content aqui fora */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] max-h-[85vh] p-0 gap-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {editingGeofence ? 'Editar Cerca Eletrônica' : 'Nova Cerca Eletrônica'}
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
                  {formData.type === 'polygon' && `💡 Clique no mapa para marcar pontos (${drawingPoints.length} pontos)`}
                  {formData.type === 'circle' && !circleCenter && '💡 Clique para marcar o centro do círculo'}
                  {formData.type === 'circle' && circleCenter && !circleRadius && '💡 Clique para definir o raio'}
                  {formData.type === 'rectangle' && drawingPoints.length === 0 && '💡 Clique no primeiro canto do retângulo'}
                  {formData.type === 'rectangle' && drawingPoints.length === 1 && '💡 Clique no canto oposto'}
                </div>
                {(drawingPoints.length > 0 || circleCenter) && (
                  <div className="absolute top-16 left-4 flex gap-2 z-[1000]">
                    {formData.type === 'polygon' && (
                      <Button
                        onClick={handleFinishDrawing}
                        disabled={drawingPoints.length < 3}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        ✓ Finalizar ({drawingPoints.length} pontos)
                      </Button>
                    )}
                    <Button variant="destructive" onClick={handleClearDrawing}>
                      ✕ Limpar
                    </Button>
                  </div>
                )}
              </div>

              {/* Formulário lateral */}
              <div className="w-80 border-l bg-card p-4 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Ex: Área de Entrega"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Informações adicionais"
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="type" className="text-sm font-medium">Tipo de Cerca</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: GeofenceType) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="polygon">🔷 Polígono</SelectItem>
                        <SelectItem value="circle">⭕ Círculo</SelectItem>
                        <SelectItem value="rectangle">⬜ Retângulo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="color" className="text-sm font-medium">Cor da Cerca</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="#3b82f6"
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                    <Label htmlFor="active" className="cursor-pointer text-sm">Cerca ativa</Label>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    {formData.area ? (
                      <p className="text-xs text-green-500">✓ Área desenhada com sucesso</p>
                    ) : (
                      <p className="text-xs text-yellow-500">⚠ Desenhe a área no mapa à esquerda</p>
                    )}
                    <Button type="submit" disabled={!formData.name || !formData.area} className="w-full">
                      {editingGeofence ? '✓ Atualizar Cerca' : '✓ Criar Cerca'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full">
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </DialogContent>

        {/* Layout principal: sidebar + mapa */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar com lista de cercas */}
          <div className="w-80 border-r bg-card flex flex-col overflow-hidden">
            <div className="p-3 border-b flex-shrink-0">
              <DialogTrigger asChild>
                <Button className="w-full" onClick={() => setIsDrawingMode(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Cerca
                </Button>
              </DialogTrigger>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto flex-1">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-2">Carregando...</p>
              ) : geofences.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhuma cerca criada ainda</p>
              ) : (
                geofences.map((geofence) => (
                  <Card key={geofence.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: geofence.color || '#3b82f6' }}
                          />
                          <h3 className="font-semibold text-sm truncate">{geofence.name}</h3>
                        </div>
                        {geofence.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{geofence.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded">{geofence.type}</span>
                          {geofence.active ? (
                            <span className="text-xs text-green-500">Ativa</span>
                          ) : (
                            <span className="text-xs text-gray-500">Inativa</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(geofence)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(geofence.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Mapa de visualização */}
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
