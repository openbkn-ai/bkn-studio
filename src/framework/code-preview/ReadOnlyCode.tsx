/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import type { IDisposable } from "monaco-editor";

import { MonacoEditor } from "@/framework/monaco/MonacoEditor";
import { countSourceLines } from "./code-payload";
import styles from "./CodePayloadPreview.module.css";

type Props = { code: string; language: string; wrap: boolean; expanded?: boolean; label: string };

class PreviewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ReadOnlyCode({ code, language, wrap, expanded = false, label }: Props) {
  const [height, setHeight] = useState(
    Math.min(320, Math.max(96, countSourceLines(code) * 20 + 16)),
  );
  const subscription = useRef<IDisposable | null>(null);
  useEffect(
    () => () => {
      subscription.current?.dispose();
    },
    [],
  );
  const fallback = (
    <pre aria-label={label} className={wrap ? styles.plainWrapped : styles.plainCode}>
      {code}
    </pre>
  );

  // 超大历史载荷完整保留为文本，避免阻塞编辑器初始化。
  if (code.length > 200_000) return fallback;

  return (
    <div className={styles.codeContent}>
      <PreviewBoundary fallback={fallback}>
        <MonacoEditor
          value={code}
          language={language}
          height={expanded ? "min(560px, 60vh)" : height}
          fallback={fallback}
          loading={fallback}
          options={{
            readOnly: true,
            domReadOnly: true,
            ariaLabel: label,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: 20,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            wordWrap: wrap ? "on" : "off",
            wrappingIndent: "same",
            minimap: { enabled: false },
            folding: false,
            glyphMargin: false,
            renderLineHighlight: "none",
            renderValidationDecorations: "off",
            scrollBeyondLastLine: false,
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            padding: { top: 8, bottom: 8 },
            stickyScroll: { enabled: false },
            occurrencesHighlight: "off",
            selectionHighlight: false,
            hover: { enabled: false },
            contextmenu: false,
            links: false,
            codeLens: false,
            matchBrackets: "never",
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: "off",
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            automaticLayout: true,
          }}
          onMount={(editor, monaco) => {
            const model = editor.getModel();
            if (model && !monaco.languages.getLanguages().some((item) => item.id === language)) {
              monaco.editor.setModelLanguage(model, "plaintext");
            }
            const resize = () => {
              if (!expanded) setHeight(Math.min(320, Math.max(96, editor.getContentHeight())));
            };
            resize();
            subscription.current?.dispose();
            subscription.current = editor.onDidContentSizeChange(resize);
          }}
        />
      </PreviewBoundary>
    </div>
  );
}
