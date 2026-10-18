/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { App } from "antd";
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { BknAgentExecutionError } from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import { AgentConfigScene } from "./AgentConfigScene";

type SettingsModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-settings.service");
type SharedAgent =
  import("@/modules/knowledge-network/services/bkn-agent-settings.service").SharedAgent;

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

function renderScene(agentId = "studio_smart_qa") {
  render(
    <MemoryRouter>
      <App>
        <AgentConfigScene agentId={agentId} />
      </App>
    </MemoryRouter>,
  );
}

function shared(changes: Partial<SharedAgent> = {}): SharedAgent {
  return {
    agent_id: "studio_smart_qa",
    name: "Studio智能问答",
    model: "DeepSeek V4-flash",
    status: "published",
    limits: { max_turns: 40, timeout_s: 300 },
    mcp_profile: null,
    uses_context_loader: true,
    layered: true,
    can_edit: true,
    prompt_version: 3,
    update_user: "admin",
    update_time: 1,
    ...changes,
  };
}

const PROMPT = {
  prompt: { prompt_id: "p", current_version: 3, content: "Shared" },
  versions: [{ version: 3, content: "Shared", create_user: "admin", create_time: 1 }],
};

describe("AgentConfigScene", () => {
  it("shows a read-only Agent without save or publish actions", async () => {
    getShared.mockResolvedValue(shared({ can_edit: false }));
    getSharedPrompt.mockResolvedValue(PROMPT);
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.readOnlyNotice"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: SAVE })).toBeNull();
    expect(
      screen.queryByText(i18n.t("knowledgeNetwork.agentChat.config.publishPrompt")),
    ).toBeNull();
    expect(getShared.mock.calls[0][0].agentId).toBe("studio_smart_qa");
  });

  it("hides the MCP surface and context budget for Agents outside smart Q&A", async () => {
    getShared.mockResolvedValue(
      shared({
        agent_id: "catalog-semantic-understanding",
        name: "数据目录语义理解",
        layered: false,
        uses_context_loader: false,
        limits: { max_turns: 5, keep_tool_results: 3 },
      }),
    );
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared());
    renderScene("catalog-semantic-understanding");

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.introPlain"))).toBeTruthy();
    expect(screen.queryByText(i18n.t("systemAdmin.agentConfig.mcpProfile"))).toBeNull();
    expect(
      screen.queryByText(
        i18n.t("knowledgeNetwork.agentChat.config.limitFields.keep_tool_results.label"),
      ),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
      await Promise.resolve();
    });
    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    // The hidden context limit is not written back, nor is an MCP surface.
    expect(updateShared.mock.calls[0][0].update).toEqual({
      model: "DeepSeek V4-flash",
      status: "published",
      limits: { max_turns: 5 },
    });
  });

  it("explains a refusal from a backend that does not answer read-only", async () => {
    getShared.mockRejectedValue(new BknAgentExecutionError("forbidden", 403));
    getSharedPrompt.mockRejectedValue(new BknAgentExecutionError("forbidden", 403));
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.forbidden"))).toBeTruthy();
    expect(screen.getByText(i18n.t("systemAdmin.agentConfig.back"))).toBeTruthy();
  });

  it("says so when the Agent is not a built-in one", async () => {
    getShared.mockRejectedValue(new BknAgentExecutionError("missing", 404));
    getSharedPrompt.mockRejectedValue(new BknAgentExecutionError("missing", 404));
    renderScene("user-made");

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.notFound"))).toBeTruthy();
  });

  it("saves the model, MCP surface, caps and publish state together", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared());
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

  it("keeps an unsaved prompt draft when the runtime card is saved", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared({ model: "Qwen" }));
    renderScene();

    const editor = await screen.findByDisplayValue("Shared");
    fireEvent.change(editor, { target: { value: "Draft prompt" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
      await Promise.resolve();
    });

    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    // The saved runtime comes from the response; nothing is reloaded over the draft.
    expect(getSharedPrompt).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("Draft prompt")).toBeTruthy();
  });
});
