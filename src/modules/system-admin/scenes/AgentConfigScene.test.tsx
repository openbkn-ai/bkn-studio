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

const {
  activateVersion,
  deleteVersion,
  getShared,
  getSharedPrompt,
  listVersions,
  restoreShared,
  updateShared,
} = vi.hoisted(() => ({
  activateVersion: vi.fn<SettingsModule["activateVersion"]>(),
  deleteVersion: vi.fn<SettingsModule["deleteVersion"]>(),
  listVersions: vi.fn<SettingsModule["listVersions"]>(),
  getShared: vi.fn<SettingsModule["getShared"]>(),
  getSharedPrompt: vi.fn<SettingsModule["getSharedPrompt"]>(),
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
};

// Each case renders the full configuration page; several also open a dialog, and shared CI
// runners have taken over 20s on those.
describe("AgentConfigScene", { timeout: 40_000 }, () => {
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
  });

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
