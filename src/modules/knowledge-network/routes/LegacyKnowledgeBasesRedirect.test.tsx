/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegacyKnowledgeBasesRedirect } from "./LegacyKnowledgeBasesRedirect";

function Target() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output>{`${location.pathname}${location.search}${location.hash}`}</output>
      <button
        onClick={() => {
          void navigate(-1);
        }}
      >
        Back
      </button>
    </>
  );
}

describe("LegacyKnowledgeBasesRedirect", () => {
  it("replaces the retired page with the same network overview and preserves version context", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/previous",
          "/knowledge-network/workspace/network-1/knowledge-bases?version=2#source",
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/previous" element={<p>Previous page</p>} />
          <Route
            path="/knowledge-network/workspace/:networkId/knowledge-bases"
            element={<LegacyKnowledgeBasesRedirect />}
          />
          <Route path="/knowledge-network/workspace/:networkId/overview" element={<Target />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("/knowledge-network/workspace/network-1/overview?version=2#source"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Previous page")).toBeTruthy();
  });
});
