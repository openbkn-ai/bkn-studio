/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Monaco, OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";

import { MonacoEditor } from "@/framework/monaco/MonacoEditor";

import styles from "./JsonEditor.module.css";

const MONO_STACK =
  'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace';

const EDITOR_OPTIONS = {
  folding: true,
  wordWrap: "on" as const,
  // Use a slightly looser line height than default: function code is meant to be read, not packed densely.
  lineHeight: 24,
  fontSize: 13,
  fontFamily: MONO_STACK,
  lineNumbersMinChars: 3,
  lineDecorationsWidth: 12,
  padding: { top: 12, bottom: 12 },
  automaticLayout: true,
  renderLineHighlight: "line" as const,
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  minimap: { enabled: false },
  scrollbar: {
    vertical: "auto" as const,
    horizontal: "auto" as const,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
    alwaysConsumeMouseWheel: false,
  },
};

const THEME_NAME = "bkn-code-light";

/** The default VS theme uses pure white with dark line numbers and looks too harsh beside the site's light-gray panels. */
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme(THEME_NAME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#fbfcfe",
      "editorGutter.background": "#fbfcfe",
      "editorLineNumber.foreground": "#c3ccdb",
      "editorLineNumber.activeForeground": "#64748b",
      "editor.lineHighlightBackground": "#f2f6fd",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#eaeef6",
      "editorIndentGuide.activeBackground1": "#cfd8e8",
    },
  });
}

/**
 * Editable views use only JSON and Python. The remaining languages are recognized for read-only
 * previews of skill-package files, all from the locally bundled monaco-editor with no extra packages.
 */
export type CodeEditorLanguage =
  | "css"
  | "html"
  | "ini"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext"
  | "python"
  | "shell"
  | "sql"
  | "typescript"
  | "xml"
  | "yaml";

/** JSON documents at this URI use the schema registered below for completion and validation. */
const EVENT_MODEL_PATH = "bkn-function-event.json";

// Python indentation is part of its syntax; two spaces produces code that does not follow community convention.
const TAB_SIZE_BY_LANGUAGE: Partial<Record<CodeEditorLanguage, number>> = {
  python: 4,
};

const DEFAULT_TAB_SIZE = 2;

type CodeEditorProps = {
  /** Follow the last line while streaming content is appended; otherwise each setValue jumps back to the top. */
  followTail?: boolean;
  /** "fill" uses the parent container's full height, as determined by the outer flex layout. */
  height?: number | "fill";
  /** When provided, the JSON editor uses it for property completion, type validation, and hover documentation. */
  jsonSchema?: unknown;
  language: CodeEditorLanguage;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  value?: string;
};

export function CodeEditor({
  followTail = false,
  height = 260,
  jsonSchema,
  language,
  onChange,
  readOnly = false,
  value = "",
}: CodeEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const applyJsonSchema = useCallback(
    (monaco: Monaco | null) => {
      // setDiagnosticsOptions configures JSON globally. An editor without a schema, such as a
      // parameter preview, AI result, or JsonEditor, would clear schemas registered by the contract
      // editor and not restore them on unmount. Update global configuration only with a schema;
      // fileMatch limits it by path, so a retained schema is harmless elsewhere.
      if (!monaco || language !== "json" || !jsonSchema) {
        return;
      }

      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
          {
            uri: `inmemory://schema/${EVENT_MODEL_PATH}`,
            fileMatch: [`*${EVENT_MODEL_PATH}`],
            schema: jsonSchema,
          },
        ],
      });
    },
    [jsonSchema, language],
  );

  // Reattach the schema when parameters change, or completion remains on the old contract.
  useEffect(() => {
    applyJsonSchema(monacoRef.current);
  }, [applyJsonSchema]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!followTail || !editor) {
      return;
    }

    editor.revealLine(editor.getModel()?.getLineCount() ?? 1);
  }, [followTail, value]);

  return (
    <div className={`${styles.editorBorder} ${height === "fill" ? styles.editorFill : ""}`}>
      <MonacoEditor
        beforeMount={(monaco) => {
          monacoRef.current = monaco;
          defineTheme(monaco);
          applyJsonSchema(monaco);
        }}
        fallback={<div style={{ height: height === "fill" ? "100%" : height }} />}
        height={height === "fill" ? "100%" : height}
        language={language}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          ...EDITOR_OPTIONS,
          // In read-only mode, the cursor and active-line highlight are noise: users cannot edit,
          // and a blinking caret suggests otherwise.
          domReadOnly: readOnly,
          renderLineHighlight: readOnly ? "none" : EDITOR_OPTIONS.renderLineHighlight,
          readOnly,
          tabSize: TAB_SIZE_BY_LANGUAGE[language] ?? DEFAULT_TAB_SIZE,
        }}
        path={language === "json" && jsonSchema ? EVENT_MODEL_PATH : undefined}
        theme={THEME_NAME}
        value={value}
      />
    </div>
  );
}
