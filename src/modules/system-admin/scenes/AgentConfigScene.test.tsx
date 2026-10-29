/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { App } from "antd";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { BknAgentExecutionError } from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import { AgentConfigScene } from "./AgentConfigScene";

type SettingsModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-settings.service");
type SharedAgent =
  import("@/modules/knowledge-network/services/bkn-agent-settings.service").SharedAgent;

const {
  activateVersion,
  deleteVersion,
  getShared,
  getSharedPrompt,
  publishSharedPrompt,
  listVersions,
  restoreShared,
  updateShared,
} = vi.hoisted(() => ({
  activateVersion: vi.fn<SettingsModule["activateVersion"]>(),
  deleteVersion: vi.fn<SettingsModule["deleteVersion"]>(),
  listVersions: vi.fn<SettingsModule["listVersions"]>(),
  getShared: vi.fn<SettingsModule["getShared"]>(),
  getSharedPrompt: vi.fn<SettingsModule["getSharedPrompt"]>(),
  publishSharedPrompt: vi.fn<SettingsModule["publishSharedPrompt"]>(),
  restoreShared: vi.fn<SettingsModule["restoreShared"]>(),
  updateShared: vi.fn<SettingsModule["updateShared"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-settings.service",
  async (importOriginal) => ({
    ...(await importOriginal<SettingsModule>()),
    activateVersion,
    deleteVersion,
    listVersions,
    getShared,
    getSharedPrompt,
    publishSharedPrompt,
    restoreShared,
    updateShared,
  }),
);
// Monaco does not run in jsdom; the diff only needs to show which texts it compares.
vi.mock("@/framework/monaco/MonacoDiffEditor", () => ({
  MonacoDiffEditor: ({
    original,
    modified,
    options,
  }: {
    original: string;
    modified: string;
    options?: Record<string, unknown>;
  }) => (
    <div data-testid="diff" data-options={JSON.stringify(options ?? {})}>
      {`${original} => ${modified}`}
    </div>
  ),
}));
vi.mock("@/modules/model-resources/services/llm.service", () => ({
  listLlmModels: () => Promise.resolve({ items: [{ modelName: "DeepSeek V4-flash" }] }),
}));
// Locale changes can replace the runtime object while the token manager remains stable.
const runtimeConfig = {
  auth: {
    tokenManager: { getAccessToken: () => "t", refreshAccessToken: () => Promise.resolve("t") },
  },
};
vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ ...runtimeConfig, locale: i18n.language }),
}));

const SAVE = /^保\s*存$/;
const CONFIRM = i18n.t("systemAdmin.agentConfig.confirmChange");

/** Confirms the change dialog the page opens before every write. */
async function confirmChange() {
  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: CONFIRM }));
    await Promise.resolve();
  });
}

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
  listVersions.mockResolvedValue([version(1, { current: true, initial: true })]);
});

afterEach(cleanup);

function renderScene(agentId = "studio_smart_qa") {
  const router = createMemoryRouter(
    [
      { path: "/edit", element: <AgentConfigScene agentId={agentId} /> },
      { path: "/system/agent-config", element: <div>Agent list destination</div> },
      { path: "/other", element: <div>Other destination</div> },
    ],
    { initialEntries: ["/other", "/edit"], initialIndex: 1 },
  );
  render(
    <App>
      <RouterProvider router={router} />
    </App>,
  );
  return router;
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
    restorable: true,
    modified: false,
    update_user: "admin",
    update_time: 1,
    ...changes,
  };
}

type AgentVersion =
  import("@/modules/knowledge-network/services/bkn-agent-settings.service").AgentVersion;

function version(n: number, changes: Partial<AgentVersion> = {}): AgentVersion {
  return {
    version: n,
    model: "DeepSeek V4-flash",
    mcp_profile: null,
    limits: { max_turns: 40 },
    prompt_version: n,
    prompt_content: `Prompt ${n}`,
    changes: n === 1 ? [] : ["limits"],
    initial: false,
    current: false,
    create_user: "admin",
    create_time: n,
    ...changes,
  };
}

const PROMPT = {
  prompt: { prompt_id: "p", current_version: 3, content: "Shared" },
  next_version: 4,
};

// Each case renders the full configuration page; several also open a dialog, and shared CI
// runners have taken over 20s on those.
describe("AgentConfigScene", { timeout: 40_000 }, () => {
  it.each([
    ["studio_smart_qa", "Studio智能问答", "Studio Smart Q&A"],
    ["cypher_generation", "Cypher生成", "Cypher Generation"],
    ["graph_explorer", "图探索", "Graph Explorer"],
    [
      "business_provenance_claim_attribution",
      "业务溯源结论识别Agent",
      "Business Provenance Claim Attribution Agent",
    ],
    ["business_provenance_optimizer", "知识网络优化Agent", "Knowledge Network Optimizer Agent"],
    ["catalog-semantic-understanding", "数据目录语义理解", "Data Catalog Semantic Understanding"],
    ["resource-semantic-understanding", "数据资源语义理解", "Data Resource Semantic Understanding"],
  ])(
    "localizes the detail title for %s and responds to language changes",
    async (agent_id, name, english) => {
      await i18n.changeLanguage("en-US");
      getShared.mockResolvedValue(shared({ agent_id, name }));
      getSharedPrompt.mockResolvedValue(PROMPT);
      renderScene(agent_id);
      expect(await screen.findByRole("heading", { name: english })).toBeTruthy();
      await act(() => i18n.changeLanguage("zh-CN"));
      expect(screen.getByRole("heading", { name })).toBeTruthy();
      expect(getShared).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["publish", "restore", "runtime"])(
    "uses the localized name in the %s confirmation",
    async (action) => {
      await i18n.changeLanguage("en-US");
      getShared.mockResolvedValue(
        shared({ status: action === "publish" ? "draft" : "published", modified: true }),
      );
      getSharedPrompt.mockResolvedValue(PROMPT);
      renderScene();
      await screen.findByRole("heading", { name: "Studio Smart Q&A" });
      const prefix = "systemAdmin.agentConfig";
      if (action === "runtime") {
        fireEvent.click(screen.getByText(i18n.t(`${prefix}.mcpCompact`)));
        fireEvent.click(
          screen.getByRole("button", { name: i18n.t("knowledgeNetwork.agentChat.config.save") }),
        );
      } else {
        fireEvent.click(screen.getByRole("button", { name: i18n.t(`${prefix}.${action}`) }));
      }
      const dialog = await screen.findByRole("dialog");
      expect(dialog.textContent).toContain("Studio Smart Q&A");
      expect(dialog.textContent).not.toContain("Studio智能问答");
      expect(updateShared).not.toHaveBeenCalled();
      expect(restoreShared).not.toHaveBeenCalled();
    },
  );

  it("publishes the server's next historical Prompt version", async () => {
    getShared.mockResolvedValue(shared());
    // A rollback can make the active version smaller than the next target.
    getSharedPrompt.mockResolvedValue({ ...PROMPT, next_version: 12 });
    publishSharedPrompt.mockResolvedValue({
      prompt: { ...PROMPT.prompt, current_version: 12, content: "Edited" },
      next_version: 13,
    });
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "Edited" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
      }),
    );
    await confirmChange();
    await waitFor(() => expect(publishSharedPrompt).toHaveBeenCalledTimes(1));
    expect(publishSharedPrompt.mock.calls[0][0]).toMatchObject({ content: "Edited", version: 12 });
  });

  it.each([
    {
      name: "a replay conflict",
      failure: new BknAgentExecutionError("Version exists", 409),
      historyFails: false,
    },
    {
      name: "a gateway timeout",
      failure: new BknAgentExecutionError("Gateway timeout", 504),
      historyFails: false,
    },
    { name: "a network failure", failure: new TypeError("Offline"), historyFails: false },
    {
      name: "a conflict followed by a history refresh failure",
      failure: new BknAgentExecutionError("Version exists", 409),
      historyFails: true,
    },
  ])("confirms a committed publication after $name", async ({ failure, historyFails }) => {
    getShared.mockResolvedValue(shared());
    const committed = {
      prompt: { ...PROMPT.prompt, current_version: 4, content: "My draft" },
      next_version: 5,
    };
    getSharedPrompt.mockResolvedValueOnce(PROMPT).mockResolvedValue(committed);
    publishSharedPrompt.mockRejectedValue(failure);
    if (historyFails)
      listVersions.mockResolvedValueOnce([]).mockRejectedValue(new TypeError("Offline"));
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "My draft" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
      }),
    );
    await confirmChange();
    expect(
      await screen.findByText(i18n.t("knowledgeNetwork.agentChat.config.promptPublished")),
    ).toBeTruthy();
    expect(screen.queryByText(i18n.t("systemAdmin.agentConfig.promptVersionConflict"))).toBeNull();
    expect(screen.queryByText(i18n.t("systemAdmin.agentConfig.promptPublishUncertain"))).toBeNull();
    expect(publishSharedPrompt).toHaveBeenCalledTimes(1);
    expect(getSharedPrompt).toHaveBeenCalledTimes(2);
    expect(
      screen
        .getByRole("button", { name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt") })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it.each([
    {
      name: "different content",
      current: { ...PROMPT.prompt, current_version: 4, content: "Other administrator" },
    },
    {
      name: "a different active version",
      current: { ...PROMPT.prompt, current_version: 5, content: "My draft" },
    },
    {
      name: "a different Prompt",
      current: { prompt_id: "another-prompt", current_version: 4, content: "My draft" },
    },
  ])("keeps a publication with $name as a conflict", async ({ current }) => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValueOnce(PROMPT).mockResolvedValue({
      prompt: current,
      next_version: current.current_version + 1,
    });
    publishSharedPrompt.mockRejectedValue(
      new BknAgentExecutionError("Version exists", 409, "BknAgent.Prompt.VersionConflict"),
    );
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "My draft" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
      }),
    );
    await confirmChange();
    expect(
      await screen.findByText(i18n.t("systemAdmin.agentConfig.promptVersionConflict")),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("My draft")).toBeTruthy();
    expect(getSharedPrompt).toHaveBeenCalledTimes(2);
    expect(publishSharedPrompt).toHaveBeenCalledTimes(1);
    expect(publishSharedPrompt.mock.calls[0][0].version).toBe(4);
  });

  it("retains the draft and reports uncertainty if publication and reconciliation both fail", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValueOnce(PROMPT).mockRejectedValue(new TypeError("Offline"));
    publishSharedPrompt.mockRejectedValue(new TypeError("Offline"));
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "My draft" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
      }),
    );
    await confirmChange();
    expect(
      await screen.findByText(i18n.t("systemAdmin.agentConfig.promptPublishUncertain")),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("My draft")).toBeTruthy();
    expect(publishSharedPrompt).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to automatic version allocation on an older backend", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue({ prompt: PROMPT.prompt });
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "Edited" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
      }),
    );
    await confirmChange();
    expect(
      await screen.findByText(i18n.t("systemAdmin.agentConfig.promptVersionUnavailable")),
    ).toBeTruthy();
    expect(publishSharedPrompt).not.toHaveBeenCalled();
  });

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
    fireEvent.change(screen.getByDisplayValue("5"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: SAVE }));
    await confirmChange();
    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    // The hidden context limit is not written back, nor is an MCP surface or the status.
    expect(updateShared.mock.calls[0][0].update).toEqual({
      model: "DeepSeek V4-flash",
      limits: { max_turns: 4 },
    });
  });

  it("lists the Agent's tools by source, outside the danger zone", async () => {
    getShared.mockResolvedValue(
      shared({
        agent_id: "graph_explorer",
        name: "图探索",
        uses_context_loader: false,
        tools: [
          {
            type: "builtin",
            provider: "graph_explorer",
            names: ["canvas_state", "view_state"],
            definitions: [
              {
                name: "canvas_state",
                description: "What is on the canvas right now.",
                parameters: {
                  properties: {
                    limit: { type: "integer", description: "Page size" },
                    object_types: {
                      anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
                    },
                  },
                  required: ["limit"],
                },
              },
              { name: "view_state", description: "Read the view.", parameters: {} },
            ],
          },
          { type: "context_loader", names: [] },
        ],
      }),
    );
    getSharedPrompt.mockResolvedValue(PROMPT);
    renderScene("graph_explorer");

    const card = await screen.findByTestId("agent-config-tools");
    const sources = within(card).getAllByTestId("agent-config-tool-source");
    expect(sources[0].textContent).toContain(
      `${i18n.t("systemAdmin.agentConfig.toolSource.builtin")} · graph_explorer`,
    );
    expect(within(sources[0]).getByText("canvas_state")).toBeTruthy();
    expect(within(sources[0]).getByText("view_state")).toBeTruthy();
    // graph_explorer's empty allow-list gives the model no Context Loader tool.
    expect(sources[1].textContent).toContain(
      i18n.t("systemAdmin.agentConfig.toolsNoContextLoader"),
    );
    expect(card.closest("section")).toBeNull();
    // A tool's definition opens from its name.
    fireEvent.click(within(sources[0]).getByText("canvas_state"));
    const definition = await within(sources[0]).findByTestId("agent-config-tool-definition");
    expect(definition.textContent).toContain("What is on the canvas right now.");
    expect(within(definition).getByText("limit")).toBeTruthy();
    expect(within(definition).getByText("Page size")).toBeTruthy();
    expect(within(definition).getByText("array<string>")).toBeTruthy();
  });

  it("shows no tools card when the service does not report tools", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.runtimeTitle"))).toBeTruthy();
    expect(screen.queryByTestId("agent-config-tools")).toBeNull();
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

  it("has nothing to save until something changes", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    renderScene();

    await screen.findByText(i18n.t("systemAdmin.agentConfig.intro"));
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByRole("button", { name: SAVE }).hasAttribute("disabled")).toBe(true);
  });

  it("confirms a runtime change with what it changes, then saves", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared({ mcp_profile: "compact" }));
    renderScene();

    fireEvent.click(await screen.findByText(i18n.t("systemAdmin.agentConfig.mcpCompact")));
    fireEvent.click(screen.getByRole("button", { name: SAVE }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(
      `${i18n.t("systemAdmin.agentConfig.mcpDefault")} → ${i18n.t("systemAdmin.agentConfig.mcpCompact")}`,
    );
    expect(updateShared).not.toHaveBeenCalled();

    await confirmChange();
    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    expect(updateShared.mock.calls[0][0].update).toEqual({
      model: "DeepSeek V4-flash",
      mcp_profile: "compact",
      limits: { max_turns: 40, timeout_s: 300 },
    });
  });

  it("restores the initial version after confirmation and offers no unpublish", async () => {
    getShared.mockResolvedValue(shared({ model: "Qwen", restorable: true, modified: true }));
    getSharedPrompt.mockResolvedValue(PROMPT);
    restoreShared.mockResolvedValue(shared({ restorable: true, modified: false }));
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.dangerZone"))).toBeTruthy();
    // Built-in Agents stay published: there is no status control at all.
    expect(screen.queryByText(i18n.t("knowledgeNetwork.agentChat.config.status"))).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("systemAdmin.agentConfig.restore") }),
    );
    expect(restoreShared).not.toHaveBeenCalled();
    await confirmChange();

    await waitFor(() => expect(restoreShared).toHaveBeenCalled());
    expect(getSharedPrompt).toHaveBeenCalledTimes(2);
    expect(listVersions).toHaveBeenCalledTimes(2);
    // Back at the shipped state, there is nothing left to restore.
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: i18n.t("systemAdmin.agentConfig.restore") })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
  }, 30_000);

  it("publishes a never-published built-in Agent once", async () => {
    getShared.mockResolvedValue(shared({ status: "draft" }));
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared({ status: "published" }));
    renderScene();

    expect(await screen.findByText(i18n.t("systemAdmin.agentConfig.notPublished"))).toBeTruthy();
    // antd spaces out the two-character label ("发 布").
    fireEvent.click(screen.getByRole("button", { name: /^发\s*布$/ }));
    await confirmChange();

    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    expect(updateShared.mock.calls[0][0].update).toEqual({ status: "published" });
    await waitFor(() =>
      expect(screen.queryByText(i18n.t("systemAdmin.agentConfig.notPublished"))).toBeNull(),
    );
  });

  it("keeps an unsaved prompt draft when the runtime card is saved", async () => {
    getShared.mockResolvedValue(shared());
    getSharedPrompt.mockResolvedValue(PROMPT);
    updateShared.mockResolvedValue(shared({ model: "Qwen" }));
    renderScene();

    const editor = await screen.findByDisplayValue("Shared");
    fireEvent.change(editor, { target: { value: "Draft prompt" } });
    fireEvent.click(screen.getByText(i18n.t("systemAdmin.agentConfig.mcpCompact")));
    fireEvent.click(screen.getByRole("button", { name: SAVE }));
    await confirmChange();

    await waitFor(() => expect(updateShared).toHaveBeenCalled());
    // The saved runtime comes from the response; nothing is reloaded over the draft.
    expect(getSharedPrompt).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("Draft prompt")).toBeTruthy();
  });

  describe("localized prompts", () => {
    const english = { ...PROMPT, prompt: { ...PROMPT.prompt, content: "English prompt" } };

    it("keeps runtime usable when the first Prompt read fails and offers a local retry", async () => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt
        .mockRejectedValueOnce(new TypeError("Prompt temporarily unavailable"))
        .mockResolvedValue(PROMPT);
      renderScene();
      expect(await screen.findByDisplayValue("300")).toBeTruthy();
      await screen.findByText(i18n.t("knowledgeNetwork.agentChat.execution.errors.network"));
      fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
      fireEvent.click(
        screen.getByRole("button", {
          name: (label) => label.replace(/\s/g, "") === i18n.t("common.retry"),
        }),
      );
      expect(await screen.findByDisplayValue("Shared")).toBeTruthy();
      expect(screen.getByDisplayValue("100")).toBeTruthy();
      expect(getShared).toHaveBeenCalledTimes(1);
    });

    it("keeps the runtime card available when a version switch cannot reload its Prompt", async () => {
      getShared.mockResolvedValue(shared({ version: 3 }));
      getSharedPrompt
        .mockResolvedValueOnce(PROMPT)
        .mockRejectedValueOnce(new BknAgentExecutionError("Version Prompt unavailable", 500))
        .mockResolvedValue(PROMPT);
      listVersions.mockResolvedValue([
        version(3, { current: true }),
        version(1, { initial: true }),
      ]);
      activateVersion.mockResolvedValue(shared({ version: 1, limits: { timeout_s: 200 } }));
      renderScene();
      await screen.findByDisplayValue("Shared");
      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.activateVersion", { version: 1 }),
        }),
      );
      await confirmChange();
      await screen.findByText("Version Prompt unavailable");
      expect(screen.getByDisplayValue("200")).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", {
          name: (label) => label.replace(/\s/g, "") === i18n.t("common.retry"),
        }),
      );
      expect(await screen.findByDisplayValue("Shared")).toBeTruthy();
      expect(screen.getByDisplayValue("200")).toBeTruthy();
    });

    it("retains runtime and other-language drafts after a localized Prompt read fails", async () => {
      let failEnglish = true;
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockImplementation(({ locale }) =>
        locale === "en-US"
          ? failEnglish
            ? Promise.reject(new TypeError("English unavailable"))
            : Promise.resolve(english)
          : Promise.resolve(PROMPT),
      );
      renderScene();
      fireEvent.change(await screen.findByDisplayValue("Shared"), {
        target: { value: "Keep Chinese draft" },
      });
      fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
      await act(() => i18n.changeLanguage("en-US"));
      await screen.findByText(i18n.t("knowledgeNetwork.agentChat.execution.errors.network"));
      expect(screen.getByDisplayValue("100")).toBeTruthy();
      failEnglish = false;
      fireEvent.click(
        screen.getByRole("button", {
          name: (label) => label.replace(/\s/g, "") === i18n.t("common.retry"),
        }),
      );
      await screen.findByDisplayValue("English prompt");
      expect(screen.getByDisplayValue("100")).toBeTruthy();
      await act(() => i18n.changeLanguage("zh-CN"));
      expect(await screen.findByDisplayValue("Keep Chinese draft")).toBeTruthy();
      expect(getShared).toHaveBeenCalledTimes(1);
    });

    it.each([
      [403, "forbidden"],
      [404, "notFound"],
    ] as const)("maps a Prompt-only %s response to the existing notice", async (status, notice) => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockRejectedValue(new BknAgentExecutionError("raw server error", status));
      renderScene();
      expect(await screen.findByText(i18n.t(`systemAdmin.agentConfig.${notice}`))).toBeTruthy();
      expect(screen.queryByText("raw server error")).toBeNull();
    });

    it("reloads the active language after an older-language deletion response", async () => {
      let complete!: (value: Awaited<ReturnType<SettingsModule["deleteVersion"]>>) => void;
      let removed = false;
      getShared.mockResolvedValue(shared({ version: 3, initial_version: 1 }));
      getSharedPrompt.mockImplementation(({ locale }) =>
        Promise.resolve(locale === "en-US" ? english : PROMPT),
      );
      listVersions.mockImplementation(({ locale }) =>
        Promise.resolve([
          version(3, { current: true, prompt_content: locale === "en-US" ? "English 3" : "中文3" }),
          ...(removed ? [] : [version(2)]),
          version(1, { initial: true, prompt_content: locale === "en-US" ? "English 1" : "中文1" }),
        ]),
      );
      deleteVersion.mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      renderScene();
      fireEvent.click(
        await screen.findByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.deleteVersionNamed", { version: 2 }),
        }),
      );
      await confirmChange();
      await act(() => i18n.changeLanguage("en-US"));
      await screen.findByDisplayValue("English prompt");
      await act(async () => {
        removed = true;
        complete([
          version(3, { current: true, prompt_content: "中文3" }),
          version(1, { initial: true, prompt_content: "中文1" }),
        ]);
        await Promise.resolve();
      });
      await waitFor(() => expect(listVersions).toHaveBeenCalledTimes(3));
      await waitFor(() =>
        expect(
          screen.queryByRole("button", {
            name: i18n.t("systemAdmin.agentConfig.deleteVersionNamed", { version: 2 }),
          }),
        ).toBeNull(),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.compareVersion", { version: 1 }),
        }),
      );
      expect((await screen.findByTestId("diff")).textContent).toBe("English 1 => English 3");
      expect(deleteVersion.mock.calls[0][0]).toMatchObject({ locale: "zh-CN" });
    });

    it("retains per-language Prompt drafts and the runtime draft across language switches", async () => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockImplementation(({ locale }) =>
        Promise.resolve(locale === "en-US" ? english : PROMPT),
      );
      renderScene();
      fireEvent.change(await screen.findByDisplayValue("Shared"), {
        target: { value: "Chinese draft" },
      });
      fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
      await act(() => i18n.changeLanguage("en-US"));
      fireEvent.change(await screen.findByDisplayValue("English prompt"), {
        target: { value: "English draft" },
      });
      expect(screen.getByDisplayValue("100")).toBeTruthy();
      expect(screen.getByText(i18n.t("systemAdmin.agentConfig.otherLanguageDraft"))).toBeTruthy();
      await act(() => i18n.changeLanguage("zh-CN"));
      expect(await screen.findByDisplayValue("Chinese draft")).toBeTruthy();
      await act(() => i18n.changeLanguage("en-US"));
      expect(await screen.findByDisplayValue("English draft")).toBeTruthy();
      expect(screen.getByDisplayValue("100")).toBeTruthy();
      expect(getShared).toHaveBeenCalledTimes(1);
      expect(publishSharedPrompt).not.toHaveBeenCalled();
    });

    it("protects an inactive language draft while the active language is unchanged", async () => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockImplementation(({ locale }) =>
        Promise.resolve(locale === "en-US" ? english : PROMPT),
      );
      renderScene();
      fireEvent.change(await screen.findByDisplayValue("Shared"), {
        target: { value: "Keep Chinese" },
      });
      await act(() => i18n.changeLanguage("en-US"));
      await screen.findByDisplayValue("English prompt");
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await act(() => i18n.changeLanguage("zh-CN"));
      expect(await screen.findByDisplayValue("Keep Chinese")).toBeTruthy();
    });

    it("ignores an old-language response arriving after the new language", async () => {
      let complete!: (value: Awaited<ReturnType<SettingsModule["getSharedPrompt"]>>) => void;
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockImplementation(({ locale }) =>
        locale === "en-US"
          ? Promise.resolve(english)
          : new Promise((resolve) => {
              complete = resolve;
            }),
      );
      renderScene();
      await waitFor(() => expect(getSharedPrompt).toHaveBeenCalled());
      await act(() => i18n.changeLanguage("en-US"));
      expect(await screen.findByDisplayValue("English prompt")).toBeTruthy();
      await act(async () => {
        complete(PROMPT);
        await Promise.resolve();
      });
      expect(screen.getByDisplayValue("English prompt")).toBeTruthy();
      expect(screen.queryByDisplayValue("Shared")).toBeNull();
    });

    it("refreshes localized version comparisons without reloading runtime settings", async () => {
      getShared.mockResolvedValue(shared({ version: 3 }));
      getSharedPrompt.mockImplementation(({ locale }) =>
        Promise.resolve(locale === "en-US" ? english : PROMPT),
      );
      listVersions.mockImplementation(({ locale }) =>
        Promise.resolve([
          version(3, { current: true, prompt_content: locale === "en-US" ? "English 3" : "中文3" }),
          version(2, { prompt_content: locale === "en-US" ? "English 2" : "中文2" }),
        ]),
      );
      renderScene();
      await screen.findByDisplayValue("Shared");
      await act(() => i18n.changeLanguage("en-US"));
      await screen.findByDisplayValue("English prompt");
      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.compareVersion", { version: 2 }),
        }),
      );
      expect((await screen.findByTestId("diff")).textContent).toBe("English 2 => English 3");
      expect(getShared).toHaveBeenCalledTimes(1);
    });

    it("does not let a publication response overwrite another language's draft", async () => {
      let complete!: (value: Awaited<ReturnType<SettingsModule["getSharedPrompt"]>>) => void;
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockImplementation(({ locale }) =>
        Promise.resolve(locale === "en-US" ? english : PROMPT),
      );
      publishSharedPrompt.mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      renderScene();
      fireEvent.change(await screen.findByDisplayValue("Shared"), {
        target: { value: "Publishing Chinese" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t("knowledgeNetwork.agentChat.config.publishPrompt"),
        }),
      );
      await confirmChange();
      await waitFor(() => expect(publishSharedPrompt).toHaveBeenCalled());
      await act(() => i18n.changeLanguage("en-US"));
      fireEvent.change(await screen.findByDisplayValue("English prompt"), {
        target: { value: "Keep English draft" },
      });
      await act(async () => {
        complete({
          ...PROMPT,
          prompt: { ...PROMPT.prompt, content: "Publishing Chinese", current_version: 4 },
          next_version: 5,
        });
        await Promise.resolve();
      });
      expect(screen.getByDisplayValue("Keep English draft")).toBeTruthy();
      expect(publishSharedPrompt.mock.calls[0][0]).toMatchObject({
        locale: "zh-CN",
        content: "Publishing Chinese",
        version: 4,
      });
    });
  });

  describe("unsaved changes", () => {
    const prefix = "systemAdmin.agentConfig";
    const beforeUnload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const goBack = () =>
      fireEvent.click(screen.getByRole("button", { name: new RegExp(i18n.t(`${prefix}.back`)) }));

    it.each(["prompt", "limits", "profile"])(
      "keeps a %s draft on cancel and leaves only after confirmation",
      async (field) => {
        getShared.mockResolvedValue(shared());
        getSharedPrompt.mockResolvedValue(PROMPT);
        renderScene();
        const editor = await screen.findByDisplayValue("Shared");
        expect(beforeUnload()).toBe(false);
        if (field === "prompt") fireEvent.change(editor, { target: { value: "Draft" } });
        else if (field === "limits")
          fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
        else fireEvent.click(screen.getByText(i18n.t(`${prefix}.mcpCompact`)));
        expect(beforeUnload()).toBe(true);
        goBack();
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain(i18n.t(`${prefix}.unsavedTitle`));
        expect(screen.queryByText("Agent list destination")).toBeNull();
        fireEvent.click(
          within(dialog).getByRole("button", { name: i18n.t(`${prefix}.keepEditing`) }),
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(beforeUnload()).toBe(true);
        if (field === "prompt") expect(screen.getByDisplayValue("Draft")).toBeTruthy();
        else if (field === "limits") expect(screen.getByDisplayValue("100")).toBeTruthy();
        else
          expect(screen.getByRole("radio", { name: i18n.t(`${prefix}.mcpCompact`) })).toBeChecked();
        goBack();
        fireEvent.click(
          within(await screen.findByRole("dialog")).getByRole("button", {
            name: i18n.t(`${prefix}.discardAndLeave`),
          }),
        );
        expect(await screen.findByText("Agent list destination")).toBeTruthy();
        expect(beforeUnload()).toBe(false);
        expect(updateShared).not.toHaveBeenCalled();
        expect(publishSharedPrompt).not.toHaveBeenCalled();
      },
    );

    it.each(["link", "history"])(
      "blocks %s navigation and preserves the intended destination",
      async (kind) => {
        getShared.mockResolvedValue(shared());
        getSharedPrompt.mockResolvedValue(PROMPT);
        const router = renderScene();
        fireEvent.change(await screen.findByDisplayValue("Shared"), { target: { value: "Draft" } });
        await act(async () => {
          if (kind === "history") await router.navigate(-1);
          else await router.navigate("/other");
        });
        fireEvent.click(
          within(await screen.findByRole("dialog")).getByRole("button", {
            name: i18n.t(`${prefix}.discardAndLeave`),
          }),
        );
        expect(await screen.findByText("Other destination")).toBeTruthy();
      },
    );

    it("does not block unchanged or reverted content", async () => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockResolvedValue(PROMPT);
      renderScene();
      const editor = await screen.findByDisplayValue("Shared");
      fireEvent.change(editor, { target: { value: "Draft" } });
      fireEvent.change(editor, { target: { value: "Shared" } });
      fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
      fireEvent.change(screen.getByDisplayValue("100"), { target: { value: "300" } });
      expect(beforeUnload()).toBe(false);
      goBack();
      expect(await screen.findByText("Agent list destination")).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it.each([false, true])(
      "runtime save clears only its own draft (prompt draft: %s)",
      async (withPrompt) => {
        const saved = shared({ limits: { max_turns: 40, timeout_s: 100 } });
        getShared.mockResolvedValueOnce(shared()).mockResolvedValue(saved);
        getSharedPrompt.mockResolvedValue(PROMPT);
        updateShared.mockResolvedValue(saved);
        renderScene();
        const editor = await screen.findByDisplayValue("Shared");
        if (withPrompt) fireEvent.change(editor, { target: { value: "Draft" } });
        fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
        fireEvent.click(screen.getByRole("button", { name: SAVE }));
        await confirmChange();
        await waitFor(() => expect(screen.getByRole("button", { name: SAVE })).toBeDisabled());
        expect(beforeUnload()).toBe(withPrompt);
        expect(screen.getByDisplayValue(withPrompt ? "Draft" : "Shared")).toBeTruthy();
      },
    );

    it.each([false, true])(
      "prompt publication clears only its own draft (runtime draft: %s)",
      async (withRuntime) => {
        getShared.mockResolvedValue(shared());
        getSharedPrompt.mockResolvedValue(PROMPT);
        publishSharedPrompt.mockResolvedValue({
          prompt: { ...PROMPT.prompt, content: "Published", current_version: 4 },
          next_version: 5,
        });
        renderScene();
        fireEvent.change(await screen.findByDisplayValue("Shared"), {
          target: { value: "Published" },
        });
        if (withRuntime)
          fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
        const name = i18n.t("knowledgeNetwork.agentChat.config.publishPrompt");
        fireEvent.click(screen.getByRole("button", { name }));
        await confirmChange();
        await waitFor(() => expect(screen.getByRole("button", { name })).toBeDisabled());
        expect(beforeUnload()).toBe(withRuntime);
        expect(screen.getByDisplayValue(withRuntime ? "100" : "300")).toBeTruthy();
      },
    );

    it("keeps failed saves protected", async () => {
      getShared.mockResolvedValue(shared());
      getSharedPrompt.mockResolvedValue(PROMPT);
      updateShared.mockRejectedValue(new Error("Save failed"));
      renderScene();
      await screen.findByDisplayValue("Shared");
      fireEvent.change(screen.getByDisplayValue("300"), { target: { value: "100" } });
      fireEvent.click(screen.getByRole("button", { name: SAVE }));
      await confirmChange();
      await waitFor(() => expect(updateShared).toHaveBeenCalled());
      expect(beforeUnload()).toBe(true);
      expect(screen.getByDisplayValue("100")).toBeTruthy();
    });
  });

  describe("versions", () => {
    const HISTORY = [
      version(3, { current: true, changes: ["prompt_version"] }),
      version(2, { limits: { max_turns: 12 } }),
      version(1, { initial: true }),
    ];

    it("lists versions with what each changed and compares one with the current", async () => {
      getShared.mockResolvedValue(shared({ version: 3, initial_version: 1 }));
      getSharedPrompt.mockResolvedValue(PROMPT);
      listVersions.mockResolvedValue(HISTORY);
      renderScene();

      expect(
        await screen.findByText(i18n.t("systemAdmin.agentConfig.change.prompt_version")),
      ).toBeTruthy();
      expect(screen.getByText(i18n.t("systemAdmin.agentConfig.firstVersion"))).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.compareVersion", { version: 2 }),
        }),
      );
      expect((await screen.findByTestId("diff")).textContent).toBe("Prompt 2 => Prompt 3");
      // Both sides wrap, and the diff never starts inline while the dialog opens: Monaco would
      // switch the original side's wrapping off then and not restore it.
      expect(
        JSON.parse(screen.getByTestId("diff").getAttribute("data-options") ?? "{}"),
      ).toMatchObject({
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: false,
        wordWrap: "on",
        diffWordWrap: "on",
      });
      // The runtime difference (step limit 12 → 40) is listed above the Prompt diff.
      const changed = document.querySelector("tr[class]")!;
      expect(changed.textContent).toContain("12");
      expect(changed.textContent).toContain("40");
    });

    it("deletes only versions that are neither current nor initial", async () => {
      getShared.mockResolvedValue(shared({ version: 3, initial_version: 1 }));
      getSharedPrompt.mockResolvedValue(PROMPT);
      listVersions.mockResolvedValue(HISTORY);
      deleteVersion.mockResolvedValue(HISTORY.filter((v) => v.version !== 2));
      renderScene();
      const button = (key: string, n: number) =>
        screen.queryByRole("button", {
          name: i18n.t(`systemAdmin.agentConfig.${key}`, { version: n }),
        });

      await screen.findByText(i18n.t("systemAdmin.agentConfig.firstVersion"));
      // The current version has no actions; the initial one can be used but not deleted.
      expect(button("activateVersion", 3)).toBeNull();
      expect(button("deleteVersionNamed", 1)).toBeNull();
      expect(button("activateVersion", 1)).toBeTruthy();

      fireEvent.click(button("deleteVersionNamed", 2)!);
      await confirmChange();
      await waitFor(() => expect(deleteVersion).toHaveBeenCalled());
      expect(deleteVersion.mock.calls[0][0].version).toBe(2);
    });

    it("switches to an earlier version after confirmation", async () => {
      getShared.mockResolvedValue(shared({ version: 3, initial_version: 1 }));
      getSharedPrompt.mockResolvedValue(PROMPT);
      listVersions.mockResolvedValue(HISTORY);
      activateVersion.mockResolvedValue(shared({ version: 1 }));
      renderScene();

      fireEvent.click(
        await screen.findByRole("button", {
          name: i18n.t("systemAdmin.agentConfig.activateVersion", { version: 1 }),
        }),
      );
      await confirmChange();
      await waitFor(() => expect(activateVersion).toHaveBeenCalled());
      expect(activateVersion.mock.calls[0][0].version).toBe(1);
    });
  });
});
