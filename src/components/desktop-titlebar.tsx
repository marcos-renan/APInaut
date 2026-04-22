"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Minus, Settings, X } from "lucide-react";
import { useAppSettings } from "@/components/app-settings-provider";
import { useI18n } from "@/components/language-provider";
import { LanguageSelector } from "@/components/language-selector";

const TITLEBAR_HEIGHT_PX = 44;

export const DesktopTitleBar = () => {
  const { t } = useI18n();
  const { settings, setSetting, resetSettings } = useAppSettings();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsModalRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (settingsModalRef.current && event.target instanceof Node && settingsModalRef.current.contains(event.target)) {
        return;
      }

      setIsSettingsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSettingsOpen]);

  if (!isDesktop) {
    return null;
  }

  return (
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

      {isSettingsOpen && (
        <div className="apinaut-titlebar-no-drag fixed inset-0 z-[130] bg-black/45 backdrop-blur-[1px]">
          <div
            ref={settingsModalRef}
            className="absolute right-[190px] top-12 max-h-[84vh] w-[460px] overflow-y-auto rounded-xl border border-white/15 bg-[#191628] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">{t("settings.title")}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetSettings}
                  className="h-7 rounded-md border border-violet-300/45 bg-violet-500/15 px-2 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/25"
                >
                  {t("settings.reset")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-white/10 bg-[#121025] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  {t("settings.sectionAppearance")}
                </h3>
                <div className="space-y-3">
                  <label className="block text-xs text-zinc-200">
                    <span className="mb-1 block">{t("settings.themeMode")}</span>
                    <select
                      value={settings.themeMode}
                      onChange={(event) => setSetting("themeMode", event.target.value as typeof settings.themeMode)}
                      className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2 text-sm text-zinc-100 outline-none"
                    >
                      <option value="auto">{t("settings.themeAuto")}</option>
                      <option value="dark">{t("settings.themeDark")}</option>
                      <option value="light">{t("settings.themeLight")}</option>
                    </select>
                  </label>

                  <label className="block text-xs text-zinc-200">
                    <div className="mb-1 flex items-center justify-between">
                      <span>{t("settings.uiScale")}</span>
                      <span className="text-zinc-300">{settings.uiScalePercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={85}
                      max={130}
                      step={1}
                      value={settings.uiScalePercent}
                      onChange={(event) => setSetting("uiScalePercent", Number(event.target.value))}
                      className="w-full accent-violet-400"
                    />
                  </label>

                  <label className="block text-xs text-zinc-200">
                    <span className="mb-1 block">{t("settings.uiDensity")}</span>
                    <select
                      value={settings.uiDensity}
                      onChange={(event) => setSetting("uiDensity", event.target.value as typeof settings.uiDensity)}
                      className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2 text-sm text-zinc-100 outline-none"
                    >
                      <option value="comfortable">{t("settings.densityComfortable")}</option>
                      <option value="compact">{t("settings.densityCompact")}</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-[#121025] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  {t("settings.sectionEditor")}
                </h3>
                <div className="space-y-3">
                  <label className="block text-xs text-zinc-200">
                    <div className="mb-1 flex items-center justify-between">
                      <span>{t("settings.requestFontSize")}</span>
                      <span className="text-zinc-300">{settings.requestFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={settings.requestFontSize}
                      onChange={(event) => setSetting("requestFontSize", Number(event.target.value))}
                      className="w-full accent-violet-400"
                    />
                  </label>

                  <label className="block text-xs text-zinc-200">
                    <div className="mb-1 flex items-center justify-between">
                      <span>{t("settings.responseFontSize")}</span>
                      <span className="text-zinc-300">{settings.responseFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={settings.responseFontSize}
                      onChange={(event) => setSetting("responseFontSize", Number(event.target.value))}
                      className="w-full accent-violet-400"
                    />
                    <p className="mt-1 text-[11px] text-zinc-400">{t("settings.responseFontSizeHint")}</p>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.showLineNumbers}
                      onChange={(event) => setSetting("showLineNumbers", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.showLineNumbers")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.responseWordWrap}
                      onChange={(event) => setSetting("responseWordWrap", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.responseWordWrap")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.copyResponsePretty}
                      onChange={(event) => setSetting("copyResponsePretty", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.copyResponsePretty")}</span>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-[#121025] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  {t("settings.sectionRequests")}
                </h3>
                <div className="space-y-3">
                  <label className="block text-xs text-zinc-200">
                    <span className="mb-1 block">{t("settings.requestTimeout")}</span>
                    <input
                      type="number"
                      min={1000}
                      max={120000}
                      step={500}
                      value={settings.requestTimeoutMs}
                      onChange={(event) => setSetting("requestTimeoutMs", Number(event.target.value))}
                      className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.followRedirects}
                      onChange={(event) => setSetting("followRedirects", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.followRedirects")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.verifySsl}
                      onChange={(event) => setSetting("verifySsl", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.verifySsl")}</span>
                  </label>

                  <label className="block text-xs text-zinc-200">
                    <span className="mb-1 block">{t("settings.defaultProxy")}</span>
                    <input
                      type="text"
                      value={settings.defaultProxyUrl}
                      onChange={(event) => setSetting("defaultProxyUrl", event.target.value)}
                      className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2 text-sm text-zinc-100 outline-none"
                      placeholder="http://127.0.0.1:8080"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-[#121025] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  {t("settings.sectionPersistence")}
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.autoSaveDrafts}
                      onChange={(event) => setSetting("autoSaveDrafts", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.autoSaveDrafts")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={settings.clearResponsesOnLaunch}
                      onChange={(event) => setSetting("clearResponsesOnLaunch", event.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                    <span>{t("settings.clearResponsesOnLaunch")}</span>
                  </label>
                  <label className="block text-xs text-zinc-200">
                    <span className="mb-1 block">{t("settings.responseHistoryLimit")}</span>
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      step={10}
                      value={settings.responseHistoryLimit}
                      onChange={(event) => setSetting("responseHistoryLimit", Number(event.target.value))}
                      className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

