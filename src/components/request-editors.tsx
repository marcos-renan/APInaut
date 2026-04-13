"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { KeyValueRow, MultipartFormRow } from "@/lib/collections";
import { StyledSelect } from "@/components/styled-select";

const DELETE_CONFIRM_TIMEOUT_MS = 1500;

type KeyValueEditorProps = {
  rows: KeyValueRow[];
  onChange: (id: string, field: keyof KeyValueRow, value: string | boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onTextFieldChange?: (
    event: ReactChangeEvent<HTMLInputElement>,
    applyValue: (nextValue: string) => void,
  ) => void;
  onTextFieldKeyDown?: (
    event: ReactKeyboardEvent<HTMLInputElement>,
    currentValue: string,
    applyValue: (nextValue: string) => void,
  ) => void;
};

export const KeyValueEditor = ({
  rows,
  onChange,
  onAdd,
  onRemove,
  onTextFieldChange,
  onTextFieldKeyDown,
}: KeyValueEditorProps) => {
  const [pendingDeleteRowId, setPendingDeleteRowId] = useState<string | null>(null);
  const deleteConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
    },
    [],
  );

  const handleRemoveClick = (rowId: string) => {
    if (pendingDeleteRowId === rowId) {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }

      deleteConfirmTimeoutRef.current = null;
      setPendingDeleteRowId(null);
      onRemove(rowId);
      return;
    }

    if (deleteConfirmTimeoutRef.current) {
      clearTimeout(deleteConfirmTimeoutRef.current);
    }

    setPendingDeleteRowId(rowId);

    deleteConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteRowId((current) => (current === rowId ? null : current));
      deleteConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
  };

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
        <span>Ativo</span>
        <span>Chave</span>
        <span>Valor</span>
        <span>Acao</span>
      </div>

      {rows.map((row) => {
        const isDeletePending = pendingDeleteRowId === row.id;

        return (
          <div key={row.id} className="grid gap-2 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_40px]">
            <button
              type="button"
              onClick={() => onChange(row.id, "enabled", !row.enabled)}
              className={`flex h-10 items-center justify-center rounded-lg border transition ${
                row.enabled
                  ? "border-emerald-300/60 bg-emerald-500/15 hover:bg-emerald-500/20"
                  : "border-white/15 bg-[#121025] hover:bg-white/10"
              }`}
              aria-pressed={row.enabled}
              aria-label={row.enabled ? "Desativar linha" : "Ativar linha"}
              title={row.enabled ? "Desativar linha" : "Ativar linha"}
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  row.enabled ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
                    row.enabled ? "translate-x-4" : ""
                  }`}
                />
              </span>
            </button>
            <input
              value={row.key}
              onChange={(event) => {
                const apply = (nextValue: string) => onChange(row.id, "key", nextValue);

                if (onTextFieldChange) {
                  onTextFieldChange(event, apply);
                  return;
                }

                apply(event.target.value);
              }}
              onKeyDown={(event) => {
                onTextFieldKeyDown?.(event, row.key, (nextValue) => onChange(row.id, "key", nextValue));
              }}
              className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
              placeholder="authorization"
            />
            <input
              value={row.value}
              onChange={(event) => {
                const apply = (nextValue: string) => onChange(row.id, "value", nextValue);

                if (onTextFieldChange) {
                  onTextFieldChange(event, apply);
                  return;
                }

                apply(event.target.value);
              }}
              onKeyDown={(event) => {
                onTextFieldKeyDown?.(event, row.value, (nextValue) => onChange(row.id, "value", nextValue));
              }}
              className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
              placeholder="valor"
            />
            <button
              type="button"
              onClick={() => handleRemoveClick(row.id)}
              className={`inline-flex h-10 items-center justify-center rounded-lg border transition ${
                isDeletePending
                  ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                  : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
              }`}
              aria-label={isDeletePending ? "Clique novamente para remover linha" : "Remover linha"}
              title={isDeletePending ? "Clique novamente para remover" : "Remover linha"}
            >
              {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        );
      })}

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

type MultipartFormEditorProps = {
  rows: MultipartFormRow[];
  onChange: (id: string, field: keyof MultipartFormRow, value: string | boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onFileSelect: (id: string, file: File | null) => void;
  onTextFieldChange?: (
    event: ReactChangeEvent<HTMLInputElement>,
    applyValue: (nextValue: string) => void,
  ) => void;
  onTextFieldKeyDown?: (
    event: ReactKeyboardEvent<HTMLInputElement>,
    currentValue: string,
    applyValue: (nextValue: string) => void,
  ) => void;
};

export const MultipartFormEditor = ({
  rows,
  onChange,
  onAdd,
  onRemove,
  onFileSelect,
  onTextFieldChange,
  onTextFieldKeyDown,
}: MultipartFormEditorProps) => {
  const [pendingDeleteRowId, setPendingDeleteRowId] = useState<string | null>(null);
  const deleteConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(
    () => () => {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
    },
    [],
  );

  const handleRemoveClick = (rowId: string) => {
    if (pendingDeleteRowId === rowId) {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }

      deleteConfirmTimeoutRef.current = null;
      setPendingDeleteRowId(null);
      onRemove(rowId);
      return;
    }

    if (deleteConfirmTimeoutRef.current) {
      clearTimeout(deleteConfirmTimeoutRef.current);
    }

    setPendingDeleteRowId(rowId);

    deleteConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteRowId((current) => (current === rowId ? null : current));
      deleteConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
  };

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[48px_minmax(0,1.2fr)_120px_minmax(0,1fr)_40px] gap-2 text-xs text-zinc-400 md:grid">
        <span>Ativo</span>
        <span>Chave</span>
        <span>Tipo</span>
        <span>Valor</span>
        <span>Acao</span>
      </div>

      {rows.map((row) => {
        const isDeletePending = pendingDeleteRowId === row.id;
        const fileLabel = row.fileName?.trim() || row.value.trim() || "Selecionar arquivo";

        return (
          <div key={row.id} className="grid gap-2 md:grid-cols-[48px_minmax(0,1.2fr)_120px_minmax(0,1fr)_40px]">
            <button
              type="button"
              onClick={() => onChange(row.id, "enabled", !row.enabled)}
              className={`flex h-10 items-center justify-center rounded-lg border transition ${
                row.enabled
                  ? "border-emerald-300/60 bg-emerald-500/15 hover:bg-emerald-500/20"
                  : "border-white/15 bg-[#121025] hover:bg-white/10"
              }`}
              aria-pressed={row.enabled}
              aria-label={row.enabled ? "Desativar linha" : "Ativar linha"}
              title={row.enabled ? "Desativar linha" : "Ativar linha"}
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  row.enabled ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
                    row.enabled ? "translate-x-4" : ""
                  }`}
                />
              </span>
            </button>

            <input
              value={row.key}
              onChange={(event) => {
                const apply = (nextValue: string) => onChange(row.id, "key", nextValue);

                if (onTextFieldChange) {
                  onTextFieldChange(event, apply);
                  return;
                }

                apply(event.target.value);
              }}
              onKeyDown={(event) => {
                onTextFieldKeyDown?.(event, row.key, (nextValue) => onChange(row.id, "key", nextValue));
              }}
              className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
              placeholder="field"
            />

            <StyledSelect
              value={row.valueType}
              onChange={(nextValue) => {
                const nextType = nextValue === "file" ? "file" : "text";

                if (nextType === "text") {
                  onChange(row.id, "valueType", "text");
                  onChange(row.id, "value", "");
                  onChange(row.id, "fileName", "");
                  onChange(row.id, "mimeType", "");
                  onChange(row.id, "fileData", "");
                  return;
                }

                onChange(row.id, "valueType", "file");
              }}
              options={[
                { value: "text", label: "Text" },
                { value: "file", label: "File" },
              ]}
              containerClassName="w-full"
              triggerClassName="h-10 rounded-lg px-3 text-sm"
            />

            {row.valueType === "file" ? (
              <div className="min-w-0">
                <input
                  ref={(element) => {
                    fileInputRefs.current[row.id] = element;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    onFileSelect(row.id, file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[row.id]?.click()}
                  className="h-10 w-full truncate rounded-lg border border-white/15 bg-[#121025] px-3 text-left text-sm text-zinc-200 transition hover:bg-white/10"
                  title={fileLabel}
                >
                  {fileLabel}
                </button>
              </div>
            ) : (
              <input
                value={row.value}
                onChange={(event) => {
                  const apply = (nextValue: string) => onChange(row.id, "value", nextValue);

                  if (onTextFieldChange) {
                    onTextFieldChange(event, apply);
                    return;
                  }

                  apply(event.target.value);
                }}
                onKeyDown={(event) => {
                  onTextFieldKeyDown?.(event, row.value, (nextValue) => onChange(row.id, "value", nextValue));
                }}
                className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-[#121025] px-3 text-sm outline-none ring-violet-400 transition focus:ring-2"
                placeholder="value"
              />
            )}

            <button
              type="button"
              onClick={() => handleRemoveClick(row.id)}
              className={`inline-flex h-10 items-center justify-center rounded-lg border transition ${
                isDeletePending
                  ? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                  : "border-white/20 text-zinc-200 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
              }`}
              aria-label={isDeletePending ? "Clique novamente para remover linha" : "Remover linha"}
              title={isDeletePending ? "Clique novamente para remover" : "Remover linha"}
            >
              {isDeletePending ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-violet-300/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
      >
        + Adicionar campo
      </button>
    </div>
  );
};
