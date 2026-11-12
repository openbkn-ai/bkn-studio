/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";

import { contextLoaderPanelPart as zh } from "../locales/zh-CN/context-loader-panel";
import { contextLoaderPanelPart as en } from "../locales/en-US/context-loader-panel";
import { mcpOpsFrom } from "../services/context-loader.service";

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
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
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

    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.oauthInsecureDescription"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
  });

  it("switches to the API Key mode and remembers the choice", () => {
    renderPanel({ showMcpConnect: true });

    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));

    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
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
