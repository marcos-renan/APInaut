import type {
  ApiRequest,
  Collection,
  Environment,
  EnvironmentVariable,
  HttpMethod,
  KeyValueRow,
  MultipartFormRow,
  MultipartFormValueType,
  RequestTreeNode,
} from "./types";

export const createRow = (seed?: Partial<KeyValueRow>): KeyValueRow => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  value: seed?.value ?? "",
});

export const createMultipartFormRow = (seed?: Partial<MultipartFormRow>): MultipartFormRow => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  valueType: seed?.valueType === "file" ? "file" : "text",
  value: seed?.value ?? "",
  fileName: typeof seed?.fileName === "string" ? seed.fileName : undefined,
  mimeType: typeof seed?.mimeType === "string" ? seed.mimeType : undefined,
  fileData: typeof seed?.fileData === "string" ? seed.fileData : undefined,
});

export const createEnvironmentVariable = (seed?: Partial<EnvironmentVariable>): EnvironmentVariable => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  value: seed?.value ?? "",
});

export const normalizeEnvironmentVariables = (value: unknown): EnvironmentVariable[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) =>
    createEnvironmentVariable(typeof entry === "object" && entry ? (entry as EnvironmentVariable) : {}),
  );
};

export const createEnvironment = (seed?: Partial<Environment>): Environment => ({
  id: seed?.id ?? crypto.randomUUID(),
  name: typeof seed?.name === "string" && seed.name.trim() ? seed.name : "Default",
  variables: normalizeEnvironmentVariables(seed?.variables),
});

export const normalizeEnvironments = (value: unknown): Environment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) =>
    createEnvironment(typeof entry === "object" && entry ? (entry as Partial<Environment>) : {}),
  );
};

export const normalizeRows = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createRow()];
  }

  return value.map((entry) => createRow(typeof entry === "object" && entry ? (entry as KeyValueRow) : {}));
};

export const normalizeMultipartFormRows = (value: unknown): MultipartFormRow[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createMultipartFormRow()];
  }

  return value.map((entry) =>
    createMultipartFormRow(typeof entry === "object" && entry ? (entry as MultipartFormRow) : {}),
  );
};

export const createDefaultRequest = (name = "New Request"): ApiRequest => ({
  id: crypto.randomUUID(),
  name,
  method: "GET",
  url: "",
  params: [createRow()],
  headers: [createRow()],
  bodyMode: "none",
  body: "",
  bodyForm: [createMultipartFormRow()],
  authType: "none",
  bearerToken: "",
  basicUsername: "",
  basicPassword: "",
  preRequestScript: "",
  afterResponseScript: "",
});

export const normalizeRequest = (value: unknown): ApiRequest => {
  const candidate = typeof value === "object" && value ? (value as Partial<ApiRequest>) : {};
  const request = createDefaultRequest(typeof candidate.name === "string" ? candidate.name : undefined);

  return {
    ...request,
    id: typeof candidate.id === "string" ? candidate.id : request.id,
    method:
      candidate.method === "GET" ||
      candidate.method === "POST" ||
      candidate.method === "PUT" ||
      candidate.method === "PATCH" ||
      candidate.method === "DELETE"
        ? candidate.method
        : request.method,
    url: typeof candidate.url === "string" ? candidate.url : request.url,
    params: normalizeRows(candidate.params),
    headers: normalizeRows(candidate.headers),
    bodyMode:
      candidate.bodyMode === "none" ||
      candidate.bodyMode === "json" ||
      candidate.bodyMode === "text" ||
      candidate.bodyMode === "multipart"
        ? candidate.bodyMode
        : request.bodyMode,
    body: typeof candidate.body === "string" ? candidate.body : request.body,
    bodyForm: normalizeMultipartFormRows(candidate.bodyForm),
    authType:
      candidate.authType === "none" || candidate.authType === "bearer" || candidate.authType === "basic"
        ? candidate.authType
        : request.authType,
    bearerToken: typeof candidate.bearerToken === "string" ? candidate.bearerToken : request.bearerToken,
    basicUsername: typeof candidate.basicUsername === "string" ? candidate.basicUsername : request.basicUsername,
    basicPassword: typeof candidate.basicPassword === "string" ? candidate.basicPassword : request.basicPassword,
    preRequestScript:
      typeof candidate.preRequestScript === "string" ? candidate.preRequestScript : request.preRequestScript,
    afterResponseScript:
      typeof candidate.afterResponseScript === "string"
        ? candidate.afterResponseScript
        : request.afterResponseScript,
  };
};

const normalizeTreeNode = (value: unknown): RequestTreeNode | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    type?: unknown;
    name?: unknown;
    children?: unknown;
    request?: unknown;
  };

  if (candidate.type === "folder") {
    const folderId = typeof candidate.id === "string" ? candidate.id : crypto.randomUUID();
    const folderName = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : "New Folder";
    const children = Array.isArray(candidate.children)
      ? candidate.children
          .map((entry) => normalizeTreeNode(entry))
          .filter((entry): entry is RequestTreeNode => entry !== null)
      : [];

    return {
      id: folderId,
      type: "folder",
      name: folderName,
      children,
    };
  }

  const baseRequest =
    candidate.type === "request" && candidate.request !== undefined
      ? normalizeRequest(candidate.request)
      : normalizeRequest(value);
  const requestId = typeof candidate.id === "string" ? candidate.id : baseRequest.id;

  return {
    id: requestId,
    type: "request",
    request: {
      ...baseRequest,
      id: requestId,
    },
  };
};

export const normalizeTree = (value: unknown): RequestTreeNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeTreeNode(entry))
    .filter((entry): entry is RequestTreeNode => entry !== null);
};

export const normalizeCollection = (value: unknown): Collection | null => {
  const candidate = typeof value === "object" && value ? (value as Record<string, unknown>) : null;

  if (!candidate || typeof candidate.id !== "string" || typeof candidate.name !== "string") {
    return null;
  }

  const sourceTree = Array.isArray(candidate.requestTree)
    ? candidate.requestTree
    : Array.isArray(candidate.requests)
      ? candidate.requests
      : [];

  return {
    id: candidate.id,
    name: candidate.name,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    requestTree: normalizeTree(sourceTree),
    environments: normalizeEnvironments(candidate.environments),
    activeEnvironmentId:
      typeof candidate.activeEnvironmentId === "string" || candidate.activeEnvironmentId === null
        ? candidate.activeEnvironmentId
        : null,
    lastActiveRequestId:
      typeof candidate.lastActiveRequestId === "string" || candidate.lastActiveRequestId === null
        ? candidate.lastActiveRequestId
        : null,
  };
};

export const normalizePostmanMethod = (value: unknown): HttpMethod => {
  const upper = typeof value === "string" ? value.toUpperCase() : "";

  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
    return upper;
  }

  return "GET";
};

export const looksLikeJsonBody = (value: string): boolean => {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }
};

const parseBodyFieldValue = (value: string): unknown => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const isStructuredJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (isStructuredJson) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // mantém como texto quando não for JSON válido apesar de "parecer".
    }
  }

  const lower = trimmed.toLowerCase();
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }
  if (lower === "null") {
    return null;
  }

  return value;
};

export const normalizeBodyParamsAsJsonObject = (entries: Array<{ name: string; value: string }>): string => {
  const result: Record<string, unknown> = {};

  for (const entry of entries) {
    const parsedValue = parseBodyFieldValue(entry.value);
    const currentValue = result[entry.name];

    if (currentValue === undefined) {
      result[entry.name] = parsedValue;
      continue;
    }

    if (Array.isArray(currentValue)) {
      currentValue.push(parsedValue);
      continue;
    }

    result[entry.name] = [currentValue, parsedValue];
  }

  return JSON.stringify(result, null, 2);
};

export const extractFileNameFromPath = (value: string): string => {
  const normalized = value.replaceAll("\\", "/").trim();

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
};

export const normalizeMultipartBodyRows = (entries: unknown[]): MultipartFormRow[] => {
  const rows = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as {
        key?: unknown;
        name?: unknown;
        value?: unknown;
        type?: unknown;
        src?: unknown;
        disabled?: unknown;
        fileName?: unknown;
        mimeType?: unknown;
      };

      const key =
        typeof item.key === "string"
          ? item.key
          : typeof item.name === "string"
            ? item.name
            : "";

      if (!key.trim()) {
        return null;
      }

      const valueType: MultipartFormValueType = item.type === "file" ? "file" : "text";

      if (valueType === "file") {
        const src =
          typeof item.src === "string"
            ? item.src
            : Array.isArray(item.src)
              ? item.src.find((candidate): candidate is string => typeof candidate === "string") ?? ""
              : "";
        const fallbackValue = typeof item.value === "string" ? item.value : "";
        const fileName =
          typeof item.fileName === "string"
            ? item.fileName
            : extractFileNameFromPath(src || fallbackValue);

        return createMultipartFormRow({
          enabled: item.disabled !== true,
          key,
          valueType: "file",
          value: src || fallbackValue,
          fileName: fileName || undefined,
          mimeType: typeof item.mimeType === "string" ? item.mimeType : undefined,
        });
      }

      const value =
        typeof item.value === "string"
          ? item.value
          : item.value === undefined || item.value === null
            ? ""
            : String(item.value);

      return createMultipartFormRow({
        enabled: item.disabled !== true,
        key,
        valueType: "text",
        value,
      });
    })
    .filter((entry): entry is MultipartFormRow => entry !== null);

  return rows.length > 0 ? rows : [createMultipartFormRow()];
};

export const hasJsonContentTypeHeader = (value: unknown): boolean => {
  if (!Array.isArray(value)) {
    return false;
  }

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const item = entry as { key?: unknown; value?: unknown };
    if (typeof item.key !== "string" || typeof item.value !== "string") {
      continue;
    }

    if (item.key.toLowerCase() !== "content-type") {
      continue;
    }

    if (item.value.toLowerCase().includes("json")) {
      return true;
    }
  }

  return false;
};

export const INSOMNIA_WORKSPACE_TYPE_PREFIX = "collection.insomnia.rest/";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeInsomniaTemplateString = (value: string): string =>
  value
    .replaceAll(/_\{\{\s*([^}]+?)\s*\}\}_/g, (_match, variableName: string) => `{{${variableName.trim()}}}`)
    .replaceAll(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, variableName: string) => `{{${variableName.trim()}}}`);

export const getInsomniaMetaId = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  const meta = isRecord(value.meta) ? value.meta : null;

  if (!meta) {
    return null;
  }

  if (typeof meta.id === "string" && meta.id.trim()) {
    return meta.id;
  }

  return null;
};
