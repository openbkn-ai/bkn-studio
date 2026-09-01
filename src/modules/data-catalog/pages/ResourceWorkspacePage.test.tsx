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
  ResourceWorkspaceScene: ({ onTabChange, resourceId, tab }: {
    onTabChange: (tab: "detail" | "index" | "preview" | "semantic-understanding") => void;
    resourceId: string;
    tab: string;
  }) => (
    <div>
      <output data-testid="resource-id">{resourceId}</output>
      <output data-testid="active-tab">{tab}</output>
      <button onClick={() => onTabChange("detail")} type="button">detail</button>
      <button onClick={() => onTabChange("preview")} type="button">preview</button>
    </div>
  ),
}));

import { ResourceWorkspacePage } from "./ResourceWorkspacePage";

function LocationState() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("ResourceWorkspacePage", () => {
  it("normalizes the default detail tab and stores tab switches in the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/data-directory/resource/resource-1"]}>
        <Routes>
          <Route
            element={<><ResourceWorkspacePage /><LocationState /></>}
            path="/data-directory/resource/:resourceId"
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(
      "/data-directory/resource/resource-1?tab=detail",
    )).toBeTruthy();
    expect(screen.getByTestId("active-tab").textContent).toBe("detail");

    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.getByTestId("location").textContent).toBe(
      "/data-directory/resource/resource-1?tab=preview",
    );
    expect(screen.getByTestId("active-tab").textContent).toBe("preview");
  });
});
