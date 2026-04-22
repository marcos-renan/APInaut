"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAppSettings } from "@/components/app-settings-provider";
import { useI18n } from "@/components/language-provider";

type SettingsTab = "appearance" | "editor" | "requests" | "persistence";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

const MODAL_MARGIN = 12;

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { t } = useI18n();
  const { settings, setSetting, resetSettings } = useAppSettings();
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("appearance");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const centerModal = () => {
      const modalElement = modalRef.current;
      const modalWidth = modalElement?.offsetWidth ?? 560;
      const modalHeight = modalElement?.offsetHeight ?? 500;
      const centeredX = Math.max(MODAL_MARGIN, Math.round((window.innerWidth - modalWidth) / 2));
      const centeredY = Math.max(MODAL_MARGIN, Math.round((window.innerHeight - modalHeight) / 2));
      setPosition({ x: centeredX, y: centeredY });
    };

    const frameId = window.requestAnimationFrame(centerModal);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button,input,select,textarea,a")) {
      return;
    }

    const modalElement = modalRef.current;
    if (!modalElement) {
      return;
    }

    event.preventDefault();
    const rect = modalElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const width = modalElement.offsetWidth;
      const height = modalElement.offsetHeight;
      const maxX = Math.max(MODAL_MARGIN, window.innerWidth - width - MODAL_MARGIN);
      const maxY = Math.max(MODAL_MARGIN, window.innerHeight - height - MODAL_MARGIN);
      const nextX = Math.min(Math.max(MODAL_MARGIN, moveEvent.clientX - offsetX), maxX);
      const nextY = Math.min(Math.max(MODAL_MARGIN, moveEvent.clientY - offsetY), maxY);
      setPosition({ x: Math.round(nextX), y: Math.round(nextY) });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "appearance", label: t("settings.sectionAppearance") },
    { id: "editor", label: t("settings.sectionEditor") },
    { id: "requests", label: t("settings.sectionRequests") },
    { id: "persistence", label: t("settings.sectionPersistence") },
  ];

  return (
    <div className="apinaut-titlebar-no-drag fixed inset-0 z-[130] bg-transparent" onPointerDown={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        className="absolute flex h-[min(54vh,360px)] w-[min(92vw,560px)] flex-col rounded-xl border border-white/15 bg-[#191628] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        style={{
          left: position ? `${position.x}px` : "50%",
          top: position ? `${position.y}px` : "50%",
          transform: position ? "none" : "translate(-50%, -50%)",
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex cursor-move select-none touch-none items-center justify-between border-b border-white/10 px-4 py-3"
          onPointerDown={startDrag}
        >
          <h2 className="text-sm font-semibold text-zinc-100">{t("settings.title")}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={resetSettings}
              className="h-7 rounded-md border border-violet-300/45 bg-violet-500/15 px-2.5 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/25"
            >
              {t("settings.reset")}
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            {settingsTabs.map((tab) => {
              const isActive = activeSettingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={`h-8 rounded-t-md border px-2.5 text-[11px] font-medium transition ${
                    isActive
                      ? "border-violet-300/55 bg-violet-500/20 text-violet-100"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <section className="rounded-lg border border-white/10 bg-[#121025] p-3">
            {activeSettingsTab === "appearance" && (
              <div className="space-y-3">
                <label className="block text-xs text-zinc-200">
                  <span className="mb-1 block">{t("settings.themeMode")}</span>
                  <select
                    value={settings.themeMode}
                    onChange={(event) => setSetting("themeMode", event.target.value as typeof settings.themeMode)}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2.5 text-sm text-zinc-100 outline-none"
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
                    className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2.5 text-sm text-zinc-100 outline-none"
                  >
                    <option value="comfortable">{t("settings.densityComfortable")}</option>
                    <option value="compact">{t("settings.densityCompact")}</option>
                  </select>
                </label>
              </div>
            )}

            {activeSettingsTab === "editor" && (
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
            )}

            {activeSettingsTab === "requests" && (
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
                    className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2.5 text-sm text-zinc-100 outline-none"
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
                    className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2.5 text-sm text-zinc-100 outline-none"
                    placeholder="http://127.0.0.1:8080"
                  />
                </label>
              </div>
            )}

            {activeSettingsTab === "persistence" && (
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
                    className="h-9 w-full rounded-md border border-white/20 bg-[#1a1728] px-2.5 text-sm text-zinc-100 outline-none"
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
