"use client"

import { useEffect, useState } from "react"
import { socket } from "@/lib/socket"
import { getPublicAppUrl, isLocalhostAppUrl } from "@/lib/public-runtime"
import QRCode from "qrcode"

type Form = {
  imei: string
  iccid: string
}

export default function NewDevice() {
  const [qr, setQr] = useState("")
  const [form, setForm] = useState<Form>({ imei: "", iccid: "" })
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState("Criando sessao de leitura...")
  const [accessWarning, setAccessWarning] = useState<string | null>(null)

  useEffect(() => {
    // solicita sessão ao servidor para gerar token assinado + expiração
    const createSession = async () => {
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!res.ok) throw new Error("failed to create session")

        const json = await res.json()
        const id = json.sessionId as string
        const token = json.token as string
        const expires = json.expiresAt as number

        socket.emit("join-session", { sessionId: id, token, expires })
        setSessionStatus("Sessao criada. Aguardando leitura...")

        const baseUrl = getPublicAppUrl()
        const qrUrl = `${baseUrl}/scan?session=${encodeURIComponent(id)}&token=${encodeURIComponent(
          token
        )}&expires=${encodeURIComponent(expires)}`

        QRCode.toDataURL(qrUrl).then(setQr)
        setSessionError(null)
        setAccessWarning(
          isLocalhostAppUrl(baseUrl)
            ? "Este QR aponta para localhost. No celular isso nao abre. Use o IP da sua maquina ou configure NEXT_PUBLIC_APP_URL."
            : null
        )

        socket.on("scan-result", (data: any) => {
          if (data.type === "imei") {
            setForm((f) => ({ ...f, imei: data.value }))
            setSessionStatus("IMEI recebido e preenchido automaticamente.")
          }

          if (data.type === "iccid") {
            setForm((f) => ({ ...f, iccid: data.value }))
            setSessionStatus("ICCID recebido e preenchido automaticamente.")
          }
        })

        socket.on("session-error", (data: any) => {
          setSessionError(data?.reason || "Erro ao conectar na sessao de leitura.")
        })

        socket.on("scan-error", (data: any) => {
          setSessionError(data?.reason || "Erro ao validar a leitura recebida.")
        })
      } catch (err) {
        console.error("Erro criando sessão:", err)
        setSessionError("Nao foi possivel criar a sessao de leitura.")
        setSessionStatus("Falha ao preparar leitura.")
      }
    }

    createSession()

    return () => {
      socket.off("scan-result")
      socket.off("session-error")
      socket.off("scan-error")
    }
  }, [])

  return (
    <div>
      <h1>Novo Dispositivo</h1>

      {sessionError ? <div>{sessionError}</div> : null}
        {accessWarning ? <div>{accessWarning}</div> : null}
        <div>{sessionStatus}</div>

      {qr ? <img src={qr} alt="QR code" /> : <div>Gerando QR...</div>}

      <input
        placeholder="IMEI"
        value={form.imei}
        onChange={(e) => setForm({ ...form, imei: e.target.value })}
      />

      <input
        placeholder="ICCID"
        value={form.iccid}
        onChange={(e) => setForm({ ...form, iccid: e.target.value })}
      />
    </div>
  )
}
