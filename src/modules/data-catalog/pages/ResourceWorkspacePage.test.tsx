/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/data-catalog/scenes/ResourceWorkspaceScene", () => ({
  ResourceWorkspaceScene: ({
    indexView,
    indexViewExplicit,
    onIndexViewChange,
    onTabChange,
    resourceId,
    tab,
  }: {
    indexView: string;
    indexViewExplicit: boolean;
    onIndexViewChange: (view: "config" | "tasks" | "schedules") => void;
    onTabChange: (tab: "detail" | "index" | "preview" | "semantic-understanding") => void;
    resourceId: string;
    tab: string;
  }) => (
    <div>
      <output data-testid="resource-id">{resourceId}</output>
      <output data-testid="active-tab">{tab}</output>
      <output data-testid="index-view">{indexView}</output>
      <output data-testid="explicit-index-view">{String(indexViewExplicit)}</output>
      <button onClick={() => onIndexViewChange("schedules")} type="button">
        schedules
      </button>
      <button onClick={() => onTabChange("detail")} type="button">
        detail
      </button>
      <button onClick={() => onTabChange("preview")} type="button">
        preview
      </button>
    </div>
  ),
}));

import { ResourceWorkspacePage } from "./ResourceWorkspacePage";

function LocationState() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("ResourceWorkspacePage", () => {
  it("preserves the resource schedule deep link and clears the sub-view on leaving the index", () => {
    render(
      <MemoryRouter
        initialEntries={["/data-catalog/resource/resource-1?tab=index&view=schedules&keep=1"]}
      >
        <Routes>
          <Route
            path="/data-catalog/resource/:resourceId"
            element={
              <>
                <ResourceWorkspacePage />
                <LocationState />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("resource-id")).toHaveTextContent("resource-1");
    expect(screen.getByTestId("active-tab")).toHaveTextContent("index");
    expect(screen.getByTestId("index-view")).toHaveTextContent("schedules");
    expect(screen.getByTestId("explicit-index-view")).toHaveTextContent("true");
    expect(screen.getByTestId("location")).toHaveTextContent("tab=index&view=schedules&keep=1");
    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/data-catalog/resource/resource-1?tab=preview&keep=1",
    );
  });

  it("switches the index sub-view to schedules while preserving unrelated URL state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/data-catalog/resource/resource-1?tab=index&view=tasks&action=start&keep=1",
        ]}
      >
        <Routes>
          <Route
            path="/data-catalog/resource/:resourceId"
            element={
              <>
                <ResourceWorkspacePage />
                <LocationState />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "schedules" }));
    expect(screen.getByTestId("index-view")).toHaveTextContent("schedules");
    expect(screen.getByTestId("location")).toHaveTextContent("tab=index&view=schedules&keep=1");
  });
  it("normalizes the default detail tab and stores tab switches in the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog/resource/resource-1"]}>
        <Routes>
          <Route
            element={
              <>
                <ResourceWorkspacePage />
                <LocationState />
              </>
            }
            path="/data-catalog/resource/:resourceId"
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("/data-catalog/resource/resource-1?tab=detail")).toBeTruthy();
    expect(screen.getByTestId("active-tab").textContent).toBe("detail");

    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.getByTestId("location").textContent).toBe(
      "/data-catalog/resource/resource-1?tab=preview",
    );
    expect(screen.getByTestId("active-tab").textContent).toBe("preview");
  });
});
