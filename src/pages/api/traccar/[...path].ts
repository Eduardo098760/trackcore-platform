import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage } from "http";
import { getLatestSmsGatewayLogByPhone } from "@/lib/server/sms-gateway-log-store";
import type { SmsProviderResponse } from "@/types";
import { getTenantServerUrl, normalizeHostname } from "@/config/tenants";

/**
 * Resolve a URL do servidor Traccar de forma dinâmica (multi-tenant).
 * Prioridade: header x-traccar-server > cookie traccar-server.
 * Retorna null se nenhum servidor foi configurado.
 */
function resolveTraccarUrl(req: NextApiRequest): string | null {
  // 1. Header customizado (set pelo ApiClient)
  const headerUrl = req.headers["x-traccar-server"] as string | undefined;
  if (headerUrl && /^https?:\/\//i.test(headerUrl)) {
    return headerUrl.replace(/\/+$/, "");
  }

  // 2. Cookie (set pela tela de login)
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/(?:^|;\s*)traccar-server=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (/^https?:\/\//i.test(decoded)) return decoded.replace(/\/+$/, "");
    } catch {}
  }

  // 3. Fallback pelo hostname do tenant
  const hostHeader = String(req.headers.host || "");
  const tenantHost = normalizeHostname(hostHeader);
  const tenantServerUrl = getTenantServerUrl(tenantHost);
  if (tenantServerUrl && /^https?:\/\//i.test(tenantServerUrl)) {
    return tenantServerUrl.replace(/\/+$/, "");
  }

  return null;
}

/**
 * Desabilita o body parser do Next.js para este proxy.
 * Assim o body raw é repassado diretamente ao Traccar sem nenhuma transformação.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Lê o body cru da request como Buffer.
 */
function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseCommandPayloadSafe(value: string) {
  const direct = parseJsonSafe<unknown>(value);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as {
      deviceId?: number;
      type?: string;
      textChannel?: boolean;
      attributes?: Record<string, unknown>;
    };
  }
  if (typeof direct === "string") {
    const nested = parseJsonSafe<unknown>(direct);
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as {
        deviceId?: number;
        type?: string;
        textChannel?: boolean;
        attributes?: Record<string, unknown>;
      };
    }
  }

  const normalized = value
    .trim()
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'/g, '"');

  const reparsed = parseJsonSafe<unknown>(normalized);
  if (reparsed && typeof reparsed === "object" && !Array.isArray(reparsed)) {
    return reparsed as {
      deviceId?: number;
      type?: string;
      textChannel?: boolean;
      attributes?: Record<string, unknown>;
    };
  }
  if (typeof reparsed === "string") {
    const nested = parseJsonSafe<unknown>(reparsed);
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as {
        deviceId?: number;
        type?: string;
        textChannel?: boolean;
        attributes?: Record<string, unknown>;
      };
    }
  }

  return null;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function ensureApiBase(url: string) {
  const normalized = url.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function getInternalTraccarApiBase() {
  const configured = process.env.TRACCAR_INTERNAL_URL?.trim();
  if (!configured || !/^https?:\/\//i.test(configured)) {
    return null;
  }
  return ensureApiBase(configured);
}

function getAuxiliaryTraccarHeaders(headers: Record<string, string>) {
  const nextHeaders: Record<string, string> = {};

  if (headers.cookie) {
    nextHeaders.cookie = headers.cookie;
  }

  if (headers.accept) {
    nextHeaders.accept = headers.accept;
  } else {
    nextHeaders.accept = "application/json";
  }

  return nextHeaders;
}

async function fetchDevicePhone(apiBase: string, headers: Record<string, string>, deviceId: number) {
  const response = await fetch(`${apiBase}/devices/${deviceId}`, {
    method: "GET",
    headers: getAuxiliaryTraccarHeaders(headers),
  });

  if (!response.ok) {
    return null;
  }

  const device = await response.json() as { phone?: string | null };
  return normalizePhone(device.phone || "") || null;
}

async function fetchJsonSafe<T>(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "GET",
    headers: getAuxiliaryTraccarHeaders(headers),
  });

  if (!response.ok) {
    return null;
  }

  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function extractSmsDevKey(url: string | null | undefined) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("key")?.trim() || "";
  } catch {
    return "";
  }
}

async function ensureSmsDevGatewayConfig(
  _req: NextApiRequest,
  apiBase: string,
  headers: Record<string, string>,
) {
  const requestHeaders = getAuxiliaryTraccarHeaders(headers);

  const serverResponse = await fetch(`${apiBase}/server`, {
    method: "GET",
    headers: requestHeaders,
  });

  if (!serverResponse.ok) {
    return;
  }

  const server = await serverResponse.json() as {
    attributes?: Record<string, string>;
  } & Record<string, unknown>;
  const attributes = { ...(server.attributes || {}) };
  if (attributes["sms.provider"] !== "smsdev") {
    return;
  }

  const smsDevKey = String(attributes["smsdev.apiKey"] || extractSmsDevKey(attributes["sms.http.url"]) || "").trim();
  if (!smsDevKey) {
    return;
  }

  const desiredUrl = "https://api.smsdev.com.br/v1/send";
  const desiredTemplate = JSON.stringify({
    key: smsDevKey,
    type: "9",
    number: "{phone}",
    msg: "{message}",
  });
  if (
    attributes["sms.http.url"] === desiredUrl &&
    String(attributes["sms.http.template"] || "") === desiredTemplate &&
    String(attributes["sms.http.authorization"] || "") === ""
  ) {
    return;
  }

  attributes["sms.http.url"] = desiredUrl;
  attributes["sms.http.template"] = desiredTemplate;
  attributes["sms.http.authorization"] = "";

  await fetch(`${apiBase}/server`, {
    method: "PUT",
    headers: {
      ...requestHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...server,
      attributes,
    }),
  }).catch(() => undefined);
}

async function collectCommandDiagnostics(
  apiBase: string,
  headers: Record<string, string>,
  commandPayload: { deviceId?: number; type?: string; textChannel?: boolean; attributes?: Record<string, unknown> } | null,
) {
  if (!commandPayload || typeof commandPayload.deviceId !== "number") {
    return null;
  }

  const deviceId = commandPayload.deviceId;
  const textChannel = !!commandPayload.textChannel;
  const [deviceList, supportedTypes] = await Promise.all([
    fetchJsonSafe<Array<{
      id: number;
      name?: string;
      uniqueId?: string;
      phone?: string | null;
      status?: string;
      positionId?: number | null;
      disabled?: boolean;
    }>>(`${apiBase}/devices?id=${deviceId}`, headers),
    fetchJsonSafe<Array<{ type?: string }>>(
      `${apiBase}/commands/types?deviceId=${deviceId}&textChannel=${textChannel}`,
      headers,
    ),
  ]);

  const device = deviceList?.[0] || null;
  const supportedCommandTypes = (supportedTypes || [])
    .map((item) => item.type)
    .filter((value): value is string => !!value);

  return {
    requestCommand: {
      type: commandPayload.type || null,
      textChannel,
      hasAttributes: !!commandPayload.attributes && Object.keys(commandPayload.attributes).length > 0,
      attributeKeys: commandPayload.attributes ? Object.keys(commandPayload.attributes) : [],
    },
    device: device
      ? {
          id: device.id,
          name: device.name || null,
          uniqueId: device.uniqueId || null,
          status: device.status || null,
          disabled: !!device.disabled,
          positionId: device.positionId ?? null,
          hasPhone: !!normalizePhone(device.phone || ""),
          phone: device.phone || null,
        }
      : null,
    supportedCommandTypes,
    commandSupported: !!commandPayload.type && supportedCommandTypes.includes(commandPayload.type),
  };
}

function summarizeCommandFailure(
  diagnostics: Awaited<ReturnType<typeof collectCommandDiagnostics>>,
  details: string | null,
) {
  if (!diagnostics) {
    return details || "Falha ao enviar comando."
  }

  if (!diagnostics.device) {
    return "Falha ao enviar comando: dispositivo não encontrado ou sem permissão de acesso."
  }

  if (diagnostics.device.disabled) {
    return "Falha ao enviar comando: o dispositivo está desativado."
  }

  if (diagnostics.requestCommand.textChannel && !diagnostics.device.hasPhone) {
    return "Falha ao enviar comando por SMS: o dispositivo não possui telefone configurado."
  }

  if (!diagnostics.commandSupported) {
    const supported = diagnostics.supportedCommandTypes.length
      ? diagnostics.supportedCommandTypes.join(", ")
      : "nenhum comando disponível";
    return `Falha ao enviar comando: o tipo ${diagnostics.requestCommand.type || "desconhecido"} não é suportado para este dispositivo. Suportados agora: ${supported}.`
  }

  if (details?.includes("SMS is not enabled")) {
    return "Falha ao enviar comando por SMS: o envio SMS não está habilitado no servidor."
  }

  if (details?.includes("SMS not configured")) {
    return "Falha ao enviar comando por SMS: o gateway SMS não está configurado no servidor."
  }

  if (details?.includes("Failed to encode command")) {
    return "Falha ao enviar comando: o protocolo do rastreador não conseguiu codificar esse comando."
  }

  if (details?.includes("is not supported")) {
    return `Falha ao enviar comando: o protocolo do dispositivo rejeitou o tipo ${diagnostics.requestCommand.type || "informado"}.`
  }

  return details || "Falha ao enviar comando."
}

async function waitForProviderResponse(phone: string): Promise<SmsProviderResponse | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const entry = await getLatestSmsGatewayLogByPhone(phone, 30000);
    if (entry?.response) {
      return entry.response;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [] } = req.query as { path?: string | string[] };
    const forwardPath = Array.isArray(path) ? path.join("/") : String(path || "");

    const addApiPrefer = process.env.TRACCAR_ADD_API !== "false";
    const base = resolveTraccarUrl(req);
    if (!base) {
      return res.status(400).json({
        error: "Nenhum servidor configurado. Informe o endereço do servidor na tela de login.",
      });
    }
    const query = req.url?.split("?")[1];

    const makeUrl = (useApi: boolean, baseUrl = base) => {
      const targetPath = useApi
        ? forwardPath.startsWith("api")
          ? forwardPath
          : `api/${forwardPath}`
        : forwardPath;
      return query ? `${baseUrl}/${targetPath}?${query}` : `${baseUrl}/${targetPath}`;
    };

    const defaultCandidates = addApiPrefer ? [true, false] : [false, true];
    const internalApiBase = getInternalTraccarApiBase();
    const publicApiBase = ensureApiBase(base);
    const candidateUrls =
      req.method === "POST" && forwardPath === "commands/send"
        ? [
            `${publicApiBase}/commands/send`,
            internalApiBase ? `${internalApiBase}/commands/send` : null,
          ].filter((url, index, items): url is string => !!url && items.indexOf(url) === index)
        : defaultCandidates.map((useApi) => makeUrl(useApi));
    const attemptedUrls: string[] = [];

    // Lê o body cru UMA vez (stream só pode ser lido uma vez)
    const isBodyMethod = !["GET", "HEAD"].includes((req.method || "").toUpperCase());
    const rawBody = isBodyMethod ? await getRawBody(req) : undefined;

    const headers: Record<string, string> = {};

    // Repassa cookies do browser (sessão Traccar é gerenciada pelo browser via set-cookie)
    if (req.headers.cookie) {
      headers["cookie"] = String(req.headers.cookie);
    }

    // Repassa Accept para que Traccar retorne JSON em vez de Excel nos reports
    if (req.headers["accept"]) headers["accept"] = String(req.headers["accept"]);
    else headers["accept"] = "application/json";

    const commandPayload =
      req.method === "POST" && forwardPath === "commands/send" && rawBody?.length
        ? parseCommandPayloadSafe(rawBody.toString())
        : null;

    const requestBodyText =
      req.method === "POST" && forwardPath === "commands/send" && commandPayload
        ? JSON.stringify(commandPayload)
        : rawBody && rawBody.length > 0
          ? rawBody.toString()
          : undefined;

    // Repassa content-type e content-length originais/normalizados
    if (req.headers["content-type"]) headers["content-type"] = String(req.headers["content-type"]);
    if (requestBodyText) headers["content-length"] = String(Buffer.byteLength(requestBodyText));

    const fetchOptionsBase: RequestInit = {
      method: req.method,
      headers,
      body: requestBodyText,
    };

    if (commandPayload?.textChannel) {
      await ensureSmsDevGatewayConfig(req, publicApiBase, headers);
    }

    let lastError: any = null;

    for (const targetUrl of candidateUrls) {
      attemptedUrls.push(targetUrl);
      try {
        console.log(
          "[traccar-proxy] ->",
          req.method,
          targetUrl,
          rawBody ? `body=${rawBody.length}b` : "",
        );
        const upstream = await fetch(targetUrl, fetchOptionsBase);
        const contentType = upstream.headers.get("content-type") || "application/json";
        const text = await upstream.text();

        if (upstream.status >= 400) {
          console.warn("[traccar-proxy] upstream error", upstream.status, "for", targetUrl);
          console.warn("[traccar-proxy] body:", text.slice(0, 500));
          lastError = {
            status: upstream.status,
            statusText: upstream.statusText,
            body: text,
            targetUrl,
          };
          // 405 ainda pode ser apenas variante de rota incorreta.
          // Em commands/send, qualquer outro erro ja representa a validacao real do servidor.
          if (req.method === "POST" && forwardPath === "commands/send" && upstream.status !== 405) {
            break;
          }
          if ([401, 403].includes(upstream.status)) {
            break;
          }
          continue;
        }

        if (
          commandPayload?.textChannel &&
          typeof commandPayload.deviceId === "number" &&
          contentType.includes("application/json")
        ) {
          const upstreamCommand = parseJsonSafe<Record<string, unknown>>(text);
          if (upstreamCommand && !Array.isArray(upstreamCommand)) {
            try {
              const deviceLookupBase = internalApiBase || publicApiBase;
              const phone = await fetchDevicePhone(deviceLookupBase, headers, commandPayload.deviceId);
              const providerResponse = phone ? await waitForProviderResponse(phone) : null;
              if (providerResponse) {
                res.status(upstream.status);
                res.setHeader("content-type", contentType);
                return res.send(JSON.stringify({
                  ...upstreamCommand,
                  providerResponse,
                }));
              }
            } catch (error: any) {
              console.warn("[traccar-proxy] provider response correlation failed", error?.message || error);
            }
          }
        }

        res.status(upstream.status);
        res.setHeader("content-type", contentType);

        // Repassa todos os set-cookie para preservar a sessão
        // Reescreve atributos do cookie para funcionar no domínio do proxy (não do Traccar)
        const setCookieHeaders = upstream.headers.getSetCookie?.() || [];
        if (setCookieHeaders.length > 0) {
          const host = req.headers.host || "";
          const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
          const rewritten = setCookieHeaders.map((raw) => {
            // Remove Domain e Path do Traccar — incompatíveis com o domínio do proxy
            let cookie = raw
              .replace(/;\s*Domain=[^;]*/gi, "")
              .replace(/;\s*Path=[^;]*/gi, "")
              .replace(/;\s*Secure\b/gi, "")
              .replace(/;\s*SameSite=[^;]*/gi, "");
            // Aplica atributos corretos para o ambiente atual
            cookie += "; Path=/; SameSite=Lax; HttpOnly";
            if (!isLocalhost) {
              cookie += "; Secure";
            }
            return cookie;
          });
          console.log(
            "[traccar-proxy] forwarding",
            rewritten.length,
            "set-cookie(s)",
            isLocalhost ? "(localhost mode)" : "(production mode)",
          );
          res.setHeader("set-cookie", rewritten);
        }

        return res.send(text);
      } catch (err: any) {
        console.error("[traccar-proxy] fetch error for", targetUrl, err?.message || err);
        lastError = {
          message: err?.message || String(err),
          targetUrl,
        };
      }
    }

    console.error("[traccar-proxy] all attempts failed", lastError);
    if (lastError?.status) {
      const commandDiagnostics =
        req.method === "POST" && forwardPath === "commands/send"
          ? await collectCommandDiagnostics(publicApiBase, headers, commandPayload)
          : null;
      const detailText = typeof lastError.body === "string" ? lastError.body : null;
      const message =
        req.method === "POST" && forwardPath === "commands/send"
          ? summarizeCommandFailure(commandDiagnostics, detailText)
          : (detailText || lastError.statusText || "Upstream error");

      res.status(lastError.status).json({
        error: lastError.statusText || "Upstream error",
        message,
        details: lastError.body,
        targetUrl: lastError.targetUrl,
        attemptedUrls,
        requestBody: commandPayload,
        commandDiagnostics,
      });
    } else {
      res.status(502).json({
        error: "Bad Gateway",
        details: lastError?.message || String(lastError),
        targetUrl: lastError?.targetUrl,
        attemptedUrls,
      });
    }
  } catch (error: any) {
    console.error("[traccar-proxy] handler error:", error?.message || error);
    res.status(500).json({ error: error?.message || "Proxy error" });
  }
}
