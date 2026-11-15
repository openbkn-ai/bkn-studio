/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellTrailPortal } from "@/app/shell/workspace-slots";
import { ShellTrailSlotContext } from "@/app/shell/workspace-slots-context";

vi.mock("@/app/shell/TopBar", () => ({
  TopBar: function TopBar() {
    const slot = useContext(ShellTrailSlotContext);
    return (
      <header data-testid="topbar">
        <span ref={slot?.setTrailHost} />
      </header>
    );
  },
}));

import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

const picker = (
  <ShellTrailPortal fallback={<span>inline picker</span>}>
    <span>trail picker</span>
  </ShellTrailPortal>
);

describe("KnowledgeNetworkResourceConfigStandalonePage", () => {
  afterEach(cleanup);

  // The evals page hosts the workspace here; its version picker must sit in the top bar as on
  // the other workspace pages, not fall back to a bar above the content.
  it("puts hosted trail controls into its own top bar", () => {
    render(
      <KnowledgeNetworkResourceConfigStandalonePage>
        {picker}
      </KnowledgeNetworkResourceConfigStandalonePage>,
    );
    expect(screen.getByTestId("topbar").textContent).toContain("trail picker");
    expect(screen.queryByText("inline picker")).toBeNull();
  });

  it("keeps trail controls in place when immersive has no top bar", () => {
    render(
      <KnowledgeNetworkResourceConfigStandalonePage immersive>
        {picker}
      </KnowledgeNetworkResourceConfigStandalonePage>,
    );
    expect(screen.queryByTestId("topbar")).toBeNull();
    expect(screen.getByText("inline picker")).toBeTruthy();
  });
});
