/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import Editor from "@monaco-editor/react";

import styles from "./JsonEditor.module.css";

const EDITOR_OPTIONS = {
  folding: true,
  wordWrap: "on" as const,
  lineHeight: 20,
  fontSize: 13,
  automaticLayout: true,
  renderLineHighlight: "none" as const,
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
  minimap: { enabled: false },
  tabSize: 2,
  scrollbar: {
    vertical: "auto" as const,
    horizontal: "auto" as const,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
    alwaysConsumeMouseWheel: false,
  },
};

type JsonEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  readOnly?: boolean;
};

export function JsonEditor({
  value = "",
  onChange,
  height = 260,
  readOnly = false,
}: JsonEditorProps) {
  return (
    <div className={styles.editorBorder}>
      <Editor
        defaultLanguage="json"
        height={height}
        onChange={(next) => onChange?.(next ?? "")}
        options={{ ...EDITOR_OPTIONS, readOnly }}
        theme="vs"
        value={value}
      />
    </div>
  );
}
