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
  Copy,
  Eye,
  EyeOff,
  Send,
} from "lucide-react";
import { CodeEditor } from "@/components/code-editor";
import { EnvironmentModal } from "@/components/environment-modal";
import { KeyValueEditor, MultipartFormEditor } from "@/components/request-editors";
import { RequestTreePanel } from "@/components/request-tree-panel";
import { StyledSelect } from "@/components/styled-select";
import {
  ApiRequest,
  Collection,
  Environment,
  EnvironmentVariable,
  GlobalEnvironmentsState,
  MultipartFormRow,
  RequestTreeNode,
  KeyValueRow,
  getCollectionsServerSnapshot,
  getCollectionsSnapshot,
  getGlobalEnvironmentsStateServerSnapshot,
  getGlobalEnvironmentsStateSnapshot,
  subscribeCollections,
  subscribeGlobalEnvironmentsState,
  updateCollections,
  updateGlobalEnvironmentsState,
} from "@/lib/collections";
import {
  buildHeaders,
  buildUrlWithParams,
  clampPaneWidths,
  createEnvironmentItem,
  createEnvironmentVariableRow,
  createFolderNode,
  createMultipartFormRow,
  createRow,
  createRequestNode,
  escapeHtml,
  DEFAULT_LEFT_PANEL_WIDTH,
  DELETE_CONFIRM_TIMEOUT_MS,
  getInitialPaneWidths,
  METHOD_OPTIONS,
  METHOD_STYLE_MAP,
  MIN_CENTER_PANEL_WIDTH,
  MIN_LAYOUT_WIDTH,
  MIN_LEFT_PANEL_WIDTH,
  MIN_RIGHT_PANEL_WIDTH,
  normalizeMultipartRowsForUi,
  normalizeRowsForUi,
  PANE_LAYOUT_STORAGE_KEY,
  readFileAsBase64,
  REQUEST_CONTEXT_MENU_HEIGHT_FOLDER,
  REQUEST_CONTEXT_MENU_HEIGHT_REQUEST,
  REQUEST_CONTEXT_MENU_WIDTH,
  REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
  RESIZER_WIDTH,
  resolveRequestWithEnvironment,
  runUserScript,
  TEMPLATE_SUGGESTION_MENU_HEIGHT,
  TEMPLATE_SUGGESTION_MENU_WIDTH,
  TEMPLATE_VARIABLE_LOOKUP_REGEX,
  TEMPLATE_VARIABLE_TRIGGER_REGEX,
  type PaneWidths,
} from "@/lib/request-page-helpers";
import {
  findFolderPathForRequest,
  findNodeById,
  findRequestById,
  hasRequestInTree,
  insertIntoFolderById,
  moveNodeToPosition,
  moveNodeToTarget,
  nodeContainsNodeId,
  removeNodeById,
  updateFolderInTree,
  updateRequestInTree,
} from "@/lib/request-tree";

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
  | { type: "position"; parentFolderId: string | null; index: number }
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

export default function CollectionDetailsPage() {
  const params = useParams<{ id: string }>();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const requestContextMenuRef = useRef<HTMLDivElement | null>(null);
  const templateSuggestionRef = useRef<HTMLDivElement | null>(null);
  const draggingNodeIdRef = useRef<string | null>(null);
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
  const [editingEnvironmentNameId, setEditingEnvironmentNameId] = useState<string | null>(null);
  const [editingEnvironmentName, setEditingEnvironmentName] = useState("");
  const [editingGlobalEnvironmentNameId, setEditingGlobalEnvironmentNameId] = useState<string | null>(null);
  const [editingGlobalEnvironmentName, setEditingGlobalEnvironmentName] = useState("");
  const [pendingDeleteEnvironmentId, setPendingDeleteEnvironmentId] = useState<string | null>(null);
  const [pendingDeleteGlobalEnvironmentId, setPendingDeleteGlobalEnvironmentId] = useState<string | null>(null);
  const [pendingDeleteEnvironmentVariableKey, setPendingDeleteEnvironmentVariableKey] = useState<string | null>(null);
  const [pendingDeleteGlobalEnvironmentVariableKey, setPendingDeleteGlobalEnvironmentVariableKey] = useState<
    string | null
  >(null);
  const deleteEnvironmentConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteGlobalEnvironmentConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteEnvironmentVariableConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteGlobalEnvironmentVariableConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const clearDragState = () => {
      draggingNodeIdRef.current = null;
      setDraggingNodeId(null);
      setDragDropTarget(null);
    };

    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);

    return () => {
      window.removeEventListener("dragend", clearDragState);
      window.removeEventListener("drop", clearDragState);
    };
  }, []);

  useEffect(
    () => () => {
      if (deleteEnvironmentConfirmTimeoutRef.current) {
        clearTimeout(deleteEnvironmentConfirmTimeoutRef.current);
      }
      if (deleteGlobalEnvironmentConfirmTimeoutRef.current) {
        clearTimeout(deleteGlobalEnvironmentConfirmTimeoutRef.current);
      }
      if (deleteEnvironmentVariableConfirmTimeoutRef.current) {
        clearTimeout(deleteEnvironmentVariableConfirmTimeoutRef.current);
      }
      if (deleteGlobalEnvironmentVariableConfirmTimeoutRef.current) {
        clearTimeout(deleteGlobalEnvironmentVariableConfirmTimeoutRef.current);
      }
    },
    [],
  );

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
          bodyForm: normalizeMultipartRowsForUi(nextRequest.bodyForm),
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

  const updateMultipartRow = (
    rowId: string,
    field: keyof MultipartFormRow,
    value: string | boolean,
  ) => {
    updateActiveRequest((request) => ({
      ...request,
      bodyForm: request.bodyForm.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
  };

  const addMultipartRow = () => {
    updateActiveRequest((request) => ({
      ...request,
      bodyForm: [...request.bodyForm, createMultipartFormRow()],
    }));
  };

  const removeMultipartRow = (rowId: string) => {
    updateActiveRequest((request) => {
      const filtered = request.bodyForm.filter((row) => row.id !== rowId);

      return {
        ...request,
        bodyForm: filtered.length ? filtered : [createMultipartFormRow()],
      };
    });
  };

  const selectMultipartFile = async (rowId: string, file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const fileData = await readFileAsBase64(file);

      updateActiveRequest((request) => ({
        ...request,
        bodyForm: request.bodyForm.map((row) =>
          row.id === rowId
            ? {
                ...row,
                valueType: "file",
                value: file.name,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                fileData,
              }
            : row,
        ),
      }));
    } catch {
      setRequestError("Falha ao carregar o arquivo selecionado.");
      setResponseTab("body");
    }
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
    if (deleteEnvironmentConfirmTimeoutRef.current) {
      clearTimeout(deleteEnvironmentConfirmTimeoutRef.current);
      deleteEnvironmentConfirmTimeoutRef.current = null;
    }
    if (deleteGlobalEnvironmentConfirmTimeoutRef.current) {
      clearTimeout(deleteGlobalEnvironmentConfirmTimeoutRef.current);
      deleteGlobalEnvironmentConfirmTimeoutRef.current = null;
    }
    if (deleteEnvironmentVariableConfirmTimeoutRef.current) {
      clearTimeout(deleteEnvironmentVariableConfirmTimeoutRef.current);
      deleteEnvironmentVariableConfirmTimeoutRef.current = null;
    }
    if (deleteGlobalEnvironmentVariableConfirmTimeoutRef.current) {
      clearTimeout(deleteGlobalEnvironmentVariableConfirmTimeoutRef.current);
      deleteGlobalEnvironmentVariableConfirmTimeoutRef.current = null;
    }

    setEditingEnvironmentNameId(null);
    setEditingEnvironmentName("");
    setEditingGlobalEnvironmentNameId(null);
    setEditingGlobalEnvironmentName("");
    setPendingDeleteEnvironmentId(null);
    setPendingDeleteGlobalEnvironmentId(null);
    setPendingDeleteEnvironmentVariableKey(null);
    setPendingDeleteGlobalEnvironmentVariableKey(null);
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
    if (editingEnvironmentNameId === environmentId) {
      setEditingEnvironmentNameId(null);
      setEditingEnvironmentName("");
    }
  };

  const updateEnvironmentName = (environmentId: string, name: string) => {
    updateCollectionEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId ? { ...environment, name } : environment,
      ),
    );
  };

  const startEditingEnvironmentName = (environmentId: string, currentName: string) => {
    setEditingEnvironmentId(environmentId);
    setEditingEnvironmentNameId(environmentId);
    setEditingEnvironmentName(currentName);
  };

  const cancelEditingEnvironmentName = () => {
    setEditingEnvironmentNameId(null);
    setEditingEnvironmentName("");
  };

  const commitEditingEnvironmentName = () => {
    if (!editingEnvironmentNameId) {
      return;
    }

    const nextName = editingEnvironmentName.trim();

    if (nextName) {
      updateEnvironmentName(editingEnvironmentNameId, nextName);
    }

    cancelEditingEnvironmentName();
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

  const handleDeleteEnvironmentClick = (environmentId: string) => {
    if (pendingDeleteEnvironmentId === environmentId) {
      if (deleteEnvironmentConfirmTimeoutRef.current) {
        clearTimeout(deleteEnvironmentConfirmTimeoutRef.current);
      }

      deleteEnvironmentConfirmTimeoutRef.current = null;
      setPendingDeleteEnvironmentId(null);
      deleteEnvironment(environmentId);
      return;
    }

    if (deleteEnvironmentConfirmTimeoutRef.current) {
      clearTimeout(deleteEnvironmentConfirmTimeoutRef.current);
    }

    setPendingDeleteEnvironmentId(environmentId);
    deleteEnvironmentConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteEnvironmentId((current) => (current === environmentId ? null : current));
      deleteEnvironmentConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
  };

  const handleRemoveEnvironmentVariableClick = (environmentId: string, variableId: string) => {
    const key = `${environmentId}:${variableId}`;

    if (pendingDeleteEnvironmentVariableKey === key) {
      if (deleteEnvironmentVariableConfirmTimeoutRef.current) {
        clearTimeout(deleteEnvironmentVariableConfirmTimeoutRef.current);
      }

      deleteEnvironmentVariableConfirmTimeoutRef.current = null;
      setPendingDeleteEnvironmentVariableKey(null);
      removeEnvironmentVariable(environmentId, variableId);
      return;
    }

    if (deleteEnvironmentVariableConfirmTimeoutRef.current) {
      clearTimeout(deleteEnvironmentVariableConfirmTimeoutRef.current);
    }

    setPendingDeleteEnvironmentVariableKey(key);
    deleteEnvironmentVariableConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteEnvironmentVariableKey((current) => (current === key ? null : current));
      deleteEnvironmentVariableConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
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
    if (editingGlobalEnvironmentNameId === environmentId) {
      setEditingGlobalEnvironmentNameId(null);
      setEditingGlobalEnvironmentName("");
    }
  };

  const updateGlobalEnvironmentName = (environmentId: string, name: string) => {
    updateGlobalEnvironments((current) =>
      current.map((environment) =>
        environment.id === environmentId ? { ...environment, name } : environment,
      ),
    );
  };

  const startEditingGlobalEnvironmentName = (environmentId: string, currentName: string) => {
    setEditingGlobalEnvironmentId(environmentId);
    setEditingGlobalEnvironmentNameId(environmentId);
    setEditingGlobalEnvironmentName(currentName);
  };

  const cancelEditingGlobalEnvironmentName = () => {
    setEditingGlobalEnvironmentNameId(null);
    setEditingGlobalEnvironmentName("");
  };

  const commitEditingGlobalEnvironmentName = () => {
    if (!editingGlobalEnvironmentNameId) {
      return;
    }

    const nextName = editingGlobalEnvironmentName.trim();

    if (nextName) {
      updateGlobalEnvironmentName(editingGlobalEnvironmentNameId, nextName);
    }

    cancelEditingGlobalEnvironmentName();
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

  const handleDeleteGlobalEnvironmentClick = (environmentId: string) => {
    if (pendingDeleteGlobalEnvironmentId === environmentId) {
      if (deleteGlobalEnvironmentConfirmTimeoutRef.current) {
        clearTimeout(deleteGlobalEnvironmentConfirmTimeoutRef.current);
      }

      deleteGlobalEnvironmentConfirmTimeoutRef.current = null;
      setPendingDeleteGlobalEnvironmentId(null);
      deleteGlobalEnvironment(environmentId);
      return;
    }

    if (deleteGlobalEnvironmentConfirmTimeoutRef.current) {
      clearTimeout(deleteGlobalEnvironmentConfirmTimeoutRef.current);
    }

    setPendingDeleteGlobalEnvironmentId(environmentId);
    deleteGlobalEnvironmentConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteGlobalEnvironmentId((current) => (current === environmentId ? null : current));
      deleteGlobalEnvironmentConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
  };

  const handleRemoveGlobalEnvironmentVariableClick = (environmentId: string, variableId: string) => {
    const key = `${environmentId}:${variableId}`;

    if (pendingDeleteGlobalEnvironmentVariableKey === key) {
      if (deleteGlobalEnvironmentVariableConfirmTimeoutRef.current) {
        clearTimeout(deleteGlobalEnvironmentVariableConfirmTimeoutRef.current);
      }

      deleteGlobalEnvironmentVariableConfirmTimeoutRef.current = null;
      setPendingDeleteGlobalEnvironmentVariableKey(null);
      removeGlobalEnvironmentVariable(environmentId, variableId);
      return;
    }

    if (deleteGlobalEnvironmentVariableConfirmTimeoutRef.current) {
      clearTimeout(deleteGlobalEnvironmentVariableConfirmTimeoutRef.current);
    }

    setPendingDeleteGlobalEnvironmentVariableKey(key);
    deleteGlobalEnvironmentVariableConfirmTimeoutRef.current = setTimeout(() => {
      setPendingDeleteGlobalEnvironmentVariableKey((current) => (current === key ? null : current));
      deleteGlobalEnvironmentVariableConfirmTimeoutRef.current = null;
    }, DELETE_CONFIRM_TIMEOUT_MS);
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
    draggingNodeIdRef.current = nodeId;
    setDraggingNodeId(nodeId);
    setDragDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-apinaut-node-id", nodeId);
    event.dataTransfer.setData("text/plain", nodeId);
  };

  const endDragNode = () => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    setDragDropTarget(null);
  };

  const resolveDraggingNodeId = (event?: ReactDragEvent<HTMLElement>) => {
    if (draggingNodeIdRef.current) {
      return draggingNodeIdRef.current;
    }

    if (draggingNodeId) {
      return draggingNodeId;
    }

    if (!event) {
      return null;
    }

    const transferId =
      event.dataTransfer.getData("application/x-apinaut-node-id") ||
      event.dataTransfer.getData("text/plain");

    return transferId.trim() ? transferId.trim() : null;
  };

  const commitDrop = (targetFolderId: string | null, sourceNodeId?: string | null) => {
    const draggingId = sourceNodeId ?? resolveDraggingNodeId();

    if (!draggingId) {
      return;
    }

    updateCollectionTree((tree) => moveNodeToTarget(tree, draggingId, targetFolderId));

    if (targetFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetFolderId) ? current : [...current, targetFolderId],
      );
    }

    draggingNodeIdRef.current = null;
    setDragDropTarget(null);
    setDraggingNodeId(null);
  };

  const commitDropAtPosition = (
    targetParentFolderId: string | null,
    index: number,
    sourceNodeId?: string | null,
  ) => {
    const draggingId = sourceNodeId ?? resolveDraggingNodeId();

    if (!draggingId) {
      return;
    }

    updateCollectionTree((tree) =>
      moveNodeToPosition(tree, draggingId, targetParentFolderId, index),
    );

    if (targetParentFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetParentFolderId) ? current : [...current, targetParentFolderId],
      );
    }

    draggingNodeIdRef.current = null;
    setDragDropTarget(null);
    setDraggingNodeId(null);
  };

  const dragOverRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragDropTarget({ type: "root" });
  };

  const dropOnRoot = (event: ReactDragEvent<HTMLDivElement>) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDrop(null, draggingId);
  };

  const dragOverFolder = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5;

    if (ratio <= 0.25) {
      setDragDropTarget({ type: "position", parentFolderId, index });
      return;
    }

    if (ratio >= 0.75) {
      setDragDropTarget({ type: "position", parentFolderId, index: index + 1 });
      return;
    }

    setDragDropTarget({ type: "folder", folderId });
  };

  const dropOnFolder = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
    folderId: string,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5;

    if (ratio <= 0.25) {
      commitDropAtPosition(parentFolderId, index, draggingId);
      return;
    }

    if (ratio >= 0.75) {
      commitDropAtPosition(parentFolderId, index + 1, draggingId);
      return;
    }

    commitDrop(folderId, draggingId);
  };

  const dragOverRequest = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const targetIndex = relativeY < rect.height / 2 ? index : index + 1;
    setDragDropTarget({ type: "position", parentFolderId, index: targetIndex });
  };

  const dropOnRequest = (
    event: ReactDragEvent<HTMLElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const targetIndex = relativeY < rect.height / 2 ? index : index + 1;
    commitDropAtPosition(parentFolderId, targetIndex, draggingId);
  };

  const dragOverPosition = (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragDropTarget({ type: "position", parentFolderId, index });
  };

  const dropOnPosition = (
    event: ReactDragEvent<HTMLDivElement>,
    parentFolderId: string | null,
    index: number,
  ) => {
    const draggingId = resolveDraggingNodeId(event);

    if (!draggingId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    commitDropAtPosition(parentFolderId, index, draggingId);
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
        bodyMode: ApiRequest["bodyMode"];
        body?: string;
        multipart?: Array<{
          enabled: boolean;
          key: string;
          valueType: MultipartFormRow["valueType"];
          value: string;
          fileName?: string;
          mimeType?: string;
          fileData?: string;
        }>;
      } = {
        method: resolvedRequest.method,
        url: finalUrl,
        headers: buildHeaders(resolvedRequest),
        bodyMode: resolvedRequest.bodyMode,
      };

      const methodWithoutBody = payload.method === "GET";

      if (!methodWithoutBody && resolvedRequest.bodyMode !== "none") {
        if (resolvedRequest.bodyMode === "multipart") {
          const enabledRows = resolvedRequest.bodyForm
            .filter((row) => row.enabled && row.key.trim())
            .map((row) => ({
              enabled: row.enabled,
              key: row.key,
              valueType: row.valueType,
              value: row.value,
              fileName: row.fileName,
              mimeType: row.mimeType,
              fileData: row.fileData,
            }));

          const missingFiles = enabledRows.filter(
            (row) =>
              row.valueType === "file" &&
              (!row.fileData || !row.fileData.trim() || !row.fileName || !row.fileName.trim()),
          );

          if (missingFiles.length > 0) {
            const first = missingFiles[0];
            throw new Error(
              `Selecione um arquivo para o campo multipart "${first.key}" antes de enviar.`,
            );
          }

          payload.multipart = enabledRows;
        } else if (resolvedRequest.body.trim()) {
          payload.body = resolvedRequest.body;
        }
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
        delete payload.multipart;
        payload.bodyMode = "none";
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
      <main className="h-full overflow-auto bg-[#100e1a] px-6 py-8 text-white">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-white/10 bg-[#1a1728] p-6">
          <p className="text-sm text-zinc-300">Carregando colecao...</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="h-full overflow-auto bg-[#100e1a] px-6 py-8 text-white">
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

  return (
    <main className="h-full min-h-full overflow-hidden bg-[#100e1a] text-white">
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
          <RequestTreePanel
            requestTree={requestTree}
            activeRequestId={activeRequestId}
            editingRequestId={editingRequestId}
            editingRequestName={editingRequestName}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            expandedFolderIds={expandedFolderIds}
            draggingNodeId={draggingNodeId}
            dragDropTarget={dragDropTarget}
            methodStyleMap={METHOD_STYLE_MAP}
            setEditingRequestName={setEditingRequestName}
            setEditingFolderName={setEditingFolderName}
            createFolder={createFolder}
            createRequest={createRequest}
            selectRequest={selectRequest}
            toggleFolderExpanded={toggleFolderExpanded}
            startEditingFolderName={startEditingFolderName}
            startEditingRequestName={startEditingRequestName}
            commitEditingFolderName={commitEditingFolderName}
            cancelEditingFolderName={cancelEditingFolderName}
            commitEditingRequestName={commitEditingRequestName}
            cancelEditingRequestName={cancelEditingRequestName}
            beginDragNode={beginDragNode}
            endDragNode={endDragNode}
            dragOverRoot={dragOverRoot}
            dropOnRoot={dropOnRoot}
            dragOverFolder={dragOverFolder}
            dropOnFolder={dropOnFolder}
            dragOverRequest={dragOverRequest}
            dropOnRequest={dropOnRequest}
            dragOverPosition={dragOverPosition}
            dropOnPosition={dropOnPosition}
            openRequestContextMenu={openRequestContextMenu}
          />

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
                          { value: "multipart", label: "Multipart Form" },
                        ]}
                        triggerClassName="h-10 rounded-lg px-3 text-sm"
                      />

                      {activeRequest.bodyMode === "multipart" ? (
                        <div className="min-h-0 flex-1 overflow-auto pr-1">
                          <MultipartFormEditor
                            rows={activeRequest.bodyForm}
                            onChange={updateMultipartRow}
                            onAdd={addMultipartRow}
                            onRemove={removeMultipartRow}
                            onFileSelect={selectMultipartFile}
                            onTextFieldChange={handleTemplateTextFieldChange}
                            onTextFieldKeyDown={handleTemplateTextFieldKeyDown}
                          />
                        </div>
                      ) : (
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
                              ? "Selecione JSON, Text ou Multipart para habilitar o body."
                              : activeRequest.bodyMode === "json"
                                ? '{\n  "name": "APInaut"\n}'
                                : "Digite o body da requisicao."
                          }
                        />
                      )}
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

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#121025] px-0">
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

              <div className="min-h-0 flex-1">
                {responseTab === "body" && responseBodyView === "web" ? (
                  <div className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-[#0f0d18]">
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
                    className="h-full min-h-0 overflow-auto rounded-none border-0"
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

      <EnvironmentModal
        {...{
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
        }}
      />
    </main>
  );
}



