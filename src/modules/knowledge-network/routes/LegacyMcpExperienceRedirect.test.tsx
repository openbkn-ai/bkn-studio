/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegacyMcpExperienceRedirect } from "./LegacyMcpExperienceRedirect";

function IntegrationTarget() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

describe("LegacyMcpExperienceRedirect", () => {
  it("redirects the workspace debugger to the unified MCP workspace", async () => {
    render(
      <MemoryRouter initialEntries={["/knowledge-network/workspace/network-1/experience/mcp"]}>
        <Routes>
          <Route
            path="/knowledge-network/workspace/:networkId/experience/mcp"
            element={<LegacyMcpExperienceRedirect />}
          />
          <Route path="/knowledge-network/integration" element={<IntegrationTarget />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/\/knowledge-network\/integration\?/)).toHaveTextContent(
      "/knowledge-network/integration?tab=mcp&mcpView=debug&networkId=network-1",
    );
  });
});
