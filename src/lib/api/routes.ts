import type { PlannedRoute, PlannedRouteWaypoint } from '@/types';

const BASE = '/api/routes';

export async function getPlannedRoutes(): Promise<PlannedRoute[]> {
  const res = await fetch(BASE, { credentials: 'include' });
  if (!res.ok) throw new Error('Falha ao listar rotas planejadas');
  return res.json();
}

export async function getPlannedRouteById(id: string): Promise<PlannedRoute> {
  const res = await fetch(`${BASE}/${id}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Rota não encontrada');
    throw new Error('Falha ao buscar rota');
  }
  return res.json();
}

export async function createPlannedRoute(data: {
  name: string;
  deviceId: number;
  waypoints: PlannedRouteWaypoint[];
}): Promise<PlannedRoute> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao criar rota');
  }
  return res.json();
}

export async function updatePlannedRoute(
  id: string,
  data: { name?: string; deviceId?: number; waypoints?: PlannedRouteWaypoint[] }
): Promise<PlannedRoute> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Rota não encontrada');
    throw new Error('Falha ao atualizar rota');
  }
  return res.json();
}

export async function deletePlannedRoute(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Rota não encontrada');
    throw new Error('Falha ao excluir rota');
  }
}

/**
 * Obtém a geometria da rota (snapped to roads) entre waypoints via OSRM.
 * Retorna array de [lat, lng] para desenhar no mapa.
 */
export async function getRouteGeometry(waypoints: PlannedRouteWaypoint[]): Promise<[number, number][]> {
  if (waypoints.length < 2) return waypoints.map((w) => [w.lat, w.lng]);
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return waypoints.map((w) => [w.lat, w.lng]);
  const data = await res.json();
  if (!data.routes?.[0]?.geometry?.coordinates?.length) return waypoints.map((w) => [w.lat, w.lng]);
  return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
}
