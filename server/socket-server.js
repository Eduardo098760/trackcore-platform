const { createServer } = require("http")
const { Server } = require("socket.io")
const crypto = require("crypto")

const TRACCAR_EVENT_SYNC_INTERVAL_MS = 60_000
const TRACCAR_EVENT_LOOKBACK_MS = 10 * 60_000
let eventSyncInFlight = false

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
})

const SECRET = process.env.SOCKET_SECRET || "dev-secret-change-me"

function computeToken(sessionId, expires) {
  return crypto.createHmac("sha256", SECRET).update(`${sessionId}:${expires}`).digest("hex")
}

function isValidTokenStateless(sessionId, token, expires) {
  if (Date.now() > expires) return false
  const expected = computeToken(sessionId, expires)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}

function luhnCheckIMEI(imei) {
  if (!/^[0-9]{15}$/.test(imei)) return false
  const digits = imei.split("").map((d) => parseInt(d, 10))
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let val = digits[i]
    if (i % 2 === 1) {
      val = val * 2
      if (val > 9) val -= 9
    }
    sum += val
  }
  return sum % 10 === 0
}

function resolveAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

function resolveTraccarBaseUrl() {
  const configured = process.env.TRACCAR_BASE_URL || process.env.TRACCAR_URL || process.env.TRACCAR_API_URL || "http://localhost:8082/api"
  return configured.replace(/\/$/, "")
}

async function loginTraccarSession() {
  const email = process.env.TRACCAR_SERVICE_EMAIL || process.env.TRACCAR_EMAIL
  const password = process.env.TRACCAR_SERVICE_PASSWORD || process.env.TRACCAR_PASSWORD
  if (!email || !password) return null

  const response = await fetch(`${resolveTraccarBaseUrl()}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) return null
  const cookie = response.headers.get("set-cookie")
  return cookie ? cookie.split(";")[0] : null
}

function buildGeofenceSourceKey(event) {
  return ["geofence", event.id || "unknown", event.deviceId || "unknown", event.type || "unknown", event.serverTime || event.eventTime || "unknown"].join(":")
}

function toGeofencePayload(event) {
  if (event.type !== "geofenceEnter" && event.type !== "geofenceExit") return null
  return {
    id: event.id,
    type: event.type,
    deviceId: event.deviceId,
    positionId: event.positionId,
    serverTime: event.serverTime || event.eventTime || new Date().toISOString(),
    eventTime: event.eventTime,
    address: event.address,
    attributes: event.attributes,
    sourceKey: buildGeofenceSourceKey(event),
    traccarBase: resolveTraccarBaseUrl(),
  }
}

async function syncGeofenceEvents() {
  if (eventSyncInFlight) return
  eventSyncInFlight = true

  try {
    const sessionCookie = await loginTraccarSession()
    if (!sessionCookie) return

    const now = Date.now()
    const from = new Date(now - TRACCAR_EVENT_LOOKBACK_MS).toISOString()
    const to = new Date(now).toISOString()

    const response = await fetch(
      `${resolveTraccarBaseUrl()}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=allEvents`,
      {
        headers: {
          Accept: "application/json",
          Cookie: sessionCookie,
        },
      },
    )

    if (!response.ok) return

    const events = await response.json().catch(() => [])
    const geofenceEvents = events.map(toGeofencePayload).filter(Boolean)

    if (geofenceEvents.length === 0) return

    await fetch(`${resolveAppUrl()}/api/geofence-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: geofenceEvents,
        tenantKey: resolveTraccarBaseUrl(),
      }),
    })
  } catch {
    // best-effort
  } finally {
    eventSyncInFlight = false
  }
}

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id)

  socket.on("join-session", (payload) => {
    try {
      const { sessionId, token, expires } = payload || {}
      if (typeof sessionId !== "string" || typeof token !== "string" || typeof expires !== "number") {
        socket.emit("session-error", { reason: "invalid-payload" })
        return
      }

      if (!isValidTokenStateless(sessionId, token, expires)) {
        socket.emit("session-error", { reason: "invalid-or-expired-session" })
        return
      }

      socket.join(sessionId)
      socket.emit("session-joined", { sessionId })
    } catch {
      socket.emit("session-error", { reason: "server-error" })
    }
  })

  socket.on("scan-data", (data) => {
    if (!data || !data.sessionId || !data.token || typeof data.expires !== "number") return

    if (!isValidTokenStateless(data.sessionId, data.token, data.expires)) {
      socket.emit("scan-error", { reason: "invalid-session" })
      return
    }

    const type = data.type
    const value = String(data.value || "")

    if (type === "imei" && !luhnCheckIMEI(value)) {
      socket.emit("scan-error", { reason: "invalid-imei" })
      return
    }

    if (type === "iccid" && !/^[0-9]{19,20}$/.test(value)) {
      socket.emit("scan-error", { reason: "invalid-iccid" })
      return
    }

    io.to(data.sessionId).emit("scan-result", data)
  })

  socket.on("disconnect", () => {
    console.log("Cliente desconectado", socket.id)
  })
})

const PORT = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 3001

httpServer.listen(PORT, () => {
  console.log(`Socket server rodando na porta ${PORT}`)
  void syncGeofenceEvents()
  setInterval(() => {
    void syncGeofenceEvents()
  }, TRACCAR_EVENT_SYNC_INTERVAL_MS)
})
