import fs from "fs";
import path from "path";
import type { SmtpConfig } from "@/lib/server/traccar-server";

interface CachedSmtpConfigFile {
  updatedAt: string;
  config: SmtpConfig;
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "smtp-config-cache.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readCachedSmtpConfig(): SmtpConfig | null {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CachedSmtpConfigFile>;
    if (!parsed?.config) {
      return null;
    }

    const config = parsed.config;
    if (!config.host || !config.username || !config.password || !config.from) {
      return null;
    }

    return {
      host: String(config.host).trim(),
      port: Number(config.port || 465),
      secure: Boolean(config.secure),
      requireTLS: Boolean(config.requireTLS),
      username: String(config.username).trim(),
      password: String(config.password).trim(),
      from: String(config.from).trim(),
    };
  } catch {
    return null;
  }
}

export function writeCachedSmtpConfig(config: SmtpConfig) {
  ensureDataDir();
  const payload: CachedSmtpConfigFile = {
    updatedAt: new Date().toISOString(),
    config,
  };

  fs.writeFileSync(FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
}