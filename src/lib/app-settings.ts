export type ThemeMode = "auto" | "dark" | "light";
export type UiDensity = "comfortable" | "compact";

export type AppSettings = {
  themeMode: ThemeMode;
  uiScalePercent: number;
  uiDensity: UiDensity;
  requestFontSize: number;
  responseFontSize: number;
  showLineNumbers: boolean;
  responseWordWrap: boolean;
  copyResponsePretty: boolean;
  requestTimeoutMs: number;
  followRedirects: boolean;
  verifySsl: boolean;
  defaultProxyUrl: string;
  autoSaveDrafts: boolean;
  clearResponsesOnLaunch: boolean;
  responseHistoryLimit: number;
};

export const APP_SETTINGS_STORAGE_KEY = "apinaut:settings:v1";
export const APP_AUTOSAVE_DRAFTS_STORAGE_KEY = "apinaut:autosave-drafts:v1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: "auto",
  uiScalePercent: 100,
  uiDensity: "comfortable",
  requestFontSize: 12,
  responseFontSize: 12,
  showLineNumbers: true,
  responseWordWrap: true,
  copyResponsePretty: true,
  requestTimeoutMs: 15000,
  followRedirects: true,
  verifySsl: true,
  defaultProxyUrl: "",
  autoSaveDrafts: true,
  clearResponsesOnLaunch: false,
  responseHistoryLimit: 200,
};

export const clampUiScalePercent = (value: number) => Math.min(Math.max(Math.round(value), 85), 130);
export const clampEditorFontSize = (value: number) => Math.min(Math.max(Math.round(value), 10), 24);
export const clampRequestTimeout = (value: number) => Math.min(Math.max(Math.round(value), 1000), 120000);
export const clampResponseHistoryLimit = (value: number) => Math.min(Math.max(Math.round(value), 20), 1000);

export const normalizeAppSettings = (value: unknown): AppSettings => {
  const candidate = value && typeof value === "object" ? (value as Partial<AppSettings>) : {};

  return {
    themeMode:
      candidate.themeMode === "auto" || candidate.themeMode === "dark" || candidate.themeMode === "light"
        ? candidate.themeMode
        : DEFAULT_APP_SETTINGS.themeMode,
    uiScalePercent: clampUiScalePercent(
      typeof candidate.uiScalePercent === "number"
        ? candidate.uiScalePercent
        : DEFAULT_APP_SETTINGS.uiScalePercent,
    ),
    uiDensity: candidate.uiDensity === "compact" ? "compact" : "comfortable",
    requestFontSize: clampEditorFontSize(
      typeof candidate.requestFontSize === "number"
        ? candidate.requestFontSize
        : DEFAULT_APP_SETTINGS.requestFontSize,
    ),
    responseFontSize: clampEditorFontSize(
      typeof candidate.responseFontSize === "number"
        ? candidate.responseFontSize
        : DEFAULT_APP_SETTINGS.responseFontSize,
    ),
    showLineNumbers:
      typeof candidate.showLineNumbers === "boolean"
        ? candidate.showLineNumbers
        : DEFAULT_APP_SETTINGS.showLineNumbers,
    responseWordWrap:
      typeof candidate.responseWordWrap === "boolean"
        ? candidate.responseWordWrap
        : DEFAULT_APP_SETTINGS.responseWordWrap,
    copyResponsePretty:
      typeof candidate.copyResponsePretty === "boolean"
        ? candidate.copyResponsePretty
        : DEFAULT_APP_SETTINGS.copyResponsePretty,
    requestTimeoutMs: clampRequestTimeout(
      typeof candidate.requestTimeoutMs === "number"
        ? candidate.requestTimeoutMs
        : DEFAULT_APP_SETTINGS.requestTimeoutMs,
    ),
    followRedirects:
      typeof candidate.followRedirects === "boolean"
        ? candidate.followRedirects
        : DEFAULT_APP_SETTINGS.followRedirects,
    verifySsl: typeof candidate.verifySsl === "boolean" ? candidate.verifySsl : DEFAULT_APP_SETTINGS.verifySsl,
    defaultProxyUrl:
      typeof candidate.defaultProxyUrl === "string" ? candidate.defaultProxyUrl : DEFAULT_APP_SETTINGS.defaultProxyUrl,
    autoSaveDrafts:
      typeof candidate.autoSaveDrafts === "boolean"
        ? candidate.autoSaveDrafts
        : DEFAULT_APP_SETTINGS.autoSaveDrafts,
    clearResponsesOnLaunch:
      typeof candidate.clearResponsesOnLaunch === "boolean"
        ? candidate.clearResponsesOnLaunch
        : DEFAULT_APP_SETTINGS.clearResponsesOnLaunch,
    responseHistoryLimit: clampResponseHistoryLimit(
      typeof candidate.responseHistoryLimit === "number"
        ? candidate.responseHistoryLimit
        : DEFAULT_APP_SETTINGS.responseHistoryLimit,
    ),
  };
};

