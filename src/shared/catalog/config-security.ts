/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Hide declared variable values for display, or omit them before loading an edit form. */
export function protectCatalogConfigVariables(
  config: Record<string, unknown>,
  mode: "display" | "edit",
): Record<string, unknown> {
  if (!Object.hasOwn(config, "sensitive_variables")) return config;
  const fields = config.sensitive_variables;
  const variables = config.variables;
  const namesValid =
    Array.isArray(fields) &&
    fields.every((name) => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(name)) &&
    new Set(fields).size === fields.length;
  if (!namesValid || !variables || typeof variables !== "object" || Array.isArray(variables)) {
    return { ...config, variables: mode === "display" ? "••••••••" : {} };
  }
  const names = new Set(fields as string[]);
  return {
    ...config,
    variables: Object.fromEntries(
      Object.entries(variables).flatMap(([key, value]) => {
        if (!names.has(key)) return [[key, value]];
        return mode === "display" ? [[key, "••••••••"]] : [];
      }),
    ),
  };
}
