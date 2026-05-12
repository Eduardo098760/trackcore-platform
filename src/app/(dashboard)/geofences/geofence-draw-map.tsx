'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapStyleSelector } from '@/components/map/map-style-selector';
import { TILE_LAYERS, type TileLayerKey } from '@/components/map/map-constants';
import { Car, Crosshair } from 'lucide-react';

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

function ClickHandler({
  onMapClick,
  shouldIgnoreClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
  shouldIgnoreClick?: () => boolean;
}) {
  useMapEvents({
    click(e) {
      if (shouldIgnoreClick?.()) {
        return;
      }

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

interface VehiclePreview {
  id: number;
  name: string;
  uniqueId: string;
  latitude: number;
  longitude: number;
  speed: number;
}

interface MapViewportTarget {
  type: 'polygon' | 'circle';
  coordinates?: [number, number][];
  center?: [number, number];
  radius?: number;
  requestKey?: number;
}

type MarkerDragEndEvent = {
  target: {
    getLatLng: () => { lat: number; lng: number };
  };
};

export interface ParsedGeofenceItem {
  id: number;
  name: string;
  color: string;
  type: 'polygon' | 'circle';
  coordinates?: [number, number][];
  center?: [number, number];
  radius?: number;
}

function ExistingGeofenceLayers({
  items,
  selectedGeofenceId,
  onGeofenceSelect,
  onGeofencePointerDown,
}: {
  items: ParsedGeofenceItem[];
  selectedGeofenceId?: number | null;
  onGeofenceSelect?: (geofenceId: number) => void;
  onGeofencePointerDown?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isSelected = item.id === selectedGeofenceId;
        const pathOptions = {
          color: item.color,
          fillColor: item.color,
          fillOpacity: isSelected ? 0.28 : 0.14,
          weight: isSelected ? 3 : 2,
          opacity: isSelected ? 1 : 0.75,
        };
        const eventHandlers = onGeofenceSelect
          ? {
              mousedown: () => {
                onGeofencePointerDown?.();
              },
              click: (event: L.LeafletMouseEvent) => {
                event.originalEvent.stopPropagation();
                onGeofenceSelect(item.id);
              },
            }
          : undefined;

        if (item.type === 'polygon' && item.coordinates) {
          return (
            <Polygon
              key={item.id}
              positions={item.coordinates}
              pathOptions={pathOptions}
              eventHandlers={eventHandlers}
            />
          );
        }

        if (item.type === 'circle' && item.center && item.radius) {
          return (
            <Circle
              key={item.id}
              center={item.center}
              radius={item.radius}
              pathOptions={pathOptions}
              eventHandlers={eventHandlers}
            />
          );
        }

        return null;
      })}
    </>
  );
}

function createVehicleIcon() {
  return L.divIcon({
    className: 'geofence-vehicle-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.92);
        border: 2px solid rgba(255,255,255,0.92);
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 700;
      ">C</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

const vehicleIcon = createVehicleIcon();

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
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
      onKeyDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      onDoubleClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
    >
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e: { target: { value: string } }) => handleInput(e.target.value)}
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
          {results.map((r: SearchResult, i: number) => (
            <button
              type="button"
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
              onMouseEnter={(e: { currentTarget: HTMLButtonElement }) => { e.currentTarget.style.background = '#374151'; }}
              onMouseLeave={(e: { currentTarget: HTMLButtonElement }) => { e.currentTarget.style.background = 'transparent'; }}
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

function VehicleVisibilityControl({
  showVehicles,
  vehicleCount,
  prioritizeSelectedVehicles,
  onToggle,
  onFocusVehicles,
}: {
  showVehicles: boolean;
  vehicleCount: number;
  prioritizeSelectedVehicles: boolean;
  onToggle: () => void;
  onFocusVehicles: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 280,
      }}
      onKeyDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      onDoubleClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          padding: '10px 12px',
          borderRadius: 12,
          border: showVehicles ? '1px solid rgba(59,130,246,0.55)' : '1px solid rgba(75,85,99,0.8)',
          background: showVehicles ? 'rgba(30,41,59,0.92)' : 'rgba(17,24,39,0.9)',
          color: '#e5e7eb',
          boxShadow: '0 10px 30px rgba(15,23,42,0.28)',
          backdropFilter: 'blur(12px)',
          cursor: vehicleCount > 0 ? 'pointer' : 'not-allowed',
          opacity: vehicleCount > 0 ? 1 : 0.65,
        }}
        disabled={vehicleCount === 0}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: showVehicles ? 'rgba(59,130,246,0.2)' : 'rgba(51,65,85,0.9)',
            border: '1px solid rgba(148,163,184,0.25)',
          }}>
            <Car size={15} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {showVehicles ? 'Ocultar carros' : 'Mostrar carros na area'}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {vehicleCount === 0
                ? 'Nenhum veiculo com posicao disponivel'
                : prioritizeSelectedVehicles
                  ? `${vehicleCount} veiculo(s) selecionado(s) servindo de referencia`
                  : `${vehicleCount} veiculo(s) com posicao atual no mapa`}
            </span>
          </span>
        </span>
        <span style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: showVehicles ? '#22c55e' : '#475569',
          boxShadow: showVehicles ? '0 0 0 4px rgba(34,197,94,0.12)' : 'none',
          flexShrink: 0,
        }} />
      </button>

      {showVehicles && vehicleCount > 0 && (
        <button
          type="button"
          onClick={onFocusVehicles}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '9px 12px',
            borderRadius: 12,
            border: '1px solid rgba(96,165,250,0.35)',
            background: 'rgba(30,41,59,0.88)',
            color: '#dbeafe',
            boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
          }}
        >
          <Crosshair size={15} />
          Focar nos carros mostrados
        </button>
      )}
    </div>
  );
}

function VehicleMarkers({ vehicles }: { vehicles: VehiclePreview[] }) {
  return (
    <>
      {vehicles.map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={[vehicle.latitude, vehicle.longitude]}
          icon={vehicleIcon}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{vehicle.name}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                {vehicle.uniqueId || `ID ${vehicle.id}`}
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Velocidade: {Math.round(vehicle.speed || 0)} km/h
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function focusMapOnVehicles(map: L.Map, vehicles: VehiclePreview[]) {
  if (vehicles.length === 0) return;

  if (vehicles.length === 1) {
    map.flyTo([vehicles[0].latitude, vehicles[0].longitude], 18, { duration: 0.8 });
    return;
  }

  const bounds = L.latLngBounds(
    vehicles.map((vehicle) => [vehicle.latitude, vehicle.longitude] as [number, number]),
  );
  map.flyToBounds(bounds, { padding: [48, 48], duration: 0.8, maxZoom: 18 });
}

function getCircleRadiusHandlePosition(
  center: [number, number],
  radius: number,
): [number, number] {
  const earthRadius = 6378137;
  const angularDistance = radius / earthRadius;
  const bearing = Math.PI / 2;
  const lat1 = (center[0] * Math.PI) / 180;
  const lng1 = (center[1] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

function focusMapOnTarget(map: L.Map, target: MapViewportTarget) {
  if (target.type === 'circle' && target.center && target.radius) {
    const circleBounds = L.latLng(target.center[0], target.center[1]).toBounds(
      target.radius * 2,
    );
    map.flyToBounds(circleBounds, { padding: [48, 48], duration: 0.8, maxZoom: 18 });
    return;
  }

  if (target.type === 'polygon' && target.coordinates && target.coordinates.length > 0) {
    if (target.coordinates.length === 1) {
      map.flyTo(target.coordinates[0], 18, { duration: 0.8 });
      return;
    }

    const bounds = L.latLngBounds(target.coordinates);
    map.flyToBounds(bounds, { padding: [48, 48], duration: 0.8, maxZoom: 18 });
  }
}

function InitialViewportController({
  target,
}: {
  target: MapViewportTarget | null;
}) {
  const map = useMap();
  const appliedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!target) {
      appliedTargetRef.current = null;
      return;
    }

    const targetKey = JSON.stringify(target);
    if (appliedTargetRef.current === targetKey) {
      return;
    }

    focusMapOnTarget(map, target);
    appliedTargetRef.current = targetKey;
  }, [map, target]);

  return null;
}

function MapToolbar({
  mapStyle,
  onStyleChange,
}: {
  mapStyle: TileLayerKey;
  onStyleChange: (style: TileLayerKey) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 10,
        right: 12,
        zIndex: 1000,
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <MapStyleSelector mapStyle={mapStyle} onStyleChange={onStyleChange} />
    </div>
  );
}

export interface GeofenceDrawMapProps {
  color: string;
  type: 'polygon' | 'circle' | 'rectangle';
  drawingPoints: [number, number][];
  circleCenter: [number, number] | null;
  circleRadius: number;
  vehicles: VehiclePreview[];
  geofences?: ParsedGeofenceItem[];
  selectedGeofenceId?: number | null;
  initialShowVehicles?: boolean;
  initialViewportTarget?: MapViewportTarget | null;
  prioritizeSelectedVehicles: boolean;
  onPointDrag: (index: number, point: [number, number]) => void;
  onCircleCenterDrag: (point: [number, number]) => void;
  onCircleRadiusDrag: (point: [number, number]) => void;
  onMapClick: (lat: number, lng: number) => void;
  onGeofenceSelect?: (geofenceId: number) => void;
}

export default function GeofenceDrawMap({
  color,
  type,
  drawingPoints,
  circleCenter,
  circleRadius,
  vehicles,
  geofences = [],
  selectedGeofenceId = null,
  initialShowVehicles = false,
  initialViewportTarget = null,
  prioritizeSelectedVehicles,
  onPointDrag,
  onCircleCenterDrag,
  onCircleRadiusDrag,
  onMapClick,
  onGeofenceSelect,
}: GeofenceDrawMapProps) {
  const [mapStyle, setMapStyleState] = useState<TileLayerKey>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const stored = localStorage.getItem('mapStyle');
      if (stored && stored in TILE_LAYERS) {
        return stored as TileLayerKey;
      }
    } catch {}
    return 'dark';
  });
  const [showVehicles, setShowVehicles] = useState(initialShowVehicles);
  const mapRef = useRef<L.Map | null>(null);
  const previousShowVehiclesRef = useRef(initialShowVehicles);
  const ignoreNextMapClickRef = useRef(false);

  useEffect(() => { fixLeafletIcons(); }, []);

  useEffect(() => {
    setShowVehicles(initialShowVehicles);
    previousShowVehiclesRef.current = initialShowVehicles;
  }, [initialShowVehicles, initialViewportTarget]);

  useEffect(() => {
    if (
      showVehicles &&
      !previousShowVehiclesRef.current &&
      vehicles.length > 0 &&
      mapRef.current
    ) {
      focusMapOnVehicles(mapRef.current, vehicles);
    }

    previousShowVehiclesRef.current = showVehicles;
  }, [showVehicles, vehicles]);

  const setMapStyle = useCallback((style: TileLayerKey) => {
    setMapStyleState(style);
    try {
      localStorage.setItem('mapStyle', style);
    } catch {}
  }, []);

  const selectedLayer = TILE_LAYERS[mapStyle as TileLayerKey] ?? TILE_LAYERS.dark;
  const circleRadiusHandlePosition =
    type === 'circle' && circleCenter && circleRadius > 0
      ? getCircleRadiusHandlePosition(circleCenter, circleRadius)
      : null;

  return (
    <MapContainer
      center={[-23.5505, -46.6333]}
      zoom={13}
      maxZoom={20}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
      ref={mapRef}
    >
      <TileLayer
        attribution={selectedLayer.attribution}
        url={selectedLayer.url}
        maxNativeZoom={selectedLayer.maxNativeZoom}
        {...(selectedLayer.subdomains ? { subdomains: selectedLayer.subdomains } : {})}
      />
      <InitialViewportController target={initialViewportTarget} />

      <ExistingGeofenceLayers
        items={geofences}
        selectedGeofenceId={selectedGeofenceId}
        onGeofenceSelect={onGeofenceSelect}
        onGeofencePointerDown={() => {
          ignoreNextMapClickRef.current = true;
        }}
      />

      <ClickHandler
        onMapClick={onMapClick}
        shouldIgnoreClick={() => {
          if (!ignoreNextMapClickRef.current) {
            return false;
          }

          ignoreNextMapClickRef.current = false;
          return true;
        }}
      />
      <MapSearchBar />
      <MapToolbar mapStyle={mapStyle} onStyleChange={setMapStyle} />
      <VehicleVisibilityControl
        showVehicles={showVehicles}
        vehicleCount={vehicles.length}
        prioritizeSelectedVehicles={prioritizeSelectedVehicles}
        onToggle={() => setShowVehicles((current: boolean) => !current)}
        onFocusVehicles={() => {
          if (!mapRef.current) return;
          focusMapOnVehicles(mapRef.current, vehicles);
        }}
      />

      {showVehicles && vehicles.length > 0 && <VehicleMarkers vehicles={vehicles} />}

      {/* Marcadores de pontos desenhados */}
      {drawingPoints.map((point, idx) => (
        <Marker
          key={idx}
          position={point}
          draggable
          eventHandlers={{
            dragend: (event: MarkerDragEndEvent) => {
              const latlng = event.target.getLatLng();
              onPointDrag(idx, [latlng.lat, latlng.lng]);
            },
          }}
        />
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
        <Marker
          position={circleCenter}
          draggable
          eventHandlers={{
            dragend: (event: MarkerDragEndEvent) => {
              const latlng = event.target.getLatLng();
              onCircleCenterDrag([latlng.lat, latlng.lng]);
            },
          }}
        />
      )}

      {type === 'circle' && circleCenter && circleRadius > 0 && (
        <Marker
          position={circleCenter}
          draggable
          eventHandlers={{
            dragend: (event: MarkerDragEndEvent) => {
              const latlng = event.target.getLatLng();
              onCircleCenterDrag([latlng.lat, latlng.lng]);
            },
          }}
        />
      )}

      {type === 'circle' && circleRadiusHandlePosition && (
        <Marker
          position={circleRadiusHandlePosition}
          draggable
          eventHandlers={{
            dragend: (event: MarkerDragEndEvent) => {
              const latlng = event.target.getLatLng();
              onCircleRadiusDrag([latlng.lat, latlng.lng]);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
