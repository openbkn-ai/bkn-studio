/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { capabilityState } from "@/framework/entitlement/capability-state";
import type { EntitlementView } from "@/framework/entitlement/types";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import type { LogicNeedLink, LogicNeedView } from "@/modules/bkn-project/types/kinetic";
import type { ActionTypeExecutionPrefill } from "@/modules/knowledge-network";

/** The kinds of kinetic need, in the order the page lists them. */
export const LOGIC_KINDS = [
  "metric",
  "function",
  "skill",
  "mcp_tool",
  "api",
  "action_type",
  "app",
] as const;

export const METRIC_TYPES = ["atomic", "derived", "composite"] as const;

/**
 * Where a need stands: implemented (linked, and the live network has it), broken (linked to one
 * the live network no longer has), waiting for its object types' first release, pending, or
 * recorded only (an application links to nothing).
 */
export type NeedState = "implemented" | "broken" | "waitingRelease" | "pending" | "recordOnly";

export const NEED_STATES: readonly NeedState[] = [
  "implemented",
  "broken",
  "pending",
  "waitingRelease",
  "recordOnly",
];

export function needState(need: LogicNeedView): NeedState {
  if (need.link) {
    return need.implementation?.reason === "missing" ? "broken" : "implemented";
  }
  if (need.kind === "app") {
    return "recordOnly";
  }
  return need.objectTypeIds.length && !need.liveObjectTypeIds.length ? "waitingRelease" : "pending";
}

/** What a need of a kind links to; none for an application. */
export const linkTypeOf = (kind: string) =>
  ({
    action_type: "action_type",
    api: "function",
    function: "function",
    mcp_tool: "mcp_tool",
    metric: "object_metric",
    skill: "skill",
  })[kind] ?? "";

/** Kinds of needs that carry out an action type. */
export const canExecute = (kind: string) => kind === "api" || kind === "mcp_tool";

/**
 * What the action type form starts its execution with, from the implementation the need that
 * carries the action out is linked to; none until that need is implemented.
 */
export function executionPrefill(executor: LogicNeedView): ActionTypeExecutionPrefill | undefined {
  const link = executor.link;
  if (!link || needState(executor) !== "implemented" || !link.boxId) {
    return undefined;
  }
  const toolName = executor.implementation?.name || undefined;
  if (link.type === "function") {
    return { boxId: link.boxId, toolId: link.id, toolName, type: "tool" };
  }
  if (link.type === "mcp_tool") {
    return { mcpId: link.boxId, toolId: link.id, toolName, type: "mcp" };
  }
  return undefined;
}

/** Kinds implemented from this page in the live network: they open its own forms. */
export const IMPLEMENTED_HERE = ["metric", "action_type"];

/** Where an implementation opens, in the live network or the execution factory. */
export function implementationPath(networkId: string, link: LogicNeedLink): string | null {
  const network = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;
  const id = encodeURIComponent(link.id);
  switch (link.type) {
    case "object_metric":
      return `${network}/metrics/${id}/detail`;
    case "action_type":
      return `${network}/action-types/${id}/detail`;
    case "skill":
      return `/execution-factory/skills/${id}`;
    case "mcp_tool":
      return link.boxId ? `/execution-factory/mcp/${encodeURIComponent(link.boxId)}` : null;
    case "function":
      return link.boxId
        ? `/execution-factory/toolboxes/${encodeURIComponent(link.boxId)}/edit`
        : null;
    default:
      return null;
  }
}

/** Opens an in-app page in a new tab, under the app's base path. */
export function openInNewTab(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.open(`${base}${path}`, "_blank", "noopener,noreferrer");
}

/**
 * The edition's object metrics, as the project's knowledge-base extension is gated:
 * hidden (the image has none, or not known yet), locked (installed, not licensed), enabled.
 */
export type ObjectMetricsMode = "hidden" | "locked" | "enabled";

export function objectMetricsMode(snapshot: EntitlementView | null): ObjectMetricsMode {
  switch (capabilityState(CAPABILITIES.OBJECT_METRICS, snapshot)) {
    case "available":
      return "enabled";
    case "not-licensed":
      return "locked";
    default:
      return "hidden";
  }
}

export function useObjectMetricsMode(): ObjectMetricsMode {
  return objectMetricsMode(useEntitlementContext().snapshot);
}

/** What the page hands back when it returns from implementing a need in the live network. */
export type ImplementedReturn = {
  id: string;
  needId: string;
  type: "action_type" | "object_metric";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a return from the metric editor or the action type form; null for any other state. */
export function readImplementedReturn(state: unknown): ImplementedReturn | null {
  if (!isRecord(state) || typeof state.needId !== "string" || !state.needId) {
    return null;
  }
  for (const [key, type] of [
    ["objectMetricCreated", "object_metric"],
    ["actionTypeCreated", "action_type"],
  ] as const) {
    const created = state[key];
    if (isRecord(created) && typeof created.id === "string" && created.id) {
      return { id: created.id, needId: state.needId, type };
    }
  }
  return null;
}
