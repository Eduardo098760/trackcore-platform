'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Marker, useMapEvents } from 'react-leaflet';
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
