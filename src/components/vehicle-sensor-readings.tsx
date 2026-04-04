"use client"

import React from "react"
import { useSensorReadings } from "@/lib/hooks/useSensorReadings"

type Props = {
  vehicleId: string | number
  sensorKey?: string
  title?: string
}

export default function VehicleSensorReadings({ vehicleId, sensorKey, title }: Props) {
  const { data, loading, error, refresh } = useSensorReadings({ vehicleId, sensorKey, pollIntervalMs: 5000 })

  return (
    <div className="vehicle-sensor-readings">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>{title || "Leituras do sensor"}</h3>
        <div>
          <button onClick={() => refresh()} style={{ marginRight: 8 }}>
            Atualizar
          </button>
        </div>
      </div>

      {loading && <div>Carregando...</div>}
      {error && <div style={{ color: "red" }}>Erro: {error}</div>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Timestamp</th>
              <th style={{ textAlign: "left", padding: 8 }}>Sensor</th>
              <th style={{ textAlign: "left", padding: 8 }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 8 }}>{new Date(r.timestamp).toLocaleString()}</td>
                <td style={{ padding: 8 }}>{r.sensorKey}</td>
                <td style={{ padding: 8 }}>{String(r.value)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 8 }}>
                  Nenhuma leitura encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
