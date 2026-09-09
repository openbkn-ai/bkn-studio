/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const previewCatalogResourceMock = vi.hoisted(() => vi.fn());
const writeTextToClipboardMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
  TablePaginationBar: () => null,
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
  rowCount: 0,
  schema: [],
  sourceIdentifier: "public.orders",
  updateTime: "-",
  expectedUpdateTime: 0,
};

describe("ResourcePreviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not request preview data for a non-table resource with empty schema and no discover status", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, category: "dataset" }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.metadataUnavailable")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

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

  it("renders unavailable Other values without exposing their response wrapper", async () => {
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ legacy_profile: { mode: "unavailable" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "legacy_profile", type: "other" }] }}
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
    const content = { geometry: "POLYGON((116.4 39.9,116.5 39.9,116.5 40.0,116.4 40.0,116.4 39.9))" };
    const serialized = JSON.stringify(content);
    writeTextToClipboardMock.mockResolvedValue(undefined);
    previewCatalogResourceMock.mockResolvedValue({
      rows: [{ service_area: { data: content, mode: "content" } }],
      total: 1,
    });

    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, columnCount: 1, schema: [{ name: "service_area", type: "other" }] }}
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
    expect(screen.getByLabelText("dataCatalog.preview.loadBinaryContent").getAttribute("disabled")).not.toBeNull();

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

  it("ignores a late source Binary-content response after returning to the local index", async () => {
    let resolveContent: ((value: { querySource: "source"; rows: Array<Record<string, unknown>>; total: number }) => void) | undefined;
    previewCatalogResourceMock.mockImplementation((_, query: { binaryMode?: string; ignoreLocalIndex?: boolean }) => {
      if (query.ignoreLocalIndex && query.binaryMode === "content") {
        return new Promise((resolve) => {
          resolveContent = resolve;
        });
      }
      return Promise.resolve({
        querySource: query.ignoreLocalIndex ? "source" : "local_index",
        rows: [{ blob: query.ignoreLocalIndex ? { byte_length: 3, mode: "metadata" } : { mode: "unavailable" } }],
        total: 1,
      });
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
    expect(screen.queryByLabelText("dataCatalog.preview.queryOriginalSource")).toBeNull();
    expect(screen.getByLabelText("dataCatalog.preview.loadBinaryContent").getAttribute("disabled")).toBeNull();

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
      expect(screen.getByText("dataCatalog.preview.noQueryPermission")).toBeTruthy();
    });
  });
});
