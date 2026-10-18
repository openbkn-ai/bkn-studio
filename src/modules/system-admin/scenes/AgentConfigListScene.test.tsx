/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
