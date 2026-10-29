/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { WorkspaceGraphOverviewAction } from "@/modules/knowledge-network/scenes/workspace/WorkspaceGraphOverviewAction";

function OverviewProbe() {
  const { networkId } = useParams();
  const { state } = useLocation() as { state: { returnTo?: string } | null };
  return (
    <div data-testid="overview">
      {networkId} {state?.returnTo}
    </div>
  );
}

describe("WorkspaceGraphOverviewAction", () => {
  it("opens the overview of this network in place, naming the workspace as the way back", () => {
    render(
      <MemoryRouter
        basename="/studio"
        initialEntries={["/studio/knowledge-network/workspace/network 1/overview"]}
      >
        <Routes>
          <Route
            element={<WorkspaceGraphOverviewAction networkId="network 1" />}
            path="/knowledge-network/workspace/:networkId/overview"
          />
          <Route
            element={<OverviewProbe />}
            path="/knowledge-network/workspace/:networkId/graph-overview"
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("workspace-graph-overview-action"));

    expect(screen.getByTestId("overview").textContent).toBe(
      "network 1 /knowledge-network/workspace/network 1/overview",
    );
  });
});
