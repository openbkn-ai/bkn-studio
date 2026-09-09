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
  useAppServices: () => ({ message: { success: vi.fn() }, modal: { confirm: modalConfirmMock } }),
}));

const createBuildTaskMock = vi.hoisted(() => vi.fn());
const listBuildTaskPageMock = vi.hoisted(() => vi.fn());
const resumeBuildTaskMock = vi.hoisted(() => vi.fn());
const modalConfirmMock = vi.hoisted(() => vi.fn<(config: { onOk: () => Promise<void> }) => void>());

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  BuildTaskConflictError: class BuildTaskConflictError extends Error {},
  createBuildTask: createBuildTaskMock,
  listBuildTaskPage: listBuildTaskPageMock,
  resumeBuildTask: resumeBuildTaskMock,
}));

vi.mock("@/modules/model-resources/services/small-model.service", () => ({
  listSmallModels: vi.fn().mockResolvedValue({ items: [] }),
}));

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  indexConfig: { incrementalFields: ["id"], primaryKeyFields: ["id"] },
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
  expectedUpdateTime: 0,
};

describe("BuildTaskLaunchPanel", () => {
  beforeEach(() => {
    createBuildTaskMock.mockReset();
    listBuildTaskPageMock.mockReset();
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
    resumeBuildTaskMock.mockReset();
    modalConfirmMock.mockReset();
    modalConfirmMock.mockImplementation(({ onOk }) => {
      void onOk();
    });
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

  it("loads only the latest active task for the resource", async () => {
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={resource}
      />,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith({
      direction: "desc",
      limit: 1,
      resourceId: resource.id,
      sort: "create_time",
      statuses: ["pending", "running", "stopping"],
    }));
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

    expect(modalConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "dataCatalog.build.startBuildConfirmTitle",
    }));

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

  it("requires confirmation before building with excluded schema fields", async () => {
    const excludedFieldResource: CatalogResource = {
      ...resource,
      schema: [
        ...resource.schema,
        { name: "attachment", originalType: "bytea", type: "binary" },
        { name: "interests", originalType: "_text", type: "other" },
      ],
    };

    modalConfirmMock.mockImplementation(() => undefined);

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={excludedFieldResource}
      />,
    );

    expect(await screen.findByText("dataCatalog.build.excludedSchemaFieldsHint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));

    expect(modalConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "dataCatalog.build.excludedSchemaFieldsConfirmTitle",
    }));
    expect(createBuildTaskMock).not.toHaveBeenCalled();

    await modalConfirmMock.mock.calls[0][0].onOk();
    expect(createBuildTaskMock).toHaveBeenCalledWith({
      executeType: "full",
      mode: "batch",
      resourceId: resource.id,
    });
  });
});
