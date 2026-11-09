/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * What another page states when it opens the action type form for a need of its own, what the
 * form starts with, and where it goes back to. The action type pages only know this context and
 * its return address.
 */
/** What carries out the action, by the ids the action type's execution takes. */
export type ActionTypeExecutionPrefill =
  | { boxId: string; toolId: string; toolName?: string; type: "tool" }
  | { mcpId: string; toolId: string; toolName?: string; type: "mcp" };

export type ActionTypeNavigationContext = {
  title: string;
  description?: string;
  /** Said beside the description, such as what to do before the form can be completed. */
  notice?: string;
  /** Fills the form on create; a person still checks and saves it. */
  prefill?: {
    description?: string;
    execution?: ActionTypeExecutionPrefill;
    name?: string;
    objectTypeId?: string;
  };
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

function readExecution(value: unknown): ActionTypeExecutionPrefill | undefined {
  if (!isRecord(value) || !filledText(value.toolId)) return undefined;
  const toolName = optionalText(value.toolName);
  if (value.type === "tool" && filledText(value.boxId)) {
    return { boxId: value.boxId, toolId: value.toolId, toolName, type: "tool" };
  }
  if (value.type === "mcp" && filledText(value.mcpId)) {
    return { mcpId: value.mcpId, toolId: value.toolId, toolName, type: "mcp" };
  }
  return undefined;
}

/** Reads `actionTypeContext` from navigation state; undefined unless it is complete and safe. */
export function readActionTypeContext(state: unknown): ActionTypeNavigationContext | undefined {
  const candidate = isRecord(state) ? state.actionTypeContext : undefined;
  if (!isRecord(candidate)) return undefined;
  const { description, notice, prefill, returnLabel, returnState, returnTo, title } = candidate;
  if (!filledText(title) || !filledText(returnLabel) || !filledText(returnTo)) return undefined;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.includes("\\")) {
    return undefined;
  }
  if (returnState !== undefined && !isRecord(returnState)) return undefined;
  if (prefill !== undefined && !isRecord(prefill)) return undefined;
  return {
    title,
    description: optionalText(description),
    notice: optionalText(notice),
    prefill: prefill
      ? {
          description: optionalText(prefill.description),
          execution: readExecution(prefill.execution),
          name: optionalText(prefill.name),
          objectTypeId: optionalText(prefill.objectTypeId),
        }
      : undefined,
    returnTo,
    returnLabel,
    returnState,
  };
}

/** The state to return with once the action type exists. */
export function actionTypeCreatedState(
  context: ActionTypeNavigationContext,
  id: string,
): Record<string, unknown> {
  return { ...context.returnState, actionTypeCreated: { id } };
}
