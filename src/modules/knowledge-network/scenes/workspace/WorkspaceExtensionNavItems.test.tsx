/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";
import { WorkspaceExtensionNavItems } from "@/modules/knowledge-network/scenes/workspace/WorkspaceExtensionNavItems";

afterEach(() => {
  resetExtensionsForTesting();
  vi.restoreAllMocks();
});

function registerGraphExplorer() {
  registerExtension({
    capability: "graph_explorer",
    id: "graph-explorer",
    workspaceNavItems: [
      {
        icon: <span data-testid="graph-explorer-icon" />,
        id: "graph-explorer",
        labelKey: "knowledgeNetwork.graphExplorer.openAction",
        path: (networkId) => `/knowledge-network/workspace/${networkId}/graph-explorer`,
      },
    ],
  });
}

function renderItems(collapsed = false) {
  render(
    <MemoryRouter basename="/studio" initialEntries={["/studio"]}>
      <WorkspaceExtensionNavItems collapsed={collapsed} networkId="network-1" />
    </MemoryRouter>,
  );
}

describe("WorkspaceExtensionNavItems", () => {
  it("renders nothing when no build registered a page", () => {
    renderItems();

    expect(screen.queryByTestId(/^workspace-nav-/)).toBeNull();
  });

  it("leaves out overview buttons the extension did not also offer here", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "graph-explorer",
      workspaceActions: [
        {
          id: "graph-explorer",
          labelKey: "knowledgeNetwork.graphExplorer.openAction",
          path: (networkId) => `/knowledge-network/workspace/${networkId}/graph-explorer`,
        },
      ],
    });
    renderItems();

    expect(screen.queryByTestId(/^workspace-nav-/)).toBeNull();
  });

  it("opens a registered page for this network in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    registerGraphExplorer();
    renderItems();

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.graphExplorer.openAction" }),
    );

    expect(open).toHaveBeenCalledWith(
      "/studio/knowledge-network/workspace/network-1/graph-explorer",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("keeps only the icon when the sidebar is collapsed", () => {
    registerGraphExplorer();
    renderItems(true);

    const item = screen.getByTestId("workspace-nav-graph-explorer");
    expect(screen.getByTestId("graph-explorer-icon")).toBeTruthy();
    expect(item.textContent).toBe("");
    expect(item.getAttribute("title")).toBe("knowledgeNetwork.graphExplorer.openAction");
  });
});
