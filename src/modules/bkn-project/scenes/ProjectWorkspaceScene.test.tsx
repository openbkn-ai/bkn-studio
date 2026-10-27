/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const getProjectMock = vi.hoisted(() => vi.fn());
const getNetworkMock = vi.hoisted(() => vi.fn());
const getLatestReleaseMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => "hidden",
}));

vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: () => null,
  BknProjectKbSlot: () => null,
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  getLatestRelease: getLatestReleaseMock,
  getProject: getProjectMock,
  getProjectNetwork: getNetworkMock,
}));

import { ProjectWorkspaceScene } from "./ProjectWorkspaceScene";

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  catalogIds: ["c1", "c2"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

function renderScene(section: "overview" | "model" = "overview") {
  return render(
    <MemoryRouter>
      <ProjectWorkspaceScene projectId="p1" section={section} />
    </MemoryRouter>,
  );
}

describe("ProjectWorkspaceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectMock.mockResolvedValue(project);
    getNetworkMock.mockResolvedValue({ id: "orders", name: "Orders network" });
    getLatestReleaseMock.mockResolvedValue({
      createTime: 1,
      networkId: "orders_v1_0_0",
      version: "1.0.0",
    });
  });

  it("heads the workspace with the project, its network and its live version", async () => {
    renderScene();

    expect(await screen.findByText("Delivery warning")).toBeInTheDocument();
    expect(screen.getByText("p1", { selector: "header code" })).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.workspace.targetNetwork:{"name":"Orders network"}'),
    ).toBeInTheDocument();
    expect(screen.getByText('bknProject.workspace.live:{"version":"1.0.0"}')).toBeInTheDocument();
  });

  it("lays the overview out as info, four tiles, the model and two columns, with no alert", async () => {
    const { container } = renderScene();
    await screen.findByText("Delivery warning");

    const regions = [...container.querySelectorAll("[data-region]")].map((node) =>
      node.getAttribute("data-region"),
    );
    expect(regions).toEqual(["info", "stats", "model", "columns"]);
    expect(container.querySelectorAll('[data-region="stats"] > *')).toHaveLength(4);
    // The instance tile has no page in the community image, so only three tiles open one.
    expect(container.querySelectorAll('[data-region="stats"] > button')).toHaveLength(3);
    expect(container.querySelector(".ant-alert")).toBeNull();
    expect(
      screen.getByText('bknProject.overview.tiles.sourcesValue:{"count":2}'),
    ).toBeInTheDocument();
    expect(screen.getByText("bknProject.list.ownerYou")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("says when the network has no release yet", async () => {
    getLatestReleaseMock.mockResolvedValue(null);
    renderScene();

    expect(await screen.findByText("bknProject.workspace.unpublished")).toBeInTheDocument();
    expect(screen.getByText("bknProject.overview.versions.unpublished")).toBeInTheDocument();
  });

  it("falls back to the network id, and to no version, when they cannot be read", async () => {
    getNetworkMock.mockResolvedValue(null);
    getLatestReleaseMock.mockRejectedValue(new Error("down"));
    renderScene();

    expect(
      await screen.findByText('bknProject.workspace.targetNetwork:{"name":"orders"}'),
    ).toBeInTheDocument();
    expect(screen.queryByText("bknProject.workspace.unpublished")).toBeNull();
  });

  it("answers a project the caller cannot see as not found", async () => {
    getProjectMock.mockRejectedValue({ isAxiosError: true, response: { status: 404, data: {} } });
    renderScene();

    expect(await screen.findByText("bknProject.workspace.notFound")).toBeInTheDocument();
    expect(screen.getByText("bknProject.workspace.backToList")).toBeInTheDocument();
  });

  it("shows a page still under construction", async () => {
    renderScene("model");

    expect(await screen.findByText("bknProject.workspace.comingSoon")).toBeInTheDocument();
    expect(
      screen.getByText("bknProject.workspace.sections.model", { selector: "h2" }),
    ).toBeInTheDocument();
  });
});
