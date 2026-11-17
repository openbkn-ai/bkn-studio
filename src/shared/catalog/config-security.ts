/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogVariable } from "./types";

/** Sensitive read responses retain metadata while omitting the protected value. */
export function isCatalogVariable(value: unknown): value is CatalogVariable {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const variable = value as Record<string, unknown>;
  return (
    Object.keys(variable).every((key) => key === "value" || key === "sensitive") &&
    (!Object.hasOwn(variable, "sensitive") || typeof variable.sensitive === "boolean") &&
    ((Object.hasOwn(variable, "value") &&
      variable.value !== undefined &&
      variable.value !== null) ||
      variable.sensitive === true)
  );
}

/** Never expose protected or malformed variable definitions in a view or edit form. */
export function protectCatalogConfigVariables(
  config: Record<string, unknown>,
  mode: "display" | "edit",
): Record<string, unknown> {
  if (config.variables === undefined) return config;
  const variables = config.variables;
  if (!variables || typeof variables !== "object" || Array.isArray(variables))
    return { ...config, variables: "••••••••" };
  return {
    ...config,
    variables: Object.fromEntries(
      Object.entries(variables).map(([name, variable]) => {
        if (!isCatalogVariable(variable)) return [name, "••••••••"];
        if (!variable.sensitive) return [name, { ...variable }];
        const metadata = { ...variable };
        delete metadata.value;
        return [name, mode === "display" ? { ...metadata, value: "••••••••" } : metadata];
      }),
    ),
  };
}
