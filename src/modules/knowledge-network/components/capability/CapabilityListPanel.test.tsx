/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CapabilityBindingListResult } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  permissions: { current: [] as string[] },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({ pathname: "/knowledge-network/kn-1/capabilities", search: "?kind=all" }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { info: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: mocks.permissions.current } },
  }),
}));

vi.mock("@/modules/knowledge-network/components/shared/usePersistentPageSize", () => ({
  usePersistentPageSize: () => [10, vi.fn()],
}));

vi.mock("@/modules/knowledge-network/components/capability/CapabilityMountModal", () => ({
  CapabilityMountModal: () => null,
}));

import {
  CapabilityListPanel,
  type CapabilitySectionKind,
} from "./CapabilityListPanel";

const emptyData: CapabilityBindingListResult = {
  boxes: [],
  entries: [],
  metadataAvailable: true,
  totalCount: 0,
};

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  mocks.navigate.mockReset();
  mocks.permissions.current = [];
});

function renderPanel(
  kind: CapabilitySectionKind,
  canModify = false,
  data: CapabilityBindingListResult = emptyData,
) {
  return render(
    <CapabilityListPanel
      canDelete={false}
      canModify={canModify}
      data={data}
      kind={kind}
      onDetach={vi.fn()}
      onMount={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
}

function dataFor(kind: CapabilitySectionKind): CapabilityBindingListResult {
  return {
    ...emptyData,
    entries: [
      {
        boundAsBox: false,
        boxId: kind === "skill" ? "" : "box-1",
        boxName: kind === "skill" ? "" : "Demo box",
        branch: "main",
        capabilityId: "capability-1",
        capabilityType:
          kind === "skill" ? "skill" : kind === "mcp" ? "mcp_tool" : "function",
        comment: "",
        createTime: "2026-09-11",
        creatorName: "Tester",
        description: "",
        id: "binding-1",
        metadataType:
          kind === "api" ? "openapi" : kind === "function" ? "function" : "",
        name: "Visible capability",
        sources: [],
        status: "enabled",
        updateTime: "2026-09-11",
        updaterName: "Tester",
      },
    ],
    totalCount: 1,
  };
}

describe("CapabilityListPanel restricted empty state", () => {
  it("describes a non-modifiable empty section without mount instructions", () => {
    renderPanel("function");

    expect(
      screen.getByText("knowledgeNetwork.capabilityNoVisibleFunctions"),
    ).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.capabilityEmptyFunctions")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.capabilityMountFunctions")).toBeNull();
  });

  it("keeps mount guidance for a network editor", () => {
    renderPanel("function", true);

    expect(screen.getByText("knowledgeNetwork.capabilityEmptyFunctions")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.capabilityMountFunctions")).not.toBeNull();
  });

  it("uses a search-specific empty state when existing rows do not match", () => {
    renderPanel("function", false, dataFor("function"));

    fireEvent.change(screen.getByPlaceholderText("knowledgeNetwork.capabilitySearchPlaceholder"), {
      target: { value: "not-present" },
    });

    expect(screen.getByText("knowledgeNetwork.capabilitySearchNoResult")).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.capabilityNoVisibleFunctions")).toBeNull();
  });

  it.each([
    ["function", "execution-factory:toolbox:view"],
    ["api", "execution-factory:toolbox:view"],
    ["mcp", "execution-factory:mcp:view"],
    ["skill", "execution-factory:skill:view"],
  ] as const)("shows the %s management link only with %s", (kind, permission) => {
    renderPanel(kind);
    expect(screen.queryByText("knowledgeNetwork.capabilityManageInFactory")).toBeNull();
    cleanup();

    mocks.permissions.current = [permission];
    renderPanel(kind);
    expect(screen.getByText("knowledgeNetwork.capabilityManageInFactory")).not.toBeNull();
  });

  it.each([
    [
      "function",
      "execution-factory:tool:view",
      "/execution-factory/toolboxes/box-1/tools/capability-1/edit",
    ],
    [
      "api",
      "execution-factory:tool:view",
      "/execution-factory/toolboxes/box-1/tools/capability-1/edit",
    ],
    ["mcp", "execution-factory:mcp:view", "/execution-factory/mcp/box-1"],
    ["skill", "execution-factory:skill:view", "/execution-factory/skills/capability-1"],
  ] as const)("links a %s row only with %s", (kind, permission, expectedPath) => {
    renderPanel(kind, false, dataFor(kind));
    expect(screen.queryByRole("button", { name: "Visible capability" })).toBeNull();
    expect(screen.getByText("Visible capability").tagName).toBe("SPAN");
    cleanup();

    mocks.permissions.current = [permission];
    renderPanel(kind, false, dataFor(kind));
    fireEvent.click(screen.getByRole("button", { name: "Visible capability" }));

    // The detail scene's back button must return to this list, not to its own list page (#386).
    expect(mocks.navigate).toHaveBeenCalledWith(expectedPath, {
      state: { returnTo: "/knowledge-network/kn-1/capabilities?kind=all" },
    });
  });
});
