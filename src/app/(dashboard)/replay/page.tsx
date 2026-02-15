'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import { getDevices } from '@/lib/api';
import { Device, Position } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, Pause, Square, SkipBack, SkipForward, Clock, Route, Gauge, Calendar } from 'lucide-react';
import { formatSpeed, formatDate } from '@/lib/utils';
import { getVehicleIconSVG } from '@/lib/vehicle-icons';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });

// Mock data - Historical route
const generateHistoricalRoute = (deviceId: number): Position[] => {
  const baseDate = new Date();
  baseDate.setHours(baseDate.getHours() - 2);
  
  const route: Position[] = [];
  let lat = -23.5505;
  let lng = -46.6333;
  
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(baseDate.getTime() + i * 60000).toISOString();
    const speed = Math.random() * 80 + 20;
    const course = (i * 3.6) % 360;
    
    lat += (Math.random() - 0.5) * 0.01;
    lng += (Math.random() - 0.5) * 0.01;
    
    route.push({
      id: i,
      deviceId,
      protocol: 'osmand',
      serverTime: timestamp,
      deviceTime: timestamp,
      fixTime: timestamp,
      outdated: false,
      valid: true,
      latitude: lat,
      longitude: lng,
      altitude: 700 + Math.random() * 50,
      speed,
      course,
      accuracy: 10,
      attributes: {
        ignition: speed > 5,
        batteryLevel: 85,
        motion: speed > 5,
        sat: 12,
        distance: i * 0.5,
        totalDistance: 1500 + i * 0.5
      }
    });
  }
  
  return route;
};

export default function RouteReplayPage() {
  const searchParams = useSearchParams();
  const vehicleIdFromUrl = searchParams.get('vehicle');
  
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [route, setRoute] = useState<Position[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<[number, number][]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isClient, setIsClient] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Função para snap route to roads usando OSRM
  const snapRouteToRoads = async (positions: Position[]) => {
    if (positions.length < 2) return [];
    
    try {
      // Agrupar pontos em chunks de 100 (limite OSRM)
      const chunkSize = 100;
      const allCoordinates: [number, number][] = [];
      
      for (let i = 0; i < positions.length; i += chunkSize - 1) {
        const chunk = positions.slice(i, Math.min(i + chunkSize, positions.length));
        const coords = chunk.map(p => `${p.longitude},${p.latitude}`).join(';');
        
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.routes && data.routes[0]) {
            const routeCoords = data.routes[0].geometry.coordinates.map(
              (coord: number[]) => [coord[1], coord[0]] as [number, number]
            );
            allCoordinates.push(...routeCoords);
          }
        }
        
        // Delay para não sobrecarregar API
        if (i + chunkSize < positions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return allCoordinates;
    } catch (error) {
      console.error('Erro ao buscar rota:', error);
      return positions.map(p => [p.latitude, p.longitude] as [number, number]);
    }
  };

  // Pré-selecionar veículo da URL
  useEffect(() => {
    if (vehicleIdFromUrl && devices.length > 0 && !selectedDevice) {
      const deviceId = parseInt(vehicleIdFromUrl);
      if (devices.some(d => d.id === deviceId)) {
        setSelectedDevice(deviceId);
      }
    }
  }, [vehicleIdFromUrl, devices, selectedDevice]);

  useEffect(() => {
    if (selectedDevice) {
      const historicalRoute = generateHistoricalRoute(selectedDevice);
      setRoute(historicalRoute);
      setCurrentIndex(0);
      setIsPlaying(false);
      
      // Aplicar snap to roads
      snapRouteToRoads(historicalRoute).then(snapped => {
        setSnappedRoute(snapped);
      });
    }
  }, [selectedDevice, selectedDate]);

  useEffect(() => {
    if (isPlaying && route.length > 0) {
      const baseInterval = 100; // 100ms para animação suave
      
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= route.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, baseInterval / playbackSpeed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, route.length]);

  const handlePlayPause = () => {
    if (currentIndex >= route.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSeek = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, route.length - 1)));
  };

  const createCustomIcon = (position: Position, device: Device) => {
    const color = '#3b82f6';
    const course = position.course || 0;
    const vehicleIcon = getVehicleIconSVG(device.category, '#ffffff', 0);
    
    return L.divIcon({
      className: 'custom-marker-replay',
      html: `
        <div class="relative flex items-center justify-center" style="width: 56px; height: 56px;">
          <div class="absolute inset-0 w-14 h-14 rounded-full bg-blue-500 animate-pulse opacity-30"></div>
          <div class="absolute" style="
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) rotate(${course}deg);
          ">
            <div style="
              width: 0; 
              height: 0; 
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-bottom: 14px solid ${color};
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
              transform: translateY(-20px);
            "></div>
          </div>
          <div class="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border-3 border-white" style="background: linear-gradient(135deg, ${color}, ${color}dd);">
            ${vehicleIcon}
          </div>
          <div class="absolute -bottom-10 left-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap font-bold shadow-lg" style="transform: translate(-50%, 0);">
            ${Math.round(position.speed)} km/h
          </div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      popupAnchor: [0, -28],
    });
  };

  const currentPosition = route[currentIndex];
  const device = devices.find(d => d.id === selectedDevice);
  const completedRoute = route.slice(0, currentIndex + 1);
  const progress = route.length > 0 ? (currentIndex / (route.length - 1)) * 100 : 0;
  
  // Calcular posição do marcador na linha snapped para sincronização perfeita
  const getMarkerPosition = (): [number, number] => {
    if (snappedRoute.length === 0 || !currentPosition) {
      return currentPosition ? [currentPosition.latitude, currentPosition.longitude] : [0, 0];
    }
    
    // Mapear o currentIndex da rota para o índice da snappedRoute
    const snappedIndex = Math.floor((currentIndex / route.length) * snappedRoute.length);
    const clampedIndex = Math.max(0, Math.min(snappedIndex, snappedRoute.length - 1));
    
    return snappedRoute[clampedIndex];
  };

  if (!isClient) {
    return (
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] relative flex flex-col">
      <PageHeader
        title="Reprodução de Rotas"
        description="Reveja trajetos históricos com controles de timeline"
        icon={Route}
      />

      {/* Map em tela cheia com controles overlay */}
      <div className="flex-1 relative mt-4">
        {route.length > 0 && currentPosition && device ? (
          <>
            <MapContainer
              center={[currentPosition.latitude, currentPosition.longitude]}
              zoom={14}
              style={{ width: '100%', height: '100%' }}
              className="rounded-lg"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              />
              
              {/* Completed Route - Snapped to Roads */}
              {snappedRoute.length > 0 ? (
                <Polyline
                  positions={snappedRoute.slice(0, Math.floor((currentIndex / route.length) * snappedRoute.length))}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 5,
                    opacity: 0.9,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                />
              ) : (
                <Polyline
                  positions={completedRoute.map(p => [p.latitude, p.longitude])}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.8
                  }}
                />
              )}
              
              {/* Remaining Route - Snapped to Roads */}
              {snappedRoute.length > 0 ? (
                <Polyline
                  positions={snappedRoute.slice(Math.floor((currentIndex / route.length) * snappedRoute.length))}
                  pathOptions={{
                    color: '#6b7280',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '8, 12',
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                />
              ) : (
                <Polyline
                  positions={route.slice(currentIndex).map(p => [p.latitude, p.longitude])}
                  pathOptions={{
                    color: '#6b7280',
                    weight: 3,
                    opacity: 0.4,
                    dashArray: '10, 10'
                  }}
                />
              )}

              {/* Start Marker */}
              <Marker
                position={[route[0].latitude, route[0].longitude]}
                icon={L.divIcon({
                  className: 'custom-marker',
                  html: `<div class="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">S</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })}
              />

              {/* End Marker */}
              <Marker
                position={[route[route.length - 1].latitude, route[route.length - 1].longitude]}
                icon={L.divIcon({
                  className: 'custom-marker',
                  html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">E</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })}
              />

              {/* Current Position com animação suave - sincronizado com linha */}
              <Marker
                position={getMarkerPosition()}
                icon={createCustomIcon(currentPosition, device)}
              />
            </MapContainer>

            {/* Controls Overlay - Top */}
            <Card className="absolute top-3 left-3 right-3 z-[1000] backdrop-blur-xl bg-black/60 border-white/10">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-3">
                  <Select value={selectedDevice?.toString()} onValueChange={(value) => setSelectedDevice(parseInt(value))}>
                    <SelectTrigger className="h-9 bg-white/5 border-white/10">
                      <SelectValue placeholder="Veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.plate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <Select value={playbackSpeed.toString()} onValueChange={(value) => setPlaybackSpeed(parseFloat(value))}>
                    <SelectTrigger className="h-9 bg-blue-500/20 border-blue-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25x</SelectItem>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="5">5x</SelectItem>
                      <SelectItem value="10">10x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Timeline Controls - Bottom */}
            <Card className="absolute bottom-3 left-3 right-3 z-[1000] backdrop-blur-xl bg-black/60 border-white/10">
              <CardContent className="p-3 space-y-2">
                {/* Progress Bar */}
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max={route.length - 1}
                    value={currentIndex}
                    onChange={(e) => handleSeek(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progress}%, #374151 ${progress}%, #374151 100%)`
                    }}
                  />
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-300">{route[0] && formatDate(route[0].deviceTime)}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white/5 border-white/10" onClick={handleStop} disabled={currentIndex === 0}>
                      <Square className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white/5 border-white/10" onClick={() => handleSeek(currentIndex - 10)} disabled={currentIndex === 0}>
                      <SkipBack className="h-3 w-3" />
                    </Button>
                    <Button size="icon" className="h-10 w-10 bg-blue-600 hover:bg-blue-700" onClick={handlePlayPause}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white/5 border-white/10" onClick={() => handleSeek(currentIndex + 10)} disabled={currentIndex >= route.length - 1}>
                      <SkipForward className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-300">{route[route.length - 1] && formatDate(route[route.length - 1].deviceTime)}</div>
                </div>

                {/* Quick Speed + Stats */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-1">
                    {[0.5, 1, 2, 5, 10].map(speed => (
                      <Button
                        key={speed}
                        variant={playbackSpeed === speed ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`h-6 px-2 ${playbackSpeed === speed ? 'bg-blue-600' : 'bg-white/5'}`}
                      >
                        {speed}x
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-4 text-gray-300">
                    <span>⚡ {Math.round(currentPosition.speed)} km/h</span>
                    <span>📍 {currentIndex + 1}/{route.length}</span>
                    <span>🕐 {new Date(currentPosition.deviceTime).toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-muted rounded-lg">
            <div className="text-center">
              <Route className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Selecione um veículo e data para visualizar a rota</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
