export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthType = "none" | "bearer" | "basic";

export type KeyValueRow = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

export type MultipartFormValueType = "text" | "file";

export type MultipartFormRow = {
  id: string;
  enabled: boolean;
  key: string;
  valueType: MultipartFormValueType;
  value: string;
  fileName?: string;
  mimeType?: string;
  fileData?: string;
};

export type RequestBodyMode = "none" | "json" | "text" | "multipart";

export type ApiRequest = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  bodyMode: RequestBodyMode;
  body: string;
  bodyForm: MultipartFormRow[];
  authType: AuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  preRequestScript: string;
  afterResponseScript: string;
};

export type EnvironmentVariable = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

export type GlobalVariable = EnvironmentVariable;

export type Environment = {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
};

export type RequestTreeRequestNode = {
  id: string;
  type: "request";
  request: ApiRequest;
};

export type RequestTreeFolderNode = {
  id: string;
  type: "folder";
  name: string;
  children: RequestTreeNode[];
};

export type RequestTreeNode = RequestTreeRequestNode | RequestTreeFolderNode;

export type Collection = {
  id: string;
  name: string;
  createdAt: string;
  requestTree: RequestTreeNode[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  lastActiveRequestId: string | null;
};

export type GlobalEnvironmentsState = {
  environments: Environment[];
  activeEnvironmentId: string | null;
};

export type CollectionsExportPayload = {
  apinautExportVersion: number;
  exportedAt: string;
  collections: Collection[];
};

const STORAGE_KEY = "apinaut.collections";
const COLLECTIONS_CHANGED_EVENT = "apinaut:collections-changed";
const GLOBAL_VARIABLES_STORAGE_KEY = "apinaut.global-variables";
const GLOBAL_VARIABLES_CHANGED_EVENT = "apinaut:global-variables-changed";
const GLOBAL_ENVIRONMENTS_STORAGE_KEY = "apinaut.global-environments";
const GLOBAL_ENVIRONMENTS_CHANGED_EVENT = "apinaut:global-environments-changed";
const EMPTY_COLLECTIONS: Collection[] = [];
const EMPTY_GLOBAL_VARIABLES: GlobalVariable[] = [];
const EMPTY_GLOBAL_ENVIRONMENTS_STATE: GlobalEnvironmentsState = {
  environments: [],
  activeEnvironmentId: null,
};

let cachedRaw: string | null = null;
let cachedCollections: Collection[] = EMPTY_COLLECTIONS;
let cachedGlobalVariablesRaw: string | null = null;
let cachedGlobalVariables: GlobalVariable[] = EMPTY_GLOBAL_VARIABLES;
let cachedGlobalEnvironmentsRaw: string | null = null;
let cachedGlobalEnvironmentsState: GlobalEnvironmentsState = EMPTY_GLOBAL_ENVIRONMENTS_STATE;

const createRow = (seed?: Partial<KeyValueRow>): KeyValueRow => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  value: seed?.value ?? "",
});

const createMultipartFormRow = (seed?: Partial<MultipartFormRow>): MultipartFormRow => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  valueType: seed?.valueType === "file" ? "file" : "text",
  value: seed?.value ?? "",
  fileName: typeof seed?.fileName === "string" ? seed.fileName : undefined,
  mimeType: typeof seed?.mimeType === "string" ? seed.mimeType : undefined,
  fileData: typeof seed?.fileData === "string" ? seed.fileData : undefined,
});

const createEnvironmentVariable = (seed?: Partial<EnvironmentVariable>): EnvironmentVariable => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  value: seed?.value ?? "",
});

const normalizeEnvironmentVariables = (value: unknown): EnvironmentVariable[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) =>
    createEnvironmentVariable(typeof entry === "object" && entry ? (entry as EnvironmentVariable) : {}),
  );
};

const createEnvironment = (seed?: Partial<Environment>): Environment => ({
  id: seed?.id ?? crypto.randomUUID(),
  name: typeof seed?.name === "string" && seed.name.trim() ? seed.name : "Default",
  variables: normalizeEnvironmentVariables(seed?.variables),
});

const normalizeEnvironments = (value: unknown): Environment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) =>
    createEnvironment(typeof entry === "object" && entry ? (entry as Partial<Environment>) : {}),
  );
};

const normalizeRows = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createRow()];
  }

  return value.map((entry) => createRow(typeof entry === "object" && entry ? (entry as KeyValueRow) : {}));
};

const normalizeMultipartFormRows = (value: unknown): MultipartFormRow[] => {
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

const normalizeRequest = (value: unknown): ApiRequest => {
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

const normalizeTree = (value: unknown): RequestTreeNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeTreeNode(entry))
    .filter((entry): entry is RequestTreeNode => entry !== null);
};

const normalizeCollection = (value: unknown): Collection | null => {
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

const normalizePostmanMethod = (value: unknown): HttpMethod => {
  const upper = typeof value === "string" ? value.toUpperCase() : "";

  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
    return upper;
  }

  return "GET";
};

const looksLikeJsonBody = (value: string): boolean => {
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

const normalizeBodyParamsAsJsonObject = (entries: Array<{ name: string; value: string }>): string => {
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

const extractFileNameFromPath = (value: string): string => {
  const normalized = value.replaceAll("\\", "/").trim();

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
};

const normalizeMultipartBodyRows = (entries: unknown[]): MultipartFormRow[] => {
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

const hasJsonContentTypeHeader = (value: unknown): boolean => {
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

const normalizePostmanUrl = (value: unknown): { url: string; params: KeyValueRow[] } => {
  if (typeof value === "string") {
    return {
      url: value,
      params: [createRow()],
    };
  }

  if (!value || typeof value !== "object") {
    return {
      url: "",
      params: [createRow()],
    };
  }

  const candidate = value as {
    raw?: unknown;
    protocol?: unknown;
    host?: unknown;
    path?: unknown;
    query?: unknown;
  };

  const queryRows = Array.isArray(candidate.query)
    ? candidate.query
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const item = entry as { key?: unknown; value?: unknown; disabled?: unknown };

          if (typeof item.key !== "string") {
            return null;
          }

          return createRow({
            enabled: item.disabled !== true,
            key: item.key,
            value: typeof item.value === "string" ? item.value : "",
          });
        })
        .filter((entry): entry is KeyValueRow => entry !== null)
    : [];

  if (typeof candidate.raw === "string") {
    return {
      url: candidate.raw,
      params: queryRows.length ? queryRows : [createRow()],
    };
  }

  const protocol = typeof candidate.protocol === "string" && candidate.protocol.trim() ? `${candidate.protocol}://` : "";
  const host =
    typeof candidate.host === "string"
      ? candidate.host
      : Array.isArray(candidate.host)
        ? candidate.host.filter((segment): segment is string => typeof segment === "string").join(".")
        : "";
  const path =
    typeof candidate.path === "string"
      ? candidate.path
      : Array.isArray(candidate.path)
        ? candidate.path.filter((segment): segment is string => typeof segment === "string").join("/")
        : "";
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  return {
    url: `${protocol}${host}${normalizedPath}`,
    params: queryRows.length ? queryRows : [createRow()],
  };
};

const normalizePostmanHeaders = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createRow()];
  }

  const rows = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as { key?: unknown; value?: unknown; disabled?: unknown };

      if (typeof item.key !== "string") {
        return null;
      }

      return createRow({
        enabled: item.disabled !== true,
        key: item.key,
        value: typeof item.value === "string" ? item.value : "",
      });
    })
    .filter((entry): entry is KeyValueRow => entry !== null);

  return rows.length ? rows : [createRow()];
};

const normalizePostmanAuth = (
  value: unknown,
): Pick<ApiRequest, "authType" | "bearerToken" | "basicUsername" | "basicPassword"> => {
  if (!value || typeof value !== "object") {
    return {
      authType: "none",
      bearerToken: "",
      basicUsername: "",
      basicPassword: "",
    };
  }

  const candidate = value as {
    type?: unknown;
    bearer?: unknown;
    basic?: unknown;
  };

  if (candidate.type === "bearer" && Array.isArray(candidate.bearer)) {
    const tokenEntry = candidate.bearer.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { key?: unknown }).key === "token" &&
        typeof (entry as { value?: unknown }).value === "string",
    ) as { value?: unknown } | undefined;

    return {
      authType: "bearer",
      bearerToken: typeof tokenEntry?.value === "string" ? tokenEntry.value : "",
      basicUsername: "",
      basicPassword: "",
    };
  }

  if (candidate.type === "basic" && Array.isArray(candidate.basic)) {
    const usernameEntry = candidate.basic.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { key?: unknown }).key === "username" &&
        typeof (entry as { value?: unknown }).value === "string",
    ) as { value?: unknown } | undefined;
    const passwordEntry = candidate.basic.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { key?: unknown }).key === "password" &&
        typeof (entry as { value?: unknown }).value === "string",
    ) as { value?: unknown } | undefined;

    return {
      authType: "basic",
      bearerToken: "",
      basicUsername: typeof usernameEntry?.value === "string" ? usernameEntry.value : "",
      basicPassword: typeof passwordEntry?.value === "string" ? passwordEntry.value : "",
    };
  }

  return {
    authType: "none",
    bearerToken: "",
    basicUsername: "",
    basicPassword: "",
  };
};

const normalizePostmanBody = (
  value: unknown,
  headers: unknown,
): Pick<ApiRequest, "bodyMode" | "body" | "bodyForm"> => {
  if (!value || typeof value !== "object") {
    return {
      bodyMode: "none",
      body: "",
      bodyForm: [createMultipartFormRow()],
    };
  }

  const candidate = value as {
    mode?: unknown;
    raw?: unknown;
    formdata?: unknown;
    urlencoded?: unknown;
    options?: unknown;
  };

  if (candidate.mode === "formdata") {
    const rows = normalizeMultipartBodyRows(Array.isArray(candidate.formdata) ? candidate.formdata : []);
    return {
      bodyMode: rows.length > 0 && rows.some((row) => row.key.trim()) ? "multipart" : "none",
      body: "",
      bodyForm: rows,
    };
  }

  if (candidate.mode === "urlencoded") {
    const rows = normalizeMultipartBodyRows(Array.isArray(candidate.urlencoded) ? candidate.urlencoded : []);
    return {
      bodyMode: rows.length > 0 && rows.some((row) => row.key.trim()) ? "multipart" : "none",
      body: "",
      bodyForm: rows.map((row) => (row.valueType === "file" ? { ...row, valueType: "text" } : row)),
    };
  }

  if (candidate.mode !== "raw") {
    return {
      bodyMode: "none",
      body: "",
      bodyForm: [createMultipartFormRow()],
    };
  }

  const rawBody = typeof candidate.raw === "string" ? candidate.raw : "";

  if (!rawBody.trim()) {
    return {
      bodyMode: "none",
      body: "",
      bodyForm: [createMultipartFormRow()],
    };
  }

  const rawLanguage =
    candidate.options &&
    typeof candidate.options === "object" &&
    (candidate.options as { raw?: unknown }).raw &&
    typeof (candidate.options as { raw?: unknown }).raw === "object" &&
    typeof ((candidate.options as { raw?: { language?: unknown } }).raw?.language) === "string"
      ? (candidate.options as { raw?: { language?: string } }).raw?.language?.toLowerCase()
      : "";
  const hasJsonHeader = hasJsonContentTypeHeader(headers);
  const bodyLooksJson = looksLikeJsonBody(rawBody);

  return {
    bodyMode: rawLanguage === "json" || hasJsonHeader || bodyLooksJson ? "json" : "text",
    body: rawBody,
    bodyForm: [createMultipartFormRow()],
  };
};

const normalizePostmanScript = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    exec?: unknown;
  };

  if (typeof candidate.exec === "string") {
    return candidate.exec;
  }

  if (!Array.isArray(candidate.exec)) {
    return "";
  }

  return candidate.exec.filter((line): line is string => typeof line === "string").join("\n");
};

const extractPostmanEventScript = (events: unknown, listen: "prerequest" | "test"): string => {
  if (!Array.isArray(events)) {
    return "";
  }

  const blocks = events
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }

      const event = entry as {
        listen?: unknown;
        script?: unknown;
      };

      if (event.listen !== listen) {
        return "";
      }

      return normalizePostmanScript(event.script);
    })
    .filter((content) => content.trim().length > 0);

  return blocks.join("\n\n");
};

const normalizePostmanRequestNode = (value: unknown): RequestTreeNode | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as {
    id?: unknown;
    _postman_id?: unknown;
    name?: unknown;
    request?: unknown;
    event?: unknown;
  };

  if (!item.request) {
    return null;
  }

  const requestObject =
    typeof item.request === "string"
      ? {
          method: "GET",
          url: item.request,
        }
      : item.request;
  const requestValue = requestObject && typeof requestObject === "object" ? requestObject : {};
  const requestCandidate = requestValue as {
    method?: unknown;
    url?: unknown;
    header?: unknown;
    body?: unknown;
    auth?: unknown;
  };

  const normalizedUrl = normalizePostmanUrl(requestCandidate.url);
  const normalizedAuth = normalizePostmanAuth(requestCandidate.auth);
  const normalizedHeaders = normalizePostmanHeaders(requestCandidate.header);
  const normalizedBody = normalizePostmanBody(requestCandidate.body, requestCandidate.header);
  const requestId =
    typeof item.id === "string"
      ? item.id
      : typeof item._postman_id === "string"
        ? item._postman_id
        : crypto.randomUUID();
  const requestName = typeof item.name === "string" && item.name.trim() ? item.name : "New Request";
  const request = createDefaultRequest(requestName);

  return {
    id: requestId,
    type: "request",
    request: {
      ...request,
      id: requestId,
      name: requestName,
      method: normalizePostmanMethod(requestCandidate.method),
      url: normalizedUrl.url,
      params: normalizedUrl.params,
      headers: normalizedHeaders,
      bodyMode: normalizedBody.bodyMode,
      body: normalizedBody.body,
      bodyForm: normalizedBody.bodyForm,
      authType: normalizedAuth.authType,
      bearerToken: normalizedAuth.bearerToken,
      basicUsername: normalizedAuth.basicUsername,
      basicPassword: normalizedAuth.basicPassword,
      preRequestScript: extractPostmanEventScript(item.event, "prerequest"),
      afterResponseScript: extractPostmanEventScript(item.event, "test"),
    },
  };
};

const normalizePostmanTreeNode = (value: unknown): RequestTreeNode | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    _postman_id?: unknown;
    name?: unknown;
    item?: unknown;
    request?: unknown;
  };

  if (Array.isArray(candidate.item)) {
    const children = candidate.item
      .map((entry) => normalizePostmanTreeNode(entry))
      .filter((entry): entry is RequestTreeNode => entry !== null);
    const folderId =
      typeof candidate.id === "string"
        ? candidate.id
        : typeof candidate._postman_id === "string"
          ? candidate._postman_id
          : crypto.randomUUID();
    const folderName = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : "New Folder";

    return {
      id: folderId,
      type: "folder",
      name: folderName,
      children,
    };
  }

  if (candidate.request) {
    return normalizePostmanRequestNode(candidate);
  }

  return null;
};

const normalizePostmanEnvironmentVariables = (value: unknown): EnvironmentVariable[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const variable = entry as {
        id?: unknown;
        key?: unknown;
        value?: unknown;
        disabled?: unknown;
      };

      if (typeof variable.key !== "string" || !variable.key.trim()) {
        return null;
      }

      return createEnvironmentVariable({
        id: typeof variable.id === "string" ? variable.id : undefined,
        enabled: variable.disabled !== true,
        key: variable.key,
        value: typeof variable.value === "string" ? variable.value : "",
      });
    })
    .filter((entry): entry is EnvironmentVariable => entry !== null);
};

const normalizePostmanCollection = (value: unknown): Collection | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    info?: unknown;
    item?: unknown;
    variable?: unknown;
  };

  if (!candidate.info || typeof candidate.info !== "object" || !Array.isArray(candidate.item)) {
    return null;
  }

  const info = candidate.info as {
    _postman_id?: unknown;
    name?: unknown;
  };
  const collectionName =
    typeof info.name === "string" && info.name.trim() ? info.name : "Imported Postman Collection";
  const collectionId = typeof info._postman_id === "string" ? info._postman_id : crypto.randomUUID();
  const requestTree = candidate.item
    .map((entry) => normalizePostmanTreeNode(entry))
    .filter((entry): entry is RequestTreeNode => entry !== null);
  const importedVariables = normalizePostmanEnvironmentVariables(candidate.variable);
  const defaultEnvironment =
    importedVariables.length > 0
      ? {
          id: crypto.randomUUID(),
          name: "Imported Variables",
          variables: importedVariables,
        }
      : null;

  return {
    id: collectionId,
    name: collectionName,
    createdAt: new Date().toISOString(),
    requestTree,
    environments: defaultEnvironment ? [defaultEnvironment] : [],
    activeEnvironmentId: defaultEnvironment ? defaultEnvironment.id : null,
    lastActiveRequestId: null,
  };
};

const normalizePostmanCollectionsFromUnknown = (value: unknown): Collection[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizePostmanCollection(entry))
      .filter((entry): entry is Collection => entry !== null);
  }

  const singleCollection = normalizePostmanCollection(value);

  if (singleCollection) {
    return [singleCollection];
  }

  if (value && typeof value === "object") {
    const candidate = value as { collections?: unknown };

    if (Array.isArray(candidate.collections)) {
      return candidate.collections
        .map((entry) => normalizePostmanCollection(entry))
        .filter((entry): entry is Collection => entry !== null);
    }
  }

  return [];
};

const INSOMNIA_WORKSPACE_TYPE_PREFIX = "collection.insomnia.rest/";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeInsomniaTemplateString = (value: string): string =>
  value
    .replace(/\{\{\s*_\[['"]([^'"\]]+)['"]\]\s*\}\}/g, (_match, variableName: string) => `{{${variableName}}}`)
    .replace(/\{\{\s*_\.([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, variableName: string) => `{{${variableName}}}`);

const getInsomniaMetaId = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  const metaId = isRecord(value.meta) && typeof value.meta.id === "string" ? value.meta.id : null;

  if (metaId) {
    return metaId;
  }

  return typeof value.id === "string" ? value.id : null;
};

const normalizeInsomniaRows = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value)) {
    return [createRow()];
  }

  const rows = value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.name !== "string" || !entry.name.trim()) {
        return null;
      }

      return createRow({
        enabled: entry.disabled !== true,
        key: entry.name,
        value:
          typeof entry.value === "string"
            ? normalizeInsomniaTemplateString(entry.value)
            : entry.value === null || entry.value === undefined
              ? ""
              : String(entry.value),
      });
    })
    .filter((entry): entry is KeyValueRow => entry !== null);

  return rows.length > 0 ? rows : [createRow()];
};

const normalizeInsomniaAuth = (
  value: unknown,
): Pick<ApiRequest, "authType" | "bearerToken" | "basicUsername" | "basicPassword"> => {
  if (!isRecord(value)) {
    return {
      authType: "none",
      bearerToken: "",
      basicUsername: "",
      basicPassword: "",
    };
  }

  if (value.type === "bearer") {
    return {
      authType: "bearer",
      bearerToken:
        typeof value.token === "string" ? normalizeInsomniaTemplateString(value.token) : "",
      basicUsername: "",
      basicPassword: "",
    };
  }

  if (value.type === "basic") {
    return {
      authType: "basic",
      bearerToken: "",
      basicUsername:
        typeof value.username === "string" ? normalizeInsomniaTemplateString(value.username) : "",
      basicPassword:
        typeof value.password === "string" ? normalizeInsomniaTemplateString(value.password) : "",
    };
  }

  return {
    authType: "none",
    bearerToken: "",
    basicUsername: "",
    basicPassword: "",
  };
};

const normalizeInsomniaBody = (value: unknown): Pick<ApiRequest, "bodyMode" | "body" | "bodyForm"> => {
  if (!isRecord(value)) {
    return {
      bodyMode: "none",
      body: "",
      bodyForm: [createMultipartFormRow()],
    };
  }

  const rawText = typeof value.text === "string" ? normalizeInsomniaTemplateString(value.text) : "";
  const mimeType = typeof value.mimeType === "string" ? value.mimeType.toLowerCase() : "";

  if (rawText.trim()) {
    return {
      bodyMode: mimeType.includes("json") || looksLikeJsonBody(rawText) ? "json" : "text",
      body: rawText,
      bodyForm: [createMultipartFormRow()],
    };
  }

  if (Array.isArray(value.params)) {
    const multipartRows = normalizeMultipartBodyRows(
      value.params.map((entry) => {
        if (!isRecord(entry)) {
          return entry;
        }

        const normalized: Record<string, unknown> = {
          ...entry,
          name:
            typeof entry.name === "string"
              ? normalizeInsomniaTemplateString(entry.name)
              : entry.name,
          value:
            typeof entry.value === "string"
              ? normalizeInsomniaTemplateString(entry.value)
              : entry.value,
        };

        if (typeof entry.fileName === "string") {
          normalized.fileName = normalizeInsomniaTemplateString(entry.fileName);
        }

        if (typeof entry.filePath === "string") {
          normalized.src = normalizeInsomniaTemplateString(entry.filePath);
        }

        return normalized;
      }),
    );

    const hasEnabledRows = multipartRows.some((row) => row.enabled && row.key.trim());
    const hasFileRows = multipartRows.some((row) => row.valueType === "file");

    if (hasEnabledRows && (mimeType.includes("multipart/form-data") || hasFileRows)) {
      return {
        bodyMode: "multipart",
        body: "",
        bodyForm: multipartRows,
      };
    }

    const textRows = multipartRows
      .filter((row) => row.enabled && row.key.trim() && row.valueType === "text")
      .map((row) => ({
        name: row.key,
        value: row.value,
      }));

    if (textRows.length > 0) {
      if (mimeType.includes("x-www-form-urlencoded")) {
        return {
          bodyMode: "text",
          body: textRows.map((entry) => `${entry.name}=${entry.value}`).join("&"),
          bodyForm: [createMultipartFormRow()],
        };
      }

      return {
        bodyMode: "json",
        body: normalizeBodyParamsAsJsonObject(textRows),
        bodyForm: [createMultipartFormRow()],
      };
    }
  }

  return {
    bodyMode: "none",
    body: "",
    bodyForm: [createMultipartFormRow()],
  };
};

const normalizeInsomniaScripts = (value: unknown): Pick<ApiRequest, "preRequestScript" | "afterResponseScript"> => {
  if (!isRecord(value)) {
    return {
      preRequestScript: "",
      afterResponseScript: "",
    };
  }

  return {
    preRequestScript:
      typeof value.preRequest === "string" ? normalizeInsomniaTemplateString(value.preRequest) : "",
    afterResponseScript:
      typeof value.afterResponse === "string" ? normalizeInsomniaTemplateString(value.afterResponse) : "",
  };
};

const normalizeInsomniaRequestNode = (value: unknown): RequestTreeNode | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.method !== "string" && typeof value.url !== "string") {
    return null;
  }

  const requestId = getInsomniaMetaId(value) ?? crypto.randomUUID();
  const requestName = typeof value.name === "string" && value.name.trim() ? value.name : "New Request";
  const body = normalizeInsomniaBody(value.body);
  const auth = normalizeInsomniaAuth(value.authentication);
  const scripts = normalizeInsomniaScripts(value.scripts);
  const request = createDefaultRequest(requestName);

  return {
    id: requestId,
    type: "request",
    request: {
      ...request,
      id: requestId,
      name: requestName,
      method: normalizePostmanMethod(value.method),
      url: typeof value.url === "string" ? normalizeInsomniaTemplateString(value.url) : "",
      params: normalizeInsomniaRows(value.parameters),
      headers: normalizeInsomniaRows(value.headers),
      bodyMode: body.bodyMode,
      body: body.body,
      bodyForm: body.bodyForm,
      authType: auth.authType,
      bearerToken: auth.bearerToken,
      basicUsername: auth.basicUsername,
      basicPassword: auth.basicPassword,
      preRequestScript: scripts.preRequestScript,
      afterResponseScript: scripts.afterResponseScript,
    },
  };
};

const normalizeInsomniaTreeNode = (value: unknown): RequestTreeNode | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.children)) {
    const folderId = getInsomniaMetaId(value) ?? crypto.randomUUID();
    const folderName = typeof value.name === "string" && value.name.trim() ? value.name : "New Folder";
    const children = value.children
      .map((entry) => normalizeInsomniaTreeNode(entry))
      .filter((entry): entry is RequestTreeNode => entry !== null);

    return {
      id: folderId,
      type: "folder",
      name: folderName,
      children,
    };
  }

  return normalizeInsomniaRequestNode(value);
};

const normalizeInsomniaEnvironmentValue = (value: unknown): string => {
  if (typeof value === "string") {
    return normalizeInsomniaTemplateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const normalizeInsomniaEnvironmentVariables = (value: unknown): EnvironmentVariable[] => {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, currentValue]) =>
      createEnvironmentVariable({
        key,
        value: normalizeInsomniaEnvironmentValue(currentValue),
        enabled: true,
      }),
    );
};

const collectInsomniaEnvironmentVariablesFromCollectionTree = (value: unknown): EnvironmentVariable[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const collected: EnvironmentVariable[] = [];

  const walk = (items: unknown[]) => {
    for (const entry of items) {
      if (!isRecord(entry)) {
        continue;
      }

      collected.push(...normalizeInsomniaEnvironmentVariables(entry.environment));

      if (Array.isArray(entry.children)) {
        walk(entry.children);
      }
    }
  };

  walk(value);
  return collected;
};

const mergeEnvironmentVariablesByKey = (variables: EnvironmentVariable[]): EnvironmentVariable[] => {
  const variablesMap = new Map<string, EnvironmentVariable>();

  for (const variable of variables) {
    const key = variable.key.trim();

    if (!key) {
      continue;
    }

    variablesMap.set(key, {
      ...variable,
      id: crypto.randomUUID(),
      key,
      enabled: true,
    });
  }

  return Array.from(variablesMap.values());
};

const normalizeInsomniaWorkspaceEnvironments = (value: unknown): Environment[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }

        const variables = normalizeInsomniaEnvironmentVariables(entry.data);

        if (variables.length === 0) {
          return null;
        }

        return createEnvironment({
          id: getInsomniaMetaId(entry) ?? crypto.randomUUID(),
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name : "Imported Environment",
          variables,
        });
      })
      .filter((entry): entry is Environment => entry !== null);
  }

  if (!isRecord(value)) {
    return [];
  }

  const variables = normalizeInsomniaEnvironmentVariables(value.data);

  if (variables.length === 0) {
    return [];
  }

  return [
    createEnvironment({
      id: getInsomniaMetaId(value) ?? crypto.randomUUID(),
      name: typeof value.name === "string" && value.name.trim() ? value.name : "Imported Environment",
      variables,
    }),
  ];
};

const normalizeInsomniaCollection = (value: unknown): Collection | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.type !== "string" || !value.type.startsWith(INSOMNIA_WORKSPACE_TYPE_PREFIX)) {
    return null;
  }

  if (!Array.isArray(value.collection)) {
    return null;
  }

  const requestTree = value.collection
    .map((entry) => normalizeInsomniaTreeNode(entry))
    .filter((entry): entry is RequestTreeNode => entry !== null);

  const workspaceEnvironments = normalizeInsomniaWorkspaceEnvironments(value.environments);
  const collectionVariables = collectInsomniaEnvironmentVariablesFromCollectionTree(value.collection);

  const environments =
    workspaceEnvironments.length > 0 || collectionVariables.length > 0
      ? (() => {
          if (workspaceEnvironments.length === 0) {
            return [
              createEnvironment({
                name: "Imported Environment",
                variables: mergeEnvironmentVariablesByKey(collectionVariables),
              }),
            ];
          }

          const [firstEnvironment, ...rest] = workspaceEnvironments;
          const mergedVariables = mergeEnvironmentVariablesByKey([
            ...firstEnvironment.variables,
            ...collectionVariables,
          ]);

          return [
            {
              ...firstEnvironment,
              variables: mergedVariables,
            },
            ...rest,
          ];
        })()
      : [];

  return {
    id: getInsomniaMetaId(value) ?? crypto.randomUUID(),
    name:
      typeof value.name === "string" && value.name.trim() ? value.name : "Imported Insomnia Collection",
    createdAt: new Date().toISOString(),
    requestTree,
    environments,
    activeEnvironmentId: environments.length > 0 ? environments[0].id : null,
    lastActiveRequestId: null,
  };
};

const normalizeInsomniaCollectionsFromUnknown = (value: unknown): Collection[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeInsomniaCollection(entry))
      .filter((entry): entry is Collection => entry !== null);
  }

  const singleCollection = normalizeInsomniaCollection(value);

  return singleCollection ? [singleCollection] : [];
};

const normalizeCollectionsFromUnknown = (value: unknown): Collection[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((collection) => normalizeCollection(collection))
      .filter((collection): collection is Collection => collection !== null);

    if (normalized.length > 0) {
      return normalized;
    }

    const normalizedInsomnia = normalizeInsomniaCollectionsFromUnknown(value);

    if (normalizedInsomnia.length > 0) {
      return normalizedInsomnia;
    }

    return normalizePostmanCollectionsFromUnknown(value);
  }

  if (value && typeof value === "object") {
    const candidate = value as { collections?: unknown };

    if (Array.isArray(candidate.collections)) {
      const normalized = candidate.collections
        .map((collection) => normalizeCollection(collection))
        .filter((collection): collection is Collection => collection !== null);

      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  const normalizedInsomnia = normalizeInsomniaCollectionsFromUnknown(value);

  if (normalizedInsomnia.length > 0) {
    return normalizedInsomnia;
  }

  return normalizePostmanCollectionsFromUnknown(value);
};

export const parseCollectionsData = (value: unknown): Collection[] =>
  normalizeCollectionsFromUnknown(value);

export const createCollectionsExportPayload = (collections: Collection[]): CollectionsExportPayload => ({
  apinautExportVersion: 1,
  exportedAt: new Date().toISOString(),
  collections,
});

export const flattenRequestTree = (nodes: RequestTreeNode[]): ApiRequest[] => {
  const result: ApiRequest[] = [];

  const walk = (items: RequestTreeNode[]) => {
    for (const item of items) {
      if (item.type === "request") {
        result.push(item.request);
      } else {
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return result;
};

export const countRequestsInTree = (nodes: RequestTreeNode[]) => flattenRequestTree(nodes).length;

export const loadCollections = (): Collection[] => {
  if (typeof window === "undefined") {
    return EMPTY_COLLECTIONS;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === cachedRaw) {
    return cachedCollections;
  }

  if (!stored) {
    cachedRaw = stored;
    cachedCollections = EMPTY_COLLECTIONS;
    return cachedCollections;
  }

  try {
    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      cachedRaw = stored;
      cachedCollections = EMPTY_COLLECTIONS;
      return cachedCollections;
    }

    const normalized = normalizeCollectionsFromUnknown(parsed);

    cachedRaw = stored;
    cachedCollections = normalized;
    return cachedCollections;
  } catch {
    cachedRaw = stored;
    cachedCollections = EMPTY_COLLECTIONS;
    return cachedCollections;
  }
};

export const saveCollections = (collections: Collection[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(collections);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  cachedRaw = serialized;
  cachedCollections = collections;
  window.dispatchEvent(new Event(COLLECTIONS_CHANGED_EVENT));
};

export const updateCollections = (updater: (current: Collection[]) => Collection[]) => {
  const current = loadCollections();
  const next = updater(current);
  saveCollections(next);
  return next;
};

export const subscribeCollections = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();

  window.addEventListener("storage", handler);
  window.addEventListener(COLLECTIONS_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COLLECTIONS_CHANGED_EVENT, handler);
  };
};

export const getCollectionsSnapshot = () => loadCollections();
export const getCollectionsServerSnapshot = () => EMPTY_COLLECTIONS;

const normalizeGlobalVariablesFromUnknown = (value: unknown): GlobalVariable[] => {
  if (!Array.isArray(value)) {
    return EMPTY_GLOBAL_VARIABLES;
  }

  return value.map((entry) =>
    createEnvironmentVariable(
      typeof entry === "object" && entry ? (entry as Partial<EnvironmentVariable>) : {},
    ),
  );
};

export const loadGlobalVariables = (): GlobalVariable[] => {
  if (typeof window === "undefined") {
    return EMPTY_GLOBAL_VARIABLES;
  }

  const stored = window.localStorage.getItem(GLOBAL_VARIABLES_STORAGE_KEY);

  if (stored === cachedGlobalVariablesRaw) {
    return cachedGlobalVariables;
  }

  if (!stored) {
    cachedGlobalVariablesRaw = stored;
    cachedGlobalVariables = EMPTY_GLOBAL_VARIABLES;
    return cachedGlobalVariables;
  }

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeGlobalVariablesFromUnknown(parsed);
    cachedGlobalVariablesRaw = stored;
    cachedGlobalVariables = normalized;
    return cachedGlobalVariables;
  } catch {
    cachedGlobalVariablesRaw = stored;
    cachedGlobalVariables = EMPTY_GLOBAL_VARIABLES;
    return cachedGlobalVariables;
  }
};

export const saveGlobalVariables = (variables: GlobalVariable[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(variables);
  window.localStorage.setItem(GLOBAL_VARIABLES_STORAGE_KEY, serialized);
  cachedGlobalVariablesRaw = serialized;
  cachedGlobalVariables = variables;
  window.dispatchEvent(new Event(GLOBAL_VARIABLES_CHANGED_EVENT));
};

export const updateGlobalVariables = (updater: (current: GlobalVariable[]) => GlobalVariable[]) => {
  const current = loadGlobalVariables();
  const next = updater(current);
  saveGlobalVariables(next);
  return next;
};

export const subscribeGlobalVariables = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();

  window.addEventListener("storage", handler);
  window.addEventListener(GLOBAL_VARIABLES_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(GLOBAL_VARIABLES_CHANGED_EVENT, handler);
  };
};

export const getGlobalVariablesSnapshot = () => loadGlobalVariables();
export const getGlobalVariablesServerSnapshot = () => EMPTY_GLOBAL_VARIABLES;

const normalizeGlobalEnvironmentsState = (value: unknown): GlobalEnvironmentsState => {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  if (!candidate) {
    return EMPTY_GLOBAL_ENVIRONMENTS_STATE;
  }

  const environments = normalizeEnvironments(candidate.environments);
  const activeEnvironmentId =
    typeof candidate.activeEnvironmentId === "string" || candidate.activeEnvironmentId === null
      ? candidate.activeEnvironmentId
      : null;
  const hasActive = activeEnvironmentId
    ? environments.some((environment) => environment.id === activeEnvironmentId)
    : false;

  return {
    environments,
    activeEnvironmentId: hasActive ? activeEnvironmentId : environments[0]?.id ?? null,
  };
};

export const loadGlobalEnvironmentsState = (): GlobalEnvironmentsState => {
  if (typeof window === "undefined") {
    return EMPTY_GLOBAL_ENVIRONMENTS_STATE;
  }

  const stored = window.localStorage.getItem(GLOBAL_ENVIRONMENTS_STORAGE_KEY);

  if (stored === cachedGlobalEnvironmentsRaw) {
    return cachedGlobalEnvironmentsState;
  }

  if (!stored) {
    cachedGlobalEnvironmentsRaw = stored;
    cachedGlobalEnvironmentsState = EMPTY_GLOBAL_ENVIRONMENTS_STATE;
    return cachedGlobalEnvironmentsState;
  }

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeGlobalEnvironmentsState(parsed);
    cachedGlobalEnvironmentsRaw = stored;
    cachedGlobalEnvironmentsState = normalized;
    return cachedGlobalEnvironmentsState;
  } catch {
    cachedGlobalEnvironmentsRaw = stored;
    cachedGlobalEnvironmentsState = EMPTY_GLOBAL_ENVIRONMENTS_STATE;
    return cachedGlobalEnvironmentsState;
  }
};

export const saveGlobalEnvironmentsState = (state: GlobalEnvironmentsState) => {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(state);
  window.localStorage.setItem(GLOBAL_ENVIRONMENTS_STORAGE_KEY, serialized);
  cachedGlobalEnvironmentsRaw = serialized;
  cachedGlobalEnvironmentsState = state;
  window.dispatchEvent(new Event(GLOBAL_ENVIRONMENTS_CHANGED_EVENT));
};

export const updateGlobalEnvironmentsState = (
  updater: (current: GlobalEnvironmentsState) => GlobalEnvironmentsState,
) => {
  const current = loadGlobalEnvironmentsState();
  const next = updater(current);
  saveGlobalEnvironmentsState(next);
  return next;
};

export const subscribeGlobalEnvironmentsState = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();

  window.addEventListener("storage", handler);
  window.addEventListener(GLOBAL_ENVIRONMENTS_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(GLOBAL_ENVIRONMENTS_CHANGED_EVENT, handler);
  };
};

export const getGlobalEnvironmentsStateSnapshot = () => loadGlobalEnvironmentsState();
export const getGlobalEnvironmentsStateServerSnapshot = () => EMPTY_GLOBAL_ENVIRONMENTS_STATE;
