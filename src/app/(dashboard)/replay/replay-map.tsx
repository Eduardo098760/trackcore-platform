'use client';

/**
 * Componente de mapa isolado para evitar conflito de DOM entre React e Leaflet.
 * Importado com dynamic({ ssr: false }) no page.tsx — nunca use import direto.
 */

import {
  MapContainer, TileLayer, Marker, Polyline, Popup,
} from 'react-leaflet';
import L from 'leaflet';
import { RoutePosition } from '@/types';

// ─── helpers locais ───────────────────────────────────────────────────────────
const knotsToKmh = (k: number) => k * 1.852;

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

// ─── tipos exportados ─────────────────────────────────────────────────────────
export interface StopEventData {
  index: number; endIndex: number;
  startTime: string; endTime: string;
  durationSec: number; latitude: number; longitude: number;
}

export interface SpeedViolationData {
  index: number; endIndex: number;
  startTime: string; endTime: string;
  maxSpeed: number; durationSec: number;
  distanceKm: number; latitude: number; longitude: number;
}

export interface ReplayMapProps {
  center: [number, number];
  markerPos: [number, number];
  polylineCompleted: [number, number][];
  polylineRemaining: [number, number][];
  stops: StopEventData[];
  violations: SpeedViolationData[];
  routeFirst: { latitude: number; longitude: number };
  routeLast: { latitude: number; longitude: number };
  currentPos: RoutePosition;
  speedLimit: number;
  onSeek: (idx: number) => void;
}

// ─── componente ───────────────────────────────────────────────────────────────
export default function ReplayMap({
  center, markerPos,
  polylineCompleted, polylineRemaining,
  stops, violations,
  routeFirst, routeLast,
  currentPos, speedLimit, onSeek,
}: ReplayMapProps) {
  const speedKmh = knotsToKmh(currentPos.speed ?? 0);
  const stopped  = speedKmh <= 2;
  const speeding = speedLimit > 0 && speedKmh > speedLimit;
  const color    = stopped ? '#f97316' : speeding ? '#dc2626' : '#3b82f6';
  const course   = currentPos.course ?? 0;
  const svg      = `<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

  const vehicleIcon = L.divIcon({
    className: 'custom-marker-replay',
    html: `
      <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(${course}deg);">
          <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid ${color};filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));transform:translateY(-20px);"></div>
        </div>
        <div style="position:relative;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${color},${color}cc);box-shadow:0 4px 12px rgba(0,0,0,.5);border:2px solid #fff;">
          ${svg}
        </div>
        <div style="position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);background:${stopped ? '#c2410c' : '#1d4ed8'};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.4);">
          ${stopped ? '■ PARADO' : Math.round(speedKmh) + ' km/h'}
        </div>
      </div>`,
    iconSize: [56, 56], iconAnchor: [28, 28],
  });

  return (
    <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />

      {/* Rota percorrida */}
      <Polyline
        positions={polylineCompleted}
        pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }}
      />

      {/* Rota restante */}
      <Polyline
        positions={polylineRemaining}
        pathOptions={{ color: '#6b7280', weight: 3, opacity: 0.4, dashArray: '8, 12' }}
      />

      {/* Marcadores de parada */}
      {stops.map((stop, idx) => (
        <Marker
          key={`stop-${idx}`}
          position={[stop.latitude, stop.longitude]}
          icon={L.divIcon({
            className: '',
            html: `<div style="text-align:center;"><div style="width:28px;height:28px;background:#f97316;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;margin:0 auto;">${idx + 1}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #f97316;margin:0 auto;"></div></div>`,
            iconSize: [28, 35], iconAnchor: [14, 35],
          })}
          eventHandlers={{ click: () => onSeek(stop.index) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-orange-600 mb-1">⏸ Parada #{idx + 1}</p>
              <p className="text-gray-600"><span className="font-medium">Início:</span> {fmtDateTime(stop.startTime)}</p>
              <p className="text-gray-600"><span className="font-medium">Fim:</span> {fmtDateTime(stop.endTime)}</p>
              <p className="text-orange-700 font-bold mt-1">⏱ Duração: {fmtDuration(stop.durationSec)}</p>
              <p className="text-gray-400 text-xs mt-1">{stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}</p>
              <p className="text-blue-500 text-xs mt-0.5 cursor-pointer">Clique para ir a este ponto ↗</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Marcadores de excesso de velocidade */}
      {violations.map((v, idx) => (
        <Marker
          key={`viol-${idx}`}
          position={[v.latitude, v.longitude]}
          icon={L.divIcon({
            className: '',
            html: `<div style="text-align:center;position:relative;"><div style="width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-bottom:28px solid #dc2626;filter:drop-shadow(0 2px 6px rgba(220,38,38,.7));margin:0 auto;"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.8);">${v.maxSpeed}</div><div style="width:2px;height:6px;background:#dc2626;margin:0 auto;"></div></div>`,
            iconSize: [32, 40], iconAnchor: [16, 40],
          })}
          eventHandlers={{ click: () => onSeek(v.index) }}
        >
          <Popup>
            <div className="text-sm min-w-[180px]">
              <p className="font-bold text-red-600 mb-1">⚠️ Excesso #{idx + 1}</p>
              <p className="text-gray-600"><span className="font-medium">Limite:</span> {speedLimit} km/h</p>
              <p className="text-red-700 font-bold">Pico: {v.maxSpeed} km/h <span className="text-red-500">(+{v.maxSpeed - speedLimit})</span></p>
              <p className="text-gray-600"><span className="font-medium">Início:</span> {fmtDateTime(v.startTime)}</p>
              <p className="text-gray-600"><span className="font-medium">Fim:</span> {fmtDateTime(v.endTime)}</p>
              <p className="text-gray-500 text-xs mt-1">{fmtDuration(v.durationSec)} • {Math.round(v.distanceKm)} km em excesso</p>
              <p className="text-blue-500 text-xs mt-0.5 cursor-pointer">Clique para ir ↗</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Início */}
      <Marker
        position={[routeFirst.latitude, routeFirst.longitude]}
        icon={L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">S</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        })}
      />

      {/* Fim */}
      <Marker
        position={[routeLast.latitude, routeLast.longitude]}
        icon={L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">F</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        })}
      />

      {/* Veículo */}
      <Marker position={markerPos} icon={vehicleIcon} />
    </MapContainer>
  );
}
