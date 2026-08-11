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

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    // JSON has a dedicated validation/completion worker. Other languages, including this project's
    // Python, can use the generic editor worker because syntax highlighting uses Monarch rules.
    if (label === "json") {
      return new jsonWorker();
    }

    return new editorWorker();
  },
};

loader.config({ monaco });
