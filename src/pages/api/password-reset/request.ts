import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyEmailBranding,
  buildPasswordResetEmail,
  getEmailDeliveryErrorInfo,
  sendPlatformEmail,
} from "@/lib/server/email";
import { consumePasswordResetRecord, createPasswordResetRecord } from "@/lib/server/password-reset-store";
import { findTraccarUserByEmail, resolvePublicAppUrl } from "@/lib/server/traccar-server";

const DEFAULT_DURATION_MS = 1000 * 60 * 60 * 2;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email é obrigatório" });
  }

  try {
    const { traccarBase, user } = await findTraccarUserByEmail(email, req);
    if (!user?.id || !user.email) {
      return res.status(200).json({ success: true });
    }

    const reset = createPasswordResetRecord({
      userId: Number(user.id),
      name: String(user.name || user.email),
      email: String(user.email),
      traccarBase,
      expiresAt: Date.now() + DEFAULT_DURATION_MS,
    });

    const link = `${resolvePublicAppUrl(req)}/reset-password/${reset.token}`;
    const expiresAt = new Date(reset.expiresAt).toISOString();
    const message = buildPasswordResetEmail({
      name: reset.name,
      link,
      expiresAt,
    });

    try {
      await sendPlatformEmail(
        {
          to: reset.email,
          subject: message.subject,
          text: message.text,
          html: applyEmailBranding(message.html, req),
        },
        req,
      );
    } catch (sendError) {
      consumePasswordResetRecord(reset.token);
      throw sendError;
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    const failure = getEmailDeliveryErrorInfo(error);
    return res.status(failure.status).json({
      error: failure.code,
      message: failure.message,
    });
  }
}