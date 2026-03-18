'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons (Leaflet + webpack/Next.js issue)
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

function MapSearchBar() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: q.trim(),
        format: 'json',
        limit: '5',
        countrycodes: 'br',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
  };

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    map.flyTo([lat, lng], 16, { duration: 1 });
    setShowResults(false);
    setQuery(result.display_name.split(',')[0]);
  };

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 10,
        left: 50,
        right: 50,
        zIndex: 1000,
        maxWidth: 420,
        margin: '0 auto',
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Buscar local no mapa..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
            borderRadius: 8,
            border: '1px solid #374151',
            background: '#1f2937',
            color: '#e5e7eb',
            fontSize: 13,
            outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {isLoading && (
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, border: '2px solid #374151', borderTop: '2px solid #60a5fa',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div style={{
          marginTop: 4,
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid #374151' : 'none',
                color: '#d1d5db',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#374151'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>
                {r.display_name.split(',')[0]}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.display_name.split(',').slice(1).join(',').trim()}
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}

export interface GeofenceDrawMapProps {
  color: string;
  type: 'polygon' | 'circle' | 'rectangle';
  drawingPoints: [number, number][];
  circleCenter: [number, number] | null;
  circleRadius: number;
  onMapClick: (lat: number, lng: number) => void;
}

export default function GeofenceDrawMap({
  color,
  type,
  drawingPoints,
  circleCenter,
  circleRadius,
  onMapClick,
}: GeofenceDrawMapProps) {
  useEffect(() => { fixLeafletIcons(); }, []);

  return (
    <MapContainer
      center={[-23.5505, -46.6333]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <ClickHandler onMapClick={onMapClick} />
      <MapSearchBar />

      {/* Marcadores de pontos desenhados */}
      {drawingPoints.map((point, idx) => (
        <Marker key={idx} position={point} />
      ))}

      {/* Preview do polígono em desenho */}
      {drawingPoints.length > 2 && type === 'polygon' && (
        <Polygon
          positions={drawingPoints}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.3 }}
        />
      )}

      {/* Preview do retângulo */}
      {type === 'rectangle' && drawingPoints.length === 4 && (
        <Polygon
          positions={drawingPoints}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.3 }}
        />
      )}

      {/* Preview do círculo */}
      {type === 'circle' && circleCenter && circleRadius > 0 && (
        <Circle
          center={circleCenter}
          radius={circleRadius}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.3 }}
        />
      )}

      {/* Marcador do centro do círculo antes de definir o raio */}
      {type === 'circle' && circleCenter && !circleRadius && (
        <Marker position={circleCenter} />
      )}
    </MapContainer>
  );
}
