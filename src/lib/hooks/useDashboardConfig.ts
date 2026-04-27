"use client";

import { useState, useEffect, useCallback } from "react";

export interface WidgetConfig {
  id: string;
  label: string;
  description: string;
  category: "stats" | "charts" | "lists" | "kpi";
  visible: boolean;
}

const STORAGE_KEY = "dashboardWidgetConfig";

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: "stats-primary",
    label: "Estatísticas Principais",
    description: "Total de veículos, online, alertas e clientes",
    category: "stats",
    visible: true,
  },
  {
    id: "stats-secondary",
    label: "Estatísticas Operacionais",
    description: "Em movimento, parados, bloqueados, eventos hoje",
    category: "stats",
    visible: true,
  },
  {
    id: "device-chart",
    label: "Gráfico de Status",
    description: "Gráfico pizza com status dos veículos",
    category: "charts",
    visible: true,
  },
  {
    id: "recent-events",
    label: "Eventos Recentes",
    description: "Últimos eventos registrados no sistema",
    category: "lists",
    visible: true,
  },
  {
    id: "recent-commands",
    label: "Comandos Recentes",
    description: "Últimos comandos enviados aos veículos",
    category: "lists",
    visible: true,
  },
  {
    id: "maintenance-summary",
    label: "Resumo de Manutenções",
    description: "Manutenções agendadas, atrasadas e em andamento",
    category: "lists",
    visible: true,
  },
  {
    id: "fleet-kpi",
    label: "KPIs da Frota",
    description: "Indicadores: utilização, velocidade, distância, alertas",
    category: "kpi",
    visible: true,
  },
  {
    id: "custom-kpis",
    label: "KPIs Personalizados",
    description: "Indicadores criados a partir dos atributos computados",
    category: "kpi",
    visible: true,
  },
];

function loadConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const saved: Record<string, boolean> = JSON.parse(raw);
    // Merge saved visibility with defaults (handles new widgets added later)
    return DEFAULT_WIDGETS.map((w) => ({
      ...w,
      visible: saved[w.id] !== undefined ? saved[w.id] : w.visible,
    }));
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveConfig(widgets: WidgetConfig[]) {
  const map: Record<string, boolean> = {};
  widgets.forEach((w) => {
    map[w.id] = w.visible;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useDashboardConfig() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);

  useEffect(() => {
    setWidgets(loadConfig());
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w,
      );
      saveConfig(next);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (id: string) => widgets.find((w) => w.id === id)?.visible ?? true,
    [widgets],
  );

  const resetToDefaults = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    saveConfig(DEFAULT_WIDGETS);
  }, []);

  return { widgets, toggleWidget, isVisible, resetToDefaults };
}
