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
}

export async function getComputedAttributes(): Promise<TraccarComputedAttribute[]> {
  return api.get<TraccarComputedAttribute[]>('/attributes/computed');
}

export async function createComputedAttribute(
  data: Omit<TraccarComputedAttribute, 'id'>,
): Promise<TraccarComputedAttribute> {
  return api.post<TraccarComputedAttribute>('/attributes/computed', data);
}

export async function updateComputedAttribute(
  id: number,
  data: TraccarComputedAttribute,
): Promise<TraccarComputedAttribute> {
  return api.put<TraccarComputedAttribute>(`/attributes/computed/${id}`, data);
}

export async function deleteComputedAttribute(id: number): Promise<void> {
  return api.delete<void>(`/attributes/computed/${id}`);
}
