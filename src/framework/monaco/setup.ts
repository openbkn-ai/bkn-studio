/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Uses the local Monaco bundle instead of downloading it from the jsdelivr CDN at runtime.
 *
 * `@monaco-editor/react` uses an AMD loader to fetch Monaco from a CDN by default. On internal
 * or weak networks, the editor can remain stuck in Loading, affecting function-workbench logic,
 * test inputs, and every JSON or code editor. Feed the bundled local `monaco-editor` directly to
 * the loader and bundle language workers with Vite's `?worker` to remove the CDN dependency.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import typescriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    // JSON 和 JavaScript/TypeScript 使用专用线程；Python 等语法着色使用通用线程。
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new typescriptWorker();
    }

    return new editorWorker();
  },
};

import { defineMonacoThemes } from "@/framework/monaco/themes";

defineMonacoThemes(monaco);
loader.config({ monaco });
