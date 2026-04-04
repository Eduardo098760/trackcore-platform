import { NextResponse } from "next/server"
import { saveReading, queryReadings } from "../../../lib/server/sensorStore"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { vehicleId, sensorKey, value, timestamp } = body
    if (!vehicleId || !sensorKey || value === undefined) {
      return new Response("invalid", { status: 400 })
    }

    const reading = {
      vehicleId,
      sensorKey,
      value,
      timestamp: timestamp || new Date().toISOString(),
    }

    const stored = await saveReading(reading)
    return NextResponse.json(stored, { status: 201 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const vehicleId = url.searchParams.get("vehicleId") || undefined
    const sensorKey = url.searchParams.get("sensorKey") || undefined
    const from = url.searchParams.get("from") || undefined
    const to = url.searchParams.get("to") || undefined
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100

    const items = await queryReadings({ vehicleId, sensorKey, from, to, limit })
    return NextResponse.json(items)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
