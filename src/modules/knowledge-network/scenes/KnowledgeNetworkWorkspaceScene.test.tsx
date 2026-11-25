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
import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

const mocks = vi.hoisted(() => {
  const noDetail: unknown = null;
  return {
    evalAccess: vi.fn(),
    evalAccessStatus: "allowed",
    evalReportedByEndpoint: false,
    extensionEntries: { items: [] as unknown[], upgrades: [] as unknown[] },
    hiddenNavigation: [] as string[],
    navigate: vi.fn(),
    pathname: "/knowledge-network/workspace/network-1/overview",
    detail: noDetail,
  };
});

vi.mock("@/modules/subscription/capability-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/subscription/capability-catalog")>();
  return {
    ...actual,
    capabilityReportedByEndpoint: (capability: string) =>
      capability === CAPABILITIES.EVAL
        ? mocks.evalReportedByEndpoint
        : actual.capabilityReportedByEndpoint(capability),
  };
});

vi.mock("../eval/useEvalAccess", () => ({
  useEvalAccess: (networkId: string) => {
    mocks.evalAccess(networkId);
    return { status: mocks.evalAccessStatus, retry: vi.fn() };
  },
}));

beforeEach(() => {
  mocks.evalAccess.mockClear();
  mocks.evalAccessStatus = "allowed";
  mocks.evalReportedByEndpoint = false;
  mocks.hiddenNavigation = [];
  mocks.navigate.mockReset();
  mocks.pathname = "/knowledge-network/workspace/network-1/overview";
});
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) =>
        ({
          "common.entitlement.editions.professional": "专业版",
          "common.entitlement.editionsShort.professional": "专业版",
          "common.entitlement.editionsShort.enterprise": "企业版",
          "knowledgeNetwork.workspaceExperienceAgent": "智能问答",
          "knowledgeNetwork.workspaceExperienceCypher": "数据查询",
          "knowledgeNetwork.workspaceExperienceMcp": "MCP 调试",
          "knowledgeNetwork.eval.title": "质量评测",
          "knowledgeNetwork.evalNav": "评测",
          "knowledgeNetwork.versions.nav": "版本管理",
          "knowledgeNetwork.riskActionControlNav": "行动管控",
          "knowledgeNetwork.riskActionPending": "待实现",
          "knowledgeNetwork.permissionMatrix.nav": "权限管控",
          "knowledgeNetwork.workspaceActionTypes": "行动类",
          "knowledgeNetwork.workspaceFunctions": "函数",
          "knowledgeNetwork.workspaceApis": "API",
          "knowledgeNetwork.workspaceIndependentActionTypes": "独立行动类",
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
    useLocation: () => ({ pathname: mocks.pathname }),
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
  ExperienceScene: () => <div data-testid="experience-content" />,
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
  WorkspaceResourceSection: () => <div data-testid="resource-content" />,
}));

vi.mock("@/modules/knowledge-network/scenes/workspace/useWorkspaceData", () => ({
  useWorkspaceData: () => ({
    detail: mocks.detail,
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

function renderScene(snapshot: Entitlement, expandGroups = true) {
  render(
    <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
      <KnowledgeNetworkWorkspaceScene networkId="network-1" section="overview" />
    </EntitlementContext.Provider>,
  );
  if (expandGroups) {
    for (const name of [
      "knowledgeNetwork.workspaceAbilityVerification",
      "knowledgeNetwork.workspaceConceptModel",
      "knowledgeNetwork.workspaceDynamicModel",
      "knowledgeNetwork.workspaceRiskControl",
    ]) {
      const group = screen.queryByRole("button", { name });
      if (group) fireEvent.click(group);
    }
  }
}

describe("KnowledgeNetworkWorkspaceScene sidebar groups", () => {
  it("starts collapsed on overview and toggles each group independently", () => {
    renderScene(entitlement({ edition: "enterprise", licensed: true }), false);

    const verification = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceAbilityVerification",
    });
    const concept = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceConceptModel",
    });
    const dynamic = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceDynamicModel",
    });
    const governance = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceRiskControl",
    });
    expect(
      Array.from(
        screen.getByRole("complementary").querySelectorAll("button[aria-expanded]"),
        (button) => button.textContent?.trim(),
      ),
    ).toEqual([
      "knowledgeNetwork.workspaceConceptModel",
      "knowledgeNetwork.workspaceDynamicModel",
      "knowledgeNetwork.workspaceAbilityVerification",
      "knowledgeNetwork.workspaceRiskControl",
    ]);
    for (const group of [verification, concept, dynamic, governance]) {
      expect(group).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.queryByRole("button", { name: /智能问答/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /workspaceObjectTypes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /行动类/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /评测/ })).toBeNull();
    expect(screen.getByTitle("版本管理").previousElementSibling).toBe(
      screen.getByTitle("knowledgeNetwork.workspaceOverviewShort"),
    );
    expect(screen.queryByTitle("权限管控")).toBeNull();
    expect(screen.queryByTitle("knowledgeNetwork.appDevelopment.nav")).toBeNull();

    fireEvent.click(verification);
    expect(verification.nextElementSibling?.lastElementChild).toBe(screen.getByTitle("评测"));
    fireEvent.click(verification);

    fireEvent.click(concept);
    expect(concept).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /workspaceObjectTypes/ })).toBeTruthy();
    expect(verification).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(concept);
    expect(screen.queryByRole("button", { name: /workspaceObjectTypes/ })).toBeNull();
  });

  it("keeps only access control and action control under risk control", () => {
    renderScene(entitlement({ edition: "enterprise", licensed: true }), false);

    const governance = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceRiskControl",
    });
    fireEvent.click(governance);
    const entries = governance.nextElementSibling?.querySelectorAll("button");
    expect(Array.from(entries ?? [], (entry) => entry.title)).toEqual([
      "权限管控",
      "行动管控 · 待实现",
    ]);
    expect(screen.getByTitle("行动管控 · 待实现")).toBeDisabled();
    fireEvent.click(screen.getByTitle("行动管控 · 待实现"));
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("权限管控"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/permissions",
    );
  });

  it("places evaluation under ability verification and version management below overview", () => {
    renderScene(entitlement(), false);

    const verification = screen.getByRole("button", {
      name: "knowledgeNetwork.workspaceAbilityVerification",
    });
    fireEvent.click(verification);
    const entries = verification.nextElementSibling?.querySelectorAll("button");
    expect(Array.from(entries ?? [], (entry) => entry.title)).toEqual([
      "智能问答",
      "数据查询",
      "knowledgeNetwork.appDevelopment.nav",
      "评测",
    ]);
    fireEvent.click(screen.getByTitle("版本管理"));
    expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/versions");
  });

  it.each([
    ["experience-agent", "workspaceAbilityVerification", /智能问答/],
    ["develop", "workspaceAbilityVerification", /knowledgeNetwork.appDevelopment.nav/],
    ["object-types", "workspaceConceptModel", /workspaceObjectTypes/],
    ["action-types", "workspaceDynamicModel", /行动类/],
    ["evals", "workspaceAbilityVerification", /评测/],
  ] as const)("expands the active %s group", (section, groupName, entryName) => {
    render(
      <EntitlementContext.Provider
        value={{ loading: false, refresh: async () => {}, snapshot: entitlement() }}
      >
        <KnowledgeNetworkWorkspaceScene networkId="network-1" section={section} />
      </EntitlementContext.Provider>,
    );
    expect(screen.getByRole("button", { name: `knowledgeNetwork.${groupName}` })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: entryName })).toBeTruthy();
  });

  it("highlights version management without expanding a group", () => {
    render(
      <EntitlementContext.Provider
        value={{
          loading: false,
          refresh: async () => {},
          snapshot: entitlement({ edition: "enterprise", licensed: true }),
        }}
      >
        <KnowledgeNetworkWorkspaceScene networkId="network-1" section="versions" />
      </EntitlementContext.Provider>,
    );
    expect(screen.getByTitle("版本管理").className).toMatch(/sideItemActive/);
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.workspaceAbilityVerification" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.workspaceRiskControl" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

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

describe("KnowledgeNetworkWorkspaceScene Eval navigation", () => {
  it.each([
    { name: "community image", overrides: {} },
    { name: "unlicensed EE image", overrides: { extensions: [CAPABILITIES.EVAL] } },
    { name: "expired Professional license", overrides: { edition: "professional" as const } },
  ])("shows a Professional entry and upgrade dialog in the $name", ({ overrides }) => {
    mocks.evalAccessStatus = "failed";
    renderScene(entitlement(overrides));

    const entry = screen.getByRole("button", { name: /评测/ });
    expect(within(entry).getByText("专业版")).toBeTruthy();
    expect(mocks.evalAccess).not.toHaveBeenCalled();

    fireEvent.click(entry);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("subscription.capabilities.eval.description")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it.each(["professional", "enterprise"] as const)(
    "opens licensed %s Eval without a badge even when Safe does not report the capability",
    (edition) => {
      renderScene(entitlement({ edition, licensed: true, state: "valid" }));

      const entry = screen.getByRole("button", { name: /评测/ });
      expect(within(entry).queryByText("专业版")).toBeNull();
      expect(mocks.evalAccess).not.toHaveBeenCalled();

      fireEvent.click(entry);

      expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/evals");
    },
  );

  it.each([
    ["professional", "denied"],
    ["professional", "failed"],
    ["professional", "loading"],
    ["enterprise", "denied"],
    ["enterprise", "failed"],
    ["enterprise", "loading"],
  ] as const)("keeps the %s entry visible when admission is %s", (edition, status) => {
    mocks.evalAccessStatus = status;
    renderScene(entitlement({ edition, licensed: true, state: "valid" }));

    const entry = screen.getByRole("button", { name: /评测/ });
    expect(within(entry).queryByText("专业版")).toBeNull();
    expect(mocks.evalAccess).not.toHaveBeenCalled();
    fireEvent.click(entry);
    expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/evals");
  });

  it("respects deployment-hidden Eval in the community edition", () => {
    mocks.hiddenNavigation = ["evals"];
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: /评测/ })).toBeNull();
  });

  it.each([
    ["professional", false],
    ["professional", true],
    ["enterprise", false],
    ["enterprise", true],
  ] as const)(
    "aligns the %s upgrade action and badge when endpoint-reported Eval availability is %s",
    (edition, available) => {
      mocks.evalReportedByEndpoint = true;
      renderScene(
        entitlement({
          edition,
          licensed: true,
          state: "valid",
          extensions: [CAPABILITIES.EVAL],
          capabilities: available ? [CAPABILITIES.EVAL] : [],
        }),
      );

      const entry = screen.getByRole("button", { name: /评测/ });
      expect(Boolean(within(entry).queryByText("专业版"))).toBe(!available);
      fireEvent.click(entry);

      if (available) {
        expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/evals");
        expect(screen.queryByRole("dialog")).toBeNull();
      } else {
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(mocks.navigate).not.toHaveBeenCalled();
      }
    },
  );
});

describe("KnowledgeNetworkWorkspaceScene knowledge-base navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it("names no knowledge base in the community image", () => {
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: /知识库/ })).toBeNull();
  });

  it.each([false, true])(
    "has no knowledge-base management entry when installed (licensed=%s)",
    (licensed) => {
      renderScene(
        entitlement({
          capabilities: licensed ? [CAPABILITIES.KNOWLEDGE_BASE] : [],
          edition: "professional",
          extensions: [CAPABILITIES.KNOWLEDGE_BASE],
          licensed,
          state: "valid",
        }),
      );
      expect(screen.queryByRole("button", { name: /知识库/ })).toBeNull();
      expect(screen.getByRole("button", { name: /knowledgeNetwork.workspaceSkills/ })).toBeTruthy();
    },
  );
});

describe("KnowledgeNetworkWorkspaceScene action capability navigation", () => {
  it("keeps action types and mounted execution resources as separate entries", () => {
    renderScene(entitlement());

    expect(screen.queryByRole("button", { name: "MCP 调试" })).toBeNull();
    const actionEntry = screen.getByRole("button", { name: /行动类/ });
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.workspaceDynamicModel" })
        .nextElementSibling?.firstElementChild,
    ).toBe(actionEntry);
    expect(screen.getByRole("button", { name: /函数/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /API/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /MCP 资源/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /独立行动类/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /MCP 资源/ }));
    expect(mocks.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/mcp");
  });
});

describe("KnowledgeNetworkWorkspaceScene event class navigation", () => {
  it("offers event classes under the dynamic model, after action types, with a Professional licence", () => {
    renderScene(entitlement({ edition: "professional", licensed: true, state: "valid" }));

    const entry = screen.getByRole("button", { name: "knowledgeNetwork.eventClasses.nav" });
    expect(screen.getByRole("button", { name: /行动类/ }).nextElementSibling).toBe(entry);

    fireEvent.click(entry);
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/event-classes",
    );
  });

  it("counts the event classes the network's statistics report", () => {
    mocks.detail = { id: "network-1", statistics: { eventClassesTotal: 3 } };
    try {
      renderScene(entitlement({ edition: "professional", licensed: true, state: "valid" }));

      const entry = screen.getByRole("button", { name: /knowledgeNetwork\.eventClasses\.nav/ });
      expect(within(entry).getByText("3")).toBeTruthy();
    } finally {
      mocks.detail = null;
    }
  });

  it.each([
    { name: "the community edition", overrides: {} },
    { name: "an expired Professional licence", overrides: { edition: "professional" as const } },
  ])("does not offer event classes in $name", ({ overrides }) => {
    renderScene(entitlement(overrides));

    expect(screen.getByRole("button", { name: /行动类/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "knowledgeNetwork.eventClasses.nav" })).toBeNull();
  });
});

describe("KnowledgeNetworkWorkspaceScene resource list padding", () => {
  // Each list panel pads itself; a padded section around it would double the gutter.
  it.each([
    "concept-groups",
    "object-types",
    "relation-types",
    "action-types",
    "event-classes",
  ] as const)("lays the %s list flush against the workspace", async (section) => {
    render(
      <EntitlementContext.Provider
        value={{ loading: false, refresh: async () => {}, snapshot: entitlement() }}
      >
        <KnowledgeNetworkWorkspaceScene networkId="network-1" section={section} />
      </EntitlementContext.Provider>,
    );

    const content = await screen.findByTestId("resource-content");
    expect(content.parentElement?.className).toMatch(/workspaceSectionFlush/);
  });
});

describe("KnowledgeNetworkWorkspaceScene hidden navigation", () => {
  beforeEach(() => {
    mocks.extensionEntries = { items: [], upgrades: [] };
    mocks.hiddenNavigation = [];
  });

  it("shows workspace entries that remain network-level", () => {
    renderScene(entitlement());

    expect(screen.getByRole("button", { name: /智能问答/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /评测/ })).toBeTruthy();
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
    mocks.hiddenNavigation = ["concept-groups", "object-types", "relation-types"];
    renderScene(entitlement());

    expect(screen.queryByText("knowledgeNetwork.workspaceConceptModel")).toBeNull();
    expect(screen.getByRole("button", { name: /行动类/ })).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.workspaceAbilityVerification")).toBeTruthy();
  });

  it("hides the verification group when all its entries are hidden", () => {
    mocks.hiddenNavigation = ["experience-agent", "experience-cypher", "develop", "evals"];
    renderScene(entitlement({ edition: "enterprise", licensed: true }));

    expect(
      screen.queryByRole("button", { name: "knowledgeNetwork.workspaceAbilityVerification" }),
    ).toBeNull();
    expect(screen.getByTitle("版本管理")).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.workspaceRiskControl")).toBeTruthy();
  });

  it("drops risk control when all its entries are hidden", () => {
    mocks.hiddenNavigation = ["permissions", "action-control"];
    renderScene(entitlement({ edition: "enterprise", licensed: true }));

    expect(
      screen.queryByRole("button", { name: "knowledgeNetwork.workspaceRiskControl" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /智能问答/ })).toBeTruthy();
  });

  it.each(["community", "professional"] as const)(
    "shows Enterprise risk controls on %s",
    (edition) => {
      renderScene(entitlement({ edition, licensed: true }));
      expect(
        screen.getByRole("button", { name: "knowledgeNetwork.workspaceRiskControl" }),
      ).toHaveAttribute("aria-expanded", "true");
      for (const label of ["权限管控", "行动管控"]) {
        expect(screen.getByTitle(label)).toHaveTextContent("企业版");
      }
      fireEvent.click(screen.getByTitle("行动管控"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );

  // Draft and running version are community, so the entry stays open; the Enterprise badge marks the
  // full history until an Enterprise licence is in force.
  it.each([
    ["community", false],
    ["professional", true],
    ["enterprise", false],
  ] as const)(
    "marks version management as Enterprise on %s (licensed: %s)",
    (edition, licensed) => {
      renderScene(entitlement({ edition, licensed }));
      const item = screen.getByTitle("版本管理");

      expect(item).toHaveTextContent("企业版");
      fireEvent.click(item);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/knowledge-network/workspace/network-1/versions",
      );
    },
  );

  it.each(["enterprise", "industry"] as const)(
    "drops the version management badge once %s is licensed",
    (edition) => {
      renderScene(entitlement({ edition, licensed: true, state: "valid" }));

      expect(screen.getByTitle("版本管理")).not.toHaveTextContent("企业版");
    },
  );

  it("keeps the ability verification title while an extension entry is still shown", () => {
    mocks.hiddenNavigation = ["experience-agent", "experience-cypher", "develop", "evals"];
    mocks.extensionEntries = { items: [], upgrades: [{ capability: "graph_explorer" }] };
    renderScene(entitlement());
    expect(screen.getByText("knowledgeNetwork.workspaceAbilityVerification")).toBeTruthy();

    cleanup();
    mocks.extensionEntries = { items: [], upgrades: [] };
    renderScene(entitlement());
    expect(screen.queryByText("knowledgeNetwork.workspaceAbilityVerification")).toBeNull();
  });
});

describe("KnowledgeNetworkWorkspaceScene extension pages", () => {
  beforeEach(() => {
    resetExtensionsForTesting();
    mocks.extensionEntries = { items: [], upgrades: [] };
  });

  it("shows the page of the entry it is opened for, beside the sidebar", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "analysis-canvas",
      workspaceNavItems: [
        {
          id: "analyses",
          labelKey: "analyses",
          page: {
            component: () => <p>analysis list</p>,
            route: "/knowledge-network/workspace/:networkId/analyses",
          },
          path: (networkId) => `/knowledge-network/workspace/${networkId}/analyses`,
          section: "analysis",
        },
      ],
    });
    render(
      <EntitlementContext.Provider
        value={{ loading: false, refresh: async () => {}, snapshot: entitlement() }}
      >
        <KnowledgeNetworkWorkspaceScene
          extensionKey="analysis-canvas:analyses"
          networkId="network-1"
          section="extension"
        />
      </EntitlementContext.Provider>,
    );

    const page = screen.getByText("analysis list");
    expect(page.parentElement?.className).toMatch(/workspaceSectionPage/);
    expect(page.parentElement?.className).toMatch(/workspaceSectionFlush/);
    // The workspace's own entries are still there.
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.workspaceConceptModel" }));
    expect(screen.getByRole("button", { name: /workspaceObjectTypes/ })).toBeTruthy();
    resetExtensionsForTesting();
  });
});

it.each(["object-types", "experience-agent"] as const)(
  "loads the %s section after navigation",
  async (section) => {
    render(
      <EntitlementContext.Provider
        value={{ loading: false, refresh: async () => {}, snapshot: entitlement() }}
      >
        <KnowledgeNetworkWorkspaceScene networkId="network-1" section={section} />
      </EntitlementContext.Provider>,
    );
    expect(
      await screen.findByTestId(
        section === "object-types" ? "resource-content" : "experience-content",
      ),
    ).toBeTruthy();
  },
);

it("lets embedded Eval content own its layout while retaining workspace navigation", () => {
  mocks.hiddenNavigation = [];
  mocks.pathname = "/knowledge-network/workspace/network-1/evals";
  render(
    <EntitlementContext.Provider
      value={{
        loading: false,
        refresh: async () => {},
        snapshot: entitlement({ edition: "enterprise", licensed: true }),
      }}
    >
      <KnowledgeNetworkWorkspaceScene networkId="network-1" section="extension">
        <div data-testid="embedded-eval">Eval content</div>
      </KnowledgeNetworkWorkspaceScene>
    </EntitlementContext.Provider>,
  );
  expect(screen.getByTestId("embedded-eval").parentElement?.tagName).toBe("MAIN");
  expect(
    screen.getByRole("button", { name: "knowledgeNetwork.workspaceAbilityVerification" }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("button", { name: "knowledgeNetwork.workspaceRiskControl" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTitle("评测")).toBeTruthy();
});

it.each(["enterprise", "industry"] as const)("hides risk badges on %s", (edition) => {
  resetExtensionsForTesting();
  registerExtension({
    id: "governance",
    capability: CAPABILITIES.ACTION_GOVERNANCE,
    workspaceNavItems: [
      {
        id: "action-control",
        section: "risk-control",
        labelKey: "governance.actionControl",
        path: (id) => `/knowledge-network/workspace/${id}/action-control`,
      },
    ],
  });
  render(
    <EntitlementContext.Provider
      value={{
        loading: false,
        refresh: async () => {},
        snapshot: entitlement({ edition, licensed: true }),
      }}
    >
      <KnowledgeNetworkWorkspaceScene networkId="network-1" section="overview" />
    </EntitlementContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.workspaceRiskControl" }));
  const item = screen.getByTitle("行动管控");
  expect(item).not.toBeDisabled();
  expect(item).not.toHaveTextContent("企业版");
  expect(screen.getByTitle("权限管控")).not.toHaveTextContent("企业版");
  fireEvent.click(item);
  expect(mocks.navigate).toHaveBeenCalledWith(
    "/knowledge-network/workspace/network-1/action-control",
  );
  resetExtensionsForTesting();
});
