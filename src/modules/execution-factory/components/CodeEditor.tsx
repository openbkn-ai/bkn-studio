/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";

import styles from "./JsonEditor.module.css";

const MONO_STACK =
  'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace';

const EDITOR_OPTIONS = {
  folding: true,
  wordWrap: "on" as const,
  // 行高比默认松一档：函数代码要读，不是要塞满。
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

/** 默认 vs 主题是纯白 + 深色行号，跟站点的浅灰面板放一起太硬。 */
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

export type CodeEditorLanguage = "json" | "python";

/** 挂在这个 URI 上的 JSON 文档会用下面注册的 schema 做补全与校验。 */
const EVENT_MODEL_PATH = "bkn-function-event.json";

// Python 缩进是语法的一部分，2 空格会写出不符合社区习惯的代码。
const TAB_SIZE_BY_LANGUAGE: Record<CodeEditorLanguage, number> = {
  json: 2,
  python: 4,
};

type CodeEditorProps = {
  /** 内容持续追加时（流式生成）跟随滚动到最后一行，否则每次 setValue 都会跳回顶部。 */
  followTail?: boolean;
  /** 传 "fill" 时铺满父容器高度，交给外层的 flex 布局决定。 */
  height?: number | "fill";
  /** 传入后 JSON 编辑器会按它做键名补全、类型校验和悬浮说明。 */
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
      if (!monaco || language !== "json") {
        return;
      }

      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: jsonSchema
          ? [
              {
                uri: `inmemory://schema/${EVENT_MODEL_PATH}`,
                fileMatch: [`*${EVENT_MODEL_PATH}`],
                schema: jsonSchema,
              },
            ]
          : [],
      });
    },
    [jsonSchema, language],
  );

  // 参数改了要重新挂 schema，否则补全还停在旧契约上。
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
      <Editor
        beforeMount={(monaco) => {
          monacoRef.current = monaco;
          defineTheme(monaco);
          applyJsonSchema(monaco);
        }}
        height={height === "fill" ? "100%" : height}
        language={language}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{ ...EDITOR_OPTIONS, readOnly, tabSize: TAB_SIZE_BY_LANGUAGE[language] }}
        path={language === "json" && jsonSchema ? EVENT_MODEL_PATH : undefined}
        theme={THEME_NAME}
        value={value}
      />
    </div>
  );
}
