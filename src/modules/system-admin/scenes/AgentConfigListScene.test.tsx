/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { SharedAgent } from "@/modules/knowledge-network/services/bkn-agent-settings.service";

import { AgentConfigListScene } from "./AgentConfigListScene";

type SettingsModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-settings.service");

const { listShared } = vi.hoisted(() => ({
  listShared: vi.fn<SettingsModule["listShared"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-settings.service",
  async (importOriginal) => ({ ...(await importOriginal<SettingsModule>()), listShared }),
);
const runtimeConfig = {
  auth: {
    tokenManager: { getAccessToken: () => "t", refreshAccessToken: () => Promise.resolve("t") },
  },
};
vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => runtimeConfig,
}));

function agent(changes: Partial<SharedAgent>): SharedAgent {
  return {
    agent_id: "studio_smart_qa",
    name: "Studio智能问答",
    model: null,
    status: "published",
    limits: {},
    uses_context_loader: true,
    layered: true,
    can_edit: true,
    restorable: true,
    modified: false,
    prompt_version: 2,
    update_user: "admin",
    update_time: 1,
    ...changes,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  vi.resetAllMocks();
});

afterEach(cleanup);

function renderList() {
  render(
    <MemoryRouter initialEntries={["/system/agent-config"]}>
      <Routes>
        <Route element={<AgentConfigListScene />} path="/system/agent-config" />
        <Route element={<div>detail page</div>} path="/system/agent-config/:agentId" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentConfigListScene", () => {
  it("lists the built-in Agents as cards and opens one", async () => {
    listShared.mockResolvedValue([
      agent({}),
      agent({
        agent_id: "business_provenance_optimizer",
        name: "知识网络优化Agent",
        layered: false,
        can_edit: false,
      }),
    ]);
    renderList();

    expect(await screen.findByText("Studio智能问答")).toBeTruthy();
    expect(screen.getByText("知识网络优化Agent")).toBeTruthy();
    // Only the read-only Agent is flagged, only smart Q&A has the layered tag.
    expect(screen.getAllByText(i18n.t("systemAdmin.agentConfig.readOnly"))).toHaveLength(1);
    expect(screen.getAllByText(i18n.t("systemAdmin.agentConfig.layered"))).toHaveLength(1);
    // Built-in Agents are not created from the console.
    expect(screen.queryByText(i18n.t("common.create"))).toBeNull();

    fireEvent.click(screen.getByText("知识网络优化Agent"));
    expect(await screen.findByText("detail page")).toBeTruthy();
  });

  it.each([
    { language: "zh-CN", expected: "提示词 v3 · Agent 配置 v17" },
    { language: "en-US", expected: "Prompt v3 · Agent configuration v17" },
  ])("shows independent current versions in $language (SA-078)", async ({ language, expected }) => {
    await i18n.changeLanguage(language);
    listShared.mockResolvedValue([agent({ prompt_version: 3, version: 17 })]);
    renderList();

    expect(await screen.findByText(expected)).toBeTruthy();
    expect(listShared).toHaveBeenCalledTimes(1);
  });

  it.each([
    { prompt_version: 3, version: undefined, expected: "提示词 v3" },
    { prompt_version: null, version: 17, expected: "Agent 配置 v17" },
    { prompt_version: undefined, version: null, expected: null },
  ])(
    "handles unavailable versions: $prompt_version / $version",
    async ({ expected, ...versions }) => {
      listShared.mockResolvedValue([agent(versions)]);
      renderList();
      await screen.findByText("Studio智能问答");

      if (expected) expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.queryByText(/ · |undefined|null/)).toBeNull();
      expect(screen.getByRole("img", { name: "clock-circle" })).toBeTruthy();
    },
  );

  it("refreshes active versions independently, including a rollback below historical versions", async () => {
    listShared
      .mockResolvedValueOnce([agent({ prompt_version: 3, version: 17 })])
      .mockResolvedValueOnce([agent({ prompt_version: 3, version: 28 })])
      .mockResolvedValueOnce([agent({ prompt_version: 3, version: 17 })])
      .mockResolvedValueOnce([agent({ prompt_version: 4, version: 29 })]);
    renderList();
    await screen.findByText("提示词 v3 · Agent 配置 v17");

    for (const expected of [
      "提示词 v3 · Agent 配置 v28",
      "提示词 v3 · Agent 配置 v17",
      "提示词 v4 · Agent 配置 v29",
    ]) {
      const refresh = screen.getByRole("button", { name: i18n.t("common.refresh") });
      await waitFor(() => expect(refresh.hasAttribute("disabled")).toBe(false));
      fireEvent.click(refresh);
      expect(await screen.findByText(expected)).toBeTruthy();
    }
    expect(listShared).toHaveBeenCalledTimes(4);
  });

  it("localizes all shipped names and updates them when the language changes", async () => {
    const names = [
      ["studio_smart_qa", "Studio智能问答", "Studio Smart Q&A"],
      ["cypher_generation", "Cypher生成", "Cypher Generation"],
      [
        "business_provenance_claim_attribution",
        "业务溯源结论识别Agent",
        "Business Provenance Claim Attribution Agent",
      ],
      ["business_provenance_optimizer", "知识网络优化Agent", "Knowledge Network Optimizer Agent"],
      ["catalog-semantic-understanding", "数据目录语义理解", "Data Catalog Semantic Understanding"],
      [
        "resource-semantic-understanding",
        "数据资源语义理解",
        "Data Resource Semantic Understanding",
      ],
    ];
    listShared.mockResolvedValue(names.map(([agent_id, name]) => agent({ agent_id, name })));
    await i18n.changeLanguage("en-US");
    renderList();
    for (const [, , english] of names) expect(await screen.findByText(english)).toBeTruthy();

    await act(() => i18n.changeLanguage("zh-CN"));
    for (const [, chinese] of names) expect(screen.getByText(chinese)).toBeTruthy();
    expect(listShared).toHaveBeenCalledTimes(1);
  });

  it("searches localized, stored names and stable IDs while retaining custom names", async () => {
    await i18n.changeLanguage("en-US");
    listShared.mockResolvedValue([
      agent({}),
      agent({ agent_id: "catalog-semantic-understanding", name: "数据目录语义理解" }),
      agent({ agent_id: "cypher_generation", name: "团队查询助手" }),
      agent({ agent_id: "custom-agent", name: "自定义助手" }),
    ]);
    renderList();
    const input = await screen.findByPlaceholderText(
      i18n.t("systemAdmin.agentConfig.searchPlaceholder"),
    );
    await screen.findByText("Studio Smart Q&A");
    for (const query of ["catalog", "CATALOG SEMANTIC", "目录", "catalog-semantic-understanding"]) {
      fireEvent.change(input, { target: { value: query } });
      expect(screen.getByText("Data Catalog Semantic Understanding")).toBeTruthy();
      expect(screen.queryByText("Studio Smart Q&A")).toBeNull();
    }
    fireEvent.change(input, { target: { value: "团队查询助手" } });
    expect(screen.getByText("团队查询助手")).toBeTruthy();
    expect(screen.queryByText("Cypher Generation")).toBeNull();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Studio Smart Q&A")).toBeTruthy();
    expect(screen.getByText("自定义助手")).toBeTruthy();
  });

  it("filters by name or ID", async () => {
    listShared.mockResolvedValue([
      agent({}),
      agent({ agent_id: "catalog-semantic-understanding", name: "数据目录语义理解" }),
    ]);
    renderList();

    fireEvent.change(
      await screen.findByPlaceholderText(i18n.t("systemAdmin.agentConfig.searchPlaceholder")),
      { target: { value: "catalog" } },
    );
    expect(screen.queryByText("Studio智能问答")).toBeNull();
    expect(screen.getByText("数据目录语义理解")).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText(i18n.t("systemAdmin.agentConfig.searchPlaceholder")),
      { target: { value: "nothing" } },
    );
    expect(screen.getByText(i18n.t("systemAdmin.agentConfig.noMatch"))).toBeTruthy();
  });
});
