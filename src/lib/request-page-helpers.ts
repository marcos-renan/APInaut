import type {
  ApiRequest,
  Environment,
  EnvironmentVariable,
  KeyValueRow,
  MultipartFormRow,
  RequestTreeFolderNode,
  RequestTreeNode,
} from "@/lib/collections";
import { createDefaultRequest } from "@/lib/collections";

export type PaneWidths = {
  left: number;
  right: number;
};

export const MIN_LEFT_PANEL_WIDTH = 140;
export const MIN_CENTER_PANEL_WIDTH = 300;
export const MIN_RIGHT_PANEL_WIDTH = 220;
export const RESIZER_WIDTH = 1;
export const MIN_LAYOUT_WIDTH =
  MIN_LEFT_PANEL_WIDTH + MIN_CENTER_PANEL_WIDTH + MIN_RIGHT_PANEL_WIDTH + RESIZER_WIDTH * 2;
export const COMPACT_LAYOUT_BREAKPOINT = 860;
export const DELETE_CONFIRM_TIMEOUT_MS = 1500;
export const PANE_LAYOUT_STORAGE_KEY = "apinaut:request-pane-layout:v1";
export const DEFAULT_LEFT_PANEL_WIDTH = 240;
export const REQUEST_CONTEXT_MENU_WIDTH = 176;
export const REQUEST_CONTEXT_MENU_HEIGHT_REQUEST = 132;
export const REQUEST_CONTEXT_MENU_HEIGHT_FOLDER = 168;
export const REQUEST_CONTEXT_MENU_VIEWPORT_PADDING = 8;
export const TEMPLATE_SUGGESTION_MENU_WIDTH = 320;
export const TEMPLATE_SUGGESTION_MENU_HEIGHT = 300;
export const TEMPLATE_VARIABLE_TRIGGER_REGEX = /\{\{([A-Za-z0-9_.-]*)$/;
export const TEMPLATE_VARIABLE_LOOKUP_REGEX = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
export const METHOD_OPTIONS: ApiRequest["method"][] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_STYLE_MAP: Record<
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

export const clampPaneWidths = (containerWidth: number, left: number, right: number): PaneWidths => {
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

export const getInitialPaneWidths = (): PaneWidths => {
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

export const createRow = (): KeyValueRow => ({
  id: crypto.randomUUID(),
  enabled: true,
  key: "",
  value: "",
});

export const createMultipartFormRow = (): MultipartFormRow => ({
  id: crypto.randomUUID(),
  enabled: true,
  key: "",
  valueType: "text",
  value: "",
});

export const normalizeRowsForUi = (rows: KeyValueRow[]): KeyValueRow[] => {
  if (!rows.length) {
    return [createRow()];
  }

  return rows.map((row) => ({
    ...row,
    id: row.id || crypto.randomUUID(),
  }));
};

export const normalizeMultipartRowsForUi = (rows: MultipartFormRow[]): MultipartFormRow[] => {
  if (!rows.length) {
    return [createMultipartFormRow()];
  }

  return rows.map((row) => ({
    ...row,
    id: row.id || crypto.randomUUID(),
    valueType: row.valueType === "file" ? "file" : "text",
  }));
};

export const createRequestForUi = (name: string): ApiRequest => ({
  ...createDefaultRequest(name),
  params: [createRow()],
  headers: [createRow()],
  bodyForm: [createMultipartFormRow()],
});

export const createRequestNode = (name = "New Request"): RequestTreeNode => {
  const request = createRequestForUi(name);

  return {
    id: request.id,
    type: "request",
    request,
  };
};

export const createFolderNode = (name = "New Folder"): RequestTreeFolderNode => ({
  id: crypto.randomUUID(),
  type: "folder",
  name,
  children: [],
});

export const createEnvironmentVariableRow = (): EnvironmentVariable => ({
  id: crypto.randomUUID(),
  enabled: true,
  key: "",
  value: "",
});

export const createEnvironmentItem = (name = "Default"): Environment => ({
  id: crypto.randomUUID(),
  name,
  variables: [],
});

export const reorderItemsById = <T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string,
): T[] => {
  if (sourceId === targetId) {
    return items;
  }

  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);

  if (!moved) {
    return items;
  }

  next.splice(targetIndex, 0, moved);
  return next;
};

export const interpolateTemplateValue = (value: string, variables: Record<string, string>) =>
  value.replace(TEMPLATE_VARIABLE_LOOKUP_REGEX, (match, variableName: string) =>
    Object.prototype.hasOwnProperty.call(variables, variableName) ? variables[variableName] : match,
  );

export const interpolateRows = (rows: KeyValueRow[], variables: Record<string, string>): KeyValueRow[] =>
  rows.map((row) => ({
    ...row,
    key: interpolateTemplateValue(row.key, variables),
    value: interpolateTemplateValue(row.value, variables),
  }));

export const resolveRequestWithEnvironment = (
  request: ApiRequest,
  variables: Record<string, string>,
): ApiRequest => ({
  ...request,
  url: interpolateTemplateValue(request.url, variables),
  params: interpolateRows(request.params, variables),
  headers: interpolateRows(request.headers, variables),
  body: interpolateTemplateValue(request.body, variables),
  bodyForm: request.bodyForm.map((row) => ({
    ...row,
    key: interpolateTemplateValue(row.key, variables),
    value: row.valueType === "text" ? interpolateTemplateValue(row.value, variables) : row.value,
  })),
  bearerToken: interpolateTemplateValue(request.bearerToken, variables),
  basicUsername: interpolateTemplateValue(request.basicUsername, variables),
  basicPassword: interpolateTemplateValue(request.basicPassword, variables),
  preRequestScript: interpolateTemplateValue(request.preRequestScript, variables),
  afterResponseScript: interpolateTemplateValue(request.afterResponseScript, variables),
});

export const buildUrlWithParams = (baseUrl: string, params: KeyValueRow[]) => {
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

export const buildHeaders = (request: ApiRequest): Record<string, string> => {
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

  if (request.bodyMode === "multipart") {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-type") {
        delete headers[key];
      }
    }
  }

  return headers;
};

export const runUserScript = (scriptCode: string, bindings: Record<string, unknown>) => {
  if (!scriptCode.trim()) {
    return;
  }

  const bindingNames = Object.keys(bindings);
  const bindingValues = Object.values(bindings);
  const execute = new Function(...bindingNames, `"use strict";\n${scriptCode}`);
  execute(...bindingValues);
};

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : "");
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Falha ao ler arquivo."));
    };

    reader.readAsDataURL(file);
  });
