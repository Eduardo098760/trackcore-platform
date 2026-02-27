'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Car, MapPin, Gauge, Zap, Clock,
  AlertTriangle, Navigation2, Satellite, RefreshCw,
} from 'lucide-react';
import { reverseGeocode } from '@/lib/geocoding';

// Leaflet carregado apenas no cliente via useEffect (evita erros de HMR no App Router)
// L é armazenado em estado React para acionar re-render quando o import dinâmico terminar

const MapContainer      = dynamic(() => import('react-leaflet').then(m => m.MapContainer),      { ssr: false });
const TileLayer         = dynamic(() => import('react-leaflet').then(m => m.TileLayer),         { ssr: false });
const Marker            = dynamic(() => import('react-leaflet').then(m => m.Marker),            { ssr: false });
const LeafletTooltip    = dynamic(() => import('react-leaflet').then(m => m.Tooltip),           { ssr: false });
const Polyline          = dynamic(() => import('react-leaflet').then(m => m.Polyline),          { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

// Máximo de pontos mantidos no rastro
const MAX_TRAIL = 120;

type TrailPoint = [number, number];

interface SharedPosition {
  latitude:  number;
  longitude: number;
  speed:     number;
  course:    number;
  fixTime:   string;
  address:   string | null;
  attributes: { ignition?: boolean; motion?: boolean; sat?: number };
}

interface SharedDevice {
  id:         number;
  name:       string;
  plate:      string;
  status:     string;
  category:   string;
  lastUpdate: string | null;
}

interface SharedData {
  valid:     boolean;
  device?:   SharedDevice;
  position?: SharedPosition | null;
  expiresAt?: number;
  error?:    string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  switch (s) {
    case 'moving':  return '#3b82f6';
    case 'online':
    case 'stopped': return '#10b981';
    default:        return '#6b7280';
  }
}

function statusLabel(s: string) {
  switch (s) {
    case 'moving':  return 'Em Movimento';
    case 'online':
    case 'stopped': return 'Parado';
    case 'offline': return 'Offline';
    default:        return 'Desconhecido';
  }
}

// ── CountdownTimer ────────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  const urgent = remaining < 5 * 60_000;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
      <Clock className="w-3.5 h-3.5" />
      {h > 0 ? `${h}h ` : ''}
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  );
}

// ── MapFollower ───────────────────────────────────────────────────────────────

function MapFollower({ lat, lng }: { lat: number; lng: number }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useMap } = require('react-leaflet');
  const map = useMap();
  const first = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (!first.current) {
      map.setView([lat, lng], 15, { animate: false });
      first.current = true;
    } else {
      map.panTo([lat, lng], { animate: true, duration: 1 });
    }
  }, [lat, lng, map]);

  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams();
  const token  = params?.token as string;

  const [data,       setData]       = useState<SharedData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [expired,    setExpired]    = useState(false);
  const [isClient,   setIsClient]   = useState(false);
  const [leaflet,    setLeaflet]    = useState<any>(null);
  const [trail,      setTrail]      = useState<TrailPoint[]>([]);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const lastGeocodedRef = useRef<string>('');  // chave lat,lng já geocodificada
  const [lastRefresh,setLastRefresh]= useState<Date | null>(null);
  const intervalRef  = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`/api/share/${token}`);
      const json: SharedData = await res.json();
      if (!json.valid) { setExpired(true); return; }
      setData(json);
      setLastRefresh(new Date());
      // Acumula ponto no rastro quando o veículo tem posição
      if (json.position) {
        const { latitude, longitude } = json.position;
        setTrail(prev => {
          const last = prev[prev.length - 1];
          // Evita duplicar o mesmo ponto
          if (last && last[0] === latitude && last[1] === longitude) return prev;
          const next: TrailPoint[] = [...prev, [latitude, longitude]];
          return next.length > MAX_TRAIL ? next.slice(next.length - MAX_TRAIL) : next;
        });
      }
      if (json.expiresAt && Date.now() >= json.expiresAt) setExpired(true);
    } catch {
      /* mantém último dado exibido em caso de falha de rede */
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Geocoding reverso: busca rua/cidade quando Traccar não retorna endereço
  useEffect(() => {
    const pos = data?.position;
    if (!pos) return;
    // Se o Traccar já retornou endereço, usa ele direto
    if (pos.address) { setResolvedAddress(pos.address); return; }
    // Evita re-geocodificar o mesmo ponto
    const key = `${pos.latitude.toFixed(4)},${pos.longitude.toFixed(4)}`;
    if (lastGeocodedRef.current === key) return;
    lastGeocodedRef.current = key;
    reverseGeocode(pos.latitude, pos.longitude).then(setResolvedAddress);
  }, [data?.position]);

  useEffect(() => {
    import('leaflet').then((mod) => { setLeaflet(mod.default ?? mod); });
    setIsClient(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // Marca expirado quando o timer zera
  useEffect(() => {
    if (!data?.expiresAt) return;
    const remaining = data.expiresAt - Date.now();
    if (remaining <= 0) { setExpired(true); return; }
    const t = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(t);
  }, [data?.expiresAt]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!isClient || loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d1117]">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin mb-5" />
        <p className="text-gray-400 text-sm">Carregando localização…</p>
        <p className="text-gray-600 text-xs mt-1">TrackCore · Compartilhamento Seguro</p>
      </div>
    );
  }

  // ── Expired / Invalid ──────────────────────────────────────────────────────
  if (expired || (data && !data.valid)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d1117] px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Link Expirado</h1>
        <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
          Este link de rastreamento expirou ou é inválido. Solicite um novo link ao responsável pelo veículo.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-gray-600">
          <Navigation2 className="w-3.5 h-3.5" />
          <span>TrackCore · Rastreamento Veicular</span>
        </div>
      </div>
    );
  }

  const pos = data?.position;
  const dev = data?.device;
  const color = statusColor(dev?.status || 'offline');

  // Ícone do marcador
  const markerIcon = isClient && leaflet
    ? leaflet.divIcon({
        className: '',
        html: `
          <div style="
            width:44px;height:44px;border-radius:50%;
            background:linear-gradient(135deg,${color},${color}bb);
            border:2.5px solid rgba(255,255,255,0.4);
            box-shadow:0 4px 16px rgba(0,0,0,0.5);
            display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>`,
        iconSize:   [44, 44],
        iconAnchor: [22, 22],
      })
    : null;

  return (
    <div className="h-screen w-screen relative bg-[#0d1117] overflow-hidden">

      {/* ── Mapa ──────────────────────────────────────────────────────────── */}
      {isClient && pos && (
        <div className="absolute inset-0 z-0">
          <MapContainer
            center={[pos.latitude, pos.longitude]}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            zoomControl
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
              maxZoom={19}
            />
            <MapFollower lat={pos.latitude} lng={pos.longitude} />
            {/* Rastro de posições */}
            {trail.length >= 2 && (
              <Polyline
                positions={trail}
                pathOptions={{
                  color:     '#3b82f6',
                  weight:    3,
                  opacity:   0.75,
                  lineCap:   'round',
                  lineJoin:  'round',
                  dashArray: undefined,
                }}
              />
            )}
            {markerIcon && (
              <Marker position={[pos.latitude, pos.longitude]} icon={markerIcon}>
                {dev?.plate && (
                  <LeafletTooltip direction="top" offset={[0, -26]} permanent>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>
                      {dev.plate}
                    </span>
                  </LeafletTooltip>
                )}
              </Marker>
            )}
          </MapContainer>
        </div>
      )}

      {/* ── Sem posição ───────────────────────────────────────────────────── */}
      {isClient && !pos && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-700" />
            <p className="text-gray-500 text-sm">Aguardando posição GPS…</p>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-lg">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <Navigation2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-white text-xs font-bold tracking-wide">TrackCore</span>
          <div className="w-px h-3 bg-white/20" />
          <span className="text-gray-400 text-[11px]">Modo leitura</span>
        </div>

        {/* Countdown */}
        {data?.expiresAt && (
          <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-lg">
            <CountdownTimer expiresAt={data.expiresAt} />
          </div>
        )}
      </div>

      {/* ── Card de informações ───────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-3 right-3 z-[1000]">
        <div className="bg-[#0d1117]/92 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          {/* Vehicle header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border"
                style={{ background: `${color}1a`, borderColor: `${color}30` }}
              >
                <Car className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{dev?.name || 'Veículo'}</p>
                {dev?.plate && (
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5">{dev.plate}</p>
                )}
              </div>
            </div>
            <span
              className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
            >
              {statusLabel(dev?.status || 'unknown')}
            </span>
          </div>

          {/* Metrics */}
          {pos && (
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1.5">
                  <Gauge className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] uppercase font-semibold text-gray-600 tracking-wide">Velocidade</span>
                </div>
                <p className="text-white font-bold text-base leading-none">
                  {Math.round(pos.speed)}<span className="text-gray-600 text-[10px] font-normal ml-0.5">km/h</span>
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1.5">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-[9px] uppercase font-semibold text-gray-600 tracking-wide">Ignição</span>
                </div>
                <p className={`font-bold text-base leading-none ${pos.attributes.ignition ? 'text-green-400' : 'text-gray-600'}`}>
                  {pos.attributes.ignition ? 'LIGADA' : 'DESLIG.'}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                <div className="flex items-center gap-1 mb-1.5">
                  <Satellite className="w-3 h-3 text-purple-400" />
                  <span className="text-[9px] uppercase font-semibold text-gray-600 tracking-wide">Satélites</span>
                </div>
                <p className="text-white font-bold text-base leading-none">
                  {pos.attributes.sat ?? '—'}
                </p>
              </div>
            </div>
          )}

          {/* Address */}
          {pos && (
            <div className="px-4 pb-3">
              <div className="flex items-start gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  {resolvedAddress
                    || pos.address
                    || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 pb-3 flex items-center justify-between">
            <p className="text-[10px] text-gray-700">
              {lastRefresh
                ? `Atualizado ${lastRefresh.toLocaleTimeString('pt-BR')}`
                : 'Aguardando atualização…'}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-gray-600">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} />
              Atualiza a cada 10s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
