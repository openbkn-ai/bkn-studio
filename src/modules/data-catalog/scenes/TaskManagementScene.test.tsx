/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("antd", () => ({
  Tabs: ({ activeKey, items, onChange }: {
    activeKey: string;
    items: Array<{ children: ReactNode; key: string; label: ReactNode }>;
    onChange: (key: string) => void;
  }) => (
    <div>
      <output data-testid="active-tab">{activeKey}</output>
      {items.map((item) => (
        <button key={item.key} onClick={() => onChange(item.key)} type="button">
          {item.label}
        </button>
      ))}
      {items.find((item) => item.key === activeKey)?.children}
    </div>
  ),
}));

vi.mock("@/modules/data-catalog/scenes/IndexBuildListScene", () => ({
  IndexBuildListScene: () => <div>index build panel</div>,
}));

vi.mock("./TaskManagementTaskPanels", () => ({
  DiscoverTaskListPanel: () => <div>discover panel</div>,
  SemanticUnderstandingTaskListPanel: () => <div>semantic panel</div>,
}));

import { TaskManagementScene } from "./TaskManagementScene";

function LocationState() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("TaskManagementScene", () => {
  it("restores the active tab from the URL and updates it when switching tabs", () => {
    render(
      <MemoryRouter initialEntries={["/index-builds?tab=semantic-understanding"]}>
        <TaskManagementScene />
        <LocationState />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("active-tab").textContent).toBe("semantic-understanding");
    expect(screen.getByText("semantic panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.taskManagement.tabs.indexBuild" }));
    expect(screen.getByTestId("location").textContent).toBe("/index-builds?tab=index-build");
    expect(screen.getByTestId("active-tab").textContent).toBe("index-build");

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.taskManagement.tabs.discover" }));
    expect(screen.getByTestId("location").textContent).toBe("/index-builds?tab=discover");
    expect(screen.getByTestId("active-tab").textContent).toBe("discover");
  });

  it("normalizes a missing tab parameter to discover", async () => {
    render(
      <MemoryRouter initialEntries={["/index-builds"]}>
        <TaskManagementScene />
        <LocationState />
      </MemoryRouter>,
    );

    expect(await screen.findByText("/index-builds?tab=discover")).toBeTruthy();
    expect(screen.getByTestId("active-tab").textContent).toBe("discover");
  });
});
