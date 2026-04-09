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
};

const STORAGE_KEY = "apinaut.collections";
const COLLECTIONS_CHANGED_EVENT = "apinaut:collections-changed";
const EMPTY_COLLECTIONS: Collection[] = [];

let cachedRaw: string | null = null;
let cachedCollections: Collection[] = EMPTY_COLLECTIONS;

const createRow = (seed?: Partial<KeyValueRow>): KeyValueRow => ({
  id: seed?.id ?? crypto.randomUUID(),
  enabled: seed?.enabled ?? true,
  key: seed?.key ?? "",
  value: seed?.value ?? "",
});

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
  };
};

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

    const normalized = parsed
      .map((collection) => normalizeCollection(collection))
      .filter((collection): collection is Collection => collection !== null);

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
