/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * What another page states when it opens the metric editor for a need of its own, and where the
 * editor goes back to. The metric pages only know this context and its return address.
 */
export type ObjectMetricNavigationContext = {
  title: string;
  description?: string;
  /** Fills the AI assistant's input on create; it is not sent. */
  prompt?: string;
  /** An in-app path: starts with "/" and not "//". */
  returnTo: string;
  returnLabel: string;
  /** Navigation state handed back with the return. */
  returnState?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function filledText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function optionalText(value: unknown) {
  return filledText(value) ? value : undefined;
}

/** Reads `objectMetricContext` from navigation state; undefined unless it is complete and safe. */
export function readObjectMetricContext(state: unknown): ObjectMetricNavigationContext | undefined {
  const candidate = isRecord(state) ? state.objectMetricContext : undefined;
  if (!isRecord(candidate)) return undefined;
  const { description, prompt, returnLabel, returnState, returnTo, title } = candidate;
  if (!filledText(title) || !filledText(returnLabel) || !filledText(returnTo)) return undefined;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.includes("\\")) {
    return undefined;
  }
  if (returnState !== undefined && !isRecord(returnState)) return undefined;
  return {
    title,
    description: optionalText(description),
    prompt: optionalText(prompt),
    returnTo,
    returnLabel,
    returnState,
  };
}

/** The state to return with once the metric exists. */
export function objectMetricCreatedState(
  context: ObjectMetricNavigationContext,
  id: string,
): Record<string, unknown> {
  return { ...context.returnState, objectMetricCreated: { id } };
}
