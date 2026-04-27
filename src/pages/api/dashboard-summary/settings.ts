import type { NextApiRequest, NextApiResponse } from "next";
import {
  getCurrentDashboardSummarySettings,
  saveCurrentDashboardSummarySettings,
} from "@/lib/server/dashboard-summary";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { settings } = await getCurrentDashboardSummarySettings(req);
      return res.status(200).json({ settings });
    }

    if (req.method === "POST") {
      const settings = await saveCurrentDashboardSummarySettings(req, req.body || {});
      return res.status(200).json({ settings });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Falha ao processar configuração do resumo da dashboard" });
  }
}
