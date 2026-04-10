"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
};

export const StyledSelect = ({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  containerClassName = "",
  triggerClassName = "",
  menuClassName = "",
  optionClassName = "",
}: StyledSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
      setIsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-md border border-violet-300/45 bg-violet-500/15 px-2 text-xs font-medium text-violet-100 outline-none ring-violet-400 transition hover:bg-violet-500/25 focus:ring-2 ${triggerClassName}`}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-40 w-full overflow-hidden rounded-lg border border-white/15 bg-[#1a1728] p-1 shadow-[0_10px_26px_rgba(0,0,0,0.45)] ${menuClassName}`}
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