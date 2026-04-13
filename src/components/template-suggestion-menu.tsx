"use client";

import type { RefObject } from "react";
import { useI18n } from "@/components/language-provider";

type TemplateSuggestion = {
  x: number;
  y: number;
  options: string[];
  selectedIndex: number;
};

type TemplateSuggestionMenuProps = {
  templateSuggestion: TemplateSuggestion | null;
  templateSuggestionRef: RefObject<HTMLDivElement | null>;
  applyTemplateSuggestion: (option: string) => void;
};

export const TemplateSuggestionMenu = ({
  templateSuggestion,
  templateSuggestionRef,
  applyTemplateSuggestion,
}: TemplateSuggestionMenuProps) => {
  const { t } = useI18n();

  if (!templateSuggestion) {
    return null;
  }

  return (
    <div
      ref={templateSuggestionRef}
      className="fixed z-50 w-80 overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{
        left: templateSuggestion.x,
        top: templateSuggestion.y,
      }}
    >
      <p className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-zinc-400">
        {t("templateSuggestion.environmentVariables")}
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
  );
};
