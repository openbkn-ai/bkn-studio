/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type * as Monaco from "monaco-editor";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { ensureMonacoSetup } from "@/framework/monaco/ensure";
import { monacoThemeFor } from "@/framework/monaco/themes";

const MonacoDiffEditorImpl = lazy(async () => {
  await ensureMonacoSetup();
  return import("./MonacoDiffEditorImpl");
});

export type MonacoDiffEditorProps = {
  original?: string;
  modified?: string;
  language?: string;
  options?: Monaco.editor.IStandaloneDiffEditorConstructionOptions;
  theme?: string;
  height?: number | string;
  width?: number | string;
  className?: string;
  fallback?: ReactNode;
  onMount?: (editor: Monaco.editor.IStandaloneDiffEditor, monaco: typeof Monaco) => void;
};

/** Lazily loads our diff editor; it owns its anonymous models and their lifetime. */
export function MonacoDiffEditor({ fallback = null, ...props }: MonacoDiffEditorProps) {
  const resolvedTheme = useResolvedTheme();

  return (
    <Suspense fallback={fallback}>
      <MonacoDiffEditorImpl {...props} theme={props.theme ?? monacoThemeFor(resolvedTheme)} />
    </Suspense>
  );
}
