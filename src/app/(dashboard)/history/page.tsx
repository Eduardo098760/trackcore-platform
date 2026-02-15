'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevices, getDeviceRoute } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, MapPin, Clock, Gauge, Route } from 'lucide-react';
import { formatSpeed, formatDistance, formatDuration } from '@/lib/utils';
import { Position } from '@/types';

export default function HistoryPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [routeData, setRouteData] = useState<Position[]>([]);

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const loadRoute = async () => {
    if (!selectedDeviceId) return;
    
    const from = new Date(startDate).toISOString();
    const to = new Date(endDate).toISOString();
    
    const route = await getDeviceRoute(parseInt(selectedDeviceId), from, to);
    setRouteData(route);
  };

  const calculateStats = () => {
    if (routeData.length === 0) return null;

    const totalDistance = routeData.reduce((acc, pos, i) => {
      if (i === 0) return 0;
      const prev = routeData[i - 1];
      const R = 6371; // Earth radius in km
      const dLat = (pos.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (pos.longitude - prev.longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(prev.latitude * Math.PI / 180) * Math.cos(pos.latitude * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return acc + R * c;
    }, 0);

    const speeds = routeData.map(p => p.speed).filter(s => s > 0);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length || 0;
    const maxSpeed = Math.max(...speeds, 0);

    const duration = routeData.length > 1
      ? (new Date(routeData[routeData.length - 1].serverTime).getTime() - 
         new Date(routeData[0].serverTime).getTime()) / 1000
      : 0;

    const stops = routeData.filter(p => p.speed === 0).length;

    return {
      totalDistance,
      avgSpeed,
      maxSpeed,
      duration,
      stops
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
        <Card className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <Route className="w-8 h-8 text-indigo-600" />
              Histórico de Percurso
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Visualize o trajeto completo dos veículos
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
        <CardHeader>
          <CardTitle>Parâmetros de Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Veículo</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="mt-2 bg-white dark:bg-gray-900">
                  <SelectValue placeholder="Selecione um veículo..." />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.plate} - {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 bg-white dark:bg-gray-900"
              />
            </div>

            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2 bg-white dark:bg-gray-900"
              />
            </div>
          </div>

          <Button
            onClick={loadRoute}
            disabled={!selectedDeviceId}
            className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Route className="w-4 h-4 mr-2" />
            Buscar Histórico
          </Button>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Distância Total</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {formatDistance(stats.totalDistance)}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-blue-600/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Velocidade Média</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {Math.round(stats.avgSpeed)} km/h
                  </p>
                </div>
                <Gauge className="w-8 h-8 text-green-600/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-gradient-to-br from-red-50/80 to-orange-50/80 dark:from-red-950/20 dark:to-orange-950/20 border-red-200/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Velocidade Máxima</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {Math.round(stats.maxSpeed)} km/h
                  </p>
                </div>
                <Gauge className="w-8 h-8 text-red-600/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Duração</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {formatDuration(stats.duration)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-purple-600/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-gradient-to-br from-yellow-50/80 to-amber-50/80 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Paradas</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                    {stats.stops}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-yellow-600/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Route Points */}
      {routeData.length > 0 && (
        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
          <CardHeader>
            <CardTitle>Pontos do Trajeto ({routeData.length} registros)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {routeData.map((point, index) => (
                <div
                  key={point.id}
                  className="p-4 rounded-lg bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-semibold">
                            {new Date(point.serverTime).toLocaleString('pt-BR')}
                          </span>
                          <Badge variant="secondary">
                            {Math.round(point.speed)} km/h
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {point.address || `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Ignição: {point.attributes.ignition ? '✓ Ligada' : '✗ Desligada'}</span>
                          <span>Satélites: {point.attributes.sat || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedDeviceId && (
        <Card className="backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <Route className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Selecione um veículo e período para visualizar o histórico
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
