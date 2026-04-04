"use client"

import { useEffect, useState } from "react"

type ClientLogEntry = {
  id: string
  timestamp: string
  scope: string
  level: "error" | "warn"
  message: string
  details: unknown
}

export default function ClientLogsPage() {
  const [logs, setLogs] = useState<ClientLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = async () => {
    try {
      setError(null)
      const res = await fetch("/api/client-log?limit=100", { cache: "no-store" })
      if (!res.ok) throw new Error("failed_to_load_logs")
      const json = (await res.json()) as ClientLogEntry[]
      setLogs(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
    const timer = setInterval(loadLogs, 2000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Logs do Celular</h1>
          <p style={{ color: "#666", marginTop: 4 }}>Eventos e erros reportados pela tela de scanner.</p>
        </div>
        <button onClick={loadLogs}>Atualizar</button>
      </div>

      {loading ? <div>Carregando logs...</div> : null}
      {error ? <div style={{ color: "crimson" }}>Erro: {error}</div> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              background: log.level === "error" ? "#fef2f2" : "#fffbeb",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <strong>{log.message}</strong>
              <span>{new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <span style={{ marginRight: 8 }}>Nivel: {log.level}</span>
              <span>Escopo: {log.scope}</span>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>{JSON.stringify(log.details, null, 2)}</pre>
          </div>
        ))}

        {!loading && logs.length === 0 ? <div>Nenhum log recebido ainda.</div> : null}
      </div>
    </div>
  )
}
