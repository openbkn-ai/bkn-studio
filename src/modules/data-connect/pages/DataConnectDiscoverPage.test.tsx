/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          element={(
            <>
              <DataConnectDiscoverPage />
              <LocationState />
            </>
          )}
          path="/data-connect/:catalogId/discover"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DataConnectDiscoverPage", () => {
  it("reads catalogId from the route and stores the active tab in the query", () => {
    renderPage("/data-connect/catalog-1/discover?tab=tasks");

    fireEvent.click(screen.getByRole("button", { name: "schedules" }));
    expect(screen.getByTestId("location").textContent).toBe(
      "/data-connect/catalog-1/discover?tab=schedules",
    );
    expect(screen.getByTestId("catalog-id").textContent).toBe("catalog-1");
    expect(screen.getByTestId("active-tab").textContent).toBe("schedules");
  });

  it("normalizes a missing tab parameter to tasks", async () => {
    renderPage("/data-connect/catalog-1/discover");

    expect(await screen.findByText(
      "/data-connect/catalog-1/discover?tab=tasks",
    )).toBeTruthy();
    expect(screen.getByTestId("active-tab").textContent).toBe("tasks");
  });
});
