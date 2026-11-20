/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiResourceInput } from "../lib/api-resource";
import type { ApiResource, ApiResourceResult } from "../types/api-resource";

const { get, query, translate } = vi.hoisted(() => ({
  get: vi.fn(),
  query: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));
vi.mock("../services/api-resource.service", () => ({
  getApiResource: get,
  queryApiResource: query,
}));
import { ApiResourceTestPanel } from "./ApiResourceTestPanel";

const resource: ApiResource = {
  ...createApiResourceInput("catalog"),
  id: "resource",
  source_identifier: "resource",
  category: "api",
  api_effect_type: "read",
  update_time: 10,
  status: "active",
  operations: ["query_data"],
  schema_definition: [
    { name: "amount", original_name: "Amount", type: "decimal", filterable: true },
  ],
};
const key = (name: string) => `dataCatalog.apiResource.${name}`;
const runButton = () => screen.getByRole("button", { name: key("run") });

describe("saved API Resource tests", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.clearAllMocks();
    get.mockResolvedValue(resource);
    query.mockResolvedValue({ entries: [] });
  });

  it("labels mock query results as simulated instead of real upstream validation", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    fireEvent.click(runButton());
    expect(await screen.findByText(key("mockTestSuccess"))).toBeVisible();
    expect(screen.queryByText(key("testSuccess"))).toBeNull();
  });

  it("executes no call on mount; uses an empty no-filter input and displays legal empty results with unknown total", async () => {
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    expect(query).not.toHaveBeenCalled();
    fireEvent.click(runButton());
    await screen.findByText(key("testSuccess"));
    expect(query).toHaveBeenCalledWith("resource", {}, expect.any(AbortSignal));
    expect(screen.getByText(key("emptyResult"))).toBeVisible();
    expect(screen.getByText(new RegExp(key("unknown")))).toBeVisible();
  });

  it("preserves exact numeric and time strings, total zero and unknown paging fields", async () => {
    query.mockResolvedValueOnce({
      entries: [{ amount: "1234567890.123456789" }],
      total_count: 0,
      paging: { vendor_marker: "unknown" },
    });
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    fireEvent.click(runButton());
    expect(await screen.findByText("1234567890.123456789")).toBeVisible();
    expect(screen.getByText(/"vendor_marker":"unknown"/)).toBeVisible();
    expect(screen.getByText(`${key("total")}: 0`)).toBeVisible();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("never marks an unsaved definition validated, and invalidates prior results on input/edit revisions", async () => {
    const props = {
      resource,
      canQuery: true,
      revision: 1,
      hasUnsavedDefinition: true,
      onConflict: vi.fn(),
    };
    const view = render(<ApiResourceTestPanel {...props} />);
    fireEvent.click(runButton());
    await screen.findByText(key("staleTest"));
    expect(screen.queryByText(key("testSuccess"))).toBeNull();
    view.rerender(<ApiResourceTestPanel {...props} hasUnsavedDefinition={false} revision={2} />);
    expect(screen.getByText(key("staleTest"))).toBeVisible();
  });

  it("blocks denied/disabled query access and detects a newer saved definition before executing", async () => {
    const conflict = vi.fn();
    const view = render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery={false}
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={conflict}
      />,
    );
    expect(runButton()).toBeDisabled();
    view.rerender(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={conflict}
      />,
    );
    get.mockResolvedValueOnce({ ...resource, update_time: 11 });
    fireEvent.click(runButton());
    await waitFor(() => expect(conflict).toHaveBeenCalledOnce());
    expect(query).not.toHaveBeenCalled();
  });

  it("does not offer filters while the API connector does not support them", async () => {
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: key("testFilter") })).toBeNull();
    fireEvent.click(runButton());
    expect(await screen.findByText(key("testSuccess"))).toBeVisible();
    expect(query).toHaveBeenCalledWith(resource.id, {}, expect.any(AbortSignal));
  });

  it("discards results if the saved definition changes during the business call", async () => {
    const conflict = vi.fn();
    get.mockResolvedValueOnce(resource).mockResolvedValueOnce({ ...resource, update_time: 11 });
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={conflict}
      />,
    );
    fireEvent.click(runButton());
    await waitFor(() => expect(conflict).toHaveBeenCalledOnce());
    expect(query).toHaveBeenCalledOnce();
    expect(screen.queryByText(key("testSuccess"))).toBeNull();
  });

  it.each([
    ["VegaBackend.Catalog.IsDisabled", false],
    ["VegaBackend.Connector.Disabled", false],
    ["VegaBackend.Resource.UpdateConflict", true],
  ])(
    "uses the error code %s to decide whether the resource version changed",
    async (code, conflict) => {
      const onConflict = vi.fn();
      query.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { error_code: code, description: "Query failed" } },
      });
      render(
        <ApiResourceTestPanel
          resource={resource}
          canQuery
          revision={0}
          hasUnsavedDefinition={false}
          onConflict={onConflict}
        />,
      );
      fireEvent.click(runButton());
      expect(await screen.findByText(`${code} · Query failed`)).toBeVisible();
      expect(onConflict).toHaveBeenCalledTimes(conflict ? 1 : 0);
    },
  );

  it("preserves omitted/zero paging and presents server failures without retry or raw error details", async () => {
    query.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error_code: "UnsupportedPaging",
          description: "Unsupported paging",
          metadata: { stage: "request" },
          error_details: "sensitive upstream body",
        },
      },
    });
    const paged = {
      ...resource,
      api_definition: {
        ...resource.api_definition,
        paging_rule: { mode: "offset", default_limit: 2, max_limit: 10 },
      },
    };
    get.mockResolvedValue(paged);
    render(
      <ApiResourceTestPanel
        resource={paged}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: key("testPaging") }));
    fireEvent.change(screen.getByRole("spinbutton", { name: key("offset") }), {
      target: { value: "0" },
    });
    fireEvent.click(runButton());
    await screen.findByText(/Unsupported paging/);
    expect(query.mock.calls[0][1]).toEqual({ paging: { mode: "single", offset: 0 } });
    expect(query).toHaveBeenCalledOnce();
    expect(screen.queryByText(/sensitive upstream body/)).toBeNull();
  });

  it.each([
    { paged: false, totals: false },
    { paged: true, totals: false },
    { paged: true, totals: true },
  ])("limits advanced query options to supported capabilities (%o)", ({ paged, totals }) => {
    render(
      <ApiResourceTestPanel
        resource={{
          ...resource,
          api_definition: {
            ...resource.api_definition,
            ...(paged ? { paging_rule: { mode: "offset", default_limit: 2, max_limit: 10 } } : {}),
            response: {
              statuses: { 200: { schema: true, ...(totals ? { result_total: "count" } : {}) } },
            },
          },
        }}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    expect(Boolean(screen.queryByRole("checkbox", { name: key("testPaging") }))).toBe(paged);
    expect(Boolean(screen.queryByRole("checkbox", { name: key("needTotal") }))).toBe(totals);
    expect(runButton()).toBeEnabled();
  });

  it("cancels a pending test and ignores a late completion", async () => {
    let finish!: (result: ApiResourceResult) => void;
    query.mockImplementationOnce(
      () =>
        new Promise<ApiResourceResult>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ApiResourceTestPanel
        resource={resource}
        canQuery
        revision={0}
        hasUnsavedDefinition={false}
        onConflict={vi.fn()}
      />,
    );
    fireEvent.click(runButton());
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
    const signal = query.mock.calls[0][2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish({ entries: [] });
      await Promise.resolve();
    });
    expect(screen.queryByText(key("testSuccess"))).toBeNull();
  });
});
