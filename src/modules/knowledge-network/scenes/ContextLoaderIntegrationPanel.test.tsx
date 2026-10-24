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

import { ContextLoaderIntegrationPanel } from "./ContextLoaderIntegrationPanel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
  render(
    <MemoryRouter>
      <ContextLoaderIntegrationPanel {...props} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
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

    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepSignIn")).toBeTruthy();
    expect(screen.queryByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeNull();
    // A domain name: assume a proper certificate until the user says otherwise.
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
    expect(
      screen.getByText(
        "claude mcp add --transport http --scope user bkn-agent-retrieval https://platform.example.com/api/agent-retrieval/v1/mcp/",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "WorkBuddy" }));
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.workbuddyHint"),
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
    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepSignIn")).toBeTruthy();
    fireEvent.click(screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey"));
    expect(screen.getByText("knowledgeNetwork.contextLoaderPanel.appKey.issue")).toBeTruthy();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
