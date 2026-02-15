'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera as CameraIcon, Plus, Edit, Trash2, Search, Video, Car } from 'lucide-react';
import type { Camera, Device } from '@/types';

// Mock data
const mockDevices: Device[] = [
  { id: 1, name: 'Fiat Toro', plate: 'ABC-1234', uniqueId: 'dev1', status: 'online', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} },
  { id: 2, name: 'VW Gol', plate: 'XYZ-5678', uniqueId: 'dev2', status: 'moving', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} }
];

const mockCameras: Camera[] = [
  { id: 1, deviceId: 1, channel: 1, position: 'front', name: 'Fiat Toro - Frontal', status: 'recording', resolution: '1920x1080', fps: 30, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 2, deviceId: 1, channel: 2, position: 'cabin', name: 'Fiat Toro - Cabine', status: 'online', resolution: '1280x720', fps: 25, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 3, deviceId: 2, channel: 1, position: 'front', name: 'VW Gol - Frontal', status: 'online', resolution: '1920x1080', fps: 30, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 4, deviceId: 2, channel: 2, position: 'rear', name: 'VW Gol - Traseira', status: 'offline', resolution: '1280x720', fps: 25, hasAudio: false, hasPTZ: false, enabled: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' }
];

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>(mockCameras);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState({
    deviceId: 1,
    channel: 1,
    position: 'front' as Camera['position'],
    name: '',
    resolution: '1920x1080',
    fps: 30,
    hasAudio: true,
    hasPTZ: false,
    enabled: true
  });

  const filteredCameras = cameras.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingCamera(null);
    setFormData({
      deviceId: 1,
      channel: 1,
      position: 'front',
      name: '',
      resolution: '1920x1080',
      fps: 30,
      hasAudio: true,
      hasPTZ: false,
      enabled: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera);
    setFormData({
      deviceId: camera.deviceId,
      channel: camera.channel,
      position: camera.position,
      name: camera.name,
      resolution: camera.resolution,
      fps: camera.fps,
      hasAudio: camera.hasAudio,
      hasPTZ: camera.hasPTZ,
      enabled: camera.enabled
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta câmera?')) {
      setCameras(cameras.filter(c => c.id !== id));
    }
  };

  const handleSave = () => {
    if (editingCamera) {
      setCameras(cameras.map(c => 
        c.id === editingCamera.id 
          ? { ...c, ...formData, updatedAt: new Date().toISOString() }
          : c
      ));
    } else {
      const newCamera: Camera = {
        id: Math.max(...cameras.map(c => c.id), 0) + 1,
        ...formData,
        status: 'offline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCameras([...cameras, newCamera]);
    }
    setIsDialogOpen(false);
  };

  const toggleEnabled = (id: number) => {
    setCameras(cameras.map(c => 
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const stats = {
    total: cameras.length,
    online: cameras.filter(c => c.status === 'online' || c.status === 'recording').length,
    recording: cameras.filter(c => c.status === 'recording').length
  };

  const statusColor = {
    online: 'bg-green-500',
    recording: 'bg-red-500',
    offline: 'bg-gray-500',
    error: 'bg-yellow-500'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Câmeras"
        description="Configure e gerencie as câmeras dos veículos"
        icon={CameraIcon}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Câmeras</CardTitle>
            <CameraIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Video className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.online}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gravando</CardTitle>
            <Video className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.recording}</div>
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
                placeholder="Buscar câmeras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nova Câmera
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cameras List */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredCameras.map((camera) => {
          const device = mockDevices.find(d => d.id === camera.deviceId);
          return (
            <Card key={camera.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${statusColor[camera.status]} flex items-center justify-center`}>
                      <CameraIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium">{camera.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Car className="h-3 w-3 mr-1" />
                          {device?.name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">CH{camera.channel}</Badge>
                        <Badge variant="outline" className="text-xs">{camera.position}</Badge>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${statusColor[camera.status]} text-white`}>
                    {camera.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  <div>Resolução: {camera.resolution}</div>
                  <div>FPS: {camera.fps}</div>
                  <div>Áudio: {camera.hasAudio ? 'Sim' : 'Não'}</div>
                  <div>PTZ: {camera.hasPTZ ? 'Sim' : 'Não'}</div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={camera.enabled} onCheckedChange={() => toggleEnabled(camera.id)} />
                    <span className="text-xs text-muted-foreground">
                      {camera.enabled ? 'Habilitada' : 'Desabilitada'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(camera)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(camera.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCamera ? 'Editar Câmera' : 'Nova Câmera'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device">Veículo *</Label>
              <select
                id="device"
                value={formData.deviceId}
                onChange={(e) => setFormData({ ...formData, deviceId: Number(e.target.value) })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {mockDevices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} - {device.plate}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Canal *</Label>
                <Input
                  id="channel"
                  type="number"
                  min="1"
                  max="8"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Posição *</Label>
                <select
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="front">Frontal</option>
                  <option value="rear">Traseira</option>
                  <option value="left">Lateral Esq.</option>
                  <option value="right">Lateral Dir.</option>
                  <option value="cabin">Cabine</option>
                  <option value="cargo">Carga</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Fiat Toro - Frontal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolução</Label>
                <select
                  id="resolution"
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="1920x1080">1920x1080 (Full HD)</option>
                  <option value="1280x720">1280x720 (HD)</option>
                  <option value="640x480">640x480 (SD)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fps">FPS</Label>
                <Input
                  id="fps"
                  type="number"
                  min="15"
                  max="60"
                  value={formData.fps}
                  onChange={(e) => setFormData({ ...formData, fps: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hasAudio"
                  checked={formData.hasAudio}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasAudio: checked })}
                />
                <Label htmlFor="hasAudio">Áudio</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="hasPTZ"
                  checked={formData.hasPTZ}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasPTZ: checked })}
                />
                <Label htmlFor="hasPTZ">PTZ</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Habilitada</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!formData.name}
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
