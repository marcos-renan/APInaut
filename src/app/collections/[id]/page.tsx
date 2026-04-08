"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Send, Trash2 } from "lucide-react";
import {
  ApiRequest,
  KeyValueRow,
  createDefaultRequest,
  getCollectionsServerSnapshot,
  getCollectionsSnapshot,
  subscribeCollections,
  updateCollections,
} from "@/lib/collections";

type RequestTab = "params" | "body" | "auth" | "headers" | "script";
type ScriptTab = "pre-request" | "after-response";
type ResponseTab = "body" | "headers";

type RequestExecutionResult = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
};

const MIN_LEFT_PANEL_WIDTH = 170;
const MIN_CENTER_PANEL_WIDTH = 420;
const MIN_RIGHT_PANEL_WIDTH = 280;
const RESIZER_WIDTH = 1;

const createRow = (): KeyValueRow => ({
  id: crypto.randomUUID(),
  enabled: true,
  key: "",
  value: "",
});

const normalizeRowsForUi = (rows: KeyValueRow[]): KeyValueRow[] => {
  if (!rows.length) {
    return [createRow()];
  }

  return rows.map((row) => ({
    ...row,
    id: row.id || crypto.randomUUID(),
  }));
};

const createRequestForUi = (name: string): ApiRequest => ({
  ...createDefaultRequest(name),
  params: [createRow()],
  headers: [createRow()],
});

const buildUrlWithParams = (baseUrl: string, params: KeyValueRow[]) => {
  const url = new URL(baseUrl);

  for (const item of params) {
    if (!item.enabled) {
      continue;
    }

    const key = item.key.trim();

    if (!key) {
      continue;
    }

    url.searchParams.set(key, item.value);
  }

  return url.toString();
};

const buildHeaders = (request: ApiRequest): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (const item of request.headers) {
    if (!item.enabled) {
      continue;
    }

    const key = item.key.trim();

    if (!key) {
      continue;
    }

    headers[key] = item.value;
  }

  if (request.authType === "bearer" && request.bearerToken.trim()) {
    headers.Authorization = `Bearer ${request.bearerToken.trim()}`;
  }

  if (request.authType === "basic" && request.basicUsername) {
    const encoded = btoa(`${request.basicUsername}:${request.basicPassword}`);
    headers.Authorization = `Basic ${encoded}`;
  }

  if (request.bodyMode === "json" && request.body.trim() && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const runUserScript = (scriptCode: string, context: Record<string, unknown>) => {
  if (!scriptCode.trim()) {
    return;
  }

  const execute = new Function("context", `"use strict";\n${scriptCode}`);
  execute(context);
};

const KeyValueEditor = ({
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: KeyValueRow[];
  onChange: (id: string, field: keyof KeyValueRow, value: string | boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) => {
  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
        <span>Ativo</span>
        <span>Chave</span>
        <span>Valor</span>
        <span>Acao</span>
      </div>

      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px]">
          <label className="flex h-10 items-center justify-center rounded-lg border border-white/15 bg-[#121025]">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) => onChange(row.id, "enabled", event.target.checked)}
            />
          </label>
          <input
            value={row.key}
            onChange={(event) => onChange(row.id, "key", event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
            placeholder="authorization"
          />
          <input
            value={row.value}
            onChange={(event) => onChange(row.id, "value", event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
            placeholder="valor"
          />
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 text-zinc-200 transition hover:bg-white/10"
            aria-label="Remover linha"
            title="Remover linha"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
      >
        + Adicionar linha
      </button>
    </div>
  );
};

export default function CollectionDetailsPage() {
  const params = useParams<{ id: string }>();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const collections = useSyncExternalStore(
    subscribeCollections,
    getCollectionsSnapshot,
    getCollectionsServerSnapshot,
  );
  const [isMounted, setIsMounted] = useState(false);

  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const collection = useMemo(
    () => collections.find((item) => item.id === collectionId),
    [collections, collectionId],
  );

  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [scriptTab, setScriptTab] = useState<ScriptTab>("pre-request");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestExecutionResult | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(210);
  const [rightPanelWidth, setRightPanelWidth] = useState(340);
  const [resizingPane, setResizingPane] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!resizingPane) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const layout = layoutRef.current;

      if (!layout) {
        return;
      }

      const rect = layout.getBoundingClientRect();
      const totalHandleWidth = RESIZER_WIDTH * 2;

      if (resizingPane === "left") {
        const maxLeft = Math.max(
          MIN_LEFT_PANEL_WIDTH,
          rect.width - rightPanelWidth - MIN_CENTER_PANEL_WIDTH - totalHandleWidth,
        );
        const nextLeft = Math.min(
          Math.max(event.clientX - rect.left, MIN_LEFT_PANEL_WIDTH),
          maxLeft,
        );
        setLeftPanelWidth(nextLeft);
        return;
      }

      const maxRight = Math.max(
        MIN_RIGHT_PANEL_WIDTH,
        rect.width - leftPanelWidth - MIN_CENTER_PANEL_WIDTH - totalHandleWidth,
      );
      const nextRight = Math.min(
        Math.max(rect.right - event.clientX, MIN_RIGHT_PANEL_WIDTH),
        maxRight,
      );
      setRightPanelWidth(nextRight);
    };

    const onMouseUp = () => {
      setResizingPane(null);
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [leftPanelWidth, resizingPane, rightPanelWidth]);

  useEffect(() => {
    if (!collection?.requests.length) {
      setActiveRequestId(null);
      return;
    }

    const stillExists = collection.requests.some((request) => request.id === activeRequestId);

    if (!stillExists) {
      setActiveRequestId(collection.requests[0].id);
    }
  }, [collection, activeRequestId]);

  const activeRequest = useMemo(
    () => collection?.requests.find((request) => request.id === activeRequestId) ?? null,
    [collection, activeRequestId],
  );

  const updateCollectionRequests = (updater: (requests: ApiRequest[]) => ApiRequest[]) => {
    if (!collectionId) {
      return;
    }

    updateCollections((current) =>
      current.map((item) => {
        if (item.id !== collectionId) {
          return item;
        }

        return {
          ...item,
          requests: updater(item.requests),
        };
      }),
    );
  };

  const updateActiveRequest = (updater: (request: ApiRequest) => ApiRequest) => {
    if (!activeRequestId) {
      return;
    }

    updateCollectionRequests((requests) =>
      requests.map((request) => {
        if (request.id !== activeRequestId) {
          return request;
        }

        const nextRequest = updater(request);

        return {
          ...nextRequest,
          params: normalizeRowsForUi(nextRequest.params),
          headers: normalizeRowsForUi(nextRequest.headers),
        };
      }),
    );
  };

  const updateRow = (
    area: "params" | "headers",
    rowId: string,
    field: keyof KeyValueRow,
    value: string | boolean,
  ) => {
    updateActiveRequest((request) => ({
      ...request,
      [area]: request[area].map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
  };

  const addRow = (area: "params" | "headers") => {
    updateActiveRequest((request) => ({
      ...request,
      [area]: [...request[area], createRow()],
    }));
  };

  const removeRow = (area: "params" | "headers", rowId: string) => {
    updateActiveRequest((request) => {
      const filtered = request[area].filter((row) => row.id !== rowId);

      return {
        ...request,
        [area]: filtered.length ? filtered : [createRow()],
      };
    });
  };

  const createRequest = () => {
    const nextName = `Requisicao ${collection ? collection.requests.length + 1 : 1}`;
    const newRequest = createRequestForUi(nextName);

    updateCollectionRequests((requests) => [newRequest, ...requests]);
    setActiveRequestId(newRequest.id);
    setResult(null);
    setRequestError(null);
    setScriptError(null);
  };

  const prettyResponseBody = useMemo(() => {
    if (!result) {
      return "Nenhuma resposta ainda.";
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

  const sendRequest = async () => {
    if (!activeRequest) {
      return;
    }

    setIsSending(true);
    setRequestError(null);
    setScriptError(null);

    try {
      const finalUrl = buildUrlWithParams(activeRequest.url.trim(), activeRequest.params);

      const payload: {
        method: ApiRequest["method"];
        url: string;
        headers: Record<string, string>;
        body?: string;
      } = {
        method: activeRequest.method,
        url: finalUrl,
        headers: buildHeaders(activeRequest),
      };

      if (activeRequest.bodyMode !== "none" && activeRequest.body.trim()) {
        payload.body = activeRequest.body;
      }

      try {
        runUserScript(activeRequest.preRequestScript, {
          request: payload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no script pre-request.";
        setScriptError(message);
      }

      const response = await fetch("/api/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | { ok: true; response: RequestExecutionResult }
        | { ok: false; error: string };

      if (!data.ok) {
        setRequestError(data.error);
        setResult(null);
        return;
      }

      const resultPayload = data.response;

      try {
        runUserScript(activeRequest.afterResponseScript, {
          request: payload,
          response: resultPayload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no script after-response.";
        setScriptError(message);
      }

      setResult(resultPayload);
      setResponseTab("body");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao enviar requisicao.";
      setRequestError(message);
      setResult(null);
    } finally {
      setIsSending(false);
    }
  };

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[#100e1a] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-white/10 bg-[#1a1728] p-6">
          <p className="text-sm text-zinc-300">Carregando colecao...</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="min-h-screen bg-[#100e1a] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-4xl space-y-4 rounded-xl border border-white/10 bg-[#1a1728] p-6">
          <h1 className="text-xl font-semibold">Colecao nao encontrada</h1>
          <p className="text-sm text-zinc-300">
            Essa colecao nao existe mais ou foi removida do armazenamento local.
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
          >
            Voltar para colecoes
          </Link>
        </div>
      </main>
    );
  }

  const desktopGridStyle = {
    "--left-pane-width": `${leftPanelWidth}px`,
    "--right-pane-width": `${rightPanelWidth}px`,
  } as CSSProperties;

  return (
    <main className="min-h-screen bg-[#100e1a] text-white">
      <div className="flex w-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Voltar para colecoes
            </Link>
            <h1 className="text-xl font-semibold">{collection.name}</h1>
          </div>

          <button
            type="button"
            onClick={createRequest}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
          >
            Nova requisicao
          </button>
        </div>

        <div
          ref={layoutRef}
          className="grid gap-0 xl:[grid-template-columns:var(--left-pane-width)_1px_minmax(0,1fr)_1px_var(--right-pane-width)]"
          style={desktopGridStyle}
        >
          <aside className="border-y border-white/10 bg-[#1a1728] p-3">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">Requisicoes</h2>
            <div className="space-y-2">
              {collection.requests.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-zinc-400">
                  Nenhuma requisicao ainda.
                </p>
              )}

              {collection.requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => {
                    setActiveRequestId(request.id);
                    setResult(null);
                    setRequestError(null);
                    setScriptError(null);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activeRequestId === request.id
                      ? "border-violet-300/50 bg-violet-500/20"
                      : "border-white/10 bg-[#121025] hover:bg-[#1f1b33]"
                  }`}
                >
                  <p className="text-xs text-zinc-400">{request.method}</p>
                  <p className="truncate font-medium text-zinc-100">{request.name}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="relative hidden bg-white/10 xl:block">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                setResizingPane("left");
              }}
              className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 cursor-col-resize"
              aria-label="Redimensionar painel de requisicoes"
            />
          </div>

          <section className="border-y border-white/10 bg-[#1a1728] p-5">
            {activeRequest ? (
              <>
                <div className="mb-3 grid gap-2">
                  <input
                    value={activeRequest.name}
                    onChange={(event) =>
                      updateActiveRequest((request) => ({
                        ...request,
                        name: event.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm font-medium outline-none ring-violet-400 transition focus:ring-2"
                    placeholder="Nome da requisicao"
                  />

                  <div className="grid gap-2 md:grid-cols-[120px_1fr_120px]">
                    <select
                      value={activeRequest.method}
                      onChange={(event) =>
                        updateActiveRequest((request) => ({
                          ...request,
                          method: event.target.value as ApiRequest["method"],
                        }))
                      }
                      className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>

                    <input
                      value={activeRequest.url}
                      onChange={(event) =>
                        updateActiveRequest((request) => ({
                          ...request,
                          url: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                      placeholder="https://api.exemplo.com/recurso"
                    />

                    <button
                      type="button"
                      onClick={sendRequest}
                      disabled={isSending}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label={isSending ? "Enviando requisicao" : "Enviar requisicao"}
                      title={isSending ? "Enviando..." : "Enviar"}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 border-b border-white/10 pb-3">
                  {[
                    { id: "params", label: "Params" },
                    { id: "body", label: "Body" },
                    { id: "auth", label: "Auth" },
                    { id: "headers", label: "Headers" },
                    { id: "script", label: "Script" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRequestTab(tab.id as RequestTab)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        requestTab === tab.id ? "bg-violet-500 text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[360px]">
                  {requestTab === "params" && (
                    <KeyValueEditor
                      rows={activeRequest.params}
                      onChange={(rowId, field, value) => updateRow("params", rowId, field, value)}
                      onAdd={() => addRow("params")}
                      onRemove={(rowId) => removeRow("params", rowId)}
                    />
                  )}

                  {requestTab === "headers" && (
                    <KeyValueEditor
                      rows={activeRequest.headers}
                      onChange={(rowId, field, value) => updateRow("headers", rowId, field, value)}
                      onAdd={() => addRow("headers")}
                      onRemove={(rowId) => removeRow("headers", rowId)}
                    />
                  )}

                  {requestTab === "body" && (
                    <div className="space-y-3">
                      <select
                        value={activeRequest.bodyMode}
                        onChange={(event) =>
                          updateActiveRequest((request) => ({
                            ...request,
                            bodyMode: event.target.value as ApiRequest["bodyMode"],
                          }))
                        }
                        className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                      >
                        <option value="none">Sem body</option>
                        <option value="json">JSON</option>
                        <option value="text">Text</option>
                      </select>

                      <textarea
                        value={activeRequest.body}
                        onChange={(event) =>
                          updateActiveRequest((request) => ({
                            ...request,
                            body: event.target.value,
                          }))
                        }
                        disabled={activeRequest.bodyMode === "none"}
                        className="h-[280px] w-full rounded-lg border border-white/15 bg-[#121025] p-3 text-sm outline-none ring-violet-400 transition focus:ring-2 disabled:opacity-60"
                        placeholder='{"name":"APInaut"}'
                      />
                    </div>
                  )}

                  {requestTab === "auth" && (
                    <div className="space-y-3">
                      <select
                        value={activeRequest.authType}
                        onChange={(event) =>
                          updateActiveRequest((request) => ({
                            ...request,
                            authType: event.target.value as ApiRequest["authType"],
                          }))
                        }
                        className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                      >
                        <option value="none">Nenhuma</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                      </select>

                      {activeRequest.authType === "bearer" && (
                        <input
                          value={activeRequest.bearerToken}
                          onChange={(event) =>
                            updateActiveRequest((request) => ({
                              ...request,
                              bearerToken: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                          placeholder="Token"
                        />
                      )}

                      {activeRequest.authType === "basic" && (
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            value={activeRequest.basicUsername}
                            onChange={(event) =>
                              updateActiveRequest((request) => ({
                                ...request,
                                basicUsername: event.target.value,
                              }))
                            }
                            className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                            placeholder="Username"
                          />
                          <input
                            type="password"
                            value={activeRequest.basicPassword}
                            onChange={(event) =>
                              updateActiveRequest((request) => ({
                                ...request,
                                basicPassword: event.target.value,
                              }))
                            }
                            className="h-10 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                            placeholder="Password"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {requestTab === "script" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setScriptTab("pre-request")}
                          className={`rounded-lg px-3 py-1.5 text-sm transition ${
                            scriptTab === "pre-request"
                              ? "bg-violet-500 text-white"
                              : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          Pre-request
                        </button>
                        <button
                          type="button"
                          onClick={() => setScriptTab("after-response")}
                          className={`rounded-lg px-3 py-1.5 text-sm transition ${
                            scriptTab === "after-response"
                              ? "bg-violet-500 text-white"
                              : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          After-response
                        </button>
                      </div>

                      {scriptTab === "pre-request" && (
                        <textarea
                          value={activeRequest.preRequestScript}
                          onChange={(event) =>
                            updateActiveRequest((request) => ({
                              ...request,
                              preRequestScript: event.target.value,
                            }))
                          }
                          className="h-[280px] w-full rounded-lg border border-white/15 bg-[#121025] p-3 text-sm font-mono outline-none ring-violet-400 transition focus:ring-2"
                          placeholder="// context.request.method = 'POST';"
                        />
                      )}

                      {scriptTab === "after-response" && (
                        <textarea
                          value={activeRequest.afterResponseScript}
                          onChange={(event) =>
                            updateActiveRequest((request) => ({
                              ...request,
                              afterResponseScript: event.target.value,
                            }))
                          }
                          className="h-[280px] w-full rounded-lg border border-white/15 bg-[#121025] p-3 text-sm font-mono outline-none ring-violet-400 transition focus:ring-2"
                          placeholder="// console.log(context.response.status);"
                        />
                      )}

                      <p className="text-xs text-zinc-400">
                        Os scripts sao opcionais. Quando preenchidos, executam com o objeto context.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Crie ou selecione uma requisicao para comecar.</p>
            )}
          </section>

          <div className="relative hidden bg-white/10 xl:block">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                setResizingPane("right");
              }}
              className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 cursor-col-resize"
              aria-label="Redimensionar painel de resposta"
            />
          </div>

          <section className="border-y border-white/10 bg-[#1a1728] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">Resposta da API</h2>
                {result && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {result.status} {result.statusText} | {Math.round(result.durationMs)} ms | {result.body.length} chars
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResponseTab("body")}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    responseTab === "body"
                      ? "bg-violet-500 text-white"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Body
                </button>
                <button
                  type="button"
                  onClick={() => setResponseTab("headers")}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    responseTab === "headers"
                      ? "bg-violet-500 text-white"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Headers
                </button>
              </div>
            </div>

            {requestError && (
              <p className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {requestError}
              </p>
            )}

            {scriptError && (
              <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                {scriptError}
              </p>
            )}

            <pre className="h-[520px] overflow-auto rounded-lg border border-white/10 bg-[#121025] p-3 text-xs text-zinc-100">
              {responseTab === "body"
                ? prettyResponseBody
                : result
                  ? JSON.stringify(result.headers, null, 2)
                  : "Nenhuma resposta ainda."}
            </pre>

            {result && (
              <p className="mt-2 truncate text-xs text-zinc-500">URL final: {result.finalUrl}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
