"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowBigLeft,
  Search,
  X,
} from "lucide-react";
import { useAppSettings } from "@/components/app-settings-provider";
import { EnvironmentModal } from "@/components/environment-modal";
import { useI18n } from "@/components/language-provider";
import { RequestContextMenu } from "@/components/request-context-menu";
import { RequestEditorPanel } from "@/components/request-editor-panel";
import { ResponsePanel } from "@/components/response-panel";
import { RequestTreePanel } from "@/components/request-tree-panel";
import { StyledSelect } from "@/components/styled-select";
import { TemplateSuggestionMenu } from "@/components/template-suggestion-menu";
import { useResponseState } from "@/hooks/use-response-state";
import { useTemplateSuggestions } from "@/hooks/use-template-suggestions";
import {
  ApiRequest,
  Collection,
  Environment,
  EnvironmentVariable,
  GlobalEnvironmentsState,
  MultipartFormRow,
  RequestExecutionResult,
  RequestResponseState,
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
  COMPACT_LAYOUT_BREAKPOINT,
  createRow,
  createRequestNode,
  DEFAULT_LEFT_PANEL_WIDTH,
  DELETE_CONFIRM_TIMEOUT_MS,
  getInitialPaneWidths,
  METHOD_STYLE_MAP,
  MIN_CENTER_PANEL_WIDTH,
  MIN_LEFT_PANEL_WIDTH,
  MIN_RIGHT_PANEL_WIDTH,
  normalizeMultipartRowsForUi,
  normalizeRowsForUi,
  PANE_LAYOUT_STORAGE_KEY,
  readFileAsBase64,
  reorderItemsById,
  REQUEST_CONTEXT_MENU_HEIGHT_FOLDER,
  REQUEST_CONTEXT_MENU_HEIGHT_REQUEST,
  REQUEST_CONTEXT_MENU_WIDTH,
  REQUEST_CONTEXT_MENU_VIEWPORT_PADDING,
  RESIZER_WIDTH,
  resolveRequestWithEnvironment,
  runUserScript,
  TEMPLATE_VARIABLE_LOOKUP_REGEX,
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
type RequestSearchEntry = {
  id: string;
  name: string;
  method: ApiRequest["method"];
  pathLabel: string;
  searchLabel: string;
};

type RequestContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

const EMPTY_REQUEST_RESPONSE_STATE: RequestResponseState = {
  result: null,
  requestError: null,
  scriptError: null,
};
const EMPTY_RESPONSE_STATE_BY_REQUEST_ID: Record<string, RequestResponseState> = {};

const limitResponseStateEntries = (
  source: Record<string, RequestResponseState>,
  limit: number,
  keepRequestId?: string | null,
) => {
  const entries = Object.entries(source);
  if (entries.length <= limit) {
    return source;
  }

  const keepSet = new Set<string>();
  if (keepRequestId && source[keepRequestId]) {
    keepSet.add(keepRequestId);
  }

  const nextEntries: Array<[string, RequestResponseState]> = [];

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (!entry) {
      continue;
    }

    const [requestId, responseState] = entry;
    if (keepSet.has(requestId)) {
      continue;
    }

    nextEntries.unshift([requestId, responseState]);
    if (nextEntries.length >= limit - keepSet.size) {
      break;
    }
  }

  if (keepSet.size > 0 && keepRequestId) {
    nextEntries.push([keepRequestId, source[keepRequestId]]);
  }

  return Object.fromEntries(nextEntries);
};

export default function CollectionDetailsPage() {
  const { t, locale } = useI18n();
  const { settings } = useAppSettings();
  const params = useParams<{ id: string }>();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const requestContextMenuRef = useRef<HTMLDivElement | null>(null);
  const requestSearchRef = useRef<HTMLDivElement | null>(null);
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
  const [titlebarSearchHost, setTitlebarSearchHost] = useState<HTMLElement | null>(null);

  const collectionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const collection = useMemo(
    () => collections.find((item) => item.id === collectionId),
    [collections, collectionId],
  );

  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [openRequestTabIds, setOpenRequestTabIds] = useState<string[]>([]);
  const [centerTreeRequestId, setCenterTreeRequestId] = useState<string | null>(null);
  const [centerTreeRequestVersion, setCenterTreeRequestVersion] = useState(0);
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [isRequestSearchOpen, setIsRequestSearchOpen] = useState(false);
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [scriptTab, setScriptTab] = useState<ScriptTab>("pre-request");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [responseBodyView, setResponseBodyView] = useState<ResponseBodyView>("code");
  const [isSending, setIsSending] = useState(false);
  const [responseStateByRequestId, setResponseStateByRequestId] = useState<
    Record<string, RequestResponseState>
  >({});
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
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialPaneWidthsRef.current.left);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialPaneWidthsRef.current.right);
  const [resizingPane, setResizingPane] = useState<"left" | "right" | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
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
  const activeCollectionIdRef = useRef<string | null>(null);
  const hydratedResponseStateCollectionIdRef = useRef<string | null>(null);
  const skipPersistResponseStateRef = useRef(false);

  const activeResponseState = useMemo<RequestResponseState>(() => {
    if (!activeRequestId) {
      return EMPTY_REQUEST_RESPONSE_STATE;
    }

    return responseStateByRequestId[activeRequestId] ?? EMPTY_REQUEST_RESPONSE_STATE;
  }, [activeRequestId, responseStateByRequestId]);

  const updateResponseStateForRequest = (
    requestId: string | null,
    updater: (current: RequestResponseState) => RequestResponseState,
  ) => {
    if (!requestId) {
      return;
    }

    setResponseStateByRequestId((current) => {
      const currentState = current[requestId] ?? EMPTY_REQUEST_RESPONSE_STATE;
      const nextState = updater(currentState);

      if (
        currentState.result === nextState.result &&
        currentState.requestError === nextState.requestError &&
        currentState.scriptError === nextState.scriptError
      ) {
        return current;
      }

      return {
        ...current,
        [requestId]: nextState,
      };
    });
  };

  const clearResponseStateForRequest = (requestId: string | null) => {
    updateResponseStateForRequest(requestId, () => EMPTY_REQUEST_RESPONSE_STATE);
  };

  const setRequestErrorForRequest = (requestId: string | null, requestError: string | null) => {
    updateResponseStateForRequest(requestId, (current) => ({
      ...current,
      requestError,
    }));
  };

  const setScriptErrorForRequest = (requestId: string | null, scriptError: string | null) => {
    updateResponseStateForRequest(requestId, (current) => ({
      ...current,
      scriptError,
    }));
  };

  const setResultForRequest = (requestId: string | null, result: RequestExecutionResult | null) => {
    updateResponseStateForRequest(requestId, (current) => ({
      ...current,
      result,
    }));
  };

  useEffect(() => {
    setIsMounted(true);
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
    if (typeof window === "undefined") {
      return;
    }

    setTitlebarSearchHost(document.getElementById("apinaut-titlebar-center-slot"));
  }, []);

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
    const syncLayoutMode = () => {
      const layout = layoutRef.current;
      const width = layout?.getBoundingClientRect().width ?? window.innerWidth;
      setIsCompactLayout(width < COMPACT_LAYOUT_BREAKPOINT);
    };

    syncLayoutMode();
    window.addEventListener("resize", syncLayoutMode);

    return () => {
      window.removeEventListener("resize", syncLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (isCompactLayout && resizingPane === "right") {
      setResizingPane(null);
    }
  }, [isCompactLayout, resizingPane]);

  useEffect(() => {
    if (!resizingPane) {
      return;
    }

    if (isCompactLayout && resizingPane === "right") {
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
  }, [isCompactLayout, leftPanelWidth, resizingPane, rightPanelWidth]);

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
  const requestSearchEntries = useMemo<RequestSearchEntry[]>(() => {
    const entries: RequestSearchEntry[] = [];

    const walkTree = (nodes: RequestTreeNode[], trail: string[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          walkTree(node.children, [...trail, node.name]);
          continue;
        }

        const fallbackName = "Request";
        const requestName = node.request.name.trim() || fallbackName;
        const pathLabel = trail.join(" / ");

        entries.push({
          id: node.id,
          name: requestName,
          method: node.request.method,
          pathLabel,
          searchLabel: `${requestName} ${pathLabel}`.toLocaleLowerCase(locale),
        });
      }
    };

    walkTree(requestTree, []);
    return entries;
  }, [locale, requestTree]);
  const requestSearchResults = useMemo(() => {
    const normalizedQuery = requestSearchQuery.trim().toLocaleLowerCase(locale);

    if (!normalizedQuery) {
      return [];
    }

    return requestSearchEntries
      .filter((entry) => entry.searchLabel.includes(normalizedQuery))
      .slice(0, 16);
  }, [locale, requestSearchEntries, requestSearchQuery]);
  const environments = useMemo(() => collection?.environments ?? [], [collection]);
  const globalEnvironments = useMemo(
    () => globalEnvironmentState.environments ?? [],
    [globalEnvironmentState],
  );
  const collectionResponseStateByRequestId =
    collection?.requestResponsesByRequestId ?? EMPTY_RESPONSE_STATE_BY_REQUEST_ID;
  const collectionResponseStateSerialized = useMemo(
    () => JSON.stringify(collectionResponseStateByRequestId),
    [collectionResponseStateByRequestId],
  );
  const localResponseStateSerialized = useMemo(
    () => JSON.stringify(responseStateByRequestId),
    [responseStateByRequestId],
  );

  useEffect(() => {
    if (!collection) {
      hydratedResponseStateCollectionIdRef.current = null;
      skipPersistResponseStateRef.current = true;
      setResponseStateByRequestId(EMPTY_RESPONSE_STATE_BY_REQUEST_ID);
      return;
    }

    if (hydratedResponseStateCollectionIdRef.current === collection.id) {
      return;
    }

    hydratedResponseStateCollectionIdRef.current = collection.id;
    if (settings.clearResponsesOnLaunch) {
      skipPersistResponseStateRef.current = false;
      setResponseStateByRequestId(EMPTY_RESPONSE_STATE_BY_REQUEST_ID);
      return;
    }

    skipPersistResponseStateRef.current = true;
    setResponseStateByRequestId(collectionResponseStateByRequestId);
  }, [collection, collectionResponseStateByRequestId, settings.clearResponsesOnLaunch]);

  useEffect(() => {
    if (!collectionId || !collection) {
      return;
    }

    if (skipPersistResponseStateRef.current) {
      skipPersistResponseStateRef.current = false;
      return;
    }

    if (collectionResponseStateSerialized === localResponseStateSerialized) {
      return;
    }

    const limitedResponseStateByRequestId = limitResponseStateEntries(
      responseStateByRequestId,
      settings.responseHistoryLimit,
      activeRequestId,
    );

    updateCollections((current) =>
      current.map((item) =>
        item.id === collectionId
          ? {
              ...item,
              requestResponsesByRequestId: limitedResponseStateByRequestId,
            }
          : item,
      ),
    );
  }, [
    activeRequestId,
    collection,
    collectionId,
    collectionResponseStateSerialized,
    localResponseStateSerialized,
    responseStateByRequestId,
    settings.responseHistoryLimit,
  ]);

  useEffect(() => {
    const limited = limitResponseStateEntries(
      responseStateByRequestId,
      settings.responseHistoryLimit,
      activeRequestId,
    );

    if (limited === responseStateByRequestId) {
      return;
    }

    setResponseStateByRequestId(limited);
  }, [activeRequestId, responseStateByRequestId, settings.responseHistoryLimit]);

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
  const combinedEnvironmentSelectorValue = useMemo(
    () =>
      `summary:${collection?.activeEnvironmentId ?? "none"}|${
        globalEnvironmentState.activeEnvironmentId ?? "none"
      }`,
    [collection?.activeEnvironmentId, globalEnvironmentState.activeEnvironmentId],
  );
  const combinedEnvironmentSelectorOptions = useMemo(() => {
    const activeLocalLabel = activeEnvironment
      ? activeEnvironment.name
      : t("collection.noLocal");
    const activeGlobalLabel = activeGlobalEnvironment
      ? activeGlobalEnvironment.name
      : t("collection.noGlobal");

    return [
      {
        value: combinedEnvironmentSelectorValue,
        label: `${activeLocalLabel} | ${activeGlobalLabel}`,
      },
      {
        value: "local:none",
        label: t("collection.noLocal"),
      },
      ...environments.map((environment) => ({
        value: `local:${environment.id}`,
        label: environment.name,
      })),
      {
        value: "global:none",
        label: t("collection.noGlobal"),
      },
      ...globalEnvironments.map((environment) => ({
        value: `global:${environment.id}`,
        label: environment.name,
      })),
    ];
  }, [
    activeEnvironment,
    activeGlobalEnvironment,
    combinedEnvironmentSelectorValue,
    environments,
    globalEnvironments,
    t,
  ]);
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
  const {
    templateSuggestion,
    templateSuggestionRef,
    applyTemplateSuggestion,
    handleTemplateTextFieldChange,
    handleTemplateTextFieldKeyDown,
  } = useTemplateSuggestions({ templateVariableOptions });

  const activeTemplateVariables = useMemo(() => {
    return {
      ...activeGlobalTemplateVariables,
      ...activeLocalTemplateVariables,
    };
  }, [activeGlobalTemplateVariables, activeLocalTemplateVariables]);

  useEffect(() => {
    const nextCollectionId = collection?.id ?? null;

    if (activeCollectionIdRef.current === nextCollectionId) {
      return;
    }

    activeCollectionIdRef.current = nextCollectionId;
    setOpenRequestTabIds([]);
    setCenterTreeRequestId(null);
    setCenterTreeRequestVersion(0);
    setRequestSearchQuery("");
    setIsRequestSearchOpen(false);
  }, [collection?.id]);

  useEffect(() => {
    if (!isRequestSearchOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (requestSearchRef.current && event.target instanceof Node && requestSearchRef.current.contains(event.target)) {
        return;
      }

      setIsRequestSearchOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isRequestSearchOpen]);

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

    const shouldSyncActiveRequest = activeRequestId !== storedRequestId;

    if (shouldSyncActiveRequest) {
      setActiveRequestId(storedRequestId);
    }

    if (storedRequestId && shouldSyncActiveRequest) {
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
  const openRequestTabs = useMemo(
    () =>
      openRequestTabIds
        .map((requestId) => {
          const requestNode = findRequestById(requestTree, requestId);

          if (!requestNode) {
            return null;
          }

          return {
            id: requestId,
            name: requestNode.name?.trim() || "Request",
            method: requestNode.method,
          };
        })
        .filter(
          (entry): entry is { id: string; name: string; method: ApiRequest["method"] } => entry !== null,
        ),
    [openRequestTabIds, requestTree],
  );

  useEffect(() => {
    if (!activeRequestId) {
      return;
    }

    setOpenRequestTabIds((current) =>
      current.includes(activeRequestId) ? current : [...current, activeRequestId],
    );
  }, [activeRequestId]);

  useEffect(() => {
    setOpenRequestTabIds((current) => {
      const next = current.filter((requestId) => hasRequestInTree(requestTree, requestId));
      return next.length === current.length ? current : next;
    });
  }, [requestTree]);

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
        error: t("collection.urlPreviewMissing"),
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
        error: t("collection.urlPreviewInvalid"),
      };
    }
  }, [activeRequest, activeTemplateVariables, t]);

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
  const moveNodeIntoFolder = (sourceNodeId: string, targetFolderId: string) => {
    updateCollectionTree((tree) => moveNodeToTarget(tree, sourceNodeId, targetFolderId));
    setExpandedFolderIds((current) =>
      current.includes(targetFolderId) ? current : [...current, targetFolderId],
    );
  };
  const moveNodeAtPosition = (
    sourceNodeId: string,
    targetParentFolderId: string | null,
    targetIndex: number,
  ) => {
    updateCollectionTree((tree) =>
      moveNodeToPosition(tree, sourceNodeId, targetParentFolderId, targetIndex),
    );

    if (targetParentFolderId) {
      setExpandedFolderIds((current) =>
        current.includes(targetParentFolderId) ? current : [...current, targetParentFolderId],
      );
    }
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
      setRequestErrorForRequest(activeRequestId, t("collection.fileLoadError"));
      setResponseTab("body");
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
    clearResponseStateForRequest(newRequestNode.id);
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
    clearResponseStateForRequest(newRequestNode.id);
  };

  const duplicateRequest = (requestId: string) => {
    const sourceRequest = findRequestById(requestTree, requestId);

    if (!sourceRequest) {
      return;
    }

    const duplicatedRequestId = crypto.randomUUID();
    const duplicatedRequest: ApiRequest = {
      ...sourceRequest,
      id: duplicatedRequestId,
      params: sourceRequest.params.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      })),
      headers: sourceRequest.headers.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      })),
      bodyForm: sourceRequest.bodyForm.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      })),
    };
    const duplicatedNode: RequestTreeNode = {
      id: duplicatedRequestId,
      type: "request",
      request: duplicatedRequest,
    };

    const insertAfterRequest = (
      nodes: RequestTreeNode[],
    ): { tree: RequestTreeNode[]; inserted: boolean } => {
      let inserted = false;
      const nextNodes: RequestTreeNode[] = [];

      for (const node of nodes) {
        if (node.type === "request") {
          nextNodes.push(node);

          if (node.id === requestId) {
            nextNodes.push(duplicatedNode);
            inserted = true;
          }

          continue;
        }

        const nested = insertAfterRequest(node.children);

        if (nested.inserted) {
          inserted = true;
          nextNodes.push({
            ...node,
            children: nested.tree,
          });
          continue;
        }

        nextNodes.push(node);
      }

      return {
        tree: nextNodes,
        inserted,
      };
    };

    let inserted = false;

    updateCollectionTree((tree) => {
      const next = insertAfterRequest(tree);
      inserted = next.inserted;
      return next.inserted ? next.tree : tree;
    });

    if (!inserted) {
      return;
    }

    setActiveRequestAndPersist(duplicatedRequestId);
    setEditingRequestId(null);
    setEditingRequestName("");
    setEditingFolderId(null);
    setEditingFolderName("");
    setRequestContextMenu(null);
    clearResponseStateForRequest(duplicatedRequestId);
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

  const reorderEnvironment = (sourceEnvironmentId: string, targetEnvironmentId: string) => {
    updateCollectionEnvironments((current) =>
      reorderItemsById(current, sourceEnvironmentId, targetEnvironmentId),
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

  const reorderEnvironmentVariable = (
    environmentId: string,
    sourceVariableId: string,
    targetVariableId: string,
  ) => {
    updateEnvironmentVariables(environmentId, (variables) =>
      reorderItemsById(variables, sourceVariableId, targetVariableId),
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

  const reorderGlobalEnvironment = (sourceEnvironmentId: string, targetEnvironmentId: string) => {
    updateGlobalEnvironments((current) =>
      reorderItemsById(current, sourceEnvironmentId, targetEnvironmentId),
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

  const reorderGlobalEnvironmentVariable = (
    environmentId: string,
    sourceVariableId: string,
    targetVariableId: string,
  ) => {
    updateGlobalEnvironmentVariables(environmentId, (variables) =>
      reorderItemsById(variables, sourceVariableId, targetVariableId),
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
    const folderPath = findFolderPathForRequest(requestTree, requestId) ?? [];

    if (folderPath.length > 0) {
      setExpandedFolderIds((current) => {
        const merged = new Set(current);
        for (const folderId of folderPath) {
          merged.add(folderId);
        }
        return Array.from(merged);
      });
    }

    setActiveRequestAndPersist(requestId);
    setRequestContextMenu(null);
    setEditingFolderId(null);
    setEditingFolderName("");
    setUrlPreviewCopied(false);
  };

  const selectRequestFromTab = (requestId: string) => {
    selectRequest(requestId);
    setCenterTreeRequestId(requestId);
    setCenterTreeRequestVersion((current) => current + 1);
  };

  const closeRequestTab = (requestId: string) => {
    const currentTabs = openRequestTabIds;
    const index = currentTabs.indexOf(requestId);

    if (index < 0) {
      setRequestContextMenu(null);
      return;
    }

    const nextTabs = currentTabs.filter((entry) => entry !== requestId);
    setOpenRequestTabIds(nextTabs);

    if (activeRequestId === requestId) {
      const fallbackRequestId = nextTabs[index] ?? nextTabs[index - 1] ?? null;
      setActiveRequestAndPersist(fallbackRequestId);
    }

    setRequestContextMenu(null);
  };

  const selectRequestFromSearch = (requestId: string) => {
    const folderPath = findFolderPathForRequest(requestTree, requestId) ?? [];

    if (folderPath.length > 0) {
      setExpandedFolderIds((current) => {
        const merged = new Set(current);
        for (const folderId of folderPath) {
          merged.add(folderId);
        }
        return Array.from(merged);
      });
    }

    selectRequest(requestId);
    setRequestSearchQuery("");
    setIsRequestSearchOpen(false);
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
    }

    const collectRequestIds = (node: RequestTreeNode): string[] =>
      node.type === "request" ? [node.id] : node.children.flatMap(collectRequestIds);
    const removedRequestIds = collectRequestIds(removedNode);

    if (removedRequestIds.length > 0) {
      setResponseStateByRequestId((current) => {
        let changed = false;
        const next = { ...current };

        for (const requestId of removedRequestIds) {
          if (requestId in next) {
            delete next[requestId];
            changed = true;
          }
        }

        return changed ? next : current;
      });
      setOpenRequestTabIds((current) =>
        current.filter((requestId) => !removedRequestIds.includes(requestId)),
      );
    }

    const removed = removedNode;
    setExpandedFolderIds((current) => current.filter((folderId) => !nodeContainsNodeId(removed, folderId)));
    setRequestContextMenu(null);
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

  const {
    responsePaneContent,
    responseWebPreviewDocument,
    responseLanguage,
    hasResponseError,
    hasSuccessfulResponse,
    statusDisplay,
    secondsDisplay,
    transferDisplay,
  } = useResponseState({
    result: activeResponseState.result,
    requestError: activeResponseState.requestError,
    scriptError: activeResponseState.scriptError,
    responseTab,
  });

  const sendRequest = async () => {
    if (!activeRequest) {
      return;
    }

    const targetRequestId = activeRequest.id;
    setIsSending(true);
    setRequestErrorForRequest(targetRequestId, null);
    setScriptErrorForRequest(targetRequestId, null);
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
        options: {
          timeoutMs: number;
          followRedirects: boolean;
          verifySsl: boolean;
          proxyUrl?: string;
        };
      } = {
        method: resolvedRequest.method,
        url: finalUrl,
        headers: buildHeaders(resolvedRequest),
        bodyMode: resolvedRequest.bodyMode,
        options: {
          timeoutMs: settings.requestTimeoutMs,
          followRedirects: settings.followRedirects,
          verifySsl: settings.verifySsl,
          ...(settings.defaultProxyUrl.trim() ? { proxyUrl: settings.defaultProxyUrl.trim() } : {}),
        },
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
              t("collection.multipartMissingFile", { field: first.key }),
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
                  throw new Error(t("collection.scriptInvalidJson"));
                }
              },
              text: () => responsePayload.body ?? "",
              status: responsePayload.status,
              headers: responsePayload.headers,
              cookies: responsePayload.cookies,
            }
          : {
              json: () => {
                throw new Error(t("collection.scriptResponseUnavailable"));
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
        const message = error instanceof Error ? error.message : t("collection.preRequestScriptError");
        setScriptErrorForRequest(targetRequestId, message);
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
          "x-apinaut-locale": locale,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | { ok: true; response: RequestExecutionResult }
        | { ok: false; error: string };

      if (!data.ok) {
        setRequestErrorForRequest(targetRequestId, data.error);
        setResultForRequest(targetRequestId, null);
        setResponseTab("body");
        return;
      }

      const resultPayload = data.response;

      try {
        runUserScript(resolvedRequest.afterResponseScript, buildScriptBindings(resultPayload));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("collection.afterResponseScriptError");
        setScriptErrorForRequest(targetRequestId, message);
      }

      setResultForRequest(targetRequestId, resultPayload);
      setResponseTab("body");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("collection.sendUnexpectedError");
      setRequestErrorForRequest(targetRequestId, message);
      setResultForRequest(targetRequestId, null);
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
          <p className="text-sm text-zinc-300">{t("collection.loading")}</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="h-full overflow-auto bg-[#100e1a] px-6 py-8 text-white">
        <div className="mx-auto w-full max-w-4xl space-y-4 rounded-xl border border-white/10 bg-[#1a1728] p-6">
          <h1 className="text-xl font-semibold">{t("collection.notFound.title")}</h1>
          <p className="text-sm text-zinc-300">
            {t("collection.notFound.description")}
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
          >
            {t("collection.back")}
          </Link>
        </div>
      </main>
    );
  }

  const desktopGridStyle = {
    "--left-pane-width": `${leftPanelWidth}px`,
    "--right-pane-width": `${rightPanelWidth}px`,
  } as CSSProperties;

  return (
    <>
      {titlebarSearchHost &&
        createPortal(
          <div ref={requestSearchRef} className="apinaut-titlebar-no-drag relative w-[360px] max-w-[42vw]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={requestSearchQuery}
              onChange={(event) => {
                setRequestSearchQuery(event.target.value);
                setIsRequestSearchOpen(true);
              }}
              onFocus={() => {
                setIsRequestSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && requestSearchResults[0]) {
                  event.preventDefault();
                  selectRequestFromSearch(requestSearchResults[0].id);
                }

                if (event.key === "Escape") {
                  setIsRequestSearchOpen(false);
                }
              }}
              placeholder={t("collection.searchRequestsPlaceholder")}
              aria-label={t("collection.searchRequestsAria")}
              className="h-8 w-full rounded-md border border-white/20 bg-[#191628] pl-8 pr-2 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-400 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/35"
            />

            {isRequestSearchOpen && requestSearchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-md border border-white/15 bg-[#151223] p-1 shadow-2xl">
                {requestSearchResults.length > 0 ? (
                  requestSearchResults.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => selectRequestFromSearch(entry.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-100 transition hover:bg-violet-500/20"
                    >
                      <span
                        className={`inline-flex h-4 shrink-0 items-center rounded border px-1 text-[9px] font-semibold leading-none ${METHOD_STYLE_MAP[entry.method].badge}`}
                      >
                        {entry.method}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{entry.name}</span>
                        {entry.pathLabel && (
                          <span className="block truncate text-[10px] text-zinc-400">{entry.pathLabel}</span>
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-xs text-zinc-400">{t("collection.searchNoResults")}</p>
                )}
              </div>
            )}
          </div>,
          titlebarSearchHost,
        )}

      <main className="h-full min-h-full overflow-hidden bg-[#100e1a] text-white">
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-4 py-2">
          <Link
            href="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/55 bg-violet-500/30 text-violet-100 transition hover:bg-violet-500/45"
            aria-label={t("collection.back")}
            title={t("collection.back")}
          >
            <ArrowBigLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">{collection.name}</h1>

          <div className="ml-2 min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1 pr-2">
              {openRequestTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectRequestFromTab(tab.id)}
                  className={`group inline-flex h-8 max-w-[220px] items-center gap-1 rounded-md border px-2 text-xs transition ${
                    activeRequestId === tab.id
                      ? "border-violet-300/70 bg-violet-500/35 text-violet-50"
                      : "border-white/15 bg-[#1a1728] text-zinc-200 hover:border-violet-300/40 hover:bg-[#221f33]"
                  }`}
                  title={tab.name}
                >
                  <span
                    className={`inline-flex h-4 shrink-0 items-center rounded border px-1 text-[9px] font-semibold leading-none ${METHOD_STYLE_MAP[tab.method].badge}`}
                  >
                    {tab.method}
                  </span>
                  <span className="truncate">{tab.name}</span>
                  <span
                    role="button"
                    aria-label={t("common.close")}
                    title={t("common.close")}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeRequestTab(tab.id);
                    }}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-300 transition hover:bg-white/20 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <StyledSelect
              value={combinedEnvironmentSelectorValue}
              onChange={(nextValue) => {
                if (nextValue.startsWith("local:")) {
                  const nextLocalId = nextValue.slice("local:".length);
                  setActiveEnvironmentId(nextLocalId || null);
                  return;
                }

                if (nextValue.startsWith("global:")) {
                  const nextGlobalId = nextValue.slice("global:".length);
                  setActiveGlobalEnvironmentId(nextGlobalId || null);
                }
              }}
              options={combinedEnvironmentSelectorOptions}
              containerClassName="min-w-[200px] max-w-[240px]"
              triggerClassName="h-8"
              menuClassName="min-w-[220px]"
            />
            <button
              type="button"
              onClick={openEnvironmentModal}
              className="h-8 rounded-md border border-violet-300/45 bg-violet-500/15 px-3 text-xs font-medium text-violet-100 transition hover:border-violet-300/70 hover:bg-violet-500/30 hover:text-white"
            >
              {t("collection.environments")}
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 ${isCompactLayout ? "overflow-hidden" : "overflow-x-auto overflow-y-hidden"}`}>
          {isCompactLayout ? (
            <div
              ref={layoutRef}
              className="grid h-full min-h-0 gap-0 [grid-template-columns:var(--left-pane-width)_1px_minmax(0,1fr)]"
              style={
                {
                  "--left-pane-width": `${leftPanelWidth}px`,
                } as CSSProperties
              }
            >
              <RequestTreePanel
                requestTree={requestTree}
                activeRequestId={activeRequestId}
                centerOnRequestId={centerTreeRequestId}
                centerOnRequestVersion={centerTreeRequestVersion}
                editingRequestId={editingRequestId}
                editingRequestName={editingRequestName}
                editingFolderId={editingFolderId}
                editingFolderName={editingFolderName}
                expandedFolderIds={expandedFolderIds}
                methodStyleMap={METHOD_STYLE_MAP}
                setEditingRequestName={setEditingRequestName}
                setEditingFolderName={setEditingFolderName}
                createFolder={createFolder}
                createRequest={createRequest}
                moveNodeIntoFolder={moveNodeIntoFolder}
                moveNodeAtPosition={moveNodeAtPosition}
                selectRequest={selectRequest}
                toggleFolderExpanded={toggleFolderExpanded}
                startEditingFolderName={startEditingFolderName}
                startEditingRequestName={startEditingRequestName}
                commitEditingFolderName={commitEditingFolderName}
                cancelEditingFolderName={cancelEditingFolderName}
                commitEditingRequestName={commitEditingRequestName}
                cancelEditingRequestName={cancelEditingRequestName}
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
                  aria-label={t("collection.resizeRequests")}
                />
              </div>

              <div className="flex h-full min-h-0 flex-col overflow-y-auto">
                <div className="min-h-[360px] shrink-0">
                  <RequestEditorPanel
                    {...{
                      activeRequest,
                      updateActiveRequest,
                      templateVariableOptions,
                      sendRequest,
                      isSending,
                      requestTab,
                      setRequestTab,
                      copyUrlPreview,
                      urlPreview,
                      urlPreviewCopied,
                      updateRow,
                      addRow,
                      removeRow,
                      handleTemplateTextFieldChange,
                      handleTemplateTextFieldKeyDown,
                      updateMultipartRow,
                      addMultipartRow,
                      removeMultipartRow,
                      selectMultipartFile,
                      showBearerToken,
                      setShowBearerToken,
                      showBasicPassword,
                      setShowBasicPassword,
                      scriptTab,
                      setScriptTab,
                    }}
                  />
                </div>

                <div className="h-px shrink-0 bg-white/10" />

                <div className="min-h-[320px] shrink-0">
                  <ResponsePanel
                    {...{
                      requestError: activeResponseState.requestError,
                      result: activeResponseState.result,
                      hasSuccessfulResponse,
                      statusDisplay,
                      secondsDisplay,
                      transferDisplay,
                      responseTab,
                      setResponseTab,
                      responseBodyView,
                      setResponseBodyView,
                      responseWebPreviewDocument,
                      responsePaneContent,
                      responseLanguage,
                      hasResponseError,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={layoutRef}
              className="grid h-full min-h-0 gap-0 [grid-template-columns:var(--left-pane-width)_1px_minmax(0,1fr)_1px_var(--right-pane-width)]"
              style={desktopGridStyle}
            >
              <RequestTreePanel
                requestTree={requestTree}
                activeRequestId={activeRequestId}
                centerOnRequestId={centerTreeRequestId}
                centerOnRequestVersion={centerTreeRequestVersion}
                editingRequestId={editingRequestId}
                editingRequestName={editingRequestName}
                editingFolderId={editingFolderId}
                editingFolderName={editingFolderName}
                expandedFolderIds={expandedFolderIds}
                methodStyleMap={METHOD_STYLE_MAP}
                setEditingRequestName={setEditingRequestName}
                setEditingFolderName={setEditingFolderName}
                createFolder={createFolder}
                createRequest={createRequest}
                moveNodeIntoFolder={moveNodeIntoFolder}
                moveNodeAtPosition={moveNodeAtPosition}
                selectRequest={selectRequest}
                toggleFolderExpanded={toggleFolderExpanded}
                startEditingFolderName={startEditingFolderName}
                startEditingRequestName={startEditingRequestName}
                commitEditingFolderName={commitEditingFolderName}
                cancelEditingFolderName={cancelEditingFolderName}
                commitEditingRequestName={commitEditingRequestName}
                cancelEditingRequestName={cancelEditingRequestName}
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
                  aria-label={t("collection.resizeRequests")}
                />
              </div>

              <RequestEditorPanel
                {...{
                  activeRequest,
                  updateActiveRequest,
                  templateVariableOptions,
                  sendRequest,
                  isSending,
                  requestTab,
                  setRequestTab,
                  copyUrlPreview,
                  urlPreview,
                  urlPreviewCopied,
                  updateRow,
                  addRow,
                  removeRow,
                  handleTemplateTextFieldChange,
                  handleTemplateTextFieldKeyDown,
                  updateMultipartRow,
                  addMultipartRow,
                  removeMultipartRow,
                  selectMultipartFile,
                  showBearerToken,
                  setShowBearerToken,
                  showBasicPassword,
                  setShowBasicPassword,
                  scriptTab,
                  setScriptTab,
                }}
              />

              <div className="relative bg-white/10">
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setResizingPane("right");
                  }}
                  className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 cursor-col-resize"
                  aria-label={t("collection.resizeResponse")}
                />
              </div>

              <ResponsePanel
                {...{
                  requestError: activeResponseState.requestError,
                  result: activeResponseState.result,
                  hasSuccessfulResponse,
                  statusDisplay,
                  secondsDisplay,
                  transferDisplay,
                  responseTab,
                  setResponseTab,
                  responseBodyView,
                  setResponseBodyView,
                  responseWebPreviewDocument,
                  responsePaneContent,
                  responseLanguage,
                  hasResponseError,
                }}
              />
            </div>
          )}
        </div>
      </div>

            <RequestContextMenu
        {...{
          requestContextMenu,
          requestContextMenuTargetNode,
          requestContextMenuRef,
          createRequestInFolder,
          createFolderInFolder,
          duplicateRequest,
          startEditingRequestName,
          startEditingFolderName,
          deleteNode,
        }}
      />
            <TemplateSuggestionMenu
        templateSuggestion={templateSuggestion}
        templateSuggestionRef={templateSuggestionRef}
        applyTemplateSuggestion={applyTemplateSuggestion}
      />
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
          reorderEnvironment,
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
          reorderGlobalEnvironment,
          editingEnvironment,
          setActiveEnvironmentId,
          pendingDeleteEnvironmentVariableKey,
          updateEnvironmentVariable,
          handleRemoveEnvironmentVariableClick,
          addEnvironmentVariable,
          reorderEnvironmentVariable,
          editingGlobalEnvironment,
          setActiveGlobalEnvironmentId,
          pendingDeleteGlobalEnvironmentVariableKey,
          updateGlobalEnvironmentVariable,
          handleRemoveGlobalEnvironmentVariableClick,
          addGlobalEnvironmentVariable,
          reorderGlobalEnvironmentVariable,
        }}
      />
      </main>
    </>
  );
}

