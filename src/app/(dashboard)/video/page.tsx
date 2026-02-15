'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { VideoPlayer } from '@/components/video/video-player';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  Search, 
  Grid3x3, 
  Maximize2, 
  Monitor,
  Car
} from 'lucide-react';
import type { Camera, Device, VideoStream } from '@/types';

// Mock data
const mockDevices: Device[] = [
  { id: 1, name: 'Fiat Toro', plate: 'ABC-1234', uniqueId: 'dev1', status: 'online', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} },
  { id: 2, name: 'VW Gol', plate: 'XYZ-5678', uniqueId: 'dev2', status: 'moving', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} }
];

const mockCameras: Camera[] = [
  { id: 1, deviceId: 1, channel: 1, position: 'front', name: 'Fiat Toro - Frontal', status: 'recording', resolution: '1920x1080', fps: 30, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '', updatedAt: '' },
  { id: 2, deviceId: 1, channel: 2, position: 'cabin', name: 'Fiat Toro - Cabine', status: 'online', resolution: '1280x720', fps: 25, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '', updatedAt: '' },
  { id: 3, deviceId: 2, channel: 1, position: 'front', name: 'VW Gol - Frontal', status: 'online', resolution: '1920x1080', fps: 30, hasAudio: true, hasPTZ: false, enabled: true, createdAt: '', updatedAt: '' },
  { id: 4, deviceId: 2, channel: 2, position: 'rear', name: 'VW Gol - Traseira', status: 'offline', resolution: '1280x720', fps: 25, hasAudio: false, hasPTZ: false, enabled: true, createdAt: '', updatedAt: '' }
];

const mockStreams: VideoStream[] = [
  { cameraId: 1, deviceId: 1, streamUrl: '', quality: 'hd', isLive: true, latency: 250, bitrate: 2048 },
  { cameraId: 2, deviceId: 1, streamUrl: '', quality: 'sd', isLive: true, latency: 180, bitrate: 1024 },
  { cameraId: 3, deviceId: 2, streamUrl: '', quality: 'hd', isLive: true, latency: 320, bitrate: 2048 }
];

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

export default function VideoPage() {
  const [cameras] = useState<Camera[]>(mockCameras);
  const [streams] = useState<VideoStream[]>(mockStreams);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<number | 'all'>('all');
  const [gridLayout, setGridLayout] = useState<GridLayout>('2x2');

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDevice = selectedDevice === 'all' || cam.deviceId === selectedDevice;
    return matchesSearch && matchesDevice && cam.enabled;
  });

  const activeCameras = filteredCameras.filter(c => c.status === 'online' || c.status === 'recording');

  const gridClass = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-1 md:grid-cols-2',
    '3x3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4x4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[gridLayout];

  const stats = {
    total: cameras.length,
    online: cameras.filter(c => c.status === 'online' || c.status === 'recording').length,
    recording: cameras.filter(c => c.status === 'recording').length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="VideoTelemetria"
        description="Monitoramento em tempo real de todas as câmeras"
        icon={Video}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Câmeras</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Monitor className="h-4 w-4 text-green-500" />
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

      {/* Controls */}
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

            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos os Veículos</option>
              {mockDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} - {device.plate}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map(layout => (
                <Button
                  key={layout}
                  variant={gridLayout === layout ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGridLayout(layout)}
                  className={gridLayout === layout ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <Grid3x3 className="h-4 w-4 mr-1" />
                  {layout}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Grid */}
      {activeCameras.length > 0 ? (
        <div className={`grid gap-4 ${gridClass}`}>
          {filteredCameras.slice(0, parseInt(gridLayout[0]) * parseInt(gridLayout[2])).map((camera) => {
            const stream = streams.find(s => s.cameraId === camera.id);
            const device = mockDevices.find(d => d.id === camera.deviceId);
            
            return (
              <div key={camera.id}>
                <VideoPlayer 
                  camera={camera} 
                  stream={stream}
                  showControls={true}
                  autoPlay={true}
                />
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{device?.name}</span>
                    <Badge variant="outline" className="text-xs">
                      CH{camera.channel}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">{camera.position}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">Nenhuma câmera ativa encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
