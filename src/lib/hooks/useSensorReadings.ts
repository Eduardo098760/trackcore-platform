"use client"

import { useEffect, useState, useRef } from "react"
import type { SensorReadingStored } from "../../types/kpi"

export function useSensorReadings(opts: {
  vehicleId: string | number
  sensorKey?: string
  pollIntervalMs?: number
  limit?: number
}) {
  const { vehicleId, sensorKey, pollIntervalMs = 5000, limit = 50 } = opts
  const [data, setData] = useState<SensorReadingStored[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("vehicleId", String(vehicleId))
      if (sensorKey) params.set("sensorKey", sensorKey)
      params.set("limit", String(limit))

      const res = await fetch(`/api/sensors?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as SensorReadingStored[]
      if (!mounted.current) return
      setData(json)
    } catch (err: any) {
      if (!mounted.current) return
      setError(err?.message || "error")
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    fetchData()
    const iv = setInterval(fetchData, pollIntervalMs)
    return () => {
      mounted.current = false
      clearInterval(iv)
    }
  }, [vehicleId, sensorKey, pollIntervalMs, limit])

  return { data, loading, error, refresh: fetchData }
}
