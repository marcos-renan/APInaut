"use client";

import { Copy, Eye, EyeOff, Send } from "lucide-react";

import { CodeEditor } from "@/components/code-editor";
import { KeyValueEditor, MultipartFormEditor } from "@/components/request-editors";
import { StyledSelect } from "@/components/styled-select";
import type { ApiRequest } from "@/lib/collections";
import { METHOD_OPTIONS, METHOD_STYLE_MAP } from "@/lib/request-page-helpers";

type RequestTab = "params" | "body" | "auth" | "headers" | "script";
type ScriptTab = "pre-request" | "after-response";

type RequestEditorPanelProps = Record<string, any>;

export const RequestEditorPanel = (props: RequestEditorPanelProps) => {
  const {
    activeRequest,
    updateActiveRequest,
    templateVariableOptions,
    sendRequest,
    isSending,
    requestTab,
    setRequestTab,
    copyUrlPreview,
    urlPreview,
    urlPreviewCopied,
    updateRow,
    addRow,
    removeRow,
    handleTemplateTextFieldChange,
    handleTemplateTextFieldKeyDown,
    updateMultipartRow,
    addMultipartRow,
    removeMultipartRow,
    selectMultipartFile,
    showBearerToken,
    setShowBearerToken,
    showBasicPassword,
    setShowBasicPassword,
    scriptTab,
    setScriptTab,
  } = props;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-y border-white/10 bg-[#1a1728] px-0 py-3">
      {activeRequest ? (
        <>
          <div className="mb-3 shrink-0 px-3">
            <div className="grid gap-2 md:grid-cols-[110px_minmax(0,1fr)_40px]">
              <select
                value={activeRequest.method}
                onChange={(event) =>
                  updateActiveRequest((request: ApiRequest) => ({
                    ...request,
                    method: event.target.value as ApiRequest["method"],
                  }))
                }
                className={`h-10 rounded-lg border bg-[#121025] px-3 text-sm font-semibold outline-none ring-violet-400 transition focus:ring-2 ${
                  METHOD_STYLE_MAP[activeRequest.method as ApiRequest["method"]].select
                }`}
              >
                {METHOD_OPTIONS.map((method) => (
                  <option
                    key={method}
                    value={method}
                    style={{
                      color: METHOD_STYLE_MAP[method as ApiRequest["method"]].optionColor,
                      backgroundColor: "#121025",
                      fontWeight: 700,
                    }}
                  >
                    {method}
                  </option>
                ))}
              </select>

              <CodeEditor
                value={activeRequest.url}
                onChange={(nextUrl) =>
                  updateActiveRequest((request: ApiRequest) => ({
                    ...request,
                    url: nextUrl.replace(/\r?\n/g, ""),
                  }))
                }
                language="text"
                enableTemplateAutocomplete
                templateVariables={templateVariableOptions}
                lineNumbers={false}
                compact
                singleLine
                allowOverflowVisible
                height={40}
                className="h-10 min-w-0"
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

          <div className="mb-3 flex shrink-0 flex-wrap gap-2 border-b border-white/10 px-3 pb-3">
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

          <div className="min-h-0 flex-1 overflow-auto px-3">
            {requestTab === "params" && (
              <div className="h-full overflow-auto pr-1">
                <div className="mb-3 rounded-lg border border-white/10 bg-[#121025] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">URL Preview</p>
                    <button
                      type="button"
                      onClick={copyUrlPreview}
                      disabled={!urlPreview.value}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                        urlPreviewCopied
                          ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
                          : "border-white/15 bg-[#1a1728] text-zinc-200 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                      aria-label="Copiar URL preview"
                      title="Copiar URL preview"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  {urlPreview.error ? (
                    <p className="text-xs text-rose-300">{urlPreview.error}</p>
                  ) : (
                    <p className="break-all text-xs text-zinc-200">{urlPreview.value || "--"}</p>
                  )}
                </div>

                <KeyValueEditor
                  rows={activeRequest.params}
                  onChange={(rowId, field, value) => updateRow("params", rowId, field, value)}
                  onAdd={() => addRow("params")}
                  onRemove={(rowId) => removeRow("params", rowId)}
                  onTextFieldChange={handleTemplateTextFieldChange}
                  onTextFieldKeyDown={handleTemplateTextFieldKeyDown}
                />
              </div>
            )}

            {requestTab === "headers" && (
              <div className="h-full overflow-auto pr-1">
                <KeyValueEditor
                  rows={activeRequest.headers}
                  onChange={(rowId, field, value) => updateRow("headers", rowId, field, value)}
                  onAdd={() => addRow("headers")}
                  onRemove={(rowId) => removeRow("headers", rowId)}
                  onTextFieldChange={handleTemplateTextFieldChange}
                  onTextFieldKeyDown={handleTemplateTextFieldKeyDown}
                />
              </div>
            )}

            {requestTab === "body" && (
              <div className="flex h-full flex-col space-y-2">
                <StyledSelect
                  value={activeRequest.bodyMode}
                  onChange={(nextValue) =>
                    updateActiveRequest((request: ApiRequest) => ({
                      ...request,
                      bodyMode: nextValue as ApiRequest["bodyMode"],
                    }))
                  }
                  options={[
                    { value: "none", label: "Sem body" },
                    { value: "json", label: "JSON" },
                    { value: "text", label: "Text" },
                    { value: "multipart", label: "Multipart Form" },
                  ]}
                  triggerClassName="h-10 rounded-lg px-3 text-sm"
                />

                {activeRequest.bodyMode === "multipart" ? (
                  <div className="min-h-0 flex-1 overflow-auto pr-1">
                    <MultipartFormEditor
                      rows={activeRequest.bodyForm}
                      onChange={updateMultipartRow}
                      onAdd={addMultipartRow}
                      onRemove={removeMultipartRow}
                      onFileSelect={selectMultipartFile}
                      onTextFieldChange={handleTemplateTextFieldChange}
                      onTextFieldKeyDown={handleTemplateTextFieldKeyDown}
                    />
                  </div>
                ) : (
                  <CodeEditor
                    value={activeRequest.body}
                    onChange={(nextBody) =>
                      updateActiveRequest((request: ApiRequest) => ({
                        ...request,
                        body: nextBody,
                      }))
                    }
                    language={activeRequest.bodyMode === "json" ? "json" : "text"}
                    jsonColorPreset="response"
                    readOnly={activeRequest.bodyMode === "none"}
                    enableJsonAutocomplete={activeRequest.bodyMode === "json"}
                    enableTemplateAutocomplete={activeRequest.bodyMode !== "none"}
                    templateVariables={templateVariableOptions}
                    height={280}
                    className={activeRequest.bodyMode === "none" ? "min-h-0 flex-1 opacity-60" : "min-h-0 flex-1"}
                    placeholder={
                      activeRequest.bodyMode === "none"
                        ? "Selecione JSON, Text ou Multipart para habilitar o body."
                        : activeRequest.bodyMode === "json"
                          ? '{\n  "name": "APInaut"\n}'
                          : "Digite o body da requisicao."
                    }
                  />
                )}
              </div>
            )}

            {requestTab === "auth" && (
              <div className="space-y-3 overflow-visible pr-1">
                <StyledSelect
                  value={activeRequest.authType}
                  onChange={(nextValue) =>
                    updateActiveRequest((request: ApiRequest) => ({
                      ...request,
                      authType: nextValue as ApiRequest["authType"],
                    }))
                  }
                  options={[
                    { value: "none", label: "Nenhuma" },
                    { value: "bearer", label: "Bearer Token" },
                    { value: "basic", label: "Basic Auth" },
                  ]}
                  triggerClassName="h-10 rounded-lg px-3 text-sm"
                />

                {activeRequest.authType === "bearer" && (
                  <div className="relative">
                    <CodeEditor
                      value={activeRequest.bearerToken}
                      onChange={(nextValue) =>
                        updateActiveRequest((request: ApiRequest) => ({
                          ...request,
                          bearerToken: nextValue,
                        }))
                      }
                      language="text"
                      lineNumbers={false}
                      compact
                      singleLine
                      allowOverflowVisible
                      enableTemplateAutocomplete
                      templateVariables={templateVariableOptions}
                      concealText={!showBearerToken}
                      height={40}
                      className="h-10 min-w-0 [&_.cm-content]:pr-10 [&_.cm-line]:pr-10"
                      placeholder="Token"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBearerToken((current: boolean) => !current)}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-zinc-300 transition hover:text-white"
                      aria-label={showBearerToken ? "Ocultar token" : "Mostrar token"}
                      title={showBearerToken ? "Ocultar token" : "Mostrar token"}
                    >
                      {showBearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}

                {activeRequest.authType === "basic" && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <CodeEditor
                      value={activeRequest.basicUsername}
                      onChange={(nextValue) =>
                        updateActiveRequest((request: ApiRequest) => ({
                          ...request,
                          basicUsername: nextValue,
                        }))
                      }
                      language="text"
                      lineNumbers={false}
                      compact
                      singleLine
                      allowOverflowVisible
                      enableTemplateAutocomplete
                      templateVariables={templateVariableOptions}
                      height={40}
                      className="h-10 min-w-0"
                      placeholder="Username"
                    />
                    <div className="relative">
                      <CodeEditor
                        value={activeRequest.basicPassword}
                        onChange={(nextValue) =>
                          updateActiveRequest((request: ApiRequest) => ({
                            ...request,
                            basicPassword: nextValue,
                          }))
                        }
                        language="text"
                        lineNumbers={false}
                        compact
                        singleLine
                        allowOverflowVisible
                        enableTemplateAutocomplete
                        templateVariables={templateVariableOptions}
                        concealText={!showBasicPassword}
                        height={40}
                        className="h-10 min-w-0 [&_.cm-content]:pr-10 [&_.cm-line]:pr-10"
                        placeholder="Password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBasicPassword((current: boolean) => !current)}
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-zinc-300 transition hover:text-white"
                        aria-label={showBasicPassword ? "Ocultar senha" : "Mostrar senha"}
                        title={showBasicPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showBasicPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {requestTab === "script" && (
              <div className="flex h-full flex-col space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScriptTab("pre-request" as ScriptTab)}
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
                    onClick={() => setScriptTab("after-response" as ScriptTab)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition ${
                      scriptTab === "after-response"
                        ? "bg-violet-500 text-white"
                        : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    After-response
                  </button>
                </div>

                <CodeEditor
                  value={
                    scriptTab === "pre-request"
                      ? activeRequest.preRequestScript
                      : activeRequest.afterResponseScript
                  }
                  onChange={(nextScript) =>
                    updateActiveRequest((request: ApiRequest) =>
                      scriptTab === "pre-request"
                        ? { ...request, preRequestScript: nextScript }
                        : { ...request, afterResponseScript: nextScript },
                    )
                  }
                  language="javascript"
                  enableTemplateAutocomplete
                  templateVariables={templateVariableOptions}
                  height={280}
                  className="min-h-0 flex-1"
                  placeholder={
                    scriptTab === "pre-request"
                      ? "// apinaut.environment.set('baseUrl', 'http://localhost:8080');"
                      : "// const json = apinaut.response.json();\n// apinaut.environment.set('token', json.data.accessToken);"
                  }
                />

                <div className="rounded-lg border border-white/10 bg-[#121025] p-3 text-xs text-zinc-300">
                  <p className="font-medium text-zinc-200">Atalhos de script:</p>
                  <p className="mt-1">`apinaut.response.json()` para ler JSON da resposta.</p>
                  <p>
                    `apinaut.environment.set(&quot;token&quot;, &quot;...&quot;)` para salvar variavel no ambiente
                    ativo.
                  </p>
                  <p>
                    `apinaut.global.set(&quot;url_base&quot;, &quot;http://localhost:8080/&quot;)` para salvar no
                    ambiente global ativo.
                  </p>
                  <p className="mt-1 text-zinc-400">
                    Tambem funciona com compatibilidade: `insomnia.collectionVariables.set(...)`.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-400">Crie ou selecione uma requisicao para comecar.</p>
      )}
    </section>
  );
};
