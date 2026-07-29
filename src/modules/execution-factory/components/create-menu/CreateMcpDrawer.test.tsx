/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";

const labels: Record<string, string> = {
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.description": "Description",
  "common.required": "Required",
  "common.success": "Saved",
  "executionFactory.category": "Category",
  "executionFactory.mcpCreationType": "Creation type",
  "executionFactory.mcpMode": "Mode",
  "executionFactory.mcpModes.sse": "SSE",
  "executionFactory.mcpModes.stream": "Stream",
  "executionFactory.mcpName": "MCP name",
  "executionFactory.mcpNameInvalid": "Only letters, digits and underscores",
  "executionFactory.mcpParseFallback": "Parsing with {{from}} failed, switched to {{to}}",
  "executionFactory.parseSse": "Parse tools",
  "executionFactory.parseSseSuccess": "Parsed {{count}} tools",
  "executionFactory.serviceUrl": "Service URL",
};

const translate = (key: string, options?: Record<string, string | number>) => {
  let text = labels[key] ?? key;

  if (options) {
    for (const [name, value] of Object.entries(options)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }

  return text;
};

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

vi.mock("react-i18next", () => ({
  initReactI18next: { init: vi.fn(), type: "3rdParty" },
  useTranslation: () => ({ t: translate }),
}));

const { messageError, messageInfo, messageSuccess, messageWarning } = vi.hoisted(() => ({
  messageError: vi.fn(),
  messageInfo: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
}));

// The drawer's load effect depends on the services object, so it has to keep a
// stable identity the way the real context does.
const appServices = {
  message: {
    error: messageError,
    info: messageInfo,
    success: messageSuccess,
    warning: messageWarning,
  },
};

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServices,
}));

vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: vi.fn(() =>
    Promise.resolve([{ categoryType: "other_category", name: "Other" }]),
  ),
}));

const { getMcpDetail, parseMcpSse, registerMcp, updateMcp } = vi.hoisted(() => ({
  getMcpDetail: vi.fn(),
  parseMcpSse: vi.fn<
    (input: { mode?: string; url: string }) => Promise<{ tools: Array<{ name: string }> }>
  >(),
  registerMcp: vi.fn(() => Promise.resolve("mcp-1")),
  updateMcp: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/modules/execution-factory/services/mcp.service", () => ({
  getMcpDetail,
  parseMcpSse,
  registerMcp,
  updateMcp,
}));

function renderDrawer() {
  return render(<CreateMcpDrawer embedded onClose={vi.fn()} open />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateMcpDrawer", () => {
  it("retries the other transport when parsing fails and syncs the mode field", async () => {
    parseMcpSse
      .mockRejectedValueOnce(new Error("mcp server is not accessible"))
      .mockResolvedValueOnce({ tools: [{ name: "hf_whoami" }] });

    renderDrawer();

    const url = await screen.findByPlaceholderText("https://example.com/mcp");
    fireEvent.change(url, { target: { value: "https://hf.co/mcp" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse tools" }));

    await waitFor(() => {
      expect(parseMcpSse).toHaveBeenCalledTimes(2);
    });

    expect(parseMcpSse.mock.calls[0]?.[0]).toMatchObject({ mode: "stream" });
    expect(parseMcpSse.mock.calls[1]?.[0]).toMatchObject({ mode: "sse" });
    expect(messageWarning).toHaveBeenCalledWith("Parsing with Stream failed, switched to SSE");
    expect(await screen.findByText("hf_whoami")).toBeTruthy();
    expect(screen.getByTitle("SSE")).toBeTruthy();
    // Two sequential parses behind antd's async form validation — the 5s default
    // is not enough when the whole module's suites run in parallel.
  }, 15_000);

  it("surfaces the original error when neither transport parses", async () => {
    parseMcpSse.mockRejectedValue(new Error("mcp server is not accessible"));

    renderDrawer();

    const url = await screen.findByPlaceholderText("https://example.com/mcp");
    fireEvent.change(url, { target: { value: "https://hf.co/mcp" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse tools" }));

    await waitFor(() => {
      expect(messageError).toHaveBeenCalledWith("mcp server is not accessible");
    });
    expect(messageWarning).not.toHaveBeenCalled();
  }, 10_000);

  it("blocks names the backend rejects before sending the request", async () => {
    renderDrawer();

    const name = await screen.findByLabelText("MCP name");
    fireEvent.change(name, { target: { value: "hf-mcp" } });
    fireEvent.change(screen.getByPlaceholderText("https://example.com/mcp"), {
      target: { value: "https://hf.co/mcp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Only letters, digits and underscores")).toBeTruthy();
    expect(registerMcp).not.toHaveBeenCalled();
  }, 10_000);
});
