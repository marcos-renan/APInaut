import http from "node:http";
import https from "node:https";
import { NextRequest, NextResponse } from "next/server";

type RequestPayload = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  bodyMode?: "none" | "json" | "text" | "multipart";
  body?: string;
  multipart?: Array<{
    enabled?: boolean;
    key?: string;
    valueType?: "text" | "file";
    value?: string;
    fileName?: string;
    mimeType?: string;
    fileData?: string;
  }>;
};

type RequestInput = {
  method: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
};

type UpstreamResult = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  cookies: string[];
  body: string;
  finalUrl: string;
  effectiveUrl: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

const bytesFromString = (value: string) => encoder.encode(value).length;

const bytesFromHeaders = (headers: Record<string, string>) =>
  Object.entries(headers).reduce(
    (total, [key, value]) => total + bytesFromString(key) + bytesFromString(value),
    0,
  );

const bytesFromBody = (value: string | ArrayBuffer | undefined) => {
  if (value === undefined) {
    return 0;
  }

  return value instanceof ArrayBuffer ? value.byteLength : bytesFromString(value);
};

const deleteHeaderCaseInsensitive = (headers: Record<string, string>, targetHeader: string) => {
  const target = targetHeader.toLowerCase();

  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      delete headers[key];
    }
  }
};

const escapeQuotedHeaderValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const buildMultipartBody = (
  fields: Array<{
    key: string;
    valueType: "text" | "file";
    value: string;
    fileName?: string;
    mimeType?: string;
    fileData?: string;
  }>,
) => {
  const boundary = `----apinaut-${crypto.randomUUID()}`;
  const chunks: Buffer[] = [];

  for (const field of fields) {
    if (!field.key.trim()) {
      continue;
    }

    chunks.push(Buffer.from(`--${boundary}\r\n`, "utf8"));

    if (field.valueType === "file") {
      const filename = field.fileName?.trim() || "upload.bin";
      const mimeType = field.mimeType?.trim() || "application/octet-stream";
      const encodedData = field.fileData?.trim() || "";

      if (!encodedData) {
        throw new Error(`Arquivo multipart ausente para o campo "${field.key}".`);
      }

      let fileBuffer: Buffer;

      try {
        fileBuffer = Buffer.from(encodedData, "base64");
      } catch {
        throw new Error(`Arquivo multipart invalido para o campo "${field.key}".`);
      }

      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${escapeQuotedHeaderValue(field.key)}"; filename="${escapeQuotedHeaderValue(filename)}"\r\n`,
          "utf8",
        ),
      );
      chunks.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`, "utf8"));
      chunks.push(fileBuffer);
      chunks.push(Buffer.from("\r\n", "utf8"));
      continue;
    }

    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${escapeQuotedHeaderValue(field.key)}"\r\n\r\n`,
        "utf8",
      ),
    );
    chunks.push(Buffer.from(field.value, "utf8"));
    chunks.push(Buffer.from("\r\n", "utf8"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  const merged = Buffer.concat(chunks);
  const body = merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength);

  return {
    boundary,
    body,
  };
};

const normalizeHostname = (hostname: string) => hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();

const isLoopbackHostname = (hostname: string) => {
  const clean = normalizeHostname(hostname);
  return LOOPBACK_HOSTS.has(clean) || clean.endsWith(".localhost");
};

const buildCandidateUrls = (rawUrl: string) => {
  const parsed = new URL(rawUrl);
  const host = normalizeHostname(parsed.hostname);
  const candidates = [parsed.toString()];

  const pushHostVariant = (hostname: string) => {
    const variant = new URL(parsed.toString());
    variant.hostname = hostname;
    candidates.push(variant.toString());
  };

  if (host === "localhost") {
    pushHostVariant("127.0.0.1");
    pushHostVariant("[::1]");
  } else if (host === "127.0.0.1") {
    pushHostVariant("localhost");
    pushHostVariant("[::1]");
  } else if (host === "::1") {
    pushHostVariant("localhost");
    pushHostVariant("127.0.0.1");
  } else if (host.endsWith(".localhost")) {
    pushHostVariant("localhost");
    pushHostVariant("127.0.0.1");
    pushHostVariant("[::1]");
  }

  if (isLoopbackHostname(parsed.hostname)) {
    const protocolVariant = new URL(parsed.toString());
    protocolVariant.protocol = parsed.protocol === "https:" ? "http:" : "https:";
    candidates.push(protocolVariant.toString());
  }

  return Array.from(new Set(candidates));
};

const formatNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = [error.message];
  const cause = error.cause;

  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code;
    const causeMessage = (cause as { message?: unknown }).message;

    if (typeof code === "string") {
      details.push(`code=${code}`);
    }

    if (typeof causeMessage === "string" && causeMessage !== error.message) {
      details.push(causeMessage);
    }
  }

  return details.join(" | ");
};

const runFetch = async (url: string, input: RequestInput): Promise<UpstreamResult> => {
  const response = await fetch(url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    cache: "no-store",
    redirect: "follow",
  });

  const body = await response.text();
  const headers: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers).filter((cookie) => cookie.trim().length > 0)
      : headers["set-cookie"]
        ? [headers["set-cookie"]]
        : [];

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    cookies,
    body,
    finalUrl: response.url,
    effectiveUrl: url,
  };
};

const runNodeLoopbackRequest = (parsed: URL, connectHost: string, input: RequestInput): Promise<UpstreamResult> =>
  new Promise((resolve, reject) => {
    const isHttps = parsed.protocol === "https:";
    const requestHeaders = { ...input.headers };
    const hasHostHeader = Object.keys(requestHeaders).some((key) => key.toLowerCase() === "host");

    if (!hasHostHeader) {
      requestHeaders.Host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    }

    const requestOptions = {
      protocol: parsed.protocol,
      hostname: connectHost,
      port: parsed.port || (isHttps ? "443" : "80"),
      path: `${parsed.pathname}${parsed.search}`,
      method: input.method,
      headers: requestHeaders,
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    };

    const handleResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const headers: Record<string, string> = {};
        const cookies = Array.isArray(res.headers["set-cookie"])
          ? res.headers["set-cookie"]
          : typeof res.headers["set-cookie"] === "string"
            ? [res.headers["set-cookie"]]
            : [];

        for (const [key, value] of Object.entries(res.headers)) {
          if (!key) {
            continue;
          }

          if (Array.isArray(value)) {
            headers[key] = value.join(", ");
            continue;
          }

          if (typeof value === "string") {
            headers[key] = value;
          }
        }

        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? "",
          headers,
          cookies,
          body,
          finalUrl: parsed.toString(),
          effectiveUrl: parsed.toString(),
        });
      });
    };

    const req = isHttps ? https.request(requestOptions, handleResponse) : http.request(requestOptions, handleResponse);

    req.setTimeout(15000, () => {
      req.destroy(new Error("Timeout ao conectar no endpoint local."));
    });

    req.on("error", reject);

    if (input.body !== undefined) {
      if (typeof input.body === "string") {
        req.write(input.body);
      } else {
        req.write(Buffer.from(input.body));
      }
    }

    req.end();
  });

const runLocalAliasFallback = async (candidateUrl: string, input: RequestInput): Promise<UpstreamResult> => {
  const parsed = new URL(candidateUrl);
  const connectTargets = ["127.0.0.1", "::1", "localhost"];
  const errors: string[] = [];

  for (const target of connectTargets) {
    try {
      return await runNodeLoopbackRequest(parsed, target, input);
    } catch (error) {
      errors.push(`${target} -> ${formatNetworkError(error)}`);
    }
  }

  throw new Error(`fallback loopback falhou: ${errors.join(" | ")}`);
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RequestPayload;

    if (!payload.url || typeof payload.url !== "string") {
      return NextResponse.json({ ok: false, error: "URL invalida." }, { status: 400 });
    }

    if (!payload.method || typeof payload.method !== "string") {
      return NextResponse.json({ ok: false, error: "Metodo invalido." }, { status: 400 });
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(payload.url);
    } catch {
      return NextResponse.json({ ok: false, error: "URL invalida." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { ok: false, error: "A URL precisa usar http:// ou https://." },
        { status: 400 },
      );
    }

    const normalizedMethod = payload.method.toUpperCase();
    const headers = { ...(payload.headers ?? {}) };

    if (METHODS_WITHOUT_BODY.has(normalizedMethod)) {
      deleteHeaderCaseInsensitive(headers, "content-length");
    }

    let requestBody: string | ArrayBuffer | undefined;

    if (!METHODS_WITHOUT_BODY.has(normalizedMethod)) {
      if (payload.bodyMode === "multipart") {
        const normalizedFields = Array.isArray(payload.multipart)
          ? payload.multipart
              .filter((field) => field && typeof field === "object" && field.enabled !== false)
              .map(
                (field): {
                  key: string;
                  valueType: "text" | "file";
                  value: string;
                  fileName?: string;
                  mimeType?: string;
                  fileData?: string;
                } => ({
                  key: typeof field.key === "string" ? field.key.trim() : "",
                  valueType: field.valueType === "file" ? "file" : "text",
                  value:
                    typeof field.value === "string"
                      ? field.value
                      : field.value === undefined || field.value === null
                        ? ""
                        : String(field.value),
                  fileName: typeof field.fileName === "string" ? field.fileName : undefined,
                  mimeType: typeof field.mimeType === "string" ? field.mimeType : undefined,
                  fileData: typeof field.fileData === "string" ? field.fileData : undefined,
                }),
              )
              .filter((field) => field.key.length > 0)
          : [];

        if (normalizedFields.length > 0) {
          const multipart = buildMultipartBody(normalizedFields);
          requestBody = multipart.body;
          deleteHeaderCaseInsensitive(headers, "content-type");
          deleteHeaderCaseInsensitive(headers, "content-length");
          headers["Content-Type"] = `multipart/form-data; boundary=${multipart.boundary}`;
        }
      } else if (typeof payload.body === "string") {
        requestBody = payload.body;
      }
    }

    const requestInput: RequestInput = {
      method: normalizedMethod,
      headers,
      body: METHODS_WITHOUT_BODY.has(normalizedMethod) ? undefined : requestBody,
    };

    const startedAt = performance.now();
    const candidateUrls = buildCandidateUrls(parsedUrl.toString());
    const attempts: string[] = [];
    let upstreamResult: UpstreamResult | null = null;

    for (const candidateUrl of candidateUrls) {
      try {
        upstreamResult = await runFetch(candidateUrl, requestInput);
        break;
      } catch (error) {
        attempts.push(`${candidateUrl} -> ${formatNetworkError(error)}`);

        const candidateParsed = new URL(candidateUrl);

        if (isLoopbackHostname(candidateParsed.hostname)) {
          try {
            upstreamResult = await runLocalAliasFallback(candidateUrl, requestInput);
            break;
          } catch (fallbackError) {
            attempts.push(`${candidateUrl} (fallback loopback) -> ${formatNetworkError(fallbackError)}`);
          }
        }
      }
    }

    if (!upstreamResult) {
      const details = attempts.length ? `\nTentativas:\n${attempts.map((item) => `- ${item}`).join("\n")}` : "";

      return NextResponse.json(
        {
          ok: false,
          error: `Falha ao conectar no endpoint.${details}`,
        },
        { status: 502 },
      );
    }

    const requestBytes =
      bytesFromString(requestInput.method) +
      bytesFromString(upstreamResult.effectiveUrl) +
      bytesFromHeaders(requestInput.headers) +
      bytesFromBody(requestInput.body);

    const responseBytes = bytesFromHeaders(upstreamResult.headers) + bytesFromString(upstreamResult.body);
    const totalBytes = requestBytes + responseBytes;

    return NextResponse.json({
      ok: true,
      response: {
        status: upstreamResult.status,
        statusText: upstreamResult.statusText,
        durationMs: performance.now() - startedAt,
        headers: upstreamResult.headers,
        cookies: upstreamResult.cookies,
        body: upstreamResult.body,
        finalUrl: upstreamResult.finalUrl,
        requestBytes,
        responseBytes,
        totalBytes,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao executar a requisicao.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
