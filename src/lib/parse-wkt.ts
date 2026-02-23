/**
 * Utilitário compartilhado para parsear WKT (Well-Known Text) geográfico
 * em coordenadas Leaflet [lat, lng].
 *
 * Problema conhecido: O Traccar nativo armazena WKT com ordem (lng lat),
 * mas geofences criadas por algumas ferramentas (incluindo versões anteriores
 * deste app) usam ordem (lat lng). Para resolver, aplicamos uma heurística:
 *
 *   - Se abs(primeiro) > abs(segundo) → formato padrão WKT: (lng lat)
 *   - Se abs(primeiro) < abs(segundo) → formato invertido: (lat lng)
 *   - Se algum valor > 90 em absoluto → DEVE ser longitude (latitude máx = 90°)
 *
 * Esta heurística funciona corretamente para o Brasil e América Latina.
 */

export interface ParsedGeofence {
  type: 'polygon' | 'circle';
  coordinates?: [number, number][];
  center?: [number, number];
  radius?: number;
}

/**
 * Dado dois valores numéricos de um par de coordenadas WKT,
 * retorna [lat, lng] na ordem correta para o Leaflet.
 *
 * Ordem padrão WKT:  (lng lat) → retorna [lat, lng]
 * Ordem invertida:   (lat lng) → retorna [lat, lng]
 */
function resolveLatLng(v0: number, v1: number): [number, number] {
  // Se algum valor excede ±90, só pode ser longitude
  if (Math.abs(v0) > 90) return [v1, v0]; // v0 é lng, v1 é lat
  if (Math.abs(v1) > 90) return [v0, v1]; // v1 é lng, v0 é lat

  // Heurística: maior valor absoluto = longitude (válida para Américas e Europa)
  // WKT padrão: (lng lat) → v0=lng, v1=lat → [lat, lng] = [v1, v0]
  // Formato invertido: (lat lng) → v0=lat, v1=lng → [lat, lng] = [v0, v1]
  if (Math.abs(v0) >= Math.abs(v1)) {
    return [v1, v0]; // padrão WKT: (lng lat) → Leaflet [lat, lng]
  } else {
    return [v0, v1]; // invertido: (lat lng) → Leaflet [lat, lng]
  }
}

export function parseWKT(wkt: string): ParsedGeofence | null {
  if (!wkt || typeof wkt !== 'string') return null;
  try {
    const normalized = wkt.trim();
    const upper = normalized.toUpperCase();

    // ── POLYGON / LINESTRING ──────────────────────────────────────────────
    if (upper.startsWith('POLYGON') || upper.startsWith('LINESTRING')) {
      const inner = normalized
        .replace(/^[A-Za-z]+\s*\(\s*\(?\s*/, '')
        .replace(/\s*\)?\s*\)\s*$/, '');

      const coords = inner
        .split(',')
        .map((pair): [number, number] | null => {
          const parts = pair.trim().split(/\s+/);
          if (parts.length < 2) return null;
          const v0 = parseFloat(parts[0]);
          const v1 = parseFloat(parts[1]);
          if (isNaN(v0) || isNaN(v1)) return null;
          return resolveLatLng(v0, v1);
        })
        .filter((c): c is [number, number] => c !== null);

      if (coords.length < 3) return null;
      return { type: 'polygon', coordinates: coords };
    }

    // ── CIRCLE ──────────────────────────────────────────────────────────
    if (upper.startsWith('CIRCLE')) {
      // Formatos aceitos:
      //   CIRCLE ((lng lat), radius)
      //   CIRCLE ((lat lng), radius)
      //   CIRCLE (lng lat, radius)
      const inner = normalized
        .replace(/^CIRCLE\s*\(\s*\(?/i, '')
        .replace(/\)?\s*\)\s*$/, '');

      const parts = inner.split(',');
      if (parts.length < 2) return null;

      const coordParts = parts[0].trim().split(/\s+/);
      const v0 = parseFloat(coordParts[0]);
      const v1 = parseFloat(coordParts[1]);
      const radius = parseFloat(parts[parts.length - 1]);

      if (isNaN(v0) || isNaN(v1) || isNaN(radius)) return null;

      const center = resolveLatLng(v0, v1);
      return { type: 'circle', center, radius };
    }

    console.warn('[parseWKT] Formato WKT não reconhecido:', normalized.slice(0, 80));
  } catch (err) {
    console.warn('[parseWKT] Erro ao parsear WKT:', wkt?.slice(0, 80), err);
  }
  return null;
}
