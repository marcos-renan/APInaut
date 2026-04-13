"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  APP_LOCALE_STORAGE_KEY,
  DEFAULT_APP_LOCALE,
  formatDateByLocale,
  isAppLocale,
  translate,
  type AppLocale,
  type TranslationKey,
} from "@/lib/i18n";

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatDate: (value: string | number | Date) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

type LanguageProviderProps = {
  children: ReactNode;
};

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_APP_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
    if (stored && isAppLocale(stored)) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
      return;
    }

    const navigatorLocale = window.navigator.language?.toLowerCase() ?? "";
    const initialLocale: AppLocale = navigatorLocale.startsWith("es")
      ? "es-ES"
      : navigatorLocale.startsWith("en")
        ? "en-US"
        : DEFAULT_APP_LOCALE;

    setLocaleState(initialLocale);
    document.documentElement.lang = initialLocale;
  }, []);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextLocale);
      document.documentElement.lang = nextLocale;
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const formatDate = useCallback((value: string | number | Date) => formatDateByLocale(value, locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      formatDate,
    }),
    [formatDate, locale, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider.");
  }

  return context;
};
