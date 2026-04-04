import { NextResponse } from "next/server"
import sharp from "sharp"
import { createWorker, PSM } from "tesseract.js"
import crypto from "crypto"
import { appendOCRLog } from "@/lib/server/ocr-log-store"

const SECRET = process.env.SOCKET_SECRET || "dev-secret-change-me"
const OCR_CHAR_WHITELIST = "0123456789"
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY || ""

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null
let workerQueue: Promise<void> = Promise.resolve()

function computeToken(sessionId: string, expires: number) {
  return crypto.createHmac("sha256", SECRET).update(`${sessionId}:${expires}`).digest("hex")
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, { logger: () => {} }).then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: OCR_CHAR_WHITELIST,
        classify_bln_numeric_mode: 1,
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        preserve_interword_spaces: "0",
      })
      return worker
    })
  }

  return workerPromise
}

async function recognizeDigits(image: Buffer, expectedType?: "imei" | "iccid") {
  const run = workerQueue.then(async () => {
    const worker = await getWorker()
    const result = await worker.recognize(image)
    return result
  })

  workerQueue = run.then(() => undefined, () => undefined)
  return run
}

function extractVisionConfidence(annotation: any) {
  const pages = annotation?.pages
  if (!Array.isArray(pages)) {
    return 0
  }

  const values: number[] = []
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (typeof block.confidence === "number") values.push(block.confidence * 100)
      for (const paragraph of block.paragraphs || []) {
        if (typeof paragraph.confidence === "number") values.push(paragraph.confidence * 100)
        for (const word of paragraph.words || []) {
          if (typeof word.confidence === "number") values.push(word.confidence * 100)
          for (const symbol of word.symbols || []) {
            if (typeof symbol.confidence === "number") values.push(symbol.confidence * 100)
          }
        }
      }
    }
  }

  if (!values.length) {
    return 85
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

async function recognizeWithGoogleVision(image: Buffer) {
  if (!GOOGLE_VISION_API_KEY) {
    return null
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(GOOGLE_VISION_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: image.toString("base64") },
          features: [
            { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
            { type: "TEXT_DETECTION", maxResults: 1 },
          ],
          imageContext: {
            languageHints: ["en"],
          },
        },
      ],
    }),
  })

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.responses?.[0] || json.responses[0].error) {
    throw new Error(json?.responses?.[0]?.error?.message || "google_vision_failed")
  }

  const visionResponse = json.responses[0]
  const rawText =
    visionResponse.fullTextAnnotation?.text ||
    visionResponse.textAnnotations?.[0]?.description ||
    ""

  return {
    text: rawText,
    confidence: extractVisionConfidence(visionResponse.fullTextAnnotation),
  }
}

function getNumericCandidates(text: string) {
  const parts: string[] = text.match(/\d+/g) || []
  const clean = text.replace(/\D/g, "")

  if (clean) {
    parts.push(clean)
  }

  return parts.filter(Boolean)
}

function selectCandidate(text: string, expectedType?: "imei" | "iccid") {
  const candidates = getNumericCandidates(text)

  if (expectedType === "imei") {
    for (const candidate of candidates) {
      if (candidate.length === 15) return candidate
      if (candidate.length > 15) {
        for (let index = 0; index <= candidate.length - 15; index += 1) {
          const window = candidate.slice(index, index + 15)
          if (window.length === 15) return window
        }
      }
    }
  }

  if (expectedType === "iccid") {
    for (const candidate of candidates) {
      if (candidate.length === 19 || candidate.length === 20) return candidate
      if (candidate.length > 20) {
        for (let size = 20; size >= 19; size -= 1) {
          for (let index = 0; index <= candidate.length - size; index += 1) {
            const window = candidate.slice(index, index + size)
            if (window.length === size) return window
          }
        }
      }
    }
  }

  return candidates.sort((left, right) => right.length - left.length)[0] || ""
}

function getCropRegion(width?: number | null, height?: number | null) {
  const safeWidth = Math.max(1, width ?? 720)
  const safeHeight = Math.max(1, height ?? 360)

  return {
    left: Math.max(0, Math.round(safeWidth * 0.08)),
    top: Math.max(0, Math.round(safeHeight * 0.46)),
    width: Math.max(1, Math.round(safeWidth * 0.84)),
    height: Math.max(1, Math.round(safeHeight * 0.22)),
  }
}

async function parseOCRRequest(req: Request) {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const imageFile = form.get("image")
    const sessionId = form.get("sessionId")
    const token = form.get("token")
    const expires = form.get("expires")
    const expectedType = form.get("expectedType")

    if (!(imageFile instanceof File)) {
      return null
    }

    return {
      buffer: Buffer.from(await imageFile.arrayBuffer()),
      sessionId: typeof sessionId === "string" ? sessionId : null,
      token: typeof token === "string" ? token : null,
      expires: typeof expires === "string" ? Number(expires) : NaN,
      expectedType: expectedType === "imei" || expectedType === "iccid" ? expectedType : undefined,
    }
  }

  const body = await req.json()
  const { image, sessionId, token, expires, expectedType } = body || {}

  if (typeof image !== "string") {
    return {
      buffer: null,
      sessionId,
      token,
      expires,
      expectedType,
    }
  }

  let buffer: Buffer
  if (image.startsWith("data:")) {
    const parts = image.split(",")
    buffer = Buffer.from(parts[1], "base64")
  } else {
    buffer = Buffer.from(image, "base64")
  }

  return {
    buffer,
    sessionId,
    token,
    expires,
    expectedType,
  }
}

export async function POST(req: Request) {
  try {
    const payload = await parseOCRRequest(req)
    const { buffer, sessionId, token, expires, expectedType } = payload || {}

    if (!buffer || !sessionId || !token || typeof expires !== "number" || Number.isNaN(expires)) {
      return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 })
    }

    // validate token stateless
    const expected = computeToken(sessionId, expires)
    try {
      if (Date.now() > expires) {
        return NextResponse.json({ ok: false, reason: "expired" }, { status: 403 })
      }
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
        return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 403 })
      }
    } catch (e) {
      return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 403 })
    }

    const rotated = sharp(buffer).rotate()
    const metadata = await rotated.metadata()
    const crop = getCropRegion(metadata.width, metadata.height)

    const fullVisionBuffer = await rotated
      .clone()
      .resize(1400, null, { withoutEnlargement: true, fit: "inside" })
      .normalize()
      .sharpen()
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()

    const cropVisionBuffer = await rotated
      .clone()
      .extract(crop)
      .resize(1000, null, { withoutEnlargement: true, fit: "inside" })
      .normalize()
      .sharpen()
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()

    // preprocess for local fallback OCR
    const pre = await rotated
      .clone()
      .extract(crop)
      .resize(720, null, { withoutEnlargement: true, fit: "inside" })
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(170)
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer()

    let text = ""
    let avgConf = 0

    try {
      const fullVision = await recognizeWithGoogleVision(fullVisionBuffer)
      const cropVision = text ? null : await recognizeWithGoogleVision(cropVisionBuffer)
      const chosenVision = fullVision?.text?.trim() ? fullVision : cropVision

      if (chosenVision) {
        text = chosenVision.text || ""
        avgConf = typeof chosenVision.confidence === "number" ? chosenVision.confidence : 85
      } else {
        const { data } = await recognizeDigits(
          pre,
          expectedType === "imei" || expectedType === "iccid" ? expectedType : undefined
        )
        text = data?.text || ""
        avgConf = typeof data?.confidence === "number" ? data.confidence : 0
      }
    } catch (visionError) {
      const { data } = await recognizeDigits(
        pre,
        expectedType === "imei" || expectedType === "iccid" ? expectedType : undefined
      )
      text = data?.text || ""
      avgConf = typeof data?.confidence === "number" ? data.confidence : 0
    }

    const clean = selectCandidate(text, expectedType === "imei" || expectedType === "iccid" ? expectedType : undefined)

    const MIN_CONF = expectedType ? 35 : 60
    const minDigits = expectedType === "iccid" ? 19 : 15

    if (clean.length < minDigits || avgConf < MIN_CONF) {
      await appendOCRLog({
        sessionId,
        status: "rejected",
        ocrConfidence: avgConf,
        digits: clean.length,
        reason: "ocr_low_confidence",
        rawText: text,
      })
      return NextResponse.json({ ok: false, reason: "ocr_low_confidence", ocrConfidence: avgConf, digits: clean.length })
    }

    let type = "unknown"
    if (expectedType === "imei" || expectedType === "iccid") {
      type = expectedType
    } else if (clean.length === 15) {
      type = "imei"
    } else if (clean.length >= 19) {
      type = "iccid"
    }

    await appendOCRLog({
      sessionId,
      status: "success",
      type,
      value: clean,
      ocrConfidence: avgConf,
      digits: clean.length,
      rawText: text,
    })

    return NextResponse.json({ ok: true, type, value: clean, ocrConfidence: avgConf })
  } catch (err) {
    console.error(err)
    if (typeof err === "object" && err && "message" in err) {
      await appendOCRLog({
        sessionId: "unknown",
        status: "error",
        reason: String((err as Error).message),
      })
    }
    return NextResponse.json(
      {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
