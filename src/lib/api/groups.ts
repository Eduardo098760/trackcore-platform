/**
 * API de Grupos via Traccar real.
 *
 * GET    /groups         – listar
 * POST   /groups         – criar
 * PUT    /groups/{id}    – atualizar
 * DELETE /groups/{id}    – remover
 *
 * Grupos suportam hierarquia via campo `groupId` (parent group).
 */
import { api } from './client';

export interface TraccarGroup {
  id: number;
  name: string;
  groupId?: number;         // parent group ID (0 ou undefined = raiz)
  attributes?: Record<string, any>;
}

export async function getGroups(): Promise<TraccarGroup[]> {
  return api.get<TraccarGroup[]>('/groups');
}

export async function createGroup(
  data: Omit<TraccarGroup, 'id'>,
): Promise<TraccarGroup> {
  return api.post<TraccarGroup>('/groups', data);
}

export async function updateGroup(
  id: number,
  data: TraccarGroup,
): Promise<TraccarGroup> {
  return api.put<TraccarGroup>(`/groups/${id}`, data);
}

export async function deleteGroup(id: number): Promise<void> {
  return api.delete<void>(`/groups/${id}`);
}
