/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportResourceModal } from "@/modules/execution-factory/components/create-menu/ImportResourceModal";

const translate = (key: string) => {
  const labels: Record<string, string> = {
    "executionFactory.importConfirm": "Import",
    "executionFactory.importResourceTitle.toolbox": "Import toolbox",
    "executionFactory.importResourceTitle.mcp": "Import MCP",
  };

  return labels[key] ?? key;
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

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: translate,
  }),
}));

const { messageInfo } = vi.hoisted(() => ({
  messageInfo: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: vi.fn(),
      info: messageInfo,
      success: vi.fn(),
      warning: vi.fn(),
    },
  }),
}));

const { importComponentFile } = vi.hoisted(() => ({
  importComponentFile: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/impex.service", () => ({
  importComponentFile,
}));

vi.mock("@/modules/execution-factory/components/CapabilityBusinessIntro", () => ({
  CapabilityBusinessIntro: () => null,
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");

  return {
    ...actual,
    Modal: ({
      children,
      okText,
      onOk,
      open,
      title,
    }: {
      children?: React.ReactNode;
      okText?: React.ReactNode;
      onOk?: () => void;
      open?: boolean;
      title?: React.ReactNode;
    }) =>
      open ? (
        <div>
          <h1>{title}</h1>
          {children}
          <button onClick={onOk} type="button">
            {okText}
          </button>
        </div>
      ) : null,
  };
});

describe("ImportResourceModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // OpenAPI import lives in the Add API wizard; this modal only restores .adp backups.
  it.each([
    ["toolbox", "Import toolbox"],
    ["mcp", "Import MCP"],
  ] as const)("offers only .adp import for %s", async (activeTab, title) => {
    render(<ImportResourceModal activeTab={activeTab} onClose={vi.fn()} open />);

    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    // A single import kind needs no tab bar.
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("asks for a file instead of importing when none is selected", async () => {
    render(<ImportResourceModal activeTab="toolbox" onClose={vi.fn()} open />);

    fireEvent.click(await screen.findByRole("button", { name: "Import" }));

    await vi.waitFor(() => {
      expect(messageInfo).toHaveBeenCalledWith("executionFactory.importAdpFileRequired");
    });
    expect(importComponentFile).not.toHaveBeenCalled();
  });

  it("renders nothing for resource types without .adp import", () => {
    render(<ImportResourceModal activeTab="skill" onClose={vi.fn()} open />);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
