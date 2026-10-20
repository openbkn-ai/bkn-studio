/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OnMount } from "@monaco-editor/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { MonacoEditor } from "@/framework/monaco/MonacoEditor";
import {
  cypherSuggestions,
  type CypherCompletionSchema,
} from "@/modules/knowledge-network/cypher/cypher-completion";
import type { CypherErrorMark } from "@/modules/knowledge-network/cypher/error-mark";

type MonacoApi = Parameters<OnMount>[1];
type EditorInstance = Parameters<OnMount>[0];

export type CypherEditorHandle = {
  /** Inserts text at the cursor and focuses the editor. */
  insert: (text: string) => void;
  focus: () => void;
};

const MARKER_OWNER = "cypher-run";
/** Two lines: a short query needs no more room than that. */
const MIN_HEIGHT = 48;

/**
 * Cypher editor on Monaco: highlighting, completion of the network's labels, relationship types
 * and properties, Ctrl/⌘ + Enter to run, Ctrl/⌘ + ↑ / ↓ through history, and a squiggle where
 * the last run failed.
 */
export const CypherEditor = forwardRef<
  CypherEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onRun: () => void;
    onHistory: (older: boolean) => void;
    schema: CypherCompletionSchema;
    errorMark?: CypherErrorMark | null;
    /** The editor grows with its text up to this height, then scrolls. */
    maxHeight: number;
    /** The least height it takes, however short the text; enlarged editors start taller. */
    minHeight?: number;
    ariaLabel: string;
  }
>(function CypherEditor(
  {
    value,
    onChange,
    onRun,
    onHistory,
    schema,
    errorMark,
    maxHeight,
    minHeight = MIN_HEIGHT,
    ariaLabel,
  },
  ref,
) {
  const [contentHeight, setContentHeight] = useState(MIN_HEIGHT);
  const height = Math.min(Math.max(contentHeight, minHeight), maxHeight);
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const schemaRef = useRef(schema);
  const onRunRef = useRef(onRun);
  const onHistoryRef = useRef(onHistory);
  const disposables = useRef<{ dispose: () => void }[]>([]);
  schemaRef.current = schema;
  onRunRef.current = onRun;
  onHistoryRef.current = onHistory;

  useImperativeHandle(ref, () => ({
    insert: (text) => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      if (selection) editor.executeEdits("schema", [{ range: selection, text }]);
      editor.focus();
    },
    focus: () => editorRef.current?.focus(),
  }));

  useEffect(() => () => disposables.current.forEach((item) => item.dispose()), []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      errorMark
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: errorMark.message,
              startLineNumber: errorMark.line,
              startColumn: errorMark.column,
              endLineNumber: errorMark.line,
              endColumn: model.getLineMaxColumn(Math.min(errorMark.line, model.getLineCount())),
            },
          ]
        : [],
    );
  }, [errorMark]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setContentHeight(editor.getContentHeight());
    disposables.current.push(
      editor.onDidContentSizeChange((event) => {
        if (event.contentHeightChanged) setContentHeight(event.contentHeight);
      }),
    );
    const { KeyCode, KeyMod } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => onRunRef.current());
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.UpArrow, () => onHistoryRef.current(true));
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.DownArrow, () => onHistoryRef.current(false));
    const kinds = {
      label: monaco.languages.CompletionItemKind.Class,
      relation: monaco.languages.CompletionItemKind.Interface,
      property: monaco.languages.CompletionItemKind.Field,
      keyword: monaco.languages.CompletionItemKind.Keyword,
      function: monaco.languages.CompletionItemKind.Function,
    };
    // Completion providers are global per language; answer only for this editor's model.
    disposables.current.push(
      monaco.languages.registerCompletionItemProvider("cypher", {
        triggerCharacters: [":", "."],
        provideCompletionItems: (model, position) => {
          if (model !== editor.getModel()) return { suggestions: [] };
          const before = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: cypherSuggestions(before, model.getValue(), schemaRef.current).map(
              (item) => ({
                label: item.detail ? { label: item.label, description: item.detail } : item.label,
                kind: kinds[item.kind],
                insertText: item.insert,
                range,
              }),
            ),
          };
        },
      }),
    );
  };

  return (
    <div aria-label={ariaLabel} data-testid="cypher-editor">
      <MonacoEditor
        height={height}
        language="cypher"
        onChange={(next) => onChange(next ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          lineNumbers: "on",
          lineNumbersMinChars: 2,
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          renderLineHighlight: "none",
          padding: { top: 6, bottom: 6 },
          overviewRulerLanes: 0,
          scrollbar: { alwaysConsumeMouseWheel: false },
          fixedOverflowWidgets: true,
          tabSize: 2,
        }}
        value={value}
      />
    </div>
  );
});
