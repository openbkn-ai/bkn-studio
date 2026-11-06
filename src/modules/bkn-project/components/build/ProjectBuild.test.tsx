/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import type { ProjectKnowledgeBaseBuildProps } from "@/framework/extension/registry";
import type { Project } from "@/modules/bkn-project/types/project";

const state = vi.hoisted((): { builds: boolean; mode: BknProjectKbMode } => ({
  builds: true,
  mode: "enabled",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => state.mode,
}));

// The slot's three states are tested on their own: here it masks while locked.
vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: ({ children }: { children: ReactNode }) => <>{children} badge</>,
  BknProjectKbSlot: ({ children, preview }: { children: ReactNode; preview: ReactNode }) =>
    state.mode === "locked" ? <div>mask {preview}</div> : <>{children}</>,
}));

vi.mock("@/framework/extension/registry", () => ({
  extensionProjectKnowledgeBaseBuilds: () =>
    state.builds
      ? ({ canEdit, canManageBuilds, section }: ProjectKnowledgeBaseBuildProps) => (
          <div>
            document builds {section} {canEdit ? "edit" : "read"}{" "}
            {canManageBuilds ? "manage" : "watch"}
          </div>
        )
      : undefined,
}));

vi.mock("@/modules/bkn-project/components/release/IndexReadiness", () => ({
  IndexReadiness: ({ canRun }: { canRun: boolean }) => <div>indexes {canRun ? "run" : "view"}</div>,
}));

vi.mock("@/modules/bkn-project/components/release/KnowledgeRefreshSection", () => ({
  KnowledgeRefreshSection: ({ lineageId }: { lineageId: string }) => (
    <div>refresh of {lineageId}</div>
  ),
}));

import { ProjectBuild } from "./ProjectBuild";

const project = { archived: false, id: "p1", knId: "orders" } as Project;

function Location() {
  const { search } = useLocation();
  return <div data-testid="location">{search}</div>;
}

function renderBuild(path = "/bkn-project/p1/build", ownerIsCaller = true, of = project) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ProjectBuild ownerIsCaller={ownerIsCaller} project={of} />
      <Location />
    </MemoryRouter>,
  );
}

describe("ProjectBuild", () => {
  beforeEach(() => {
    state.builds = true;
    state.mode = "enabled";
  });

  it("opens on the structured index, which every edition has", () => {
    renderBuild();

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      "bknProject.build.tabs.structured",
    );
    expect(screen.getByText("indexes run")).toBeInTheDocument();
  });

  it("has only the structured tab in the community image, even when a link asks for the other", () => {
    state.mode = "hidden";
    renderBuild("/bkn-project/p1/build?tab=unstructured");

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByText("indexes run")).toBeInTheDocument();
    expect(screen.queryByText(/document builds/)).toBeNull();
  });

  it("puts the document builds and their refresh on the unstructured tab, with the preview", () => {
    renderBuild("/bkn-project/p1/build?tab=unstructured");

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      "bknProject.build.tabs.unstructured badge",
    );
    expect(screen.getByText("document builds instances edit manage")).toBeInTheDocument();
    expect(screen.getByText("refresh of orders")).toBeInTheDocument();
  });

  it("masks the unstructured tab once while it is licensed away", () => {
    state.mode = "locked";
    renderBuild("/bkn-project/p1/build?tab=unstructured");

    expect(screen.getByText(/mask/)).toHaveTextContent("bknProject.build.unstructured.preview");
    expect(screen.queryByText(/refresh of/)).toBeNull();
  });

  it("says so where the edition brings no document builds", () => {
    state.builds = false;
    renderBuild("/bkn-project/p1/build?tab=unstructured");

    expect(screen.getByText("bknProject.build.unstructured.comingSoon")).toBeInTheDocument();
  });

  it("lets only the owner of an open project build", () => {
    renderBuild("/bkn-project/p1/build?tab=unstructured", true, { ...project, archived: true });
    expect(screen.getByText("document builds instances read manage")).toBeInTheDocument();
  });

  it("keeps the tab in the address", () => {
    renderBuild("/bkn-project/p1/build", false);
    expect(screen.getByText("indexes view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /unstructured/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=unstructured");
  });
});
