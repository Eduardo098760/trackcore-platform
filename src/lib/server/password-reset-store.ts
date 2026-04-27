import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface PasswordResetRecord {
  token: string;
  userId: number;
  name: string;
  email: string;
  traccarBase: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "password-reset-tokens.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): PasswordResetRecord[] {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) return [];

  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PasswordResetRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore(records: PasswordResetRecord[]) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

function cleanup(records: PasswordResetRecord[]) {
  const now = Date.now();
  return records.filter((record) => record.expiresAt > now && !record.consumedAt);
}

export function createPasswordResetRecord(data: Omit<PasswordResetRecord, "token" | "createdAt">) {
  const records = cleanup(readStore());
  const nextRecord: PasswordResetRecord = {
    token: crypto.randomBytes(24).toString("base64url"),
    createdAt: Date.now(),
    ...data,
  };

  writeStore([...records.filter((record) => record.userId !== data.userId), nextRecord]);
  return nextRecord;
}

export function getPasswordResetRecord(token: string) {
  const records = cleanup(readStore());
  writeStore(records);
  return records.find((record) => record.token === token) || null;
}

export function consumePasswordResetRecord(token: string) {
  const records = readStore();
  const index = records.findIndex((record) => record.token === token);
  if (index < 0) return false;

  records[index] = {
    ...records[index],
    consumedAt: Date.now(),
  };
  writeStore(records);
  return true;
}