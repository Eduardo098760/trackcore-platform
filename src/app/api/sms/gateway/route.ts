import { NextResponse } from "next/server";
import type { SmsProviderResponse } from "@/types";
import { appendSmsGatewayLog } from "@/lib/server/sms-gateway-log-store";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

type SmsGatewayRequestItem = {
  key: string;
  phone: string;
  message: string;
};

function hasAnyGatewayField(item: SmsGatewayRequestItem) {
  return !!(item.key || item.phone || item.message);
}

function getQueryParams(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim() || "";
  const phone = normalizePhone(url.searchParams.get("phone")?.trim() || "");
  const fallbackPhone = normalizePhone(url.searchParams.get("number")?.trim() || "");
  const message = url.searchParams.get("message")?.trim() || "";
  const fallbackMessage = url.searchParams.get("msg")?.trim() || "";
  return {
    key,
    phone: phone || fallbackPhone,
    message: message || fallbackMessage,
  };
}

function mapGatewayItem(item: unknown): SmsGatewayRequestItem {
  const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
  return {
    key: String(entry.key || "").trim(),
    phone: normalizePhone(String(entry.phone ?? entry.number ?? "").trim()),
    message: String(entry.message ?? entry.msg ?? "").trim(),
  };
}

function parseFormEncodedPayload(rawBody: string): SmsGatewayRequestItem[] {
  const params = new URLSearchParams(rawBody);
  const entry = {
    key: params.get("key")?.trim() || "",
    phone: normalizePhone((params.get("phone") || params.get("number") || "").trim()),
    message: (params.get("message") || params.get("msg") || "").trim(),
  };

  return hasAnyGatewayField(entry) ? [entry] : [];
}

async function getBodyPayload(req: Request): Promise<SmsGatewayRequestItem[]> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body) {
      return [];
    }

    const items = Array.isArray(body) ? body : [body];
    return items.map(mapGatewayItem).filter(hasAnyGatewayField);
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("text/plain")
  ) {
    const rawBody = await req.text().catch(() => "");
    if (!rawBody.trim()) {
      return [];
    }

    return parseFormEncodedPayload(rawBody);
  }

  return [];
}

async function getPayload(req: Request): Promise<SmsGatewayRequestItem[]> {
  const queryItem = getQueryParams(req);
  if (req.method === "GET") {
    return hasAnyGatewayField(queryItem) ? [queryItem] : [];
  }

  const bodyItems = await getBodyPayload(req);
  if (bodyItems.length > 0) {
    return bodyItems.map((item) => ({
      key: item.key || queryItem.key,
      phone: item.phone || queryItem.phone,
      message: item.message || queryItem.message,
    }));
  }

  return hasAnyGatewayField(queryItem) ? [queryItem] : [];
}

function buildSmsDevUrl(item: SmsGatewayRequestItem) {
  const upstreamUrl = new URL("https://api.smsdev.com.br/v1/send");
  upstreamUrl.searchParams.set("key", item.key);
  upstreamUrl.searchParams.set("type", "9");
  upstreamUrl.searchParams.set("number", item.phone);
  upstreamUrl.searchParams.set("msg", item.message);
  return upstreamUrl.toString();
}

function parseResponseText(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function extractProviderResponses(parsedBody: unknown): SmsProviderResponse[] {
  if (Array.isArray(parsedBody)) {
    return parsedBody.filter(
      (entry): entry is SmsProviderResponse =>
        !!entry && typeof entry === "object" && "situacao" in entry,
    );
  }

  if (parsedBody && typeof parsedBody === "object" && "situacao" in parsedBody) {
    return [parsedBody as SmsProviderResponse];
  }

  return [];
}

async function sendViaSmsDev(items: SmsGatewayRequestItem[]) {
  const responses = await Promise.all(
    items.map(async (item) => {
      const response = await fetch(buildSmsDevUrl(item), {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const rawText = await response.text();
      const parsedBody = parseResponseText(rawText);
      const providerResponses = extractProviderResponses(parsedBody);
      const ok = providerResponses.length > 0
        ? providerResponses.every((entry) => entry.situacao === "OK")
        : response.ok;

      await Promise.all(
        providerResponses.map(async (providerResponse) => {
          await appendSmsGatewayLog({
            provider: "smsdev",
            phone: item.phone,
            message: item.message,
            response: providerResponse,
            rawResponse: parsedBody,
          });
        }),
      );

      return {
        status: response.status,
        ok,
        parsedBody,
        providerResponses,
      };
    }),
  );

  const ok = responses.every((entry) => entry.ok);
  const status = ok
    ? 200
    : responses.find((entry) => entry.status >= 400)?.status || 502;
  const providerResponses = responses.flatMap((entry) => entry.providerResponses);
  const body = items.length === 1
    ? responses[0]?.parsedBody ?? null
    : responses.map((entry) => entry.parsedBody);

  return {
    ok,
    status,
    body,
    providerResponse: items.length === 1
      ? (providerResponses[0] ?? null)
      : providerResponses,
  };
}

async function handle(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("health") === "1") {
      return NextResponse.json({ ok: true, route: "sms-gateway", status: "ready" });
    }

    const items = await getPayload(req);

    if (!items.length || items.some((item) => !item.key || !item.phone || !item.message)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const result = await sendViaSmsDev(items);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status >= 400 ? result.status : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "sms_gateway_failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}