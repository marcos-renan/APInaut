"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowBigLeft,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { CodeEditor } from "@/components/code-editor";
import {
  ApiRequest,
  Collection,
  Environment,
  EnvironmentVariable,
  GlobalEnvironmentsState,
  RequestTreeFolderNode,
  RequestTreeNode,
  KeyValueRow,
  createDefaultRequest,
  getCollectionsServerSnapshot,
  getCollectionsSnapshot,
  getGlobalEnvironmentsStateServerSnapshot,
  getGlobalEnvironmentsStateSnapshot,
  subscribeCollections,
  subscribeGlobalEnvironmentsState,
  updateCollections,
  updateGlobalEnvironmentsState,
} from "@/lib/collections";

type RequestTab = "params" | "body" | "auth" | "headers" | "script";
type ScriptTab = "pre-request" | "after-response";
type ResponseTab = "body" | "headers" | "cookies";
type ResponseBodyView = "code" | "web";

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

type RequestContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

type DragDropTarget =
  | { type: "root" }
  | { type: "folder"; folderId: string }
  | null;

type TemplateSuggestionState = {
  x: number;
  y: number;
  options: string[];
  query: string;
  selectedIndex: number;
  fieldValue: string;
  replaceFrom: number;
  replaceTo: number;
  apply: (nextValue: string, nextCaret: number) => void;
  fieldElement: HTMLInputElement | HTMLTextAreaElement;
} | null;

type StyledSelectOption = {
  value: string;
  label: string;
};

const MIN_LEFT_PANEL_WIDTH = 140;
const MIN_CENTER_PANEL_WIDTH = 300;
const MIN_RIGHT_PANEL_WIDTH = 220;
const RESIZER_WIDTH = 1;
const MIN_LAYOUT_WIDTH =
  MIN_LEFT_PANEL_WIDTH + MIN_CENTER_PANEL_WIDTH + MIN_RIGHT_PANEL_WIDTH + RESIZER_WIDTH * 2;
const DELETE_CONFIRM_TIMEOUT_MS = 1500;
const PANE_LAYOUT_STORAGE_KEY = "apinaut:request-pane-layout:v1";
const DEFAULT_LEFT_PANEL_WIDTH = 240;
const REQUEST_CONTEXT_MENU_WIDTH = 176;
const REQUEST_CONTEXT_MENU_HEIGHT_REQUEST = 96;
const REQUEST_CONTEXT_MENU_HEIGHT_FOLDER = 168;
const REQUEST_CONTEXT_MENU_VIEWPORT_PADDING = 8;
const REQUEST_LIST_INDENT = 16;
const TEMPLATE_SUGGESTION_MENU_WIDTH = 320;
const TEMPLATE_SUGGESTION_MENU_HEIGHT = 300;
const TEMPLATE_VARIABLE_TRIGGER_REGEX = /\{\{([A-Za-z0-9_.-]*)$/;
const TEMPLATE_VARIABLE_LOOKUP_REGEX = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const METHOD_OPTIONS: ApiRequest["method"][] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_STYLE_MAP: Record<
  ApiRequest["method"],
  { select: string; badge: string; listActive: string; listInactive: string; optionColor: string }
> = {
  GET: {
    select: "border-emerald-400/55 bg-emerald-500/15 text-emerald-200",
    badge: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200",
    listActive: "border-emerald-300/50 bg-emerald-500/20",
    listInactive: "border-emerald-500/20 bg-emerald-500/6 hover:bg-emerald-500/12",
    optionColor: "#86efac",
  },
  POST: {
    select: "border-yellow-400/55 bg-yellow-500/15 text-yellow-200",
    badge: "border-yellow-400/45 bg-yellow-500/15 text-yellow-200",
    listActive: "border-yellow-300/50 bg-yellow-500/20",
    listInactive: "border-yellow-500/20 bg-yellow-500/6 hover:bg-yellow-500/12",
    optionColor: "#fde68a",
  },
  PUT: {
    select: "border-orange-400/55 bg-orange-500/15 text-orange-200",
    badge: "border-orange-400/45 bg-orange-500/15 text-orange-200",
    listActive: "border-orange-300/50 bg-orange-500/20",
    listInactive: "border-orange-500/20 bg-orange-500/6 hover:bg-orange-500/12",
    optionColor: "#fdba74",
  },
  PATCH: {
    select: "border-violet-400/55 bg-violet-500/15 text-violet-200",
    badge: "border-violet-400/45 bg-violet-500/15 text-violet-200",
    listActive: "border-violet-300/50 bg-violet-500/20",
    listInactive: "border-violet-500/20 bg-violet-500/6 hover:bg-violet-500/12",
    optionColor: "#c4b5fd",
  },
  DELETE: {
    select: "border-rose-400/55 bg-rose-500/15 text-rose-200",
    badge: "border-rose-400/45 bg-rose-500/15 text-rose-200",
    listActive: "border-rose-300/50 bg-rose-500/20",
    listInactive: "border-rose-500/20 bg-rose-500/6 hover:bg-rose-500/12",
    optionColor: "#fda4af",
  },
};

const StyledSelect = ({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  containerClassName = "",
  triggerClassName = "",
  menuClassName = "",
  optionClassName = "",
}: {
  value: string;
  onChange: (nextValue: string) => void;
  options: StyledSelectOption[];
  placeholder?: string;
  containerClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        containerRef.current.contains(event.target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-md border border-violet-300/45 bg-violet-500/15 px-2 text-xs font-medium text-violet-100 outline-none ring-violet-400 transition hover:bg-violet-500/25 focus:ring-2 ${triggerClassName}`}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-40 w-full overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_10px_26px_rgba(0,0,0,0.45)] ${menuClassName}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                option.value === value
                  ? "bg-violet-500/35 text-violet-50"
                  : "text-zinc-100 hover:bg-white/10"
              } ${optionClassName}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type PaneWidths = {
  left: number;
  right: number;
};

const clampPaneWidths = (containerWidth: number, left: number, right: number): PaneWidths => {
  const totalHandleWidth = RESIZER_WIDTH * 2;
  const maxLeft = Math.max(
    MIN_LEFT_PANEL_WIDTH,
    containerWidth - MIN_RIGHT_PANEL_WIDTH - MIN_CENTER_PANEL_WIDTH - totalHandleWidth,
  );
  const nextLeft = Math.min(Math.max(left, MIN_LEFT_PANEL_WIDTH), maxLeft);

  const maxRight = Math.max(
    MIN_RIGHT_PANEL_WIDTH,
    containerWidth - nextLeft - MIN_CENTER_PANEL_WIDTH - totalHandleWidth,
  );
  const nextRight = Math.min(Math.max(right, MIN_RIGHT_PANEL_WIDTH), maxRight);

  return {
    left: nextLeft,
    right: nextRight,
  };
};

const getInitialPaneWidths = (): PaneWidths => {
  if (typeof window === "undefined") {
    return {
      left: DEFAULT_LEFT_PANEL_WIDTH,
      right: 560,
    };
  }

  const fallback = clampPaneWidths(window.innerWidth, DEFAULT_LEFT_PANEL_WIDTH, window.innerWidth * 0.5);

  try {
    const raw = window.localStorage.getItem(PANE_LAYOUT_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<PaneWidths>;

    if (typeof parsed.left !== "number" || typeof parsed.right !== "number") {
      return fallback;
    }

    return clampPaneWidths(window.innerWidth, parsed.left, parsed.right);
  } catch {
    return fallback;
  }
};

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

const createRequestNode = (name = "New Request"): RequestTreeNode => {
  const request = createRequestForUi(name);

  return {
    id: request.id,
    type: "request",
    request,
  };
};

const createFolderNode = (name = "New Folder"): RequestTreeFolderNode => ({
  id: crypto.randomUUID(),
  type: "folder",
  name,
  children: [],
});

const createEnvironmentVariableRow = (): EnvironmentVariable => ({
  id: crypto.randomUUID(),
  enabled: true,
  key: "",
  value: "",
});

const createEnvironmentItem = (name = "Default"): Environment => ({
  id: crypto.randomUUID(),
  name,
  variables: [],
});

const hasRequestInTree = (tree: RequestTreeNode[], requestId: string | null): boolean => {
  if (!requestId) {
    return false;
  }

  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return true;
      }
      continue;
    }

    if (hasRequestInTree(node.children, requestId)) {
      return true;
    }
  }

  return false;
};

const findFolderPathForRequest = (
  tree: RequestTreeNode[],
  requestId: string,
  trail: string[] = [],
): string[] | null => {
  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return trail;
      }
      continue;
    }

    const nested = findFolderPathForRequest(node.children, requestId, [...trail, node.id]);

    if (nested) {
      return nested;
    }
  }

  return null;
};

const findRequestById = (tree: RequestTreeNode[], requestId: string | null): ApiRequest | null => {
  if (!requestId) {
    return null;
  }

  for (const node of tree) {
    if (node.type === "request") {
      if (node.id === requestId) {
        return node.request;
      }
      continue;
    }

    const nested = findRequestById(node.children, requestId);

    if (nested) {
      return nested;
    }
  }

  return null;
};

const findNodeById = (tree: RequestTreeNode[], nodeId: string | null): RequestTreeNode | null => {
  if (!nodeId) {
    return null;
  }

  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.type === "folder") {
      const nested = findNodeById(node.children, nodeId);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

const updateRequestInTree = (
  tree: RequestTreeNode[],
  requestId: string,
  updater: (request: ApiRequest) => ApiRequest,
): RequestTreeNode[] =>
  tree.map((node) => {
    if (node.type === "request") {
      if (node.id !== requestId) {
        return node;
      }

      const nextRequest = updater(node.request);

      return {
        ...node,
        id: nextRequest.id,
        request: nextRequest,
      };
    }

    return {
      ...node,
      children: updateRequestInTree(node.children, requestId, updater),
    };
  });

const updateFolderInTree = (
  tree: RequestTreeNode[],
  folderId: string,
  updater: (folder: RequestTreeFolderNode) => RequestTreeFolderNode,
): RequestTreeNode[] =>
  tree.map((node) => {
    if (node.type !== "folder") {
      return node;
    }

    if (node.id === folderId) {
      return updater(node);
    }

    return {
      ...node,
      children: updateFolderInTree(node.children, folderId, updater),
    };
  });

const removeNodeById = (
  tree: RequestTreeNode[],
  nodeId: string,
): { tree: RequestTreeNode[]; removed: RequestTreeNode | null } => {
  let removed: RequestTreeNode | null = null;

  const nextTree = tree.reduce<RequestTreeNode[]>((accumulator, node) => {
    if (node.id === nodeId) {
      removed = node;
      return accumulator;
    }

    if (node.type === "folder") {
      const nested = removeNodeById(node.children, nodeId);

      if (nested.removed) {
        removed = nested.removed;

        accumulator.push({
          ...node,
          children: nested.tree,
        });

        return accumulator;
      }
    }

    accumulator.push(node);
    return accumulator;
  }, []);

  return {
    tree: nextTree,
    removed,
  };
};

const insertIntoFolderById = (
  tree: RequestTreeNode[],
  folderId: string,
  nodeToInsert: RequestTreeNode,
): { tree: RequestTreeNode[]; inserted: boolean } => {
  let inserted = false;

  const nextTree = tree.map((node) => {
    if (node.type !== "folder") {
      return node;
    }

    if (node.id === folderId) {
      inserted = true;
      return {
        ...node,
        children: [...node.children, nodeToInsert],
      };
    }

    const nested = insertIntoFolderById(node.children, folderId, nodeToInsert);

    if (nested.inserted) {
      inserted = true;
      return {
        ...node,
        children: nested.tree,
      };
    }

    return node;
  });

  return {
    tree: nextTree,
    inserted,
  };
};

const nodeContainsNodeId = (node: RequestTreeNode, targetNodeId: string): boolean => {
  if (node.id === targetNodeId) {
    return true;
  }

  if (node.type !== "folder") {
    return false;
  }

  return node.children.some((child) => nodeContainsNodeId(child, targetNodeId));
};

const moveNodeToTarget = (
  tree: RequestTreeNode[],
  sourceNodeId: string,
  targetFolderId: string | null,
): RequestTreeNode[] => {
  const removedSource = removeNodeById(tree, sourceNodeId);

  if (!removedSource.removed) {
    return tree;
  }

  const movingNode = removedSource.removed;

  if (targetFolderId === null) {
    return [...removedSource.tree, movingNode];
  }

  if (nodeContainsNodeId(movingNode, targetFolderId)) {
    return tree;
  }

  const inserted = insertIntoFolderById(removedSource.tree, targetFolderId, movingNode);

  if (!inserted.inserted) {
    return tree;
  }

  return inserted.tree;
};

const interpolateTemplateValue = (value: string, variables: Record<string, string>) =>
  value.replace(TEMPLATE_VARIABLE_LOOKUP_REGEX, (match, variableName: string) =>
    Object.prototype.hasOwnProperty.call(variables, variableName) ? variables[variableName] : match,
  );

const interpolateRows = (rows: KeyValueRow[], variables: Record<string, string>): KeyValueRow[] =>
  rows.map((row) => ({
    ...row,
    key: interpolateTemplateValue(row.key, variables),
    value: interpolateTemplateValue(row.value, variables),
  }));

const resolveRequestWithEnvironment = (
  request: ApiRequest,
  variables: Record<string, string>,
): ApiRequest => ({
  ...request,
  url: interpolateTemplateValue(request.url, variables),
  params: interpolateRows(request.params, variables),
  headers: interpolateRows(request.headers, variables),
  body: interpolateTemplateValue(request.body, variables),
  bearerToken: interpolateTemplateValue(request.bearerToken, variables),
  basicUsername: interpolateTemplateValue(request.basicUsername, variables),
  basicPassword: interpolateTemplateValue(request.basicPassword, variables),
  preRequestScript: interpolateTemplateValue(request.preRequestScript, variables),
  afterResponseScript: interpolateTemplateValue(request.afterResponseScript, variables),
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

const runUserScript = (scriptCode: string, bindings: Record<string, unknown>) => {
  if (!scriptCode.trim()) {
    return;
  }

  const bindingNames = Object.keys(bindings);
  const bindingValues = Object.values(bindings);
  const execute = new Function(...bindingNames, `"use strict";\n${scriptCode}`);
  execute(...bindingValues);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const KeyValueEditor = ({
  rows,
  onChange,
  onAdd,
  onRemove,
  onTextFieldChange,
  onTextFieldKeyDown,
}: {
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
}) => {
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

export default function CollectionDetailsPage() {
  const params = useParams<{ id: string }>();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const requestContextMenuRef = useRef<HTMLDivElement | null>(null);
  const templateSuggestionRef = useRef<HTMLDivElement | null>(null);
  const initialPaneWidthsRef = useRef<PaneWidths>(getInitialPaneWidths());
  const collections = useSyncExternalStore(
    subscribeCollections,
    getCollectionsSnapshot,
    getCollectionsServerSnapshot,
  );
  const globalEnvironmentState = useSyncExternalStore(
    subscribeGlobalEnvironmentsState,
    getGlobalEnvironmentsStateSnapshot,
    getGlobalEnvironmentsStateServerSnapshot,
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
  const [responseBodyView, setResponseBodyView] = useState<ResponseBodyView>("code");
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestExecutionResult | null>(null);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [environmentModalScope, setEnvironmentModalScope] = useState<"local" | "global">("local");
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [newGlobalEnvironmentName, setNewGlobalEnvironmentName] = useState("");
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null);
  const [editingGlobalEnvironmentId, setEditingGlobalEnvironmentId] = useState<string | null>(null);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showBasicPassword, setShowBasicPassword] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingRequestName, setEditingRequestName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [requestContextMenu, setRequestContextMenu] = useState<RequestContextMenuState>(null);
  const [templateSuggestion, setTemplateSuggestion] = useState<TemplateSuggestionState>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragDropTarget, setDragDropTarget] = useState<DragDropTarget>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialPaneWidthsRef.current.left);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialPaneWidthsRef.current.right);
  const [resizingPane, setResizingPane] = useState<"left" | "right" | null>(null);
  const [urlPreviewCopied, setUrlPreviewCopied] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: leftPanelWidth,
        right: rightPanelWidth,
      }),
    );
  }, [leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    if (!requestContextMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        requestContextMenuRef.current &&
        event.target instanceof Node &&
        requestContextMenuRef.current.contains(event.target)
      ) {
        return;
      }

      setRequestContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRequestContextMenu(null);
      }
    };

    const handleScroll = () => {
      setRequestContextMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [requestContextMenu]);

  useEffect(() => {
    if (!templateSuggestion) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        templateSuggestionRef.current &&
        event.target instanceof Node &&
        templateSuggestionRef.current.contains(event.target)
      ) {
        return;
      }

      if (
        event.target instanceof Node &&
        templateSuggestion.fieldElement &&
        templateSuggestion.fieldElement.contains(event.target)
      ) {
        return;
      }

      setTemplateSuggestion(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTemplateSuggestion(null);
      }
    };

    const handleScroll = () => {
      setTemplateSuggestion(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [templateSuggestion]);

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
    const syncPaneWidthsWithContainer = () => {
      const layout = layoutRef.current;

      if (!layout) {
        return;
      }

      const rect = layout.getBoundingClientRect();
      const clamped = clampPaneWidths(rect.width, leftPanelWidth, rightPanelWidth);

      if (clamped.left !== leftPanelWidth) {
        setLeftPanelWidth(clamped.left);
      }

      if (clamped.right !== rightPanelWidth) {
        setRightPanelWidth(clamped.right);
      }
    };

    syncPaneWidthsWithContainer();
    window.addEventListener("resize", syncPaneWidthsWithContainer);

    return () => {
      window.removeEventListener("resize", syncPaneWidthsWithContainer);
    };
  }, [leftPanelWidth, rightPanelWidth]);

  const requestTree = useMemo(() => collection?.requestTree ?? [], [collection]);
  const environments = useMemo(() => collection?.environments ?? [], [collection]);
  const globalEnvironments = useMemo(
    () => globalEnvironmentState.environments ?? [],
    [globalEnvironmentState],
  );
  const activeEnvironment = useMemo(
    () =>
      collection?.activeEnvironmentId
        ? environments.find((environment) => environment.id === collection.activeEnvironmentId) ?? null
        : null,
    [collection, environments],
  );
  const activeGlobalEnvironment = useMemo(
    () =>
      globalEnvironmentState.activeEnvironmentId
        ? globalEnvironments.find(
            (environment) => environment.id === globalEnvironmentState.activeEnvironmentId,
          ) ?? null
        : null,
    [globalEnvironmentState.activeEnvironmentId, globalEnvironments],
  );
  const activeGlobalTemplateVariables = useMemo(() => {
    if (!activeGlobalEnvironment) {
      return {} as Record<string, string>;
    }

    const variableMap: Record<string, string> = {};

    for (const variable of activeGlobalEnvironment.variables) {
      if (!variable.enabled) {
        continue;
      }

      const key = variable.key.trim();

      if (!key) {
        continue;
      }

      variableMap[key] = variable.value;
    }

    return variableMap;
  }, [activeGlobalEnvironment]);
  const activeLocalTemplateVariables = useMemo(() => {
    if (!activeEnvironment) {
      return {} as Record<string, string>;
    }

    const variableMap: Record<string, string> = {};

    for (const variable of activeEnvironment.variables) {
      if (!variable.enabled) {
        continue;
      }

      const key = variable.key.trim();

      if (!key) {
        continue;
      }

      variableMap[key] = variable.value;
    }

    return variableMap;
  }, [activeEnvironment]);
  const templateVariableOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];

    for (const source of [activeGlobalEnvironment, activeEnvironment]) {
      if (!source) {
        continue;
      }

      for (const variable of source.variables) {
        if (!variable.enabled) {
          continue;
        }

        const key = variable.key.trim();

        if (!key || seen.has(key)) {
          continue;
        }

        seen.add(key);
        options.push(key);
      }
    }

    return options;
  }, [activeEnvironment, activeGlobalEnvironment]);

  const activeTemplateVariables = useMemo(() => {
    return {
      ...activeGlobalTemplateVariables,
      ...activeLocalTemplateVariables,
    };
  }, [activeGlobalTemplateVariables, activeLocalTemplateVariables]);

  useEffect(() => {
    if (!isEnvironmentModalOpen) {
      return;
    }

    if (environments.length === 0) {
      setEditingEnvironmentId(null);
      return;
    }

    if (!editingEnvironmentId) {
      setEditingEnvironmentId(environments[0].id);
      return;
    }

    const exists = environments.some((environment) => environment.id === editingEnvironmentId);

    if (!exists) {
      setEditingEnvironmentId(environments[0].id);
    }
  }, [editingEnvironmentId, environments, isEnvironmentModalOpen]);

  useEffect(() => {
    if (!isEnvironmentModalOpen) {
      return;
    }

    if (globalEnvironments.length === 0) {
      setEditingGlobalEnvironmentId(null);
      return;
    }

    if (!editingGlobalEnvironmentId) {
      setEditingGlobalEnvironmentId(globalEnvironments[0].id);
      return;
    }

    const exists = globalEnvironments.some(
      (environment) => environment.id === editingGlobalEnvironmentId,
    );

    if (!exists) {
      setEditingGlobalEnvironmentId(globalEnvironments[0].id);
    }
  }, [editingGlobalEnvironmentId, globalEnvironments, isEnvironmentModalOpen]);

  useEffect(() => {
    if (!collection) {
      setActiveRequestId(null);
      return;
    }

    const storedRequestId =
      typeof collection.lastActiveRequestId === "string" &&
      hasRequestInTree(requestTree, collection.lastActiveRequestId)
        ? collection.lastActiveRequestId
        : null;

    if (collection.lastActiveRequestId && !storedRequestId && collectionId) {
      updateCollections((current) =>
        current.map((item) =>
          item.id === collectionId ? { ...item, lastActiveRequestId: null } : item,
        ),
      );
    }

    if (activeRequestId !== storedRequestId) {
      setActiveRequestId(storedRequestId);
    }

    if (storedRequestId) {
      const folderPath = findFolderPathForRequest(requestTree, storedRequestId) ?? [];

      if (folderPath.length > 0) {
        setExpandedFolderIds((current) => {
          const nextSet = new Set(current);
          let changed = false;

          for (const folderId of folderPath) {
            if (!nextSet.has(folderId)) {
              nextSet.add(folderId);
              changed = true;
            }
          }

          return changed ? Array.from(nextSet) : current;
        });
      }
    }
  }, [activeRequestId, collection, collectionId, requestTree]);

  useEffect(() => {
    if (!collection) {
      return;
    }

    if (collection.environments.length === 0) {
      return;
    }

    const ensureActiveEnvironmentId = (environmentId: string) => {
      if (!collectionId) {
        return;
      }

      updateCollections((current) =>
        current.map((item) =>
          item.id === collectionId ? { ...item, activeEnvironmentId: environmentId } : item,
        ),
      );
    };

    if (!collection.activeEnvironmentId) {
      ensureActiveEnvironmentId(collection.environments[0].id);
      return;
    }

    const exists = collection.environments.some(
      (environment) => environment.id === collection.activeEnvironmentId,
    );

    if (!exists) {
      ensureActiveEnvironmentId(collection.environments[0].id);
    }
  }, [collection, collectionId]);

  useEffect(() => {
    if (globalEnvironments.length === 0) {
      return;
    }

    if (!globalEnvironmentState.activeEnvironmentId) {
      updateGlobalEnvironmentsState((current) => ({
        ...current,
        activeEnvironmentId: current.environments[0]?.id ?? null,
      }));
      return;
    }

    const exists = globalEnvironments.some(
      (environment) => environment.id === globalEnvironmentState.activeEnvironmentId,
    );

    if (!exists) {
      updateGlobalEnvironmentsState((current) => ({
        ...current,
        activeEnvironmentId: current.environments[0]?.id ?? null,
      }));
    }
  }, [globalEnvironmentState.activeEnvironmentId, globalEnvironments]);

  const activeRequest = useMemo(
    () => findRequestById(requestTree, activeRequestId),
    [requestTree, activeRequestId],
  );

  const urlPreview = useMemo(() => {
    if (!activeRequest) {
      return {
        value: "",
        error: "",
      };
    }

    const resolvedRequest = resolveRequestWithEnvironment(activeRequest, activeTemplateVariables);
    const baseUrl = resolvedRequest.url.trim();

    if (!baseUrl) {
      return {
        value: "",
        error: "Informe uma URL para visualizar o preview.",
      };
    }

    try {
      return {
        value: buildUrlWithParams(baseUrl, resolvedRequest.params),
        error: "",
      };
    } catch {
      return {
        value: "",
        error: "URL invalida para preview. Verifique URL e variaveis do ambiente.",
      };
    }
  }, [activeRequest, activeTemplateVariables]);

  const requestContextMenuTargetNode = useMemo(
    () => (requestContextMenu ? findNodeById(requestTree, requestContextMenu.nodeId) : null),
    [requestContextMenu, requestTree],
  );

  const editingEnvironment = useMemo(
    () =>
      editingEnvironmentId ? environments.find((environment) => environment.id === editingEnvironmentId) ?? null : null,
    [editingEnvironmentId, environments],
  );
  const editingGlobalEnvironment = useMemo(
    () =>
      editingGlobalEnvironmentId
        ? globalEnvironments.find((environment) => environment.id === editingGlobalEnvironmentId) ?? null
        : null,
    [editingGlobalEnvironmentId, globalEnvironments],
  );

  const updateCurrentCollection = (updater: (currentCollection: Collection) => Collection) => {
    if (!collectionId) {
      return;
    }

    updateCollections((current) =>
      current.map((item) => {
        if (item.id !== collectionId) {
          return item;
        }

        return updater(item);
      }),
    );
  };

  const setActiveRequestAndPersist = (requestId: string | null) => {
    setActiveRequestId(requestId);
    updateCurrentCollection((currentCollection) => {
      const currentLastActiveRequestId = currentCollection.lastActiveRequestId ?? null;

      if (currentLastActiveRequestId === requestId) {
        return currentCollection;
      }

      return {
        ...currentCollection,
        lastActiveRequestId: requestId,
      };
    });
  };

  const updateCollectionTree = (updater: (tree: RequestTreeNode[]) => RequestTreeNode[]) => {
    updateCurrentCollection((currentCollection) => ({
      ...currentCollection,
      requestTree: updater(currentCollection.requestTree),
    }));
  };

  const updateCollectionEnvironments = (updater: (environments: Environment[]) => Environment[]) => {
    updateCurrentCollection((currentCollection) => {
      const nextEnvironments = updater(currentCollection.environments);
      const stillExists =
        currentCollection.activeEnvironmentId &&
        nextEnvironments.some((environment) => environment.id === currentCollection.activeEnvironmentId);

      return {
        ...currentCollection,
        environments: nextEnvironments,
        activeEnvironmentId: stillExists
          ? currentCollection.activeEnvironmentId
          : nextEnvironments[0]?.id ?? null,
      };
    });
  };

  const setActiveEnvironmentId = (environmentId: string | null) => {
    updateCurrentCollection((currentCollection) => ({
      ...currentCollection,
      activeEnvironmentId: environmentId,
    }));
  };

  const updateGlobalEnvironmentState = (
    updater: (state: GlobalEnvironmentsState) => GlobalEnvironmentsState,
  ) => {
    updateGlobalEnvironmentsState((current) => updater(current));
  };

  const updateGlobalEnvironments = (updater: (environments: Environment[]) => Environment[]) => {
    updateGlobalEnvironmentState((current) => {
      const nextEnvironments = updater(current.environments);
      const stillExists =
        current.activeEnvironmentId &&
        nextEnvironments.some((environment) => environment.id === current.activeEnvironmentId);

      return {
        environments: nextEnvironments,
        activeEnvironmentId: stillExists
          ? current.activeEnvironmentId
          : nextEnvironments[0]?.id ?? null,
      };
    });
  };

  const setActiveGlobalEnvironmentId = (environmentId: string | null) => {
    updateGlobalEnvironmentState((current) => ({
      ...current,
      activeEnvironmentId: environmentId,
    }));
  };

  const updateActiveRequest = (updater: (request: ApiRequest) => ApiRequest) => {
    if (!activeRequestId) {
      return;
    }

    updateCollectionTree((tree) =>
      updateRequestInTree(tree, activeRequestId, (request) => {
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

  const getTemplateSuggestionOptions = (query: string) => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return templateVariableOptions;
    }

    return templateVariableOptions.filter((option) => option.toLowerCase().includes(normalized));
  };

  const openTemplateSuggestionForField = (
    fieldElement: HTMLInputElement | HTMLTextAreaElement,
    fieldValue: string,
    applyValue: (nextValue: string) => void,
    explicitTrigger: boolean,
  ) => {
    const caretPosition = fieldElement.selectionStart ?? fieldValue.length;
    const beforeCaret = fieldValue.slice(0, caretPosition);
    const triggerMatch = beforeCaret.match(TEMPLATE_VARIABLE_TRIGGER_REGEX);

    if (!triggerMatch && !explicitTrigger) {
      setTemplateSuggestion((current) =>
        current?.fieldElement === fieldElement ? null : current,
      );
      return;
    }

    const replaceFrom = triggerMatch ? caretPosition - triggerMatch[0].length : caretPosition;
    const replaceTo = caretPosition;
    const query = triggerMatch ? triggerMatch[1] : "";
    const options = getTemplateSuggestionOptions(query);

    if (options.length === 0) {
      setTemplateSuggestion((current) =>
        current?.fieldElement === fieldElement ? null : current,
      );
      return;
    }

    const fieldRect = fieldElement.getBoundingClientRect();
    const viewportPadding = REQUEST_CONTEXT_MENU_VIEWPORT_PADDING;
    const estimatedHeight = Math.min(
      TEMPLATE_SUGGESTION_MENU_HEIGHT,
      44 + options.length * 34,
    );
    const x = Math.max(
      viewportPadding,
      Math.min(fieldRect.left, window.innerWidth - TEMPLATE_SUGGESTION_MENU_WIDTH - viewportPadding),
    );
    const y = Math.max(
      viewportPadding,
      Math.min(fieldRect.bottom + 6, window.innerHeight - estimatedHeight - viewportPadding),
    );

    setTemplateSuggestion({
      x,
      y,
      options,
      query,
      selectedIndex: 0,
      fieldValue,
      replaceFrom,
      replaceTo,
      apply: (nextValue: string, nextCaret: number) => {
        applyValue(nextValue);
        requestAnimationFrame(() => {
          fieldElement.focus();
          fieldElement.setSelectionRange(nextCaret, nextCaret);
        });
      },
      fieldElement,
    });
  };

  const applyTemplateSuggestion = (option: string) => {
    if (!templateSuggestion) {
      return;
    }

    const current = templateSuggestion;
    const replacement = `{{${option}}}`;
    const nextValue = `${current.fieldValue.slice(0, current.replaceFrom)}${replacement}${current.fieldValue.slice(
      current.replaceTo,
    )}`;
    const nextCaret = current.replaceFrom + replacement.length;

    setTemplateSuggestion(null);
    current.apply(nextValue, nextCaret);
  };

  const handleTemplateTextFieldChange = (
    event: ReactChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    applyValue: (nextValue: string) => void,
  ) => {
    const nextValue = event.target.value;
    applyValue(nextValue);
    openTemplateSuggestionForField(event.target, nextValue, applyValue, false);
  };

  const handleTemplateTextFieldKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    currentValue: string,
    applyValue: (nextValue: string) => void,
  ) => {
    const fieldElement = event.currentTarget;

    if (templateSuggestion && templateSuggestion.fieldElement === fieldElement) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setTemplateSuggestion((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            selectedIndex: (current.selectedIndex + 1) % current.options.length,
          };
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setTemplateSuggestion((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            selectedIndex:
              (current.selectedIndex - 1 + current.options.length) % current.options.length,
          };
        });
        return;
      }

      if ((event.key === "Enter" || event.key === "Tab") && templateSuggestion.options.length > 0) {
        event.preventDefault();
        applyTemplateSuggestion(templateSuggestion.options[templateSuggestion.selectedIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setTemplateSuggestion(null);
        return;
      }
    }

    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      openTemplateSuggestionForField(fieldElement, currentValue, applyValue, true);
    }
  };

  const createRequest = () => {
    const newRequestNode = createRequestNode("New Request");

    updateCollectionTree((tree) => [newRequestNode, ...tree]);
    setActiveRequestAndPersist(newRequestNode.id);
    setEditingRequestId(null);
    setEditingRequestName("");
    setEditingFolderId(null);
    setEditingFolderName("");
    setRequestContextMenu(null);
    setResult(null);
    setRequestError(null);
    setScriptError(null);
  };

  const createRequestInFolder = (folderId: string) => {
    const newRequestNode = createRequestNode("New Request");
    let inserted = false;

    updateCollectionTree((tree) => {
      const insertResult = insertIntoFolderById(tree, folderId, newRequestNode);
      inserted = insertResult.inserted;
      return insertResult.inserted ? insertResult.tree : tree;
    });

    if (!inserted) {
      return;
    }

    setExpandedFolderIds((current) =>
      current.includes(folderId) ? current : [...current, folderId],
    );
    setActiveRequestAndPersist(newRequestNode.id);
    setEditingRequestId(null);
    setEditingRequestName("");
    setEditingFolderId(null);
    setEditingFolderName("");
    setRequestContextMenu(null);
    setResult(null);
    setRequestError(null);
    setScriptError(null);
  };

  const createFolder = () => {
    const folderNode = createFolderNode("New Folder");

    updateCollectionTree((tree) => [folderNode, ...tree]);
    setExpandedFolderIds((current) =>
      current.includes(folderNode.id) ? current : [folderNode.id, ...current],
    );
    setEditingRequestId(null);
    setEditingRequestName("");
    setRequestContextMenu(null);
  };

  const createFolderInFolder = (folderId: string) => {
    const folderNode = createFolderNode("New Folder");
    let inserted = false;

    updateCollectionTree((tree) => {
      const insertResult = insertIntoFolderById(tree, folderId, folderNode);
      inserted = insertResult.inserted;
      return insertResult.inserted ? insertResult.tree : tree;
    });

    if (!inserted) {
      return;
    }

    setExpandedFolderIds((current) => {
      const next = current.includes(folderId) ? current : [...current, folderId];
      return next.includes(folderNode.id) ? next : [...next, folderNode.id];
    });
    setEditingRequestId(null);
    setEditingRequestName("");
    setEditingFolderId(null);
    setEditingFolderName("");
    setRequestContextMenu(null);
  };

  const openEnvironmentModal = () => {
    setEnvironmentModalScope("local");
    setEditingEnvironmentId(activeEnvironment?.id ?? environments[0]?.id ?? null);
    setEditingGlobalEnvironmentId(activeGlobalEnvironment?.id ?? globalEnvironments[0]?.id ?? null);
    setIsEnvironmentModalOpen(true);
  };

  const closeEnvironmentModal = () => {
    setIsEnvironmentModalOpen(false);
    setNewEnvironmentName("");
    setNewGlobalEnvironmentName("");
  };

  const createEnvironment = () => {
    const fallbackName = `Environment ${environments.length + 1}`;
    const nextName = newEnvironmentName.trim() || fallbackName;
    const environment = createEnvironmentItem(nextName);

    updateCollectionEnvironments((current) => [environment, ...current]);
    setActiveEnvironmentId(environment.id);
    setEditingEnvironmentId(environment.id);
    setNewEnvironmentName("");
  };

  const deleteEnvironment = (environmentId: string) => {
    updateCollectionEnvironments((current) =>
      current.filter((environment) => environment.id !== environmentId),
    );

    if (editingEnvironmentId === environmentId) {
      setEditingEnvironmentId(null);
    }
  };

  const updateEnvironmentName = (environmentId: string, name: string) => {
    updateCollectionEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId ? { ...environment, name } : environment,
      ),
    );
  };

  const updateEnvironmentVariables = (
    environmentId: string,
    updater: (variables: EnvironmentVariable[]) => EnvironmentVariable[],
  ) => {
    updateCollectionEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId
          ? {
              ...environment,
              variables: updater(environment.variables),
            }
          : environment,
      ),
    );
  };

  const addEnvironmentVariable = (environmentId: string) => {
    updateEnvironmentVariables(environmentId, (variables) => [...variables, createEnvironmentVariableRow()]);
  };

  const updateEnvironmentVariable = (
    environmentId: string,
    variableId: string,
    field: keyof EnvironmentVariable,
    value: string | boolean,
  ) => {
    updateEnvironmentVariables(environmentId, (variables) =>
      variables.map((variable) => (variable.id === variableId ? { ...variable, [field]: value } : variable)),
    );
  };

  const removeEnvironmentVariable = (environmentId: string, variableId: string) => {
    updateEnvironmentVariables(environmentId, (variables) =>
      variables.filter((variable) => variable.id !== variableId),
    );
  };

  const createGlobalEnvironment = () => {
    const fallbackName = `Global ${globalEnvironments.length + 1}`;
    const nextName = newGlobalEnvironmentName.trim() || fallbackName;
    const environment = createEnvironmentItem(nextName);

    updateGlobalEnvironments((current) => [environment, ...current]);
    setActiveGlobalEnvironmentId(environment.id);
    setEditingGlobalEnvironmentId(environment.id);
    setNewGlobalEnvironmentName("");
  };

  const deleteGlobalEnvironment = (environmentId: string) => {
    updateGlobalEnvironments((current) =>
      current.filter((environment) => environment.id !== environmentId),
    );

    if (editingGlobalEnvironmentId === environmentId) {
      setEditingGlobalEnvironmentId(null);
    }
  };

  const updateGlobalEnvironmentName = (environmentId: string, name: string) => {
    updateGlobalEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId ? { ...environment, name } : environment,
      ),
    );
  };

  const updateGlobalEnvironmentVariables = (
    environmentId: string,
    updater: (variables: EnvironmentVariable[]) => EnvironmentVariable[],
  ) => {
    updateGlobalEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId
          ? {
              ...environment,
              variables: updater(environment.variables),
            }
          : environment,
      ),
    );
  };

  const addGlobalEnvironmentVariable = (environmentId: string) => {
    updateGlobalEnvironmentVariables(environmentId, (variables) => [
      ...variables,
      createEnvironmentVariableRow(),
    ]);
  };

  const updateGlobalEnvironmentVariable = (
    environmentId: string,
    variableId: string,
    field: keyof EnvironmentVariable,
    value: string | boolean,
  ) => {
    updateGlobalEnvironmentVariables(environmentId, (variables) =>
      variables.map((variable) => (variable.id === variableId ? { ...variable, [field]: value } : variable)),
    );
  };

  const removeGlobalEnvironmentVariable = (environmentId: string, variableId: string) => {
    updateGlobalEnvironmentVariables(environmentId, (variables) =>
      variables.filter((variable) => variable.id !== variableId),
    );
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((entry) => entry !== folderId)
        : [...current, folderId],
    );
  };

  const selectRequest = (requestId: string) => {
    setActiveRequestAndPersist(requestId);
    setRequestContextMenu(null);
    setEditingFolderId(null);
    setEditingFolderName("");
    setResult(null);
    setRequestError(null);
    setScriptError(null);
    setUrlPreviewCopied(false);
  };

  const startEditingRequestName = (requestId: string, currentName: string) => {
    setActiveRequestAndPersist(requestId);
    setRequestContextMenu(null);
    setEditingRequestId(requestId);
    setEditingRequestName(currentName);
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const cancelEditingRequestName = () => {
    setEditingRequestId(null);
    setEditingRequestName("");
  };

  const commitEditingRequestName = () => {
    if (!editingRequestId) {
      return;
    }

    const nextName = editingRequestName.trim();

    if (nextName) {
      updateCollectionTree((tree) =>
        updateRequestInTree(tree, editingRequestId, (request) => ({
          ...request,
          name: nextName,
        })),
      );
    }

    cancelEditingRequestName();
  };

  const startEditingFolderName = (folderId: string, currentName: string) => {
    setRequestContextMenu(null);
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
    setEditingRequestId(null);
    setEditingRequestName("");
  };

  const cancelEditingFolderName = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const commitEditingFolderName = () => {
    if (!editingFolderId) {
      return;
    }

    const nextName = editingFolderName.trim();

    if (nextName) {
      updateCollectionTree((tree) =>
        updateFolderInTree(tree, editingFolderId, (folder) => ({
          ...folder,
          name: nextName,
        })),
      );
    }

    cancelEditingFolderName();
  };

  const deleteNode = (nodeId: string) => {
    let removedNode: RequestTreeNode | null = null;

    updateCollectionTree((tree) => {
      const removedResult = removeNodeById(tree, nodeId);
      removedNode = removedResult.removed;
      return removedResult.tree;
    });

    if (!removedNode) {
      return;
    }

    if (editingRequestId && hasRequestInTree([removedNode], editingRequestId)) {
      cancelEditingRequestName();
    }

    if (editingFolderId && nodeContainsNodeId(removedNode, editingFolderId)) {
      cancelEditingFolderName();
    }

    if (activeRequestId && hasRequestInTree([removedNode], activeRequestId)) {
      setActiveRequestAndPersist(null);
      setResult(null);
      setRequestError(null);
      setScriptError(null);
    }

    const removed = removedNode;
    setExpandedFolderIds((current) => current.filter((folderId) => !nodeContainsNodeId(removed, folderId)));
    setRequestContextMenu(null);
  };

  const beginDragNode = (nodeId: string) => (event: ReactDragEvent<HTMLElement>) => {
    event.stopPropagation();
    setDraggingNodeId(nodeId);
    setDragDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", nodeId);
  };

  const endDragNode = () => {
    setDraggingNodeId(null);
    setDragDropTarget(null);
  };

  const commitDrop = (targetFolderId: string | null) => {
    if (!draggingNodeId) {
      return;
    }

    updateCollectionTree((tree) => moveNodeToTarget(tree, draggingNodeId, targetFolderId));

    if (targetFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetFolderId) ? current : [...current, targetFolderId],
      );
    }

    setDragDropTarget(null);
    setDraggingNodeId(null);
  };

  const dragOverRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragDropTarget({ type: "root" });
  };

  const dropOnRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDrop(null);
  };

  const dragOverFolder = (event: ReactDragEvent<HTMLButtonElement>, folderId: string) => {
    if (!draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragDropTarget({ type: "folder", folderId });
  };

  const dropOnFolder = (event: ReactDragEvent<HTMLButtonElement>, folderId: string) => {
    if (!draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDrop(folderId);
  };

  const openRequestContextMenu = (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => {
    event.preventDefault();
    const targetNode = findNodeById(requestTree, nodeId);
    const menuHeight =
      targetNode?.type === "folder" ? REQUEST_CONTEXT_MENU_HEIGHT_FOLDER : REQUEST_CONTEXT_MENU_HEIGHT_REQUEST;

    const x = Math.max(
      REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
      Math.min(
        event.clientX,
        window.innerWidth - REQUEST_CONTEXT_MENU_WIDTH - REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
      ),
    );
    const y = Math.max(
      REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
      Math.min(
        event.clientY,
        window.innerHeight - menuHeight - REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
      ),
    );

    if (targetNode?.type === "request") {
      setActiveRequestAndPersist(nodeId);
    }

    setRequestContextMenu({
      nodeId,
      x,
      y,
    });
  };

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
      errors.push(`Request Error:\n${requestError}`);
    }

    if (scriptError) {
      errors.push(`Script Error:\n${scriptError}`);
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
  }, [prettyResponseBody, requestError, responseTab, result, scriptError]);

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
    ? "Erro"
    : result
      ? `${result.status} ${hasSuccessfulResponse ? "OK" : "Erro"}`
      : "--";
  const secondsDisplay = result ? `${(result.durationMs / 1000).toFixed(2)} s` : "--";
  const transferDisplay = result ? `${(result.totalBytes / 1024).toFixed(2)} KB` : "--";

  const sendRequest = async () => {
    if (!activeRequest) {
      return;
    }

    setIsSending(true);
    setRequestError(null);
    setScriptError(null);
    const pendingEnvironmentChanges = new Map<string, string | null>();
    const pendingGlobalEnvironmentChanges = new Map<string, string | null>();
    const runtimeLocalVariables: Record<string, string> = { ...activeLocalTemplateVariables };
    const runtimeGlobalVariables: Record<string, string> = { ...activeGlobalTemplateVariables };
    const getRuntimeTemplateVariables = () => ({
      ...runtimeGlobalVariables,
      ...runtimeLocalVariables,
    });

    const normalizeVariableKey = (key: unknown) => String(key ?? "").trim();

    const setEnvironmentVariable = (key: unknown, value: unknown) => {
      const normalizedKey = normalizeVariableKey(key);

      if (!normalizedKey) {
        return;
      }

      const normalizedValue = value === undefined || value === null ? "" : String(value);
      runtimeLocalVariables[normalizedKey] = normalizedValue;
      pendingEnvironmentChanges.set(normalizedKey, normalizedValue);
    };

    const unsetEnvironmentVariable = (key: unknown) => {
      const normalizedKey = normalizeVariableKey(key);

      if (!normalizedKey) {
        return;
      }

      delete runtimeLocalVariables[normalizedKey];
      pendingEnvironmentChanges.set(normalizedKey, null);
    };

    const getEnvironmentVariable = (key: unknown) => {
      const normalizedKey = normalizeVariableKey(key);
      return normalizedKey ? runtimeLocalVariables[normalizedKey] ?? null : null;
    };

    const setGlobalEnvironmentVariable = (key: unknown, value: unknown) => {
      const normalizedKey = normalizeVariableKey(key);

      if (!normalizedKey) {
        return;
      }

      const normalizedValue = value === undefined || value === null ? "" : String(value);
      runtimeGlobalVariables[normalizedKey] = normalizedValue;
      pendingGlobalEnvironmentChanges.set(normalizedKey, normalizedValue);
    };

    const unsetGlobalEnvironmentVariable = (key: unknown) => {
      const normalizedKey = normalizeVariableKey(key);

      if (!normalizedKey) {
        return;
      }

      delete runtimeGlobalVariables[normalizedKey];
      pendingGlobalEnvironmentChanges.set(normalizedKey, null);
    };

    const getGlobalEnvironmentVariable = (key: unknown) => {
      const normalizedKey = normalizeVariableKey(key);
      return normalizedKey ? runtimeGlobalVariables[normalizedKey] ?? null : null;
    };

    const persistEnvironmentChanges = () => {
      if (pendingEnvironmentChanges.size === 0) {
        return;
      }

      updateCurrentCollection((currentCollection) => {
        const nextEnvironments = [...currentCollection.environments];
        let nextActiveEnvironmentId = currentCollection.activeEnvironmentId;
        let targetEnvironmentIndex = nextActiveEnvironmentId
          ? nextEnvironments.findIndex((environment) => environment.id === nextActiveEnvironmentId)
          : -1;

        if (targetEnvironmentIndex < 0) {
          const fallbackEnvironment = createEnvironmentItem("Default");
          nextEnvironments.unshift(fallbackEnvironment);
          targetEnvironmentIndex = 0;
          nextActiveEnvironmentId = fallbackEnvironment.id;
        }

        const targetEnvironment = nextEnvironments[targetEnvironmentIndex];
        let nextVariables = [...targetEnvironment.variables];

        pendingEnvironmentChanges.forEach((nextValue, key) => {
          const normalizedKey = key.trim();

          if (!normalizedKey) {
            return;
          }

          const variableIndex = nextVariables.findIndex(
            (variable) => variable.key.trim() === normalizedKey,
          );

          if (nextValue === null) {
            if (variableIndex >= 0) {
              nextVariables = nextVariables.filter((_, index) => index !== variableIndex);
            }

            return;
          }

          if (variableIndex >= 0) {
            nextVariables[variableIndex] = {
              ...nextVariables[variableIndex],
              enabled: true,
              key: normalizedKey,
              value: nextValue,
            };
            return;
          }

          nextVariables = [
            ...nextVariables,
            {
              ...createEnvironmentVariableRow(),
              enabled: true,
              key: normalizedKey,
              value: nextValue,
            },
          ];
        });

        nextEnvironments[targetEnvironmentIndex] = {
          ...targetEnvironment,
          variables: nextVariables,
        };

        return {
          ...currentCollection,
          environments: nextEnvironments,
          activeEnvironmentId: nextActiveEnvironmentId,
        };
      });

      pendingEnvironmentChanges.clear();
    };

    const persistGlobalEnvironmentChanges = () => {
      if (pendingGlobalEnvironmentChanges.size === 0) {
        return;
      }

      updateGlobalEnvironmentState((currentState) => {
        const nextEnvironments = [...currentState.environments];
        let nextActiveEnvironmentId = currentState.activeEnvironmentId;
        let targetEnvironmentIndex = nextActiveEnvironmentId
          ? nextEnvironments.findIndex((environment) => environment.id === nextActiveEnvironmentId)
          : -1;

        if (targetEnvironmentIndex < 0) {
          const fallbackEnvironment = createEnvironmentItem("Global");
          nextEnvironments.unshift(fallbackEnvironment);
          targetEnvironmentIndex = 0;
          nextActiveEnvironmentId = fallbackEnvironment.id;
        }

        const targetEnvironment = nextEnvironments[targetEnvironmentIndex];
        let nextVariables = [...targetEnvironment.variables];

        pendingGlobalEnvironmentChanges.forEach((nextValue, key) => {
          const normalizedKey = key.trim();

          if (!normalizedKey) {
            return;
          }

          const variableIndex = nextVariables.findIndex(
            (variable) => variable.key.trim() === normalizedKey,
          );

          if (nextValue === null) {
            if (variableIndex >= 0) {
              nextVariables = nextVariables.filter((_, index) => index !== variableIndex);
            }

            return;
          }

          if (variableIndex >= 0) {
            nextVariables[variableIndex] = {
              ...nextVariables[variableIndex],
              enabled: true,
              key: normalizedKey,
              value: nextValue,
            };
            return;
          }

          nextVariables = [
            ...nextVariables,
            {
              ...createEnvironmentVariableRow(),
              enabled: true,
              key: normalizedKey,
              value: nextValue,
            },
          ];
        });

        nextEnvironments[targetEnvironmentIndex] = {
          ...targetEnvironment,
          variables: nextVariables,
        };

        return {
          environments: nextEnvironments,
          activeEnvironmentId: nextActiveEnvironmentId,
        };
      });

      pendingGlobalEnvironmentChanges.clear();
    };

    try {
      const resolvedRequest = resolveRequestWithEnvironment(activeRequest, getRuntimeTemplateVariables());
      const finalUrl = buildUrlWithParams(resolvedRequest.url.trim(), resolvedRequest.params);

      const payload: {
        method: ApiRequest["method"];
        url: string;
        headers: Record<string, string>;
        body?: string;
      } = {
        method: resolvedRequest.method,
        url: finalUrl,
        headers: buildHeaders(resolvedRequest),
      };

      const methodWithoutBody = payload.method === "GET";

      if (!methodWithoutBody && resolvedRequest.bodyMode !== "none" && resolvedRequest.body.trim()) {
        payload.body = resolvedRequest.body;
      }

      const environmentApi = {
        get: (key: unknown) => getEnvironmentVariable(key),
        set: (key: unknown, value: unknown) => setEnvironmentVariable(key, value),
        unset: (key: unknown) => unsetEnvironmentVariable(key),
        all: () => ({ ...runtimeLocalVariables }),
      };

      const globalApi = {
        get: (key: unknown) => getGlobalEnvironmentVariable(key),
        set: (key: unknown, value: unknown) => setGlobalEnvironmentVariable(key, value),
        unset: (key: unknown) => unsetGlobalEnvironmentVariable(key),
        all: () => ({ ...runtimeGlobalVariables }),
      };

      const buildScriptBindings = (responsePayload: RequestExecutionResult | null) => {
        const responseApi = responsePayload
          ? {
              json: () => {
                try {
                  return JSON.parse(responsePayload.body || "{}");
                } catch {
                  throw new Error("A resposta nao e um JSON valido.");
                }
              },
              text: () => responsePayload.body ?? "",
              status: responsePayload.status,
              headers: responsePayload.headers,
              cookies: responsePayload.cookies,
            }
          : {
              json: () => {
                throw new Error("Resposta indisponivel no pre-request.");
              },
              text: () => "",
              status: 0,
              headers: {} as Record<string, string>,
              cookies: [] as string[],
            };

        return {
          context: {
            request: payload,
            response: responsePayload,
            environment: environmentApi,
            global: globalApi,
          },
          apinaut: {
            request: payload,
            response: responseApi,
            environment: environmentApi,
            global: globalApi,
            globals: globalApi,
            variables: environmentApi,
          },
          insomnia: {
            request: payload,
            response: {
              json: responseApi.json,
              text: responseApi.text,
              getStatusCode: () => responseApi.status,
              getHeaders: () => responseApi.headers,
            },
            collectionVariables: environmentApi,
            environment: environmentApi,
            globals: globalApi,
          },
        };
      };

      try {
        runUserScript(resolvedRequest.preRequestScript, buildScriptBindings(null));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no script pre-request.";
        setScriptError(message);
      }

      if (payload.method === "GET") {
        delete payload.body;
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
        setResponseTab("body");
        return;
      }

      const resultPayload = data.response;

      try {
        runUserScript(resolvedRequest.afterResponseScript, buildScriptBindings(resultPayload));
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
      setResponseTab("body");
    } finally {
      persistEnvironmentChanges();
      persistGlobalEnvironmentChanges();
      setIsSending(false);
    }
  };

  const copyUrlPreview = async () => {
    if (!urlPreview.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(urlPreview.value);
      setUrlPreviewCopied(true);
      window.setTimeout(() => setUrlPreviewCopied(false), 1000);
    } catch {
      setUrlPreviewCopied(false);
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
    minWidth: `${MIN_LAYOUT_WIDTH}px`,
  } as CSSProperties;

  const renderRequestTreeNodes = (nodes: RequestTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const rowIndentStyle = {
        paddingLeft: `${depth * REQUEST_LIST_INDENT}px`,
      };

      if (node.type === "folder") {
        const isExpanded = expandedFolderIds.includes(node.id);
        const isDropTarget = dragDropTarget?.type === "folder" && dragDropTarget.folderId === node.id;
        const isEditingFolder = editingFolderId === node.id;

        return (
          <div key={node.id} className="space-y-1">
            <div
              style={rowIndentStyle}
              onContextMenu={(event) => openRequestContextMenu(event, node.id)}
            >
              <button
                type="button"
                draggable={!isEditingFolder}
                onDragStart={beginDragNode(node.id)}
                onDragEnd={endDragNode}
                onDragOver={(event) => dragOverFolder(event, node.id)}
                onDrop={(event) => dropOnFolder(event, node.id)}
                onClick={() => toggleFolderExpanded(node.id)}
                onDoubleClick={() => startEditingFolderName(node.id, node.name)}
                className={`flex h-10 w-full items-center gap-2 rounded-lg border px-2 text-left text-sm transition ${
                  isDropTarget
                    ? "border-violet-300/60 bg-violet-500/25"
                    : "border-white/10 bg-[#121025] hover:bg-[#1f1b33]"
                }`}
              >
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-zinc-300 transition ${isExpanded ? "rotate-90" : ""}`}
                />
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-violet-200" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-violet-200" />
                )}
                {!isEditingFolder && <span className="truncate font-medium text-zinc-100">{node.name}</span>}
              </button>

              {isEditingFolder && (
                <input
                  autoFocus
                  value={editingFolderName}
                  onChange={(event) => setEditingFolderName(event.target.value)}
                  onBlur={commitEditingFolderName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitEditingFolderName();
                      return;
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEditingFolderName();
                    }
                  }}
                  className="mt-1 h-8 w-full rounded-md border border-violet-300/40 bg-[#0f0c1d] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                  placeholder="Nome da pasta"
                />
              )}
            </div>

            {isExpanded && node.children.length > 0 && (
              <div className="space-y-1">{renderRequestTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const request = node.request;
      const isEditing = editingRequestId === request.id;

      return (
        <div key={request.id} style={rowIndentStyle}>
          <div
            onContextMenu={(event) => openRequestContextMenu(event, request.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              activeRequestId === request.id
                ? METHOD_STYLE_MAP[request.method].listActive
                : METHOD_STYLE_MAP[request.method].listInactive
            }`}
          >
            <button
              type="button"
              draggable={!isEditing}
              onDragStart={beginDragNode(request.id)}
              onDragEnd={endDragNode}
              onClick={() => selectRequest(request.id)}
              onDoubleClick={() => startEditingRequestName(request.id, request.name)}
              className="w-full text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                    METHOD_STYLE_MAP[request.method].badge
                  }`}
                >
                  {request.method}
                </span>
                {!isEditing && (
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{request.name}</span>
                )}
              </div>
            </button>

            {isEditing && (
              <input
                autoFocus
                value={editingRequestName}
                onChange={(event) => setEditingRequestName(event.target.value)}
                onBlur={commitEditingRequestName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitEditingRequestName();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEditingRequestName();
                  }
                }}
                className="mt-1 h-8 w-full rounded-md border border-violet-300/40 bg-[#0f0c1d] px-2 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                placeholder="Nome da requisicao"
              />
            )}
          </div>
        </div>
      );
    });

  return (
    <main className="h-screen min-h-screen overflow-hidden bg-[#100e1a] text-white">
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-4 py-2">
          <Link
            href="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/55 bg-violet-500/30 text-violet-100 transition hover:bg-violet-500/45"
            aria-label="Voltar para colecoes"
            title="Voltar para colecoes"
          >
            <ArrowBigLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">{collection.name}</h1>

          <div className="ml-auto flex items-center gap-2">
            <StyledSelect
              value={collection.activeEnvironmentId ?? ""}
              onChange={(nextValue) => setActiveEnvironmentId(nextValue || null)}
              options={[
                { value: "", label: "Sem ambiente" },
                ...environments.map((environment) => ({
                  value: environment.id,
                  label: `Local: ${environment.name}`,
                })),
              ]}
              containerClassName="min-w-[180px]"
              triggerClassName="h-8"
              menuClassName="min-w-[180px]"
            />
            <StyledSelect
              value={globalEnvironmentState.activeEnvironmentId ?? ""}
              onChange={(nextValue) => setActiveGlobalEnvironmentId(nextValue || null)}
              options={[
                { value: "", label: "Sem global" },
                ...globalEnvironments.map((environment) => ({
                  value: environment.id,
                  label: `Global: ${environment.name}`,
                })),
              ]}
              containerClassName="min-w-[180px]"
              triggerClassName="h-8"
              menuClassName="min-w-[180px]"
            />
            <button
              type="button"
              onClick={openEnvironmentModal}
              className="h-8 rounded-md border border-violet-300/45 bg-violet-500/15 px-3 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25"
            >
              Ambientes
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            ref={layoutRef}
            className="grid h-full min-h-0 gap-0 [grid-template-columns:var(--left-pane-width)_1px_minmax(0,1fr)_1px_var(--right-pane-width)]"
            style={desktopGridStyle}
          >
          <aside className="min-h-0 overflow-auto border-y border-white/10 bg-[#1a1728] px-0 py-3">
            <div className="mb-3 flex items-center justify-between px-3">
              <h2 className="text-sm font-medium text-zinc-300">Requisicoes</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={createFolder}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
                  aria-label="Criar nova pasta"
                  title="Criar nova pasta"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={createRequest}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25"
                  aria-label="Criar nova requisicao"
                  title="Criar nova requisicao"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              className={`mx-3 mb-2 flex h-9 items-center justify-center rounded-lg border border-dashed text-xs font-medium transition ${
                dragDropTarget?.type === "root"
                  ? "border-violet-300/70 bg-violet-500/20 text-violet-100"
                  : "border-white/20 bg-[#121025] text-zinc-400"
              }`}
              onDragOver={dragOverRoot}
              onDrop={dropOnRoot}
            >
              Soltar na raiz
            </div>
            <div
              className={`space-y-2 rounded-lg ${
                dragDropTarget?.type === "root" ? "ring-1 ring-violet-300/60 ring-offset-1 ring-offset-[#1a1728]" : ""
              }`}
              onDragOver={dragOverRoot}
              onDrop={dropOnRoot}
            >
              {requestTree.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-zinc-400">
                  Nenhuma requisicao ainda.
                </p>
              )}

              {renderRequestTreeNodes(requestTree)}
            </div>
          </aside>

          <div className="relative bg-white/10">
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

          <section className="flex min-h-0 flex-col overflow-hidden border-y border-white/10 bg-[#1a1728] px-0 py-3">
            {activeRequest ? (
              <>
                <div className="mb-3 shrink-0 px-3">
                  <div className="grid gap-2 md:grid-cols-[110px_minmax(0,1fr)_40px]">
                    <select
                      value={activeRequest.method}
                      onChange={(event) =>
                        updateActiveRequest((request) => ({
                          ...request,
                          method: event.target.value as ApiRequest["method"],
                        }))
                      }
                      className={`h-10 rounded-lg border bg-[#121025] px-3 text-sm font-semibold outline-none ring-violet-400 transition focus:ring-2 ${
                        METHOD_STYLE_MAP[activeRequest.method].select
                      }`}
                    >
                      {METHOD_OPTIONS.map((method) => (
                        <option
                          key={method}
                          value={method}
                          style={{
                            color: METHOD_STYLE_MAP[method].optionColor,
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
                        updateActiveRequest((request) => ({
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
                          updateActiveRequest((request) => ({
                            ...request,
                            bodyMode: nextValue as ApiRequest["bodyMode"],
                          }))
                        }
                        options={[
                          { value: "none", label: "Sem body" },
                          { value: "json", label: "JSON" },
                          { value: "text", label: "Text" },
                        ]}
                        triggerClassName="h-10 rounded-lg px-3 text-sm"
                      />

                      <CodeEditor
                        value={activeRequest.body}
                        onChange={(nextBody) =>
                          updateActiveRequest((request) => ({
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
                            ? "Selecione JSON ou Text para habilitar o body."
                            : activeRequest.bodyMode === "json"
                              ? '{\n  "name": "APInaut"\n}'
                              : "Digite o body da requisicao."
                        }
                      />
                    </div>
                  )}

                  {requestTab === "auth" && (
                    <div className="space-y-3 overflow-visible pr-1">
                      <StyledSelect
                        value={activeRequest.authType}
                        onChange={(nextValue) =>
                          updateActiveRequest((request) => ({
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
                              updateActiveRequest((request) => ({
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
                            onClick={() => setShowBearerToken((current) => !current)}
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
                              updateActiveRequest((request) => ({
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
                                updateActiveRequest((request) => ({
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
                              onClick={() => setShowBasicPassword((current) => !current)}
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

                      <CodeEditor
                        value={
                          scriptTab === "pre-request"
                            ? activeRequest.preRequestScript
                            : activeRequest.afterResponseScript
                        }
                        onChange={(nextScript) =>
                          updateActiveRequest((request) =>
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
                        <p>`apinaut.environment.set(&quot;token&quot;, &quot;...&quot;)` para salvar variavel no ambiente ativo.</p>
                        <p>`apinaut.global.set(&quot;url_base&quot;, &quot;http://localhost:8080/&quot;)` para salvar no ambiente global ativo.</p>
                        <p className="mt-1 text-zinc-400">Tambem funciona com compatibilidade: `insomnia.collectionVariables.set(...)`.</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Crie ou selecione uma requisicao para comecar.</p>
            )}
          </section>

          <div className="relative bg-white/10">
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

            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#121025] px-0">
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

              {responseTab === "body" && responseBodyView === "web" ? (
                <div className="h-[486px] overflow-hidden rounded-none border-0 bg-[#0f0d18]">
                  {requestError ? (
                    <div className="p-3 text-sm text-rose-300">Nao foi possivel renderizar a pagina por erro na requisicao.</div>
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
                  className="h-[486px] overflow-auto rounded-none border-0"
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

          </section>
          </div>
        </div>
      </div>

      {requestContextMenu && requestContextMenuTargetNode && (
        <div
          ref={requestContextMenuRef}
          className="fixed z-50 w-44 overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{
            left: requestContextMenu.x,
            top: requestContextMenu.y,
          }}
        >
          {requestContextMenuTargetNode.type === "folder" && (
            <>
              <button
                type="button"
                onClick={() => createRequestInFolder(requestContextMenuTargetNode.id)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-violet-100 transition hover:bg-violet-500/20"
              >
                Nova request aqui
              </button>
              <button
                type="button"
                onClick={() => createFolderInFolder(requestContextMenuTargetNode.id)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-violet-100 transition hover:bg-violet-500/20"
              >
                Nova pasta aqui
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() =>
              requestContextMenuTargetNode.type === "request"
                ? startEditingRequestName(
                    requestContextMenuTargetNode.request.id,
                    requestContextMenuTargetNode.request.name,
                  )
                : startEditingFolderName(requestContextMenuTargetNode.id, requestContextMenuTargetNode.name)
            }
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-white/10"
          >
            Renomear
          </button>
          <button
            type="button"
            onClick={() => deleteNode(requestContextMenuTargetNode.id)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/20"
          >
            Deletar
          </button>
        </div>
      )}

      {templateSuggestion && (
        <div
          ref={templateSuggestionRef}
          className="fixed z-50 w-80 overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{
            left: templateSuggestion.x,
            top: templateSuggestion.y,
          }}
        >
          <p className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-zinc-400">
            Variaveis de ambiente
          </p>
          {templateSuggestion.options.map((option, index) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyTemplateSuggestion(option)}
              className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition ${
                templateSuggestion.selectedIndex === index
                  ? "bg-violet-500/35 text-violet-50"
                  : "text-zinc-100 hover:bg-white/10"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {isEnvironmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={closeEnvironmentModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-xl border border-white/15 bg-[#151225] shadow-[0_12px_42px_rgba(0,0,0,0.5)]"
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

            <div className="grid min-h-[420px] gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="border-r border-white/10 bg-[#121025] p-3">
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

                    <div className="mt-3 space-y-1">
                      {environments.length === 0 && (
                        <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                          Nenhum ambiente local criado.
                        </p>
                      )}

                      {environments.map((environment) => {
                        const isSelected = editingEnvironmentId === environment.id;
                        const isActive = collection.activeEnvironmentId === environment.id;

                        return (
                          <button
                            key={environment.id}
                            type="button"
                            onClick={() => setEditingEnvironmentId(environment.id)}
                            className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-sm transition ${
                              isSelected
                                ? "border-violet-300/55 bg-violet-500/20"
                                : "border-white/10 bg-[#18142d] hover:bg-[#201b36]"
                            }`}
                          >
                            <span className="truncate text-zinc-100">{environment.name}</span>
                            {isActive && (
                              <span className="rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                                ativo
                              </span>
                            )}
                          </button>
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

                    <div className="mt-3 space-y-1">
                      {globalEnvironments.length === 0 && (
                        <p className="rounded-md border border-dashed border-white/15 p-2 text-xs text-zinc-400">
                          Nenhum ambiente global criado.
                        </p>
                      )}

                      {globalEnvironments.map((environment) => {
                        const isSelected = editingGlobalEnvironmentId === environment.id;
                        const isActive = globalEnvironmentState.activeEnvironmentId === environment.id;

                        return (
                          <button
                            key={environment.id}
                            type="button"
                            onClick={() => setEditingGlobalEnvironmentId(environment.id)}
                            className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-sm transition ${
                              isSelected
                                ? "border-violet-300/55 bg-violet-500/20"
                                : "border-white/10 bg-[#18142d] hover:bg-[#201b36]"
                            }`}
                          >
                            <span className="truncate text-zinc-100">{environment.name}</span>
                            {isActive && (
                              <span className="rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                                ativo
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>

              <section className="flex min-h-0 flex-col p-4">
                {environmentModalScope === "local" ? (
                  editingEnvironment ? (
                    <>
                      <div className="grid gap-2 border-b border-white/10 pb-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <input
                          value={editingEnvironment.name}
                          onChange={(event) => updateEnvironmentName(editingEnvironment.id, event.target.value)}
                          className="h-10 rounded-md border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                          placeholder="Nome do ambiente local"
                        />
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
                        <button
                          type="button"
                          onClick={() => deleteEnvironment(editingEnvironment.id)}
                          className="h-10 rounded-md border border-rose-300/45 bg-rose-500/15 px-3 text-sm text-rose-100 transition hover:bg-rose-500/25"
                        >
                          Deletar
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
                          {editingEnvironment.variables.map((variable) => (
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
                                onClick={() => removeEnvironmentVariable(editingEnvironment.id, variable.id)}
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 text-zinc-200 transition hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                                aria-label="Remover variavel"
                                title="Remover variavel"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
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
                    <div className="grid gap-2 border-b border-white/10 pb-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <input
                        value={editingGlobalEnvironment.name}
                        onChange={(event) =>
                          updateGlobalEnvironmentName(editingGlobalEnvironment.id, event.target.value)
                        }
                        className="h-10 rounded-md border border-white/15 bg-[#121025] px-3 text-sm text-zinc-100 outline-none ring-violet-400 transition focus:ring-2"
                        placeholder="Nome do ambiente global"
                      />
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
                      <button
                        type="button"
                        onClick={() => deleteGlobalEnvironment(editingGlobalEnvironment.id)}
                        className="h-10 rounded-md border border-rose-300/45 bg-rose-500/15 px-3 text-sm text-rose-100 transition hover:bg-rose-500/25"
                      >
                        Deletar
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
                        {editingGlobalEnvironment.variables.map((variable) => (
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
                                removeGlobalEnvironmentVariable(editingGlobalEnvironment.id, variable.id)
                              }
                              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 text-zinc-200 transition hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-100"
                              aria-label="Remover variavel"
                              title="Remover variavel"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
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
    </main>
  );
}
