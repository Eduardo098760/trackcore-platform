"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { socket } from "@/lib/socket"

type ScanStep = "imei" | "iccid" | "done"

type OCRResponse = {
  ok?: boolean
  reason?: string
  type?: string
  value?: string
  ocrConfidence?: number
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.76) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("blob_creation_failed"))
          return
        }

        resolve(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

async function optimizeImageBlob(file: Blob, maxWidth = 960, quality = 0.76) {
  const objectUrl = URL.createObjectURL(file)

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image_load_failed"))
    img.src = objectUrl
  })

  const scale = Math.min(1, maxWidth / image.width)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const sourceCanvas = document.createElement("canvas")
  sourceCanvas.width = width
  sourceCanvas.height = height

  const sourceContext = sourceCanvas.getContext("2d")
  if (!sourceContext) {
    URL.revokeObjectURL(objectUrl)
    return file
  }

  sourceContext.drawImage(image, 0, 0, width, height)

  const cropLeft = Math.round(width * 0.08)
  const cropTop = Math.round(height * 0.46)
  const cropWidth = Math.max(1, Math.round(width * 0.84))
  const cropHeight = Math.max(1, Math.round(height * 0.22))

  const targetCanvas = document.createElement("canvas")
  targetCanvas.width = cropWidth
  targetCanvas.height = cropHeight

  const targetContext = targetCanvas.getContext("2d")
  if (!targetContext) {
    URL.revokeObjectURL(objectUrl)
    return canvasToBlob(sourceCanvas, quality)
  }

  targetContext.drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  )

  URL.revokeObjectURL(objectUrl)
  return canvasToBlob(targetCanvas, quality)
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div>Carregando scanner...</div>}>
      <ScanPageContent />
    </Suspense>
  )
}

function ScanPageContent() {
  const params = useSearchParams()
  const sessionId = params?.get("session") || null
  const token = params?.get("token") || null
  const expiresParam = params?.get("expires") || null
  const expires = expiresParam ? Number(expiresParam) : undefined

  const [mode, setMode] = useState<"manual" | "qr" | "camera">("camera")
  const [qrStatus, setQrStatus] = useState<string | null>(null)
  const [cameraStatus, setCameraStatus] = useState<string | null>(null)
  const [manualStatus, setManualStatus] = useState<string | null>(null)
  const [manualValue, setManualValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ type: string; value: string; confidence?: number } | null>(null)
  const [completedSteps, setCompletedSteps] = useState({ imei: false, iccid: false })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerRunningRef = useRef(false)
  const previewUrlRef = useRef<string | null>(null)

  const currentStep: ScanStep = !completedSteps.imei ? "imei" : !completedSteps.iccid ? "iccid" : "done"

  const stepContent =
    currentStep === "imei"
      ? {
          badge: "Passo 1",
          title: "Escanear o dispositivo",
          description: "Fotografe a linha numerica abaixo do codigo de barras para capturar o IMEI.",
          button: "Fotografar IMEI do dispositivo",
          helper: "Centralize o numero abaixo do codigo de barras. Nao tente pegar a etiqueta inteira.",
        }
      : currentStep === "iccid"
        ? {
            badge: "Passo 2",
            title: "Escanear o chip",
            description: "Fotografe a linha numerica abaixo do codigo de barras do chip para capturar o ICCID.",
            button: "Fotografar ICCID do chip",
            helper: "Centralize o numero abaixo do codigo de barras. Nao tente pegar o chip inteiro.",
          }
        : {
            badge: "Concluido",
            title: "Leitura finalizada",
            description: "IMEI e ICCID ja foram enviados para o cadastro do veiculo.",
            button: "Refazer leitura",
            helper: "Se algum dado ficou incorreto, voce pode repetir a captura.",
          }

  const closeCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const updatePreviewImage = (url: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    previewUrlRef.current = url
    setPreviewImage(url)
  }

  const isExpectedQrFallback = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    const normalized = message.toLowerCase()
    return (
      normalized.includes("camera streaming not supported") ||
      normalized.includes("not supported by the browser") ||
      normalized.includes("getusermedia") ||
      normalized.includes("insecure")
    )
  }

  const stopQrScanner = async () => {
    const scanner = scannerRef.current
    if (!scanner || !scannerRunningRef.current) {
      return
    }

    try {
      await scanner.stop()
    } catch {
      // ignore cleanup failures from the QR library
    } finally {
      scannerRunningRef.current = false
      scannerRef.current = null
    }
  }

  const reportClientLog = async (
    level: "error" | "warn",
    message: string,
    details?: Record<string, unknown>
  ) => {
    try {
      await fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          scope: "scan-page",
          message,
          details: {
            sessionId,
            hasToken: Boolean(token),
            expires,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
            ...details,
          },
        }),
      })
    } catch {
      // evita loop de falha de log
    }
  }

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      void reportClientLog("error", "window_error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      void reportClientLog("error", "unhandled_rejection", {
        reason: typeof event.reason === "string" ? event.reason : JSON.stringify(event.reason),
      })
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [expires, sessionId, token])

  useEffect(() => {
    if (mode === "qr") {
      if (!sessionId || !token || !expires) return

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setQrStatus("Leitura por QR ao vivo indisponivel neste navegador. Use a captura por foto abaixo.")
        void reportClientLog("warn", "qr_scanner_unavailable_precheck", {
          isSecureContext: window.isSecureContext,
          hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        })
        setMode("camera")
        return
      }

      const scanner = new Html5Qrcode("reader")
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10 },
          (decodedText: string) => {
            const clean = decodedText.replace(/\D/g, "")

            let type = "unknown"
            if (clean.length === 15) type = "imei"
            if (clean.length >= 19) type = "iccid"

            socket.emit("scan-data", {
              sessionId,
              token,
              expires,
              type,
              value: clean,
            })

            setQrStatus("QR lido e enviado com sucesso.")
            navigator.vibrate?.(200)
          },
          () => {}
        )
        .then(() => {
          scannerRunningRef.current = true
          setQrStatus("Aponte a camera para o QR code.")
          void reportClientLog("warn", "qr_scanner_started", { mode: "qr" })
        })
        .catch((error) => {
          scannerRunningRef.current = false
          scannerRef.current = null

          if (isExpectedQrFallback(error)) {
            void reportClientLog("warn", "qr_scanner_fallback_to_photo", {
              error: error instanceof Error ? error.message : String(error),
            })
          } else {
            console.error("qr scanner error", error)
            void reportClientLog("error", "qr_scanner_start_failed", {
              error: error instanceof Error ? error.message : String(error),
            })
          }

          setQrStatus("Streaming da camera nao suportado neste navegador. Use a captura por foto abaixo.")
          setMode("camera")
        })

      return () => {
        void stopQrScanner()
      }
    }
  }, [mode, sessionId, token, expires])

  useEffect(() => {
    return () => {
      // cleanup camera stream on unmount
      closeCameraStream()
      updatePreviewImage(null)
      void stopQrScanner()
    }
  }, [])

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Streaming de camera nao suportado. Use 'Selecionar ou tirar foto'.")
      void reportClientLog("warn", "camera_stream_not_supported")
      fileInputRef.current?.click()
      return
    }

    if (!videoRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraStatus("Camera pronta para captura.")
      void reportClientLog("warn", "camera_stream_started")
    } catch (err) {
      console.error("camera error", err)
      setCameraStatus("Nao foi possivel acessar a camera.")
      void reportClientLog("error", "camera_stream_failed", {
        error: err instanceof Error ? err.message : String(err),
      })
      fileInputRef.current?.click()
    }
  }

  const openCameraMode = () => {
    setMode("camera")
    updatePreviewImage(null)
    setLastResult(null)
    setQrStatus(null)
    setManualStatus(null)
    setTimeout(() => {
      void startCamera()
    }, 0)
  }

  const sendManualValue = () => {
    if (!sessionId || !token || !expires || currentStep === "done") {
      return
    }

    const cleanValue = manualValue.replace(/\D/g, "")
    const expectedLength = currentStep === "imei" ? 15 : undefined
    const validIccid = currentStep === "iccid" ? /^[0-9]{19,20}$/.test(cleanValue) : true

    if (currentStep === "imei" && cleanValue.length !== expectedLength) {
      setManualStatus("Informe os 15 digitos do IMEI para enviar.")
      return
    }

    if (!validIccid) {
      setManualStatus("Informe os 19 ou 20 digitos do ICCID para enviar.")
      return
    }

    socket.emit("scan-data", {
      sessionId,
      token,
      expires,
      type: currentStep,
      value: cleanValue,
    })

    setLastResult({ type: currentStep, value: cleanValue, confidence: 100 })
    setCompletedSteps((prev) => ({ ...prev, [currentStep]: true }))
    setManualStatus(`${currentStep.toUpperCase()} enviado com sucesso.`)
    setManualValue("")
    updatePreviewImage(null)
  }

  const processImageFile = async (file: Blob) => {
    if (!sessionId || !token || !expires) return

    try {
      setIsSending(true)
      setLastResult(null)
      setCameraStatus("Preparando imagem...")
      const optimizedBlob = await optimizeImageBlob(file)
      const imageFile = new File([optimizedBlob], `${currentStep || "scan"}.jpg`, {
        type: optimizedBlob.type || "image/jpeg",
      })
      updatePreviewImage(URL.createObjectURL(imageFile))
      setCameraStatus("Enviando imagem para analise...")
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("sessionId", sessionId)
      formData.append("token", token)
      formData.append("expires", String(expires))
      if (currentStep === "imei" || currentStep === "iccid") {
        formData.append("expectedType", currentStep)
      }

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      })

      const raw = await res.text()
      let json: OCRResponse | null = null

      try {
        json = raw ? (JSON.parse(raw) as OCRResponse) : null
      } catch {
        json = null
      }

      const isSuccess = json?.ok === true

      if (!res.ok || !isSuccess) {
        setCameraStatus("Imagem rejeitada pela analise OCR.")
        void reportClientLog("warn", "ocr_rejected", {
          reason: json?.reason || raw || "failed",
          responseStatus: res.status,
        })
        alert(`OCR server: ${json?.reason || raw || "failed"}`)
        return
      }

      setCameraStatus("Dados validados. Envio concluido para preenchimento automatico.")
      const resultType = json?.type || "unknown"
      const resultValue = json?.value || ""
      const resultConfidence = typeof json?.ocrConfidence === "number" ? json.ocrConfidence : 0

      socket.emit("scan-data", {
        sessionId,
        token,
        expires,
        type: resultType,
        value: resultValue,
        ocrConfidence: resultConfidence,
      })

      setLastResult({ type: resultType, value: resultValue, confidence: resultConfidence })
      if (resultType === "imei" || resultType === "iccid") {
        setCompletedSteps((prev) => ({ ...prev, [resultType]: true }))
      }
      void reportClientLog("warn", "ocr_success", {
        type: resultType,
        confidence: resultConfidence,
      })
    } catch (e) {
      console.error("ocr upload failed", e)
      setCameraStatus("Falha no envio da imagem para OCR.")
      void reportClientLog("error", "ocr_upload_failed", {
        error: e instanceof Error ? e.message : String(e),
      })
      alert("Falha ao enviar imagem para OCR. Tente novamente.")
    } finally {
      setIsSending(false)
    }
  }

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await processImageFile(file)
    event.target.value = ""
  }

  const captureAndSend = async () => {
    if (!videoRef.current || !sessionId || !token || !expires) return

    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const preprocessed = preprocessCanvas(canvas)
      const blob = await canvasToBlob(preprocessed, 0.82)
      await processImageFile(blob)
    } catch (err) {
      console.error("ocr error", err)
      setCameraStatus("Erro ao preparar a imagem para OCR.")
      void reportClientLog("error", "ocr_preparation_failed", {
        error: err instanceof Error ? err.message : String(err),
      })
      alert("Erro no OCR. Verifique se a biblioteca está instalada.")
    }
  }

  function preprocessCanvas(srcCanvas: HTMLCanvasElement) {
    const canvas = document.createElement("canvas")
    const width = Math.max(800, srcCanvas.width)
    const height = Math.max(600, srcCanvas.height)
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      return srcCanvas
    }

    context.drawImage(srcCanvas, 0, 0, width, height)

    const image = context.getImageData(0, 0, width, height)
    const { data } = image
    let min = 255
    let max = 0

    for (let index = 0; index < data.length; index += 4) {
      const luminance = Math.round(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2])
      if (luminance < min) min = luminance
      if (luminance > max) max = luminance
    }

    const range = Math.max(1, max - min)
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const luminance = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)
      const stretched = Math.max(0, Math.min(255, Math.round(((luminance - min) * 255) / range)))
      data[index] = stretched
      data[index + 1] = stretched
      data[index + 2] = stretched
    }

    context.putImageData(image, 0, 0)
    return canvas
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-50">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white/5 shadow-2xl backdrop-blur">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.9))] p-5">
            <div className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              {stepContent.badge}
            </div>
            <h1 className="text-2xl font-semibold text-white">{stepContent.title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{stepContent.description}</p>
          </div>

          <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${completedSteps.imei ? "border-emerald-400/40 bg-emerald-400/10" : currentStep === "imei" ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">1. Dispositivo</div>
              <div className="mt-2 text-lg font-semibold text-white">IMEI</div>
              <p className="mt-1 text-sm text-slate-300">Leia primeiro a etiqueta do rastreador.</p>
              <div className="mt-3 text-xs font-medium text-slate-200">
                {completedSteps.imei ? "Recebido" : currentStep === "imei" ? "Em andamento" : "Aguardando"}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${completedSteps.iccid ? "border-emerald-400/40 bg-emerald-400/10" : currentStep === "iccid" ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">2. Chip</div>
              <div className="mt-2 text-lg font-semibold text-white">ICCID</div>
              <p className="mt-1 text-sm text-slate-300">Depois capture a numeracao completa do SIM.</p>
              <div className="mt-3 text-xs font-medium text-slate-200">
                {completedSteps.iccid ? "Recebido" : currentStep === "iccid" ? "Em andamento" : "Aguardando"}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={openCameraMode}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-300"
              >
                {stepContent.button}
              </button>
              <button
                onClick={() => {
                  setMode("manual")
                  setManualStatus(null)
                  closeCameraStream()
                }}
                disabled={mode === "manual"}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Digitar manualmente
              </button>
              <button
                onClick={() => setMode("qr")}
                disabled={mode === "qr"}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Leitor QR ao vivo
              </button>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
              {stepContent.helper}
            </div>
          </div>
        </div>

        {mode === "manual" && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
            <div className="mb-3 text-sm font-medium text-slate-200">Modo rapido sem OCR</div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                {currentStep === "imei" ? "Digite o IMEI" : currentStep === "iccid" ? "Digite o ICCID" : "Leitura concluida"}
              </label>
              <input
                value={manualValue}
                onChange={(event) => {
                  setManualValue(event.target.value.replace(/\D/g, ""))
                  if (manualStatus) setManualStatus(null)
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={currentStep === "imei" ? "15 digitos" : currentStep === "iccid" ? "19 ou 20 digitos" : "Concluido"}
                disabled={currentStep === "done"}
                className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-lg tracking-[0.18em] text-white outline-none placeholder:text-slate-500"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={sendManualValue}
                  disabled={currentStep === "done" || !manualValue}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {currentStep === "imei" ? "Enviar IMEI" : currentStep === "iccid" ? "Enviar ICCID" : "Concluido"}
                </button>
                <button
                  onClick={() => setManualValue("")}
                  disabled={!manualValue}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Limpar
                </button>
              </div>
              {manualStatus ? <div className="mt-3 text-sm text-slate-200">{manualStatus}</div> : null}
            </div>
          </div>
        )}

        {mode === "qr" && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
            <div className="mb-3 text-sm font-medium text-slate-200">Modo alternativo de leitura ao vivo</div>
            <div id="reader" style={{ width: "100%", maxWidth: 640 }} />
            {qrStatus ? <div className="mt-3 text-sm text-slate-300">{qrStatus}</div> : null}
          </div>
        )}

        {mode === "camera" && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
            <video
              ref={videoRef}
              style={{ width: "100%", maxWidth: 640 }}
              playsInline
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950"
            />
            {cameraStatus ? <div className="mt-3 text-sm text-slate-300">{cameraStatus}</div> : null}
            {previewImage ? (
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Preview enviado</div>
                <img
                  src={previewImage}
                  alt="Preview da imagem enviada para OCR"
                  style={{ width: "100%", maxWidth: 320 }}
                  className="rounded-2xl border border-white/10"
                />
              </div>
            ) : null}
            {lastResult ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                <div className="mb-2 text-base font-semibold">Leitura confirmada</div>
                <div>Tipo: {lastResult.type.toUpperCase()}</div>
                <div>Valor: {lastResult.value}</div>
                <div>Confianca OCR: {Math.round(lastResult.confidence || 0)}%</div>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFile}
              style={{ display: "none" }}
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={captureAndSend}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending}
              >
                {isSending ? "Enviando..." : "Capturar e enviar"}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending}
              >
                {isSending ? "Processando..." : "Selecionar ou tirar foto"}
              </button>
              <button
                onClick={closeCameraStream}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-transparent px-4 text-sm font-medium text-slate-300 transition hover:bg-white/5"
              >
                Fechar camera
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
