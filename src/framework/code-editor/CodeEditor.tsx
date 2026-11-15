/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Monaco, OnMount } from "@monaco-editor/react";
import { useEffect, useId, useRef, useState } from "react";

import { MonacoEditor } from "@/framework/monaco/MonacoEditor";

import { registerJsonSchema } from "./json-schema-registry";
import styles from "./CodeEditor.module.css";

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

// Python indentation is part of its syntax; two spaces produces code that does not follow community convention.
const TAB_SIZE_BY_LANGUAGE: Partial<Record<CodeEditorLanguage, number>> = {
  python: 4,
};

const DEFAULT_TAB_SIZE = 2;

export type CodeEditorProps = {
  ariaLabel?: string;
  editableWhileLoading?: boolean;
  id?: string;
  placeholder?: string;
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
  ariaLabel,
  editableWhileLoading = false,
  id,
  placeholder,
  followTail = false,
  height = 260,
  jsonSchema,
  language,
  onChange,
  readOnly = false,
  value = "",
}: CodeEditorProps) {
  const [monaco, setMonaco] = useState<Monaco | null>(null);
  const instanceId = useId();
  const modelPath = `inmemory://bkn-code/${encodeURIComponent(instanceId)}.json`;
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    if (monaco && language === "json" && jsonSchema)
      return registerJsonSchema(monaco, modelPath, jsonSchema);
  }, [monaco, modelPath, language, jsonSchema]);

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
        beforeMount={setMonaco}
        fallback={
          editableWhileLoading ? (
            <textarea
              id={id}
              aria-label={ariaLabel}
              className={styles.fallback}
              style={{ height: height === "fill" ? "100%" : height }}
              placeholder={placeholder}
              readOnly={readOnly}
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
            />
          ) : (
            <div style={{ height: height === "fill" ? "100%" : height }} />
          )
        }
        height={height === "fill" ? "100%" : height}
        language={language}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          ...EDITOR_OPTIONS,
          ariaLabel,
          // In read-only mode, the cursor and active-line highlight are noise: users cannot edit,
          // and a blinking caret suggests otherwise.
          domReadOnly: readOnly,
          renderLineHighlight: readOnly ? "none" : EDITOR_OPTIONS.renderLineHighlight,
          readOnly,
          tabSize: TAB_SIZE_BY_LANGUAGE[language] ?? DEFAULT_TAB_SIZE,
        }}
        path={modelPath}
        value={value}
      />
    </div>
  );
}
