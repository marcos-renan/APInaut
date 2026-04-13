"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/language-provider";
import type { AppLocale } from "@/lib/i18n";

type LanguageOption = {
  locale: AppLocale;
  label: string;
  flagPath: string;
};

type LanguageSelectorProps = {
  className?: string;
  compact?: boolean;
};

export const LanguageSelector = ({ className = "", compact = false }: LanguageSelectorProps) => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo<LanguageOption[]>(
    () => [
      {
        locale: "pt-BR",
        label: t("language.portuguese"),
        flagPath: "/flags/br.svg",
      },
      {
        locale: "en-US",
        label: t("language.english"),
        flagPath: "/flags/us.svg",
      },
      {
        locale: "es-ES",
        label: t("language.spanish"),
        flagPath: "/flags/es.svg",
      },
    ],
    [t],
  );

  const selected = options.find((option) => option.locale === locale) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && rootRef.current.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex items-center rounded-md border border-violet-300/45 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-400/70 ${
          compact ? "h-8 gap-1.5 px-2" : "h-9 gap-2 px-3"
        }`}
        aria-label={t("language.select")}
        title={t("language.select")}
      >
        <img
          src={selected.flagPath}
          alt={selected.label}
          width={compact ? 16 : 18}
          height={compact ? 16 : 18}
          className="rounded-full"
        />
        {!compact && <span className="text-xs font-medium">{selected.locale}</span>}
        <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_10px_26px_rgba(0,0,0,0.45)]">
          {options.map((option) => {
            const isSelected = option.locale === locale;

            return (
              <button
                key={option.locale}
                type="button"
                onClick={() => {
                  setLocale(option.locale);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  isSelected ? "bg-violet-500/35 text-violet-50" : "text-zinc-100 hover:bg-white/10"
                }`}
              >
                <img src={option.flagPath} alt={option.label} width={16} height={16} className="rounded-full" />
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
