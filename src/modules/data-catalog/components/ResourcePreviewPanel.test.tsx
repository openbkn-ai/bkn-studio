/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";
import { dataCatalogZhCN } from "@/modules/data-catalog/locales/zh-CN";
import type {
  CatalogResource,
  ResourcePreviewResult,
} from "@/modules/data-catalog/types/data-catalog";

const previewCatalogResourceMock = vi.hoisted(() => vi.fn());
const writeTextToClipboardMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const testFilterRule = vi.hoisted(
  (): {
    field: string;
    operation: string;
    value: string | string[];
    valueFrom?: "field" | "const";
  } => ({ field: "id", operation: ">", value: "10" }),
);

const translateMock = vi.hoisted(() =>
  vi.fn((key: string, options?: { source?: string; field?: string; limit?: number }) =>
    key === "dataCatalog.preview.sourceReadForbidden"
      ? `${key}:${options?.source}`
      : key === "dataCatalog.preview.keywordLimitExceeded"
        ? `${key}:${options?.field}:${options?.limit}`
        : key,
  ),
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: translateMock,
  }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  previewCatalogResource: previewCatalogResourceMock,
}));

vi.mock("@/framework/compat/clipboard", () => ({
  writeTextToClipboard: writeTextToClipboardMock,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/framework/ui/common/TablePaginationBar", () => ({
  TablePaginationBar: ({
    total,
    onChange,
  }: {
    total: number;
    onChange: (page: number, size: number) => void;
  }) => (
    <>
      <span data-testid="pagination-total">{total}</span>
      <button onClick={() => onChange(2, 10)}>next-test-page</button>
    </>
  ),
}));

vi.mock("@/modules/data-catalog/components/FilterTreeEditor", () => ({
  FilterTreeEditor: ({
    onChange,
    queryPath,
  }: {
    onChange: (value: unknown) => void;
    queryPath: string;
  }) => (
    <button
      data-query-path={queryPath}
      onClick={() =>
        onChange({
          kind: "group",
          operation: "and",
          children: [{ kind: "rule", ...testFilterRule }],
        })
      }
      type="button"
    >
      set-test-filter
    </button>
  ),
}));

import { ResourcePreviewPanel } from "./ResourcePreviewPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 0,
  description: "",
  id: "resource-1",
  name: "orders",
  operations: ["view_detail", "query_data"],
  rowCount: 0,
  schema: [],
  sourceIdentifier: "public.orders",
  updateTime: "-",
  expectedUpdateTime: 0,
};

const tableView: CatalogResource = {
  ...resource,
  id: "table-view",
  category: "logical_view",
  logicalType: "derived",
  sourceMetadata: { sourceCategory: "table" },
  logicalViewDefinition: {
    sourceResourceId: "source-1",
    // Fixed conditions can reference fields that the view does not publish.
    filterCondition: { field: "hidden_id", operation: ">", value: 3 },
  },
  schema: [{ name: "id", type: "integer" }],
};

const viewResource: CatalogResource = {
  ...tableView,
  id: resource.id,
  logicalViewDefinition: { sourceResourceId: "source-1" },
};

describe("ResourcePreviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(testFilterRule, { field: "id", operation: ">", value: "10" });
  });

  it.each([
    { category: "table", status: "available", type: "string", fulltext: true, allowed: true },
    { category: "table", status: "available", type: "text", fulltext: false, allowed: true },
    { category: "table", status: "available", type: "string", fulltext: false, allowed: false },
    { category: "table", status: "stale", type: "string", fulltext: true, allowed: false },
    { category: "table", status: "unavailable", type: "string", fulltext: true, allowed: false },
    { category: "index", status: "available", type: "text", fulltext: true, allowed: false },
    { category: "dataset", status: "available", type: "text", fulltext: false, allowed: true },
    { category: "logical_view", status: "available", type: "text", fulltext: true, allowed: true },
    {
      category: "logical_view",
      status: "available",
      type: "text",
      fulltext: false,
      allowed: true,
    },
    {
      category: "logical_view",
      status: "available",
      type: "string",
      fulltext: false,
      allowed: false,
    },
  ] as const)(
    "keeps source filterability separate from $category $status $type fulltext=$fulltext (allowed=$allowed)",
    async ({ category, status, type, fulltext, allowed }) => {
      Object.assign(testFilterRule, {
        field: "body",
        operation: "match",
        value: "invoice",
        valueFrom: "const",
      });
      previewCatalogResourceMock.mockResolvedValue({
        rows: [],
        total: 0,
        querySource: "local_index",
      });
      const sample: CatalogResource = {
        ...(category === "logical_view" ? tableView : resource),
        category,
        localIndexName: "idx_body",
        localIndexStatus: status,
        schema: [
          {
            name: "body",
            type,
            filterable: false,
            features: fulltext ? [{ featureType: "fulltext" }] : [],
          },
        ],
      };
      render(<ResourcePreviewPanel active resource={sample} />);
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      if (allowed) {
        await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
        expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({
          filterCondition: {
            sub_conditions: [{ field: "body", operation: "match", value: "invoice" }],
          },
        });
      } else {
        expect(
          await screen.findByText("dataCatalog.filter.errors.unsupportedOperation"),
        ).toBeInTheDocument();
        expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each([
    { category: "table", status: "available", allowed: true },
    { category: "dataset", status: "available", allowed: true },
    { category: "logical_view", status: "available", allowed: true },
    { category: "table", status: "stale", allowed: false },
    { category: "table", status: "unavailable", allowed: false },
    { category: "index", status: "available", allowed: false },
  ] as const)(
    "uses local schema for ordinary filtering in $category $status (allowed=$allowed)",
    async ({ category, status, allowed }) => {
      Object.assign(testFilterRule, {
        field: "id",
        operation: ">=",
        value: "10",
        valueFrom: "const",
      });
      previewCatalogResourceMock.mockResolvedValue({
        rows: [],
        total: 0,
        querySource: "local_index",
      });
      const sample: CatalogResource = {
        ...(category === "logical_view" ? tableView : resource),
        category,
        localIndexName: "idx_id",
        localIndexStatus: status,
        schema: [{ name: "id", type: "integer", filterable: false }],
      };
      render(<ResourcePreviewPanel active resource={sample} />);
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      if (allowed) {
        await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
        expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({
          filterCondition: {
            sub_conditions: [{ field: "id", operation: ">=", value: 10 }],
          },
        });
      } else {
        expect(
          await screen.findByText("dataCatalog.filter.errors.unsupportedOperation"),
        ).toBeInTheDocument();
        expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("switches a table-derived view between index and source without losing its switch or fixed filter", async () => {
    previewCatalogResourceMock.mockImplementation(
      (_id: string, query: { ignoreLocalIndex?: boolean }) =>
        Promise.resolve({
          rows: [{ id: 4 }],
          total: 30,
          querySource: query.ignoreLocalIndex ? "source" : "local_index",
        }),
    );
    render(<ResourcePreviewPanel active resource={tableView} />);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    expect(toggle).toBeEnabled();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
    await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
    const filterCondition = {
      operation: "and",
      sub_conditions: [{ field: "id", operation: ">", value: 10, value_from: "const" }],
    };
    fireEvent.click(screen.getByRole("button", { name: "next-test-page" }));
    await waitFor(() =>
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
        filterCondition,
        limit: 10,
        offset: 10,
      }),
    );
    fireEvent.click(toggle);
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(toggle).toBeChecked();
    expect(toggle).toBeInTheDocument();
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      filterCondition,
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
    fireEvent.click(toggle);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(toggle).not.toBeChecked();
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      filterCondition,
      limit: 10,
      offset: 0,
    });
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(5);
    expect(tableView.logicalViewDefinition?.filterCondition).toEqual({
      field: "hidden_id",
      operation: ">",
      value: 3,
    });
  });

  it("changes a view's filter path before the source response arrives and keeps it after source errors", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [],
      total: 0,
      querySource: "local_index",
    });
    render(<ResourcePreviewPanel active resource={tableView} />);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    const editor = screen.getByRole("button", { name: "set-test-filter" });
    expect(editor).toHaveAttribute("data-query-path", "managed_local_index");
    let rejectSource!: (error: Error) => void;
    const sourcePreview = new Promise((_resolve, reject) => {
      rejectSource = reject;
    });
    previewCatalogResourceMock.mockReturnValueOnce(sourcePreview);
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    fireEvent.click(toggle);
    expect(editor).toHaveAttribute("data-query-path", "source");
    await act(async () => {
      rejectSource(new Error("source unavailable"));
      await expect(sourcePreview).rejects.toThrow("source unavailable");
    });
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(editor).toHaveAttribute("data-query-path", "managed_local_index");
  });

  it("removes an unsupported additional filter when a view switches to source", async () => {
    Object.assign(testFilterRule, { field: "title", operation: "match", value: "keep" });
    previewCatalogResourceMock.mockImplementation(
      (_id: string, query: { ignoreLocalIndex?: boolean }) =>
        Promise.resolve({
          rows: [],
          total: 0,
          querySource: query.ignoreLocalIndex ? "source" : "local_index",
        }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...tableView,
          schema: [{ name: "title", type: "text", features: [{ featureType: "fulltext" }] }],
        }}
      />,
    );
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
    await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "dataCatalog.preview.queryOriginalSource" }),
    );
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(screen.getByText("dataCatalog.preview.filterUnavailableForSource")).toBeInTheDocument();
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
    expect(tableView.logicalViewDefinition?.filterCondition).toEqual({
      field: "hidden_id",
      operation: ">",
      value: 3,
    });
  });

  it.each(["match", "match_phrase", "multi_match", "knn_vector", "future_operation"])(
    "disables source switching for a view with a nested %s fixed filter",
    async (operation) => {
      previewCatalogResourceMock.mockResolvedValue({
        rows: [],
        total: 0,
        querySource: "local_index",
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...tableView,
            logicalViewDefinition: {
              sourceResourceId: "source-1",
              filterCondition: {
                operation: "and",
                sub_conditions: [{ operation, field: "hidden_title", value: "keep" }],
              },
            },
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeDisabled();
      fireEvent.mouseEnter(toggle.closest("span[tabindex]")!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        operation === "future_operation"
          ? "dataCatalog.preview.fixedFilterSourceUnknown"
          : "dataCatalog.preview.fixedFilterRequiresIndex",
      );
      fireEvent.click(toggle);
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    {
      name: "unindexed table",
      sourceCategory: "table",
      querySource: "source",
      hint: "queryOriginalAlreadyActive",
    },
    {
      name: "native index",
      sourceCategory: "index",
      querySource: "local_index",
      hint: "queryOriginalUnavailable",
    },
  ] as const)(
    "keeps source switching visible but disabled with a tooltip for a view with $name",
    async ({ sourceCategory, querySource, hint }) => {
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...tableView,
            sourceMetadata: { sourceCategory },
            localIndexName: "view-index",
            localIndexStatus: "available",
          }}
        />,
      );
      await screen.findByText(
        querySource === "local_index"
          ? "dataCatalog.preview.dataSourceIndex"
          : "dataCatalog.preview.dataSourceOriginal",
      );
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeDisabled();
      fireEvent.mouseEnter(toggle.closest("span[tabindex]")!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(`dataCatalog.preview.${hint}`);
      fireEvent.click(toggle);
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    },
  );

  it("allows a table-derived view without a fixed filter to query its source", async () => {
    previewCatalogResourceMock.mockImplementation(
      (_id: string, query: { ignoreLocalIndex?: boolean }) =>
        Promise.resolve({
          rows: [],
          total: 0,
          querySource: query.ignoreLocalIndex ? "source" : "local_index",
        }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...tableView, logicalViewDefinition: { sourceResourceId: "source-1" } }}
      />,
    );
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "dataCatalog.preview.queryOriginalSource" }),
    );
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
  });

  it.each(["table", "dataset", "index"] as const)(
    "keeps the source option disabled with a tooltip for a %s without a switchable channel",
    async (category) => {
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            category,
            columnCount: 1,
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeDisabled();
      fireEvent.focus(toggle.closest("span[tabindex]")!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        category === "table"
          ? "dataCatalog.preview.queryOriginalAlreadyActive"
          : "dataCatalog.preview.queryOriginalUnavailable",
      );
      fireEvent.click(toggle);
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    },
  );

  it("shows a loading tooltip until a view's initial preview completes", async () => {
    const response = { rows: [], total: 0, querySource: "local_index" };
    let resolvePreview!: (value: typeof response) => void;
    const preview = new Promise<typeof response>((resolve) => {
      resolvePreview = resolve;
    });
    previewCatalogResourceMock.mockReturnValueOnce(preview);
    render(<ResourcePreviewPanel active resource={tableView} />);
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    expect(toggle).toBeDisabled();
    const trigger = toggle.closest("span[tabindex]")!;
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "dataCatalog.preview.queryOriginalLoading",
    );
    fireEvent.mouseLeave(trigger);
    await act(async () => {
      resolvePreview(response);
      await preview;
    });
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(toggle).toBeEnabled();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "view type", change: { logicalType: undefined } },
    { name: "source category", change: { sourceMetadata: undefined } },
    { name: "source reference", change: { logicalViewDefinition: undefined } },
    {
      name: "nonempty source reference",
      change: { logicalViewDefinition: { sourceResourceId: " " } },
    },
  ] as const)(
    "reports incomplete view details when $name is missing without querying rows",
    async ({ change }) => {
      render(<ResourcePreviewPanel active resource={{ ...tableView, ...change }} />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "dataCatalog.preview.invalidViewMetadata",
      );
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeDisabled();
      fireEvent.focus(toggle.closest("span[tabindex]")!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "dataCatalog.preview.invalidViewMetadata",
      );
      expect(previewCatalogResourceMock).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "unexpected", ""])(
    "rejects a derived preview response with querySource=%s",
    async (querySource) => {
      previewCatalogResourceMock.mockResolvedValue({ rows: [{ id: 123 }], total: 1, querySource });
      render(<ResourcePreviewPanel active resource={tableView} />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "dataCatalog.preview.invalidQuerySource",
      );
      expect(screen.queryByRole("cell", { name: "123" })).not.toBeInTheDocument();
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeDisabled();
      fireEvent.focus(toggle.closest("span[tabindex]")!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "dataCatalog.preview.queryOriginalFailed",
      );
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    },
  );

  it("reports initial preview failure through the query error and allows an explicit retry", async () => {
    const failure = Object.assign(new Error("source unavailable"), {
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          error_code: "VegaBackend.Resource.InternalError",
          description: "source unavailable",
        },
      },
    });
    previewCatalogResourceMock
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ rows: [], total: 0, querySource: "local_index" });
    render(<ResourcePreviewPanel active resource={tableView} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("source unavailable");
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    expect(toggle).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.clearFilter" }));
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(toggle).toBeEnabled();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the selected source on a malformed response and retries only when requested", async () => {
    previewCatalogResourceMock
      .mockResolvedValueOnce({ rows: [], total: 0, querySource: "local_index" })
      .mockResolvedValueOnce({ rows: [{ id: 123 }], total: 1 })
      .mockResolvedValue({ rows: [{ id: 4 }], total: 1, querySource: "source" });
    render(<ResourcePreviewPanel active resource={tableView} />);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    fireEvent.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "dataCatalog.preview.invalidQuerySource",
    );
    expect(toggle).toBeDisabled();
    expect(toggle).toBeChecked();
    expect(screen.queryByRole("cell", { name: "123" })).not.toBeInTheDocument();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.clearFilter" }));
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3);
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
  });

  it("allows a source-supported LARGEINT fixed range to bypass a failing initial index query", async () => {
    const failure = Object.assign(new Error("index filter incompatible"), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error_code: "VegaBackend.LogicalView.DefinitionInvalid",
          description: "index filter incompatible",
        },
      },
    });
    previewCatalogResourceMock.mockImplementation(
      (_id: string, query: { ignoreLocalIndex?: boolean }) =>
        query.ignoreLocalIndex
          ? Promise.resolve({ rows: [{ published: "10" }], total: 1, querySource: "source" })
          : Promise.reject(failure),
    );
    const fixed = { field: "wide", operation: "range", value: ["0", "20"] };
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...tableView,
          schema: [{ name: "published", originalName: "wide", type: "large_integer" }],
          logicalViewDefinition: { sourceResourceId: "source-1", filterCondition: fixed },
        }}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("index filter incompatible");
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
    expect(fixed).toEqual({ field: "wide", operation: "range", value: ["0", "20"] });
  });

  it.each([
    { operation: "like", originalName: "wide" },
    { operation: "prefix", originalName: "source_wide" },
  ])(
    "leaves $operation type validation to the backend when the published binding is $originalName",
    async ({ operation, originalName }) => {
      const failure = Object.assign(new Error("fixed filter incompatible with source type"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error_code: "VegaBackend.LogicalView.DefinitionInvalid",
            description: "fixed filter incompatible with source type",
          },
        },
      });
      previewCatalogResourceMock.mockImplementation(
        (_id: string, query: { ignoreLocalIndex?: boolean }) =>
          query.ignoreLocalIndex
            ? Promise.reject(failure)
            : Promise.resolve({ rows: [], total: 0, querySource: "local_index" }),
      );
      const fixed = { field: "wide", operation, value: "10" };
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...tableView,
            schema: [{ name: "published", originalName, type: "large_integer" }],
            logicalViewDefinition: {
              sourceResourceId: "source-1",
              filterCondition: fixed,
            },
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      expect(toggle).toBeEnabled();
      fireEvent.click(toggle);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "fixed filter incompatible with source type",
      );
      expect(toggle).toBeChecked();
      expect(toggle).toBeEnabled();
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
        ignoreLocalIndex: true,
        limit: 10,
        offset: 0,
      });
      expect(fixed).toEqual({ field: "wide", operation, value: "10" });
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
      fireEvent.click(toggle);
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      expect(toggle).not.toBeChecked();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3);
    },
  );

  it("does not infer a fixed field's type from another field's matching original name", async () => {
    previewCatalogResourceMock.mockImplementation(
      (_id: string, query: { ignoreLocalIndex?: boolean }) =>
        Promise.resolve({
          rows: [{ number_alias: "10", text_alias: "alpha" }],
          total: 1,
          querySource: query.ignoreLocalIndex ? "source" : "local_index",
        }),
    );
    // Source fields: code -> CODE (numeric), CODE -> LABEL (string).
    // The fixed condition binds the logical name CODE, which is the string field.
    const fixed = { field: "CODE", operation: "prefix", value: "alpha" };
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...tableView,
          schema: [
            { name: "number_alias", originalName: "CODE", type: "large_integer" },
            { name: "text_alias", originalName: "LABEL", type: "string" },
          ],
          logicalViewDefinition: { sourceResourceId: "source-1", filterCondition: fixed },
        }}
      />,
    );
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    const toggle = screen.getByRole("checkbox", {
      name: "dataCatalog.preview.queryOriginalSource",
    });
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(toggle).toBeChecked();
    expect(screen.getByRole("cell", { name: "alpha" })).toBeInTheDocument();
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(tableView.id, {
      ignoreLocalIndex: true,
      limit: 10,
      offset: 0,
    });
    expect(fixed).toEqual({ field: "CODE", operation: "prefix", value: "alpha" });
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
  });

  it("loads normally after incomplete view details are refreshed", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [],
      total: 0,
      querySource: "local_index",
    });
    const { rerender } = render(
      <ResourcePreviewPanel active resource={{ ...tableView, sourceMetadata: undefined }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("dataCatalog.preview.invalidViewMetadata");
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
    rerender(<ResourcePreviewPanel active resource={tableView} />);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "dataCatalog.preview.queryOriginalSource" }),
    ).toBeEnabled();
    expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
  });

  it("resets a view's selected channel and ignores late results when navigating to another resource", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [],
      total: 0,
      querySource: "local_index",
    });
    const { rerender } = render(<ResourcePreviewPanel active resource={tableView} />);
    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    let resolveOld!: (result: unknown) => void;
    const oldPreview = new Promise((resolve) => {
      resolveOld = resolve;
    });
    previewCatalogResourceMock.mockReturnValueOnce(oldPreview);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "dataCatalog.preview.queryOriginalSource" }),
    );
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
    rerender(<ResourcePreviewPanel active resource={{ ...tableView, id: "next-view" }} />);
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("next-view", {
      limit: 10,
      offset: 0,
    });
    expect(
      screen.queryByRole("checkbox", { name: "dataCatalog.preview.queryOriginalSource" }),
    ).toBeDisabled();
    await act(async () => {
      resolveOld({ rows: [{ id: 999 }], total: 1, querySource: "local_index" });
      await oldPreview;
    });
    expect(screen.queryByRole("cell", { name: "999" })).not.toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.preview.dataSourceIndex")).not.toBeInTheDocument();
  });

  it.each(["source", "local_index"] as const)(
    "does not reload a view after learning its %s path, then uses that path for filters",
    async (path) => {
      const response = { rows: [{ wide: "9" }], total: 1, querySource: path };
      let resolvePreview!: (value: typeof response) => void;
      const preview = new Promise<typeof response>((resolve) => {
        resolvePreview = resolve;
      });
      previewCatalogResourceMock.mockReturnValueOnce(preview).mockResolvedValue(response);
      Object.assign(testFilterRule, {
        field: "wide",
        operation: "==",
        value: " +09007199254740993 ",
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...viewResource,
            schema: [{ name: "wide", type: "large_integer" }],
          }}
        />,
      );
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolvePreview(response);
        await preview;
      });
      expect(screen.getByRole("cell", { name: "9" })).toBeTruthy();
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(
        resource.id,
        expect.objectContaining({
          filterCondition: {
            operation: "and",
            sub_conditions: [
              {
                field: "wide",
                operation: "==",
                value_from: "const",
                value: path === "source" ? "+09007199254740993" : " +09007199254740993 ",
              },
            ],
          },
        }),
      );
    },
  );

  it.each(["source", "local_index"] as const)(
    "serializes large integer filter whitespace for the %s path",
    async (path) => {
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: path });
      Object.assign(testFilterRule, {
        field: "wide",
        operation: "==",
        value: " +09007199254740993 ",
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            localIndexName: path === "local_index" ? "idx_orders" : undefined,
            localIndexStatus: path === "local_index" ? "available" : "unavailable",
            schema: [{ name: "wide", type: "large_integer" }],
          }}
        />,
      );
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() =>
        expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(
          resource.id,
          expect.objectContaining({
            filterCondition: {
              operation: "and",
              sub_conditions: [
                {
                  field: "wide",
                  operation: "==",
                  value_from: "const",
                  value: path === "source" ? "+09007199254740993" : " +09007199254740993 ",
                },
              ],
            },
          }),
        ),
      );
    },
  );

  it.each(
    [
      {
        schemaField: { name: "at", type: "datetime" },
        allowed: true,
        rule: { field: "at", operation: "before", value: ["3", "day"] },
      },
      {
        schemaField: { name: "payload", type: "json" },
        allowed: false,
        rule: { field: "payload", operation: "null", value: "" },
      },
      {
        schemaField: {
          name: "body",
          type: "text",
          features: [{ featureType: "keyword" as const }],
        },
        allowed: true,
        rule: { field: "body", operation: "prefix", value: "word" },
      },
    ].flatMap((testCase) =>
      (["dataset", "logical_view"] as const).map((category) => ({ ...testCase, category })),
    ),
  )(
    "validates $rule.operation on a $category using the index capability matrix",
    async ({ category, schemaField, rule, allowed }) => {
      Object.assign(testFilterRule, rule);
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            sourceMetadata: category === "logical_view" ? { sourceCategory: "index" } : undefined,
            localIndexName: "idx_dataset",
            localIndexStatus: "available",
            schema: [schemaField],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      if (allowed) {
        await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
        expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(resource.id, {
          limit: 10,
          offset: 0,
          filterCondition: {
            operation: "and",
            sub_conditions: [
              {
                ...rule,
                value: rule.operation === "before" ? [3, "day"] : rule.value,
                value_from: "const",
              },
            ],
          },
        });
      } else {
        expect(
          screen.getByText("dataCatalog.filter.errors.unsupportedOperation"),
        ).toBeInTheDocument();
        expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(["dataset", "logical_view"] as const)(
    "uses index fulltext capabilities for a %s regardless of its response source label",
    async (category) => {
      Object.assign(testFilterRule, { field: "body", operation: "match", value: "word" });
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            sourceMetadata: category === "logical_view" ? { sourceCategory: "index" } : undefined,
            localIndexName: "idx_dataset",
            localIndexStatus: "available",
            schema: [{ name: "body", type: "text", features: [{ featureType: "fulltext" }] }],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(resource.id, {
        limit: 10,
        offset: 0,
        filterCondition: {
          operation: "and",
          sub_conditions: [
            { field: "body", operation: "match", value_from: "const", value: "word" },
          ],
        },
      });
      expect(screen.queryByLabelText("dataCatalog.preview.queryOriginalSource")).toBeDisabled();
    },
  );

  it("shows type, display name, and field name together in Table and View headers", () => {
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
    for (const category of ["table", "logical_view"] as const) {
      const { unmount } = render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            schema: [
              { name: "amount", displayName: "订单金额", type: "decimal(18,2)" },
              { name: "status", type: "string" },
            ],
          }}
        />,
      );

      const amount = screen.getByRole("columnheader", { name: /订单金额/ });
      expect(within(amount).getByText("dec").closest("[title]")).toHaveAttribute(
        "title",
        "decimal(18,2)",
      );
      expect(within(amount).getByText("amount").parentElement?.className).not.toContain(
        "namesInline",
      );
      const status = screen.getByRole("columnheader", { name: /status/ });
      expect(within(status).getByText("[Str]")).toBeTruthy();
      expect(within(status).getAllByText("status")).toHaveLength(1);
      unmount();
    }
  });

  it.each(["table", "logical_view"] as const)(
    "submits typed time bounds for a %s preview",
    async (category) => {
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
      Object.assign(testFilterRule, {
        field: "at",
        operation: "range",
        value: ["2026-10-19T00:00:00+08:00", "2026-10-22T00:00:00+08:00"],
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            schema: [{ name: "at", type: "datetime" }],
          }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() =>
        expect(previewCatalogResourceMock).toHaveBeenCalledWith(
          "resource-1",
          expect.objectContaining({
            offset: 0,
            filterCondition: {
              operation: "and",
              sub_conditions: [
                {
                  field: "at",
                  operation: "range",
                  value_from: "const",
                  value: ["2026-10-19T00:00:00+08:00", "2026-10-22T00:00:00+08:00"],
                },
              ],
            },
          }),
        ),
      );
    },
  );

  it("applies and clears a temporary filter for both Table and View previews", async () => {
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
    for (const category of ["table", "logical_view"] as const) {
      const { unmount } = render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() =>
        expect(previewCatalogResourceMock).toHaveBeenCalledWith(
          "resource-1",
          expect.objectContaining({
            filterCondition: {
              operation: "and",
              sub_conditions: [{ field: "id", operation: ">", value: 10, value_from: "const" }],
            },
            offset: 0,
          }),
        ),
      );
      previewCatalogResourceMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.clearFilter" }));
      await waitFor(() => {
        expect(previewCatalogResourceMock).toHaveBeenCalledWith(
          "resource-1",
          expect.objectContaining({ offset: 0 }),
        );
        const latestQuery = previewCatalogResourceMock.mock.lastCall?.[1] as
          Record<string, unknown> | undefined;
        expect(latestQuery).not.toHaveProperty("filterCondition");
      });
      unmount();
      previewCatalogResourceMock.mockClear();
    }
  });

  it.each(["source", "local_index"] as const)(
    "retries the same failed %s filter until recovery without repeating successful queries",
    async (querySource) => {
      previewCatalogResourceMock.mockReset();
      const failure = Object.assign(new Error("temporary failure"), {
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            error_code: "VegaBackend.Resource.InternalError",
            description: "temporary failure",
          },
        },
      });
      Object.assign(testFilterRule, { field: "id", operation: "==", value: "3" });
      previewCatalogResourceMock
        .mockResolvedValue({ rows: [{ id: 3 }], total: 1, querySource })
        .mockResolvedValueOnce({ rows: [], total: 0, querySource })
        .mockRejectedValueOnce(failure)
        .mockRejectedValueOnce(failure);
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            ...(querySource === "local_index"
              ? { localIndexStatus: "available", localIndexName: "idx_orders" }
              : {}),
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.empty");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      const apply = screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" });
      fireEvent.click(apply);
      await screen.findByText("temporary failure");
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
      const failedQuery = previewCatalogResourceMock.mock.lastCall?.[1] as unknown;
      expect(failedQuery).toMatchObject({
        filterCondition: {
          operation: "and",
          sub_conditions: [{ field: "id", operation: "==", value: 3, value_from: "const" }],
        },
        offset: 0,
      });

      fireEvent.click(apply);
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3));
      await screen.findByText("temporary failure");
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toEqual(failedQuery);

      fireEvent.click(apply);
      await screen.findByRole("cell", { name: "3" });
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(4);
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toEqual(failedQuery);
      expect(screen.queryByText("temporary failure")).not.toBeInTheDocument();

      fireEvent.click(apply);
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(4);
      Object.assign(testFilterRule, { value: "4" });
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(apply);
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(5));
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({
        filterCondition: {
          sub_conditions: [{ field: "id", operation: "==", value: 4, value_from: "const" }],
        },
        offset: 0,
      });
    },
  );

  it.each(["source", "local_index"] as const)(
    "ignores a late failed %s retry after a newer filter succeeds",
    async (querySource) => {
      previewCatalogResourceMock.mockReset();
      let rejectRetry: ((reason: Error) => void) | undefined;
      const retryRequest = new Promise<ResourcePreviewResult>((_resolve, reject) => {
        rejectRetry = reject;
      });
      previewCatalogResourceMock
        .mockResolvedValue({ rows: [{ id: 4 }], total: 1, querySource })
        .mockResolvedValueOnce({ rows: [], total: 0, querySource })
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockReturnValueOnce(retryRequest);
      Object.assign(testFilterRule, { field: "id", operation: "==", value: "3" });
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            ...(querySource === "local_index"
              ? { localIndexStatus: "available", localIndexName: "idx_orders" }
              : {}),
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.empty");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      const apply = screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" });
      fireEvent.click(apply);
      await screen.findByText("temporary failure");

      fireEvent.click(apply);
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3));
      fireEvent.click(apply);
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3);

      Object.assign(testFilterRule, { field: "missing" });
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(apply);
      expect(screen.getByText("dataCatalog.filter.errors.invalidField")).toBeInTheDocument();
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3);

      Object.assign(testFilterRule, { field: "id", value: "4" });
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(apply);
      await screen.findByRole("cell", { name: "4" });
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(4);
      if (!rejectRetry) throw new Error("expected the retry request to remain pending");
      await act(async () => {
        rejectRetry?.(new Error("late retry failure"));
        await expect(retryRequest).rejects.toThrow("late retry failure");
      });
      expect(screen.getByRole("cell", { name: "4" })).toBeInTheDocument();
      expect(screen.queryByText("late retry failure")).not.toBeInTheDocument();
      expect(screen.queryByText("temporary failure")).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      schemaField: { name: "notes", type: "text" },
      rule: { field: "notes", operation: "==", value: "open" },
    },
  ])(
    "drops an applied source $rule.operation filter when switching to an unsupported index path",
    async ({ schemaField, rule }) => {
      Object.assign(testFilterRule, rule);
      previewCatalogResourceMock.mockImplementation(
        (_id: string, query: { ignoreLocalIndex?: boolean }) =>
          Promise.resolve({
            querySource: query.ignoreLocalIndex ? "source" : "local_index",
            rows: [],
            total: 0,
          }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            localIndexName: "idx_orders",
            localIndexStatus: "available",
            schema: [schemaField],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      await waitFor(() => {
        expect(previewCatalogResourceMock.mock.lastCall?.[1]).toEqual({
          filterCondition: {
            operation: "and",
            sub_conditions: [
              {
                ...rule,
                value: rule.value,
                value_from: "const",
              },
            ],
          },
          ignoreLocalIndex: true,
          limit: 10,
          offset: 0,
        });
      });
      fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
      await waitFor(() => {
        const query = previewCatalogResourceMock.mock.lastCall?.[1] as Record<string, unknown>;
        expect(query).not.toHaveProperty("filterCondition");
        expect(query).not.toHaveProperty("ignoreLocalIndex");
      });
      expect(
        await screen.findByText("dataCatalog.preview.filterUnavailableForSource"),
      ).toBeTruthy();
    },
  );

  it.each(
    (["match", "match_phrase"] as const).flatMap((operation) =>
      [false, true].map((applyAtSource) => ({ operation, applyAtSource })),
    ),
  )(
    "clears stale $operation errors after returning to the index (apply at source: $applyAtSource)",
    async ({ operation, applyAtSource }) => {
      Object.assign(testFilterRule, { field: "body", operation, value: "invoice copy" });
      previewCatalogResourceMock.mockImplementation(
        (_id: string, query: { ignoreLocalIndex?: boolean; filterCondition?: unknown }) =>
          Promise.resolve({
            querySource: query.ignoreLocalIndex ? "source" : "local_index",
            rows: query.filterCondition
              ? [
                  { id: 9, body: "invoice copy" },
                  { id: 1, body: "invoice copy" },
                ]
              : [{ id: 7, body: "other" }],
            total: query.filterCondition ? 2 : 1,
          }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            localIndexName: "idx_orders",
            localIndexStatus: "available",
            schema: [
              { name: "id", type: "integer" },
              { name: "body", type: "string", features: [{ featureType: "fulltext" }] },
            ],
          }}
        />,
      );
      await screen.findByRole("cell", { name: "7" });
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      const apply = screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" });
      fireEvent.click(apply);
      await screen.findByRole("cell", { name: "9" });
      expect(screen.getByRole("row", { name: "2 1 invoice copy" })).toBeInTheDocument();
      const filterCondition = {
        operation: "and",
        sub_conditions: [{ field: "body", operation, value: "invoice copy", value_from: "const" }],
      };
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({ filterCondition });

      const sourceToggle = screen.getByLabelText("dataCatalog.preview.queryOriginalSource");
      fireEvent.click(sourceToggle);
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      expect(screen.getByRole("cell", { name: "7" })).toBeInTheDocument();
      expect(
        screen.getByText("dataCatalog.preview.filterUnavailableForSource"),
      ).toBeInTheDocument();
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).not.toHaveProperty("filterCondition");
      if (applyAtSource) {
        const requests = previewCatalogResourceMock.mock.calls.length;
        fireEvent.click(apply);
        expect(
          screen.getByText("dataCatalog.filter.errors.unsupportedOperation"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("dataCatalog.filter.errors.invalidField"),
        ).not.toBeInTheDocument();
        expect(previewCatalogResourceMock).toHaveBeenCalledTimes(requests);
      }

      fireEvent.click(sourceToggle);
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      expect(
        screen.queryByText("dataCatalog.preview.filterUnavailableForSource"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("dataCatalog.filter.errors.unsupportedOperation"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "dataCatalog.preview.filter" }),
      ).toBeInTheDocument();
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).not.toHaveProperty("filterCondition");

      fireEvent.click(apply);
      await screen.findByRole("cell", { name: "9" });
      expect(screen.getByRole("row", { name: "2 1 invoice copy" })).toBeInTheDocument();
      expect(screen.getByTestId("pagination-total")).toHaveTextContent("2");
      expect(
        screen.getByRole("button", { name: "dataCatalog.preview.filter (1)" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toEqual({
        filterCondition,
        limit: 10,
        offset: 0,
      });
    },
  );

  it.each([false, true])(
    "clears cancellation feedback when applying a valid draft on the same source (request fails: %s)",
    async (requestFails) => {
      Object.assign(testFilterRule, { field: "body", operation: "match_phrase", value: "invoice" });
      previewCatalogResourceMock.mockImplementation(
        (_id: string, query: { ignoreLocalIndex?: boolean; filterCondition?: unknown }) =>
          query.ignoreLocalIndex && query.filterCondition && requestFails
            ? Promise.reject(new Error("source unavailable"))
            : Promise.resolve({
                querySource: query.ignoreLocalIndex ? "source" : "local_index",
                rows: [{ id: 9, body: "invoice" }],
                total: 1,
              }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            localIndexName: "idx_orders",
            localIndexStatus: "available",
            schema: [
              { name: "id", type: "integer" },
              { name: "body", type: "string", features: [{ featureType: "fulltext" }] },
            ],
          }}
        />,
      );
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      const edit = screen.getByRole("button", { name: "set-test-filter" });
      const apply = screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" });
      fireEvent.click(edit);
      fireEvent.click(apply);
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));

      Object.assign(testFilterRule, { field: "id", operation: "==", value: "9" });
      fireEvent.click(edit);
      fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
      await screen.findByText("dataCatalog.preview.dataSourceOriginal");
      expect(
        screen.getByText("dataCatalog.preview.filterUnavailableForSource"),
      ).toBeInTheDocument();
      fireEvent.click(apply);
      await waitFor(() =>
        expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({
          ignoreLocalIndex: true,
          filterCondition: { sub_conditions: [{ field: "id", operation: "==", value: 9 }] },
        }),
      );
      if (requestFails) {
        await screen.findByText("source unavailable");
      } else {
        await screen.findByRole("cell", { name: "9" });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      }
      expect(
        screen.queryByText("dataCatalog.preview.filterUnavailableForSource"),
      ).not.toBeInTheDocument();
    },
  );

  it.each([false, true])(
    "preserves equality filters and invalid draft errors across source changes (request fails: %s)",
    async (requestFails) => {
      Object.assign(testFilterRule, { field: "id", operation: "==", value: "9" });
      previewCatalogResourceMock.mockImplementation(
        (_id: string, query: { ignoreLocalIndex?: boolean }) =>
          query.ignoreLocalIndex && requestFails
            ? Promise.reject(new Error("source unavailable"))
            : Promise.resolve({
                querySource: query.ignoreLocalIndex ? "source" : "local_index",
                rows: [{ id: 9 }],
                total: 1,
              }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            localIndexName: "idx_orders",
            localIndexStatus: "available",
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );
      await screen.findByRole("cell", { name: "9" });
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      const edit = screen.getByRole("button", { name: "set-test-filter" });
      const apply = screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" });
      fireEvent.click(edit);
      fireEvent.click(apply);
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2));

      Object.assign(testFilterRule, { field: "missing" });
      fireEvent.click(edit);
      fireEvent.click(apply);
      expect(screen.getByText("dataCatalog.filter.errors.invalidField")).toBeInTheDocument();
      const sourceToggle = screen.getByLabelText("dataCatalog.preview.queryOriginalSource");
      fireEvent.click(sourceToggle);
      await screen.findByText(
        requestFails ? "source unavailable" : "dataCatalog.preview.dataSourceOriginal",
      );
      expect(screen.getByText("dataCatalog.filter.errors.invalidField")).toBeInTheDocument();
      expect(
        screen.queryByText("dataCatalog.preview.filterUnavailableForSource"),
      ).not.toBeInTheDocument();
      expect(previewCatalogResourceMock.mock.lastCall?.[1]).toMatchObject({
        ignoreLocalIndex: true,
        filterCondition: { sub_conditions: [{ field: "id", operation: "==", value: 9 }] },
      });

      fireEvent.click(sourceToggle);
      await screen.findByText("dataCatalog.preview.dataSourceIndex");
      expect(screen.getByText("dataCatalog.filter.errors.invalidField")).toBeInTheDocument();
      expect(screen.queryByText("source unavailable")).not.toBeInTheDocument();
      Object.assign(testFilterRule, { field: "id" });
      fireEvent.click(edit);
      expect(screen.queryByText("dataCatalog.filter.errors.invalidField")).not.toBeInTheDocument();
      Object.assign(testFilterRule, { field: "missing" });
      fireEvent.click(edit);
      fireEvent.click(apply);
      expect(screen.getByText("dataCatalog.filter.errors.invalidField")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.clearFilter" }));
      await waitFor(() =>
        expect(previewCatalogResourceMock.mock.lastCall?.[1]).not.toHaveProperty("filterCondition"),
      );
      expect(screen.queryByText("dataCatalog.filter.errors.invalidField")).not.toBeInTheDocument();
    },
  );

  it("uses the shared warning alert for a permission-disabled preview", () => {
    render(
      <ResourcePreviewPanel
        active
        disabled
        disabledMessage="dataCatalog.permissionRequired"
        resource={resource}
      />,
    );

    expect(screen.getByText("dataCatalog.permissionRequired").closest(".ant-alert")).toHaveClass(
      "ant-alert-warning",
    );
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not request preview data for a non-table resource with empty schema and no discover status", () => {
    render(<ResourcePreviewPanel active resource={{ ...resource, category: "dataset" }} />);

    expect(screen.getByText("dataCatalog.preview.metadataUnavailable")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it.each(["dataset", "table", "index"] as const)(
    "uses the correct empty-schema message for %s with a legacy discovery error",
    (category) => {
      render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, category, lastDiscoverStatus: "error" }}
        />,
      );
      const message = category === "dataset" ? "metadataUnavailable" : "metadataDiscoveryFailed";
      expect(screen.getByText(`dataCatalog.preview.${message}`)).toBeTruthy();
      expect(screen.getByText(`dataCatalog.preview.${message}Description`)).toBeTruthy();
      if (category === "dataset") {
        expect(screen.queryByText("dataCatalog.preview.metadataDiscoveryFailed")).toBeNull();
        expect(
          screen.queryByText("dataCatalog.preview.metadataDiscoveryFailedDescription"),
        ).toBeNull();
      }
      expect(previewCatalogResourceMock).not.toHaveBeenCalled();
    },
  );

  it("does not request preview data when the resource is missing but its previous schema remains", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          lastDiscoverStatus: "missing",
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceMissing")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("shows disabled lifecycle state before a simultaneous missing discovery result", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          lastDiscoverStatus: "missing",
          enabled: false,
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceDisabled")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.preview.resourceMissing")).toBeNull();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not request preview data for a stale resource with previous schema", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          schema: [{ name: "id", type: "integer" }],
          status: "stale",
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceStale")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("still previews the last known schema after a later discovery failure", async () => {
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0 });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          lastDiscoverStatus: "error",
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenCalledWith("resource-1", {
        limit: 10,
        offset: 0,
      });
    });
  });

  it("clamps unsafe row counts at the numeric pagination boundary", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, index) => ({ id: index })),
      total: 0,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          rowCount: "9007199254740993",
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect((await screen.findByTestId("pagination-total")).textContent).toBe(
      String(Number.MAX_SAFE_INTEGER),
    );
  });

  it("uses the exact filtered total when the result fills one page", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, index) => ({ id: index + 1 })),
      total: 10,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          rowCount: 100,
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
    fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));

    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("resource-1", {
        filterCondition: {
          operation: "and",
          sub_conditions: [{ field: "id", operation: ">", value: 10, value_from: "const" }],
        },
        limit: 10,
        offset: 0,
      });
      expect(screen.getByTestId("pagination-total").textContent).toBe("10");
    });
  });

  it("does not replace a derived view's fixed-filter total with its row count", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "source",
      rows: Array.from({ length: 10 }, (_, index) => ({ id: index + 1 })),
      total: 10,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...viewResource,
          columnCount: 1,
          logicalViewDefinition: {
            sourceResourceId: "source-1",
            filterCondition: { field: "id", operation: ">", value: 10 },
          },
          rowCount: 100,
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pagination-total").textContent).toBe("10"));
  });

  it("does not request Binary data or expose its controls for datasets", async () => {
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0 });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          category: "dataset",
          columnCount: 1,
          schema: [{ name: "legacy_blob", type: "binary" }],
        }}
      />,
    );

    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenCalledWith("resource-1", {
        limit: 10,
        offset: 0,
      });
    });
    expect(screen.queryByLabelText("dataCatalog.preview.loadBinaryContent")).toBeNull();
  });

  it.each(["source", "local_index"] as const)(
    "renders normalized nulls with JSON string content returned by %s",
    async (querySource) => {
      previewCatalogResourceMock.mockResolvedValue({
        rows: [
          { payload: null },
          { payload: null },
          { payload: querySource === "source" ? '"null"' : "null" },
          { payload: querySource === "source" ? '""' : "" },
        ],
        total: 4,
        querySource,
      });

      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...resource,
            columnCount: 1,
            localIndexName: "idx_orders",
            localIndexStatus: "available",
            schema: [{ name: "payload", type: "json" }],
          }}
        />,
      );

      expect(await screen.findAllByRole("cell", { name: "NULL" })).toHaveLength(2);
      expect(
        screen.getByRole("cell", {
          name: querySource === "source" ? '"null"' : "null",
        }),
      ).toBeTruthy();
      expect(screen.getByRole("cell", { name: querySource === "source" ? '""' : "" })).toBeTruthy();
    },
  );

  it("renders binary metadata without rendering its raw value", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ blob: { byte_length: 3 } }, { blob: null }, { blob: "raw bytes" }],
      total: 3,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          localIndexName: "idx_orders",
          localIndexStatus: "available",
          schema: [{ name: "blob", type: "binary" }],
        }}
      />,
    );

    expect(await screen.findByText("dataCatalog.preview.binaryContent")).toBeTruthy();
    expect(screen.getByText("NULL")).toBeTruthy();
    expect(screen.getByText("dataCatalog.preview.binaryContentUnavailable")).toBeTruthy();
    expect(screen.queryByText("raw bytes")).toBeNull();
  });

  it.each([{ data: "value" }, { mode: "unavailable" }, { mode: "content", data: [1, 2] }])(
    "preserves source Other objects without interpreting wrapper keys: %j",
    async (value) => {
      previewCatalogResourceMock.mockResolvedValue({
        querySource: "source",
        rows: [{ value }],
        total: 1,
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, schema: [{ name: "value", type: "other" }] }}
        />,
      );
      const text = JSON.stringify(value);
      if (text.length > 20) {
        fireEvent.click(await screen.findByRole("button", { name: `${text.slice(0, 20)}…` }));
      }
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByText("dataCatalog.preview.fieldContentUnavailable")).toBeNull();
    },
  );

  it.each(["other", "binary", "string", "integer", "json"])(
    "distinguishes missing %s fields from returned NULL and content",
    async (type) => {
      previewCatalogResourceMock.mockResolvedValue({
        rows: [
          {},
          { value: null },
          ...(type === "binary"
            ? [{ value: { mode: "unavailable", reason: "not_requested" } }]
            : []),
        ],
        total: 3,
      });
      render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, schema: [{ name: "value", type }] }}
        />,
      );
      expect(await screen.findByText("dataCatalog.preview.fieldNotReturned")).toBeTruthy();
      expect(screen.getAllByText("NULL")).toHaveLength(1);
      if (type !== "binary") return;
      expect(screen.getByText("dataCatalog.preview.binaryContentUnavailable")).toBeTruthy();
      fireEvent.mouseEnter(screen.getByText("dataCatalog.preview.binaryContentUnavailable"));
      expect(await screen.findByText("dataCatalog.preview.contentNotRequested")).toBeTruthy();
    },
  );

  it("offers a loading hint for unavailable indexed Binary without a reason", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "local_index",
      rows: [{ blob: { mode: "unavailable" } }],
      total: 1,
    });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "blob", type: "binary" }] }}
      />,
    );
    const cell = await screen.findByText("dataCatalog.preview.binaryContentUnavailable");
    expect(screen.queryByText("dataCatalog.preview.fieldContentUnavailable")).toBeNull();
    fireEvent.mouseEnter(cell);
    expect(
      await screen.findByText("dataCatalog.preview.binaryContentUnavailableHint"),
    ).toBeTruthy();
  });

  it("preserves Other objects when the response does not identify its query source", async () => {
    const value = { mode: "unavailable", data: "source content" };
    previewCatalogResourceMock.mockResolvedValue({ rows: [{ value }], total: 1 });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "value", type: "other" }] }}
      />,
    );
    const text = JSON.stringify(value);
    fireEvent.click(await screen.findByRole("button", { name: `${text.slice(0, 20)}…` }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByText("dataCatalog.preview.fieldContentUnavailable")).toBeNull();
  });

  it("renders JSON objects with mode and reason as source content", async () => {
    const value = { mode: "unavailable", reason: "unsupported_source_type" };
    previewCatalogResourceMock.mockResolvedValue({ rows: [{ value }], total: 1 });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "value", type: "json" }] }}
      />,
    );
    expect(await screen.findByText(JSON.stringify(value))).toBeTruthy();
    expect(screen.queryByText("dataCatalog.preview.fieldContentUnavailable")).toBeNull();
  });

  it("preserves Other arrays, empty arrays and actual NULL", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ value: [1, 2] }, { value: [] }, { value: null }],
      total: 3,
    });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "value", type: "other" }] }}
      />,
    );
    expect(await screen.findByText("[1,2]")).toBeTruthy();
    expect(screen.getByText("[]")).toBeTruthy();
    expect(screen.getAllByText("NULL")).toHaveLength(1);
  });

  it("renders unavailable Other values without exposing their response wrapper", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "local_index",
      rows: [{ legacy_profile: { mode: "unavailable" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          schema: [{ name: "legacy_profile", type: "other" }],
        }}
      />,
    );

    expect(await screen.findByText("dataCatalog.preview.fieldContentUnavailable")).toBeTruthy();
    expect(screen.queryByText('{"mode":"unavailable"}')).toBeNull();
  });

  it("truncates Binary content in the cell while preserving the full value for its tooltip", async () => {
    const content = "A".repeat(80);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ blob: { byte_length: 60, data: content, mode: "content" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          localIndexStatus: "available",
          schema: [{ name: "blob", type: "binary" }],
        }}
      />,
    );

    expect(await screen.findByText(`${"A".repeat(20)}…`)).toBeTruthy();
    expect(screen.queryByText(content)).toBeNull();
  });

  it("truncates string and text cells while preserving their full values for tooltips", async () => {
    const content = "x".repeat(80);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ description: content, name: content }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 2,
          schema: [
            { name: "name", type: "string" },
            { name: "description", type: "text" },
          ],
        }}
      />,
    );

    expect(await screen.findAllByText(`${"x".repeat(20)}…`)).toHaveLength(2);
    expect(screen.queryByText(content)).toBeNull();
    expect(screen.queryByLabelText("dataCatalog.preview.loadBinaryContent")).toBeNull();
  });

  it("opens and copies a full long-text value without widening its table cell", async () => {
    const content = "x".repeat(8_000);
    writeTextToClipboardMock.mockResolvedValue(undefined);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ description: content }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "description", type: "text" }] }}
      />,
    );

    const preview = await screen.findByRole("button", { name: `${"x".repeat(20)}…` });
    expect(preview).toBeTruthy();
    fireEvent.click(preview);

    expect(await screen.findByText(content)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.copyFullValue" }));
    expect(writeTextToClipboardMock).toHaveBeenCalledWith(content);
    await waitFor(() => {
      expect(messageMock.success).toHaveBeenCalledWith("dataCatalog.preview.copyFullValueSuccess");
    });
  });

  it("opens and copies Binary content when it was explicitly loaded", async () => {
    const content = "QmluYXJ5IGNvbnRlbnQgZm9yIGNvcHlpbmcu";
    writeTextToClipboardMock.mockResolvedValue(undefined);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ blob: { byte_length: 24, data: content, mode: "content" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "blob", type: "binary" }] }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: `${content.slice(0, 20)}…` }));
    expect(await screen.findByText(content)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.copyFullValue" }));
    await waitFor(() => {
      expect(writeTextToClipboardMock).toHaveBeenCalledWith(content);
      expect(messageMock.success).toHaveBeenCalledWith("dataCatalog.preview.copyFullValueSuccess");
    });
  });

  it("opens and copies serialized Other content when it is too long for the cell", async () => {
    const content = {
      geometry: "POLYGON((116.4 39.9,116.5 39.9,116.5 40.0,116.4 40.0,116.4 39.9))",
    };
    const serialized = JSON.stringify(content);
    writeTextToClipboardMock.mockResolvedValue(undefined);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ service_area: content }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          schema: [{ name: "service_area", type: "other" }],
        }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: `${serialized.slice(0, 20)}…` }));
    expect(await screen.findByText(serialized)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.copyFullValue" }));
    await waitFor(() => {
      expect(writeTextToClipboardMock).toHaveBeenCalledWith(serialized);
      expect(messageMock.success).toHaveBeenCalledWith("dataCatalog.preview.copyFullValueSuccess");
    });
  });

  it("lets the user force source data and opt in to Binary content", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "local_index",
      rows: [{ blob: { mode: "unavailable" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          localIndexName: "idx_orders",
          localIndexStatus: "available",
          schema: [{ name: "blob", type: "binary" }],
        }}
      />,
    );

    expect(await screen.findByText("dataCatalog.preview.dataSourceIndex")).toBeTruthy();
    expect(
      screen.getByLabelText("dataCatalog.preview.loadBinaryContent").getAttribute("disabled"),
    ).not.toBeNull();

    fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("resource-1", {
        binaryMode: "metadata",
        ignoreLocalIndex: true,
        limit: 10,
        offset: 0,
      });
    });

    fireEvent.click(screen.getByLabelText("dataCatalog.preview.loadBinaryContent"));
    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("resource-1", {
        binaryMode: "content",
        ignoreLocalIndex: true,
        limit: 10,
        offset: 0,
      });
    });
  });

  it("limits index preview pages to the backend result window while showing the actual total", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "local_index",
      rows: Array.from({ length: 10 }, (_, id) => ({ id })),
      total: 12000,
    });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "id", type: "integer" }] }}
      />,
    );

    expect(await screen.findByTestId("pagination-total")).toHaveTextContent("10000");
    expect(screen.getByText("dataCatalog.preview.indexPageLimit")).toBeTruthy();
  });

  it("keeps source preview pages accessible beyond the index result window", async () => {
    previewCatalogResourceMock.mockResolvedValue({ querySource: "source", rows: [], total: 12000 });
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "id", type: "integer" }] }}
      />,
    );

    expect(await screen.findByTestId("pagination-total")).toHaveTextContent("12000");
    expect(screen.queryByText("dataCatalog.preview.indexPageLimit")).toBeNull();
  });

  it("ignores a late source Binary-content response after returning to the local index", async () => {
    let resolveContent:
      | ((value: {
          querySource: "source";
          rows: Array<Record<string, unknown>>;
          total: number;
        }) => void)
      | undefined;
    previewCatalogResourceMock.mockImplementation(
      (_, query: { binaryMode?: string; ignoreLocalIndex?: boolean }) => {
        if (query.ignoreLocalIndex && query.binaryMode === "content") {
          return new Promise((resolve) => {
            resolveContent = resolve;
          });
        }
        return Promise.resolve({
          querySource: query.ignoreLocalIndex ? "source" : "local_index",
          rows: [
            {
              blob: query.ignoreLocalIndex
                ? { byte_length: 3, mode: "metadata" }
                : { mode: "unavailable" },
            },
          ],
          total: 1,
        });
      },
    );

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          localIndexName: "idx_orders",
          localIndexStatus: "available",
          schema: [{ name: "blob", type: "binary" }],
        }}
      />,
    );

    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
    await screen.findByText("dataCatalog.preview.dataSourceOriginal");
    fireEvent.click(screen.getByLabelText("dataCatalog.preview.loadBinaryContent"));
    fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));

    await screen.findByText("dataCatalog.preview.dataSourceIndex");
    expect(resolveContent).toBeTypeOf("function");
    if (!resolveContent) {
      throw new Error("expected the source Binary-content request to remain pending");
    }
    resolveContent({
      querySource: "source",
      rows: [{ blob: { byte_length: 12, data: "late-source-content", mode: "content" } }],
      total: 1,
    });

    await waitFor(() => {
      expect(screen.getByText("dataCatalog.preview.dataSourceIndex")).toBeTruthy();
    });
    expect(screen.queryByText("late-source-content")).toBeNull();
  });

  it("requests Binary metadata and content directly when no local index is available", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      querySource: "source",
      rows: [{ blob: { byte_length: 3, mode: "metadata" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          localIndexStatus: "available",
          schema: [{ name: "blob", type: "binary" }],
        }}
      />,
    );

    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("resource-1", {
        binaryMode: "metadata",
        limit: 10,
        offset: 0,
      });
    });
    expect(screen.getByLabelText("dataCatalog.preview.queryOriginalSource")).toBeDisabled();
    expect(
      screen.getByLabelText("dataCatalog.preview.loadBinaryContent").getAttribute("disabled"),
    ).toBeNull();

    fireEvent.click(screen.getByLabelText("dataCatalog.preview.loadBinaryContent"));
    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith("resource-1", {
        binaryMode: "content",
        limit: 10,
        offset: 0,
      });
    });
  });
  // 读行数据与看结构是两份授权。面板自己发请求,一条裸 403 让人分不清是表、连接还是
  // 自己的权限出了问题——按状态码翻译成一句人话,不去问权限点(前端已不做权限管控)。
  it("names the missing grant when the backend refuses the read", async () => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { description: "no permission" } },
      }),
    );

    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "id", type: "integer" }] }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("dataCatalog.preview.noQueryPermission").closest(".ant-alert"),
      ).toHaveClass("ant-alert-warning");
    });
  });

  it.each([
    [
      "en-US",
      "The value for status exceeds the maximum indexed keyword length (256 UTF-16 code units).",
    ],
    ["zh-CN", "字段 status 的筛选值超过关键词最大索引长度（256 个 UTF-16 代码单元）。"],
  ])("renders the keyword limit explanation in %s", async (language, expected) => {
    const translator = createInstance();
    await translator.init({
      lng: language,
      resources: {
        "en-US": { translation: dataCatalogEnUS },
        "zh-CN": { translation: dataCatalogZhCN },
      },
    });
    const original = translateMock.getMockImplementation()!;
    translateMock.mockImplementation((key, options) => translator.t(key, options));
    try {
      previewCatalogResourceMock.mockRejectedValue(
        Object.assign(new Error("rejected"), {
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              error_code: "VegaBackend.Resource.QueryValueExceedsKeywordLimit",
              metadata: { field: "status", limit: 256 },
            },
          },
        }),
      );
      const { unmount } = render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, schema: [{ name: "status", type: "string" }] }}
        />,
      );
      expect(await screen.findByText(expected)).toBeInTheDocument();
      unmount();
    } finally {
      translateMock.mockImplementation(original);
    }
  });

  it.each(["table", "logical_view"] as const)(
    "preserves an oversized %s filter when the user explicitly queries the source",
    async (category) => {
      const value = "CLOSED" + "X".repeat(251);
      const filterCondition = {
        operation: "and",
        sub_conditions: [{ field: "status", operation: "==", value, value_from: "const" }],
      };
      Object.assign(testFilterRule, { field: "status", operation: "==", value });
      previewCatalogResourceMock
        .mockResolvedValueOnce({ rows: [{ status: "OPEN" }], total: 1, querySource: "local_index" })
        .mockRejectedValue(
          Object.assign(new Error("rejected"), {
            isAxiosError: true,
            response: {
              status: 400,
              data: {
                error_code: "VegaBackend.Resource.QueryValueExceedsKeywordLimit",
                description: "Invalid resource parameter",
                error_details: "private diagnostic",
                metadata: { field: "status", limit: 256 },
              },
            },
          }),
        );
      const previewResource: CatalogResource = {
        ...(category === "logical_view" ? tableView : resource),
        schema: [{ name: "status", type: "string" }],
        localIndexStatus: "available",
        localIndexName: "index",
      };
      render(<ResourcePreviewPanel active resource={previewResource} />);
      await screen.findByText("OPEN");
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.filter" }));
      fireEvent.click(screen.getByRole("button", { name: "set-test-filter" }));
      fireEvent.click(screen.getByRole("button", { name: "dataCatalog.preview.applyFilter" }));
      expect(
        await screen.findByText("dataCatalog.preview.keywordLimitExceeded:status:256"),
      ).toBeInTheDocument();
      expect(screen.getByText("dataCatalog.preview.keywordLimitSourceHint")).toBeInTheDocument();
      expect(screen.queryByText("private diagnostic")).not.toBeInTheDocument();
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(2);
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(previewResource.id, {
        filterCondition,
        limit: 10,
        offset: 0,
      });
      previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0, querySource: "source" });
      fireEvent.click(screen.getByLabelText("dataCatalog.preview.queryOriginalSource"));
      await waitFor(() => expect(previewCatalogResourceMock).toHaveBeenCalledTimes(3));
      expect(previewCatalogResourceMock).toHaveBeenLastCalledWith(previewResource.id, {
        filterCondition,
        limit: 10,
        offset: 0,
        ignoreLocalIndex: true,
      });
      await waitFor(() =>
        expect(
          screen.queryByText("dataCatalog.preview.keywordLimitExceeded:status:256"),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it.each([
    {
      name: "source-supported fixed filter",
      sourceCategory: "table" as const,
      operation: "==",
      hint: "keywordLimitSourceHint",
      switchable: true,
    },
    {
      name: "fulltext fixed filter",
      sourceCategory: "table" as const,
      operation: "match",
      hint: "keywordLimitShortenHint",
      switchable: false,
    },
    {
      name: "unrecognized fixed filter",
      sourceCategory: "table" as const,
      operation: "future_operation",
      hint: "keywordLimitShortenHint",
      switchable: false,
    },
    {
      name: "native index source",
      sourceCategory: "index" as const,
      operation: "==",
      hint: "keywordLimitShortenHint",
      switchable: false,
    },
  ])(
    "gives the correct keyword-limit recovery hint on initial failure with $name",
    async ({ sourceCategory, operation, hint, switchable }) => {
      previewCatalogResourceMock.mockRejectedValue(
        Object.assign(new Error("rejected"), {
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              error_code: "VegaBackend.Resource.QueryValueExceedsKeywordLimit",
              metadata: { field: "status", limit: 256 },
            },
          },
        }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...tableView,
            sourceMetadata: { sourceCategory },
            schema: [{ name: "status", type: "string" }],
            logicalViewDefinition: {
              sourceResourceId: "source-1",
              filterCondition: { field: "status", operation, value: "long value" },
            },
          }}
        />,
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(`dataCatalog.preview.${hint}`);
      expect(
        screen.queryByText(
          `dataCatalog.preview.${switchable ? "keywordLimitShortenHint" : "keywordLimitSourceHint"}`,
        ),
      ).not.toBeInTheDocument();
      const toggle = screen.getByRole("checkbox", {
        name: "dataCatalog.preview.queryOriginalSource",
      });
      if (switchable) expect(toggle).toBeEnabled();
      else expect(toggle).toBeDisabled();
      expect(previewCatalogResourceMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    undefined,
    null,
    "status:256",
    { field: "status" },
    { field: "status", limit: -1 },
    { field: "status", limit: "256" },
    { field: "status", limit: 1.5 },
    { field: "", limit: 256 },
  ])("uses a localized fallback for invalid keyword metadata %j", async (metadata) => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("rejected"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error_code: "VegaBackend.Resource.QueryValueExceedsKeywordLimit",
            description: "private description",
            error_details: "private diagnostic",
            metadata,
          },
        },
      }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "status", type: "string" }] }}
      />,
    );
    expect(
      await screen.findByText("dataCatalog.preview.keywordLimitExceededGeneric"),
    ).toBeInTheDocument();
    expect(screen.queryByText("private description")).not.toBeInTheDocument();
    expect(screen.queryByText("private diagnostic")).not.toBeInTheDocument();
  });

  it("does not infer keyword errors from details or metadata on a generic error code", async () => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("rejected"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error_code: "VegaBackend.Resource.InvalidParameter",
            description: "Invalid resource parameter",
            error_details:
              "value for string field status exceeds keyword ignore_above 256 and cannot be compared exactly",
            metadata: { field: "status", limit: 256 },
          },
        },
      }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, schema: [{ name: "status", type: "string" }] }}
      />,
    );
    expect(await screen.findByText("Invalid resource parameter")).toBeInTheDocument();
    expect(screen.queryByText(/dataCatalog.preview.keywordLimit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/exceeds keyword ignore_above/)).not.toBeInTheDocument();
  });

  it.each([
    ["VegaBackend.Query.InvalidParameter.OutputField", "invalidOutputField"],
    ["VegaBackend.Query.UnsupportedOutputField", "unsupportedOutputField"],
    ["VegaBackend.Query.NoQueryableFields", "noQueryableFields"],
  ])(
    "keeps the backend description alongside the projection explanation for %s",
    async (code, key) => {
      previewCatalogResourceMock.mockRejectedValue(
        Object.assign(new Error("rejected"), {
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              error_code: code,
              description: "Field VALUE of type ARRAY<FLOAT> cannot be queried.",
            },
          },
        }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, columnCount: 1, schema: [{ name: "value", type: "other" }] }}
        />,
      );
      const explanation = await screen.findByText(`dataCatalog.preview.${key}`);
      expect(explanation.closest(".ant-alert")).toHaveTextContent(
        "Field VALUE of type ARRAY<FLOAT> cannot be queried.",
      );
    },
  );

  it.each([
    ["VegaBackend.Query.InvalidParameter.OutputField", "invalidOutputField"],
    ["VegaBackend.Query.UnsupportedOutputField", "unsupportedOutputField"],
    ["VegaBackend.Query.NoQueryableFields", "noQueryableFields"],
  ])(
    "shows the localized projection explanation and code when %s has no response description",
    async (code, key) => {
      previewCatalogResourceMock.mockRejectedValue(
        Object.assign(new Error("Request failed with status code 400"), {
          isAxiosError: true,
          response: { status: 400, data: { error_code: code } },
        }),
      );
      render(
        <ResourcePreviewPanel
          active
          resource={{ ...resource, columnCount: 1, schema: [{ name: "value", type: "other" }] }}
        />,
      );
      const explanation = await screen.findByText(`dataCatalog.preview.${key}`);
      expect(
        explanation.closest(".ant-alert")?.querySelector(".ant-alert-description"),
      ).toHaveTextContent(code);
      expect(screen.queryByText("Request failed with status code 400")).not.toBeInTheDocument();
    },
  );

  it("does not repeat a backend description identical to the localized explanation", async () => {
    const explanation = "dataCatalog.preview.noQueryableFields";
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("rejected"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { error_code: "VegaBackend.Query.NoQueryableFields", description: explanation },
        },
      }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "value", type: "other" }] }}
      />,
    );
    await screen.findByText(explanation);
    expect(screen.getAllByText(explanation)).toHaveLength(1);
  });

  it("keeps real source failures distinct from invalid projections", async () => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("failed"), {
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            error_code: "VegaBackend.Resource.InternalError",
            description: "source unavailable",
          },
        },
      }),
    );
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "id", type: "integer" }] }}
      />,
    );
    expect(await screen.findByText("source unavailable")).toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.preview.invalidOutputField")).not.toBeInTheDocument();
  });

  it.each(["table", "logical_view"] as const)(
    "keeps the localized source grant hint without Axios fallback text for %s",
    async (category) => {
      previewCatalogResourceMock.mockRejectedValue(
        Object.assign(new Error("Request failed with status code 403"), {
          isAxiosError: true,
          response: {
            status: 403,
            data: { error_code: "VegaBackend.Resource.SourceReadForbidden" },
          },
        }),
      );

      render(
        <ResourcePreviewPanel
          active
          resource={{
            ...(category === "logical_view" ? viewResource : resource),
            category,
            sourceIdentifier: "APP.ORDERS",
            columnCount: 1,
            schema: [{ name: "id", type: "integer" }],
          }}
        />,
      );

      expect(
        await screen.findByText(
          category === "table"
            ? "dataCatalog.preview.sourceReadForbidden:APP.ORDERS"
            : "dataCatalog.preview.sourceReadForbiddenGeneric",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          category === "table"
            ? "dataCatalog.preview.sourceReadForbiddenDescription"
            : "dataCatalog.preview.sourceReadForbiddenGenericDescription",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Request failed with status code 403")).not.toBeInTheDocument();
      expect(screen.queryByText("dataCatalog.preview.noQueryPermission")).not.toBeInTheDocument();
    },
  );

  it("preserves the source description and ignores legacy solution", async () => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error_code: "VegaBackend.Resource.SourceReadForbidden",
            description: "The underlying view depends on APP.BASE_TABLE",
            solution: "Grant SELECT on APP.BASE_TABLE",
          },
        },
      }),
    );

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          sourceIdentifier: "PAL_CONTENT.AUTOML_LOG",
          columnCount: 1,
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(
      await screen.findByText("dataCatalog.preview.sourceReadForbidden:PAL_CONTENT.AUTOML_LOG"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("dataCatalog.preview.sourceReadForbiddenDescription"),
    ).toBeInTheDocument();
    expect(screen.getByText("The underlying view depends on APP.BASE_TABLE")).toBeInTheDocument();
    expect(screen.queryByText("Grant SELECT on APP.BASE_TABLE")).not.toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.preview.noQueryPermission")).toBeNull();
  });

  it("does not identify a logic view ID as the denied source", async () => {
    previewCatalogResourceMock.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error_code: "VegaBackend.Resource.SourceReadForbidden",
            description: "The data source account cannot read this resource",
          },
        },
      }),
    );

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...viewResource,
          name: "orders_view",
          sourceIdentifier: "logic-view-id",
          columnCount: 1,
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(
      await screen.findByText("dataCatalog.preview.sourceReadForbiddenGeneric"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("dataCatalog.preview.sourceReadForbiddenGenericDescription"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/logic-view-id/)).toBeNull();
    expect(screen.queryByText("dataCatalog.preview.noQueryPermission")).toBeNull();
  });

  it("does not request rows when effective resource operations omit query_data", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          operations: ["view_detail"],
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(
      screen.getByText("dataCatalog.preview.noQueryPermission").closest(".ant-alert"),
    ).toHaveClass("ant-alert-warning");
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not request rows when resource operations are unavailable", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          operations: undefined,
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.noQueryPermission")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it.each([
    { id: "res-query-source-switch-view", switchState: "enabled", total: 3, source: "local_index" },
    {
      id: "res-query-source-fulltext-view",
      switchState: "disabled",
      total: 1,
      source: "local_index",
    },
    { id: "res-query-source-no-index-view", switchState: "disabled", total: 3, source: "source" },
  ])(
    "renders the real $id mock fixture with its expected channel controls",
    async ({ id, switchState, total, source }) => {
      const actual = await vi.importActual<
        typeof import("@/modules/data-catalog/services/resource.service")
      >("@/modules/data-catalog/services/resource.service");
      const demo = await actual.getCatalogResource(id);
      expect(demo).not.toBeNull();
      previewCatalogResourceMock.mockImplementation(actual.previewCatalogResource);
      try {
        render(<ResourcePreviewPanel active resource={demo} />);
        await screen.findByText(
          source === "local_index"
            ? "dataCatalog.preview.dataSourceIndex"
            : "dataCatalog.preview.dataSourceOriginal",
        );
        expect(screen.getByTestId("pagination-total")).toHaveTextContent(String(total));
        expect(screen.getAllByRole("row")).toHaveLength(total + 1);
        expect(screen.queryByText("alpha excluded")).not.toBeInTheDocument();
        const toggle = screen.queryByRole("checkbox", {
          name: "dataCatalog.preview.queryOriginalSource",
        });
        if (switchState === "disabled") {
          expect(toggle).toBeDisabled();
          fireEvent.mouseEnter(toggle!.closest("span[tabindex]")!);
          expect(await screen.findByRole("tooltip")).toHaveTextContent(
            source === "source"
              ? "dataCatalog.preview.queryOriginalAlreadyActive"
              : "dataCatalog.preview.fixedFilterRequiresIndex",
          );
        } else {
          expect(toggle).toBeEnabled();
          fireEvent.click(toggle!);
          await screen.findByText("dataCatalog.preview.dataSourceOriginal");
          expect(toggle).toBeChecked();
          expect(screen.getByRole("cell", { name: "NULL" })).toBeInTheDocument();
          fireEvent.click(toggle!);
          await screen.findByText("dataCatalog.preview.dataSourceIndex");
          expect(toggle).not.toBeChecked();
        }
      } finally {
        previewCatalogResourceMock.mockReset();
      }
    },
  );
});
