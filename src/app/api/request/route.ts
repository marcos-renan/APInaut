import { NextRequest, NextResponse } from "next/server";

type RequestPayload = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RequestPayload;

    if (!payload.url || typeof payload.url !== "string") {
      return NextResponse.json({ ok: false, error: "URL invalida." }, { status: 400 });
    }

    if (!payload.method || typeof payload.method !== "string") {
      return NextResponse.json({ ok: false, error: "Metodo invalido." }, { status: 400 });
    }

    const startedAt = performance.now();

    const upstream = await fetch(payload.url, {
      method: payload.method,
      headers: payload.headers ?? {},
      body: payload.body,
      cache: "no-store",
      redirect: "follow",
    });

    const body = await upstream.text();
    const headers: Record<string, string> = {};

    upstream.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return NextResponse.json({
      ok: true,
      response: {
        status: upstream.status,
        statusText: upstream.statusText,
        durationMs: performance.now() - startedAt,
        headers,
        body,
        finalUrl: upstream.url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao executar a requisicao.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
