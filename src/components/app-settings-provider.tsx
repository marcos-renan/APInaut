"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  APP_AUTOSAVE_DRAFTS_STORAGE_KEY,
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
  type ThemeMode,
} from "@/lib/app-settings";

type AppSettingsContextValue = {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

type AppSettingsProviderProps = {
  children: ReactNode;
};

const getResolvedTheme = (themeMode: ThemeMode) => {
  if (themeMode !== "auto") {
    return themeMode;
  }

  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const AppSettingsProvider = ({ children }: AppSettingsProviderProps) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setSettings(normalizeAppSettings(parsed));
    } catch {
      setSettings(DEFAULT_APP_SETTINGS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.setItem(APP_AUTOSAVE_DRAFTS_STORAGE_KEY, settings.autoSaveDrafts ? "1" : "0");

    const root = document.documentElement;
    const resolvedTheme = getResolvedTheme(settings.themeMode);
    root.dataset.apinautTheme = resolvedTheme;
    root.dataset.apinautDensity = settings.uiDensity;
    root.style.setProperty("--apinaut-ui-scale", String(settings.uiScalePercent / 100));
  }, [settings]);

  useEffect(() => {
    if (typeof window === "undefined" || settings.themeMode !== "auto") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.dataset.apinautTheme = media.matches ? "dark" : "light";
    };

    media.addEventListener("change", applyTheme);
    return () => {
      media.removeEventListener("change", applyTheme);
    };
  }, [settings.themeMode]);

  const setSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => normalizeAppSettings({ ...current, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_APP_SETTINGS);
  };

  const value = useMemo(
    () => ({
      settings,
      setSetting,
      resetSettings,
    }),
    [settings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider.");
  }

  return context;
};

