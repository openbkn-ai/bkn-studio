/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Entitlement } from "@/framework/entitlement/types";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) =>
        ({
          "common.entitlement.editions.professional": "专业版",
          "common.entitlement.editionsShort.professional": "专业版",
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
    useNavigate: () => vi.fn(),
    useParams: () => ({ networkId: "network-1" }),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() } }),
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
  it("keeps the object metric entry visible with a Professional badge in Community", () => {
    renderScene(entitlement());

    const entry = screen.getByRole("button", { name: /对象指标/ });
    expect(within(entry).getByText("专业版")).toBeTruthy();
  });

  it("keeps the entry and hides the badge when object metrics are available", () => {
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
  });
});
