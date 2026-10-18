/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { App } from "antd";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { AgentConfig } from "@/modules/knowledge-network/services/bkn-agent-settings.service";

import { AgentConfigDrawer } from "./AgentConfigDrawer";

type SettingsModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-settings.service");
type LoaderModule = typeof import("@/modules/knowledge-network/services/context-loader.service");

const { getAgentConfig, saveUserSetting, saveNetworkSetting, listMcpTools, navigate } = vi.hoisted(
  () => ({
    navigate: vi.fn(),
    getAgentConfig: vi.fn<SettingsModule["getAgentConfig"]>(),
    saveUserSetting: vi.fn<SettingsModule["saveUserSetting"]>(),
    saveNetworkSetting: vi.fn<SettingsModule["saveNetworkSetting"]>(),
    listMcpTools: vi.fn<LoaderModule["listMcpTools"]>(),
  }),
);

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-settings.service",
  async (importOriginal) => ({
    ...(await importOriginal<SettingsModule>()),
    getAgentConfig,
    saveUserSetting,
    saveNetworkSetting,
  }),
);
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/modules/knowledge-network/services/context-loader.service", async (importOriginal) => ({
  ...(await importOriginal<LoaderModule>()),
  listMcpTools,
}));

// antd spaces out two-character Chinese button labels ("保 存").
const SAVE = /^保\s*存$/;

const layer = (setting = {}, version = 0) => ({ agent_id: "studio_smart_qa", setting, version });

function config(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    agent_id: "studio_smart_qa",
    name: "QA",
    model: "DeepSeek V4-flash",
    status: "published",
    shared: { limits: { max_turns: 40, timeout_s: 300 }, allowed_tools: null },
    network: layer({ instruction: "Use fiscal quarters" }, 2),
    user: layer(),
    effective: { limits: { max_turns: 40, timeout_s: 300 }, allowed_tools: null },
    can_edit_network: false,
    can_edit_shared: false,
    ...overrides,
  };
}

function renderDrawer() {
  render(
    <App>
      <AgentConfigDrawer
        open
        onClose={() => undefined}
        env={{ base: "https://platform.example.com", token: "t", knId: "kn-1" }}
        tokenProvider={{ getToken: () => "t", refresh: () => Promise.resolve("t") }}
      />
    </App>,
  );
}

beforeAll(() => {
  // antd's responsive grid queries matchMedia, which jsdom lacks.
  Object.defineProperty(window, "matchMedia", {
    // A plain function: vi.resetAllMocks in beforeEach would wipe a vi.fn implementation.
    value: () => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      matches: false,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
    writable: true,
  });
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  vi.resetAllMocks();
  listMcpTools.mockResolvedValue([
    { name: "search_schema" },
    { name: "run_code" },
    { name: "bkn_start_interaction" },
  ]);
});

afterEach(cleanup);

describe("AgentConfigDrawer", () => {
  it("shows the network layer read-only without modify permission", async () => {
    getAgentConfig.mockResolvedValue(config());
    renderDrawer();

    await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.networkReadOnly"));
    const textarea = document.querySelector("textarea")!;
    expect(textarea.value).toBe("Use fiscal quarters");
    expect(textarea.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: SAVE })).toBeNull();
  });

  it("saves personal preferences without empty fields", async () => {
    getAgentConfig.mockResolvedValue(config());
    saveUserSetting.mockResolvedValue(layer({ instruction: "Tables" }, 1));
    renderDrawer();

    fireEvent.click(await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.userTitle")));
    await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.userDescription"));
    // autoSize adds a hidden measuring textarea, so find the field by its placeholder.
    const fields = screen.getAllByPlaceholderText(
      i18n.t("knowledgeNetwork.agentChat.config.instructionPlaceholder"),
    );
    fireEvent.change(fields[fields.length - 1], { target: { value: "  Tables  " } });
    await act(async () => {
      const saves = screen.getAllByRole("button", { name: SAVE });
      fireEvent.click(saves[saves.length - 1]);
      await Promise.resolve();
    });

    await waitFor(() => expect(saveUserSetting).toHaveBeenCalled());
    expect(saveUserSetting.mock.calls[0][0].setting).toEqual({ instruction: "Tables" });
  });

  it("lets a network editor save the network layer", async () => {
    getAgentConfig.mockResolvedValue(config({ can_edit_network: true }));
    saveNetworkSetting.mockResolvedValue(layer({ instruction: "Use fiscal quarters" }, 3));
    renderDrawer();

    await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.networkDescription"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
      await Promise.resolve();
    });

    await waitFor(() => expect(saveNetworkSetting).toHaveBeenCalled());
    expect(saveNetworkSetting.mock.calls[0][0]).toMatchObject({
      knId: "kn-1",
      setting: { instruction: "Use fiscal quarters" },
    });
  });

  it("lists tools from the MCP surface the Agent uses", async () => {
    getAgentConfig.mockResolvedValue(config({ mcp_profile: "compact" }));
    renderDrawer();

    await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.networkReadOnly"));
    expect(listMcpTools.mock.calls[0][0]).toMatchObject({ mcpProfile: "compact" });
  });

  it("sends shared-configuration editors to System Admin", async () => {
    getAgentConfig.mockResolvedValue(config({ can_edit_shared: true }));
    renderDrawer();

    fireEvent.click(
      await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.sharedTitle")),
    );
    fireEvent.click(
      await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.openSystemConfig")),
    );
    expect(navigate).toHaveBeenCalledWith("/system/agent-config");
  });
});
