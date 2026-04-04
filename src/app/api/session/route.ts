import { NextResponse } from "next/server"
import crypto from "crypto"

const SECRET = process.env.SOCKET_SECRET || "dev-secret-change-me"

function createToken(sessionId: string, expires: number) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${sessionId}:${expires}`)
    .digest("hex")
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const ttl = typeof body.ttl === "number" ? body.ttl : 120

    const sessionId = crypto.randomUUID()
    const expires = Date.now() + ttl * 1000
    const token = createToken(sessionId, expires)

    return NextResponse.json({ sessionId, token, expiresAt: expires })
  } catch (err) {
    return new Response("invalid", { status: 400 })
  }
}
