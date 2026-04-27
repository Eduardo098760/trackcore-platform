import type { NextApiRequest } from "next";
import { getTenantConfig, getTenantServerUrl, normalizeHostname } from "@/config/tenants";
import { readCachedSmtpConfig, writeCachedSmtpConfig } from "@/lib/server/smtp-config-store";

interface TraccarServerResponse {
  attributes?: Record<string, unknown>;
}

interface TraccarUserResponse {
  id: number;
  name?: string;
  email?: string;
  administrator?: boolean;
  readonly?: boolean;
  deviceReadonly?: boolean;
  clientId?: number;
  organizationId?: number;
  groupId?: number;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  username: string;
  password: string;
  from: string;
}

const SERVICE_EMAIL = process.env.TRACCAR_SERVICE_EMAIL?.trim() || process.env.TRACCAR_ADMIN_EMAIL?.trim() || "";
const SERVICE_PASSWORD = process.env.TRACCAR_SERVICE_PASSWORD?.trim() || process.env.TRACCAR_ADMIN_PASSWORD?.trim() || "";

function ensureApiBase(url: string) {
  const normalized = url.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function isValidHttpUrl(url: string | undefined | null) {
  return !!url && /^https?:\/\//i.test(url);
}

function isPrivateIpv4Host(hostname: string) {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,3})\./);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}

function isPrivateNetworkUrl(url: string | undefined | null) {
  if (!isValidHttpUrl(url)) return false;

  try {
    const parsed = new URL(url!);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1" ||
      isPrivateIpv4Host(parsed.hostname)
    );
  } catch {
    return false;
  }
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

function parseSmtpConfigFromAttributes(attributes: Record<string, unknown>): SmtpConfig | null {
  const host = String(attributes["mail.smtp.host"] || "").trim();
  const port = Number(attributes["mail.smtp.port"] || 465);
  const username = String(attributes["mail.smtp.username"] || "").trim();
  const password = String(attributes["mail.smtp.password"] || "").trim();
  const from = String(attributes["mail.smtp.from"] || username || "").trim();
  const sslEnabled = parseBoolean(attributes["mail.smtp.ssl.enable"]);
  const starttlsEnabled = parseBoolean(attributes["mail.smtp.starttls.enable"]);

  if (!host || !username || !password || !from) {
    return null;
  }

  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure: sslEnabled || (!starttlsEnabled && port === 465),
    requireTLS: starttlsEnabled,
    username,
    password,
    from,
  };
}

function getEnvSmtpConfig(): SmtpConfig | null {
  const envHost = process.env.SMTP_HOST?.trim();
  const envPort = Number(process.env.SMTP_PORT || 465);
  const envUser = process.env.SMTP_USER?.trim();
  const envPassword = process.env.SMTP_PASSWORD?.trim();
  const envFrom = process.env.SMTP_FROM?.trim();
  const envSecure = parseBoolean(process.env.SMTP_SECURE, Number(envPort) === 465);
  const envRequireTLS = parseBoolean(
    process.env.SMTP_REQUIRE_TLS ?? process.env.SMTP_STARTTLS,
    false,
  );

  if (!envHost || !envUser || !envPassword || !envFrom) {
    return null;
  }

  return {
    host: envHost,
    port: Number.isFinite(envPort) ? envPort : 465,
    secure: envSecure,
    requireTLS: envRequireTLS,
    username: envUser,
    password: envPassword,
    from: envFrom,
  };
}

function getCookieValue(cookieHeader: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  if (!match) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

export function resolveTraccarBase(req?: Pick<NextApiRequest, "headers">) {
  return getCandidateTraccarBases(req)[0] || ensureApiBase("http://localhost:8082/api");
}

function getCandidateTraccarBases(req?: Pick<NextApiRequest, "headers">) {
  const candidates: string[] = [];

  const pushCandidate = (value?: string | null) => {
    if (!isValidHttpUrl(value)) return;
    const normalized = ensureApiBase(value!);
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  const headerUrl = typeof req?.headers?.["x-traccar-server"] === "string" ? req.headers["x-traccar-server"] : "";
  pushCandidate(headerUrl);

  const cookieHeader = req?.headers?.cookie || "";
  pushCandidate(getCookieValue(cookieHeader, "traccar-server"));

  const hostHeader = String(req?.headers?.host || "");
  const tenantHostname = normalizeHostname(hostHeader);
  pushCandidate(getTenantServerUrl(tenantHostname));

  pushCandidate(process.env.TRACCAR_INTERNAL_URL?.trim());
  pushCandidate(process.env.NEXT_PUBLIC_API_URL?.trim());
  pushCandidate("http://localhost:8082/api");

  return candidates;
}

function buildHeaders(cookieHeader?: string, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    accept: "application/json",
    ...extraHeaders,
  };

  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  return headers;
}

export async function fetchTraccarWithSession(
  req: Pick<NextApiRequest, 'headers'> | undefined,
  path: string,
  init: RequestInit = {},
) {
  const traccarBase = resolveTraccarBase(req);
  const cookieHeader = req?.headers?.cookie || '';

  return fetch(`${traccarBase}${path}`, {
    ...init,
    headers: buildHeaders(cookieHeader, init.headers as Record<string, string> | undefined),
  });
}

export async function getCurrentTraccarUser(req?: Pick<NextApiRequest, 'headers'>) {
  const response = await fetchTraccarWithSession(req, '/session', { method: 'GET' });
  if (!response.ok) {
    throw new Error('Não foi possível validar a sessão atual do Traccar.');
  }

  return await response.json() as TraccarUserResponse;
}

export function getTraccarUserOrganizationId(user: TraccarUserResponse | null | undefined) {
  const candidates = [
    user?.organizationId,
    user?.clientId,
    user?.groupId,
    user?.attributes?.organizationId,
    user?.attributes?.clientId,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

export function isTraccarAdmin(user: TraccarUserResponse | null | undefined) {
  if (!user) return false;
  const role = String(user.attributes?.role || '').trim().toLowerCase();
  return Boolean(user.administrator || role === 'admin' || role === 'superadmin');
}

async function loginWithServiceAccount(traccarBase: string) {
  if (!SERVICE_EMAIL || !SERVICE_PASSWORD) {
    throw new Error("Credenciais de serviço do Traccar não configuradas para fluxos públicos de email.");
  }

  const formData = new URLSearchParams();
  formData.set("email", SERVICE_EMAIL);
  formData.set("password", SERVICE_PASSWORD);

  const response = await fetch(`${traccarBase}/session`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error("Não foi possível autenticar a conta de serviço no Traccar.");
  }

  const rawCookie = response.headers.get("set-cookie") || "";
  if (!rawCookie) {
    throw new Error("O Traccar não retornou cookie de sessão para a conta de serviço.");
  }

  return rawCookie
    .split(",")
    .map((chunk) => chunk.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchWithOptionalServiceFallback(
  traccarBase: string,
  path: string,
  init: RequestInit = {},
  forwardedCookie?: string,
) {
  const firstAttempt = await fetch(`${traccarBase}${path}`, {
    ...init,
    headers: buildHeaders(forwardedCookie, init.headers as Record<string, string> | undefined),
  });

  if (firstAttempt.ok || (firstAttempt.status !== 401 && firstAttempt.status !== 403)) {
    return firstAttempt;
  }

  const serviceCookie = await loginWithServiceAccount(traccarBase);
  return fetch(`${traccarBase}${path}`, {
    ...init,
    headers: buildHeaders(serviceCookie, init.headers as Record<string, string> | undefined),
  });
}

export async function getServerSmtpConfig(req?: Pick<NextApiRequest, "headers">): Promise<SmtpConfig> {
  const envConfig = getEnvSmtpConfig();
  if (envConfig) {
    return envConfig;
  }

  const attemptedBases: string[] = [];
  const requestCookie = req?.headers?.cookie || "";

  for (const traccarBase of getCandidateTraccarBases(req)) {
    attemptedBases.push(traccarBase);

    try {
      const response = await fetchWithOptionalServiceFallback(traccarBase, "/server", { method: "GET" }, requestCookie);
      if (!response.ok) {
        continue;
      }

      const server = (await response.json()) as TraccarServerResponse;
      const attributes = server.attributes || {};
      const smtp = parseSmtpConfigFromAttributes(attributes);

      if (!smtp) {
        continue;
      }

      writeCachedSmtpConfig(smtp);
      return smtp;
    } catch {
      continue;
    }
  }

  const cachedConfig = readCachedSmtpConfig();
  if (cachedConfig) {
    return cachedConfig;
  }

  if (attemptedBases.length > 0) {
    throw new Error(
      `SMTP não configurado. Nenhuma origem válida retornou host, usuário, senha e remetente. Origens tentadas: ${attemptedBases.join(", ")}.`,
    );
  }

  throw new Error("Não foi possível carregar as configurações SMTP do servidor.");
}

export async function findTraccarUserByEmail(email: string, req?: Pick<NextApiRequest, "headers">) {
  const traccarBase = resolveTraccarBase(req);
  const response = await fetchWithOptionalServiceFallback(traccarBase, "/users", { method: "GET" }, req?.headers?.cookie || "");
  if (!response.ok) {
    throw new Error("Não foi possível consultar os usuários no Traccar.");
  }

  const users = (await response.json()) as TraccarUserResponse[];
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((entry) => String(entry.email || "").trim().toLowerCase() === normalizedEmail) || null;

  return {
    traccarBase,
    user,
  };
}

export async function getTraccarUsers(
  req?: Pick<NextApiRequest, "headers">,
  traccarBaseOverride?: string,
) {
  const traccarBase = traccarBaseOverride || resolveTraccarBase(req);
  const response = await fetchWithOptionalServiceFallback(
    traccarBase,
    "/users",
    { method: "GET" },
    req?.headers?.cookie || "",
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os usuários do Traccar.");
  }

  return await response.json() as TraccarUserResponse[];
}

export async function updateTraccarUser(
  userId: number,
  payload: Record<string, unknown>,
  req?: Pick<NextApiRequest, "headers">,
  traccarBaseOverride?: string,
) {
  const traccarBase = traccarBaseOverride || resolveTraccarBase(req);
  const response = await fetchWithOptionalServiceFallback(
    traccarBase,
    `/users/${userId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ...payload,
        id: userId,
      }),
    },
    req?.headers?.cookie || "",
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Não foi possível atualizar o usuário no Traccar.");
  }

  return await response.json().catch(() => null);
}

export async function updateTraccarUserPassword(
  userId: number,
  password: string,
  req?: Pick<NextApiRequest, "headers">,
  traccarBaseOverride?: string,
) {
  const traccarBase = traccarBaseOverride || resolveTraccarBase(req);
  const forwardedCookie = req?.headers?.cookie || "";
  const userResponse = await fetchWithOptionalServiceFallback(traccarBase, `/users/${userId}`, { method: "GET" }, forwardedCookie);
  if (!userResponse.ok) {
    throw new Error("Não foi possível carregar o usuário para redefinir a senha.");
  }

  const user = (await userResponse.json()) as TraccarUserResponse;
  const updateResponse = await fetchWithOptionalServiceFallback(
    traccarBase,
    `/users/${userId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...user,
        id: userId,
        password,
        attributes: {
          ...(user.attributes || {}),
          passwordResetCompletedAt: new Date().toISOString(),
        },
      }),
    },
    forwardedCookie,
  );

  if (!updateResponse.ok) {
    const detail = await updateResponse.text().catch(() => "");
    throw new Error(detail || "Não foi possível atualizar a senha do usuário.");
  }
}

export function resolvePublicAppUrl(req?: Pick<NextApiRequest, "headers">) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "http");
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").trim();
  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  const hostname = normalizeHostname(forwardedHost);
  const tenantWebsite = getTenantConfig(hostname).metadata?.website?.trim() || "";

  if (configured && isValidHttpUrl(configured)) {
    if (isPrivateNetworkUrl(configured)) {
      if (requestOrigin && !isPrivateNetworkUrl(requestOrigin)) {
        return requestOrigin.replace(/\/+$/, "");
      }

      if (tenantWebsite && !isPrivateNetworkUrl(tenantWebsite)) {
        return tenantWebsite.replace(/\/+$/, "");
      }
    }

    return configured.replace(/\/+$/, "");
  }

  if (requestOrigin) {
    return requestOrigin.replace(/\/+$/, "");
  }

  if (tenantWebsite) {
    return tenantWebsite.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

interface TraccarPositionResponse {
  deviceId: number;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TraccarEventResponse {
  deviceId: number;
  type: string;
  serverTime: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function getTraccarDevices(req?: Pick<NextApiRequest, "headers">) {
  const traccarBase = resolveTraccarBase(req);
  const response = await fetchWithOptionalServiceFallback(traccarBase, "/devices", { method: "GET" }, req?.headers?.cookie || "");
  if (!response.ok) {
    throw new Error("Não foi possível consultar os dispositivos no Traccar.");
  }

  return await response.json() as Record<string, unknown>[];
}

export async function getTraccarPositions(req?: Pick<NextApiRequest, "headers">) {
  const traccarBase = resolveTraccarBase(req);
  const response = await fetchWithOptionalServiceFallback(traccarBase, "/positions", { method: "GET" }, req?.headers?.cookie || "");
  if (!response.ok) {
    throw new Error("Não foi possível consultar as posições no Traccar.");
  }

  return await response.json() as TraccarPositionResponse[];
}

export async function getTraccarEvents(
  input: { deviceIds: number[]; from: string; to: string },
  req?: Pick<NextApiRequest, "headers">,
) {
  const traccarBase = resolveTraccarBase(req);
  const cookie = req?.headers?.cookie || "";

  const responses = await Promise.all(
    input.deviceIds.map(async (deviceId) => {
      const query = new URLSearchParams({
        deviceId: String(deviceId),
        from: input.from,
        to: input.to,
      }).toString();

      const response = await fetchWithOptionalServiceFallback(
        traccarBase,
        `/reports/events?${query}`,
        { method: "GET" },
        cookie,
      );

      if (!response.ok) {
        return [] as TraccarEventResponse[];
      }

      const events = await response.json() as TraccarEventResponse[];
      return Array.isArray(events) ? events : [];
    }),
  );

  return responses.flat();
}