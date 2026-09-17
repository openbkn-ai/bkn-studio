/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeNetworkChildModifyRouteGate,
  type KnowledgeNetworkChildRecordLoader,
} from "./KnowledgeNetworkChildModifyRouteGate";

function renderGate(loader: KnowledgeNetworkChildRecordLoader) {
  return render(
    <MemoryRouter
      initialEntries={[
        "/knowledge-network/workspace/network-1/concept-groups/group-1/edit",
      ]}
    >
      <Routes>
        <Route
          element={
            <KnowledgeNetworkChildModifyRouteGate
              loadResource={loader}
              resourceIdParam="conceptGroupId"
            >
              <div>concept group form</div>
            </KnowledgeNetworkChildModifyRouteGate>
          }
          path="/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/edit"
        />
        <Route
          element={<div>overview page</div>}
          path="/knowledge-network/workspace/:networkId/overview"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("KnowledgeNetworkChildModifyRouteGate", () => {
  it("allows editing a child with modify even when its parent is not checked", async () => {
    const loader = vi.fn().mockResolvedValue({ operations: ["view_detail", "modify"] });

    renderGate(loader);

    expect(await screen.findByText("concept group form")).toBeTruthy();
    expect(loader).toHaveBeenCalledWith("network-1", "group-1");
  });

  it("redirects when the child record does not grant modify", async () => {
    renderGate(vi.fn().mockResolvedValue({ operations: ["view_detail"] }));

    expect(await screen.findByText("overview page")).toBeTruthy();
  });

  it("fails closed when the child record is not visible", async () => {
    renderGate(vi.fn().mockResolvedValue(null));

    expect(await screen.findByText("overview page")).toBeTruthy();
  });
});
