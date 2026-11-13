/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const getStatusMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", () => ({
  getProjectStatus: getStatusMock,
}));

import { ProjectCard } from "./ProjectCard";

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  catalogIds: ["c1", "c2"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Orders",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

const release = {
  knVersion: 3,
  networkId: "orders",
  rolledBack: false,
  running: null,
  version: "1.2.0",
};

function renderCard(overrides: Partial<Project> = {}, isOwner = true) {
  return render(
    <MemoryRouter>
      <ProjectCard
        isOwner={isOwner}
        networkName="Orders network"
        onArchive={vi.fn()}
        onOpen={vi.fn()}
        onUnarchive={vi.fn()}
        project={{ ...project, ...overrides }}
      />
    </MemoryRouter>,
  );
}

describe("ProjectCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows where the project stands and its network, without a data sources row", async () => {
    getStatusMock.mockResolvedValue({ release: null, stage: "check_needs_attention" });
    renderCard();

    expect(
      await screen.findByText("bknProject.list.card.stages.check_needs_attention"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders network" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/orders/overview",
    );
    expect(screen.queryByText("bknProject.list.card.catalogs")).toBeNull();
    expect(screen.getByText("bknProject.list.ownerYou")).toBeInTheDocument();
  });

  it("names the published version in the stage of a published project", async () => {
    getStatusMock.mockResolvedValue({ release, stage: "published" });
    renderCard();

    expect(
      await screen.findByText('bknProject.release.publish.publishedTag:{"version":"1.2.0"}'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/lastRelease/)).toBeNull();
  });

  it("names the last release of a project that went on after it", async () => {
    getStatusMock.mockResolvedValue({ release, stage: "deciding" });
    renderCard();

    expect(await screen.findByText("bknProject.list.card.stages.deciding")).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.list.card.lastRelease:{"version":"1.2.0"}'),
    ).toBeInTheDocument();
  });

  it("says the network was switched back, with the version it runs", async () => {
    getStatusMock.mockResolvedValue({
      release: { ...release, rolledBack: true, running: { knVersion: 2, label: "v1.1.0" } },
      stage: "published",
    });
    renderCard();

    expect(
      await screen.findByText('bknProject.release.publish.rolledBack:{"version":"v1.1.0"}'),
    ).toBeInTheDocument();
  });

  it("shows an archived project as archived without reading its status", async () => {
    renderCard({ archived: true });

    expect(screen.getByText("bknProject.list.card.stages.archived")).toBeInTheDocument();
    await waitFor(() => expect(getStatusMock).not.toHaveBeenCalled());
  });

  it("drops the release of a card archived while it is shown", async () => {
    getStatusMock.mockResolvedValue({ release, stage: "deciding" });
    const { rerender } = renderCard();
    expect(await screen.findByText(/lastRelease/)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProjectCard
          isOwner
          onArchive={vi.fn()}
          onOpen={vi.fn()}
          onUnarchive={vi.fn()}
          project={{ ...project, archived: true }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("bknProject.list.card.stages.archived")).toBeInTheDocument();
    expect(screen.queryByText(/lastRelease/)).toBeNull();
  });

  it("still shows the card when its status cannot be read", async () => {
    getStatusMock.mockRejectedValue(new Error("down"));
    renderCard();

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledWith("p1"));
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.queryByText(/stages\./)).toBeNull();
  });

  it("names another member's project by its owner's name, never by an id", async () => {
    getStatusMock.mockResolvedValue({ release: null, stage: "drafting" });
    renderCard(
      {
        owner: { id: "266c6a42-6131-4d62-8f39-853e7093701c", type: "user" },
        ownerName: "Administrator",
      },
      false,
    );
    expect(await screen.findByText("Administrator")).toBeInTheDocument();

    renderCard({ owner: { id: "266c6a42-6131-4d62-8f39-853e7093701c", type: "user" } }, false);
    expect(await screen.findByText("bknProject.list.ownerSomeone")).toBeInTheDocument();
    expect(screen.queryByText("266c6a42-6131-4d62-8f39-853e7093701c")).toBeNull();
  });
});
