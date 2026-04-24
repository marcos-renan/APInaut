"use client";

import { useMemo, type CSSProperties } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import {
  autocompletion,
  closeBrackets,
  completionKeymap,
  startCompletion,
  type CompletionContext,
  type Completion,
} from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorState, Prec } from "@codemirror/state";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  type ViewUpdate,
  ViewPlugin,
  WidgetType,
  keymap,
  placeholder as placeholderExtension,
} from "@codemirror/view";
import { cn } from "@/lib/utils";

type EditorLanguage = "json" | "javascript" | "text";

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
  lineNumbers?: boolean;
  compact?: boolean;
  singleLine?: boolean;
  allowOverflowVisible?: boolean;
  concealText?: boolean;
  fontSizePx?: number;
  wordWrap?: boolean;
};

const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#121025",
      height: "100%",
      minHeight: "0",
      fontSize: "var(--apinaut-editor-font-size, 12px)",
      color: "#e5e7eb",
    },
    ".cm-scroller": {
      backgroundColor: "#121025",
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.55",
      height: "100%",
      minHeight: "0",
      overflowX: "auto",
      overflowY: "auto",
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

const TEMPLATE_VALID_FOR_REGEX = /^[A-Za-z0-9_.-]*$/;
const TEMPLATE_TOKEN_REGEX = /\{\{\s*[A-Za-z0-9_.-]+\s*\}\}/g;

const getTemplateTrigger = (context: CompletionContext) => {
  const maxScan = 200;
  const start = Math.max(0, context.pos - maxScan);
  const beforeCaret = context.state.sliceDoc(start, context.pos);
  const markerIndex = beforeCaret.lastIndexOf("{{");

  if (markerIndex < 0) {
    return null;
  }

  const query = beforeCaret.slice(markerIndex + 2);

  if (!TEMPLATE_VALID_FOR_REGEX.test(query)) {
    return null;
  }

  return {
    from: start + markerIndex,
    query,
  };
};

class TemplateTokenWidget extends WidgetType {
  constructor(private readonly tokenLabel: string) {
    super();
  }

  eq(other: TemplateTokenWidget) {
    return this.tokenLabel === other.tokenLabel;
  }

  toDOM() {
    const element = document.createElement("span");
    element.className = "cm-template-token-chip";
    element.textContent = this.tokenLabel;
    return element;
  }
}

const extractTemplateTokenLabel = (rawToken: string) => rawToken.replace(/^\{\{\s*|\s*\}\}$/g, "");

const templateTokenDecorator = new MatchDecorator({
  regexp: TEMPLATE_TOKEN_REGEX,
  decoration: (match) =>
    Decoration.replace({
      widget: new TemplateTokenWidget(extractTemplateTokenLabel(match[0])),
      inclusive: false,
    }),
});

const templateTokenPlugin = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof templateTokenDecorator.createDeco>;

    constructor(view: EditorView) {
      this.decorations = templateTokenDecorator.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = templateTokenDecorator.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (instance) => instance.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);

const templateTokenTheme = EditorView.baseTheme({
  ".cm-template-token-chip": {
    borderRadius: "8px",
    border: "1px solid rgba(167,139,250,0.7)",
    backgroundColor: "rgba(139,92,246,0.35)",
    color: "#f5f3ff",
    padding: "0 4px",
    marginInline: "1px",
    boxShadow: "inset 0 0 0 1px rgba(99,65,194,0.2)",
  },
});

const compactEditorTheme = EditorView.theme(
  {
    ".cm-gutters": {
      display: "none",
      borderRight: "0",
    },
    ".cm-content": {
      padding: "8px 10px",
      minWidth: "100%",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-scroller": {
      lineHeight: "1.35",
      overflowX: "hidden",
      overflowY: "hidden",
      scrollbarWidth: "none",
    },
    ".cm-scroller::-webkit-scrollbar": {
      display: "none",
    },
  },
  { dark: true },
);

const overflowVisibleEditorTheme = EditorView.theme(
  {
    "&": {
      overflow: "visible",
    },
    ".cm-tooltip": {
      zIndex: "60",
    },
  },
  { dark: true },
);

const concealedTextTheme = EditorView.theme(
  {
    ".cm-content, .cm-line": {
      WebkitTextSecurity: "disc",
      textSecurity: "disc",
    },
  },
  { dark: true },
);

const autocompleteMenuTheme = EditorView.theme(
  {
    ".cm-tooltip.cm-tooltip-autocomplete": {
      minWidth: "320px",
      maxWidth: "420px",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "10px",
      backgroundColor: "#1a1728",
      boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
      fontSize: "13px",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul": {
      maxHeight: "320px",
      overflowY: "auto",
      padding: "4px",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      borderRadius: "8px",
      padding: "8px 10px",
      color: "#e4e4e7",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(139,92,246,0.35)",
      color: "#f5f3ff",
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
  enableTemplateAutocomplete = false,
  templateVariables = [],
  jsonColorPreset = "default",
  lineNumbers = true,
  compact = false,
  singleLine = false,
  allowOverflowVisible = false,
  concealText = false,
  fontSizePx,
  wordWrap = true,
}: CodeEditorProps) => {
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;
  const resolvedMinHeight = typeof height === "number" ? `${height}px` : undefined;
  const resolvedMaxHeight = typeof height === "number" ? `${height}px` : undefined;

  const extensions = useMemo(() => {
    const nextExtensions: Extension[] = [editorTheme];

    if (!singleLine && wordWrap) {
      nextExtensions.push(EditorView.lineWrapping);
    }
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
              const trigger = getTemplateTrigger(context);

              if (trigger) {
                const query = trigger.query.toLowerCase();
                const filtered = query
                  ? templateCompletions.filter((option) => option.label.toLowerCase().includes(query))
                  : templateCompletions;

                if (filtered.length === 0 && !context.explicit) {
                  return null;
                }

                return {
                  from: trigger.from,
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
        autocompleteMenuTheme,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }

          const cursor = update.state.selection.main.head;
          const before = update.state.sliceDoc(Math.max(0, cursor - 2), cursor);

          if (before === "{{") {
            startCompletion(update.view);
          }
        }),
      );
    }

    if (enableTemplateAutocomplete) {
      nextExtensions.push(templateTokenPlugin, templateTokenTheme);
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

    if (language === "javascript") {
      nextExtensions.push(javascript());
    }

    if (compact) {
      nextExtensions.push(compactEditorTheme);
    }

    if (allowOverflowVisible) {
      nextExtensions.push(overflowVisibleEditorTheme);
    }

    if (concealText) {
      nextExtensions.push(concealedTextTheme);
    }

    if (singleLine) {
      nextExtensions.push(
        keymap.of([
          {
            key: "Enter",
            run: () => true,
          },
          {
            key: "Mod-Enter",
            run: () => true,
          },
        ]),
      );
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
    allowOverflowVisible,
    concealText,
    compact,
    singleLine,
    wordWrap,
    templateVariables,
  ]);

  const wrapperStyle =
    typeof fontSizePx === "number"
      ? ({
          "--apinaut-editor-font-size": `${fontSizePx}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        "h-full min-h-0",
        allowOverflowVisible ? "overflow-visible" : singleLine ? "overflow-hidden" : "overflow-auto",
        "rounded-lg border border-white/15 bg-[#121025]",
        className,
      )}
      style={wrapperStyle}
    >
      <CodeMirror
        value={value}
        onChange={(nextValue) => onChange?.(nextValue)}
        editable={!readOnly}
        readOnly={readOnly}
        height={resolvedHeight}
        minHeight={resolvedMinHeight}
        maxHeight={resolvedMaxHeight}
        theme={oneDark}
        extensions={extensions}
        basicSetup={{
          lineNumbers,
          foldGutter: false,
          highlightActiveLine: !compact,
          highlightActiveLineGutter: lineNumbers && !compact,
          bracketMatching: true,
          autocompletion: false,
          closeBrackets: false,
        }}
      />
    </div>
  );
};
