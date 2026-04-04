import { createServer } from "http"
import { Server } from "socket.io"
import crypto from "crypto"

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
})

const SECRET = process.env.SOCKET_SECRET || "dev-secret-change-me"

function computeToken(sessionId: string, expires: number) {
  return crypto.createHmac("sha256", SECRET).update(`${sessionId}:${expires}`).digest("hex")
}

function isValidTokenStateless(sessionId: string, token: string, expires: number) {
  if (Date.now() > expires) return false
  const expected = computeToken(sessionId, expires)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch (e) {
    return false
  }
}

function luhnCheckIMEI(imei: string) {
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

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id)

  socket.on("join-session", (payload: any) => {
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
    } catch (err) {
      socket.emit("session-error", { reason: "server-error" })
    }
  })

  socket.on("scan-data", (data: any) => {
    if (!data || !data.sessionId || !data.token || typeof data.expires !== "number") return

    if (!isValidTokenStateless(data.sessionId, data.token, data.expires)) {
      socket.emit("scan-error", { reason: "invalid-session" })
      return
    }

    const type = data.type
    const value = String(data.value || "")

    if (type === "imei") {
      if (!luhnCheckIMEI(value)) {
        socket.emit("scan-error", { reason: "invalid-imei" })
        return
      }
    }

    if (type === "iccid") {
      if (!/^[0-9]{19,20}$/.test(value)) {
        socket.emit("scan-error", { reason: "invalid-iccid" })
        return
      }
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
})
