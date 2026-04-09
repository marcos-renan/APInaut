"use client";

import { useMemo } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { autocompletion, completeFromList, snippetCompletion } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
import { cn } from "@/lib/utils";

type EditorLanguage = "json" | "text";

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language?: EditorLanguage;
  readOnly?: boolean;
  placeholder?: string;
  height?: number;
  className?: string;
  errorTone?: boolean;
  enableJsonAutocomplete?: boolean;
};

const jsonCompletions = completeFromList([
  snippetCompletion('{\n  "$1": $2\n}', {
    label: "{}",
    detail: "Objeto JSON",
    type: "keyword",
  }),
  snippetCompletion("[\n  $1\n]", {
    label: "[]",
    detail: "Array JSON",
    type: "keyword",
  }),
  snippetCompletion('"$1"', {
    label: "string",
    detail: "Texto",
    type: "keyword",
  }),
  snippetCompletion("$1", {
    label: "number",
    detail: "Numero",
    type: "keyword",
  }),
  snippetCompletion("true", {
    label: "true",
    detail: "Booleano",
    type: "constant",
  }),
  snippetCompletion("false", {
    label: "false",
    detail: "Booleano",
    type: "constant",
  }),
  snippetCompletion("null", {
    label: "null",
    detail: "Nulo",
    type: "constant",
  }),
]);

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#121025",
      height: "100%",
      fontSize: "12px",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.55",
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
}: CodeEditorProps) => {
  const extensions = useMemo(() => {
    const nextExtensions: Extension[] = [EditorView.lineWrapping, editorTheme];

    if (language === "json") {
      nextExtensions.push(json());

      if (enableJsonAutocomplete && !readOnly) {
        nextExtensions.push(
          autocompletion({
            activateOnTyping: true,
            override: [jsonCompletions],
          }),
        );
      }
    }

    if (placeholder) {
      nextExtensions.push(placeholderExtension(placeholder));
    }

    if (errorTone) {
      nextExtensions.push(errorTheme);
    }

    return nextExtensions;
  }, [enableJsonAutocomplete, errorTone, language, placeholder, readOnly]);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/15 bg-[#121025]", className)}>
      <CodeMirror
        value={value}
        onChange={(nextValue) => onChange?.(nextValue)}
        editable={!readOnly}
        readOnly={readOnly}
        height={`${height}px`}
        theme={oneDark}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          autocompletion: enableJsonAutocomplete && !readOnly,
          closeBrackets: !readOnly,
        }}
      />
    </div>
  );
};
