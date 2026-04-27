import type { NextApiRequest, NextApiResponse } from "next";
import { getRequestAccessScope } from "@/lib/server/request-access";
import { dispatchDashboardSummaries } from "@/lib/server/dashboard-summary";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const currentUserOnly = Boolean(req.body?.currentUserOnly);
    const cronSecret = process.env.DASHBOARD_SUMMARY_CRON_SECRET?.trim();
    const providedSecret = String(req.headers["x-dashboard-summary-secret"] || "").trim();
    const hasCronAccess = Boolean(cronSecret && providedSecret && cronSecret === providedSecret);

    if (!currentUserOnly && !hasCronAccess) {
      const scope = await getRequestAccessScope(req);
      if (!scope.isAdmin) {
        return res.status(403).json({ error: "Apenas administradores podem disparar o resumo global da dashboard." });
      }
    }

    const result = await dispatchDashboardSummaries(req, {
      force: Boolean(req.body?.force),
      currentUserOnly,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Falha ao disparar resumo da dashboard" });
  }
}
