export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthType = "none" | "bearer" | "basic";

export type KeyValueRow = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

export type RequestBodyMode = "none" | "json" | "text";

export type ApiRequest = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  bodyMode: RequestBodyMode;
  body: string;
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

export const createDefaultRequest = (name = "New Request"): ApiRequest => ({
  id: crypto.randomUUID(),
  name,
  method: "GET",
  url: "",
  params: [createRow()],
  headers: [createRow()],
  bodyMode: "none",
  body: "",
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
      candidate.bodyMode === "none" || candidate.bodyMode === "json" || candidate.bodyMode === "text"
        ? candidate.bodyMode
        : request.bodyMode,
    body: typeof candidate.body === "string" ? candidate.body : request.body,
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
  };
};

const normalizePostmanMethod = (value: unknown): HttpMethod => {
  const upper = typeof value === "string" ? value.toUpperCase() : "";

  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
    return upper;
  }

  return "GET";
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

const normalizePostmanBody = (value: unknown): Pick<ApiRequest, "bodyMode" | "body"> => {
  if (!value || typeof value !== "object") {
    return {
      bodyMode: "none",
      body: "",
    };
  }

  const candidate = value as {
    mode?: unknown;
    raw?: unknown;
    options?: unknown;
  };

  if (candidate.mode !== "raw") {
    return {
      bodyMode: "none",
      body: "",
    };
  }

  const rawBody = typeof candidate.raw === "string" ? candidate.raw : "";

  if (!rawBody.trim()) {
    return {
      bodyMode: "none",
      body: "",
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

  return {
    bodyMode: rawLanguage === "json" ? "json" : "text",
    body: rawBody,
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
  const normalizedBody = normalizePostmanBody(requestCandidate.body);
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
      headers: normalizePostmanHeaders(requestCandidate.header),
      bodyMode: normalizedBody.bodyMode,
      body: normalizedBody.body,
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

const normalizeCollectionsFromUnknown = (value: unknown): Collection[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((collection) => normalizeCollection(collection))
      .filter((collection): collection is Collection => collection !== null);

    if (normalized.length > 0) {
      return normalized;
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
