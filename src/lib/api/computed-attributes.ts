/**
 * API de Atributos Computados via Traccar real.
 *
 * GET    /attributes/computed         – listar
 * POST   /attributes/computed         – criar
 * PUT    /attributes/computed/{id}    – atualizar
 * DELETE /attributes/computed/{id}    – remover
 */
import { api } from './client';

export interface TraccarComputedAttribute {
  id: number;
  description: string;    // nome/descrição do atributo
  attribute: string;       // nome do atributo resultante (ex: "fuelConsumption")
  expression: string;      // expressão de cálculo
  type: 'string' | 'number' | 'boolean';
  organizationId?: number;
  createdByUserId?: number;
  assignedUserIds?: number[];
}

export async function getComputedAttributes(): Promise<TraccarComputedAttribute[]> {
  const response = await fetch('/api/computed-attributes', {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Falha ao carregar atributos computados');
  }

  return await response.json();
}

export async function createComputedAttribute(
  data: Omit<TraccarComputedAttribute, 'id'>,
): Promise<TraccarComputedAttribute> {
  const response = await fetch('/api/computed-attributes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Falha ao criar atributo computado');
  }

  return await response.json();
}

export async function updateComputedAttribute(
  id: number,
  data: TraccarComputedAttribute,
): Promise<TraccarComputedAttribute> {
  const response = await fetch(`/api/computed-attributes/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Falha ao atualizar atributo computado');
  }

  return await response.json();
}

export async function deleteComputedAttribute(id: number): Promise<void> {
  const response = await fetch(`/api/computed-attributes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Falha ao excluir atributo computado');
  }
}
