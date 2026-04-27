import type { NextApiRequest, NextApiResponse } from "next";
import { consumePasswordResetRecord, getPasswordResetRecord } from "@/lib/server/password-reset-store";
import { updateTraccarUserPassword } from "@/lib/server/traccar-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");

  if (!token || !password) {
    return res.status(400).json({ error: "token e password são obrigatórios" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
  }

  try {
    const record = getPasswordResetRecord(token);
    if (!record) {
      return res.status(400).json({ error: "Link inválido ou expirado" });
    }

    await updateTraccarUserPassword(record.userId, password, req, record.traccarBase);
    consumePasswordResetRecord(token);
    return res.status(200).json({ success: true, email: record.email });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao redefinir senha" });
  }
}