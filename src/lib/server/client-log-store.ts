import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export type ClientLogLevel = "error" | "warn"

export type ClientLogEntry = {
  id: string
  timestamp: string
  scope: string
  level: ClientLogLevel
  message: string
  details: unknown
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data")
const FILE_PATH = path.join(DATA_DIR, "client-logs.ndjson")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function appendClientLog(entry: Omit<ClientLogEntry, "id" | "timestamp">) {
  const stored: ClientLogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry,
  }

  await fs.promises.appendFile(FILE_PATH, JSON.stringify(stored) + "\n")
  return stored
}

export async function readClientLogs(limit = 100) {
  if (!fs.existsSync(FILE_PATH)) return [] as ClientLogEntry[]

  const raw = await fs.promises.readFile(FILE_PATH, "utf-8")
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const parsed = lines
    .map((line) => {
      try {
        return JSON.parse(line) as ClientLogEntry
      } catch {
        return null
      }
    })
    .filter(Boolean) as ClientLogEntry[]

  return parsed.slice(-limit).reverse()
}
