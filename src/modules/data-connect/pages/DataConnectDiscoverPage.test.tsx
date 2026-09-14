/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/data-connect/scenes/DataConnectDiscoverScene", () => ({
  DataConnectDiscoverScene: ({ activeTab, catalogId, onTabChange }: {
    activeTab: "schedules" | "tasks";
    catalogId?: string;
    onTabChange: (tab: "schedules" | "tasks") => void;
  }) => (
    <div>
      <output data-testid="active-tab">{activeTab}</output>
      <output data-testid="catalog-id">{catalogId}</output>
      <button onClick={() => onTabChange("tasks")} type="button">tasks</button>
      <button onClick={() => onTabChange("schedules")} type="button">schedules</button>
    </div>
  ),
}));

import { DataConnectDiscoverPage } from "./DataConnectDiscoverPage";

function LocationState() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("DataConnectDiscoverPage", () => {
  it("stores the active tab in the URL while preserving catalogId", () => {
    render(
      <MemoryRouter initialEntries={["/data-connect/discover?catalogId=catalog-1&tab=tasks"]}>
        <DataConnectDiscoverPage />
        <LocationState />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "schedules" }));
    expect(screen.getByTestId("location").textContent).toBe(
      "/data-connect/discover?catalogId=catalog-1&tab=schedules",
    );
    expect(screen.getByTestId("active-tab").textContent).toBe("schedules");
  });

  it("normalizes a missing tab parameter to tasks", async () => {
    render(
      <MemoryRouter initialEntries={["/data-connect/discover?catalogId=catalog-1"]}>
        <DataConnectDiscoverPage />
        <LocationState />
      </MemoryRouter>,
    );

    expect(await screen.findByText(
      "/data-connect/discover?catalogId=catalog-1&tab=tasks",
    )).toBeTruthy();
    expect(screen.getByTestId("active-tab").textContent).toBe("tasks");
  });
});
