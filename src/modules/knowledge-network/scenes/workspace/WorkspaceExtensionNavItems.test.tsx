/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import type { Entitlement } from "@/framework/entitlement/types";
import {
  extensionWorkspaceNavItems,
  registerExtension,
  resetExtensionsForTesting,
} from "@/framework/extension/registry";
import { WorkspaceExtensionNavItems } from "@/modules/knowledge-network/scenes/workspace/WorkspaceExtensionNavItems";
import { visibleWorkspaceExtensionEntries } from "@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries";

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

function ReturnToProbe() {
  const { state } = useLocation() as { state: { returnTo?: string } | null };
  return <div data-testid="return-to">{state?.returnTo}</div>;
}

describe("WorkspaceExtensionNavItems", () => {
  it("names the graph explorer with its edition and offers the upgrade when no build has it", async () => {
    renderItems();

    const entry = screen.getByTestId("workspace-nav-upgrade-graph_explorer");
    expect(entry.textContent).toContain("knowledgeNetwork.workspaceGraphExplorer");
    fireEvent.click(entry);

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("asks for the enterprise frontend image, not a purchase, when the licence covers the page", async () => {
    // An enterprise backend that has the graph explorer, reached from a community frontend.
    const snapshot: Entitlement = {
      capabilities: ["graph_explorer"],
      edition: "enterprise",
      extensions: ["graph_explorer"],
      features: [],
      licensed: true,
      limits: {},
      state: "valid",
    };
    render(
      <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
        <MemoryRouter basename="/studio" initialEntries={["/studio"]}>
          <WorkspaceExtensionNavItems collapsed={false} networkId="network-1" />
        </MemoryRouter>
      </EntitlementContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("workspace-nav-upgrade-graph_explorer"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("common.entitlement.imageMissingTitle");
    expect(dialog.textContent).not.toContain("common.entitlement.upgradeTo");
  });

  it("leaves out the entries the deployment hides, by entry key and by capability", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "graph-explorer",
      workspaceNavItems: [
        {
          id: "graph-explorer",
          labelKey: "knowledgeNetwork.graphExplorer.openAction",
          path: (networkId) => `/knowledge-network/workspace/${networkId}/graph-explorer`,
        },
      ],
    });
    render(
      <MemoryRouter basename="/studio" initialEntries={["/studio"]}>
        <WorkspaceExtensionNavItems
          collapsed={false}
          hiddenKeys={["graph-explorer:graph-explorer"]}
          networkId="network-1"
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("workspace-nav-graph-explorer")).toBeNull();

    resetExtensionsForTesting();
    expect(visibleWorkspaceExtensionEntries(["graph_explorer"]).upgrades).toEqual([]);
    expect(visibleWorkspaceExtensionEntries().upgrades).toHaveLength(1);
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

  it("opens a registered page for this network in place, naming the workspace as the way back", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    registerGraphExplorer();
    render(
      <MemoryRouter
        basename="/studio"
        initialEntries={["/studio/knowledge-network/workspace/network-1/experience?tab=mcp"]}
      >
        <Routes>
          <Route
            element={<WorkspaceExtensionNavItems collapsed={false} networkId="network-1" />}
            path="/knowledge-network/workspace/:networkId/experience"
          />
          <Route
            element={<ReturnToProbe />}
            path="/knowledge-network/workspace/:networkId/graph-explorer"
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.graphExplorer.openAction" }),
    );

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByTestId("return-to").textContent).toBe(
      "/knowledge-network/workspace/network-1/experience?tab=mcp",
    );
  });

  it("opens an entry whose page the workspace shows without a way back, and marks it as current", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "analysis-canvas",
      workspaceNavItems: [
        {
          id: "analyses",
          labelKey: "analyses",
          page: {
            component: () => null,
            route: "/knowledge-network/workspace/:networkId/analyses",
          },
          path: (networkId) => `/knowledge-network/workspace/${networkId}/analyses`,
          section: "analysis",
        },
      ],
    });
    render(
      <MemoryRouter
        basename="/studio"
        initialEntries={["/studio/knowledge-network/workspace/network-1/overview"]}
      >
        <Routes>
          <Route
            element={
              <WorkspaceExtensionNavItems
                activeKey="analysis-canvas:other"
                collapsed={false}
                networkId="network-1"
                section="analysis"
              />
            }
            path="/knowledge-network/workspace/:networkId/overview"
          />
          <Route
            element={
              <>
                <WorkspaceExtensionNavItems
                  activeKey="analysis-canvas:analyses"
                  collapsed={false}
                  networkId="network-1"
                  section="analysis"
                />
                <ReturnToProbe />
              </>
            }
            path="/knowledge-network/workspace/:networkId/analyses"
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("workspace-nav-analyses").getAttribute("aria-current")).toBeNull();
    fireEvent.click(screen.getByTestId("workspace-nav-analyses"));

    expect(screen.getByTestId("return-to").textContent).toBe("");
    expect(screen.getByTestId("workspace-nav-analyses").getAttribute("aria-current")).toBe("page");
  });

  it("leaves the upgrade entry out when the build has the page", () => {
    registerGraphExplorer();
    renderItems();

    expect(screen.getByTestId("workspace-nav-graph-explorer")).toBeTruthy();
    expect(screen.queryByTestId("workspace-nav-upgrade-graph_explorer")).toBeNull();
  });

  it("lists an entry registered for analysis in that group alone, and the group only then", () => {
    registerGraphExplorer();
    expect(extensionWorkspaceNavItems("analysis")).toEqual([]);
    registerExtension({
      capability: "graph_explorer",
      id: "analysis-canvas",
      workspaceNavItems: [
        {
          id: "analyses",
          labelKey: "knowledgeNetwork.graphExplorer.investigation.entry",
          path: (networkId) => `/knowledge-network/workspace/${networkId}/analyses`,
          section: "analysis",
        },
      ],
    });
    expect(extensionWorkspaceNavItems("analysis").map((item) => item.id)).toEqual(["analyses"]);

    renderItems();
    // Under ability verification: the explorer, not the analysis entry.
    expect(screen.getByTestId("workspace-nav-graph-explorer")).toBeTruthy();
    expect(screen.queryByTestId("workspace-nav-analyses")).toBeNull();
    render(
      <MemoryRouter basename="/studio" initialEntries={["/studio"]}>
        <div data-testid="analysis-group">
          <WorkspaceExtensionNavItems collapsed={false} networkId="network-1" section="analysis" />
        </div>
      </MemoryRouter>,
    );
    const group = screen.getByTestId("analysis-group");
    expect(within(group).getByTestId("workspace-nav-analyses")).toBeTruthy();
    expect(within(group).queryByTestId("workspace-nav-graph-explorer")).toBeNull();
    expect(within(group).queryByTestId(/^workspace-nav-upgrade-/)).toBeNull();
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
