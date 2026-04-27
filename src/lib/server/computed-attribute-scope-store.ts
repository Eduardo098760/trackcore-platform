import fs from 'fs';
import path from 'path';

interface ComputedAttributeScopeBinding {
  attributeId: number;
  organizationId?: number;
  createdByUserId?: number;
  assignedUserIds?: number[];
  createdAt: string;
  updatedAt: string;
}

interface ComputedAttributeScopeStore {
  bindings: ComputedAttributeScopeBinding[];
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'computed-attribute-scopes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): ComputedAttributeScopeStore {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) {
    return { bindings: [] };
  }

  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const bindings = Array.isArray(parsed?.bindings) ? parsed.bindings : [];
    return { bindings };
  } catch {
    return { bindings: [] };
  }
}

function writeStore(data: ComputedAttributeScopeStore) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizeAssignedUserIds(userIds?: number[]) {
  if (!Array.isArray(userIds)) {
    return [];
  }

  return Array.from(
    new Set(
      userIds.filter((userId) => Number.isFinite(userId)).map((userId) => Number(userId)),
    ),
  );
}

export function listComputedAttributeBindings() {
  return readStore().bindings.map((binding) => ({
    ...binding,
    assignedUserIds: normalizeAssignedUserIds(binding.assignedUserIds),
  }));
}

export function getComputedAttributeBinding(attributeId: number) {
  return readStore().bindings.find((binding) => binding.attributeId === attributeId) || null;
}

export function upsertComputedAttributeBinding(input: {
  attributeId: number;
  organizationId?: number;
  createdByUserId?: number;
  assignedUserIds?: number[];
}) {
  const now = new Date().toISOString();
  const store = readStore();
  const index = store.bindings.findIndex((binding) => binding.attributeId === input.attributeId);
  const assignedUserIds = normalizeAssignedUserIds(input.assignedUserIds);

  if (index >= 0) {
    store.bindings[index] = {
      ...store.bindings[index],
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId ?? store.bindings[index].createdByUserId,
      assignedUserIds,
      updatedAt: now,
    };
  } else {
    store.bindings.push({
      attributeId: input.attributeId,
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      assignedUserIds,
      createdAt: now,
      updatedAt: now,
    });
  }

  writeStore(store);
  return getComputedAttributeBinding(input.attributeId);
}

export function deleteComputedAttributeBinding(attributeId: number) {
  const store = readStore();
  const nextBindings = store.bindings.filter((binding) => binding.attributeId !== attributeId);
  if (nextBindings.length === store.bindings.length) {
    return false;
  }

  writeStore({ bindings: nextBindings });
  return true;
}