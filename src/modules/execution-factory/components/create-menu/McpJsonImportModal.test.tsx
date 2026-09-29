/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { McpJsonImportModal } from "@/modules/execution-factory/components/create-menu/McpJsonImportModal";

const translate = (key: string, options?: Record<string, string | number>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

const appServices = vi.hoisted(() => ({
  message: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServices,
}));

const { parseMcpSse, registerMcp } = vi.hoisted(() => ({
  parseMcpSse:
    vi.fn<
      (input: {
        mode?: string;
        url: string;
        headers?: Record<string, string>;
      }) => Promise<{ tools: Array<{ name: string; description?: string }> }>
    >(),
  registerMcp: vi.fn<(input: Record<string, unknown>) => Promise<string>>(),
}));

vi.mock("@/modules/execution-factory/services/mcp.service", () => ({
  parseMcpSse,
  registerMcp,
}));

const TWO_SERVERS = JSON.stringify({
  mcpServers: {
    alpha: {
      type: "streamable_http",
      url: "https://alpha.test/mcp",
      headers: { Authorization: "Bearer alpha-secret" },
    },
    beta: { type: "sse", url: "https://beta.test/sse" },
    local: { command: "npx", args: ["-y", "some-mcp"] },
  },
});

function renderModal() {
  const onClose = vi.fn();
  const onFill = vi.fn();
  render(<McpJsonImportModal category="data_process" onClose={onClose} onFill={onFill} open />);
  return { onClose, onFill };
}

function pasteAndParse(text: string) {
  fireEvent.change(screen.getByLabelText("mcpServers JSON"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "executionFactory.mcpJsonImport.parse" }));
}

function rowFor(url: string) {
  const row = screen.getByText(url).closest("tr");

  if (!row) {
    throw new Error(`no row for ${url}`);
  }

  return row;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("McpJsonImportModal", () => {
  it("previews each server with masked headers and blocks stdio entries", () => {
    renderModal();
    pasteAndParse(TWO_SERVERS);

    expect(screen.getByText("Authorization: ***")).toBeTruthy();
    expect(within(screen.getByRole("table")).queryByText(/alpha-secret/)).toBeNull();
    expect(
      screen.getByText("executionFactory.mcpJsonImport.entryErrors.stdio_unsupported {}"),
    ).toBeTruthy();
    // A stdio entry has no transport, so it must not look like a Stream server.
    const stdioRow = screen
      .getByText("executionFactory.mcpJsonImport.entryErrors.stdio_unsupported {}")
      .closest("tr");
    expect(stdioRow?.querySelectorAll("td")[2]?.textContent).toBe("-");

    const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    // header select-all, alpha, beta, local
    expect(checkboxes.slice(1).map((box) => [box.checked, box.disabled])).toEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
  });

  it("shows config-level errors", () => {
    renderModal();
    pasteAndParse('{"mcpServers": {}}');

    expect(screen.getByText("executionFactory.mcpJsonImport.configErrors.empty")).toBeTruthy();
  });

  it("registers selected servers one by one and reports failures without leaking headers", async () => {
    parseMcpSse.mockImplementation(({ url, mode }) =>
      url.startsWith("https://alpha")
        ? Promise.resolve({ tools: [{ name: "lookup", description: "Find" }] })
        : Promise.reject(new Error(`handshake failed (${mode})`)),
    );
    registerMcp.mockResolvedValue("mcp-alpha");

    const { onClose } = renderModal();
    pasteAndParse(TWO_SERVERS);
    fireEvent.click(
      screen.getByRole("button", {
        name: 'executionFactory.mcpJsonImport.registerSelected {"total":2}',
      }),
    );

    await waitFor(() => {
      expect(
        within(rowFor("https://beta.test/sse")).getByText("handshake failed (sse)"),
      ).toBeTruthy();
    });

    expect(registerMcp).toHaveBeenCalledTimes(1);
    expect(registerMcp).toHaveBeenCalledWith({
      name: "alpha",
      creationType: "custom",
      category: "data_process",
      mode: "stream",
      url: "https://alpha.test/mcp",
      headers: { Authorization: "Bearer alpha-secret" },
      toolConfigs: [{ toolName: "lookup", description: "Find" }],
    });
    expect(
      within(rowFor("https://alpha.test/mcp")).getByText(
        "executionFactory.mcpJsonImport.statuses.registered",
      ),
    ).toBeTruthy();
    expect(appServices.message.warning).toHaveBeenCalledWith(
      'executionFactory.mcpJsonImport.summary {"succeeded":1,"failed":1}',
    );

    // The registered server can no longer be selected, so a retry never duplicates it.
    const alphaBox = within(rowFor("https://alpha.test/mcp")).getByRole<HTMLInputElement>(
      "checkbox",
    );
    expect(alphaBox.disabled).toBe(true);

    fireEvent.click(within(rowFor("https://beta.test/sse")).getByRole("checkbox"));
    parseMcpSse.mockResolvedValue({ tools: [] });
    registerMcp.mockResolvedValue("mcp-beta");
    fireEvent.click(
      screen.getByRole("button", {
        name: 'executionFactory.mcpJsonImport.registerSelected {"total":1}',
      }),
    );

    await waitFor(() => {
      expect(registerMcp).toHaveBeenCalledTimes(2);
    });
    expect(registerMcp.mock.calls[1]?.[0]).toMatchObject({ name: "beta", mode: "sse" });

    fireEvent.click(
      await screen.findByRole("button", { name: "executionFactory.mcpJsonImport.done" }),
    );
    expect(onClose).toHaveBeenCalledWith(["mcp-alpha", "mcp-beta"]);
  }, 15_000);

  it("still reports servers registered before the config was parsed again", async () => {
    parseMcpSse.mockResolvedValue({ tools: [] });
    registerMcp.mockResolvedValue("mcp-alpha");

    const { onClose } = renderModal();
    pasteAndParse(
      JSON.stringify({ mcpServers: { alpha: { type: "sse", url: "https://alpha.test/sse" } } }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: 'executionFactory.mcpJsonImport.registerSelected {"total":1}',
      }),
    );
    await screen.findByText("executionFactory.mcpJsonImport.statuses.registered");

    pasteAndParse(
      JSON.stringify({
        mcpServers: { gamma: { type: "websocket", url: "https://gamma.test/ws" } },
      }),
    );
    // The unsupported transport must not be shown as the Stream fallback.
    expect(rowFor("https://gamma.test/ws").querySelectorAll("td")[2]?.textContent).toBe("-");

    fireEvent.click(screen.getByRole("button", { name: "executionFactory.mcpJsonImport.done" }));
    expect(onClose).toHaveBeenCalledWith(["mcp-alpha"]);
  }, 15_000);

  it("scrubs header values that the backend echoes back", async () => {
    parseMcpSse.mockRejectedValue(new Error("401: Bearer alpha-secret rejected"));

    renderModal();
    pasteAndParse(
      JSON.stringify({
        mcpServers: {
          alpha: {
            type: "sse",
            url: "https://alpha.test/mcp",
            headers: { Authorization: "Bearer alpha-secret" },
          },
        },
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: 'executionFactory.mcpJsonImport.registerSelected {"total":1}',
      }),
    );

    expect(await screen.findByText("401: *** rejected")).toBeTruthy();
    expect(registerMcp).not.toHaveBeenCalled();
  });

  it("blocks renamed rows that break the naming rule and fills the form with one server", () => {
    const { onFill } = renderModal();
    pasteAndParse(
      JSON.stringify({ mcpServers: { "Bazi-MCP": { type: "sse", url: "https://bazi.test/sse" } } }),
    );

    const name = screen.getByLabelText<HTMLInputElement>(
      "executionFactory.mcpJsonImport.columns.name",
    );
    expect(name.value).toBe("Bazi_MCP");

    fireEvent.change(name, { target: { value: "bad name" } });
    expect(
      screen.getByText('executionFactory.mcpJsonImport.entryErrors.name_invalid {"type":"sse"}'),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "executionFactory.mcpJsonImport.fillForm",
      }).disabled,
    ).toBe(true);

    // Fixing the name restores the selection made at parse time.
    fireEvent.change(name, { target: { value: "bazi" } });
    fireEvent.click(
      screen.getByRole("button", { name: "executionFactory.mcpJsonImport.fillForm" }),
    );

    expect(onFill).toHaveBeenCalledWith({
      name: "bazi",
      mode: "sse",
      url: "https://bazi.test/sse",
      headers: {},
    });
  });
});
