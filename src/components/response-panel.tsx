"use client";

import { CodeEditor } from "@/components/code-editor";

type ResponseTab = "body" | "headers" | "cookies";
type ResponseBodyView = "code" | "web";
type ResponsePanelProps = Record<string, any>;

export const ResponsePanel = (props: ResponsePanelProps) => {
  const {
    requestError,
    result,
    hasSuccessfulResponse,
    statusDisplay,
    secondsDisplay,
    transferDisplay,
    responseTab,
    setResponseTab,
    responseBodyView,
    setResponseBodyView,
    responseWebPreviewDocument,
    responsePaneContent,
    responseLanguage,
    hasResponseError,
  } = props;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-y border-white/10 bg-[#1a1728] px-0 py-3">
      <div className="mb-2 grid shrink-0 grid-cols-3 gap-1 px-3">
        <div className="rounded-md border border-white/10 bg-[#121025] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Status</p>
          <p
            className={`mt-0.5 text-xs font-semibold ${
              requestError
                ? "text-rose-300"
                : result
                  ? hasSuccessfulResponse
                    ? "text-emerald-300"
                    : "text-rose-300"
                  : "text-zinc-300"
            }`}
          >
            {statusDisplay}
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121025] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Tempo</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-100">{secondsDisplay}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121025] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Transferido</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-100">{transferDisplay}</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#121025] px-0">
        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 p-1">
          {[
            { id: "body", label: "Body" },
            { id: "headers", label: "Headers" },
            { id: "cookies", label: "Cookies" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setResponseTab(tab.id as ResponseTab)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                responseTab === tab.id
                  ? "bg-violet-500 text-white"
                  : "text-zinc-300 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {responseTab === "body" && (
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 p-1">
            {[
              { id: "code", label: "Codigo" },
              { id: "web", label: "Web" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setResponseBodyView(mode.id as ResponseBodyView)}
                className={`rounded-md px-3 py-1.5 text-xs transition ${
                  responseBodyView === mode.id
                    ? "bg-violet-500 text-white"
                    : "text-zinc-300 hover:bg-white/10"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {responseTab === "body" && responseBodyView === "web" ? (
            <div className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-[#0f0d18]">
              {requestError ? (
                <div className="p-3 text-sm text-rose-300">
                  Nao foi possivel renderizar a pagina por erro na requisicao.
                </div>
              ) : !result ? (
                <div className="p-3 text-sm text-zinc-400">Nenhuma resposta ainda.</div>
              ) : (
                <iframe
                  title="Preview da resposta"
                  sandbox="allow-forms allow-scripts allow-same-origin"
                  srcDoc={responseWebPreviewDocument}
                  className="h-full w-full border-0 bg-white"
                />
              )}
            </div>
          ) : (
            <CodeEditor
              value={responsePaneContent}
              readOnly
              language={responseLanguage}
              jsonColorPreset="response"
              errorTone={hasResponseError}
              height="100%"
              className="h-full min-h-0 overflow-auto rounded-none border-0"
              placeholder={
                responseTab === "cookies"
                  ? "Nenhum cookie retornado."
                  : responseTab === "headers"
                    ? "Nenhum header retornado."
                    : "Nenhuma resposta ainda."
              }
            />
          )}
        </div>
      </div>
    </section>
  );
};
