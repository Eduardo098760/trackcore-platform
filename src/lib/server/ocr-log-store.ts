import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export type OCRLogEntry = {
  id: string
  sessionId: string
  timestamp: string
  status: "success" | "rejected" | "error"
  type?: string
  value?: string
  ocrConfidence?: number
  digits?: number
  reason?: string
  rawText?: string
}

const DATA_DIR = process.env.SENSOR_DATA_DIR || path.join(process.cwd(), "data")
const FILE_PATH = path.join(DATA_DIR, "ocr-attempts.ndjson")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function appendOCRLog(entry: Omit<OCRLogEntry, "id" | "timestamp">) {
  const stored: OCRLogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry,
  }

  await fs.promises.appendFile(FILE_PATH, JSON.stringify(stored) + "\n")
  return stored
}
