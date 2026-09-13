/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";

const mocks = vi.hoisted(() => ({
  getToolbox: vi.fn(),
  listToolboxes: vi.fn(),
  listMcps: vi.fn(),
  listMcpTools: vi.fn(),
}));

// Interpolated values are appended so a test can see which item a label was rendered for.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}(${Object.values(options).join("|")})` : key,
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox: mocks.getToolbox,
  listToolboxes: mocks.listToolboxes,
}));

vi.mock("@/modules/execution-factory/services/mcp.service", () => ({
  listMcps: mocks.listMcps,
  listMcpTools: mocks.listMcpTools,
}));

vi.mock("@/modules/execution-factory/services/skill.service", () => ({
  listSkills: vi.fn(),
}));

import { CapabilityMountModal } from "./CapabilityMountModal";

function toolbox(overrides: Partial<ToolboxRecord>): ToolboxRecord {
  return {
    boxId: "box-1",
    metadataType: "function",
    name: "dataset_function",
    status: "published",
    toolCount: 1,
    ...overrides,
  };
}

function listing(items: ToolboxRecord[]) {
  return { items, page: 1, pageSize: 100, total: items.length };
}

function rejection(code: string) {
  return {
    isAxiosError: true,
    response: {
      data: { description: `description of ${code}`, error_code: code },
      status: 400,
    },
  };
}

function renderPicker(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <CapabilityMountModal
      capabilityType="function"
      mountedRefs={new Set()}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
      open
      toolKind="function"
    />,
  );

  return onSubmit;
}

function treeNode(title: string) {
  const node = screen.getByText(title).closest(".ant-tree-treenode");
  if (!(node instanceof HTMLElement)) {
    throw new Error(`no tree node titled ${title}`);
  }

  return node;
}

function checkbox(title: string) {
  const box = treeNode(title).querySelector(".ant-tree-checkbox");
  if (!(box instanceof HTMLElement)) {
    throw new Error(`no checkbox on ${title}`);
  }

  return box;
}

function expand(title: string) {
  const switcher = treeNode(title).querySelector(".ant-tree-switcher");
  if (!(switcher instanceof HTMLElement)) {
    throw new Error(`no switcher on ${title}`);
  }

  fireEvent.click(switcher);
}

// While a ticked toolset is being read the button carries a spinner, whose label joins its name.
function confirmButton() {
  return screen.getByRole("button", { name: /knowledgeNetwork\.capabilityPickerConfirm$/ });
}

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CapabilityMountModal availability", () => {
  it("refuses an unpublished toolset up front and says why, without reading its tools", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({ status: "unpublish" })]));

    renderPicker();

    await screen.findByText("dataset_function");
    expect(checkbox("dataset_function").className).toContain("ant-tree-checkbox-disabled");
    expect(
      within(treeNode("dataset_function")).getByText(
        "knowledgeNetwork.capabilityPickerReasonBoxUnpublished",
      ),
    ).toBeTruthy();
    expect(mocks.getToolbox).not.toHaveBeenCalled();
  });

  it("shows a disabled tool as unpickable, and its toolset as holding nothing to mount", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({})]));
    mocks.getToolbox.mockResolvedValue(
      toolbox({ tools: [{ name: "get_birthday", status: "disabled", toolId: "get_birthday" }] }),
    );

    renderPicker();

    await screen.findByText("dataset_function");
    expand("dataset_function");
    await screen.findByText("get_birthday");

    expect(treeNode("get_birthday").className).toContain("ant-tree-treenode-disabled");
    expect(
      within(treeNode("get_birthday")).getByText(
        "knowledgeNetwork.capabilityPickerReasonToolDisabled",
      ),
    ).toBeTruthy();
    expect(checkbox("dataset_function").className).toContain("ant-tree-checkbox-disabled");
    expect(
      within(treeNode("dataset_function")).getByText(
        "knowledgeNetwork.capabilityPickerReasonNoEnabledTools",
      ),
    ).toBeTruthy();
    // Total and enabled are both shown, so "1 tool" no longer reads as "1 tool to mount".
    expect(
      within(treeNode("dataset_function")).getByText(
        "knowledgeNetwork.capabilityPickerBoxToolCountEnabled(1|0)",
      ),
    ).toBeTruthy();

    // Clicking the label is the other way a row gets ticked; it must be refused too.
    fireEvent.click(screen.getByText("get_birthday"));
    expect(confirmButton()).toHaveProperty("disabled", true);
  });

  it("unticks a toolset ticked before its tools arrived when none can be mounted, and names it", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({})]));
    mocks.getToolbox.mockResolvedValue(
      toolbox({ tools: [{ name: "get_birthday", status: "disabled", toolId: "get_birthday" }] }),
    );
    const onSubmit = renderPicker();

    await screen.findByText("dataset_function");
    fireEvent.click(checkbox("dataset_function"));

    await screen.findByText("knowledgeNetwork.capabilityPickerDeselected");
    expect(
      screen.getByText(
        "knowledgeNetwork.capabilityPickerDeselectedItem(dataset_function|knowledgeNetwork.capabilityPickerReasonNoEnabledTools)",
      ),
    ).toBeTruthy();
    expect(checkbox("dataset_function").className).not.toContain("ant-tree-checkbox-checked");
    expect(confirmButton()).toHaveProperty("disabled", true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("holds submit until a ticked toolset's tools are read, then sends the whole box", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({ toolCount: 2 })]));
    let resolveBox: (value: ToolboxRecord) => void = () => undefined;
    mocks.getToolbox.mockReturnValue(
      new Promise<ToolboxRecord>((resolve) => {
        resolveBox = resolve;
      }),
    );
    const onSubmit = renderPicker();

    await screen.findByText("dataset_function");
    fireEvent.click(checkbox("dataset_function"));
    expect(confirmButton()).toHaveProperty("disabled", true);
    // Expanding while that read is in flight joins it instead of starting another.
    expand("dataset_function");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(mocks.getToolbox).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      resolveBox(
        toolbox({
          toolCount: 2,
          tools: [
            { name: "get_birthday", status: "disabled", toolId: "get_birthday" },
            { name: "get_age", status: "enabled", toolId: "get_age" },
          ],
        }),
      );
    });

    await waitFor(() => expect(confirmButton()).toHaveProperty("disabled", false));
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      { allTools: true, boxId: "box-1", capabilityType: "function" },
    ]);
  });

  it("re-reads what was picked after a state rejection and names what changed", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({ toolCount: 2 })]));
    mocks.getToolbox
      .mockResolvedValueOnce(
        toolbox({
          toolCount: 2,
          tools: [
            { name: "get_birthday", status: "enabled", toolId: "get_birthday" },
            { name: "get_age", status: "enabled", toolId: "get_age" },
          ],
        }),
      )
      // By the time the mount is written, someone has disabled the picked tool.
      .mockResolvedValueOnce(
        toolbox({
          toolCount: 2,
          tools: [
            { name: "get_birthday", status: "disabled", toolId: "get_birthday" },
            { name: "get_age", status: "enabled", toolId: "get_age" },
          ],
        }),
      );
    const onSubmit = renderPicker(
      vi.fn().mockRejectedValue(rejection("BknBackend.CapabilityBinding.TargetNotAvailable")),
    );

    await screen.findByText("dataset_function");
    expand("dataset_function");
    await screen.findByText("get_birthday");
    fireEvent.click(checkbox("get_birthday"));
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      { boxId: "box-1", capabilityId: "get_birthday", capabilityType: "function" },
    ]);

    await screen.findByText(
      "knowledgeNetwork.capabilityPickerDeselectedItem(dataset_function / get_birthday|knowledgeNetwork.capabilityPickerReasonToolDisabled)",
    );
    expect(
      screen.getByText("description of BknBackend.CapabilityBinding.TargetNotAvailable"),
    ).toBeTruthy();
    expect(mocks.getToolbox).toHaveBeenCalledTimes(2);
    expect(treeNode("get_birthday").className).toContain("ant-tree-treenode-disabled");
  });

  it("select-all skips unpublished toolsets and drops ones whose read finds nothing", async () => {
    mocks.listToolboxes.mockResolvedValue(
      listing([
        toolbox({}),
        toolbox({ boxId: "box-2", name: "draft_box", status: "unpublish" }),
        toolbox({ boxId: "box-3", name: "empty_box", toolCount: 0 }),
      ]),
    );
    mocks.getToolbox.mockImplementation((boxId: string) =>
      Promise.resolve(
        boxId === "box-3"
          ? toolbox({ boxId, name: "empty_box", toolCount: 0, tools: [] })
          : toolbox({ tools: [{ name: "get_age", status: "enabled", toolId: "get_age" }] }),
      ),
    );
    const onSubmit = renderPicker();

    await screen.findByText("dataset_function");
    fireEvent.click(screen.getByText("knowledgeNetwork.capabilityPickerSelectAll"));

    await screen.findByText(
      "knowledgeNetwork.capabilityPickerDeselectedItem(empty_box|knowledgeNetwork.capabilityPickerReasonNoTools)",
    );
    await waitFor(() => expect(confirmButton()).toHaveProperty("disabled", false));
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      { allTools: true, boxId: "box-1", capabilityType: "function" },
    ]);
    // The unpublished toolset is refused on its status alone, without a read.
    expect(mocks.getToolbox.mock.calls.map(([boxId]) => boxId as string).sort()).toEqual([
      "box-1",
      "box-3",
    ]);
  });

  it("keeps a toolset whose read failed tickable, and reads it again when ticked or expanded", async () => {
    mocks.listToolboxes.mockResolvedValue(listing([toolbox({})]));
    const loaded = toolbox({ tools: [{ name: "get_age", status: "enabled", toolId: "get_age" }] });
    mocks.getToolbox
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockResolvedValueOnce(loaded);
    const onSubmit = renderPicker();

    await screen.findByText("dataset_function");

    // A failed tick: unticked with the reason, the row tagged, but its checkbox left usable.
    fireEvent.click(checkbox("dataset_function"));
    await screen.findByText(
      "knowledgeNetwork.capabilityPickerDeselectedItem(dataset_function|knowledgeNetwork.capabilityPickerReasonLoadFailed)",
    );
    expect(
      within(treeNode("dataset_function")).getByText(
        "knowledgeNetwork.capabilityPickerReasonLoadFailed",
      ),
    ).toBeTruthy();
    expect(checkbox("dataset_function").className).not.toContain("ant-tree-checkbox-disabled");
    expect(screen.getByText("gateway timeout")).toBeTruthy();

    // A failed expand: the node folds back up rather than sitting open and unloaded.
    expand("dataset_function");
    await waitFor(() => expect(mocks.getToolbox).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(treeNode("dataset_function").className).not.toContain("ant-tree-treenode-switcher-open"),
    );

    // Expanding again reads again, and this time it lands. The tree ignores expand clicks while its
    // fold animation runs (antd caps it at 500ms), as it would for a person clicking that fast.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expand("dataset_function");
    await screen.findByText("get_age");
    expect(mocks.getToolbox).toHaveBeenCalledTimes(3);
    expect(
      within(treeNode("dataset_function")).queryByText(
        "knowledgeNetwork.capabilityPickerReasonLoadFailed",
      ),
    ).toBeNull();
    // The error the failed read raised is retracted with it; nothing on screen still says it failed.
    expect(screen.queryByText("gateway timeout")).toBeNull();

    fireEvent.click(checkbox("dataset_function"));
    await waitFor(() => expect(confirmButton()).toHaveProperty("disabled", false));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      { allTools: true, boxId: "box-1", capabilityType: "function" },
    ]);
  });
});

describe("CapabilityMountModal MCP counts", () => {
  it("shows no tool count for a Server whose tools have not been read, rather than zero", async () => {
    mocks.listMcps.mockResolvedValue({
      items: [{ mcpId: "mcp-1", name: "Search Server" }],
      total: 1,
    });

    render(
      <CapabilityMountModal
        capabilityType="mcp_tool"
        mountedRefs={new Set()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        open
      />,
    );

    await screen.findByText("Search Server");
    expect(within(treeNode("Search Server")).queryByText(/capabilityPickerBoxToolCount/)).toBeNull();
  });
});
