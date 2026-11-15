/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Monaco } from "@monaco-editor/react";

type JsonDefaults = Monaco["languages"]["json"]["jsonDefaults"];
type Registration = { uri: string; fileMatch: string[]; schema: unknown };
const registries = new WeakMap<JsonDefaults, Map<string, Registration>>();

/** Merge owned registrations with external schemas; never reset global JSON diagnostics. */
export function registerJsonSchema(monaco: Monaco, modelPath: string, schema: unknown) {
  const defaults = monaco.languages.json.jsonDefaults;
  const owned = registries.get(defaults) ?? new Map<string, Registration>();
  registries.set(defaults, owned);
  const uri = `${modelPath}.schema`;
  const entry = { uri, fileMatch: [modelPath], schema };
  const publish = (removed?: string) => {
    const current = defaults.diagnosticsOptions;
    defaults.setDiagnosticsOptions({
      ...current,
      schemas: [
        ...(current.schemas ?? []).filter((item) => item.uri !== removed && !owned.has(item.uri)),
        ...owned.values(),
      ],
    });
  };
  owned.set(uri, entry);
  publish();
  return () => {
    // A late cleanup must not unregister a newer schema for the same model.
    if (owned.get(uri) !== entry) return;
    owned.delete(uri);
    publish(uri);
  };
}
