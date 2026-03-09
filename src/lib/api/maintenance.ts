import { Maintenance } from "@/types";
import { api } from "./client";

function getImpersonatingUserId(): number | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/lib/stores/auth");
    const state = useAuthStore.getState();
    if (state.isImpersonating && state.user?.id) return state.user.id;
  } catch {}
  return undefined;
}

// Traccar /maintenance aceita: id, name, type ("totalDistance"|"hours"|"date"), start, period, attributes
interface TraccarMaintenance {
  id?: number;
  name: string;
  type: string;
  start: number;
  period: number;
  attributes: Record<string, unknown>;
}

function toTraccar(m: Partial<Maintenance>): TraccarMaintenance {
  const odometerVal = m.odometer || 0;
  const nextVal = m.nextOdometer || 0;
  return {
    ...(m.id !== undefined ? { id: m.id } : {}),
    name: m.description || "Manutenção",
    type: "totalDistance",
    start: odometerVal,
    period: nextVal > odometerVal ? nextVal - odometerVal : 10000,
    attributes: {
      deviceId: m.deviceId ?? 0,
      deviceName: m.deviceName ?? "",
      maintenanceType: m.type ?? "general_inspection",
      description: m.description ?? "",
      status: m.status ?? "scheduled",
      scheduledDate: m.scheduledDate ?? "",
      completedDate: m.completedDate,
      cost: m.cost ?? 0,
      odometer: odometerVal,
      nextOdometer: nextVal || undefined,
      notes: m.notes ?? "",
      createdAt: m.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function fromTraccar(raw: TraccarMaintenance & { id: number }): Maintenance {
  const a = raw.attributes ?? {};
  return {
    id: raw.id,
    deviceId: (a.deviceId as number) || 0,
    deviceName: (a.deviceName as string) || "",
    type: ((a.maintenanceType as string) || "general_inspection") as Maintenance["type"],
    description: raw.name || (a.description as string) || "",
    status: ((a.status as string) || "scheduled") as Maintenance["status"],
    scheduledDate: (a.scheduledDate as string) || "",
    completedDate: a.completedDate as string | undefined,
    cost: (a.cost as number) || 0,
    odometer: raw.start || (a.odometer as number) || 0,
    nextOdometer: raw.period ? raw.start + raw.period : (a.nextOdometer as number),
    notes: (a.notes as string) || "",
    createdAt: (a.createdAt as string) || new Date().toISOString(),
    updatedAt: (a.updatedAt as string) || new Date().toISOString(),
  };
}

/**
 * Detecta automaticamente manutenções atrasadas baseado na data agendada.
 */
function detectOverdue(m: Maintenance): Maintenance {
  if (m.status === "completed" || m.status === "in_progress") return m;
  if (!m.scheduledDate) return m;
  const scheduled = new Date(m.scheduledDate);
  if (isNaN(scheduled.getTime())) return m;
  if (scheduled < new Date() && m.status === "scheduled") {
    return { ...m, status: "overdue" };
  }
  return m;
}

export async function getMaintenances(): Promise<Maintenance[]> {
  const impersonatingUserId = getImpersonatingUserId();
  const params = impersonatingUserId ? { userId: impersonatingUserId } : undefined;
  try {
    const items = await api.get<(TraccarMaintenance & { id: number })[]>("/maintenance", params);
    return (items || []).map(fromTraccar).map(detectOverdue);
  } catch (error) {
    console.error("[getMaintenances] Erro:", error);
    return [];
  }
}

export async function getMaintenance(id: number): Promise<Maintenance> {
  const raw = await api.get<TraccarMaintenance & { id: number }>(`/maintenance/${id}`);
  return detectOverdue(fromTraccar(raw));
}

export async function createMaintenance(data: Partial<Maintenance>): Promise<Maintenance> {
  const payload = toTraccar(data);
  const result = await api.post<TraccarMaintenance & { id: number }>("/maintenance", payload);
  return fromTraccar(result);
}

export async function updateMaintenance(id: number, data: Partial<Maintenance>): Promise<Maintenance> {
  let currentAttributes: Record<string, unknown> = {};
  try {
    const current = await api.get<TraccarMaintenance & { id: number }>(`/maintenance/${id}`);
    currentAttributes = current?.attributes || {};
  } catch {}

  const merged: Partial<Maintenance> = {
    ...data,
    id,
    createdAt: (currentAttributes.createdAt as string) || new Date().toISOString(),
  };
  const payload = toTraccar(merged);
  // Preserva atributos existentes não mapeados
  payload.attributes = { ...currentAttributes, ...payload.attributes };
  const result = await api.put<TraccarMaintenance & { id: number }>(`/maintenance/${id}`, payload);
  return fromTraccar(result);
}

export async function deleteMaintenance(id: number): Promise<void> {
  await api.delete<void>(`/maintenance/${id}`);
}

/**
 * Vincula uma manutenção a um dispositivo via Traccar permissions.
 * POST /permissions { deviceId, maintenanceId }
 */
export async function linkMaintenanceToDevice(deviceId: number, maintenanceId: number): Promise<void> {
  await api.post<void>("/permissions", { deviceId, maintenanceId });
}

/**
 * Remove vínculo entre manutenção e dispositivo.
 * DELETE /permissions { deviceId, maintenanceId }
 */
export async function unlinkMaintenanceFromDevice(deviceId: number, maintenanceId: number): Promise<void> {
  await api.delete<void>("/permissions", { deviceId, maintenanceId });
}
