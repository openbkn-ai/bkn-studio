/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());

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
});

describe("ActionTypeListPanel menu access", () => {
  it("exposes execution management only with task-manage access", async () => {
    render(
      <ActionTypeListPanel
        canDelete={false}
        canModify={false}
        items={[
          {
            actionKind: "update",
            color: "#1677ff",
            description: "Update an order",
            id: "action-1",
            name: "Update order",
            objectTypeId: "object-1",
            objectTypeName: "Order",
            operations: ["task_manage"],
            tags: [],
            updateTime: "2026-08-20 10:00:00",
            updaterName: "admin",
          },
        ]}
        networkId="network-1"
        objectTypes={[]}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.actions" }));

    expect(
      await screen.findByText("knowledgeNetwork.actionTypeExecutionEntry"),
    ).not.toBeNull();
    expect(screen.queryByText("common.edit")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.authorizeAction")).toBeNull();
  });

  it("exposes configure permissions only for action types with authorize", async () => {
    render(
      <ActionTypeListPanel
        canDelete={false}
        canModify={false}
        items={[
          {
            actionKind: "update",
            color: "#1677ff",
            description: "Update an order",
            id: "action-1",
            name: "Update order",
            objectTypeId: "object-1",
            objectTypeName: "Order",
            operations: ["authorize"],
            tags: [],
            updateTime: "2026-08-20 10:00:00",
            updaterName: "admin",
          },
        ]}
        networkId="network-1"
        objectTypes={[]}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.actions" }));

    expect(await screen.findByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
  });
});
