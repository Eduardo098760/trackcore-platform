'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { 
  AlertTriangle, 
  Search, 
  Cigarette,
  Car,
  Eye,
  EyeOff,
  Phone,
  Shield,
  ArrowRightLeft,
  Navigation2,
  BellOff,
  CheckCircle2,
  Download,
  Play
} from 'lucide-react';
import type { VideoEvent, Device } from '@/types';

// Mock data
const mockDevices: Device[] = [
  { id: 1, name: 'Fiat Toro', plate: 'ABC-1234', uniqueId: 'dev1', status: 'online', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} },
  { id: 2, name: 'VW Gol', plate: 'XYZ-5678', uniqueId: 'dev2', status: 'moving', lastUpdate: new Date().toISOString(), category: 'car', attributes: {} }
];

const mockVideoAlerts: VideoEvent[] = [
  {
    id: 1,
    deviceId: 1,
    cameraId: 2,
    type: 'smoking',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    severity: 'high',
    acknowledged: false,
    snapshotUrl: 'https://via.placeholder.com/400x225/ff6b6b/ffffff?text=Uso+de+Cigarro',
    clipUrl: '',
    duration: 15,
    metadata: { confidence: 0.95, driver: 'João Silva' }
  },
  {
    id: 2,
    deviceId: 1,
    cameraId: 2,
    type: 'drowsiness',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    severity: 'critical',
    acknowledged: false,
    snapshotUrl: 'https://via.placeholder.com/400x225/ffa500/ffffff?text=Sonolência+Detectada',
    clipUrl: '',
    duration: 8,
    metadata: { confidence: 0.92, eyeClosureTime: 3.5 }
  },
  {
    id: 3,
    deviceId: 2,
    cameraId: 1,
    type: 'dangerous_overtake',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    severity: 'critical',
    acknowledged: true,
    snapshotUrl: 'https://via.placeholder.com/400x225/dc2626/ffffff?text=Ultrapassagem+Perigosa',
    clipUrl: '',
    duration: 12,
    metadata: { speed: 95, speedLimit: 60 }
  },
  {
    id: 4,
    deviceId: 1,
    cameraId: 2,
    type: 'phone_use',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    severity: 'high',
    acknowledged: true,
    snapshotUrl: 'https://via.placeholder.com/400x225/f59e0b/ffffff?text=Uso+de+Celular',
    clipUrl: '',
    duration: 20,
    metadata: { confidence: 0.88 }
  },
  {
    id: 5,
    deviceId: 2,
    cameraId: 2,
    type: 'no_seatbelt',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    severity: 'medium',
    acknowledged: true,
    snapshotUrl: 'https://via.placeholder.com/400x225/eab308/ffffff?text=Sem+Cinto',
    clipUrl: '',
    duration: 5,
    metadata: { confidence: 0.91 }
  },
  {
    id: 6,
    deviceId: 1,
    cameraId: 1,
    type: 'tailgating',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    severity: 'high',
    acknowledged: false,
    snapshotUrl: 'https://via.placeholder.com/400x225/dc2626/ffffff?text=Distância+Insegura',
    clipUrl: '',
    duration: 18,
    metadata: { distance: 5, speed: 80 }
  },
  {
    id: 7,
    deviceId: 2,
    cameraId: 1,
    type: 'lane_departure',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    severity: 'medium',
    acknowledged: true,
    snapshotUrl: 'https://via.placeholder.com/400x225/f59e0b/ffffff?text=Saída+de+Faixa',
    clipUrl: '',
    duration: 6,
    metadata: { confidence: 0.87 }
  },
  {
    id: 8,
    deviceId: 1,
    cameraId: 2,
    type: 'distraction',
    timestamp: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    severity: 'medium',
    acknowledged: false,
    snapshotUrl: 'https://via.placeholder.com/400x225/f59e0b/ffffff?text=Distração+Detectada',
    clipUrl: '',
    duration: 10,
    metadata: { confidence: 0.85, headOrientation: 'left' }
  }
];

const alertConfig = {
  smoking: { label: 'Uso de Cigarro', icon: Cigarette, color: 'bg-red-500' },
  drowsiness: { label: 'Sonolência', icon: EyeOff, color: 'bg-orange-500' },
  distraction: { label: 'Distração', icon: Eye, color: 'bg-yellow-500' },
  phone_use: { label: 'Uso de Celular', icon: Phone, color: 'bg-amber-500' },
  no_seatbelt: { label: 'Sem Cinto', icon: Shield, color: 'bg-yellow-600' },
  dangerous_overtake: { label: 'Ultrapassagem Perigosa', icon: ArrowRightLeft, color: 'bg-red-600' },
  tailgating: { label: 'Distância Insegura', icon: Car, color: 'bg-red-600' },
  lane_departure: { label: 'Saída de Faixa', icon: Navigation2, color: 'bg-amber-500' },
  motion: { label: 'Movimento', icon: AlertTriangle, color: 'bg-blue-500' },
  alarm: { label: 'Alarme', icon: AlertTriangle, color: 'bg-red-500' },
  collision: { label: 'Colisão', icon: AlertTriangle, color: 'bg-red-600' },
  harsh_brake: { label: 'Freada Brusca', icon: Car, color: 'bg-orange-500' },
  harsh_turn: { label: 'Curva Brusca', icon: Car, color: 'bg-yellow-500' },
  speeding: { label: 'Excesso de Velocidade', icon: Car, color: 'bg-red-500' }
};

export default function VideoAlertsPage() {
  const [alerts, setAlerts] = useState<VideoEvent[]>(mockVideoAlerts);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredAlerts = alerts.filter(alert => {
    const device = mockDevices.find(d => d.id === alert.deviceId);
    const matchesSearch = device?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device?.plate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'pending' && !alert.acknowledged) ||
                         (filterStatus === 'acknowledged' && alert.acknowledged);
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleAcknowledge = (id: number) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return date.toLocaleString('pt-BR');
  };

  const stats = {
    total: alerts.length,
    pending: alerts.filter(a => !a.acknowledged).length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    today: alerts.filter(a => {
      const alertDate = new Date(a.timestamp);
      const today = new Date();
      return alertDate.toDateString() === today.toDateString();
    }).length
  };

  const severityColor = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas de VideoTelemetria"
        description="Detecção automática de comportamentos de risco"
        icon={AlertTriangle}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <BellOff className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.today}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por veículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todas as Severidades</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="acknowledged">Reconhecidos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAlerts.map((alert) => {
          const device = mockDevices.find(d => d.id === alert.deviceId);
          const config = alertConfig[alert.type];
          const Icon = config.icon;

          return (
            <Card key={alert.id} className={`overflow-hidden ${!alert.acknowledged ? 'border-orange-500/50' : ''}`}>
              <CardContent className="p-0">
                {/* Snapshot */}
                <div className="relative aspect-video bg-gray-900">
                  <img 
                    src={alert.snapshotUrl} 
                    alt={config.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className={`${config.color} text-white`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className={`${severityColor[alert.severity]} text-white`}>
                      {alert.severity === 'critical' && 'Crítico'}
                      {alert.severity === 'high' && 'Alto'}
                      {alert.severity === 'medium' && 'Médio'}
                      {alert.severity === 'low' && 'Baixo'}
                    </Badge>
                  </div>
                  {!alert.acknowledged && (
                    <div className="absolute bottom-2 right-2">
                      <Badge className="bg-orange-500 text-white animate-pulse">
                        NOVO
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-sm">{device?.name}</h3>
                      <p className="text-xs text-muted-foreground">{device?.plate}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>

                  {/* Metadata */}
                  {alert.metadata && (
                    <div className="bg-muted/50 p-2 rounded text-xs mb-3">
                      {alert.metadata.confidence && (
                        <p>Confiança: {(alert.metadata.confidence * 100).toFixed(0)}%</p>
                      )}
                      {alert.metadata.speed && (
                        <p>Velocidade: {alert.metadata.speed} km/h</p>
                      )}
                      {alert.metadata.eyeClosureTime && (
                        <p>Olhos fechados: {alert.metadata.eyeClosureTime}s</p>
                      )}
                      {alert.metadata.distance && (
                        <p>Distância: {alert.metadata.distance}m</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-7 text-xs"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Ver Vídeo
                    </Button>
                    {!alert.acknowledged ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleAcknowledge(alert.id)}
                        className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Reconhecer
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Baixar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAlerts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">Nenhum alerta encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
