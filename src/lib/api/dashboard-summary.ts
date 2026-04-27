import type { DashboardSummarySettings } from "@/types/dashboard-summary";

export async function getDashboardSummarySettings() {
  const response = await fetch("/api/dashboard-summary/settings", {
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Falha ao carregar configuração do resumo da dashboard");
  }

  return data as { settings: DashboardSummarySettings };
}

export async function updateDashboardSummarySettings(input: Partial<DashboardSummarySettings>) {
  const response = await fetch("/api/dashboard-summary/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Falha ao salvar configuração do resumo da dashboard");
  }

  return data as { settings: DashboardSummarySettings };
}

export async function dispatchDashboardSummary(input?: { force?: boolean; currentUserOnly?: boolean }) {
  const response = await fetch("/api/dashboard-summary/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Falha ao enviar resumo da dashboard");
  }

  return data as {
    sent: number;
    results: Array<{
      userId: number;
      email: string;
      status: "sent" | "skipped" | "error";
      message?: string;
    }>;
  };
}
