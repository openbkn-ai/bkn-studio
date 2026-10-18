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
import { BknAgentExecutionError } from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import { AgentConfigScene } from "./AgentConfigScene";

type SettingsModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-settings.service");

const { getShared, getSharedPrompt, updateShared } = vi.hoisted(() => ({
  getShared: vi.fn<SettingsModule["getShared"]>(),
  getSharedPrompt: vi.fn<SettingsModule["getSharedPrompt"]>(),
  updateShared: vi.fn<SettingsModule["updateShared"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-settings.service",
  async (importOriginal) => ({
    ...(await importOriginal<SettingsModule>()),
    getShared,
    getSharedPrompt,
    updateShared,
  }),
);
vi.mock("@/modules/model-resources/services/llm.service", () => ({
  listLlmModels: () => Promise.resolve({ items: [{ modelName: "DeepSeek V4-flash" }] }),
}));
// The real runtime config is a stable object; a fresh one per render would re-run loading.
const runtimeConfig = {
  auth: {
    tokenManager: { getAccessToken: () => "t", refreshAccessToken: () => Promise.resolve("t") },
  },
};
vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => runtimeConfig,
}));

const SAVE = /^保\s*存$/;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
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
});

afterEach(cleanup);

function renderScene() {
  render(
    <App>
      <AgentConfigScene />
    </App>,
  );
}

describe("AgentConfigScene", () => {
  it("explains the interim rule when the caller cannot edit", async () => {
    getShared.mockRejectedValue(new BknAgentExecutionError("forbidden", 403));
    getSharedPrompt.mockRejectedValue(new BknAgentExecutionError("forbidden", 403));
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.forbidden"))).toBeTruthy();
  });

  it("saves the model, MCP surface, caps and publish state together", async () => {
    getShared.mockResolvedValue({
      agent_id: "studio_smart_qa",
      model: "DeepSeek V4-flash",
      status: "published",
      limits: { max_turns: 40, timeout_s: 300 },
      mcp_profile: null,
    });
    getSharedPrompt.mockResolvedValue({
      prompt: { prompt_id: "p", current_version: 3, content: "Shared" },
      versions: [{ version: 3, content: "Shared", create_user: "admin", create_time: 1 }],
    });
    updateShared.mockResolvedValue({
      agent_id: "studio_smart_qa",
      status: "published",
      limits: {},
    });
    renderScene();

    fireEvent.click(await screen.findByText(i18n.t("systemAdmin.agentConfig.mcpCompact")));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
      await Promise.resolve();
    });

    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    expect(updateShared.mock.calls[0][0].update).toEqual({
      model: "DeepSeek V4-flash",
      mcp_profile: "compact",
      status: "published",
      limits: { max_turns: 40, timeout_s: 300 },
    });
  });
});
