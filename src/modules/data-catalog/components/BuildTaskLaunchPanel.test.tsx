/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import { BuildTaskLaunchPanel, STREAMING_BUILD_ENTRY_ENABLED } from "./BuildTaskLaunchPanel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { value?: string }) =>
      key === "common.error.details" ? (options?.value ?? key) : key,
  }),
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
      features: [
        { config: { ignore_above: 256 }, featureType: "keyword" },
        { featureType: "vector" },
      ],
      name: "content",
      type: "string",
    },
  ],
  sourceIdentifier: "orders",
  updateTime: "2026-07-27T00:00:00Z",
  expectedUpdateTime: 0,
};

const publishedResource: CatalogResource = {
  ...resource,
  localIndexName: "orders-local",
  localIndexStatus: "available",
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

  it.each(["decimal(12,2)", "decimal(38,0)", "number(2,-3)", "numeric(3,5)"])(
    "keeps declared %s buildable",
    async (originalType) => {
      render(
        <BuildTaskLaunchPanel
          active
          onGoConfigure={vi.fn()}
          onStarted={vi.fn()}
          resource={{
            ...resource,
            schema: [...resource.schema, { name: "price", type: "decimal", originalType }],
          }}
        />,
      );
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: /dataCatalog\.build\.startBuild/ })
            .hasAttribute("disabled"),
        ).toBe(false),
      );
      expect(screen.queryByText("dataCatalog.build.decimalSchemaUnsupported")).toBeNull();
    },
  );

  it("blocks decimals without an indexable declaration before confirmation", async () => {
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={{
          ...resource,
          schema: [...resource.schema, { name: "price", type: "decimal", originalType: "numeric" }],
        }}
      />,
    );
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalled());
    expect(await screen.findByText("dataCatalog.build.decimalSchemaUnsupported")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /dataCatalog\.build\.startBuild/ })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(modalConfirmMock).not.toHaveBeenCalled();
    expect(createBuildTaskMock).not.toHaveBeenCalled();
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

  it("queues the selected incremental build using the existing request fields", async () => {
    const queuedTask = {
      id: "incremental-task",
      status: "pending",
      mode: "batch",
      executeType: "incremental",
    };
    createBuildTaskMock.mockResolvedValue(queuedTask);
    const onStarted = vi.fn();
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={onStarted}
        resource={publishedResource}
      />,
    );
    const start = screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ });
    await waitFor(() => expect(start).toBeEnabled());
    const full = screen.getByRole("radio", { name: /dataCatalog\.build\.executeFull/ });
    const incremental = screen.getByRole("radio", {
      name: /dataCatalog\.build\.executeIncremental/,
    });
    expect(full).toBeChecked();
    fireEvent.click(incremental);
    expect(incremental).toBeChecked();
    fireEvent.click(full);
    expect(full).toBeChecked();
    fireEvent.click(incremental);
    fireEvent.click(start);
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(queuedTask));
    expect(createBuildTaskMock).toHaveBeenCalledExactlyOnceWith({
      resourceId: resource.id,
      mode: "batch",
      executeType: "incremental",
    });
    expect(start).toBeDisabled();
  });

  it("allows a full build with only a primary key and explains the source-change risk", async () => {
    createBuildTaskMock.mockResolvedValue({ id: "full-task" });
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={{ ...resource, indexConfig: { primaryKeyFields: ["id"] } }}
      />,
    );

    const start = screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ });
    const full = screen.getByRole("radio", { name: /dataCatalog\.build\.executeFull/ });
    const incremental = screen.getByRole("radio", {
      name: /dataCatalog\.build\.executeIncremental/,
    });
    await waitFor(() => expect(start).toBeEnabled());
    expect(screen.getByText("dataCatalog.build.fullBuildWithoutIncrementalKey")).toBeVisible();
    expect(full).toHaveAccessibleDescription(/dataCatalog\.build\.fullBuildWithoutIncrementalKey/);
    fireEvent.click(incremental);
    expect(screen.getByText("dataCatalog.build.incrementalKeyRequired")).toBeVisible();
    expect(incremental).toHaveAccessibleDescription(/dataCatalog\.build\.incrementalKeyRequired/);
    expect(start).toBeDisabled();
    expect(createBuildTaskMock).not.toHaveBeenCalled();

    fireEvent.click(full);
    fireEvent.click(start);
    await waitFor(() =>
      expect(createBuildTaskMock).toHaveBeenCalledWith({
        resourceId: resource.id,
        mode: "batch",
        executeType: "full",
      }),
    );
  });

  it.each([
    [{ incrementalFields: ["id"] }, "primaryKeyRequired"],
    [{ incrementalFields: ["deleted"], primaryKeyFields: ["id"] }, "invalidKeyFields"],
  ])("blocks a full build with an invalid key configuration", async (indexConfig, error) => {
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={{ ...resource, indexConfig }}
      />,
    );

    expect(await screen.findByText(`dataCatalog.build.${error}`)).toBeVisible();
    expect(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ })).toBeDisabled();
  });

  it.each([
    { localIndexName: undefined, localIndexStatus: "available" },
    { localIndexName: "orders-local", localIndexStatus: "stale" },
    { localIndexName: "orders-local", localIndexStatus: "unavailable" },
  ] as const)("requires a published index for incremental mode", async (localIndex) => {
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={{ ...resource, ...localIndex }}
      />,
    );

    const start = screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /dataCatalog\.build\.executeIncremental/ }));
    expect(screen.getByText("dataCatalog.build.incrementalNeedsPublishedIndex")).toBeVisible();
    expect(start).toBeDisabled();
    expect(modalConfirmMock).not.toHaveBeenCalled();
  });

  it("requires a full rebuild before writing to a read-only published index", async () => {
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={{ ...publishedResource, localIndexStatus: "readonly" }}
      />,
    );

    const start = screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ });
    await waitFor(() => expect(start).toBeEnabled());
    const incremental = screen.getByRole("radio", {
      name: /dataCatalog\.build\.executeIncremental/,
    });
    fireEvent.click(incremental);
    expect(screen.getByText("dataCatalog.build.incrementalRequiresFullRebuild")).toBeVisible();
    expect(incremental).toHaveAccessibleDescription(
      /dataCatalog\.build\.incrementalRequiresFullRebuild/,
    );
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /dataCatalog\.build\.executeFull/ }));
    expect(start).toBeEnabled();
    expect(createBuildTaskMock).not.toHaveBeenCalled();
  });

  it("announces rejected incremental admission and lets the user run a full build", async () => {
    const description = "The saved incremental cursor is invalid.";
    createBuildTaskMock
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 409,
          data: { error_code: "VegaBackend.BuildTask.IncrementalBaselineUnavailable", description },
        },
      })
      .mockResolvedValueOnce({ id: "full-task" });
    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={publishedResource}
      />,
    );

    const start = screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ });
    const incremental = screen.getByRole("radio", {
      name: /dataCatalog\.build\.executeIncremental/,
    });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(incremental);
    expect(incremental).toHaveAccessibleDescription(
      "dataCatalog.build.executeIncrementalDescription",
    );
    fireEvent.click(start);
    const feedback = await screen.findByText(
      i18n.t("dataCatalog.build.incrementalBaselineUnavailable"),
    );
    expect(feedback.closest('[role="alert"]')).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.viewDetails" }));
    expect(screen.getByText(description)).toBeVisible();
    expect(incremental).toBeChecked();
    expect(createBuildTaskMock).toHaveBeenCalledExactlyOnceWith({
      resourceId: resource.id,
      mode: "batch",
      executeType: "incremental",
    });

    fireEvent.click(screen.getByRole("radio", { name: /dataCatalog\.build\.executeFull/ }));
    fireEvent.click(start);
    await waitFor(() =>
      expect(createBuildTaskMock).toHaveBeenNthCalledWith(2, {
        resourceId: resource.id,
        mode: "batch",
        executeType: "full",
      }),
    );
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

    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenCalledWith(
        {
          direction: "desc",
          limit: 1,
          resourceId: resource.id,
          sort: "create_time",
          statuses: ["pending", "running", "stopping"],
        },
        { skipErrorToast: true },
      ),
    );
  });

  it("keeps build controls disabled when active task status cannot be loaded", async () => {
    listBuildTaskPageMock.mockRejectedValue(new Error("task status unavailable"));

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={resource}
      />,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalled());
    expect(
      await screen.findByText("dataCatalog.resourceWorkspace.taskStatusUnavailable"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));
    expect(modalConfirmMock).not.toHaveBeenCalled();
  });

  it("keeps build controls disabled while active task status is still loading", () => {
    listBuildTaskPageMock.mockImplementation(() => new Promise(() => undefined));

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={resource}
      />,
    );

    expect(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ })).toBeDisabled();
    expect(modalConfirmMock).not.toHaveBeenCalled();
  });

  it("allows a build whose persisted index feature is keyword-only", async () => {
    const keywordOnlyResource: CatalogResource = {
      ...resource,
      schema: [
        { name: "id", type: "integer" },
        {
          features: [{ config: { ignore_above: 256 }, featureType: "keyword" }],
          name: "code",
          type: "string",
        },
      ],
    };

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={keywordOnlyResource}
      />,
    );

    expect(screen.queryByText("dataCatalog.build.needConfigFirst")).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /dataCatalog\.build\.startBuild/,
        }),
      ).not.toBeDisabled(),
    );
  });

  it("does not treat editor defaults as persisted build features", () => {
    const legacyTextResource: CatalogResource = {
      ...resource,
      schema: [
        { name: "id", type: "integer" },
        { name: "content", type: "text" },
      ],
    };

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={legacyTextResource}
      />,
    );

    expect(screen.getByText("dataCatalog.build.needConfigFirst")).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: /dataCatalog\.build\.startBuild/,
        })
        .hasAttribute("disabled"),
    ).toBe(true);
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

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "dataCatalog.build.startBuildConfirmTitle",
      }),
    );

    await waitFor(() => {
      expect(createBuildTaskMock).toHaveBeenCalledWith({
        executeType: "full",
        mode: "batch",
        resourceId: resource.id,
      });
    });
    expect(resumeBuildTaskMock).not.toHaveBeenCalled();
    expect(onStarted).toHaveBeenCalledWith({ id: "task-running", status: "running" });
    expect(screen.getByText("dataCatalog.build.activeTaskLocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));
    expect(createBuildTaskMock).toHaveBeenCalledTimes(1);
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.build\.startBuild/ }));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "dataCatalog.build.excludedSchemaFieldsConfirmTitle",
      }),
    );
    expect(createBuildTaskMock).not.toHaveBeenCalled();

    await modalConfirmMock.mock.calls[0][0].onOk();
    expect(createBuildTaskMock).toHaveBeenCalledWith({
      executeType: "full",
      mode: "batch",
      resourceId: resource.id,
    });
  });
});
