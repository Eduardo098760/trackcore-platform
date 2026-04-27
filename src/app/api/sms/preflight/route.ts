import { NextResponse } from "next/server";

type SmsPreflightPayload = {
  targetUrl?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SmsPreflightPayload | null;
    const targetUrl = body?.targetUrl?.trim();

    if (!targetUrl) {
      return NextResponse.json({ ok: false, error: "missing_target_url" }, { status: 400 });
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    let bodyText = rawText;
    let parsedBody: unknown = null;

    if (contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = null;
      }
    }

    if (bodyText.length > 500) {
      bodyText = `${bodyText.slice(0, 500)}...`;
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      contentType,
      body: parsedBody ?? bodyText,
    }, { status: response.ok ? 200 : response.status >= 400 ? response.status : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "sms_preflight_failed",
      },
      { status: 500 },
    );
  }
}