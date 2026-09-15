/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, useRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/data-connect/scenes/DataConnectDiscoverScene", () => ({
  DataConnectDiscoverScene: () => <div>dataConnect.permissionRequired</div>,
}));

import { dataConnectRoutes } from "@/modules/data-connect/routes";

describe("data-connect routes", () => {
  it("requires a catalog identifier in the discover route", () => {
    const paths = dataConnectRoutes.map((route) => route.path);

    expect(paths).toContain("data-connect/:catalogId/discover");
    expect(paths).not.toContain("data-connect/discover");
  });

  it("lets the catalog-scoped discover scene render an explicit forbidden state", async () => {
    function TestRoutes() {
      return useRoutes(dataConnectRoutes);
    }

    render(
      <MemoryRouter initialEntries={["/data-connect/catalog-view-only/discover"]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("dataConnect.permissionRequired")).toBeTruthy();
  });
});
