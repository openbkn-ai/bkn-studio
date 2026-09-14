/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sceneMountMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ currentUser: { permissions: ["catalog:view_detail"] } }),
}));
vi.mock("@/modules/data-catalog/scenes/DataCatalogScene", async () => {
  const { useEffect } = await import("react");
  return {
    DataCatalogScene: ({ selection }: { selection: { id: string } | null }) => {
      useEffect(() => {
        sceneMountMock();
      }, []);
      return <output data-testid="selection">{selection?.id ?? "none"}</output>;
    },
  };
});

import { DataCatalogPage } from "./DataCatalogPage";

function OpenCatalogButton() {
  const navigate = useNavigate();
  return <button onClick={() => { void navigate("/data-catalog/catalog/catalog-1"); }} type="button">open catalog</button>;
}

describe("DataCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the explorer mounted when the catalog route changes", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <OpenCatalogButton />
        <Routes>
          <Route element={<DataCatalogPage />} path="/data-catalog">
            <Route element={<></>} index />
            <Route element={<></>} path="catalog/:catalogId" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(sceneMountMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "open catalog" }));

    expect(await screen.findByText("catalog-1")).toBeTruthy();
    expect(sceneMountMock).toHaveBeenCalledTimes(1);
  });
});
