"use client";

import { useState, useEffect } from "react";

/**
 * Hook que retorna um texto relativo ("Agora", "3 min atrás", "2h atrás", "1d atrás")
 * e atualiza automaticamente a cada intervalo para nunca ficar desatualizado.
 *
 * Usa o timestamp mais recente entre os fornecidos (ex: device.lastUpdate vs position.serverTime).
 */
export function useRelativeTime(
  ...timestamps: (string | null | undefined)[]
): string | null {
  const [, setTick] = useState(0);

  // Pega o timestamp mais recente entre os fornecidos
  const latestTs = timestamps.reduce<number>((best, ts) => {
    if (!ts) return best;
    const t = new Date(ts).getTime();
    return Number.isNaN(t) ? best : Math.max(best, t);
  }, 0);

  useEffect(() => {
    if (!latestTs) return;

    // Atualiza a cada 30s para manter relativo correto
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [latestTs]);

  if (!latestTs) return null;

  const diff = Date.now() - latestTs;
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}
