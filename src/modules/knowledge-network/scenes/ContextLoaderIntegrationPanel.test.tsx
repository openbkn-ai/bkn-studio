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
