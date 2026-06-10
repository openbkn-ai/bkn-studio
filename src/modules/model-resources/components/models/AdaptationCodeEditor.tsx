import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import styles from "./AdaptationCodeEditor.module.css";

const EDITOR_OPTIONS = {
  folding: false,
  wordWrap: "on" as const,
  lineHeight: 22,
  automaticLayout: true,
  renderLineHighlight: "none" as const,
  autoClosingBrackets: "never" as const,
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
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

type AdaptationCodeEditorProps = {
  height?: number;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value?: string;
};

export function AdaptationCodeEditor({
  height = 260,
  onChange,
  placeholder = "",
  readOnly = false,
  value = "",
}: AdaptationCodeEditorProps) {
  const [showPlaceholder, setShowPlaceholder] = useState(!value);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    setShowPlaceholder(!value);
  }, [value]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (editor.getValue()) {
      setShowPlaceholder(false);
    }
  };

  const handleChange = (nextValue?: string) => {
    const normalized = nextValue ?? "";
    onChange?.(normalized);
    setShowPlaceholder(!normalized);
  };

  return (
    <div className={styles.editorBorder}>
      {showPlaceholder && placeholder ? (
        <div className={styles.placeholder}>{placeholder}</div>
      ) : null}
      <Editor
        className={`${styles.editor}${readOnly ? ` ${styles.editorReadOnly}` : ""}`}
        defaultLanguage="python"
        height={height}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          ...EDITOR_OPTIONS,
          readOnly,
        }}
        value={value}
      />
    </div>
  );
}
