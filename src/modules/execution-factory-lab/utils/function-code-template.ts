/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type FunctionCodeTemplateValues = {
  description?: string;
  inputExample?: string;
  intent?: string;
  outputExample?: string;
};

function parseJsonObject(value?: string): Record<string, unknown> | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function toPythonLiteral(value: unknown): string {
  if (value === null) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "None";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(toPythonLiteral).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]) => `${JSON.stringify(key)}: ${toPythonLiteral(entryValue)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  return "None";
}

function toPythonIdentifier(value: string): string | undefined {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : undefined;
}

function buildInputBindingLines(inputExample?: Record<string, unknown>): string[] {
  return Object.entries(inputExample ?? {}).map(([name, value], index) => {
    const identifier = toPythonIdentifier(name);
    const defaultValue = toPythonLiteral(value);

    if (identifier) {
      return `    ${identifier} = event.get(${JSON.stringify(name)}, ${defaultValue})`;
    }

    return `    input_${index + 1} = event.get(${JSON.stringify(name)}, ${defaultValue})  # ${name}`;
  });
}

function buildReturnDraft(
  inputExample?: Record<string, unknown>,
  outputExample?: Record<string, unknown>,
): string {
  if (!outputExample) {
    return `{
        "input": event,
        "result": None,
    }`;
  }

  const outputEntries = Object.entries(outputExample);
  const numericInputs = Object.entries(inputExample ?? {})
    .filter(([, value]) => typeof value === "number")
    .map(([name]) => toPythonIdentifier(name))
    .filter((name): name is string => Boolean(name));

  if (
    outputEntries.length === 1 &&
    typeof outputEntries[0][1] === "number" &&
    numericInputs.length >= 2
  ) {
    return `{${JSON.stringify(outputEntries[0][0])}: ${numericInputs.join(" + ")}}`;
  }

  return toPythonLiteral(outputExample);
}

export function generateFunctionCode(values: FunctionCodeTemplateValues) {
  let inputExample: Record<string, unknown> | undefined;
  let outputExample: Record<string, unknown> | undefined;

  try {
    inputExample = parseJsonObject(values.inputExample);
  } catch {
    inputExample = undefined;
  }

  try {
    outputExample = parseJsonObject(values.outputExample);
  } catch {
    outputExample = undefined;
  }

  const intentLines = (values.intent || values.description || "Implement the requested function.")
    .trim()
    .split(/\r?\n/)
    .map((line) => `    ${line}`)
    .join("\n");

  const inputBindings = buildInputBindingLines(inputExample);
  const inputBindingBlock =
    inputBindings.length > 0
      ? `${inputBindings.join("\n")}\n\n`
      : `    # Read user inputs from event, for example: value = event.get("value")\n\n`;

  return `def handler(event):
    """
${intentLines}
    """
${inputBindingBlock}    # Replace this generated draft with the real logic when needed.
    return ${buildReturnDraft(inputExample, outputExample)}
`;
}
