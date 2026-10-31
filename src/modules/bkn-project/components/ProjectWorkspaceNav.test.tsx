/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";

const kb = vi.hoisted((): { mode: BknProjectKbMode } => ({ mode: "hidden" }));
const translate = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => kb.mode,
}));

vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: ({ children }: { children: ReactNode }) =>
    kb.mode === "hidden" ? null : (
      <>
        {children}
        <span>professional</span>
      </>
    ),
}));

import { ProjectWorkspaceNav } from "./ProjectWorkspaceNav";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderNav(counts?: Partial<Record<"model" | "requirements", number>>) {
  render(
    <MemoryRouter initialEntries={["/bkn-project/p1/overview"]}>
      <ProjectWorkspaceNav active="overview" counts={counts} projectId="p1" />
      <Routes>
        <Route element={<Location />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

// The pages, not the button that folds the navigation.
const itemLabels = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.title !== "shell.collapseSidenav")
    .map((button) => button.textContent);

describe("ProjectWorkspaceNav", () => {
  beforeEach(() => {
    kb.mode = "hidden";
  });

  it("counts what a page holds, and folds to icons", () => {
    renderNav({ model: 13, requirements: 10 });
    expect(screen.getByRole("button", { name: /requirements/ })).toHaveTextContent("10");
    expect(screen.getByRole("button", { name: /model/ })).toHaveTextContent("13");

    fireEvent.click(screen.getByTitle("shell.collapseSidenav"));
    // Folded: the names and counts give way to the icons; each page keeps its name as its title.
    expect(screen.queryByText("bknProject.workspace.sections.overview")).toBeNull();
    expect(screen.queryByText("10")).toBeNull();
    expect(screen.getByTitle("bknProject.workspace.sections.overview")).toBeInTheDocument();
  });

  it("shows the four community pages in two groups, with no knowledge-base page", () => {
    renderNav();

    expect(itemLabels()).toEqual([
      "bknProject.workspace.sections.overview",
      "bknProject.workspace.sections.requirements",
      "bknProject.workspace.sections.model",
      "bknProject.workspace.sections.release",
    ]);
    expect(screen.getByText("bknProject.workspace.groupBuild")).toBeInTheDocument();
    expect(screen.getByText("bknProject.workspace.groupRelease")).toBeInTheDocument();
    expect(screen.queryByText("professional")).toBeNull();
    expect(screen.getAllByRole("button").every((button) => !button.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("shows the knowledge-base pages with a badge when they are only licensed away", () => {
    kb.mode = "locked";
    renderNav();

    expect(itemLabels()).toEqual([
      "bknProject.workspace.sections.overview",
      "bknProject.workspace.sections.requirements",
      "bknProject.workspace.sections.model",
      "bknProject.workspace.sections.instancesprofessional",
      "bknProject.workspace.sections.release",
      "bknProject.workspace.sections.buildsprofessional",
    ]);
  });

  it("marks the active page and opens another one", () => {
    renderNav();

    expect(
      screen.getByText("bknProject.workspace.sections.overview").closest("button"),
    ).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByText("bknProject.workspace.sections.model"));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model");
  });
});
