import type { PlannedRoute } from '@/types';

const store: PlannedRoute[] = [];

function generateId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getAllPlannedRoutes(): PlannedRoute[] {
  return [...store];
}

export function getPlannedRouteById(id: string): PlannedRoute | undefined {
  return store.find((r) => r.id === id);
}

export function createPlannedRoute(data: Omit<PlannedRoute, 'id' | 'createdAt' | 'updatedAt'>): PlannedRoute {
  const now = new Date().toISOString();
  const route: PlannedRoute = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  store.push(route);
  return route;
}

export function updatePlannedRoute(id: string, data: Partial<Omit<PlannedRoute, 'id' | 'createdAt'>>): PlannedRoute | null {
  const index = store.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated: PlannedRoute = {
    ...store[index],
    ...data,
    id: store[index].id,
    createdAt: store[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  store[index] = updated;
  return updated;
}

export function deletePlannedRoute(id: string): boolean {
  const index = store.findIndex((r) => r.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  return true;
}
