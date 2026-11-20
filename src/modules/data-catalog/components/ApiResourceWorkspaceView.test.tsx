/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApiResourceFixtures } from "../services/api-resource-mock-data";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { findMockCatalog } from "@/shared/catalog/catalog-mock";
import type { ApiResource, ApiResourceResult } from "../types/api-resource";
import { ApiResourceWorkspaceView } from "./ApiResourceWorkspaceView";

const { get, query, update, ordinaryPreview, message, translate } = vi.hoisted(() => ({
  get: vi.fn(),
  query: vi.fn<typeof import("../services/api-resource.service").queryApiResource>(),
  update: vi.fn(),
  ordinaryPreview: vi.fn(),
  message: { success: vi.fn(), error: vi.fn() },
  translate: (key: string, params?: { total?: number | string }) =>
    key === "common.total" ? `${key} ${params?.total}` : key,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: () => ({ message }) }));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => ({
    snapshot: {
      edition: "professional",
      licensed: true,
      capabilities: [],
      extensions: [],
      limits: {},
      state: "valid",
    },
  }),
}));
vi.mock("../services/api-resource.service", () => ({
  getApiResource: get,
  queryApiResource: query,
}));
vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: vi.fn(),
  updateCatalogResource: update,
  previewCatalogResource: ordinaryPreview,
}));
const key = (name: string) => `dataCatalog.resourceWorkspace.${name}`;
const resource = mockApiResourceFixtures[0];
const pagedWithoutTotal = {
  ...resource,
  api_definition: {
    ...resource.api_definition,
    response: { statuses: { 200: { schema: true } } },
  },
};
const catalog = findMockCatalog("cat-api-demo")!;

function show(
  value: ApiResource = resource,
  canQuery = true,
  onConflict = vi.fn(),
  onEdit = vi.fn(),
) {
  return render(
    <MemoryRouter>
      <ApiResourceWorkspaceView
        resource={value}
        catalog={catalog}
        canEdit
        canQuery={canQuery}
        actions={null}
        feedback={null}
        onEdit={onEdit}
        onConflict={onConflict}
      />
    </MemoryRouter>,
  );
}

describe("API Resource table-style workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_USE_MOCK", "false");
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    get.mockResolvedValue(resource);
    query.mockResolvedValue({
      entries: [
        {
          id: "9007199254740993",
          order_number: "SO-2026-001",
          total_amount: "1234567890.123456789",
        },
      ],
      total_count: 3,
      paging: { next_cursor: null, expires_at_sec: null },
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the shared basic/field panels, exposes exactly detail and preview, and keeps editing explicit", () => {
    const edit = vi.fn();
    show(resource, true, vi.fn(), edit);
    const pageTablist = screen.getAllByRole("tablist")[0];
    expect(
      within(pageTablist)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual([key("tabDetail"), key("tabPreview")]);
    for (const title of [
      "common.basicInfo",
      "dataCatalog.resource.sourceMetadata",
      "dataCatalog.resource.schemaSection",
    ])
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByText("api_demo")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.indexState")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.discoverStatus")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    expect(edit).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("orders the source metadata tabs independently of definition key order and defaults to the request", () => {
    const value = {
      ...resource,
      api_definition: Object.fromEntries(Object.entries(resource.api_definition).reverse()),
    };
    show(value);
    const metadata = screen.getByRole("heading", {
      name: "dataCatalog.resource.sourceMetadata",
    }).parentElement!;
    const tabs = within(metadata).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(
      ["variables", "request", "response", "success", "paging"].map(
        (name) => `dataCatalog.apiResource.${name}`,
      ),
    );
    expect(
      within(metadata).getByRole("tab", { name: "dataCatalog.apiResource.request" }),
    ).toHaveAttribute("aria-selected", "true");
    const request = within(metadata).getByRole("tabpanel", {
      name: "dataCatalog.apiResource.request",
    });
    expect(within(request).getByRole("row", { name: "method GET" })).toBeVisible();
    fireEvent.click(
      within(metadata).getByRole("tab", { name: "dataCatalog.apiResource.variables" }),
    );
    expect(
      within(metadata).getByRole("tabpanel", { name: "dataCatalog.apiResource.variables" }),
    ).toHaveTextContent("confirmed");
    expect(request).not.toBeVisible();
    expect(screen.getAllByRole("tablist")[0]).toHaveTextContent(key("tabDetail"));
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps response status selection separate from metadata and workspace tabs without querying", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: "dataCatalog.apiResource.response" }));
    const response = screen.getByRole("tabpanel", { name: "dataCatalog.apiResource.response" });
    const statuses = within(response).getByRole("tablist", {
      name: "dataConnect.apiEditor.responseStatus",
    });
    expect(
      within(statuses)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["200", "401", "default"]);
    fireEvent.click(within(statuses).getByRole("tab", { name: "401" }));
    expect(within(response).getByRole("tabpanel", { name: "401" })).toHaveTextContent("凭据无效");
    expect(screen.getByRole("tab", { name: "dataCatalog.apiResource.response" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: key("tabDetail") })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "dataCatalog.apiResource.request" }));
    fireEvent.click(screen.getByRole("tab", { name: "dataCatalog.apiResource.response" }));
    expect(within(response).getByRole("tab", { name: "401" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(get).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps optional metadata tabs and shows an explicit empty state for missing paging", () => {
    show(mockApiResourceFixtures[1]);
    const metadata = screen.getByRole("heading", {
      name: "dataCatalog.resource.sourceMetadata",
    }).parentElement!;
    expect(within(metadata).getAllByRole("tab")).toHaveLength(5);
    fireEvent.click(within(metadata).getByRole("tab", { name: "dataCatalog.apiResource.paging" }));
    expect(
      within(metadata).getByRole("tabpanel", { name: "dataCatalog.apiResource.paging" }),
    ).toHaveTextContent("dataCatalog.apiResource.notConfigured");
    expect(get).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("shows complete precision-safe API definition groups while masking only declared sensitive variable values", () => {
    const before = JSON.stringify(resource);
    const value = {
      ...resource,
      api_definition: {
        ...resource.api_definition,
        variables: {
          secret: { value: "demo-only-secret", sensitive: true },
          plain: { value: "visible", sensitive: false },
        },
        future_scalar: "extension",
        exact: parsePrecisionPreservingJSON("9007199254740993.000000001"),
      },
    };
    show(value);
    const metadata = screen.getByRole("heading", {
      name: "dataCatalog.resource.sourceMetadata",
    }).parentElement!;
    const text = metadata.textContent;
    expect(text).toContain("Authorization");
    expect(text).toContain("Bearer {{ api_key }}");
    expect(text).toContain("9007199254740993.000000001");
    expect(text).toContain("extension");
    expect(text).toContain("visible");
    expect(text).not.toContain("demo-only-secret");
    expect(text).toContain("••••••••");
    for (const name of ["request", "response", "variables", "success", "paging"])
      expect(
        within(metadata).getByRole("tab", { name: `dataCatalog.apiResource.${name}` }),
      ).toBeInTheDocument();
    expect(metadata.querySelector("pre")).toBeNull();
    expect(metadata.querySelectorAll("table").length).toBeGreaterThan(5);
    expect(JSON.stringify(resource)).toBe(before);
    expect(value.api_definition.variables.secret.value).toBe("demo-only-secret");
  });

  it("loads API data only on entering preview using the saved single-page rule and shared table cells", async () => {
    show();
    expect(query).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    const panel = await screen.findByRole("tabpanel", { name: key("tabPreview") });
    expect(await within(panel).findByText("SO-2026-001")).toBeVisible();
    expect(within(panel).getByText("9007199254740993")).toBeVisible();
    expect(within(panel).getByText("1234567890.123456789")).toBeVisible();
    expect(query).toHaveBeenCalledWith(
      resource.id,
      { paging: { mode: "single", offset: 0, limit: 2 }, need_total: true },
      expect.any(AbortSignal),
    );
    expect(get).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledOnce();
    expect(ordinaryPreview).not.toHaveBeenCalled();
    expect(screen.queryByText("dataCatalog.preview.queryOriginalSource")).toBeNull();
    expect(screen.queryByRole("button", { name: "dataCatalog.preview.filter" })).toBeNull();
  });

  it.each([
    {
      caseName: "only one successful response has a total",
      statuses: { 200: { schema: true, result_total: "count" }, 206: { schema: true } },
      needTotal: false,
    },
    {
      caseName: "an error response has a total",
      statuses: { "2XX": { schema: true }, 500: { schema: true, result_total: "count" } },
      needTotal: false,
    },
    {
      caseName: "an exact response overrides the class response",
      statuses: { "2XX": { schema: true, result_total: "count" }, 206: { schema: true } },
      needTotal: false,
    },
    {
      caseName: "an explicit null prevents fallback to the class response",
      statuses: { "2XX": { schema: true, result_total: "count" }, 206: null },
      needTotal: false,
    },
    {
      caseName: "both successful responses use the class response",
      statuses: { "2XX": { schema: true, result_total: "count" } },
      needTotal: true,
    },
    {
      caseName: "both successful responses use the default response",
      statuses: { default: { schema: true, result_total: "" } },
      needTotal: true,
    },
  ])("queries a saved paged resource when $caseName", async ({ statuses, needTotal }) => {
    const paged = {
      ...resource,
      api_definition: {
        ...resource.api_definition,
        success_rule: { http_status: [200, 206] },
        response: { statuses },
      },
    };
    get.mockResolvedValue(paged);
    query.mockResolvedValue({ entries: [{ id: "success" }] });
    show(paged);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    expect(await screen.findByText("success")).toBeVisible();
    expect(query).toHaveBeenCalledWith(
      paged.id,
      {
        paging: { mode: "single", offset: 0, limit: 2 },
        ...(needTotal ? { need_total: true } : {}),
      },
      expect.any(AbortSignal),
    );
  });

  it("omits paging and total requests for unpaged resources even with a total path", async () => {
    const fixture = mockApiResourceFixtures[1];
    const detail = {
      ...fixture,
      api_definition: {
        ...fixture.api_definition,
        response: { statuses: { 200: { schema: true, result_total: "count" } } },
      },
    };
    get.mockResolvedValue(detail);
    query.mockResolvedValue({ entries: [{ id: "9007199254740993" }] });
    show(detail);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await screen.findByText("9007199254740993");
    expect(query).toHaveBeenCalledWith(detail.id, {}, expect.any(AbortSignal));
    expect(screen.getByText(/dataCatalog.apiResource.unknown/)).toBeVisible();
    expect(screen.getByRole("button", { name: "common.next" })).toBeDisabled();
  });

  it("retries an unpaged API preview with the original request after repeated failures", async () => {
    const unpaged = mockApiResourceFixtures[1];
    const failure = Object.assign(new Error("Preview failed"), {
      isAxiosError: true,
      response: {
        status: 502,
        data: { error_code: "VegaBackend.Query.ExecuteFailed", description: "Preview failed" },
      },
    });
    get.mockResolvedValue(unpaged);
    query.mockImplementation(() =>
      query.mock.calls.length <= 2
        ? Promise.reject(failure)
        : Promise.resolve({ entries: [{ id: "recovered-row" }] }),
    );
    show(unpaged);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));

    for (let attempt = 1; attempt <= 2; attempt++) {
      expect(await screen.findByText("Preview failed")).toBeVisible();
      expect(screen.queryByText("dataCatalog.preview.empty")).not.toBeInTheDocument();
      expect(query).toHaveBeenNthCalledWith(attempt, unpaged.id, {}, expect.any(AbortSignal));
      fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    }
    expect(await screen.findByText("recovered-row")).toBeVisible();
    expect(query).toHaveBeenNthCalledWith(3, unpaged.id, {}, expect.any(AbortSignal));
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("clears unpaged preview rows when rereading the resource is forbidden", async () => {
    const unpaged = mockApiResourceFixtures[1];
    get.mockResolvedValue(unpaged);
    query.mockResolvedValueOnce({ entries: [{ id: "previous-row" }] }).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error_code: "Forbidden" } },
    });
    show(unpaged);
    const previewTab = screen.getByRole("tab", { name: key("tabPreview") });
    fireEvent.click(previewTab);
    await screen.findByText("previous-row");
    fireEvent.click(screen.getByRole("tab", { name: key("tabDetail") }));
    fireEvent.click(previewTab);

    expect(await screen.findByText("dataCatalog.preview.noQueryPermission")).toBeVisible();
    expect(screen.queryByText("previous-row")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.retry" })).not.toBeInTheDocument();
  });

  it("requests the next offset with an unknown total and can go back from an empty page", async () => {
    get.mockResolvedValue(pagedWithoutTotal);
    const paging = { next_cursor: null, expires_at_sec: null };
    const first = {
      entries: [{ id: "first-page-demo" }],
      paging,
      warnings: ["Partial result"],
    };
    query.mockResolvedValue(first).mockResolvedValueOnce(first).mockResolvedValueOnce({
      entries: [],
      paging,
    });
    show(pagedWithoutTotal);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await screen.findByText("first-page-demo");
    expect(screen.getByText("dataCatalog.apiResource.warnings")).toBeVisible();
    expect(screen.getByText(/dataCatalog.apiResource.unknown/)).toBeVisible();
    const next = screen.getByRole("button", { name: "common.next" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await waitFor(() => expect(screen.queryByText("first-page-demo")).not.toBeInTheDocument());
    expect(query).toHaveBeenNthCalledWith(
      2,
      pagedWithoutTotal.id,
      { paging: { mode: "single", offset: 2, limit: 2 } },
      expect.any(AbortSignal),
    );
    expect(screen.getByText(/dataCatalog.apiResource.unknown/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.previous" }));
    expect(await screen.findByText("first-page-demo")).toBeVisible();
    expect(query).toHaveBeenNthCalledWith(
      3,
      pagedWithoutTotal.id,
      { paging: { mode: "single", offset: 0, limit: 2 } },
      expect.any(AbortSignal),
    );
  });

  it("keeps the last successful page and retries the failed offset for an unknown total", async () => {
    get.mockResolvedValue(pagedWithoutTotal);
    query
      .mockResolvedValueOnce({ entries: [{ id: "first-page-demo" }] })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 502,
          data: { error_code: "VegaBackend.Query.ExecuteFailed", description: "Page failed" },
        },
      })
      .mockResolvedValue({ entries: [{ id: "second-page-demo" }] });
    show(pagedWithoutTotal);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await screen.findByText("first-page-demo");
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    expect(await screen.findByText("Page failed")).toBeVisible();
    expect(screen.getByText("first-page-demo")).toBeVisible();
    expect(screen.getByText(/dataCatalog.apiResource.unknown/)).toBeVisible();
    const preview = within(screen.getByRole("tabpanel", { name: key("tabPreview") }));
    expect(preview.queryByText(/^common\.total /)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(await screen.findByText("second-page-demo")).toBeVisible();
    expect(screen.queryByText("Page failed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.previous" })).toBeEnabled();
    for (const request of [2, 3]) {
      expect(query).toHaveBeenNthCalledWith(
        request,
        pagedWithoutTotal.id,
        { paging: { mode: "single", offset: 2, limit: 2 } },
        expect.any(AbortSignal),
      );
    }
  });

  it("keeps the current page and known total until a failed page is successfully retried", async () => {
    query
      .mockResolvedValueOnce({ entries: [{ id: "first-page-demo" }], total_count: 3 })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 502,
          data: { error_code: "VegaBackend.Query.ExecuteFailed", description: "Page failed" },
        },
      })
      .mockResolvedValue({ entries: [{ id: "second-page-demo" }], total_count: 3 });
    show();
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    const preview = within(await screen.findByRole("tabpanel", { name: key("tabPreview") }));
    await preview.findByText("first-page-demo");
    fireEvent.click(preview.getByTitle("2"));

    expect(await preview.findByText("Page failed")).toBeVisible();
    expect(preview.getByText("first-page-demo")).toBeVisible();
    expect(preview.getByText("common.total 3")).toBeVisible();
    expect(preview.getByTitle("1")).toHaveClass("ant-pagination-item-active");
    fireEvent.click(preview.getByRole("button", { name: "common.retry" }));
    expect(await preview.findByText("second-page-demo")).toBeVisible();
    expect(preview.getByTitle("2")).toHaveClass("ant-pagination-item-active");
    for (const request of [2, 3]) {
      expect(query).toHaveBeenNthCalledWith(
        request,
        resource.id,
        { paging: { mode: "single", offset: 2, limit: 2 }, need_total: true },
        expect.any(AbortSignal),
      );
    }
  });

  it.each([0, 1])("synchronizes page and rows when the API total falls to %s", async (total) => {
    query
      .mockResolvedValueOnce({ entries: [{ id: "old-row" }], total_count: 3 })
      .mockResolvedValueOnce({ entries: [], total_count: total })
      .mockResolvedValue({ entries: [{ id: "current-row" }], total_count: total });
    show();
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    const preview = within(await screen.findByRole("tabpanel", { name: key("tabPreview") }));
    await preview.findByText("old-row");
    fireEvent.click(preview.getByTitle("2"));

    expect(await preview.findByText(`common.total ${total}`)).toBeVisible();
    expect(preview.queryByText("old-row")).not.toBeInTheDocument();
    expect(preview.queryByTitle("2")).not.toBeInTheDocument();
    expect(query).toHaveBeenNthCalledWith(
      2,
      resource.id,
      { paging: { mode: "single", offset: 2, limit: 2 }, need_total: true },
      expect.any(AbortSignal),
    );
    if (total === 0) {
      expect(preview.getByText("dataCatalog.preview.empty")).toBeVisible();
      expect(preview.queryByTitle("1")).not.toBeInTheDocument();
      expect(query).toHaveBeenCalledTimes(2);
    } else {
      expect(preview.getByText("current-row")).toBeVisible();
      expect(preview.getByTitle("1")).toHaveClass("ant-pagination-item-active");
      expect(query).toHaveBeenNthCalledWith(
        3,
        resource.id,
        { paging: { mode: "single", offset: 0, limit: 2 }, need_total: true },
        query.mock.calls[1][2],
      );
      expect(query).toHaveBeenCalledTimes(3);
    }
  });

  it("retries the first page if recovering from an out-of-range offset fails", async () => {
    query
      .mockResolvedValueOnce({ entries: [{ id: "old-row" }], total_count: 3 })
      .mockResolvedValueOnce({ entries: [], total_count: 1 })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 502,
          data: { error_code: "VegaBackend.Query.ExecuteFailed", description: "Recovery failed" },
        },
      })
      .mockResolvedValue({ entries: [{ id: "current-row" }], total_count: 1 });
    show();
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    const preview = within(await screen.findByRole("tabpanel", { name: key("tabPreview") }));
    await preview.findByText("old-row");
    fireEvent.click(preview.getByTitle("2"));

    expect(await preview.findByText("Recovery failed")).toBeVisible();
    expect(preview.getByText("old-row")).toBeVisible();
    fireEvent.click(preview.getByRole("button", { name: "common.retry" }));
    expect(await preview.findByText("current-row")).toBeVisible();
    expect(preview.getByText("common.total 1")).toBeVisible();
    expect(query.mock.calls.map(([, request]) => request.paging?.offset)).toEqual([0, 2, 0, 0]);
  });

  it("clears the last page if reading a later page is forbidden", async () => {
    get.mockResolvedValue(pagedWithoutTotal);
    query.mockResolvedValueOnce({ entries: [{ id: "first-page-demo" }] }).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error_code: "Forbidden" } },
    });
    show(pagedWithoutTotal);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await screen.findByText("first-page-demo");
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    expect(await screen.findByText("dataCatalog.preview.noQueryPermission")).toBeVisible();
    expect(screen.queryByText("first-page-demo")).not.toBeInTheDocument();
    const preview = within(screen.getByRole("tabpanel", { name: key("tabPreview") }));
    expect(preview.queryByText(/^common\.total /)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.retry" })).not.toBeInTheDocument();
  });

  it("cancels a pending preview when leaving the tab and does not start a business query afterward", async () => {
    let finish: ((value: ApiResource) => void) | undefined;
    const pending = new Promise<ApiResource>((resolve) => {
      finish = resolve;
    });
    get.mockReturnValueOnce(pending);
    show();
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    const signal = get.mock.calls[0][1] as AbortSignal;
    fireEvent.click(screen.getByRole("tab", { name: key("tabDetail") }));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish!(resource);
      await pending;
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps the last page and row numbers together while reopening the preview", async () => {
    let finish!: (result: ApiResourceResult) => void;
    const reopening = new Promise<ApiResourceResult>((resolve) => {
      finish = resolve;
    });
    query
      .mockResolvedValueOnce({ entries: [{ id: "initial-row" }], total_count: 3 })
      .mockResolvedValueOnce({ entries: [{ id: "second-page-row" }], total_count: 3 })
      .mockReturnValueOnce(reopening);
    show();
    const previewTab = screen.getByRole("tab", { name: key("tabPreview") });
    fireEvent.click(previewTab);
    const preview = within(await screen.findByRole("tabpanel", { name: key("tabPreview") }));
    await preview.findByText("initial-row");
    fireEvent.click(preview.getByTitle("2"));
    const secondPage = await preview.findByRole("row", { name: /second-page-row/ });
    expect(within(secondPage).getAllByRole("cell")[0]).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("tab", { name: key("tabDetail") }));
    fireEvent.click(previewTab);
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3));
    expect(query.mock.calls[2][1].paging).toEqual({ mode: "single", offset: 0, limit: 2 });
    expect(preview.getByTitle("2")).toHaveClass("ant-pagination-item-active");
    const pendingRow = preview.getByRole("row", { name: /second-page-row/ });
    expect(pendingRow).toBeVisible();
    expect(within(pendingRow).getAllByRole("cell")[0]).toHaveTextContent("3");

    await act(async () => {
      finish({ entries: [{ id: "reopened-row" }], total_count: 3 });
      await reopening;
    });
    const reopened = await preview.findByRole("row", { name: /reopened-row/ });
    expect(preview.getByTitle("1")).toHaveClass("ant-pagination-item-active");
    expect(within(reopened).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(secondPage).not.toBeInTheDocument();
  });

  it("blocks disabled preview and detects a concurrent version change before querying", async () => {
    const conflict = vi.fn();
    const view = show(resource, false, conflict);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await screen.findByText("dataCatalog.apiResource.errors.queryUnavailable");
    expect(query).not.toHaveBeenCalled();
    view.unmount();
    get.mockResolvedValue({ ...resource, update_time: resource.update_time + 1 });
    show(resource, true, conflict);
    fireEvent.click(screen.getByRole("tab", { name: key("tabPreview") }));
    await waitFor(() => expect(conflict).toHaveBeenCalledOnce());
    expect(query).not.toHaveBeenCalled();
  });
});
