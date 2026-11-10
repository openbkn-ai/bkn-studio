/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * The SDK invents some nodes rather than the author declaring them: the sole child of an array
 * is its element type, and the sole child named `values` under an object is a dict's value type.
 */
function isStructuralPlaceholder(
  parameter: FunctionParameterDef,
  parentType: string | undefined,
  siblings: number,
): boolean {
  if (siblings !== 1) return false;
  if (parentType === "array") return parameter.name === "items";
  if (parentType === "object") return parameter.name === "values";
  return false;
}

/**
 * Input parameters without a description, as dotted paths. The execution factory refuses to
 * save a function with any, so the workbench names them before the save instead of after it.
 */
export function undescribedInputs(
  inputs: readonly FunctionParameterDef[],
  parentType?: string,
  prefix = "",
): string[] {
  return inputs.flatMap((parameter) => {
    const path = prefix ? `${prefix}.${parameter.name ?? ""}` : (parameter.name ?? "");
    const own =
      !isStructuralPlaceholder(parameter, parentType, inputs.length) &&
      !parameter.description?.trim()
        ? [path]
        : [];
    return [...own, ...undescribedInputs(parameter.sub_parameters ?? [], parameter.type, path)];
  });
}
