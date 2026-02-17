'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getDevices, getPositions } from '@/lib/api';
import { updateDevice } from '@/lib/api/devices';
import { Device, Position, VehicleCategory } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navigation, Zap, ZapOff, Circle, Wifi, WifiOff, Edit, Gauge, Car, Calendar, Palette, Phone, Route } from 'lucide-react';
import { formatSpeed, formatDate, getDeviceStatusColor } from '@/lib/utils';
import { getVehicleIconSVG } from '@/lib/vehicle-icons';
import { getWebSocketClient } from '@/lib/websocket';
import { getPlannedRouteById, getRouteGeometry } from '@/lib/api/routes';
import { useSearchStore } from '@/lib/stores/search';
import { VehicleDetailsPanel } from '@/components/dashboard/vehicle-details-panel';
import { toast } from 'sonner';

// Importar Leaflet apenas no cliente
let L: any;
if (typeof window !== 'undefined') {
  L = require('leaflet');
}

// Importar Leaflet dinamicamente para evitar problemas com SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);

type TileLayerKey = 'dark' | 'light' | 'streets' | 'satellite';

const TILE_LAYERS: Record<TileLayerKey, { url: string; attribution: string; label: string; subdomains?: string | string[]; maxNativeZoom?: number }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: 'Escuro',
    subdomains: 'abcd',
    // Em alguns ambientes com alta densidade (retina), o Leaflet pode tentar buscar tiles acima do limite.
    // Mantemos maxNativeZoom 18 para permitir overzoom por scaling e evitar tela "branca".
    maxNativeZoom: 18,
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: 'Claro',
    subdomains: 'abcd',
    maxNativeZoom: 18,
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: 'Ruas',
    subdomains: 'abcd',
    maxNativeZoom: 18,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Satélite',
    // Em algumas regiões o Esri não entrega tiles no z=19; usar overzoom evita tela branca.
    maxNativeZoom: 18,
  },
};

export default function MapPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchTerm } = useSearchStore();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const hasAppliedUrlDevice = useRef(false);
  const [isClient, setIsClient] = useState(false);
  const [isHighDpi, setIsHighDpi] = useState(false);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [deviceTrails, setDeviceTrails] = useState<Map<number, {lat:number; lng:number; ts:number}[]>>(new Map());
  const [deviceRecentDistance, setDeviceRecentDistance] = useState<Map<number, number>>(new Map());
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    uniqueId: '',
    plate: '',
    phone: '',
    category: 'car' as VehicleCategory,
    model: '',
    year: new Date().getFullYear(),
    color: '',
    contact: '',
    speedLimit: 80,
    groupId: 0,
    expiryDate: ''
  });

  // Estilo do mapa (melhor qualidade visual + satélite)
  const [mapStyle, setMapStyle] = useState<TileLayerKey>('dark');

  // Trilhas são pesadas com muitos veículos: manter apenas do selecionado
  // Rota planejada (quando ?routeId= na URL)
  const routeIdFromUrl = searchParams?.get('routeId') || null;
  const [plannedRouteGeometry, setPlannedRouteGeometry] = useState<[number, number][]>([]);
  const [plannedRouteName, setPlannedRouteName] = useState<string | null>(null);
  const [showPlannedRouteLabel, setShowPlannedRouteLabel] = useState(true);

  useEffect(() => {
    setIsClient(true);
    try {
      setIsHighDpi(typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1);
    } catch {
      setIsHighDpi(false);
    }
  }, []);

  function MapResizeInvalidator() {
    const { useMap } = require('react-leaflet');
    const map = useMap();

    useEffect(() => {
      if (!map) return;
      if (typeof ResizeObserver === 'undefined') return;

      const container: HTMLElement | undefined = map.getContainer?.();
      if (!container) return;

      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          try {
            map.invalidateSize?.({ animate: false });
          } catch {
            // no-op
          }
        });
      });

      ro.observe(container);
      return () => {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }, [map]);

    return null;
  }

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => getPositions(),
  });

  // Evita que o effect do WebSocket reconecte a cada mudança de `devices`
  const devicesRef = useRef<Device[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Corrige stale-closure ao calcular distância baseado em trilhas
  const deviceTrailsRef = useRef<Map<number, { lat: number; lng: number; ts: number }[]>>(new Map());
  useEffect(() => {
    deviceTrailsRef.current = deviceTrails;
  }, [deviceTrails]);

  const { data: plannedRoute } = useQuery({
    queryKey: ['planned-route', routeIdFromUrl],
    queryFn: () => getPlannedRouteById(routeIdFromUrl as string),
    enabled: typeof routeIdFromUrl === 'string' && routeIdFromUrl.length > 0,
  });

  useEffect(() => {
    if (!plannedRoute?.waypoints?.length) {
      setPlannedRouteGeometry([]);
      setPlannedRouteName(null);
      return;
    }
    setPlannedRouteName(plannedRoute.name);
    getRouteGeometry(plannedRoute.waypoints).then((coords) => setPlannedRouteGeometry(coords));
  }, [plannedRoute]);

  // Abrir mapa com veículo da URL (?deviceId=123): selecionar dispositivo e centralizar
  useEffect(() => {
    const deviceIdParam = searchParams?.get('deviceId');
    if (!deviceIdParam || hasAppliedUrlDevice.current || !devices.length || !positions.length) return;
    const deviceId = parseInt(deviceIdParam, 10);
    if (!Number.isFinite(deviceId)) return;
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    hasAppliedUrlDevice.current = true;
    setSelectedDevice(device);
    setFollowVehicle(true);
  }, [searchParams, devices, positions]);

  const tileLayerProps = useMemo(() => {
    const layer = TILE_LAYERS[mapStyle];
    const isCarto = mapStyle === 'dark' || mapStyle === 'light' || mapStyle === 'streets';
    const url = (isCarto && isHighDpi)
      ? layer.url.replace(/\.png$/, '@2x.png')
      : layer.url;

    return {
      url,
      attribution: layer.attribution,
      // O mapa permite até 19; se o TileLayer tiver maxZoom menor, no zoom alto ele fica em branco.
      // maxNativeZoom controla até onde existem tiles "nativos"; acima disso, o Leaflet faz overzoom (scaling).
      maxZoom: 19,
      maxNativeZoom: layer.maxNativeZoom ?? 19,
      // Tiles HD (@2x) com tileSize/zoomOffset corretos para melhorar nitidez
      ...(isCarto && isHighDpi ? { tileSize: 512, zoomOffset: -1 } : {}),
      // Evita "branco" durante zoom/flyTo mantendo tiles carregando
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 6,
      eventHandlers: {
        tileerror: (e: any) => {
          try {
            const src = e?.tile?.src;
            // Ajuda a diagnosticar rapidamente 404/rate-limit no provider
            console.warn('[Tile error]', { mapStyle, src });
          } catch {
            // ignore
          }
        },
      },
      ...(layer.subdomains ? { subdomains: layer.subdomains as any } : {}),
    };
  }, [mapStyle, isHighDpi]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Device> }) => 
      updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Veículo atualizado com sucesso!');
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar veículo');
    },
  });

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      uniqueId: device.uniqueId,
      plate: device.plate,
      phone: device.phone || '',
      category: device.category,
      model: device.model || '',
      year: device.year || new Date().getFullYear(),
      color: device.color || '',
      contact: device.contact || '',
      speedLimit: device.speedLimit || 80,
      groupId: 0,
      expiryDate: ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveDevice = () => {
    if (editingDevice) {
      updateMutation.mutate({
        id: editingDevice.id,
        data: editForm
      });
    }
  };

  // WebSocket real-time updates + Polling Fallback (para TODOS os veículos)
  useEffect(() => {
    const wsClient = getWebSocketClient();
    let pollingInterval: NodeJS.Timeout | null = null;
    let lastMessageTime = Date.now();

    // Throttle de updates para não travar em bursts do WS
    let flushTimer: NodeJS.Timeout | null = null;
    let pendingPositions: Position[] | null = null;

    const processPositionUpdates = (positionList: Position[]) => {
      console.debug(`[Map] Processando ${positionList.length} posições para ${devicesRef.current.length} veículos`);

      // Atualizar React Query com novas posições para TODOS os veículos
      queryClient.setQueryData(['positions'], (old: Position[] = []) => {
        const newPositions = [...old];
        positionList.forEach(newPos => {
          const index = newPositions.findIndex(p => p.deviceId === newPos.deviceId);
          if (index !== -1) {
            newPositions[index] = newPos;
          } else {
            newPositions.push(newPos);
          }
        });
        return newPositions;
      });

      // Atualizar trilhas de TODOS os veículos
      setDeviceTrails(prev => {
        const trails = new Map(prev);
        positionList.forEach(position => {
          const ts = position.fixTime ? new Date(position.fixTime).getTime() : (position.serverTime ? new Date(position.serverTime).getTime() : Date.now());
          const current = trails.get(position.deviceId) || [];
          const newPoint = { lat: position.latitude, lng: position.longitude, ts };
          const cutoff = Date.now() - 5 * 60 * 1000;
          const merged = [...current, newPoint];
          const updated = merged.filter(p => p.ts >= cutoff).slice(-60);
          trails.set(position.deviceId, updated);
        });
        deviceTrailsRef.current = trails;
        return trails;
      });

      // Calcular distância para TODOS os veículos
      setDeviceRecentDistance(prevD => {
        const m = new Map(prevD);
        try {
          const { distanceKm } = require('@/lib/utils');
          positionList.forEach(position => {
            const current = deviceTrailsRef.current.get(position.deviceId) || [];
            let distKm = 0;
            for (let i = 1; i < current.length; i++) {
              const a = current[i - 1];
              const b = current[i];
              distKm += distanceKm(a.lat, a.lng, b.lat, b.lng);
            }
            m.set(position.deviceId, distKm);
          });
        } catch (err) {
          console.error('[Map] Erro ao calcular distância:', err);
        }
        return m;
      });
    };

    const scheduleProcessPositionUpdates = (positionList: Position[]) => {
      pendingPositions = positionList;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const pending = pendingPositions;
        pendingPositions = null;
        if (pending && pending.length) processPositionUpdates(pending);
      }, 250);
    };

    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'positions') {
        console.debug('[WS] Posições recebidas:', message.data.length);
        lastMessageTime = Date.now();
        scheduleProcessPositionUpdates(message.data);
      } else if (message.type === 'devices') {
        queryClient.setQueryData(['devices'], message.data);
      } else if (message.type === 'events') {
        message.data.forEach(event => {
          toast.info(`${event.type}: ${event.attributes.message || ''}`);
        });
      }
    });

    wsClient.connect();
    console.debug('[Map] WebSocket conectando...');
    
    // Fallback polling: se WebSocket não enviar mensagens por 10s, inicia polling
    const startPollingIfNeeded = () => {
      if (!wsClient.isConnected() || Date.now() - lastMessageTime > 10000) {
        if (!pollingInterval) {
          console.warn('[Map] Iniciando polling de emergência...');
          pollingInterval = setInterval(async () => {
            try {
              const freshPositions = await getPositions();
              if (freshPositions.length > 0) {
                console.debug('[Polling] Atualizando com', freshPositions.length, 'posições');
                scheduleProcessPositionUpdates(freshPositions);
              }
            } catch (err) {
              console.error('[Polling] Erro:', err);
            }
          }, 3000);
        }
      }
    };

    const checkConnection = setInterval(() => {
      const isConnected = wsClient.isConnected();
      setIsWsConnected(isConnected);
      if (!isConnected && Date.now() - lastMessageTime > 10000) {
        startPollingIfNeeded();
      } else if (isConnected && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkConnection);
      if (pollingInterval) clearInterval(pollingInterval);
      if (flushTimer) clearTimeout(flushTimer);
      wsClient.disconnect();
    };
  }, [queryClient]);

  const positionsMap = useMemo(() => new Map((positions as Position[]).map(p => [p.deviceId, p])), [positions]);

  // Smooth polyline helper (Chaikin's algorithm - simple smoothing)
  const smoothTrail = (coords: [number, number][], iterations = 1) => {
    if (!coords || coords.length < 3) return coords;
    let pts = coords.map(p => [p[0], p[1]] as [number, number]);
    for (let it = 0; it < iterations; it++) {
      const next: [number, number][] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const q: [number, number] = [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]];
        const r: [number, number] = [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]];
        next.push(q, r);
      }
      pts = [pts[0], ...next, pts[pts.length - 1]];
    }
    return pts;
  };

  // Map follow handler component - centers map on a vehicle when `followVehicle` is true
  function MapFollowHandler({ positions, devices, follow, selectedDeviceId }: { positions: Position[]; devices: Device[]; follow: boolean; selectedDeviceId: number | null }) {
    // require here to avoid SSR issues; hook must be called unconditionally
    const { useMap } = require('react-leaflet');
    const map = useMap();
    const prev = useRef<{lat:number;lng:number} | null>(null);
    const transitionRunning = useRef(false);
    const animatedSelectionForId = useRef<number | null>(null);

    // Se o usuário mexer no mapa (drag/zoom), desativa o follow para não "brigar".
    useEffect(() => {
      if (!map) return;

      const disableFollowOnUserInput = () => {
        if (transitionRunning.current) return;
        setFollowVehicle(false);
      };

      map.on('dragstart', disableFollowOnUserInput);
      map.on('zoomstart', disableFollowOnUserInput);
      map.on('touchstart', disableFollowOnUserInput);

      return () => {
        map.off('dragstart', disableFollowOnUserInput);
        map.off('zoomstart', disableFollowOnUserInput);
        map.off('touchstart', disableFollowOnUserInput);
      };
    }, [map]);

    // Transição de seleção: roda uma única vez por veículo selecionado.
    useEffect(() => {
      if (!follow || !map || !selectedDeviceId) return;
      if (animatedSelectionForId.current === selectedDeviceId) return;

      const pos = positions.find((p) => p.deviceId === selectedDeviceId);
      if (!pos) return;

      const lat = pos.latitude;
      const lng = pos.longitude;

      animatedSelectionForId.current = selectedDeviceId;
      transitionRunning.current = true;

      let t1: number | undefined;
      let t2: number | undefined;

      try {
        try { map.stop?.(); } catch { /* ignore */ }
        const currentZoom = map.getZoom();
        const zoomOut = Math.max(13, Math.min(15, currentZoom - 3));
        map.flyTo([lat, lng], zoomOut, { duration: 0.65 });
      } catch {
        try { map.setView([lat, lng], map.getZoom()); } catch { /* ignore */ }
      }

      t1 = window.setTimeout(() => {
        try {
          try { map.stop?.(); } catch { /* ignore */ }
          map.flyTo([lat, lng], 17, { duration: 0.95 });
        } catch {
          try { map.setView([lat, lng], 17); } catch { /* ignore */ }
        }
      }, 740);

      t2 = window.setTimeout(() => {
        transitionRunning.current = false;
        prev.current = { lat, lng };
        // libera zoom/pan manual depois da animação
        setFollowVehicle(false);
      }, 1900);

      return () => {
        if (t1) window.clearTimeout(t1);
        if (t2) window.clearTimeout(t2);
        transitionRunning.current = false;
      };
    }, [follow, map, selectedDeviceId, positions]);

    // Follow contínuo (opcional): apenas quando não há veículo selecionado.
    useEffect(() => {
      if (!follow || !map) return;
      if (selectedDeviceId) return;
      if (transitionRunning.current) return;

      // choose device to follow: moving device > first device
      const targetDevice = devices.find((d) => d.status === 'moving') || devices[0];
      if (!targetDevice) return;

      const pos = positions.find((p) => p.deviceId === targetDevice.id);
      if (!pos) return;

      const lat = pos.latitude;
      const lng = pos.longitude;

      // avoid tiny updates
      if (prev.current && Math.abs(prev.current.lat - lat) < 1e-6 && Math.abs(prev.current.lng - lng) < 1e-6) return;
      prev.current = { lat, lng };

      try {
        map.flyTo([lat, lng], map.getZoom(), { duration: 0.6 });
      } catch {
        try { map.setView([lat, lng], map.getZoom()); } catch { /* ignore */ }
      }
    }, [positions, devices, follow, selectedDeviceId, map]);

    return null;
  }

  // Debug: log quantos devices e positions estão sendo renderizados
  useEffect(() => {
    const trailPoints = Array.from(deviceTrails.values()).reduce((sum, trail) => sum + trail.length, 0);
    console.debug(`[Map Render] ${devices.length} devices, ${positions.length} positions, ${trailPoints} trail points total`);
  }, [devices.length, positions.length, deviceTrails.size]);

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'moving':
        return '#3b82f6'; // blue
      case 'online':
      case 'stopped':
        return '#10b981'; // green
      case 'offline':
        return '#6b7280'; // gray
      case 'blocked':
        return '#ef4444'; // red
      default:
        return '#6b7280';
    }
  };

  const iconCacheRef = useRef(new Map<number, { key: string; icon: any }>());

  const createCustomIcon = (device: Device, position: Position, bearing?: number) => {
    if (!L) return null;
    
    const color = getMarkerColor(device.status);
    const isPulsing = device.status === 'moving';
    const course = typeof bearing === 'number' ? bearing : (position.course || 0);
    const vehicleIcon = getVehicleIconSVG(device.category, '#ffffff', 0);
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative flex items-center justify-center">
          ${isPulsing ? '<div class="absolute inset-0 w-12 h-12 rounded-full bg-blue-500 animate-ping opacity-50"></div>' : ''}

          ${typeof course === 'number' ? `
            <div class="absolute" style="left:50%;top:50%;transform:translate(-50%,-50%)">
              <div style="transform: rotate(${course}deg); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2 L16 13 L12 10 L8 13 Z" fill="#ffffff" stroke="${color}" stroke-width="0.5" />
                </svg>
              </div>
            </div>
          ` : ''}

          ${device.attributes.blocked ? `
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white z-10 flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
              </svg>
            </div>
          ` : ''}
          
          <div class="relative w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/40" style="background: linear-gradient(135deg, ${color}, ${color}dd); box-shadow: 0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1);">
            ${vehicleIcon}
          </div>

          <div class="absolute w-16 h-16 rounded-full border border-white/20 pointer-events-none" style="left:50%;top:50%;transform:translate(-50%,-50%);"></div>
          <div class="absolute left-1/2 top-1/2" style="transform: translate(-50%,-50%) rotate(${course}deg) translateY(-28px); transform-origin: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2 L16 13 L12 10 L8 13 Z" fill="${color}" />
            </svg>
          </div>
          
          ${isPulsing && position.speed > 0 ? `
            <div class="absolute -bottom-8 left-1/2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow-lg" style="transform: translate(-50%, 0);">
              ${Math.round(position.speed)} km/h
            </div>
          ` : ''}
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
    });
  };

  const getDeviceIcon = (device: Device, position: Position, bearing?: number) => {
    if (!L) return null;

    const rawCourse = typeof bearing === 'number' ? bearing : (typeof position.course === 'number' ? position.course : 0);
    const courseBucket = Math.round(rawCourse / 10) * 10;
    const speedBucket = device.status === 'moving' ? Math.round((position.speed || 0) / 5) * 5 : Math.round(position.speed || 0);
    const blocked = device.attributes?.blocked ? 1 : 0;

    const cacheKey = `${device.status}|${blocked}|${device.category}|${courseBucket}|${speedBucket}`;
    const cached = iconCacheRef.current.get(device.id);
    if (cached?.key === cacheKey) return cached.icon;

    const positionForIcon = (position.speed === speedBucket)
      ? position
      : ({ ...position, speed: speedBucket } as Position);

    const icon = createCustomIcon(device, positionForIcon, courseBucket);
    iconCacheRef.current.set(device.id, { key: cacheKey, icon });
    return icon;
  };

  const handleDeviceClick = useCallback((device: Device) => {
    const position = positionsMap.get(device.id);
    if (!position) return;
    setSelectedDevice(device);
    setFollowVehicle(true);
  }, [positionsMap]);

  const visibleDevices = useMemo(() => {
    if (!searchTerm) return devices;
    const searchLower = searchTerm.toLowerCase();
    return devices.filter((d) => (
      d.name?.toLowerCase().includes(searchLower) ||
      d.plate?.toLowerCase().includes(searchLower) ||
      d.uniqueId?.toLowerCase().includes(searchLower)
    ));
  }, [devices, searchTerm]);

  const devicesForTrails = useMemo(() => {
    if (!selectedDevice) return [] as Device[];
    return [selectedDevice];
  }, [selectedDevice]);

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Compact Header */}
      <div className={`absolute top-3 z-[1000] flex items-center gap-2 transition-all ${selectedDevice ? 'right-[328px]' : 'right-3'}`}>
        <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg">
          <div className="px-3 py-1.5 flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              {isWsConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-400">Real-time</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-400">Polling</span>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-200">Movimento</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-200">Parado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span className="text-xs text-gray-200">Offline</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <span className="text-xs text-blue-400 font-medium">{devices.length} veículos</span>
            
          </div>
        </Card>
      </div>

      {/* Canto superior esquerdo: rota planejada (se ativa) + seletor de estilo */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        {plannedRouteName && plannedRouteGeometry.length >= 2 && showPlannedRouteLabel && (
          <Card className="backdrop-blur-xl bg-violet-900/80 border-violet-500/30 shadow-lg px-3 py-2 flex items-center gap-2 w-fit">
            <Route className="w-4 h-4 text-violet-300 shrink-0" />
            <span className="text-sm text-white truncate max-w-[180px]">Rota: {plannedRouteName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/80 hover:text-white shrink-0"
              onClick={() => {
                router.push('/map');
                setShowPlannedRouteLabel(false);
              }}
            >
              ×
            </Button>
          </Card>
        )}
        {/* Seletor de estilo do mapa */}
        <div className="flex items-center gap-1">
        <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg overflow-hidden">
          <div className="flex rounded-lg overflow-hidden">
            {(['dark', 'light', 'streets', 'satellite'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setMapStyle(style)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  mapStyle === style
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {TILE_LAYERS[style].label}
              </button>
            ))}
          </div>
        </Card>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={12}
        minZoom={3}
        maxZoom={19}
        style={{ width: '100%', height: '100%' }}
        className="z-0 leaflet-map-quality"
        scrollWheelZoom={true}
      >
        <TileLayer key={mapStyle} {...tileLayerProps} />

        <MapResizeInvalidator />

        <MapFollowHandler positions={positions} devices={devices} follow={followVehicle} selectedDeviceId={selectedDevice ? selectedDevice.id : null} />

        {/* Rota planejada (quando ?routeId= na URL) */}
        {plannedRouteGeometry.length >= 2 && (
          <>
            <Polyline
              positions={plannedRouteGeometry}
              pathOptions={{
                color: '#8b5cf6',
                weight: 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {L && (
              <>
                <Marker
                  position={plannedRouteGeometry[0]}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: '<div class="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                />
                <Marker
                  position={plannedRouteGeometry[plannedRouteGeometry.length - 1]}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: '<div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                />
              </>
            )}
          </>
        )}

        {/* Trilhas de movimento (últimos 5 minutos) */}
        {devicesForTrails.map((device) => {
          const trail = deviceTrails.get(device.id) || [];
          if (trail.length < 1) return null; // Renderizar mesmo com 1 ponto
          const coords = trail.map(p => [p.lat, p.lng] as [number, number]);
          const smoothCoords = smoothTrail(coords, 1);
          return (
            <div key={`trail-${device.id}`}>
              {smoothCoords.length >= 2 && (
                <Polyline
                  positions={smoothCoords}
                  pathOptions={{
                    color: getMarkerColor(device.status),
                    weight: 4,
                    opacity: 0.95,
                    dashArray: '6, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Setas ao longo da trilha */}
              {smoothCoords.map((c, i) => {
                if (i === 0 || i % 3 !== 0 || i === smoothCoords.length - 1) return null;
                const prev = smoothCoords[i - 1];
                const dx = c[1] - prev[1];
                const dy = c[0] - prev[0];
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                const arrowHtml = `
                  <div style="transform: rotate(${angle}deg);">
                    <svg width=12 height=12 viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                      <path d='M2 12 L18 12 L14 8 L14 16 Z' fill='white' stroke='${getMarkerColor(device.status)}' stroke-width='0.5'/>
                    </svg>
                  </div>`;
                const icon = L.divIcon({
                  className: 'arrow-marker',
                  html: arrowHtml,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                });
                return (
                  <Marker key={`arrow-${device.id}-${i}`} position={c} icon={icon} interactive={false} />
                );
              })}
            </div>
          );
        })}

        {/* Markers para cada dispositivo */}
        {devices.map((device) => {
          const position = positionsMap.get(device.id);
          if (!position) return null;
          // compute bearing fallback from recent trail if course not present
          let bearing: number | undefined = undefined;
          if (typeof position.course === 'number') {
            bearing = position.course;
          } else {
            const trail = deviceTrails.get(device.id) || [];
            if (trail.length >= 2) {
              try {
                const { bearingDeg } = require('@/lib/utils');
                const a = trail[trail.length - 2];
                const b = trail[trail.length - 1];
                bearing = bearingDeg(a.lat, a.lng, b.lat, b.lng);
              } catch (e) {
                bearing = undefined;
              }
            }
          }

          return (
            <Marker
              key={device.id}
              position={[position.latitude, position.longitude]}
              icon={getDeviceIcon(device, position, bearing)}
              eventHandlers={{
                click: () => handleDeviceClick(device),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Compact Vehicle List */}
      <div className="absolute bottom-3 left-3 w-64 max-h-[50vh] overflow-hidden z-[1000]">
        <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg">
          <div className="p-3">
            <h3 className="font-semibold text-sm mb-2 text-gray-200 flex items-center justify-between">
              <span>Veículos</span>
              <span className="text-xs text-blue-400">
                {searchTerm ? `${visibleDevices.length} / ${devices.length}` : devices.length}
              </span>
            </h3>
            
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-600/30 scrollbar-track-transparent">
              {visibleDevices.map((device) => {
                const position = positionsMap.get(device.id);
                return (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceClick(device)}
                    className={`w-full px-2.5 py-2 rounded-md text-left transition-all ${
                      selectedDevice?.id === device.id
                        ? 'bg-blue-600/80 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getMarkerColor(device.status) }}
                        />
                        <span className="font-semibold truncate text-xs">{device.name || device.plate}</span>
                      </div>
                      {position && (
                        <span className="text-[10px] font-bold ml-2 flex-shrink-0">
                          {Math.round(position.speed)} km/h
                        </span>
                      )}
                    </div>
                    {device.name && device.plate && (
                      <div className="text-[9px] text-gray-400 ml-3 truncate">
                        {device.plate}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Speed Limit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-purple-500" />
              Editar Veículo
            </DialogTitle>
          </DialogHeader>
          {editingDevice && (
            <div className="space-y-4 py-2">
              {/* Info atual */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">Editando: {editingDevice.plate} - {editingDevice.name}</p>
              </div>

              {/* Grid de Campos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome do Veículo */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" />
                    Nome do Veículo *
                  </Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Ex: Caminhão Branco"
                    required
                  />
                </div>

                {/* Identificador (IMEI) */}
                <div className="space-y-2">
                  <Label htmlFor="uniqueId" className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-cyan-500" />
                    Identificador (IMEI) *
                  </Label>
                  <Input
                    id="uniqueId"
                    value={editForm.uniqueId}
                    onChange={(e) => setEditForm({ ...editForm, uniqueId: e.target.value })}
                    placeholder="Ex: 864943044660344"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    IMEI, número de serial ou outro ID único
                  </p>
                </div>

                {/* Placa */}
                <div className="space-y-2">
                  <Label htmlFor="plate" className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-green-500" />
                    Placa *
                  </Label>
                  <Input
                    id="plate"
                    value={editForm.plate}
                    onChange={(e) => setEditForm({ ...editForm, plate: e.target.value.toUpperCase() })}
                    placeholder="ABC-1234"
                    maxLength={8}
                    required
                  />
                </div>

                {/* Telefone (SIM) */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    Telefone (SIM Card)
                  </Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Ex: 5562999958024"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número do chip instalado no rastreador
                  </p>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-purple-500" />
                    Categoria *
                  </Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) => setEditForm({ ...editForm, category: value as VehicleCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Carro</SelectItem>
                      <SelectItem value="motorcycle">Moto</SelectItem>
                      <SelectItem value="truck">Caminhão</SelectItem>
                      <SelectItem value="bus">Ônibus</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="trailer">Carreta</SelectItem>
                      <SelectItem value="bicycle">Bicicleta</SelectItem>
                      <SelectItem value="boat">Barco</SelectItem>
                      <SelectItem value="airplane">Avião</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <Label htmlFor="model" className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    Modelo
                  </Label>
                  <Input
                    id="model"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="Ex: KYX-5E62"
                  />
                </div>

                {/* Ano */}
                <div className="space-y-2">
                  <Label htmlFor="year" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Ano
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) || 2024 })}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                {/* Cor */}
                <div className="space-y-2">
                  <Label htmlFor="color" className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-500" />
                    Cor
                  </Label>
                  <Input
                    id="color"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    placeholder="Ex: Branco"
                  />
                </div>

                {/* Contato (ICCID) */}
                <div className="space-y-2">
                  <Label htmlFor="contact" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-500" />
                    Contato / ICCID
                  </Label>
                  <Input
                    id="contact"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    placeholder="Ex: ICCID 8955320210007029201Z"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome do responsável ou ICCID do chip
                  </p>
                </div>

                {/* Limite de Velocidade */}
                <div className="space-y-2">
                  <Label htmlFor="speedLimit" className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-yellow-500" />
                    Limite de Velocidade
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="speedLimit"
                      type="number"
                      value={editForm.speedLimit}
                      onChange={(e) => setEditForm({ ...editForm, speedLimit: parseInt(e.target.value) || 80 })}
                      min="10"
                      max="200"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">km/h</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alerta quando exceder {editForm.speedLimit} km/h
                  </p>
                </div>

                {/* Validade */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="expiryDate" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-500" />
                    Validade do Rastreador
                  </Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data de vencimento do contrato ou licença do dispositivo
                  </p>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={handleSaveDevice} 
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Details Panel */}
      <VehicleDetailsPanel
        device={selectedDevice}
        position={selectedDevice ? positionsMap.get(selectedDevice.id) || null : null}
        recentDistanceKm={selectedDevice ? (deviceRecentDistance.get(selectedDevice.id) || 0) : 0}
        recentTrail={selectedDevice ? (deviceTrails.get(selectedDevice.id) || []) : []}
        onClose={() => setSelectedDevice(null)}
        onEdit={(device) => {
          handleEditDevice(device);
        }}
        onReplay={(deviceId) => router.push(`/replay?vehicle=${deviceId}`)}
        onVideo={(deviceId) => router.push(`/video?device=${deviceId}`)}
        onDetails={(deviceId) => router.push(`/vehicles/${deviceId}`)}
        onStreetView={(lat, lng) => {
          const url = `https://www.google.com/maps/@${lat},${lng},18z`;
          window.open(url, '_blank');
        }}
      />
    </div>
  );
}
