"use client";

import { useMemo } from "react";

import { useI18n } from "@/components/language-provider";
import { escapeHtml } from "@/lib/request-page-helpers";

type ResponseTab = "body" | "headers" | "cookies";

type RequestExecutionResult = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  cookies: string[];
  body: string;
  finalUrl: string;
  requestBytes: number;
  responseBytes: number;
  totalBytes: number;
};

type UseResponseStateParams = {
  result: RequestExecutionResult | null;
  requestError: string | null;
  scriptError: string | null;
  responseTab: ResponseTab;
};

export const useResponseState = ({
  result,
  requestError,
  scriptError,
  responseTab,
}: UseResponseStateParams) => {
  const { t } = useI18n();
  const prettyResponseBody = useMemo(() => {
    if (!result) {
      return "";
    }

    const contentType = result.headers["content-type"] ?? "";

    if (contentType.includes("application/json")) {
      try {
        return JSON.stringify(JSON.parse(result.body), null, 2);
      } catch {
        return result.body;
      }
    }

    return result.body;
  }, [result]);

  const responsePaneContent = useMemo(() => {
    const errors: string[] = [];

    if (requestError) {
      errors.push(`${t("state.requestError")}:\n${requestError}`);
    }

    if (scriptError) {
      errors.push(`${t("state.scriptError")}:\n${scriptError}`);
    }

    if (responseTab === "headers") {
      const headersContent = result ? JSON.stringify(result.headers, null, 2) : "";
      return errors.length ? [errors.join("\n\n"), headersContent].filter(Boolean).join("\n\n") : headersContent;
    }

    if (responseTab === "cookies") {
      const cookiesContent = result ? result.cookies.join("\n") : "";
      return errors.length ? [errors.join("\n\n"), cookiesContent].filter(Boolean).join("\n\n") : cookiesContent;
    }

    return errors.length
      ? [errors.join("\n\n"), prettyResponseBody].filter(Boolean).join("\n\n")
      : prettyResponseBody;
  }, [prettyResponseBody, requestError, responseTab, result, scriptError, t]);

  const responseWebPreviewDocument = useMemo(() => {
    if (!result) {
      return "";
    }

    const contentType = (result.headers["content-type"] ?? "").toLowerCase();
    const rawBody = result.body ?? "";
    const trimmedBody = rawBody.trim();
    const looksLikeHtml = /^<!doctype html/i.test(trimmedBody) || /^<html[\s>]/i.test(trimmedBody);

    if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || looksLikeHtml) {
      return rawBody;
    }

    return `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body style="margin:0;padding:12px;font-family:ui-monospace,Menlo,Consolas,monospace;background:#0f0d18;color:#e5e7eb;"><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(rawBody)}</pre></body></html>`;
  }, [result]);

  const hasResponseError = Boolean(requestError || scriptError);
  const responseLanguage = useMemo<"json" | "text">(() => {
    if (hasResponseError) {
      return "text";
    }

    if (responseTab === "headers") {
      return "json";
    }

    if (responseTab === "cookies") {
      return "text";
    }

    if (!result) {
      return "text";
    }

    const contentType = result.headers["content-type"] ?? "";

    if (contentType.includes("application/json")) {
      return "json";
    }

    try {
      JSON.parse(result.body);
      return "json";
    } catch {
      return "text";
    }
  }, [hasResponseError, responseTab, result]);

  const hasSuccessfulResponse = Boolean(result && result.status >= 200 && result.status < 300);
  const statusDisplay = requestError
    ? t("state.error")
    : result
      ? `${result.status} ${hasSuccessfulResponse ? t("state.ok") : t("state.error")}`
      : "--";
  const secondsDisplay = result ? `${(result.durationMs / 1000).toFixed(2)} s` : "--";
  const transferDisplay = result ? `${(result.totalBytes / 1024).toFixed(2)} KB` : "--";

  return {
    responsePaneContent,
    responseWebPreviewDocument,
    responseLanguage,
    hasResponseError,
    hasSuccessfulResponse,
    statusDisplay,
    secondsDisplay,
    transferDisplay,
  };
};
