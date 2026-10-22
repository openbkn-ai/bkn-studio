/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { enUS } from "@/app/locales/resources/en-US";
import { zhCN } from "@/app/locales/resources/zh-CN";

describe("API key callout guidance", () => {
  it.each([
    ["Chinese", zhCN],
    ["English", enUS],
  ])("uses the current MCP API key entry in %s", (_language, resources) => {
    const callout = resources.apiKeys.calloutInfo;

    expect(callout).toContain(resources.shell.items.domainKnowledgeNetwork);
    expect(callout).toContain(resources.shell.items.knowledgeNetworkIntegration);
    expect(callout).toContain(resources.knowledgeNetwork.integration.tabs.mcp);
    expect(callout).toContain(resources.knowledgeNetwork.contextLoaderPanel.appKey.configure);
    expect(callout).toContain("BKN_TOKEN");
    expect(callout).not.toContain("立即体验");
  });

  it("does not mix Chinese into the English guidance", () => {
    expect(enUS.apiKeys.calloutInfo).not.toMatch(/[\u3400-\u9fff]/);
  });
});
