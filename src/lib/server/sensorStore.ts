import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import type { SensorReadingStored, SensorReading } from "../../types/kpi"

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data")
const FILE_PATH = path.join(DATA_DIR, "sensor-readings.ndjson")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function saveReading(input: SensorReading) {
  const stored: SensorReadingStored = {
    id: uuidv4(),
    ...input,
  }

  await fs.promises.appendFile(FILE_PATH, JSON.stringify(stored) + "\n")
  return stored
}

export async function queryReadings(opts: {
  vehicleId?: string | number
  sensorKey?: string
  from?: string // ISO
  to?: string // ISO
  limit?: number
}) {
  const { vehicleId, sensorKey, from, to, limit = 100 } = opts

  if (!fs.existsSync(FILE_PATH)) return []

  const raw = await fs.promises.readFile(FILE_PATH, "utf-8")
  const lines = raw.split(/\r?\n/).filter(Boolean)

  const items = lines
    .map((l) => {
      try {
        return JSON.parse(l) as SensorReadingStored
      } catch (e) {
        return null
      }
    })
    .filter(Boolean) as SensorReadingStored[]

  const filtered = items.filter((it) => {
    if (vehicleId != null && String(it.vehicleId) !== String(vehicleId)) return false
    if (sensorKey && it.sensorKey !== sensorKey) return false
    if (from && new Date(it.timestamp) < new Date(from)) return false
    if (to && new Date(it.timestamp) > new Date(to)) return false
    return true
  })

  // ordena por timestamp desc
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return filtered.slice(0, limit)
}
