import {
  INSOMNIA_WORKSPACE_TYPE_PREFIX,
  createDefaultRequest,
  createMultipartFormRow,
  createEnvironmentVariable,
  createRow,
  hasJsonContentTypeHeader,
  isRecord,
  looksLikeJsonBody,
  normalizeBodyParamsAsJsonObject,
  normalizeCollection,
  normalizeInsomniaTemplateString,
  normalizeMultipartBodyRows,
  normalizePostmanMethod,
  normalizeTree,
  getInsomniaMetaId,
} from "./helpers";
import type {
  ApiRequest,
  Collection,
  CollectionsExportPayload,
  Environment,
  EnvironmentVariable,
  KeyValueRow,
  RequestTreeNode,
} from "./types";

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
  const path = Array.isArray(candidate.path)
    ? candidate.path.filter((segment): segment is string => typeof segment === "string").join("/")
    : typeof candidate.path === "string"
      ? candidate.path
      : "";
  const url = `${protocol}${host}${path ? `/${path}` : ""}`;

  return {
    url,
    params: queryRows.length ? queryRows : [createRow()],
  };
};

const normalizePostmanHeaders = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value)) {
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
      bodyForm: normalizedBody.bodyForm.length ? normalizedBody.bodyForm : request.bodyForm,
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

  return normalizePostmanRequestNode(candidate);
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

      const candidate = entry as { key?: unknown; value?: unknown; type?: unknown };

      if (typeof candidate.key !== "string") {
        return null;
      }

      return createEnvironmentVariable({
        key: candidate.key,
        value: typeof candidate.value === "string" ? candidate.value : String(candidate.value ?? ""),
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

  if (!candidate.info || typeof candidate.info !== "object") {
    return null;
  }

  const info = candidate.info as {
    name?: unknown;
    _postman_id?: unknown;
  };

  const collectionName =
    typeof info.name === "string" && info.name.trim() ? info.name : "Imported Postman Collection";
  const collectionId = typeof info._postman_id === "string" ? info._postman_id : crypto.randomUUID();
  const requestTree = Array.isArray(candidate.item)
    ? candidate.item
        .map((entry) => normalizePostmanTreeNode(entry))
        .filter((entry): entry is RequestTreeNode => entry !== null)
    : [];
  const importedVariables = normalizePostmanEnvironmentVariables(candidate.variable);
  const environments =
    importedVariables.length > 0
      ? [
          {
            id: crypto.randomUUID(),
            name: "Imported Variables",
            variables: importedVariables,
          },
        ]
      : [];

  return {
    id: collectionId,
    name: collectionName,
    createdAt: new Date().toISOString(),
    requestTree,
    environments,
    activeEnvironmentId: environments[0]?.id ?? null,
    lastActiveRequestId: null,
    requestResponsesByRequestId: {},
  };
};

const normalizePostmanCollectionsFromUnknown = (value: unknown): Collection[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizePostmanCollection(entry))
      .filter((entry): entry is Collection => entry !== null);

    if (normalized.length > 0) {
      return normalized;
    }

    return value
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const candidate = entry as { collections?: unknown };
        return Array.isArray(candidate.collections) ? candidate.collections : [];
      })
      .map((entry) => normalizePostmanCollection(entry))
      .filter((entry): entry is Collection => entry !== null);
  }

  const singleCollection = normalizePostmanCollection(value);

  return singleCollection ? [singleCollection] : [];
};

const normalizeInsomniaRows = (value: unknown): KeyValueRow[] => {
  if (!Array.isArray(value)) {
    return [createRow()];
  }

  const rows = value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.name !== "string") {
        return null;
      }

      return createRow({
        enabled: entry.disabled !== true,
        key: normalizeInsomniaTemplateString(entry.name),
        value:
          typeof entry.value === "string"
            ? normalizeInsomniaTemplateString(entry.value)
            : entry.value === undefined || entry.value === null
              ? ""
              : String(entry.value),
      });
    })
    .filter((entry): entry is KeyValueRow => entry !== null);

  return rows.length ? rows : [createRow()];
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
      bodyForm: body.bodyForm.length ? body.bodyForm : request.bodyForm,
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
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeInsomniaEnvironmentVariables = (value: unknown): EnvironmentVariable[] => {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, currentValue]) =>
      createEnvironmentVariable({
        key: normalizeInsomniaTemplateString(key),
        value: normalizeInsomniaEnvironmentValue(currentValue),
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

      if (isRecord(entry.environment)) {
        collected.push(...normalizeInsomniaEnvironmentVariables(entry.environment));
      }

      if (Array.isArray(entry.children)) {
        walk(entry.children);
      }
    }
  };

  walk(value);
  return collected;
};

const mergeEnvironmentVariablesByKey = (variables: EnvironmentVariable[]): EnvironmentVariable[] => {
  const seen = new Map<string, EnvironmentVariable>();

  for (const variable of variables) {
    const key = variable.key.trim();

    if (!key) {
      continue;
    }

    seen.set(key, {
      ...variable,
      key,
    });
  }

  return Array.from(seen.values());
};

const normalizeInsomniaWorkspaceEnvironments = (value: unknown): Environment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const variables = normalizeInsomniaEnvironmentVariables(entry.data);

      if (variables.length === 0) {
        return null;
      }

      return {
        id: getInsomniaMetaId(entry) ?? crypto.randomUUID(),
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name : "Imported Environment",
        variables,
      };
    })
    .filter((entry): entry is Environment => entry !== null);
};

const normalizeInsomniaCollection = (value: unknown): Collection | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.type !== "string" || !value.type.startsWith(INSOMNIA_WORKSPACE_TYPE_PREFIX)) {
    return null;
  }

  const requestTree = Array.isArray(value.collection)
    ? value.collection
        .map((entry) => normalizeInsomniaTreeNode(entry))
        .filter((entry): entry is RequestTreeNode => entry !== null)
    : [];

  const workspaceEnvironments = normalizeInsomniaWorkspaceEnvironments(value.environments);
  const collectionVariables = collectInsomniaEnvironmentVariablesFromCollectionTree(value.collection);
  const mergedCollectionVariables = mergeEnvironmentVariablesByKey(collectionVariables);

  const environments =
    mergedCollectionVariables.length > 0
      ? [
          ...workspaceEnvironments,
          {
            id: crypto.randomUUID(),
            name: "Imported Environment",
            variables: mergedCollectionVariables,
          },
        ]
      : workspaceEnvironments;

  const activeEnvironmentId = environments[0]?.id ?? null;

  return {
    id: getInsomniaMetaId(value) ?? crypto.randomUUID(),
    name:
      typeof value.name === "string" && value.name.trim() ? value.name : "Imported Insomnia Collection",
    createdAt: new Date().toISOString(),
    requestTree,
    environments,
    activeEnvironmentId,
    lastActiveRequestId: null,
    requestResponsesByRequestId: {},
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
