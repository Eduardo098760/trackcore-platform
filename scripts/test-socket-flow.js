const { io } = require("socket.io-client")
const crypto = require("crypto")

const expectedSecret = process.argv[2] || process.env.SOCKET_SECRET || "dev-secret-change-me"

async function main() {
  const response = await fetch("http://localhost:3000/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    console.error(JSON.stringify({ stage: "session-request-failed", status: response.status }))
    process.exit(1)
  }

  const { sessionId, token, expiresAt } = await response.json()
  const expires = Number(expiresAt)

  const expected = crypto.createHmac("sha256", expectedSecret).update(sessionId + ":" + expires).digest("hex")
  console.log(JSON.stringify({ stage: "token-check", matches: expected === token }))

  const desktop = io("http://localhost:3001", { transports: ["websocket"] })
  const scanner = io("http://localhost:3001", { transports: ["websocket"] })

  let joined = false
  let received = false

  desktop.on("connect", () => {
    console.log(JSON.stringify({ stage: "desktop-connect" }))
    desktop.emit("join-session", { sessionId, token, expires })
  })

  desktop.on("session-joined", (data) => {
    joined = true
    console.log(JSON.stringify({ stage: "session-joined", data }))
    if (scanner.connected) {
      scanner.emit("scan-data", { sessionId, token, expires, type: "imei", value: "490154203237518" })
    }
  })

  desktop.on("session-error", (error) => {
    console.error(JSON.stringify({ stage: "session-error", error }))
    process.exit(1)
  })

  desktop.on("scan-result", (data) => {
    received = true
    console.log(JSON.stringify({ stage: "scan-result", data }))
    desktop.disconnect()
    scanner.disconnect()
    process.exit(0)
  })

  desktop.on("scan-error", (error) => {
    console.error(JSON.stringify({ stage: "scan-error", error }))
    process.exit(1)
  })

  scanner.on("connect", () => {
    console.log(JSON.stringify({ stage: "scanner-connect" }))
    if (joined) {
      scanner.emit("scan-data", { sessionId, token, expires, type: "imei", value: "490154203237518" })
    }
  })

  setTimeout(() => {
    if (!received) {
      console.error(JSON.stringify({ stage: "timeout", joined, received }))
      desktop.disconnect()
      scanner.disconnect()
      process.exit(1)
    }
  }, 5000)
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "unexpected-error", error: error.message }))
  process.exit(1)
})
