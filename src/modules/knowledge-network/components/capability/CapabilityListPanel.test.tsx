/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CapabilityBindingListResult } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  permissions: { current: [] as string[] },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
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
  mocks.permissions.current = [];
});

function renderPanel(kind: CapabilitySectionKind, canModify = false) {
  return render(
    <CapabilityListPanel
      canDelete={false}
      canModify={canModify}
      data={emptyData}
      kind={kind}
      onDetach={vi.fn()}
      onMount={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
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
});
