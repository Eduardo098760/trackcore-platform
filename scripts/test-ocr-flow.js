const sharp = require("sharp")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const logPath = path.join(process.cwd(), ".tmp-ocr-flow.log")

function log(entry) {
  const line = JSON.stringify(entry)
  console.log(line)
  fs.appendFileSync(logPath, line + "\n")
}

async function main() {
  fs.writeFileSync(logPath, "")
  log({ stage: "start" })

  const sessionResponse = await fetch("http://localhost:3000/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })

  if (!sessionResponse.ok) {
    throw new Error("failed_to_create_session")
  }

  const { sessionId, token, expiresAt } = await sessionResponse.json()
  const expires = Number(expiresAt)
  const expected = crypto.createHmac("sha256", process.env.SOCKET_SECRET || "dev-secret-change-me").update(sessionId + ":" + expires).digest("hex")

  log({ stage: "token-check", matches: expected === token })

  const imei = "490154203237518"
  const svg = `
    <svg width="1400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="60" y="190" font-size="96" font-family="Arial, Helvetica, sans-serif" fill="black">${imei}</text>
    </svg>
  `

  log({ stage: "before-sharp" })
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  log({ stage: "after-sharp", bytes: buffer.length })
  const image = `data:image/png;base64,${buffer.toString("base64")}`

  log({ stage: "before-ocr-request", imageLength: image.length })
  const response = await fetch("http://localhost:3000/api/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, sessionId, token, expires }),
  })

  log({ stage: "after-ocr-response", status: response.status })
  const json = await response.json()
  log({ stage: "ocr-response", status: response.status, json })

  if (!response.ok || !json.ok) {
    process.exit(1)
  }
}

main().catch((error) => {
  log({ stage: "unexpected-error", error: error.message, stack: error.stack })
  process.exit(1)
})
