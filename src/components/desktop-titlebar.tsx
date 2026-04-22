"use client";

import { useEffect, useState } from "react";
import { Copy, Minus, Settings, X } from "lucide-react";
import { useI18n } from "@/components/language-provider";
import { LanguageSelector } from "@/components/language-selector";
import { SettingsModal } from "@/components/settings-modal";

const TITLEBAR_HEIGHT_PX = 44;

export const DesktopTitleBar = () => {
  const { t } = useI18n();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isElectronUserAgent = navigator.userAgent.toLowerCase().includes("electron");
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let bootstrapDesktopTimeout: ReturnType<typeof setTimeout> | null = null;

    if (isElectronUserAgent) {
      bootstrapDesktopTimeout = setTimeout(() => {
        setIsDesktop(true);
      }, 0);
    }

    const detectDesktop = () => {
      if (window.apinautDesktop?.isDesktop) {
        setIsDesktop(true);
        return;
      }

      if (attempts >= 20) {
        setIsDesktop(isElectronUserAgent);
        return;
      }

      attempts += 1;
      timeoutId = setTimeout(detectDesktop, 50);
    };

    detectDesktop();

    return () => {
      if (bootstrapDesktopTimeout) {
        clearTimeout(bootstrapDesktopTimeout);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const desktopApi = window.apinautDesktop;
    document.body.classList.add("apinaut-desktop");

    if (!desktopApi) {
      return () => {
        document.body.classList.remove("apinaut-desktop");
      };
    }

    desktopApi
      .isMaximized()
      .then((value) => setIsMaximized(Boolean(value)))
      .catch(() => setIsMaximized(false));

    const unsubscribe = desktopApi.onMaximizeChange((value) => {
      setIsMaximized(value);
    });

    return () => {
      unsubscribe();
      document.body.classList.remove("apinaut-desktop");
    };
  }, [isDesktop]);

  if (!isDesktop) {
    return null;
  }

  return (
    <>
      <header
        className="apinaut-titlebar fixed inset-x-0 top-0 z-[90] flex items-center border-b border-white/10 bg-[#151225]/95 backdrop-blur"
        style={{
          height: `${TITLEBAR_HEIGHT_PX}px`,
        }}
      >
        <div className="flex items-center gap-2 pl-3">
          <img
            src="/apinaut.ico"
            alt="APInaut"
            width={24}
            height={24}
            className="h-6 w-6 rounded-sm object-contain"
          />
          <span className="text-sm font-semibold text-zinc-100">APInaut</span>
        </div>

        <div
          id="apinaut-titlebar-center-slot"
          className="apinaut-titlebar-no-drag flex flex-1 items-center justify-center px-4"
        />

        <div className="apinaut-titlebar-no-drag flex items-center gap-2 pr-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-400/70"
            aria-label={t("settings.open")}
            title={t("settings.open")}
          >
            <Settings className="h-4 w-4" />
          </button>
          <LanguageSelector compact />
        </div>

        <div className="apinaut-titlebar-no-drag flex items-stretch">
          <button
            type="button"
            onClick={() => window.apinautDesktop?.minimize()}
            className="inline-flex h-11 w-14 items-center justify-center text-zinc-200 transition hover:bg-white/10"
            aria-label={t("titlebar.minimize")}
            title={t("titlebar.minimize")}
          >
            <Minus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => window.apinautDesktop?.toggleMaximize()}
            className="inline-flex h-11 w-14 items-center justify-center text-zinc-200 transition hover:bg-white/10"
            aria-label={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
            title={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => window.apinautDesktop?.close()}
            className="inline-flex h-11 w-14 items-center justify-center text-rose-100 transition hover:bg-rose-500/85"
            aria-label={t("titlebar.close")}
            title={t("titlebar.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
