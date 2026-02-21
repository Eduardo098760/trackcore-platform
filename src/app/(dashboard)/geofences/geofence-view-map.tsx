'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Circle } from 'react-leaflet';
import L from 'leaflet';

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export interface ParsedGeofenceItem {
  id: number;
  color: string;
  type: 'polygon' | 'circle';
  coordinates?: [number, number][];
  center?: [number, number];
  radius?: number;
}

export default function GeofenceViewMap({ items }: { items: ParsedGeofenceItem[] }) {
  useEffect(() => { fixLeafletIcons(); }, []);

  return (
    <MapContainer
      center={[-23.5505, -46.6333]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {items.map((item) => {
        if (item.type === 'polygon' && item.coordinates) {
          return (
            <Polygon
              key={item.id}
              positions={item.coordinates}
              pathOptions={{ color: item.color, fillColor: item.color, fillOpacity: 0.2 }}
            />
          );
        }
        if (item.type === 'circle' && item.center && item.radius) {
          return (
            <Circle
              key={item.id}
              center={item.center}
              radius={item.radius}
              pathOptions={{ color: item.color, fillColor: item.color, fillOpacity: 0.2 }}
            />
          );
        }
        return null;
      })}
    </MapContainer>
  );
}
