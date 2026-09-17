/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * infer-schema derives the contract from the signature, so it owns which parameters exist, their
 * types and whether they are required. Descriptions are written by people (the backend refuses an
 * undescribed input), and a docstring only covers some of them, so replacing the list outright
 * erased every hand-written description each time the code was re-inferred.
 */

/** Unnamed entries, such as an array's element slot, can only be paired by position. */
function matchKey(parameter: FunctionParameterDef, index: number): string {
  const name = parameter.name?.trim();
  return name ? `name:${name}` : `index:${index}`;
}

function mergeParameter(
  previous: FunctionParameterDef | undefined,
  inferred: FunctionParameterDef,
): FunctionParameterDef {
  if (!previous) {
    return inferred;
  }

  const previousDescription = previous.description?.trim() ? previous.description : undefined;
  const description = previousDescription ?? inferred.description;
  // A changed type makes the old children describe a different shape, so only the top-level
  // description survives it.
  const sameType = previous.type === inferred.type;
  const subParameters =
    inferred.sub_parameters && sameType
      ? mergeInferredParameters(previous.sub_parameters, inferred.sub_parameters)
      : inferred.sub_parameters;

  const merged: FunctionParameterDef = { ...inferred };
  if (description !== undefined) {
    merged.description = description;
  }
  if (subParameters !== undefined) {
    merged.sub_parameters = subParameters;
  }
  return merged;
}

/**
 * Takes the parameter list from inference and keeps the existing description of every parameter
 * that is still there, recursing into sub_parameters while the type is unchanged. An inferred
 * description only fills a description that was empty.
 */
export function mergeInferredParameters(
  previous: FunctionParameterDef[] | undefined,
  inferred: FunctionParameterDef[],
): FunctionParameterDef[] {
  const byKey = new Map<string, FunctionParameterDef>();
  (previous ?? []).forEach((parameter, index) => {
    const key = matchKey(parameter, index);
    if (!byKey.has(key)) {
      byKey.set(key, parameter);
    }
  });

  return inferred.map((parameter, index) =>
    mergeParameter(byKey.get(matchKey(parameter, index)), parameter),
  );
}

function canonical(parameters: FunctionParameterDef[] | undefined): unknown {
  return (parameters ?? []).map((parameter) => ({
    description: parameter.description?.trim() ? parameter.description : undefined,
    name: parameter.name,
    required: parameter.required,
    sub_parameters: parameter.sub_parameters ? canonical(parameter.sub_parameters) : undefined,
    type: parameter.type,
  }));
}

/**
 * Compares two contracts regardless of key order, which differs between a loaded detail and a
 * merge result, so re-inferring unchanged code does not mark the function as edited.
 */
export function isSameParameterList(
  a: FunctionParameterDef[] | undefined,
  b: FunctionParameterDef[] | undefined,
): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
