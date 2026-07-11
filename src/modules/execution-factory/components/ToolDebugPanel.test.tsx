/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ToolDebugPanel } from "@/modules/execution-factory/components/ToolDebugPanel";
import { debugTool } from "@/modules/execution-factory/services/tool.service";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/framework/request/error-message", () => ({
  extractRequestErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  debugTool: vi.fn(),
}));

describe("ToolDebugPanel", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("runs debug inline and reports the result without opening a modal", async () => {
    vi.mocked(debugTool).mockResolvedValue({
      statusCode: 200,
      durationMs: 12,
      body: { ok: true },
    });
    const onRunComplete = vi.fn();

    render(
      <ToolDebugPanel
        boxId="box-1"
        onRunComplete={onRunComplete}
        record={{ toolId: "tool-1", name: "Search", status: "enabled" }}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "executionFactory.runDebug" }));

    await waitFor(() => {
      expect(debugTool).toHaveBeenCalledWith("box-1", "tool-1", {});
    });
    expect(await screen.findByTestId("tool-debug-inline-result")).toBeTruthy();
    expect(onRunComplete).toHaveBeenCalledTimes(1);
  });
});
