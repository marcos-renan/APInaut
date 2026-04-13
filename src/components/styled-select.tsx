"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/language-provider";

export type StyledSelectOption = {
  value: string;
  label: string;
};

type StyledSelectProps = {
  value: string;
  onChange: (nextValue: string) => void;
  options: StyledSelectOption[];
  placeholder?: string;
  containerClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  menuPlacement?: "auto" | "bottom" | "top";
};

export const StyledSelect = ({
  value,
  onChange,
  options,
  placeholder,
  containerClassName = "",
  triggerClassName = "",
  menuClassName = "",
  optionClassName = "",
  menuPlacement = "auto",
}: StyledSelectProps) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  const resolvePlacement = () => {
    if (menuPlacement === "top" || menuPlacement === "bottom") {
      setResolvedPlacement(menuPlacement);
      return;
    }

    if (!containerRef.current) {
      setResolvedPlacement("bottom");
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(options.length * 40 + 12, 240);
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow >= estimatedMenuHeight + gap) {
      setResolvedPlacement("bottom");
      return;
    }

    if (spaceAbove > spaceBelow) {
      setResolvedPlacement("top");
      return;
    }

    setResolvedPlacement("bottom");
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resolvePlacement();

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        containerRef.current.contains(event.target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      resolvePlacement();
    };

    const handleResize = () => {
      setIsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, menuPlacement, options.length]);

  const resolvedPlaceholder = placeholder ?? t("common.select");

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-md border border-violet-300/45 bg-violet-500/15 px-2 text-xs font-medium text-violet-100 outline-none ring-violet-400 transition hover:bg-violet-500/25 focus:ring-2 ${triggerClassName}`}
      >
        <span className="truncate">{selectedOption?.label ?? resolvedPlaceholder}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-40 w-full max-h-60 overflow-auto rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_10px_26px_rgba(0,0,0,0.45)] ${
            resolvedPlacement === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          } ${menuClassName}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                option.value === value
                  ? "bg-violet-500/35 text-violet-50"
                  : "text-zinc-100 hover:bg-white/10"
              } ${optionClassName}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
