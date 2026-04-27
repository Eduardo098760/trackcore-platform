import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface AccessInviteRecord {
  inviteId: string;
  userId: number;
  name: string;
  email: string;
  tempPassword: string;
  traccarBase: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "access-invites.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): AccessInviteRecord[] {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) return [];

  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AccessInviteRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: AccessInviteRecord[]) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

function cleanup(items: AccessInviteRecord[]) {
  const now = Date.now();
  return items.filter((item) => item.expiresAt > now && !item.consumedAt);
}

export function createAccessInvite(data: Omit<AccessInviteRecord, "inviteId" | "createdAt">) {
  const items = cleanup(readStore());
  const invite: AccessInviteRecord = {
    inviteId: crypto.randomBytes(5).toString("base64url"),
    createdAt: Date.now(),
    ...data,
  };

  const nextItems = items.filter((item) => item.userId !== invite.userId);
  nextItems.push(invite);
  writeStore(nextItems);
  return invite;
}

export function getAccessInvite(inviteId: string) {
  const items = cleanup(readStore());
  writeStore(items);
  return items.find((item) => item.inviteId === inviteId) || null;
}

export function consumeAccessInvite(inviteId: string) {
  const items = readStore();
  const index = items.findIndex((item) => item.inviteId === inviteId);
  if (index < 0) return false;

  items[index] = {
    ...items[index],
    consumedAt: Date.now(),
  };

  writeStore(items);
  return true;
}