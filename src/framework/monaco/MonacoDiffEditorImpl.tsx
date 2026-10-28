/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { useLayoutEffect, useRef } from "react";

import type { MonacoDiffEditorProps } from "./MonacoDiffEditor";

type Resources = {
  editor: monaco.editor.IStandaloneDiffEditor;
  original: monaco.editor.ITextModel;
  modified: monaco.editor.ITextModel;
};

/** Mount only after local Monaco setup has completed; no adapter owns these resources. */
export default function MonacoDiffEditorImpl({
  original = "",
  modified = "",
  language = "plaintext",
  options,
  theme,
  height = "100%",
  width = "100%",
  className,
  onMount,
}: MonacoDiffEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const resources = useRef<Resources | null>(null);
  const initial = useRef({ original, modified, language, options, theme, onMount });

  useLayoutEffect(() => {
    const host = container.current;
    if (!host) return;
    const props = initial.current;
    let editor: monaco.editor.IStandaloneDiffEditor | undefined;
    let originalModel: monaco.editor.ITextModel | undefined;
    let modifiedModel: monaco.editor.ITextModel | undefined;
    const dispose = () => {
      resources.current = null;
      // Detach and stop diff computation before releasing the models we created.
      editor?.setModel(null);
      editor?.dispose();
      originalModel?.dispose();
      modifiedModel?.dispose();
    };
    try {
      originalModel = monaco.editor.createModel(props.original, props.language);
      modifiedModel = monaco.editor.createModel(props.modified, props.language);
      editor = monaco.editor.createDiffEditor(host, {
        automaticLayout: true,
        ...props.options,
        theme: props.theme,
      });
      editor.setModel({ original: originalModel, modified: modifiedModel });
      resources.current = { editor, original: originalModel, modified: modifiedModel };
      props.onMount?.(editor, monaco);
    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
  }, []);

  useLayoutEffect(() => {
    const current = resources.current;
    if (!current) return;
    if (current.original.getValue() !== original) current.original.setValue(original);
    if (current.modified.getValue() !== modified) current.modified.setValue(modified);
    for (const model of [current.original, current.modified]) {
      if (model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language);
    }
  }, [original, modified, language]);

  useLayoutEffect(() => {
    resources.current?.editor.updateOptions({ automaticLayout: true, ...options });
    if (theme) monaco.editor.setTheme(theme);
  }, [options, theme]);

  return <div ref={container} className={className} style={{ height, width }} />;
}
