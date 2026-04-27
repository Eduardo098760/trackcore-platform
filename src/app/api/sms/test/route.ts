import { NextResponse } from "next/server";

type TestSmsPayload = {
  url?: string;
  template?: string;
  authorization?: string;
  phone?: string;
  message?: string;
};

function replacePlaceholders(template: string, phone: string, message: string, encode = false) {
  const nextPhone = encode ? encodeURIComponent(phone) : phone;
  const nextMessage = encode ? encodeURIComponent(message) : message;

  return template
    .replaceAll("{phone}", nextPhone)
    .replaceAll("{message}", nextMessage);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function detectContentType(body: string) {
  const normalized = body.trim();
  if (normalized.startsWith("{") || normalized.startsWith("[")) {
    return "application/json";
  }

  if (normalized.includes("=") || normalized.includes("&")) {
    return "application/x-www-form-urlencoded;charset=UTF-8";
  }

  return "text/plain;charset=UTF-8";
}

function parseGatewayBody(responseText: string) {
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function isSmsDevSuccess(parsedBody: unknown) {
  if (Array.isArray(parsedBody)) {
    return parsedBody.every((entry) => entry?.situacao === "OK");
  }

  if (parsedBody && typeof parsedBody === "object" && "situacao" in parsedBody) {
    return (parsedBody as { situacao?: string }).situacao === "OK";
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TestSmsPayload;
    const rawUrl = body.url?.trim();
    const template = body.template?.trim() || "";
    const authorization = body.authorization?.trim() || "";
    const phone = normalizePhone(body.phone?.trim() || "");
    const message = body.message?.trim() || "";

    if (!rawUrl || !phone || !message) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const requestUrl = replacePlaceholders(rawUrl, phone, message, true);
    const requestBody = template ? replacePlaceholders(template, phone, message, false) : "";
    const headers: Record<string, string> = {};

    if (authorization) {
      headers.Authorization = authorization;
    }

    if (requestBody) {
      headers["Content-Type"] = detectContentType(requestBody);
    }

    const response = await fetch(requestUrl, {
      method: requestBody ? "POST" : "GET",
      headers,
      body: requestBody || undefined,
      cache: "no-store",
    });

    const responseText = await response.text();
    const parsedBody = parseGatewayBody(responseText);
    const smsDevSuccess =
      requestUrl.includes("api.smsdev.com.br/v1/send") || requestUrl.includes("/api/sms/gateway")
        ? isSmsDevSuccess(parsedBody)
        : null;
    const ok = smsDevSuccess ?? response.ok;

    return NextResponse.json({
      ok,
      status: response.status,
      body: parsedBody,
    }, { status: ok ? 200 : response.status >= 400 ? response.status : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "sms_test_failed",
      },
      { status: 500 },
    );
  }
}