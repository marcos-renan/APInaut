"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
type ModalVariable = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

type ModalEnvironment = {
  id: string;
  name: string;
  variables: ModalVariable[];
};

type EnvironmentModalProps = {
  environments: ModalEnvironment[];
  globalEnvironments: ModalEnvironment[];
  collection: { activeEnvironmentId: string | null };
  globalEnvironmentState: { activeEnvironmentId: string | null };
  editingEnvironment: ModalEnvironment | null;
  editingGlobalEnvironment: ModalEnvironment | null;
  [key: string]: any;
};

export const EnvironmentModal = (props: EnvironmentModalProps) => {
  const {
    isEnvironmentModalOpen,
    closeEnvironmentModal,
    setEnvironmentModalScope,
    environmentModalScope,
    newEnvironmentName,
    setNewEnvironmentName,
    createEnvironment,
    environments,
    editingEnvironmentId,
    collection,
    editingEnvironmentNameId,
    pendingDeleteEnvironmentId,
    setEditingEnvironmentId,
    startEditingEnvironmentName,
    editingEnvironmentName,
    setEditingEnvironmentName,
    commitEditingEnvironmentName,
    cancelEditingEnvironmentName,
    handleDeleteEnvironmentClick,
    newGlobalEnvironmentName,
    setNewGlobalEnvironmentName,
    createGlobalEnvironment,
    globalEnvironments,
    editingGlobalEnvironmentId,
    globalEnvironmentState,
    editingGlobalEnvironmentNameId,
    pendingDeleteGlobalEnvironmentId,
    setEditingGlobalEnvironmentId,
    startEditingGlobalEnvironmentName,
    editingGlobalEnvironmentName,
    setEditingGlobalEnvironmentName,
    commitEditingGlobalEnvironmentName,
    cancelEditingGlobalEnvironmentName,
    handleDeleteGlobalEnvironmentClick,
    editingEnvironment,
    setActiveEnvironmentId,
    pendingDeleteEnvironmentVariableKey,
    updateEnvironmentVariable,
    handleRemoveEnvironmentVariableClick,
    addEnvironmentVariable,
    editingGlobalEnvironment,
    setActiveGlobalEnvironmentId,
    pendingDeleteGlobalEnvironmentVariableKey,
    updateGlobalEnvironmentVariable,
    handleRemoveGlobalEnvironmentVariableClick,
    addGlobalEnvironmentVariable,
  } = props;

  return (
    <>
      {isEnvironmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 pb-4 pl-4 pr-4 pt-14"
          onClick={closeEnvironmentModal}
        >
          <div
            className="flex max-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#151225] shadow-[0_12px_42px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">Gerenciar ambientes</h2>
              <button
                type="button"
                onClick={closeEnvironmentModal}
                className="rounded-md border border-white/20 px-2 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="grid min-h-[420px] min-h-0 flex-1 gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#121025] p-3">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnvironmentModalScope("local")}
                    className={`h-8 rounded-md border text-xs font-medium transition ${
                      environmentModalScope === "local"
                        ? "border-violet-300/55 bg-violet-500/25 text-violet-100"
                        : "border-white/15 bg-[#0e0b1c] text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    Locais
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironmentModalScope("global")}
                    className={`h-8 rounded-md border text-xs font-medium transition ${
                      environmentModalScope === "global"
                        ? "border-violet-300/55 bg-violet-500/25 text-violet-100"
                        : "border-white/15 bg-[#0e0b1c] text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    Globais
                  </button>
                </div>

                {environmentModalScope === "local" ? (
                  <>
                    <div className="space-y-2">
                      <input
                        value={newEnvironmentName}
                        onChange={(event) => setNewEnvironmentName(event.target.value)}
                        className="h-9 w-full rounded-md border border-white/15 bg-[#0e0b1c] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                        placeholder="Nome do ambiente local"
                      />
                      <button
                        type="button"
                        onClick={createEnvironment}
                        className="h-9 w-full rounded-md border border-violet-300/45 bg-violet-500/15 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
                      >
                        Criar ambiente local
                      </button>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
                      {environments.length === 0 && (
                        <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                          Nenhum ambiente local criado.
                        </p>
                      )}

                      {environments.map((environment) => {
                        const isSelected = editingEnvironmentId === environment.id;
                        const isActive = collection.activeEnvironmentId === environment.id;
                        const isNameEditing = editingEnvironmentNameId === environment.id;
                        const isDeletePending = pendingDeleteEnvironmentId === environment.id;

                        return (
                          <div
                            key={environment.id}
                            className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition ${
                              isSelected
                                ? "border-violet-300/55 bg-violet-500/20"
                                : "border-white/10 bg-[#18142d] hover:bg-[#201b36]"
                            }`}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setEditingEnvironmentId(environment.id)}
                              onDoubleClick={() => startEditingEnvironmentName(environment.id, environment.name)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingEnvironmentId(environment.id);
                                }
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2"
                            >
                              {isNameEditing ? (
                                <input
                                  autoFocus
                                  value={editingEnvironmentName}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => setEditingEnvironmentName(event.target.value)}
                                  onBlur={commitEditingEnvironmentName}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitEditingEnvironmentName();
                                    } else if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelEditingEnvironmentName();
                                    }
                                  }}
                                  className="h-8 w-full min-w-0 rounded-md border border-violet-300/45 bg-[#0f0c1f] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                                />
                              ) : (
                                <span className="truncate text-zinc-100">{environment.name}</span>
                              )}
                              {isActive && (
                                <span className="rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                                  ativo
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteEnvironmentClick(environment.id);
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                                isDeletePending
                                  ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                                  : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                              }`}
                              aria-label={
                                isDeletePending
                                  ? "Clique novamente para deletar ambiente"
                                  : "Deletar ambiente"
                              }
                              title={isDeletePending ? "Clique novamente para deletar" : "Deletar ambiente"}
                            >
                              {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <input
                        value={newGlobalEnvironmentName}
                        onChange={(event) => setNewGlobalEnvironmentName(event.target.value)}
                        className="h-9 w-full rounded-md border border-white/15 bg-[#0e0b1c] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                        placeholder="Nome do ambiente global"
                      />
                      <button
                        type="button"
                        onClick={createGlobalEnvironment}
                        className="h-9 w-full rounded-md border border-violet-300/45 bg-violet-500/15 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
                      >
                        Criar ambiente global
                      </button>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
                      {globalEnvironments.length === 0 && (
                        <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                          Nenhum ambiente global criado.
                        </p>
                      )}

                      {globalEnvironments.map((environment) => {
                        const isSelected = editingGlobalEnvironmentId === environment.id;
                        const isActive = globalEnvironmentState.activeEnvironmentId === environment.id;
                        const isNameEditing = editingGlobalEnvironmentNameId === environment.id;
                        const isDeletePending = pendingDeleteGlobalEnvironmentId === environment.id;

                        return (
                          <div
                            key={environment.id}
                            className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition ${
                              isSelected
                                ? "border-violet-300/55 bg-violet-500/20"
                                : "border-white/10 bg-[#18142d] hover:bg-[#201b36]"
                            }`}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setEditingGlobalEnvironmentId(environment.id)}
                              onDoubleClick={() =>
                                startEditingGlobalEnvironmentName(environment.id, environment.name)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingGlobalEnvironmentId(environment.id);
                                }
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2"
                            >
                              {isNameEditing ? (
                                <input
                                  autoFocus
                                  value={editingGlobalEnvironmentName}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => setEditingGlobalEnvironmentName(event.target.value)}
                                  onBlur={commitEditingGlobalEnvironmentName}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitEditingGlobalEnvironmentName();
                                    } else if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelEditingGlobalEnvironmentName();
                                    }
                                  }}
                                  className="h-8 w-full min-w-0 rounded-md border border-violet-300/45 bg-[#0f0c1f] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                                />
                              ) : (
                                <span className="truncate text-zinc-100">{environment.name}</span>
                              )}
                              {isActive && (
                                <span className="rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                                  ativo
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteGlobalEnvironmentClick(environment.id);
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                                isDeletePending
                                  ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                                  : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                              }`}
                              aria-label={
                                isDeletePending
                                  ? "Clique novamente para deletar ambiente"
                                  : "Deletar ambiente"
                              }
                              title={isDeletePending ? "Clique novamente para deletar" : "Deletar ambiente"}
                            >
                              {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>

              <section className="flex min-h-0 flex-col overflow-hidden p-4">
                {environmentModalScope === "local" ? (
                  editingEnvironment ? (
                    <>
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <p className="truncate text-sm font-medium text-zinc-100">{editingEnvironment.name}</p>
                        <button
                          type="button"
                          onClick={() => setActiveEnvironmentId(editingEnvironment.id)}
                          className={`h-10 rounded-md border px-3 text-sm transition ${
                            collection.activeEnvironmentId === editingEnvironment.id
                              ? "border-emerald-300/55 bg-emerald-500/20 text-emerald-100"
                              : "border-white/20 text-zinc-200 hover:bg-white/10"
                          }`}
                        >
                          {collection.activeEnvironmentId === editingEnvironment.id ? "Ambiente local ativo" : "Ativar"}
                        </button>
                      </div>

                      <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
                        <div className="mb-2 hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
                          <span>Ativo</span>
                          <span>Variavel</span>
                          <span>Valor</span>
                          <span>Acao</span>
                        </div>

                        <div className="space-y-2">
                          {editingEnvironment.variables.map((variable) => {
                            const variableDeleteKey = `${editingEnvironment.id}:${variable.id}`;
                            const isDeletePending = pendingDeleteEnvironmentVariableKey === variableDeleteKey;

                            return (
                              <div
                                key={variable.id}
                                className="grid gap-2 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px]"
                              >
                              <button
                                type="button"
                                onClick={() =>
                                  updateEnvironmentVariable(
                                    editingEnvironment.id,
                                    variable.id,
                                    "enabled",
                                    !variable.enabled,
                                  )
                                }
                                className={`flex h-10 items-center justify-center rounded-lg border transition ${
                                  variable.enabled
                                    ? "border-emerald-300/60 bg-emerald-500/15 hover:bg-emerald-500/20"
                                    : "border-white/15 bg-[#121025] hover:bg-white/10"
                                }`}
                                aria-pressed={variable.enabled}
                                aria-label={variable.enabled ? "Desativar variavel" : "Ativar variavel"}
                              >
                                <span
                                  className={`relative h-5 w-9 rounded-full transition ${
                                    variable.enabled ? "bg-emerald-500" : "bg-zinc-700"
                                  }`}
                                >
                                  <span
                                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
                                      variable.enabled ? "translate-x-4" : ""
                                    }`}
                                  />
                                </span>
                              </button>
                              <input
                                value={variable.key}
                                onChange={(event) =>
                                  updateEnvironmentVariable(
                                    editingEnvironment.id,
                                    variable.id,
                                    "key",
                                    event.target.value,
                                  )
                                }
                                className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                                placeholder="api_host"
                              />
                              <input
                                value={variable.value}
                                onChange={(event) =>
                                  updateEnvironmentVariable(
                                    editingEnvironment.id,
                                    variable.id,
                                    "value",
                                    event.target.value,
                                  )
                                }
                                className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                                placeholder="http://localhost:8080"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveEnvironmentVariableClick(editingEnvironment.id, variable.id)
                                }
                                className={`inline-flex h-10 items-center justify-center rounded-lg border transition ${
                                  isDeletePending
                                    ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                                    : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                                }`}
                                aria-label={
                                  isDeletePending
                                    ? "Clique novamente para remover variavel"
                                    : "Remover variavel"
                                }
                                title={isDeletePending ? "Clique novamente para remover" : "Remover variavel"}
                              >
                                {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => addEnvironmentVariable(editingEnvironment.id)}
                          className="mt-3 rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
                        >
                          + Adicionar variavel
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-400">Crie ou selecione um ambiente local para editar.</p>
                  )
                ) : editingGlobalEnvironment ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <p className="truncate text-sm font-medium text-zinc-100">{editingGlobalEnvironment.name}</p>
                      <button
                        type="button"
                        onClick={() => setActiveGlobalEnvironmentId(editingGlobalEnvironment.id)}
                        className={`h-10 rounded-md border px-3 text-sm transition ${
                          globalEnvironmentState.activeEnvironmentId === editingGlobalEnvironment.id
                            ? "border-emerald-300/55 bg-emerald-500/20 text-emerald-100"
                            : "border-white/20 text-zinc-200 hover:bg-white/10"
                        }`}
                      >
                        {globalEnvironmentState.activeEnvironmentId === editingGlobalEnvironment.id
                          ? "Ambiente global ativo"
                          : "Ativar"}
                      </button>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
                      <div className="mb-2 hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
                        <span>Ativo</span>
                        <span>Variavel</span>
                        <span>Valor</span>
                        <span>Acao</span>
                      </div>

                      <div className="space-y-2">
                        {editingGlobalEnvironment.variables.map((variable) => {
                          const variableDeleteKey = `${editingGlobalEnvironment.id}:${variable.id}`;
                          const isDeletePending = pendingDeleteGlobalEnvironmentVariableKey === variableDeleteKey;

                          return (
                            <div
                              key={variable.id}
                              className="grid gap-2 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px]"
                            >
                            <button
                              type="button"
                              onClick={() =>
                                updateGlobalEnvironmentVariable(
                                  editingGlobalEnvironment.id,
                                  variable.id,
                                  "enabled",
                                  !variable.enabled,
                                )
                              }
                              className={`flex h-10 items-center justify-center rounded-lg border transition ${
                                variable.enabled
                                  ? "border-emerald-300/60 bg-emerald-500/15 hover:bg-emerald-500/20"
                                  : "border-white/15 bg-[#121025] hover:bg-white/10"
                              }`}
                              aria-pressed={variable.enabled}
                              aria-label={variable.enabled ? "Desativar variavel" : "Ativar variavel"}
                            >
                              <span
                                className={`relative h-5 w-9 rounded-full transition ${
                                  variable.enabled ? "bg-emerald-500" : "bg-zinc-700"
                                }`}
                              >
                                <span
                                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
                                    variable.enabled ? "translate-x-4" : ""
                                  }`}
                                />
                              </span>
                            </button>
                            <input
                              value={variable.key}
                              onChange={(event) =>
                                updateGlobalEnvironmentVariable(
                                  editingGlobalEnvironment.id,
                                  variable.id,
                                  "key",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                              placeholder="api_host"
                            />
                            <input
                              value={variable.value}
                              onChange={(event) =>
                                updateGlobalEnvironmentVariable(
                                  editingGlobalEnvironment.id,
                                  variable.id,
                                  "value",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                              placeholder="http://localhost:8080"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveGlobalEnvironmentVariableClick(editingGlobalEnvironment.id, variable.id)
                              }
                              className={`inline-flex h-10 items-center justify-center rounded-lg border transition ${
                                isDeletePending
                                  ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                                  : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                              }`}
                              aria-label={
                                isDeletePending
                                  ? "Clique novamente para remover variavel"
                                  : "Remover variavel"
                              }
                              title={isDeletePending ? "Clique novamente para remover" : "Remover variavel"}
                            >
                              {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => addGlobalEnvironmentVariable(editingGlobalEnvironment.id)}
                        className="mt-3 rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
                      >
                        + Adicionar variavel
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">Crie ou selecione um ambiente global para editar.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
