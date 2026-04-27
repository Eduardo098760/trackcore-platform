import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyEmailBranding,
  buildAccessInviteEmail,
  getEmailDeliveryErrorInfo,
  sendPlatformEmail,
} from "@/lib/server/email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, link, expiresAt } = req.body || {};
  if (!name || !email || !link) {
    return res.status(400).json({ error: "name, email e link são obrigatórios" });
  }

  try {
    const message = buildAccessInviteEmail({
      name: String(name),
      link: String(link),
      expiresAt: typeof expiresAt === "string" ? expiresAt : null,
    });

    await sendPlatformEmail(
      {
        to: String(email),
        subject: message.subject,
        text: message.text,
        html: applyEmailBranding(message.html, req),
      },
      req,
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    const failure = getEmailDeliveryErrorInfo(error);

    if (
      failure.code === "smtp_provider_blocked" ||
      failure.code === "smtp_connection_failed" ||
      failure.code === "smtp_auth_failed"
    ) {
      return res.status(200).json({
        success: true,
        delivered: false,
        deliveryMode: "manual_link",
        error: failure.code,
        message: failure.message,
      });
    }

    return res.status(failure.status).json({
      error: failure.code,
      message: failure.message,
    });
  }
}