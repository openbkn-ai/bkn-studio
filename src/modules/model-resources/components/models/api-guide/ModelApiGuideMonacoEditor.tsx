/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import Editor from "@monaco-editor/react";

import styles from "./ModelApiGuideMonacoEditor.module.css";

const READONLY_EDITOR_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  folding: false,
  wordWrap: "on" as const,
  lineHeight: 22,
  automaticLayout: true,
  renderLineHighlight: "none" as const,
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  minimap: { enabled: false },
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
  },
  scrollbar: {
    vertical: "visible" as const,
    horizontal: "visible" as const,
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    useShadows: false,
    handleMouseWheel: true,
    alwaysConsumeMouseWheel: false,
  },
};

type ModelApiGuideMonacoEditorProps = {
  height: number | string;
  language: string;
  value: string;
};

export function ModelApiGuideMonacoEditor({
  height,
  language,
  value,
}: ModelApiGuideMonacoEditorProps) {
  return (
    <Editor
      className={styles.editor}
      defaultLanguage={language}
      height={height}
      options={READONLY_EDITOR_OPTIONS}
      value={value}
    />
  );
}
