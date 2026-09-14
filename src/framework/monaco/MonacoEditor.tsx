/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import type { EditorProps } from "@monaco-editor/react";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { ensureMonacoSetup } from "@/framework/monaco/ensure";

const MonacoEditorImpl = lazy(async () => {
  await ensureMonacoSetup();
  const module = await import("@monaco-editor/react");

  return { default: module.default };
});

type MonacoEditorProps = EditorProps & {
  fallback?: ReactNode;
};

export function MonacoEditor({ fallback = null, ...props }: MonacoEditorProps) {
  const resolvedTheme = useResolvedTheme();

  return (
    <Suspense fallback={fallback}>
      <MonacoEditorImpl
        {...props}
        theme={props.theme ?? (resolvedTheme === "dark" ? "vs-dark" : "vs")}
      />
    </Suspense>
  );
}
