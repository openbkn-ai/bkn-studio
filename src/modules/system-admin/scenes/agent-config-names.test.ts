/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

import { agentDisplayName } from "./agent-config-names";

describe.each(["zh-CN", "en-US"])("Agent name fallback in %s", (language) => {
  it.each([
    { agent_id: "studio_smart_qa", name: "团队助手" },
    { agent_id: "cypher_generation", name: "Custom SQL Helper" },
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
