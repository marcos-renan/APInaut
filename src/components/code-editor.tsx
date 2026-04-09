"use client";

import { useMemo } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import {
  autocompletion,
  closeBrackets,
  completionKeymap,
  startCompletion,
  type Completion,
} from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { EditorState, Prec } from "@codemirror/state";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { cn } from "@/lib/utils";

type EditorLanguage = "json" | "text";

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language?: EditorLanguage;
  readOnly?: boolean;
  placeholder?: string;
  height?: number | string;
  className?: string;
  errorTone?: boolean;
  enableJsonAutocomplete?: boolean;
  enableTemplateAutocomplete?: boolean;
  templateVariables?: string[];
  jsonColorPreset?: "default" | "response";
};

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#121025",
      height: "100%",
      fontSize: "12px",
      color: "#e5e7eb",
    },
    ".cm-scroller": {
      backgroundColor: "#121025",
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-gutters": {
      backgroundColor: "#121025",
      color: "#7f8394",
      borderRight: "1px solid rgba(255,255,255,0.08)",
    },
    ".cm-content": {
      padding: "12px 0",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255,255,255,0.03)",
    },
    ".cm-cursor": {
      borderLeftColor: "#c4b5fd",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(139,92,246,0.25) !important",
    },
    "&.cm-focused": {
      outline: "none",
    },
  },
  { dark: true },
);

const errorTheme = EditorView.theme(
  {
    "&": {
      color: "#fda4af",
    },
    ".cm-content": {
      color: "#fda4af",
    },
  },
  { dark: true },
);

const responseJsonHighlight = HighlightStyle.define([
  { tag: tags.string, color: "#4ade80" },
  {
    tag: [tags.null, tags.number, tags.bool, tags.atom, tags.keyword],
    color: "#c4b5fd",
  },
  { tag: [tags.propertyName, tags.attributeName, tags.labelName], color: "#facc15" },
]);

const TEMPLATE_MATCH_REGEX = /\{\{([A-Za-z0-9_.-]*)$/;
const TEMPLATE_VALID_FOR_REGEX = /^[A-Za-z0-9_.-]*$/;

export const CodeEditor = ({
  value,
  onChange,
  language = "text",
  readOnly = false,
  placeholder,
  height = 280,
  className,
  errorTone = false,
  enableJsonAutocomplete = false,
  enableTemplateAutocomplete = false,
  templateVariables = [],
  jsonColorPreset = "default",
}: CodeEditorProps) => {
  const extensions = useMemo(() => {
    const nextExtensions: Extension[] = [EditorView.lineWrapping, editorTheme];
    const templateCompletions = Array.from(new Set(templateVariables.map((item) => item.trim()).filter(Boolean))).map(
      (variable) =>
        ({
          label: variable,
          type: "variable",
          apply: `{{${variable}}}`,
        }) satisfies Completion,
    );

    if (enableTemplateAutocomplete && !readOnly && templateCompletions.length > 0) {
      nextExtensions.push(
        autocompletion({
          activateOnTyping: true,
          defaultKeymap: false,
          override: [
            (context) => {
              const tokenMatch = context.matchBefore(TEMPLATE_MATCH_REGEX);

              if (tokenMatch) {
                const query = tokenMatch.text.slice(2).toLowerCase();
                const filtered = query
                  ? templateCompletions.filter((option) => option.label.toLowerCase().includes(query))
                  : templateCompletions;

                if (filtered.length === 0 && !context.explicit) {
                  return null;
                }

                return {
                  from: tokenMatch.from,
                  to: context.pos,
                  options: filtered.length ? filtered : templateCompletions,
                  validFor: TEMPLATE_VALID_FOR_REGEX,
                };
              }

              if (!context.explicit) {
                return null;
              }

              return {
                from: context.pos,
                options: templateCompletions,
              };
            },
          ],
        }),
        Prec.highest(keymap.of([{ key: "Ctrl-Space", run: startCompletion }, ...completionKeymap])),
      );
    }

    if (language === "json") {
      nextExtensions.push(json());

      if (enableJsonAutocomplete && !readOnly) {
        nextExtensions.push(
          EditorState.languageData.of(() => [
            {
              closeBrackets: {
                brackets: ["{", '"'],
              },
            },
          ]),
          closeBrackets(),
        );
      }

      if (jsonColorPreset === "response") {
        nextExtensions.push(Prec.highest(syntaxHighlighting(responseJsonHighlight)));
      }
    }

    if (placeholder) {
      nextExtensions.push(placeholderExtension(placeholder));
    }

    if (errorTone) {
      nextExtensions.push(errorTheme);
    }

    return nextExtensions;
  }, [
    enableJsonAutocomplete,
    enableTemplateAutocomplete,
    errorTone,
    jsonColorPreset,
    language,
    placeholder,
    readOnly,
    templateVariables,
  ]);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/15 bg-[#121025]", className)}>
      <CodeMirror
        value={value}
        onChange={(nextValue) => onChange?.(nextValue)}
        editable={!readOnly}
        readOnly={readOnly}
        height={typeof height === "number" ? `${height}px` : height}
        theme={oneDark}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          autocompletion: false,
          closeBrackets: false,
        }}
      />
    </div>
  );
};
