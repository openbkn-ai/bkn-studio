/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

import { agentDescription, agentDisplayName } from "./agent-config-names";

describe.each(["zh-CN", "en-US"])("Agent name fallback in %s", (language) => {
  it.each([
    { agent_id: "studio_smart_qa", name: "团队助手" },
    { agent_id: "business_provenance_optimizer", name: "Custom Optimizer Agent" },
    { agent_id: "cypher_generation", name: "Custom SQL Helper" },
    { agent_id: "graph_explorer", name: "团队图助手" },
    { agent_id: "custom-agent", name: "Studio智能问答" },
    { agent_id: "cypher_generation", name: "Studio智能问答" },
  ])("preserves the stored name for $agent_id / $name", (agent) => {
    expect(agentDisplayName(agent, i18n.getFixedT(language))).toBe(agent.name);
  });
});

it("recognizes a shipped English name without treating it as a custom rename", () => {
  expect(
    agentDisplayName(
      { agent_id: "studio_smart_qa", name: "Studio Smart Q&A" },
      i18n.getFixedT("zh-CN"),
    ),
  ).toBe("Studio智能问答");
});

it.each([
  ["zh-CN", "Graph Explorer", "图探索"],
  ["en-US", "图探索", "Graph Explorer"],
])("localizes the shipped graph explorer name in %s", (language, name, expected) => {
  expect(agentDisplayName({ agent_id: "graph_explorer", name }, i18n.getFixedT(language))).toBe(
    expected,
  );
});

it.each([
  [
    "business_provenance_claim_attribution",
    "业务溯源结论识别Agent",
    "业务溯源结论识别",
    "Business Provenance Claim Attribution",
  ],
  [
    "business_provenance_claim_attribution",
    "Business Provenance Claim Attribution Agent",
    "业务溯源结论识别",
    "Business Provenance Claim Attribution",
  ],
  [
    "business_provenance_optimizer",
    "知识网络优化Agent",
    "知识网络优化",
    "Knowledge Network Optimizer",
  ],
  [
    "business_provenance_optimizer",
    "Knowledge Network Optimizer Agent",
    "知识网络优化",
    "Knowledge Network Optimizer",
  ],
])(
  "displays stored legacy names without the Agent suffix: %s / %s",
  (agent_id, name, chinese, english) => {
    expect(agentDisplayName({ agent_id, name }, i18n.getFixedT("zh-CN"))).toBe(chinese);
    expect(agentDisplayName({ agent_id, name }, i18n.getFixedT("en-US"))).toBe(english);
  },
);

it.each([
  ["bkn-project-requirements", "BKNProjectRequirements", "项目管理 - 需求起草", "Project - Requirements"],
  ["bkn-project-answer-judge", "BKNProjectAnswerJudge", "项目管理 - 回归判答", "Project - Regression Judge"],
  ["bkn-project-ontology-ask", "BKNProjectOntologyAsk", "项目管理 - 本体建模助手", "Project - Ontology Assistant"],
])("names the project Agent %s, seeded as %s, in either language", (agent_id, stored, zh, en) => {
  for (const name of [stored, zh, en]) {
    expect(agentDisplayName({ agent_id, name }, i18n.getFixedT("zh-CN"))).toBe(zh);
    expect(agentDisplayName({ agent_id, name }, i18n.getFixedT("en-US"))).toBe(en);
  }
});

it("keeps a project Agent's name an administrator changed", () => {
  const agent = { agent_id: "bkn-project-requirements", name: "Team Requirements" };
  expect(agentDisplayName(agent, i18n.getFixedT("zh-CN"))).toBe("Team Requirements");
});

it("describes the project Agents in either language, and no other Agent", () => {
  const zh = agentDescription({ agent_id: "bkn-project-ontology-ask" }, i18n.getFixedT("zh-CN"));
  const en = agentDescription({ agent_id: "bkn-project-ontology-ask" }, i18n.getFixedT("en-US"));
  expect(zh).toContain("对象类或关系类");
  expect(en).toContain("object type or relation type");
  expect(agentDescription({ agent_id: "graph_explorer" }, i18n.getFixedT("en-US"))).toBe("");
  expect(agentDescription({ agent_id: "custom-agent" }, i18n.getFixedT("en-US"))).toBe("");
});
