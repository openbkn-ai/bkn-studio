/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";
import type { CaseSchema } from "./case-form.service";

/** Suggest missing required keys only. Null marks an unfilled value, never a business default. */
export function caseArgumentTemplate(
  schema: CaseSchema | undefined,
  values: Record<string, unknown>,
  hiddenFields: string[] = [],
  depth = 0,
): Record<string, unknown> {
  if (
    !schema ||
    depth >= 24 ||
    schema.$ref ||
    schema.oneOf ||
    schema.anyOf ||
    schema.allOf ||
    (schema.type !== "object" && !schema.properties)
  )
    return values;
  const properties = schema.properties as Record<string, CaseSchema> | undefined;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const result = new Map(Object.entries(values));
  let changed = false;
  for (const name of required) {
    if (
      typeof name !== "string" ||
      hiddenFields.includes(name) ||
      ["__proto__", "constructor", "prototype"].includes(name)
    )
      continue;
    if (!result.has(name)) {
      const field = properties?.[name];
      result.set(
        name,
        field?.type === "object" || field?.properties
          ? caseArgumentTemplate(
              field,
              {},
              hiddenFields
                .filter((path) => path.startsWith(name + "."))
                .map((path) => path.slice(name.length + 1)),
              depth + 1,
            )
          : null,
      );
      changed = true;
    }
  }
  // Existing optional groups may also have required children. Keep scalars, arrays,
  // explicit nulls and precise numbers exactly as the user supplied them.
  for (const [name, value] of Object.entries(values)) {
    if (
      hiddenFields.includes(name) ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      BigNumber.isBigNumber(value)
    )
      continue;
    const next = caseArgumentTemplate(
      properties?.[name],
      value as Record<string, unknown>,
      hiddenFields
        .filter((path) => path.startsWith(name + "."))
        .map((path) => path.slice(name.length + 1)),
      depth + 1,
    );
    if (next !== value) {
      result.set(name, next);
      changed = true;
    }
  }
  return changed ? Object.fromEntries(result) : values;
}
