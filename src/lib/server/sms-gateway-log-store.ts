import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import type { SmsProviderResponse } from "@/types"

export type SmsGatewayLogEntry = {
  id: string
  timestamp: string
  provider: string
  phone: string
  message: string
  response: SmsProviderResponse
  rawResponse?: unknown
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data")
const FILE_PATH = path.join(DATA_DIR, "sms-gateway.ndjson")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

export async function appendSmsGatewayLog(entry: Omit<SmsGatewayLogEntry, "id" | "timestamp" | "phone"> & { phone: string }) {
  const stored: SmsGatewayLogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry,
    phone: normalizePhone(entry.phone),
  }

  await fs.promises.appendFile(FILE_PATH, JSON.stringify(stored) + "\n")
  return stored
}

export async function getLatestSmsGatewayLogByPhone(phone: string, maxAgeMs = 20000) {
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone || !fs.existsSync(FILE_PATH)) {
    return null
  }

  const content = await fs.promises.readFile(FILE_PATH, "utf8")
  const now = Date.now()
  const lines = content.split(/\r?\n/).filter(Boolean)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const entry = JSON.parse(lines[index]) as SmsGatewayLogEntry
      if (entry.phone !== normalizedPhone) {
        continue
      }
      if (now - new Date(entry.timestamp).getTime() > maxAgeMs) {
        continue
      }
      return entry
    } catch {
      // ignore malformed lines
    }
  }

  return null
}