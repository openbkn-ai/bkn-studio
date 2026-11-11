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

vi.mock("@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene", () => ({
  KnowledgeNetworkWorkspaceScene: () => (
    <ShellTrailPortal fallback={<span>inline picker</span>}>
      <span>trail picker</span>
    </ShellTrailPortal>
  ),
}));

import { KnowledgeNetworkWorkspaceStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkWorkspaceStandalonePage";

describe("KnowledgeNetworkWorkspaceStandalonePage", () => {
  afterEach(cleanup);

  it("puts the workspace's trail controls into its own top bar", () => {
    render(<KnowledgeNetworkWorkspaceStandalonePage section="overview" />);
    expect(screen.getByTestId("topbar").textContent).toContain("trail picker");
    expect(screen.queryByText("inline picker")).toBeNull();
  });
});
