/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { ensureMonacoSetup } from "@/framework/monaco/ensure";

const MonacoDiffEditorImpl = lazy(async () => {
  await ensureMonacoSetup();
  const module = await import("@monaco-editor/react");

  return { default: module.DiffEditor };
});

type MonacoDiffEditorProps = DiffEditorProps & {
  fallback?: ReactNode;
};

/** Side-by-side diff on the same locally bundled Monaco as MonacoEditor. */
export function MonacoDiffEditor({ fallback = null, ...props }: MonacoDiffEditorProps) {
  const resolvedTheme = useResolvedTheme();

  return (
    <Suspense fallback={fallback}>
      <MonacoDiffEditorImpl
        {...props}
        theme={props.theme ?? (resolvedTheme === "dark" ? "vs-dark" : "vs")}
      />
    </Suspense>
  );
}
