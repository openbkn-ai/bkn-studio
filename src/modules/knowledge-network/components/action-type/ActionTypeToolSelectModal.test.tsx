/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionTypeCatalogSelection } from "@/modules/knowledge-network/services/action-type-tool.service";
import type { ActionTypeActionSource } from "@/modules/knowledge-network/types/knowledge-network";

const {
  listActionTypeExecutionFactoryCatalog,
  loadActionTypeMcpServerTools,
  loadActionTypeToolBoxTools,
} = vi.hoisted(() => ({
  listActionTypeExecutionFactoryCatalog: vi.fn(),
  loadActionTypeMcpServerTools: vi.fn(),
  loadActionTypeToolBoxTools: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  buildActionSourceFromCatalogSelection: (
    selection: ActionTypeCatalogSelection,
  ): ActionTypeActionSource => {
    if (selection.kind === "mcp") {
      return {
        mcpId: selection.mcpId,
        mcpName: selection.mcpName,
        toolId: selection.tool.toolId,
        toolName: selection.tool.toolName,
        type: "mcp",
      };
    }

    return {
      boxId: selection.boxId,
      boxName: selection.boxName,
      toolId: selection.tool.toolId,
      toolName: selection.tool.toolName,
      type: "tool",
    };
  },
  listActionTypeExecutionFactoryCatalog,
  loadActionTypeMcpServerTools,
  loadActionTypeToolBoxTools,
}));

import { ActionTypeToolSelectModal } from "./ActionTypeToolSelectModal";

const emptyCatalog = {
  mcpServers: [] as Array<{
    description?: string;
    mcpId: string;
    mcpName: string;
    tools: Array<{ toolId: string; toolName: string; parameters: unknown[] }>;
  }>,
  toolBoxes: [
    {
      boxId: "box-1",
      boxName: "Demo Box",
      description: "demo",
      tools: [] as Array<{ toolId: string; toolName: string; parameters: unknown[] }>,
    },
  ],
};

function createSource(overrides: Partial<ActionTypeActionSource> = {}): ActionTypeActionSource {
  return {
    boxId: "box-1",
    boxName: "Demo Box",
    toolId: "tool-1",
    toolName: "Demo Tool",
    type: "tool",
    ...overrides,
  };
}

beforeEach(() => {
  listActionTypeExecutionFactoryCatalog.mockReset();
  loadActionTypeMcpServerTools.mockReset();
  loadActionTypeToolBoxTools.mockReset();
  listActionTypeExecutionFactoryCatalog.mockResolvedValue(emptyCatalog);
  loadActionTypeToolBoxTools.mockResolvedValue([
    { parameters: [], toolId: "tool-1", toolName: "Demo Tool" },
  ]);
  loadActionTypeMcpServerTools.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ActionTypeToolSelectModal catalog loading", () => {
  it("loads the catalog once when opened with default allowedKinds", async () => {
    render(
      <ActionTypeToolSelectModal
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />,
    );

    await waitFor(() => {
      expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
    });
    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledWith("");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Demo Box")).toBeTruthy();
  });

  it("does not reload when value object identity changes but source key stays the same", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ActionTypeToolSelectModal
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        value={createSource()}
      />,
    );

    await waitFor(() => {
      expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ActionTypeToolSelectModal
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        value={createSource()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
  });

  it("reloads when the selected source identity actually changes", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ActionTypeToolSelectModal
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        value={createSource({ toolId: "tool-1" })}
      />,
    );

    await waitFor(() => {
      expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ActionTypeToolSelectModal
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        value={createSource({ toolId: "tool-2", toolName: "Other Tool" })}
      />,
    );

    await waitFor(() => {
      expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(2);
    });
  });

  it("debounces keyword search before reloading the catalog", async () => {
    vi.useFakeTimers();

    render(
      <ActionTypeToolSelectModal
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText(
      "knowledgeNetwork.actionTypeToolSearchPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "demo" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(2);
    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenLastCalledWith("demo");
  });

  it("does not keep requesting after the modal is closed", async () => {
    const { rerender } = render(
      <ActionTypeToolSelectModal
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />,
    );

    await waitFor(() => {
      expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ActionTypeToolSelectModal
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listActionTypeExecutionFactoryCatalog).toHaveBeenCalledTimes(1);
  });
});
