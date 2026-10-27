/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";

const kb = vi.hoisted((): { mode: BknProjectKbMode } => ({ mode: "hidden" }));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => kb.mode,
}));

vi.mock("@/app/shell/TopBar", () => ({ TopBar: () => <header>top bar</header> }));

vi.mock("@/modules/bkn-project/scenes/ProjectWorkspaceScene", () => ({
  ProjectWorkspaceScene: ({ projectId, section }: { projectId: string; section: string }) => (
    <div>
      scene {projectId} {section}
    </div>
  ),
}));

import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProjectWorkspacePage />} path="/bkn-project/:projectId" />
        <Route element={<ProjectWorkspacePage />} path="/bkn-project/:projectId/:section" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectWorkspacePage", () => {
  beforeEach(() => {
    kb.mode = "hidden";
  });

  it("opens a known page under the top bar", () => {
    renderAt("/bkn-project/p1/model");

    expect(screen.getByText("top bar")).toBeInTheDocument();
    expect(screen.getByText("scene p1 model")).toBeInTheDocument();
  });

  it("opens the overview for a project without a page, or an unknown page", () => {
    renderAt("/bkn-project/p1");
    expect(screen.getByText("scene p1 overview")).toBeInTheDocument();
  });

  it("opens the overview for an unknown page", () => {
    renderAt("/bkn-project/p1/terms");
    expect(screen.getByText("scene p1 overview")).toBeInTheDocument();
  });

  it("opens the overview for a knowledge-base page in the community image", () => {
    renderAt("/bkn-project/p1/instances");
    expect(screen.getByText("scene p1 overview")).toBeInTheDocument();
  });

  it("keeps a knowledge-base page when it is only licensed away", () => {
    kb.mode = "locked";
    renderAt("/bkn-project/p1/builds");
    expect(screen.getByText("scene p1 builds")).toBeInTheDocument();
  });
});
