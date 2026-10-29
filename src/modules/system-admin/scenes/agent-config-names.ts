/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

const BUILTIN_AGENT_IDS: readonly string[] = [
  "studio_smart_qa",
  "cypher_generation",
  "graph_explorer",
  "business_provenance_claim_attribution",
  "business_provenance_optimizer",
  "catalog-semantic-understanding",
  "resource-semantic-understanding",
];

/** Only translate shipped names; a renamed built-in or an unknown Agent keeps its stored name. */
export function agentDisplayName(agent: { agent_id: string; name: string }, t: TFunction): string {
  if (!BUILTIN_AGENT_IDS.includes(agent.agent_id)) return agent.name;
  const key = `systemAdmin.agentConfig.builtinNames.${agent.agent_id}`;
  const shippedNames = [t(key, { lng: "zh-CN" }), t(key, { lng: "en-US" })];
  return shippedNames.includes(agent.name) ? t(key) : agent.name;
}
