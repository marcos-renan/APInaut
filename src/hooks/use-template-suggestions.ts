"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  TEMPLATE_SUGGESTION_MENU_HEIGHT,
  TEMPLATE_SUGGESTION_MENU_WIDTH,
  TEMPLATE_VARIABLE_TRIGGER_REGEX,
} from "@/lib/request-page-helpers";

type TemplateSuggestionState = {
  x: number;
  y: number;
  options: string[];
  query: string;
  selectedIndex: number;
  fieldValue: string;
  replaceFrom: number;
  replaceTo: number;
  apply: (nextValue: string, nextCaret: number) => void;
  fieldElement: HTMLInputElement | HTMLTextAreaElement;
} | null;

type UseTemplateSuggestionsParams = {
  templateVariableOptions: string[];
};

export const useTemplateSuggestions = ({ templateVariableOptions }: UseTemplateSuggestionsParams) => {
  const templateSuggestionRef = useRef<HTMLDivElement | null>(null);
  const [templateSuggestion, setTemplateSuggestion] = useState<TemplateSuggestionState>(null);

  const sortedOptions = useMemo(
    () => [...templateVariableOptions].sort((left, right) => left.localeCompare(right)),
    [templateVariableOptions],
  );

  useEffect(() => {
    if (!templateSuggestion) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        templateSuggestionRef.current &&
        event.target instanceof Node &&
        templateSuggestionRef.current.contains(event.target)
      ) {
        return;
      }

      if (
        templateSuggestion.fieldElement &&
        event.target instanceof Node &&
        templateSuggestion.fieldElement.contains(event.target)
      ) {
        return;
      }

      setTemplateSuggestion(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTemplateSuggestion(null);
      }
    };

    const handleScroll = () => {
      setTemplateSuggestion(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [templateSuggestion]);

  const getTemplateSuggestionOptions = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedOptions;
    }

    return sortedOptions.filter((option) => option.toLowerCase().includes(normalizedQuery));
  };

  const openTemplateSuggestionForField = (
    fieldElement: HTMLInputElement | HTMLTextAreaElement,
    nextValue: string,
    applyValue: (value: string) => void,
    forceOpen: boolean,
  ) => {
    const caretPosition = fieldElement.selectionStart ?? nextValue.length;
    const beforeCaret = nextValue.slice(0, caretPosition);
    const triggerMatch = beforeCaret.match(TEMPLATE_VARIABLE_TRIGGER_REGEX);

    if (!triggerMatch && !forceOpen) {
      setTemplateSuggestion((current) =>
        current?.fieldElement === fieldElement ? null : current,
      );
      return;
    }

    const query = triggerMatch ? triggerMatch[1] : "";
    const options = getTemplateSuggestionOptions(query);

    if (options.length === 0) {
      setTemplateSuggestion((current) =>
        current?.fieldElement === fieldElement ? null : current,
      );
      return;
    }

    const fieldRect = fieldElement.getBoundingClientRect();
    const viewportPadding = 8;
    const y = Math.min(
      fieldRect.bottom + 6,
      window.innerHeight - TEMPLATE_SUGGESTION_MENU_HEIGHT - viewportPadding,
    );
    const x = Math.max(
      viewportPadding,
      Math.min(fieldRect.left, window.innerWidth - TEMPLATE_SUGGESTION_MENU_WIDTH - viewportPadding),
    );

    const replaceFrom = triggerMatch ? caretPosition - triggerMatch[0].length : caretPosition;

    setTemplateSuggestion({
      x,
      y,
      options,
      query,
      selectedIndex: 0,
      fieldValue: nextValue,
      replaceFrom,
      replaceTo: caretPosition,
      apply: (value: string, nextCaret: number) => {
        applyValue(value);
        window.requestAnimationFrame(() => {
          fieldElement.focus();
          fieldElement.setSelectionRange(nextCaret, nextCaret);
        });
      },
      fieldElement,
    });
  };

  const applyTemplateSuggestion = (option: string) => {
    if (!templateSuggestion) {
      return;
    }

    const current = templateSuggestion;
    const insertion = `{{${option}}}`;
    const nextValue =
      current.fieldValue.slice(0, current.replaceFrom) +
      insertion +
      current.fieldValue.slice(current.replaceTo);
    const nextCaret = current.replaceFrom + insertion.length;
    current.apply(nextValue, nextCaret);
    setTemplateSuggestion(null);
  };

  const handleTemplateTextFieldChange = (
    event: ReactChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    applyValue: (nextValue: string) => void,
  ) => {
    const nextValue = event.target.value;
    applyValue(nextValue);
    openTemplateSuggestionForField(event.target, nextValue, applyValue, false);
  };

  const handleTemplateTextFieldKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    currentValue: string,
    applyValue: (nextValue: string) => void,
  ) => {
    const fieldElement = event.currentTarget;

    if (templateSuggestion && templateSuggestion.fieldElement === fieldElement) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setTemplateSuggestion((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            selectedIndex: (current.selectedIndex + 1) % current.options.length,
          };
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setTemplateSuggestion((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            selectedIndex: (current.selectedIndex - 1 + current.options.length) % current.options.length,
          };
        });
        return;
      }

      if ((event.key === "Enter" || event.key === "Tab") && templateSuggestion.options.length > 0) {
        event.preventDefault();
        applyTemplateSuggestion(templateSuggestion.options[templateSuggestion.selectedIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setTemplateSuggestion(null);
        return;
      }
    }

    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      openTemplateSuggestionForField(fieldElement, currentValue, applyValue, true);
    }
  };

  return {
    templateSuggestion,
    templateSuggestionRef,
    applyTemplateSuggestion,
    handleTemplateTextFieldChange,
    handleTemplateTextFieldKeyDown,
  };
};
