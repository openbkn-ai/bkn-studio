/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import {
  LOGIC_KINDS,
  METRIC_TYPES,
  type NeedState,
} from "@/modules/bkn-project/components/kinetic/needs";

/**
 * Kinetic codes are for machines; the page words them. Every set is open: a value the page does
 * not know reads as "other", never as the code.
 */
export const KINETIC = "bknProject.kinetic";

const word = (group: string, values: readonly string[]) => (t: TFunction, value: string) =>
  t(`${KINETIC}.${group}.${values.includes(value) ? value : "other"}`);

export const logicKindText = word("kind", LOGIC_KINDS);

export const metricTypeText = word("metricType", METRIC_TYPES);

export const sourceText = word("source", ["documents", "analysis", "scenarios", "person", "ask"]);

export const candidateReasonText = word("panel.candidateReason", [
  "same_name",
  "similar_name",
  "same_object_type",
]);

export const implementationReasonText = word("panel.implementationReason", [
  "missing",
  "forbidden",
  "unavailable",
]);

/** Why the last analysis failed, drafting's codes as an analysis words them. */
export const runErrorText = word("runError", [
  "agent_rejected",
  "agent_unavailable",
  "agent_failed",
  "agent_timeout",
  "output_invalid",
  "interrupted",
]);

/** How to implement a need of a kind, as the page guides it. */
export const guideText = word("panel.guide", LOGIC_KINDS);

export const needStateText = (t: TFunction, state: NeedState) => t(`${KINETIC}.state.${state}`);

/** How an action type is carried out, by the api or mcp_tool need that does it. */
export const executionText = (t: TFunction, executor: { kind: string; name: string }) =>
  t(`${KINETIC}.execution.${executor.kind === "mcp_tool" ? "mcp_tool" : "api"}`, {
    name: executor.name,
  });

const STATE_TONES: Record<NeedState, LightStatusTone> = {
  broken: "error",
  implemented: "success",
  pending: "warning",
  recordOnly: "neutral",
  waitingRelease: "neutral",
};

export const needStateTone = (state: NeedState) => STATE_TONES[state];

/** The kinds the network's items are counted by, in the order the page names them. */
const COUNTED = ["action_type", "function", "api", "skill", "object_metric"] as const;

/** What an item counts as: an API is a function bound from an OpenAPI description. */
const countedAs = (item: { kind?: string; type: string }) =>
  item.kind === "api" ? "api" : item.type;

/** "7 action types, 4 functions", kinds the network has none of left out. */
export function networkItemCounts(t: TFunction, items: { kind?: string; type: string }[]) {
  return COUNTED.map((type) => ({
    count: items.filter((item) => countedAs(item) === type).length,
    type,
  }))
    .filter(({ count }) => count > 0)
    .map(({ count, type }) => t(`${KINETIC}.network.count.${type}`, { count }))
    .join(t("bknProject.listSeparator"));
}

/** "Already in the network: 7 action types, 4 functions; 3 new needs", kinds it has none of left out. */
export function networkSummary(
  t: TFunction,
  items: { kind?: string; type: string }[],
  newNeeds: number,
) {
  return t(`${KINETIC}.network.summary`, {
    count: newNeeds,
    items: networkItemCounts(t, items),
  });
}
