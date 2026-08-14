/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import {
  BuildTaskLaunchPanel,
  STREAMING_BUILD_ENTRY_ENABLED,
} from "./BuildTaskLaunchPanel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() } }),
}));

const createBuildTaskMock = vi.hoisted(() => vi.fn());
const listBuildTasksMock = vi.hoisted(() => vi.fn());
const resumeBuildTaskMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  BuildTaskConflictError: class BuildTaskConflictError extends Error {},
  createBuildTask: createBuildTaskMock,
  listBuildTasks: listBuildTasksMock,
  resumeBuildTask: resumeBuildTaskMock,
}));

vi.mock("@/modules/model-resources/services/small-model.service", () => ({
  listSmallModels: vi.fn().mockResolvedValue({ items: [] }),
}));

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  indexConfig: { buildKeyFields: ["id"] },
  name: "orders",
  rowCount: 1,
  schema: [
    { name: "id", type: "integer" },
    {
      features: [{ featureType: "vector" }],
      name: "content",
      type: "string",
    },
  ],
  sourceIdentifier: "orders",
  updateTime: "2026-07-27T00:00:00Z",
  updatedAt: 0,
};

describe("BuildTaskLaunchPanel", () => {
  beforeEach(() => {
    createBuildTaskMock.mockReset();
    listBuildTasksMock.mockReset();
    listBuildTasksMock.mockResolvedValue([]);
    resumeBuildTaskMock.mockReset();
  });

  it("keeps streaming disabled and exposes the persisted incremental batch entry", () => {
    expect(STREAMING_BUILD_ENTRY_ENABLED).toBe(false);

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={resource}
      />,
    );

    expect(screen.getByText("dataCatalog.build.batchLabel")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.streamingLabel")).toBeNull();
    expect(screen.getByText("dataCatalog.build.executeIncremental")).toBeTruthy();
  });

  it("does not issue a second start request after task creation", async () => {
    const onStarted = vi.fn();
    createBuildTaskMock.mockResolvedValue({ id: "task-running", status: "running" });

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={onStarted}
        resource={resource}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));

    await waitFor(() => {
      expect(createBuildTaskMock).toHaveBeenCalledWith({
        executeType: "full",
        mode: "batch",
        resourceId: resource.id,
      });
    });
    expect(resumeBuildTaskMock).not.toHaveBeenCalled();
    expect(onStarted).toHaveBeenCalledWith({ id: "task-running", status: "running" });
  });

  it("blocks a build when the schema contains an other-type field", async () => {
    const blockedResource: CatalogResource = {
      ...resource,
      schema: [...resource.schema, { name: "interests", originalType: "_text", type: "other" }],
    };

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={blockedResource}
      />,
    );

    expect(await screen.findByText("dataCatalog.build.unsupportedSchemaFields")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(createBuildTaskMock).not.toHaveBeenCalled();
  });
});
