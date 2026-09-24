/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const listActionTypePage = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock("@/modules/knowledge-network/components/shared/usePersistentPageSize", () => ({
  usePersistentPageSize: () => [10, vi.fn()],
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => true,
}));

vi.mock("@/modules/knowledge-network/services/action-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/action-type.service")
  >()),
  listKnowledgeNetworkActionTypePage: listActionTypePage,
}));

vi.mock("@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter", () => ({
  ObjectTypeRemoteFilter: () => null,
}));

import { ActionTypeListPanel } from "./ActionTypeListPanel";

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
  navigate.mockReset();
  listActionTypePage.mockReset();
});

describe("ActionTypeListPanel menu access", () => {
  it("exposes execution management only with execute access", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "update",
          color: "#1677ff",
          description: "Update an order",
          id: "action-1",
          name: "Update order",
          objectTypeId: "object-1",
          objectTypeName: "Order",
          operations: ["execute"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });
    render(
      <ActionTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Test network"
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.actions" }));

    expect(await screen.findByText("knowledgeNetwork.actionTypeExecutionEntry")).not.toBeNull();
    expect(screen.queryByText("common.edit")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.authorizeAction")).toBeNull();
  });

  it("uses root authorize plus child view for the configure-permissions entry", async () => {
    listActionTypePage.mockResolvedValue({
      entries: [
        {
          actionKind: "update",
          color: "#1677ff",
          description: "Update an order",
          id: "action-1",
          name: "Update order",
          objectTypeId: "object-1",
          objectTypeName: "Order",
          operations: ["view_detail"],
          tags: [],
          updateTime: "2026-08-20 10:00:00",
          updaterName: "admin",
        },
      ],
      totalCount: 1,
    });
    render(
      <ActionTypeListPanel
        canDelete={false}
        canModify={false}
        networkId="network-1"
        networkName="Test network"
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.actions" }));

    expect(await screen.findByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.getByText("common.entitlement.editionsShort.professional")).not.toBeNull();
  });
});
