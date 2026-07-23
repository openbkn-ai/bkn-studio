/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ExecutionUnitCardMenu } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCardMenu";
import type { ExecutionUnitCardItem } from "@/modules/execution-factory/components/execution-unit/types";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function buildItem(status: string): ExecutionUnitCardItem {
  return {
    id: "box-1",
    name: "Demo Toolbox",
    status,
  };
}

describe("ExecutionUnitCardMenu lifecycle actions", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("fires offline (not unpublish) when taking a published toolbox down", () => {
    const onAction = vi.fn();

    render(
      <ExecutionUnitCardMenu
        activeTab="toolbox"
        item={buildItem("published")}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "executionFactory.cardMenu.more" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("executionFactory.cardMenu.unpublish")).toBeNull();
    fireEvent.click(within(menu).getByText("executionFactory.offline"));

    expect(onAction).toHaveBeenCalledWith("offline", expect.objectContaining({ status: "published" }));
    expect(onAction).not.toHaveBeenCalledWith("unpublish", expect.anything());
  });

  it("fires publish for an offline toolbox so it can go back online", () => {
    const onAction = vi.fn();

    render(
      <ExecutionUnitCardMenu
        activeTab="toolbox"
        item={buildItem("offline")}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "executionFactory.cardMenu.more" }));
    fireEvent.click(within(screen.getByRole("menu")).getByText("executionFactory.publish"));

    expect(onAction).toHaveBeenCalledWith("publish", expect.objectContaining({ status: "offline" }));
  });
});
