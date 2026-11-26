/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";

import { contextLoaderPanelPart as zh } from "../locales/zh-CN/context-loader-panel";
import { contextLoaderPanelPart as en } from "../locales/en-US/context-loader-panel";
import { listMcpTools, mcpOpsFrom } from "../services/context-loader.service";

import { ContextLoaderIntegrationPanel } from "./ContextLoaderIntegrationPanel";

type Translate = (key: string, options?: { defaultValue?: string }) => string;

const translation = vi.hoisted(() => ({
  t: vi.fn<Translate>((key) => key),
  currentT: null as Translate | null,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translation.currentT ?? translation.t }),
}));

vi.mock("../services/context-loader.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/context-loader.service")>()),
  listMcpTools: vi.fn(),
}));
const evalTools = [
  "bkn_eval_list_suites",
  "bkn_eval_start_run",
  "bkn_eval_next_case",
  "bkn_eval_submit_result",
  "bkn_eval_get_progress",
].map((name) => ({ name, description: name, inputSchema: { type: "object" } }));
beforeEach(() => {
  vi.mocked(listMcpTools).mockReset();
  vi.mocked(listMcpTools).mockResolvedValue([]);
});

type PanelProps = ComponentProps<typeof ContextLoaderIntegrationPanel>;

const noop = () => undefined;

function renderPanel(overrides: Partial<PanelProps>) {
  const props: PanelProps = {
    mode: "mcp",
    knId: "kn-demo",
    activeOps: [],
    op: null,
    selectedId: "",
    onSelectOp: noop,
    filter: "",
    onFilterChange: noop,
    visibleQuery: [],
    queryVals: {},
    onQueryChange: noop,
    bodyText: "",
    onBodyTextChange: noop,
    bodyError: null,
    onFormatBody: noop,
    displayPath: "",
    response: null,
    responseView: null,
    reqError: null,
    sending: false,
    onSend: noop,
    onResetBody: noop,
    fillingTest: false,
    onFillTestData: noop,
    rightTab: "res",
    onRightTabChange: noop,
    curlOpen: false,
    onCurlOpenChange: noop,
    curl: "",
    onCopy: noop,
    toolDefs: [],
    toolsLoading: false,
    toolsError: null,
    currentTool: null,
    onReloadTools: noop,
    dataBrowserPanel: null,
    mcpUrl: "https://platform.example.com/api/agent-retrieval/v1/mcp",
    mcpProfile: "full",
    onMcpProfileChange: noop,
    appKeyValue: "",
    ...overrides,
  };
  const result = render(
    <MemoryRouter>
      <ContextLoaderIntegrationPanel {...props} />
    </MemoryRouter>,
  );
  return { ...result, props };
}

afterEach(() => {
  cleanup();
  translation.t.mockImplementation((key) => key);
  translation.currentT = null;
});

describe("ContextLoaderIntegrationPanel tool catalog", () => {
  it("starts MCP tool groups collapsed and lets each group expand independently", () => {
    const toolDefs = ["bkn_start_interaction", "search_schema"].map((name) => ({
      name,
      inputSchema: { type: "object", properties: {} },
    }));
    const ops = mcpOpsFrom(toolDefs);
    const { container } = renderPanel({
      activeOps: ops,
      op: ops[0],
      selectedId: toolDefs[0].name,
      toolDefs,
      currentTool: toolDefs[0],
    });
    const groups = container.querySelectorAll<HTMLDetailsElement>(
      'details[class*="toolTreeGroup"]',
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].open).toBe(false);
    expect(groups[1].open).toBe(false);

    fireEvent.click(groups[0].querySelector("summary")!);
    expect(groups[0].open).toBe(true);
    expect(groups[1].open).toBe(false);
  });

  it("opens matching MCP groups while filtering tools", () => {
    const toolDefs = ["bkn_start_interaction", "search_schema"].map((name) => ({
      name,
      inputSchema: { type: "object", properties: {} },
    }));
    const ops = mcpOpsFrom(toolDefs);
    const { container } = renderPanel({
      activeOps: ops,
      op: ops[0],
      selectedId: toolDefs[0].name,
      toolDefs,
      currentTool: toolDefs[0],
      filter: "search_schema",
    });
    const groups = container.querySelectorAll<HTMLDetailsElement>(
      'details[class*="toolTreeGroup"]',
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].open).toBe(true);
    expect(screen.getByRole("button", { name: /search_schema/ })).toBeTruthy();
  });

  it("keeps known tool names in sync with the active locale after tools/list was loaded", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "zh-CN",
      resources: {
        "zh-CN": { translation: { knowledgeNetwork: zh } },
        "en-US": { translation: { knowledgeNetwork: en } },
      },
    });
    translation.currentT = (key, options) => i18n.t(key, options ?? {});
    const toolDefs = [
      {
        name: "get_action_info",
        title: "行动信息",
        inputSchema: { type: "object", properties: {} },
      },
    ];
    const ops = mcpOpsFrom(toolDefs);
    const { container, rerender, props } = renderPanel({
      activeOps: ops,
      op: ops[0],
      selectedId: toolDefs[0].name,
      toolDefs,
      currentTool: toolDefs[0],
    });

    expect(container.querySelector('[class*="epBusinessName"]')?.textContent).toBe(
      "行动类详情与参数",
    );
    await i18n.changeLanguage("en-US");
    translation.currentT = (key, options) => i18n.t(key, options ?? {});
    rerender(
      <MemoryRouter>
        <ContextLoaderIntegrationPanel {...props} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[class*="epBusinessName"]')?.textContent).toBe(
      "Action details and inputs",
    );
  });

  it.each(["zh-CN", "en-US"])(
    "renders the agreed groups and descriptions in %s",
    async (locale) => {
      const i18n = createInstance();
      await i18n.init({
        lng: locale,
        resources: {
          "zh-CN": { translation: { knowledgeNetwork: zh } },
          "en-US": { translation: { knowledgeNetwork: en } },
        },
      });
      translation.t.mockImplementation((key, options) => i18n.t(key, options ?? {}));
      const names = [
        "bkn_start_interaction",
        "search_schema",
        "query_object_instance",
        "execute_action",
        "list_skills",
        "execute_tool",
        "run_code",
        "bkn_eval_list_suites",
      ];
      const toolDefs = names.map((name) => ({
        name,
        inputSchema: { type: "object", properties: {} },
      }));
      const ops = mcpOpsFrom(toolDefs);
      const { container } = renderPanel({
        activeOps: ops,
        op: ops[0],
        selectedId: names[0],
        toolDefs,
        currentTool: toolDefs[0],
      });
      const keys = [
        "lifecycle",
        "discovery",
        "query",
        "action",
        "skill",
        "tool",
        "execution",
        "evaluation",
      ] as const;
      const groups = container.querySelectorAll('details[class*="toolTreeGroup"]');
      const expected =
        locale === "zh-CN" ? zh.contextLoaderPanel.toolGroups : en.contextLoaderPanel.toolGroups;

      expect(groups).toHaveLength(keys.length);
      keys.forEach((key, index) => {
        expect(groups[index].querySelector("summary span")?.textContent).toBe(expected[key].label);
        expect(groups[index].querySelector("div")?.textContent).toBe(expected[key].description);
      });
      expect(expected.query.label).toBe(
        locale === "zh-CN" ? "知识网络数据查询" : "Knowledge network data queries",
      );
      expect(expected.tool.label).toBe(locale === "zh-CN" ? "工具" : "Tools");
    },
  );
});

describe("ContextLoaderIntegrationPanel server instructions", () => {
  it("shows the endpoint's instructions in a dialog and copies them", () => {
    const onCopy = vi.fn();
    renderPanel({ mcpInstructions: "Call bkn_start_interaction first.", onCopy });

    fireEvent.click(
      screen.getByRole("button", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpInstructions.open",
      }),
    );

    expect(screen.getByText("Call bkn_start_interaction first.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /knowledgeNetwork\.contextLoaderPanel\.common\.copy/ }),
    );
    expect(onCopy).toHaveBeenCalledWith(
      "Call bkn_start_interaction first.",
      "knowledgeNetwork.contextLoaderPanel.mcpInstructions.copied",
    );
  });

  it("offers no instructions entry when the server sends none", () => {
    renderPanel({ mcpInstructions: undefined });

    expect(
      screen.queryByRole("button", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpInstructions.open",
      }),
    ).toBeNull();
  });
});

describe("ContextLoaderIntegrationPanel MCP connect guide", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to sign-in with a URL-only config and no API key entry", () => {
    renderPanel({ showMcpConnect: true });

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.claude.signIn"),
    ).toBeTruthy();
    expect(screen.queryByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeNull();
    // A domain name: assume a proper certificate until the user says otherwise.
    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned",
      }),
    ).toHaveProperty("checked", false);
    expect(
      screen.getByText(
        "claude mcp add --transport http --scope user bkn-agent-retrieval https://platform.example.com/api/agent-retrieval/v1/mcp/",
      ),
    ).toBeTruthy();
  });

  it("writes the steps for the selected client", () => {
    renderPanel({ showMcpConnect: true });

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.heading"),
    ).toBeTruthy();

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.claude.copy"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "WorkBuddy" }));
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.workbuddy.copy"),
    ).toBeTruthy();
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.workbuddy.signIn"),
    ).toBeTruthy();
    expect(
      screen.queryByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.claude.copy"),
    ).toBeNull();

    // With an API key there is no sign-in step, but the copy step still follows the client.
    fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.cursor.copy"),
    ).toBeTruthy();
    expect(
      screen.queryByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.cursor.signIn"),
    ).toBeNull();
  });

  it("falls back to the Claude Code steps when WorkBuddy is selected and API key is chosen", () => {
    renderPanel({ showMcpConnect: true });

    fireEvent.click(screen.getByRole("button", { name: "WorkBuddy" }));
    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.claude.copy"),
    ).toBeTruthy();
  });

  it("ticks the self-signed option by default for an IP address", () => {
    renderPanel({
      showMcpConnect: true,
      mcpUrl: "https://10.211.55.4/api/agent-retrieval/v1/mcp",
    });

    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned",
      }),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.oauthInsecureDescription"),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned",
      }),
    );
    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned",
      }),
    ).toHaveProperty("checked", false);
  });

  it("switches to the API Key mode and remembers the choice", () => {
    renderPanel({ showMcpConnect: true });

    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));

    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "WorkBuddy" })).toBeNull();
    expect(localStorage.getItem("bkn-mcp-connect-auth-mode")).toBe("apiKey");

    cleanup();
    renderPanel({ showMcpConnect: true });
    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeTruthy();
  });

  it("still renders when browser storage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderPanel({ showMcpConnect: true });
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.claude.signIn"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));
    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeTruthy();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("Eval MCP connect option", () => {
  afterEach(() => localStorage.clear());

  it("keeps the option disabled when the Eval service does not publish all five tools", async () => {
    renderPanel({ showMcpConnect: true });
    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpConnect.includeEval",
      }),
    ).toBeDisabled();
    expect(
      await screen.findByText("knowledgeNetwork.contextLoaderPanel.mcpConnect.evalUnavailable"),
    ).toBeVisible();
  });

  it.each(["oauth", "apiKey"])(
    "copies both services in %s mode and removes Eval when unchecked",
    async (authMode) => {
      localStorage.setItem("bkn-mcp-connect-auth-mode", authMode);
      vi.mocked(listMcpTools).mockResolvedValue(evalTools);
      const onCopy = vi.fn();
      renderPanel({ showMcpConnect: true, onCopy, appKeyValue: "bak_test" });
      const option = screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpConnect.includeEval",
      });
      await waitFor(() => expect(option).toBeEnabled());
      expect(option).not.toBeChecked();
      fireEvent.click(option);
      fireEvent.click(
        screen
          .getByText("knowledgeNetwork.contextLoaderPanel.mcpConnect.cliMultipleTitle")
          .parentElement!.querySelector("button")!,
      );
      const cli = onCopy.mock.calls.at(-1)![0] as string;
      expect(cli).toContain("bkn-agent-retrieval");
      expect(cli).toContain("bkn-eval");
      expect(cli).toContain("/api/bkn-backend/v1/eval/mcp/");
      for (const client of [
        "Cursor",
        "knowledgeNetwork.contextLoaderPanel.mcpConnect.genericTab",
      ]) {
        fireEvent.click(screen.getByRole("button", { name: client }));
        const title = client === "Cursor" ? "cursorConfigTitle" : "genericConfigTitle";
        fireEvent.click(
          screen
            .getByText(`knowledgeNetwork.contextLoaderPanel.mcpConnect.${title}`)
            .parentElement!.querySelector("button")!,
        );
        const copiedConfig = JSON.parse(onCopy.mock.calls.at(-1)![0] as string) as {
          mcpServers: Record<string, unknown>;
        };
        expect(Object.keys(copiedConfig.mcpServers)).toEqual(["bkn-agent-retrieval", "bkn-eval"]);
      }
      fireEvent.click(option);
      fireEvent.click(
        screen
          .getByText("knowledgeNetwork.contextLoaderPanel.mcpConnect.genericConfigTitle")
          .parentElement!.querySelector("button")!,
      );
      const copiedConfig = JSON.parse(onCopy.mock.calls.at(-1)![0] as string) as {
        mcpServers: Record<string, unknown>;
      };
      expect(Object.keys(copiedConfig.mcpServers)).toEqual(["bkn-agent-retrieval"]);
    },
  );
});

it("discovers Eval from its authenticated endpoint and retries failed discovery", async () => {
  const auth = { getToken: () => "session-token", refresh: vi.fn() };
  vi.mocked(listMcpTools).mockRejectedValueOnce(new Error("connection unavailable"));
  const { rerender, props } = renderPanel({ showMcpConnect: true, mcpAuth: auth });
  expect(
    await screen.findByText("knowledgeNetwork.contextLoaderPanel.mcpConnect.evalConnectionFailed"),
  ).toBeVisible();
  const latestAuth = { getToken: () => "new-session-token", refresh: vi.fn() };
  rerender(
    <MemoryRouter>
      <ContextLoaderIntegrationPanel {...props} mcpAuth={latestAuth} />
    </MemoryRouter>,
  );
  expect(listMcpTools).toHaveBeenCalledTimes(1);
  vi.mocked(listMcpTools).mockResolvedValue(evalTools);
  fireEvent.click(
    screen.getByRole("button", {
      name: "knowledgeNetwork.contextLoaderPanel.mcpConnect.evalRetry",
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpConnect.includeEval",
      }),
    ).toBeEnabled(),
  );
  expect(listMcpTools).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mcpEndpoint: `${window.location.origin}/api/bkn-backend/v1/eval/mcp/`,
      token: "new-session-token",
    }),
    latestAuth,
    expect.any(AbortSignal),
  );
});

it("preserves the selected Eval connection while credentials are edited", async () => {
  vi.mocked(listMcpTools).mockResolvedValue(evalTools);
  localStorage.setItem("bkn-mcp-connect-auth-mode", "apiKey");
  const onCopy = vi.fn();
  const { rerender, props } = renderPanel({
    showMcpConnect: true,
    appKeyValue: "bak_initial",
    mcpAuth: { getToken: () => "bak_initial" },
    onCopy,
  });
  const option = screen.getByRole("checkbox", {
    name: "knowledgeNetwork.contextLoaderPanel.mcpConnect.includeEval",
  });
  await waitFor(() => expect(option).toBeEnabled());
  fireEvent.click(option);
  for (const key of ["bak_changed", "bak_changed_again"]) {
    rerender(
      <MemoryRouter>
        <ContextLoaderIntegrationPanel
          {...props}
          appKeyValue={key}
          mcpAuth={{ getToken: () => key }}
        />
      </MemoryRouter>,
    );
  }
  expect(listMcpTools).toHaveBeenCalledTimes(1);
  expect(option).toBeEnabled();
  expect(option).toBeChecked();
  fireEvent.click(
    screen
      .getByText("knowledgeNetwork.contextLoaderPanel.mcpConnect.cliMultipleTitle")
      .parentElement!.querySelector("button")!,
  );
  expect(onCopy.mock.calls.at(-1)?.[0]).toContain("bkn-eval");
});
