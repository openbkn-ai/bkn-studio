/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperienceScene } from "./ExperienceScene";
import type { ContextLoaderIntegrationPanel } from "./ContextLoaderIntegrationPanel";
import type { DataBrowserPanel } from "./DataBrowserPanel";

const mocks = vi.hoisted(() => ({
  fetchKnDetailRest: vi.fn(),
  listMcpCatalog: vi.fn(),
  sendRequest: vi.fn(),
  writeTextToClipboard: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  runtimeConfig: {
    auth: { tokenManager: { getAccessToken: () => null, refreshAccessToken: vi.fn() } },
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  App: { useApp: () => ({ message: mocks.message }) },
}));

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => mocks.runtimeConfig,
}));

vi.mock("@/framework/compat/clipboard", () => ({
  writeTextToClipboard: mocks.writeTextToClipboard,
}));

vi.mock("@/modules/knowledge-network/services/context-loader.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/context-loader.service")
  >()),
  fetchKnDetailRest: mocks.fetchKnDetailRest,
  listMcpCatalog: mocks.listMcpCatalog,
  sendRequest: mocks.sendRequest,
}));

vi.mock("@/modules/knowledge-network/services/bkn-lifecycle.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/bkn-lifecycle.service")
  >()),
  withManagedTurn: (_lifecycle: unknown, _purpose: string, send: () => Promise<unknown>) => send(),
}));

vi.mock("./McpIntegrationModals", () => ({
  McpSetupModal: () => null,
  ToolDiscoveryModal: () => null,
}));

vi.mock("./ContextLoaderIntegrationPanel", () => ({
  ContextLoaderIntegrationPanel: ({
    activeOps,
    onSelectOp,
    bodyText,
    onBodyTextChange,
    onFillTestData,
    dataBrowserPanel,
    onSend,
    sending,
    responseView,
  }: ComponentProps<typeof ContextLoaderIntegrationPanel>) => (
    <>
      <button
        type="button"
        disabled={!activeOps.some((op) => op.id === "run_sql")}
        onClick={() => onSelectOp("run_sql")}
      >
        Select run_sql
      </button>
      <button type="button" onClick={onFillTestData}>
        Fill test data
      </button>
      <textarea
        aria-label="Request body"
        value={bodyText}
        onChange={(event) => onBodyTextChange(event.target.value)}
      />
      <button type="button" onClick={onSend} disabled={sending}>
        Send request
      </button>
      <output aria-label="Response kind">{responseView?.kind}</output>
      <output aria-label="Response text">{responseView?.text}</output>
      {dataBrowserPanel}
    </>
  ),
}));

vi.mock("./DataBrowserPanel", () => ({
  DataBrowserPanel: ({ onFillResource }: ComponentProps<typeof DataBrowserPanel>) => (
    <button type="button" onClick={() => onFillResource("res_orders")}>
      Fill resource
    </button>
  ),
}));

async function renderConsole(mode: "rest" | "mcp") {
  render(
    <MemoryRouter>
      <ExperienceScene
        embedded
        lockMode
        initialMode={mode}
        network={{ id: "network-1", slug: "kn_demo", name: "Demo" }}
      />
    </MemoryRouter>,
  );
  const selectSql = screen.getByRole("button", { name: "Select run_sql" });
  await waitFor(() => expect(selectSql).not.toBeDisabled());
  fireEvent.click(selectSql);
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Request body" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writeTextToClipboard.mockResolvedValue(undefined);
  mocks.listMcpCatalog.mockResolvedValue({ tools: [{ name: "run_sql" }] });
  mocks.fetchKnDetailRest.mockResolvedValue({
    id: "kn_demo",
    object_types: [{ id: "order", data_source: { id: "res_orders" } }],
    relation_types: [],
    concept_groups: [],
  });
});

describe.each(["rest", "mcp"] as const)("ExperienceScene resource fill in %s", (mode) => {
  it("keeps generated test SQL canonical when the resource is filled again", async () => {
    const body = await renderConsole(mode);
    fireEvent.click(screen.getByRole("button", { name: "Fill test data" }));
    await waitFor(() => {
      expect(JSON.parse(body.value)).toMatchObject({
        sql: "SELECT * FROM {{res_orders}} LIMIT 10",
      });
    });
    const generatedBody = body.value;

    fireEvent.click(screen.getByRole("button", { name: "Fill resource" }));

    expect(body.value).toBe(generatedBody);
    expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
  });

  it("uses a canonical reference when SQL has no placeholder", async () => {
    const body = await renderConsole(mode);
    fireEvent.change(body, {
      target: { value: JSON.stringify({ sql: "SELECT id FROM orders", query_timeout: 12 }) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Fill resource" }));

    expect(JSON.parse(body.value)).toEqual({
      sql: "SELECT * FROM {{res_orders}} LIMIT 20",
      query_timeout: 12,
    });
    expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
  });

  it("copies a canonical reference when the body cannot be parsed", async () => {
    const body = await renderConsole(mode);
    fireEvent.change(body, { target: { value: "{invalid JSON" } });

    fireEvent.click(screen.getByRole("button", { name: "Fill resource" }));

    expect(mocks.writeTextToClipboard).toHaveBeenCalledExactlyOnceWith("{{res_orders}}");
    expect(body.value).toBe("{invalid JSON");
  });
});

describe("ExperienceScene response display", () => {
  it.each([
    { name: "JSON overflow", text: '{"value":1e10000001}' },
    { name: "JSON underflow", text: '{"value":1e-10000001}' },
    { name: "SSE overflow", text: 'event: result\ndata: {"value":1e10000001}\n\n' },
    { name: "SSE underflow", text: 'event: result\ndata: {"value":1e-10000001}\n\n' },
  ])("falls back to the complete original response for $name", async ({ text }) => {
    mocks.sendRequest.mockResolvedValue({ ok: true, status: 200, text, sizeBytes: text.length });
    await renderConsole("rest");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(screen.getByLabelText("Response text").textContent).toBe(text));
    expect(screen.getByLabelText("Response kind")).toHaveTextContent("toon");
    expect(screen.getByRole("button", { name: "Send request" })).not.toBeDisabled();
  });

  it.each([
    { name: "JSON", text: '{"value":42}', expected: '{\n  "value": 42\n}' },
    { name: "SSE", text: 'data: {"value":42}\n\n', expected: '{\n  "value": 42\n}' },
    { name: "precise JSON", text: '{"value":1e309}', expected: '{\n  "value": 1e+309\n}' },
  ])("keeps formatting supported $name responses", async ({ text, expected }) => {
    mocks.sendRequest.mockResolvedValue({ ok: true, status: 200, text, sizeBytes: text.length });
    await renderConsole("rest");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(screen.getByLabelText("Response text").textContent).toBe(expected));
    expect(screen.getByLabelText("Response kind")).toHaveTextContent("json");
  });
});
