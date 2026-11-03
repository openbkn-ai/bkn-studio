/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/app/locales/i18n";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import type { KnowledgeRefreshStatus } from "../../services/kb-refresh.service";
const mocks = vi.hoisted(() => ({
  mode: "enabled",
  read: vi.fn(),
  command: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    modal: { confirm: mocks.confirm },
    message: { success: mocks.success, error: mocks.error },
  }),
}));
vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: ({ children }: { children: ReactNode }) => children,
  BknProjectKbSlot: ({ children, preview }: { children: ReactNode; preview: ReactNode }) =>
    mocks.mode === "enabled" ? children : mocks.mode === "locked" ? preview : null,
}));
vi.mock("../../services/kb-refresh.service", () => ({
  getKnowledgeRefresh: mocks.read,
  commandKnowledgeRefresh: mocks.command,
}));
import i18n from "@/app/locales/i18n";
import { KnowledgeRefreshSection } from "./KnowledgeRefreshSection";
const status: KnowledgeRefreshStatus = {
  available: true,
  networkId: "network",
  state: "attention",
  reason: "batch_review_required",
  revision: 7,
  canManage: true,
  canRelease: true,
  canDiscard: true,
  files: 5,
  changed: 2,
  removed: 1,
  reused: 3,
  completed: 0,
  pendingLinks: 0,
  pendingFields: 0,
  pendingFacts: 0,
  estimatedMillis: null,
  reviewReasons: ["duration_unknown"],
  updateTime: 0,
  limits: { changedPercent: 20, removedPercent: 10, durationMillis: 600000 },
};
describe("knowledge refresh management", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.mode = "enabled";
    await i18n.changeLanguage("en-US");
    mocks.read.mockResolvedValue(status);
    mocks.command.mockResolvedValue(status);
  });
  it.each(["hidden", "locked"])("does not read or command in %s mode", (mode) => {
    mocks.mode = mode;
    renderWithoutAntdStyles(<KnowledgeRefreshSection lineageId="lineage" />);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("requires an explicit confirmation before releasing or discarding a batch", async () => {
    renderWithoutAntdStyles(<KnowledgeRefreshSection lineageId="lineage" />);
    await screen.findByText("Release this batch");
    expect(screen.getByText("Estimated extraction time is not yet available.")).toBeInTheDocument();
    for (const [label, action] of [
      ["Release this batch", "release"],
      ["Discard this batch", "discard"],
    ]) {
      fireEvent.click(screen.getByText(label));
      const dialog = mocks.confirm.mock.lastCall?.[0] as { onOk: () => Promise<void> };
      const before = mocks.command.mock.calls.length;
      expect(before).toBe(action === "release" ? 0 : 1);
      await dialog.onOk();
      expect(mocks.command).toHaveBeenLastCalledWith("lineage", action, status);
    }
  });
  it("hides commands when the server grants read access only", async () => {
    mocks.read.mockResolvedValue({
      ...status,
      canManage: false,
      canRelease: false,
      canDiscard: false,
    });
    renderWithoutAntdStyles(<KnowledgeRefreshSection lineageId="lineage" />);
    await screen.findByText("Owner review needed");
    expect(screen.queryByRole("button", { name: "Check for changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release this batch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard this batch" })).not.toBeInTheDocument();
  });
  it("ignores a late status response from the previous lineage", async () => {
    let finish: (value: KnowledgeRefreshStatus) => void = () => {};
    mocks.read.mockImplementationOnce(
      () =>
        new Promise<KnowledgeRefreshStatus>((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderWithoutAntdStyles(<KnowledgeRefreshSection lineageId="old" />);
    mocks.read.mockResolvedValue({
      ...status,
      state: "idle",
      reason: "",
      canManage: false,
      canRelease: false,
      canDiscard: false,
    });
    view.rerender(<KnowledgeRefreshSection lineageId="new" />);
    await screen.findByText("Up to date");
    finish(status);
    await waitFor(() => expect(screen.queryByText("Owner review needed")).not.toBeInTheDocument());
  });
});
