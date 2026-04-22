import { createEnvironmentVariable, normalizeEnvironments } from "./helpers";
import { APP_AUTOSAVE_DRAFTS_STORAGE_KEY } from "@/lib/app-settings";
import { parseCollectionsData } from "./parser";
import type {
  Collection,
  EnvironmentVariable,
  GlobalEnvironmentsState,
  GlobalVariable,
} from "./types";

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

    const normalized = parseCollectionsData(parsed);

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
  const autoSaveDrafts = window.localStorage.getItem(APP_AUTOSAVE_DRAFTS_STORAGE_KEY) !== "0";

  if (autoSaveDrafts) {
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
  } else {
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
  }

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
