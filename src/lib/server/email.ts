import type { NextApiRequest } from "next";
import nodemailer from "nodemailer";
import { getTenantConfig, normalizeHostname } from "@/config/tenants";
import { getServerSmtpConfig, type SmtpConfig, resolvePublicAppUrl } from "@/lib/server/traccar-server";

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export interface EmailDeliveryErrorInfo {
  code: string;
  status: number;
  message: string;
}

interface EmailBranding {
  companyName: string;
  logoUrl: string | null;
  website: string | null;
}

interface NamedSmtpConfig {
  name: string;
  config: SmtpConfig;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBoolean(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não", "off"].includes(normalized)) return false;
  }
  return defaultValue;
}

function getNamedEnvSmtpConfig(prefix: "SMTP_FALLBACK_" | "SMTP_BACKUP_"): NamedSmtpConfig | null {
  const host = process.env[`${prefix}HOST`]?.trim();
  const user = process.env[`${prefix}USER`]?.trim();
  const password = process.env[`${prefix}PASSWORD`]?.trim();
  const from = process.env[`${prefix}FROM`]?.trim();
  const port = Number(process.env[`${prefix}PORT`] || 465);
  const secure = parseBoolean(process.env[`${prefix}SECURE`], Number(port) === 465);
  const requireTLS = parseBoolean(
    process.env[`${prefix}REQUIRE_TLS`] ?? process.env[`${prefix}STARTTLS`],
    false,
  );

  if (!host || !user || !password || !from) {
    return null;
  }

  return {
    name: prefix === "SMTP_FALLBACK_" ? "smtp_fallback" : "smtp_backup",
    config: {
      host,
      port: Number.isFinite(port) ? port : 465,
      secure,
      requireTLS,
      username: user,
      password,
      from,
    },
  };
}

function getFailoverSmtpConfigs() {
  return [
    getNamedEnvSmtpConfig("SMTP_FALLBACK_"),
    getNamedEnvSmtpConfig("SMTP_BACKUP_"),
  ].filter((entry): entry is NamedSmtpConfig => !!entry);
}

function isRetryableSmtpError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = stripHtml(rawMessage).toLowerCase();
  const errorCode = typeof error === "object" && error && "code" in error ? String((error as any).code || "") : "";
  const normalizedCode = errorCode.toLowerCase();

  return (
    normalizedCode === "eauth" ||
    normalizedCode === "econnection" ||
    normalizedCode === "etimedout" ||
    normalizedCode === "enotfound" ||
    normalizedCode === "esocket" ||
    normalizedMessage.includes("550 5.4.6") ||
    normalizedMessage.includes("unusual sending activity detected") ||
    normalizedMessage.includes("mail.zoho.com/unblockme") ||
    normalizedMessage.includes("invalid login") ||
    normalizedMessage.includes("authentication unsuccessful") ||
    normalizedMessage.includes("535") ||
    normalizedMessage.includes("connect") ||
    normalizedMessage.includes("timed out")
  );
}

function getEmailBranding(req?: Pick<NextApiRequest, "headers">): EmailBranding {
  const hostname = normalizeHostname(String(req?.headers?.host || ""));
  const tenant = getTenantConfig(hostname);
  const publicUrl = resolvePublicAppUrl(req);
  const logoUrl = tenant.logoUrl
    ? `${publicUrl}${tenant.logoUrl.startsWith("/") ? tenant.logoUrl : `/${tenant.logoUrl}`}`
    : null;

  return {
    companyName: tenant.companyName,
    logoUrl,
    website: tenant.metadata?.website || publicUrl,
  };
}

function withDisplayName(from: string, displayName: string) {
  if (!from) return from;
  if (from.includes("<") && from.includes(">")) return from;
  return `${displayName} <${from}>`;
}

function renderEmailShell(contentHtml: string, branding: EmailBranding) {
  const logoBlock = branding.logoUrl
    ? `<div style="margin-bottom:20px;"><img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.companyName)}" style="max-width:180px;max-height:56px;display:block;" /></div>`
    : `<div style="margin-bottom:20px;font-size:24px;font-weight:700;color:#111827;">${escapeHtml(branding.companyName)}</div>`;

  const footer = branding.website
    ? `<p style="margin-top:24px;font-size:12px;color:#6b7280;">${escapeHtml(branding.companyName)} • <a href="${escapeHtml(branding.website)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(branding.website)}</a></p>`
    : `<p style="margin-top:24px;font-size:12px;color:#6b7280;">${escapeHtml(branding.companyName)}</p>`;

  return `
    <div style="background:#f3f4f6;padding:32px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;color:#111827;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        ${logoBlock}
        ${contentHtml}
        ${footer}
      </div>
    </div>
  `;
}

export async function sendPlatformEmail(payload: EmailPayload, req?: Pick<NextApiRequest, "headers">) {
  const branding = getEmailBranding(req);
  const smtpCandidates: NamedSmtpConfig[] = [
    {
      name: "smtp_primary",
      config: await getServerSmtpConfig(req),
    },
    ...getFailoverSmtpConfigs(),
  ];

  let lastError: unknown = null;

  for (let index = 0; index < smtpCandidates.length; index += 1) {
    const candidate = smtpCandidates[index];

    try {
      const transporter = nodemailer.createTransport({
        host: candidate.config.host,
        port: candidate.config.port,
        secure: candidate.config.secure,
        requireTLS: candidate.config.requireTLS,
        ignoreTLS: false,
        auth: {
          user: candidate.config.username,
          pass: candidate.config.password,
        },
      });

      await transporter.sendMail({
        from: withDisplayName(candidate.config.from, branding.companyName),
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        attachments: payload.attachments,
      });

      return;
    } catch (error) {
      lastError = error;
      const hasNextCandidate = index < smtpCandidates.length - 1;
      if (!hasNextCandidate || !isRetryableSmtpError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível enviar o email.");
}

export function getEmailDeliveryErrorInfo(error: unknown): EmailDeliveryErrorInfo {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const cleanMessage = stripHtml(rawMessage);
  const normalizedMessage = cleanMessage.toLowerCase();
  const errorCode = typeof error === "object" && error && "code" in error ? String((error as any).code || "") : "";
  const normalizedCode = errorCode.toLowerCase();

  if (rawMessage.includes("SMTP não configurado")) {
    return {
      code: "smtp_not_configured",
      status: 503,
      message: "O envio por email não está configurado. Preencha SMTP host, usuário, senha e remetente nas configurações do servidor.",
    };
  }

  if (
    rawMessage.includes("Credenciais de serviço do Traccar") ||
    rawMessage.includes("Não foi possível carregar as configurações SMTP do servidor") ||
    rawMessage.includes("Não foi possível autenticar a conta de serviço no Traccar")
  ) {
    return {
      code: "smtp_config_unavailable",
      status: 503,
      message: "Não foi possível carregar a configuração de email do servidor. Verifique a sessão ativa ou as credenciais de serviço do Traccar.",
    };
  }

  if (
    normalizedCode === "eauth" ||
    normalizedMessage.includes("invalid login") ||
    normalizedMessage.includes("authentication unsuccessful") ||
    normalizedMessage.includes("535")
  ) {
    return {
      code: "smtp_auth_failed",
      status: 502,
      message: "Falha de autenticação no servidor SMTP. Revise usuário, senha e método de segurança do email.",
    };
  }

  if (
    normalizedMessage.includes("550 5.4.6") ||
    normalizedMessage.includes("unusual sending activity detected") ||
    normalizedMessage.includes("mail.zoho.com/unblockme")
  ) {
    return {
      code: "smtp_provider_blocked",
      status: 503,
      message: "O provedor de email Zoho bloqueou temporariamente o envio por atividade incomum. É preciso desbloquear a conta no painel do Zoho ou configurar SMTP_FALLBACK_HOST, SMTP_FALLBACK_USER, SMTP_FALLBACK_PASSWORD e SMTP_FALLBACK_FROM para failover imediato.",
    };
  }

  if (
    normalizedCode === "econnection" ||
    normalizedCode === "etimedout" ||
    normalizedCode === "enotfound" ||
    normalizedCode === "esocket" ||
    normalizedMessage.includes("connect") ||
    normalizedMessage.includes("timed out")
  ) {
    return {
      code: "smtp_connection_failed",
      status: 502,
      message: "Não foi possível conectar ao servidor SMTP. Verifique host, porta, SSL/TLS e acesso de rede.",
    };
  }

  return {
    code: "email_send_failed",
    status: 500,
    message: cleanMessage || "Não foi possível enviar o email de acesso no momento.",
  };
}

export function buildAccessInviteEmail(input: { name: string; link: string; expiresAt?: string | null }) {
  const expirationText = input.expiresAt ? `Este link expira em ${new Date(input.expiresAt).toLocaleString("pt-BR")}.` : "";
  const text = [
    `Olá, ${input.name}.`,
    "",
    "Use o link abaixo para definir sua senha de acesso na plataforma:",
    input.link,
    expirationText ? `\n${expirationText}` : "",
    "",
    "Após a definição da senha, o link deixa de funcionar.",
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Use o botão abaixo para definir sua senha de acesso na plataforma.</p>
      <p>
        <a href="${escapeHtml(input.link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;">
          Definir senha de acesso
        </a>
      </p>
      <p>Se preferir, copie este link:</p>
      <p>${nl2br(input.link)}</p>
      ${expirationText ? `<p>${escapeHtml(expirationText)}</p>` : ""}
      <p>Após a definição da senha, o link deixa de funcionar.</p>
    </div>
  `;

  return {
    subject: "Defina sua senha de acesso",
    text,
    html: bodyHtml,
  };
}

export function buildPasswordResetEmail(input: { name: string; link: string; expiresAt?: string | null }) {
  const expirationText = input.expiresAt ? `Este link expira em ${new Date(input.expiresAt).toLocaleString("pt-BR")}.` : "";
  const text = [
    `Olá, ${input.name}.`,
    "",
    "Recebemos uma solicitação para redefinir sua senha.",
    "Use o link abaixo para cadastrar uma nova senha:",
    input.link,
    expirationText ? `\n${expirationText}` : "",
    "",
    "Se você não solicitou essa alteração, ignore este email.",
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>
        <a href="${escapeHtml(input.link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;">
          Redefinir senha
        </a>
      </p>
      <p>Se preferir, copie este link:</p>
      <p>${nl2br(input.link)}</p>
      ${expirationText ? `<p>${escapeHtml(expirationText)}</p>` : ""}
      <p>Se você não solicitou essa alteração, ignore este email.</p>
    </div>
  `;

  return {
    subject: "Redefinição de senha",
    text,
    html: bodyHtml,
  };
}

export function applyEmailBranding(html: string, req?: Pick<NextApiRequest, "headers">) {
  return renderEmailShell(html, getEmailBranding(req));
}