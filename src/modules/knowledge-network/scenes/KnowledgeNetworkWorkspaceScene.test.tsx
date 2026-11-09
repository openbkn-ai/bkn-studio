/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Entitlement } from "@/framework/entitlement/types";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

const mocks = vi.hoisted(() => ({
  extensionEntries: { items: [] as unknown[], upgrades: [] as unknown[] },
  hiddenNavigation: [] as string[],
  navigate: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) =>
        ({
          "common.entitlement.editions.professional": "专业版",
          "common.entitlement.editionsShort.professional": "专业版",
          "knowledgeNetwork.workspaceExperienceAgent": "智能问答",
          "knowledgeNetwork.workspaceExperienceCypher": "数据查询",
          "knowledgeNetwork.workspaceExperienceMcp": "MCP 调试",
          "knowledgeNetwork.workspaceFunctions": "函数",
          "knowledgeNetwork.workspaceKnowledgeBases": "知识库",
          "knowledgeNetwork.workspaceMcpTools": "MCP 资源",
          "knowledgeNetwork.workspaceMetrics": "对象指标",
        })[key] ?? key,
    }),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...actual,
    useLocation: () => ({ pathname: "/knowledge-network/workspace/network-1/overview" }),
    useNavigate: () => mocks.navigate,
    useParams: () => ({ networkId: "network-1" }),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() } }),
}));

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ hiddenNavigation: mocks.hiddenNavigation }),
}));

vi.mock("@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal", () => ({
  KnowledgeNetworkFormModal: () => null,
}));

vi.mock("@/modules/knowledge-network/scenes/ExperienceScene", () => ({
  ExperienceScene: () => null,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/WorkspaceExtensionNavItems", () => ({
  WorkspaceExtensionNavItems: () => null,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries", () => ({
  visibleWorkspaceExtensionEntries: () => mocks.extensionEntries,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection", () => ({
  WorkspaceOverviewSection: () => <div />,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/WorkspaceResourceSection", () => ({
  WorkspaceResourceSection: () => <div />,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/useWorkspaceData", () => ({
  useWorkspaceData: () => ({
    detail: null,
    detailError: null,
    detailLoading: false,
    loadRecentObjects: vi.fn(),
    loadWorkspaceData: vi.fn(),
    recentLoading: false,
    recentObjects: [],
    sectionError: null,
  }),
}));

vi.mock("@/modules/knowledge-network/utils/record-operations", () => ({
  hasKnowledgeNetworkRecordOperation: () => false,
}));

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

function renderScene(snapshot: Entitlement) {
  render(
    <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
      <KnowledgeNetworkWorkspaceScene networkId="network-1" section="overview" />
    </EntitlementContext.Provider>,
  );
}

describe("KnowledgeNetworkWorkspaceScene object metric navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it("opens the upgrade dialog without a count when object metrics are not installed", () => {
    renderScene(entitlement());

    const entry = screen.getByRole("button", { name: /对象指标/ });
    expect(within(entry).getByText("专业版")).toBeTruthy();
    expect(within(entry).queryByText("0")).toBeNull();

    fireEvent.click(entry);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("opens the upgrade dialog without a count when object metrics are not licensed", () => {
    renderScene(
      entitlement({
        extensions: [CAPABILITIES.OBJECT_METRICS],
      }),
    );

    const entry = screen.getByRole("button", { name: /对象指标/ });
    expect(within(entry).getByText("专业版")).toBeTruthy();
    expect(within(entry).queryByText("0")).toBeNull();

    fireEvent.click(entry);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("navigates with a count and no badge when object metrics are available", () => {
    renderScene(
      entitlement({
        capabilities: [CAPABILITIES.OBJECT_METRICS],
        edition: "professional",
        extensions: [CAPABILITIES.OBJECT_METRICS],
        licensed: true,
        state: "valid",
      }),
    );

    const entry = screen.getByRole("button", { name: /对象指标/ });
    expect(within(entry).queryByText("专业版")).toBeNull();
    expect(within(entry).getByText("0")).toBeTruthy();

    fireEvent.click(entry);

    expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/metrics");
  });
});

describe("KnowledgeNetworkWorkspaceScene knowledge-base navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it("names no knowledge base in the community image", () => {
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: /知识库/ })).toBeNull();
  });

  it("marks the entry as professional without the license, and opens the masked section", () => {
    renderScene(entitlement({ extensions: [CAPABILITIES.KNOWLEDGE_BASE] }));

    const entry = screen.getByRole("button", { name: /知识库/ });
    expect(within(entry).getByText("专业版")).toBeTruthy();

    fireEvent.click(entry);

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/knowledge-bases",
    );
  });

  it("opens the section when the knowledge base is licensed", () => {
    renderScene(
      entitlement({
        capabilities: [CAPABILITIES.KNOWLEDGE_BASE],
        edition: "professional",
        extensions: [CAPABILITIES.KNOWLEDGE_BASE],
        licensed: true,
        state: "valid",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /知识库/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/knowledge-bases",
    );
  });
});

describe("KnowledgeNetworkWorkspaceScene MCP navigation", () => {
  it("removes the standalone debugger entry while keeping MCP resource management", () => {
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: "MCP 调试" })).toBeNull();
    expect(screen.getByRole("button", { name: /MCP 资源/ })).toBeTruthy();
  });
});

describe("KnowledgeNetworkWorkspaceScene hidden navigation", () => {
  beforeEach(() => {
    mocks.extensionEntries = { items: [], upgrades: [] };
    mocks.hiddenNavigation = [];
  });

  it("shows every workspace entry by default", () => {
    renderScene(entitlement());

    expect(screen.getByRole("button", { name: /智能问答/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /函数/ })).toBeTruthy();
  });

  it("leaves out the entries the deployment hides and keeps the rest", () => {
    mocks.hiddenNavigation = ["experience-agent", "functions"];
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: /智能问答/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /函数/ })).toBeNull();
    expect(screen.getByRole("button", { name: /数据查询/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /MCP 资源/ })).toBeTruthy();
  });

  it("drops the title of a group whose entries are all hidden", () => {
    mocks.hiddenNavigation = ["concept-groups", "object-types", "relation-types", "action-types"];
    renderScene(entitlement());

    expect(screen.queryByText("knowledgeNetwork.workspaceConceptModel")).toBeNull();
    expect(screen.getByText("knowledgeNetwork.workspaceAbilityVerification")).toBeTruthy();
  });

  it("keeps the ability verification title while an extension entry is still shown", () => {
    mocks.hiddenNavigation = ["experience-agent", "experience-cypher"];
    mocks.extensionEntries = { items: [], upgrades: [{ capability: "graph_explorer" }] };
    renderScene(entitlement());
    expect(screen.getByText("knowledgeNetwork.workspaceAbilityVerification")).toBeTruthy();

    cleanup();
    mocks.extensionEntries = { items: [], upgrades: [] };
    renderScene(entitlement());
    expect(screen.queryByText("knowledgeNetwork.workspaceAbilityVerification")).toBeNull();
  });
});
