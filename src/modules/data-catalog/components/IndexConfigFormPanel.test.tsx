/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BuildTask,
  CatalogResource,
  ResourceUpdateInput,
} from "@/modules/data-catalog/types/data-catalog";

const translateMock = vi.hoisted(() =>
  vi.fn((key: string, options?: { value?: string }) =>
    options?.value && key.startsWith("common.error.") ? `${key}: ${options.value}` : key,
  ),
);
const messageErrorMock = vi.hoisted(() => vi.fn());
const loadAnalyzerCapabilitiesMock = vi.hoisted(() => vi.fn());
const loadEmbeddingModelOptionsMock = vi.hoisted(() => vi.fn());
const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const listBuildTaskPageMock = vi.hoisted(() => vi.fn());
const updateCatalogResourceMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translateMock }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: messageErrorMock, success: vi.fn() } }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTaskPage: listBuildTaskPageMock,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
  updateCatalogResource: updateCatalogResourceMock,
}));

vi.mock("@/modules/data-catalog/utils/analyzer-capabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/data-catalog/utils/analyzer-capabilities")>()),
  loadAnalyzerCapabilities: loadAnalyzerCapabilitiesMock,
}));

vi.mock("@/modules/data-catalog/utils/embedding-model-options", () => ({
  findUnregisteredEmbeddingModel: vi.fn().mockReturnValue(null),
  isRegisteredEmbeddingModel: vi.fn().mockReturnValue(true),
  loadEmbeddingModelOptions: loadEmbeddingModelOptionsMock,
  pickRegisteredEmbeddingModelId: vi.fn().mockReturnValue(undefined),
}));

import { dataCatalogZhCN } from "@/modules/data-catalog/locales/zh-CN";
import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";

import { IndexConfigFormPanel } from "./IndexConfigFormPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "title", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  expectedUpdateTime: 0,
};

describe("IndexConfigFormPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translateMock.mockImplementation((key: string, options?: { value?: string }) =>
      options?.value && key.startsWith("common.error.") ? `${key}: ${options.value}` : key,
    );
    getCatalogResourceMock.mockReset().mockResolvedValue(resource);
    listBuildTaskPageMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    updateCatalogResourceMock.mockReset();
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard"],
      state: "ready",
    });
    loadEmbeddingModelOptionsMock.mockResolvedValue({
      errorMessage: null,
      options: [{ dimensions: 1024, id: "model-1", name: "Model 1" }],
      state: "ready",
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("preserves analyzer capabilities when the same resource is refreshed", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1));

    rerender(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={{ ...resource }} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("dataCatalog.build.analyzersLoading")).toBeNull();
  });

  it("shows capability checking instead of incomplete configuration while analyzers load", () => {
    loadAnalyzerCapabilitiesMock.mockReturnValue(new Promise(() => undefined));
    const textResource: CatalogResource = {
      ...resource,
      indexConfig: {
        defaultFulltextAnalyzer: "standard",
        incrementalFields: ["id"],
        primaryKeyFields: ["id"],
      },
      schema: [
        { name: "id", type: "integer" },
        {
          features: [
            { config: { ignore_above: 256 }, featureType: "keyword" },
            { config: { analyzer: "standard" }, featureType: "fulltext" },
          ],
          name: "content",
          type: "text",
        },
      ],
    };

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={textResource} />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.build.configChecking")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.configCannotBuild")).toBeNull();
  });

  it("loads only the latest active task when configuring an index", async () => {
    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
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

  it("keeps configuration editing locked when task status cannot be loaded", async () => {
    listBuildTaskPageMock.mockRejectedValue(new Error("task status unavailable"));
    render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks resource={resource} />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("dataCatalog.resourceWorkspace.taskStatusUnavailable"),
    ).toBeInTheDocument();
    expect(listBuildTaskPageMock).toHaveBeenCalledWith(
      {
        direction: "desc",
        limit: 1,
        resourceId: resource.id,
        sort: "create_time",
        statuses: ["pending", "running", "stopping"],
      },
      { skipErrorToast: true },
    );
    expect(
      screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("keeps configuration editing locked until task status is confirmed", () => {
    listBuildTaskPageMock.mockImplementation(() => new Promise(() => undefined));
    render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks resource={resource} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }),
    ).toBeDisabled();
  });

  it("shows type, source display name, and field name for primary and incremental keys", async () => {
    const keyResource: CatalogResource = {
      ...resource,
      schema: [
        { name: "id", displayName: "订单ID", type: "integer" },
        { name: "updated_at", displayName: "updated_at", type: "datetime" },
      ],
      indexConfig: { primaryKeyFields: ["id"], incrementalFields: ["updated_at"] },
    };
    getCatalogResourceMock.mockResolvedValue(keyResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={keyResource} />
      </MemoryRouter>,
    );

    const primarySummary = screen
      .getAllByText("dataCatalog.build.rolePrimaryKey")
      .find((node) => !node.closest("label"))
      ?.closest('[class*="configMetric"]') as HTMLElement;
    const incrementalSummary = screen
      .getAllByText("dataCatalog.build.roleIncrementalKey")
      .find((node) => !node.closest("label"))
      ?.closest('[class*="configMetric"]') as HTMLElement;
    expect(within(primarySummary).getByText("int")).toBeTruthy();
    expect(within(primarySummary).getByText("订单ID")).toBeTruthy();
    expect(within(primarySummary).getByText("id")).toBeTruthy();
    expect(within(incrementalSummary).getByText("datetime")).toBeTruthy();
    expect(within(incrementalSummary).getAllByText("updated_at")).toHaveLength(2);

    const primary = screen
      .getAllByText("dataCatalog.build.rolePrimaryKey")
      .find((node) => node.closest("label"))
      ?.closest("label") as HTMLElement;
    const incremental = screen
      .getAllByText("dataCatalog.build.roleIncrementalKey")
      .find((node) => node.closest("label"))
      ?.closest("label") as HTMLElement;
    await waitFor(() => {
      expect(within(primary).getByText("int")).toBeTruthy();
      expect(within(primary).getByText("订单ID")).toBeTruthy();
      expect(within(primary).getByText("id")).toBeTruthy();
      expect(within(incremental).getByText("datetime")).toBeTruthy();
      expect(within(incremental).getAllByText("updated_at")).toHaveLength(2);
    });

    fireEvent.mouseDown(within(primary).getByRole("combobox"));
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    expect(within(dropdown).getByText("int")).toBeTruthy();
    expect(within(dropdown).getByText("订单ID")).toBeTruthy();
    expect(
      within(dropdown)
        .getAllByText("id")
        .some((node) => node.tagName === "SMALL"),
    ).toBe(true);
  });

  it("checks task status before editing when task access becomes available", async () => {
    listBuildTaskPageMock.mockImplementation(() => new Promise(() => undefined));
    const { rerender } = render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks={false} resource={resource} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "dataCatalog.build.saveIndexConfig",
        }),
      ).toBeEnabled(),
    );

    rerender(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks resource={resource} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }),
    ).toBeDisabled();
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledTimes(1));
  });

  it("does not query task history without task_manage but keeps configuration editable", async () => {
    updateCatalogResourceMock.mockResolvedValue(resource);
    render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks={false} resource={resource} />
      </MemoryRouter>,
    );

    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.saveIndexConfig",
      }),
    );
    await waitFor(() => expect(updateCatalogResourceMock).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["VegaBackend.BuildTask.Exist", "dataCatalog.build.activeTaskLocked"],
    ["VegaBackend.BuildTask.HasRunningExecution", "dataCatalog.build.activeTaskLocked"],
    ["VegaBackend.Resource.UpdateConflict", "dataCatalog.build.resourceUpdateConflict"],
  ])("reports backend conflict %s with the appropriate message", async (code, expectedMessage) => {
    const conflictError = new AxiosError("Build task running", undefined, undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      data: {
        description: "A build task is running",
        error_code: code,
      },
      headers: new AxiosHeaders(),
      status: 409,
      statusText: "Conflict",
    });
    updateCatalogResourceMock.mockRejectedValue(conflictError);
    render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks={false} resource={resource} />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.saveIndexConfig",
      }),
    );
    await waitFor(() => expect(updateCatalogResourceMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    expect(
      screen.queryByText(
        expectedMessage === "dataCatalog.build.resourceUpdateConflict"
          ? "dataCatalog.build.activeTaskLocked"
          : "dataCatalog.build.resourceUpdateConflict",
      ),
    ).toBeNull();
  });

  it.each([
    [
      "zh-CN",
      "dataset",
      409,
      "VegaBackend.InvalidParameter.RequestBody",
      "已有 Dataset 的索引结构或全文字段分词器无法直接修改，需要重建 Dataset 后再应用新配置。",
    ],
    [
      "en-US",
      "dataset",
      409,
      "VegaBackend.InvalidParameter.RequestBody",
      "The existing Dataset index structure or fulltext field analyzer cannot be changed directly. Rebuild the Dataset to apply the new configuration.",
    ],
    [
      "zh-CN",
      "dataset",
      409,
      "VegaBackend.Resource.UpdateConflict",
      "资源已被其他请求更新，请刷新页面后重新修改并保存索引配置。",
    ],
    [
      "en-US",
      "dataset",
      409,
      "VegaBackend.Resource.UpdateConflict",
      "Another request updated this resource. Refresh the page, then edit and save the index configuration again.",
    ],
    [
      "zh-CN",
      "dataset",
      409,
      "VegaBackend.BuildTask.Exist",
      dataCatalogZhCN.dataCatalog.build.activeTaskLocked,
    ],
    [
      "en-US",
      "dataset",
      409,
      "VegaBackend.BuildTask.HasRunningExecution",
      dataCatalogEnUS.dataCatalog.build.activeTaskLocked,
    ],
    [
      "zh-CN",
      "dataset",
      409,
      "Unknown.Conflict",
      "索引配置保存发生冲突，请刷新资源并检查配置后重试。",
    ],
    [
      "en-US",
      "table",
      409,
      "VegaBackend.InvalidParameter.RequestBody",
      "The index configuration could not be saved due to a conflict. Refresh the resource and review the configuration before retrying.",
    ],
    ["zh-CN", "dataset", 400, "VegaBackend.InvalidParameter.RequestBody", "Invalid analyzer"],
    ["en-US", "dataset", 500, "Internal.Error", "Service unavailable"],
    ["zh-CN", "dataset", 0, "", "Network Error"],
  ] as const)(
    "shows consistent actionable errors for %s %s %s %s",
    async (locale, category, status, code, expectedMessage) => {
      const translations = locale === "zh-CN" ? dataCatalogZhCN : dataCatalogEnUS;
      translateMock.mockImplementation((key: string) => {
        const prefix = "dataCatalog.build.";
        return key.startsWith(prefix)
          ? (((translations.dataCatalog.build as Record<string, unknown>)[
              key.slice(prefix.length)
            ] as string) ?? key)
          : key;
      });
      const dataset: CatalogResource = {
        ...resource,
        category,
        indexConfig: { defaultFulltextAnalyzer: "standard" },
        schema: [{ name: "content", type: "string", features: [{ featureType: "fulltext" }] }],
      };
      loadAnalyzerCapabilitiesMock.mockResolvedValue({
        errorMessage: null,
        options: ["standard", "english"],
        state: "ready",
      });
      getCatalogResourceMock.mockResolvedValue(dataset);
      const onSaved = vi.fn();
      updateCatalogResourceMock.mockRejectedValue(
        status === 0
          ? new AxiosError("Network Error")
          : new AxiosError("Request failed", undefined, undefined, undefined, {
              config: { headers: new AxiosHeaders() },
              data: {
                error_code: code,
                description:
                  expectedMessage === "Invalid analyzer" ||
                  expectedMessage === "Service unavailable"
                    ? expectedMessage
                    : "无效的请求体",
                error_details:
                  locale === "zh-CN"
                    ? 'dataset fulltext analyzer for field "content" cannot be changed on an existing index; rebuild the dataset instead'
                    : undefined,
              },
              headers: {},
              status,
              statusText: "Request failed",
            }),
      );
      render(
        <MemoryRouter>
          <IndexConfigFormPanel active canViewTasks={false} resource={dataset} onSaved={onSaved} />
        </MemoryRouter>,
      );
      const changesAnalyzer =
        category === "dataset" &&
        status === 409 &&
        code === "VegaBackend.InvalidParameter.RequestBody";
      if (changesAnalyzer) {
        await waitFor(() =>
          expect(screen.queryByText("dataCatalog.build.analyzersLoading")).toBeNull(),
        );
        fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByText("dataCatalog.build.analyzers.english"));
      }
      fireEvent.click(
        await screen.findByRole("button", { name: translations.dataCatalog.build.saveIndexConfig }),
      );
      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(messageErrorMock).toHaveBeenCalledExactlyOnceWith(expectedMessage);
      expect(updateCatalogResourceMock).toHaveBeenCalledWith(resource.id, expect.anything(), {
        skipErrorToast: true,
      });
      expect(onSaved).not.toHaveBeenCalled();
      if (changesAnalyzer) {
        const [, payload] = updateCatalogResourceMock.mock.calls[0] as [
          string,
          ResourceUpdateInput,
        ];
        expect(payload.indexConfig?.defaultFulltextAnalyzer).toBe("english");
        expect(payload.schema[0]?.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ featureType: "fulltext", config: { analyzer: "english" } }),
          ]),
        );
        expect(screen.getAllByText("dataCatalog.build.analyzers.english").length).toBeGreaterThan(
          0,
        );
        expect(dataset.indexConfig?.defaultFulltextAnalyzer).toBe("standard");
        expect(listBuildTaskPageMock).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    [
      "Unknown.Conflict",
      "dataCatalog.build.configConflict",
      "Resource cannot be updated in its current state",
      "Enable the resource before editing its index",
    ],
    [
      "Unknown.DescriptionOnly",
      "dataCatalog.build.configConflict",
      "Resource is archived",
      undefined,
    ],
    [
      "VegaBackend.InvalidParameter.RequestBody",
      "dataCatalog.build.datasetRebuildRequired",
      "无效的请求体",
      'dataset fulltext analyzer for field "content" cannot be changed on an existing index; rebuild the dataset instead',
    ],
    [
      "VegaBackend.Resource.UpdateConflict",
      "dataCatalog.build.resourceUpdateConflict",
      "Resource was modified concurrently",
      "Reload the latest resource version",
    ],
  ])(
    "preserves backend diagnostics for conflict %s",
    async (code, summary, description, details) => {
      const dataset: CatalogResource = { ...resource, category: "dataset" };
      getCatalogResourceMock.mockResolvedValue(dataset);
      updateCatalogResourceMock.mockRejectedValue(
        new AxiosError("Conflict", undefined, undefined, undefined, {
          config: { headers: new AxiosHeaders() },
          data: {
            error_code: code,
            description,
            error_details: details,
            solution: "Review the resource configuration",
            error_link: "https://example.com/errors/resource-conflict",
          },
          headers: {},
          status: 409,
          statusText: "Conflict",
        }),
      );
      render(
        <MemoryRouter>
          <IndexConfigFormPanel active canViewTasks={false} resource={dataset} />
        </MemoryRouter>,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "dataCatalog.build.saveIndexConfig" }),
      );
      expect(await screen.findByText(summary)).toBeInTheDocument();
      expect(messageErrorMock).toHaveBeenCalledExactlyOnceWith(summary);
      fireEvent.click(screen.getByRole("button", { name: "common.viewDetails" }));
      expect(screen.getByText(`common.error.code: ${code}`)).toBeInTheDocument();
      const diagnostic = screen.getByText((text) => text.startsWith("common.error.details:"));
      expect(diagnostic).toHaveTextContent(description);
      if (details) expect(diagnostic).toHaveTextContent(details);
      expect(
        screen.getByText("common.error.solution: Review the resource configuration"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("common.error.link: https://example.com/errors/resource-conflict"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "common.hideDetails" }));
      expect(screen.queryByText(`common.error.code: ${code}`)).not.toBeInTheDocument();
    },
  );

  it("drops an in-flight task result when task_manage is revoked", async () => {
    let resolveTasks: ((value: { items: BuildTask[]; total: number }) => void) | null = null;
    listBuildTaskPageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTasks = resolve;
        }),
    );
    const { rerender } = render(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks resource={resource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter>
        <IndexConfigFormPanel active canViewTasks={false} resource={resource} />
      </MemoryRouter>,
    );
    await act(async () => {
      resolveTasks?.({
        items: [
          {
            createTime: 1,
            embeddingFields: [],
            embeddingModel: "",
            error: null,
            finishTime: null,
            fulltextAnalyzer: "",
            fulltextFields: [],
            id: "task-1",
            incrementalFields: [],
            lastProgressTime: null,
            mode: "batch",
            modelDimensions: 0,
            primaryKeyFields: [],
            resourceId: resource.id,
            startTime: 1,
            status: "running",
            syncedCount: 0,
            totalCount: 1,
          } satisfies BuildTask,
        ],
        total: 1,
      });
      await Promise.resolve();
    });

    expect(listBuildTaskPageMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("dataCatalog.build.activeTaskLocked")).toBeNull();
    expect(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" })).toBeEnabled();
  });

  it("allows saving a string resource with only its required keyword feature", async () => {
    updateCatalogResourceMock.mockResolvedValue(resource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    const saveButton = await screen.findByRole("button", {
      name: "dataCatalog.build.saveIndexConfig",
    });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateCatalogResourceMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateCatalogResourceMock.mock.calls[0] as [string, ResourceUpdateInput];
    expect(payload.schema[0]?.features).toContainEqual(
      expect.objectContaining({
        config: { ignore_above: 256 },
        featureType: "keyword",
        name: "keyword",
      }),
    );
  });

  it("only allows renaming generated keyword and fulltext subfields", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [
            { config: { ignore_above: 256 }, featureType: "keyword", name: "keyword" },
            { config: { analyzer: "standard" }, featureType: "fulltext", name: "search" },
          ],
          name: "title",
          type: "string",
        },
      ],
    };

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={configuredResource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalled());
    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.featureConfig",
      }),
    );
    await screen.findByRole("dialog");
    const featureNameInputs = screen.getAllByPlaceholderText(
      "dataCatalog.build.featureNamePlaceholder",
    );
    const keywordName = featureNameInputs.find(
      (input) => input.getAttribute("value") === "keyword",
    );
    const fulltextName = featureNameInputs.find(
      (input) => input.getAttribute("value") === "search",
    );
    expect(keywordName?.hasAttribute("disabled")).toBe(true);
    expect(fulltextName?.hasAttribute("disabled")).toBe(false);
    fireEvent.mouseEnter(keywordName?.parentElement as HTMLElement);
    expect(await screen.findByText("dataCatalog.build.fixedFeatureNameHint")).toBeTruthy();
  });

  it("rejects feature names qualified with their property name", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [
            { config: { ignore_above: 256 }, featureType: "keyword", name: "keyword" },
            { config: { analyzer: "standard" }, featureType: "fulltext", name: "fulltext" },
          ],
          name: "title",
          type: "text",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(configuredResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={configuredResource} />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.featureConfig",
      }),
    );
    const keywordName = await screen.findByDisplayValue("keyword");
    fireEvent.change(keywordName, { target: { value: "title.keyword" } });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));

    expect(
      screen.getAllByText("dataCatalog.build.featureNameMustBeRelative").length,
    ).toBeGreaterThan(0);
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("paginates field feature configuration with ten fields per page", async () => {
    const pagedResource: CatalogResource = {
      ...resource,
      schema: Array.from({ length: 11 }, (_, index) => ({
        name: `field_${index + 1}`,
        type: "string",
      })),
    };

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={pagedResource} />
      </MemoryRouter>,
    );

    expect(screen.getByText("field_1")).toBeTruthy();
    expect(screen.queryByText("field_11")).toBeNull();

    fireEvent.click(screen.getByTitle("2"));

    expect(await screen.findByText("field_11")).toBeTruthy();
    expect(screen.queryByText("field_1")).toBeNull();
  });

  it("keeps vector and full-text metrics visible when build controls are hidden", () => {
    render(
      <MemoryRouter>
        <IndexConfigFormPanel
          active
          hideBuildControls
          resource={{
            ...resource,
            schema: [
              {
                features: [
                  { config: { embedding_model: "model-1" }, featureType: "vector" },
                  { config: { analyzer: "standard" }, featureType: "fulltext" },
                ],
                name: "title",
                type: "string",
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryAllByText("dataCatalog.build.roleEmbedding").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("dataCatalog.build.roleFulltext").length).toBeGreaterThan(0);
    expect(screen.queryByText("dataCatalog.build.configCanBuild")).toBeNull();
  });

  it("hides and removes build key fields for datasets", async () => {
    const datasetResource: CatalogResource = {
      ...resource,
      category: "dataset",
      indexConfig: {
        incrementalFields: ["title"],
        primaryKeyFields: ["title"],
      },
    };
    getCatalogResourceMock.mockResolvedValue(datasetResource);
    updateCatalogResourceMock.mockResolvedValue(datasetResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={datasetResource} />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dataCatalog.build.rolePrimaryKey")).toBeNull();
    expect(screen.queryByText("dataCatalog.build.roleIncrementalKey")).toBeNull();
    expect(screen.queryByText("dataCatalog.build.configCanBuild")).toBeNull();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.saveIndexConfig",
      }),
    );

    await waitFor(() => expect(updateCatalogResourceMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateCatalogResourceMock.mock.calls[0] as [string, ResourceUpdateInput];
    expect(payload.indexConfig?.primaryKeyFields).toBeUndefined();
    expect(payload.indexConfig?.incrementalFields).toBeUndefined();
  });

  it("allows inspecting feature configuration but does not submit it when read-only", async () => {
    render(
      <MemoryRouter>
        <IndexConfigFormPanel
          active
          readOnly
          resource={{
            ...resource,
            indexConfig: { primaryKeyFields: ["missing_field"] },
            schema: [
              {
                features: [
                  { config: { ignore_above: 256 }, featureType: "keyword", name: "keyword" },
                ],
                name: "title",
                type: "string",
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", {
        name: "dataCatalog.build.saveIndexConfig",
      }),
    ).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "dataCatalog.build.featureConfig",
      }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    for (const input of screen.getAllByDisplayValue("256")) {
      expect(input).toBeDisabled();
    }
    expect(
      screen.queryByRole("button", {
        name: "dataCatalog.build.removeInvalidKeyFields",
      }),
    ).toBeNull();
    expect(screen.queryByText("dataCatalog.build.activeTaskLocked")).toBeNull();
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("configures the required keyword feature for a text field", { timeout: 20_000 }, async () => {
    const textResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["id"], primaryKeyFields: ["id"] },
      schema: [
        { name: "id", type: "string" },
        {
          features: [
            { config: { analyzer: "standard" }, featureType: "fulltext" },
            { config: { embedding_model: "model-1" }, featureType: "vector" },
          ],
          description: "Searchable title",
          name: "title",
          originalDescription: "",
          originalName: "source_title",
          originalType: "longtext",
          type: "text",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(textResource);
    updateCatalogResourceMock.mockResolvedValue(textResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={textResource} />
      </MemoryRouter>,
    );

    const featureButtons = await screen.findAllByRole("button", {
      name: "dataCatalog.build.featureConfig",
    });
    const titleRow = screen
      .getAllByRole("row")
      .find((row) => row.querySelector("code")?.textContent === "title");
    expect(
      Array.from(titleRow?.querySelectorAll("[data-feature-type]") ?? []).map((tag) =>
        tag.getAttribute("data-feature-type"),
      ),
    ).toEqual(["keyword", "fulltext", "embedding"]);

    fireEvent.click(featureButtons[1]);
    const featureDrawer = await screen.findByRole("dialog");
    expect(
      Array.from(featureDrawer.querySelectorAll("[data-field-meta]")).map((item) =>
        item.getAttribute("data-field-meta"),
      ),
    ).toEqual([
      "name",
      "display-name",
      "type",
      "description",
      "original-name",
      "original-type",
      "original-description",
    ]);
    expect(featureDrawer.querySelector('[data-field-meta="name"]')?.textContent).toContain("title");
    expect(featureDrawer.querySelector('[data-field-meta="original-name"]')?.textContent).toContain(
      "source_title",
    );
    expect(featureDrawer.querySelector('[data-field-meta="original-type"]')?.textContent).toContain(
      "longtext",
    );
    expect(featureDrawer.querySelector('[data-field-meta="description"]')?.textContent).toContain(
      "Searchable title",
    );
    expect(
      featureDrawer.querySelector('[data-field-meta="original-description"]')?.textContent,
    ).toContain("-");
    expect(
      Array.from(featureDrawer.querySelectorAll("[data-feature-type]")).map((section) =>
        section.getAttribute("data-feature-type"),
      ),
    ).toEqual(["keyword", "fulltext", "embedding"]);
    const nameInput = await screen.findByDisplayValue("keyword");
    const defaultLimitInput = screen.getByDisplayValue("256");
    const fieldLimitInput = screen.getByPlaceholderText(
      "dataCatalog.build.inheritDefaultWithValue",
    );
    expect(defaultLimitInput.getAttribute("min")).toBe("1");
    expect(defaultLimitInput.getAttribute("max")).toBe("8191");
    expect(fieldLimitInput.getAttribute("min")).toBe("1");
    expect(fieldLimitInput.getAttribute("max")).toBe("8191");

    fireEvent.change(defaultLimitInput, { target: { value: "8192" } });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));
    expect(
      screen.getAllByText("dataCatalog.build.defaultKeywordIgnoreAboveInvalid").length,
    ).toBeGreaterThan(0);
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();

    fireEvent.change(defaultLimitInput, { target: { value: "512" } });
    fireEvent.change(fieldLimitInput, { target: { value: "8192" } });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));
    expect(
      screen.getAllByText("dataCatalog.build.keywordIgnoreAboveInvalid").length,
    ).toBeGreaterThan(0);
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();

    fireEvent.change(fieldLimitInput, { target: { value: "" } });
    fireEvent.change(nameInput, { target: { value: "exact" } });

    expect(
      screen.getByTitle("dataCatalog.build.keywordRequiredHint").getAttribute("disabled"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));

    await waitFor(() => expect(updateCatalogResourceMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateCatalogResourceMock.mock.calls[0] as [string, ResourceUpdateInput];
    expect(payload.indexConfig?.defaultKeywordIgnoreAbove).toBe(512);
    const titleField = payload.schema.find((field) => field.name === "title");
    const { features = [] } = titleField ?? {};
    const keyword = features.find((feature) => feature.featureType === "keyword");
    expect(keyword?.name).toBe("exact");
    expect(keyword?.config).toEqual({ ignore_above: 512 });
  });

  it("rejects duplicate physical feature names across feature types", async () => {
    const duplicateNameResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [
            { featureType: "keyword", name: "search", config: { ignore_above: 256 } },
            { featureType: "fulltext", name: "search", config: { analyzer: "standard" } },
          ],
          name: "title",
          type: "text",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(duplicateNameResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={duplicateNameResource} />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "dataCatalog.build.saveIndexConfig" }),
    );

    expect(screen.getAllByText("dataCatalog.build.duplicateFeatureNames").length).toBeGreaterThan(
      0,
    );
    expect(updateCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("preserves freshly generated semantic metadata when saving index config", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["title"], primaryKeyFields: ["title"] },
      schema: [
        {
          features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    const semanticResource: CatalogResource = {
      ...configuredResource,
      description: "Monthly parking pass records",
      enabled: false,
      expectedUpdateTime: 200,
      name: "Monthly passes",
      schema: [
        {
          description: "Unique monthly pass identifier",
          displayName: "Pass ID",
          features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(semanticResource);
    updateCatalogResourceMock.mockResolvedValue(semanticResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={semanticResource} />
      </MemoryRouter>,
    );

    const keySummaries = await screen.findAllByTitle("Pass ID（title）");
    expect(keySummaries).toHaveLength(2);
    for (const summary of keySummaries) {
      expect(within(summary).getByTitle("string")).toBeTruthy();
      expect(within(summary).getByText("Pass ID")).toBeTruthy();
      expect(within(summary).getByText("title")).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));

    await waitFor(() => {
      expect(updateCatalogResourceMock).toHaveBeenCalledWith(
        "resource-1",
        expect.objectContaining({
          description: semanticResource.description,
          enabled: false,
          expectedUpdateTime: semanticResource.expectedUpdateTime,
          name: semanticResource.name,
          schema: [
            expect.objectContaining({
              description: "Unique monthly pass identifier",
              displayName: "Pass ID",
              name: "title",
            }),
          ],
        }),
        { skipErrorToast: true },
      );
    });
  });

  it("explains the Chinese-search limitation when no Chinese analyzer is enabled", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "english"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint");
    expect(screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerAvailableHint")).toBeNull();
  });

  it("recognizes other IK analyzers returned by the server", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { analyzer: "ik_smart" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "ik_smart"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.fulltextChineseAnalyzerAvailableHint");
    expect(
      screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint"),
    ).toBeNull();
  });

  it("does not show Chinese analyzer guidance for a resource without full-text fields", async () => {
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "english"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText("dataCatalog.build.analyzersLoading")).toBeNull(),
    );
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    await screen.findByText("dataCatalog.build.analyzers.english");
    expect(
      screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint"),
    ).toBeNull();
  });

  it("allows removing configured key fields that no longer exist in the schema", async () => {
    const staleKeyResource: CatalogResource = {
      ...resource,
      indexConfig: {
        incrementalFields: ["removed_order_no"],
        primaryKeyFields: ["removed_order_no"],
      },
    };
    getCatalogResourceMock.mockResolvedValue(staleKeyResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={staleKeyResource} />
      </MemoryRouter>,
    );

    const removeButton = await screen.findByRole("button", {
      name: "dataCatalog.build.removeInvalidKeyFields",
    });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "dataCatalog.build.removeInvalidKeyFields" }),
      ).toBeNull();
    });
  });

  it("does not mark a feature-only configuration as buildable", async () => {
    const featureOnlyResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { embedding_model: "model-1" }, featureType: "vector" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(featureOnlyResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={featureOnlyResource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("dataCatalog.build.configCannotBuild")).toBeTruthy();
  });

  it("keeps resource key fields when an active task has no configuration snapshot", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["title"], primaryKeyFields: ["title"] },
      schema: [
        {
          features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    listBuildTaskPageMock.mockResolvedValue({
      items: [
        {
          createTime: 1,
          embeddingFields: [],
          embeddingModel: "",
          error: null,
          finishTime: null,
          fulltextAnalyzer: "standard",
          fulltextFields: ["title"],
          id: "running-task",
          incrementalFields: [],
          lastProgressTime: null,
          mode: "batch",
          modelDimensions: 0,
          primaryKeyFields: [],
          resourceId: configuredResource.id,
          startTime: 1,
          status: "running",
          syncedCount: 0,
          totalCount: 1,
        } satisfies BuildTask,
      ],
      total: 1,
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={configuredResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.activeTaskLocked");
    expect(screen.getByText("dataCatalog.build.configCanBuild")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.configCannotBuild")).toBeNull();
    const featureConfigButton = screen.getByRole("button", {
      name: "dataCatalog.build.featureConfig",
    });
    expect(featureConfigButton).toBeEnabled();
    fireEvent.click(featureConfigButton);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    for (const addFeatureButton of screen.getAllByRole("button", {
      name: "dataCatalog.build.addFeature",
    })) {
      expect(addFeatureButton).toBeDisabled();
    }
  });

  it("keeps a vector-only resource saveable when analyzer capabilities are unavailable", async () => {
    const vectorResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { embedding_model: "model-1" }, featureType: "vector" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(vectorResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: "capabilities unavailable",
      options: [],
      state: "error",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={vectorResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.analyzersLoadError");
    expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "dataCatalog.build.saveIndexConfig" })
        .getAttribute("disabled"),
    ).toBeNull();
  });

  it("asks for a page refresh without a retry button when analyzer loading fails", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
          name: "title",
          type: "string",
        },
      ],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValueOnce({
      errorMessage: "capabilities unavailable",
      options: [],
      state: "error",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    await screen.findAllByText("dataCatalog.build.analyzersLoadError");
    expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "dataCatalog.build.retryLoadAnalyzers" }),
    ).toBeNull();
    expect(
      screen.getAllByText("dataCatalog.resourceWorkspace.loadErrorRefreshHint"),
    ).not.toHaveLength(0);
  });

  it("asks for a page refresh without an action button when model loading fails", async () => {
    const vectorResource: CatalogResource = {
      ...resource,
      schema: [
        {
          features: [{ config: { embedding_model: "model-1" }, featureType: "vector" }],
          name: "title",
          type: "string",
        },
      ],
    };
    loadEmbeddingModelOptionsMock.mockResolvedValue({
      errorMessage: "models unavailable",
      options: [],
      state: "error",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={vectorResource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadEmbeddingModelOptionsMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "dataCatalog.build.retryLoadModels" })).toBeNull();
    expect(screen.queryByRole("button", { name: "dataCatalog.build.goConnectModel" })).toBeNull();
    expect(
      screen.getAllByText("dataCatalog.resourceWorkspace.loadErrorRefreshHint"),
    ).not.toHaveLength(0);
  });

  it("keeps the model management action when no embedding models are available", async () => {
    loadEmbeddingModelOptionsMock.mockResolvedValue({
      errorMessage: null,
      options: [],
      state: "empty",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("dataCatalog.build.noModels")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "dataCatalog.build.goConnectModel" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "dataCatalog.build.retryLoadModels" })).toBeNull();
    expect(
      screen.queryAllByText("dataCatalog.resourceWorkspace.loadErrorRefreshHint"),
    ).toHaveLength(0);
  });
});
