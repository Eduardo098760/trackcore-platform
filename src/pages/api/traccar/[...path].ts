import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage } from "http";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [] } = req.query as { path?: string | string[] };
    const forwardPath = Array.isArray(path) ? path.join("/") : String(path || "");

    const addApiPrefer = process.env.TRACCAR_ADD_API !== "false";
    const base = resolveTraccarUrl(req);
    if (!base) {
      return res
        .status(400)
        .json({
          error: "Nenhum servidor configurado. Informe o endereço do servidor na tela de login.",
        });
    }
    const query = req.url?.split("?")[1];

    const makeUrl = (useApi: boolean) => {
      const targetPath = useApi
        ? forwardPath.startsWith("api")
          ? forwardPath
          : `api/${forwardPath}`
        : forwardPath;
      return query ? `${base}/${targetPath}?${query}` : `${base}/${targetPath}`;
    };

    const candidates = addApiPrefer ? [true, false] : [false, true];

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

    // Repassa content-type e content-length originais
    if (req.headers["content-type"]) headers["content-type"] = String(req.headers["content-type"]);
    if (rawBody && rawBody.length > 0) headers["content-length"] = String(rawBody.length);

    const fetchOptionsBase: RequestInit = {
      method: req.method,
      headers,
      body: rawBody && rawBody.length > 0 ? rawBody.toString() : undefined,
    };

    let lastError: any = null;

    for (const useApi of candidates) {
      const targetUrl = makeUrl(useApi);
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
          };
          continue;
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
        lastError = err;
      }
    }

    console.error("[traccar-proxy] all attempts failed", lastError);
    if (lastError?.status) {
      res.status(lastError.status).json({
        error: lastError.statusText || "Upstream error",
        details: lastError.body,
      });
    } else {
      res.status(502).json({
        error: "Bad Gateway",
        details: lastError?.message || String(lastError),
      });
    }
  } catch (error: any) {
    console.error("[traccar-proxy] handler error:", error?.message || error);
    res.status(500).json({ error: error?.message || "Proxy error" });
  }
}
