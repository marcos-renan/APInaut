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

export type RequestExecutionResult = {
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

export type RequestResponseState = {
  result: RequestExecutionResult | null;
  requestError: string | null;
  scriptError: string | null;
};

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
  requestResponsesByRequestId: Record<string, RequestResponseState>;
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
