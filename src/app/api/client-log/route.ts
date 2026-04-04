import { NextResponse } from "next/server"
import { appendClientLog, readClientLogs } from "@/lib/server/client-log-store"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100
    const logs = await readClientLogs(limit)
    return NextResponse.json(logs)
  } catch (error) {
    console.error("[client-log] failed_to_read", error)
    return new Response("failed_to_read", { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const level = typeof body?.level === "string" ? body.level : "error"
    const scope = typeof body?.scope === "string" ? body.scope : "client"
    const message = typeof body?.message === "string" ? body.message : "Mensagem ausente"
    const details = body?.details ?? null

    const payload = {
      timestamp: new Date().toISOString(),
      scope,
      level,
      message,
      details,
    }

    if (level === "warn") {
      console.warn("[client-log]", payload)
    } else {
      console.error("[client-log]", payload)
    }

    await appendClientLog({
      scope,
      level: level === "warn" ? "warn" : "error",
      message,
      details,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[client-log] failed_to_process", error)
    return new Response("invalid_payload", { status: 400 })
  }
}
