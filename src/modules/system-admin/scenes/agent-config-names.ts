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
  "bkn-project-requirements",
  "bkn-project-answer-judge",
  "bkn-project-ontology-ask",
  "bkn-project-concept-extraction",
];

// Recognize names stored before the display-only Agent suffix was removed, and the identifiers
// the project Agents are seeded with.
const LEGACY_BUILTIN_IDS: readonly string[] = [
  "business_provenance_claim_attribution",
  "business_provenance_optimizer",
  "bkn-project-requirements",
  "bkn-project-answer-judge",
  "bkn-project-ontology-ask",
  "bkn-project-concept-extraction",
];

/** Only translate shipped names; a renamed built-in or an unknown Agent keeps its stored name. */
export function agentDisplayName(agent: { agent_id: string; name: string }, t: TFunction): string {
  if (!BUILTIN_AGENT_IDS.includes(agent.agent_id)) return agent.name;
  const key = `systemAdmin.agentConfig.builtinNames.${agent.agent_id}`;
  const shippedNames = [
    t(key, { lng: "zh-CN" }),
    t(key, { lng: "en-US" }),
    ...(LEGACY_BUILTIN_IDS.includes(agent.agent_id)
      ? ["zh-CN", "en-US"].map((lng) =>
          t(`systemAdmin.agentConfig.legacyBuiltinNames.${agent.agent_id}`, { lng }),
        )
      : []),
  ];
  return shippedNames.includes(agent.name) ? t(key) : agent.name;
}

/** What a built-in Agent does, in the current language; empty for an Agent without one. */
export function agentDescription(agent: { agent_id: string }, t: TFunction): string {
  if (!BUILTIN_AGENT_IDS.includes(agent.agent_id)) return "";
  return t(`systemAdmin.agentConfig.builtinDescriptions.${agent.agent_id}`, { defaultValue: "" });
}
