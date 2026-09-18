/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import "@/app/locales/i18n";
const read = vi.hoisted(() => vi.fn());
const generate = vi.hoisted(() => vi.fn());
vi.mock("./current-explanation.service", () => ({
  readCurrentExplanation: read,
  generateCurrentExplanation: generate,
}));
import { CurrentExplanationPanel } from "./CurrentExplanationPanel";
beforeEach(() => {
  read.mockReset();
  generate.mockReset();
});
it("only generates after the user requests evidence", async () => {
  read.mockResolvedValue({ status: "not_generated" });
  generate.mockResolvedValue({ status: "not_generated" });
  render(<CurrentExplanationPanel interactionId="i" />);
  await waitFor(() => expect(read).toHaveBeenCalledWith("i"));
  await screen.findByText(/尚未生成解释/);
  expect(generate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(generate).toHaveBeenCalledWith("i"));
});
it("discards a late response from the previous interaction", async () => {
  let resolve: (value: unknown) => void = () => {};
  read
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({ status: "not_generated" });
  const view = render(<CurrentExplanationPanel interactionId="a" />);
  view.rerender(<CurrentExplanationPanel interactionId="b" />);
  await waitFor(() => expect(read).toHaveBeenCalledWith("b"));
  await act(async () => {
    resolve({ status: "ready", generatedAt: "stale-time" });
    await Promise.resolve();
  });
  expect(screen.queryByText(/stale-time/)).toBeNull();
});

it("retries a failed read without generating a result", async () => {
  read
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ status: "not_generated" });
  render(<CurrentExplanationPanel interactionId="i" />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(generate).not.toHaveBeenCalled();
});
it("keeps the saved result visible when refresh fails", async () => {
  read.mockResolvedValue({ status: "ready", generatedAt: "2026-09-10T01:00:00Z" });
  generate.mockRejectedValue(new Error("offline"));
  render(<CurrentExplanationPanel interactionId="i" />);
  await waitFor(() => expect(screen.getByText(/依据生成时间/)).toBeTruthy());
  await waitFor(() =>
    expect(screen.getByRole("button").className).not.toContain("ant-btn-loading"),
  );
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText(/依据生成时间/)).toBeTruthy();
});

it("keeps the requested conclusion selected when execution links return to evidence", async () => {
  read.mockResolvedValue({
    status: "ready",
    generatedAt: "2026-09-10T01:00:00Z",
    view: {
      interactionId: "i",
      revisionLabel: "v1",
      status: "completed",
      question: "库存是多少？",
      answer: "当前库存 2 个，生产可用库存 0 个。",
      claims: [
        {
          id: "all",
          label: "当前库存为 2 个",
          value: "2",
          role: "primary",
          status: "located",
          nodeIds: ["source"],
        },
        {
          id: "production",
          label: "生产可用库存为 0 个",
          value: "0",
          role: "primary",
          status: "located",
          nodeIds: ["source"],
        },
      ],
      evidence: {
        nodes: [{ id: "source", label: "库存查询", kind: "source", executionNodeId: "query" }],
        edges: [],
      },
      execution: {
        nodes: [
          { id: "input", label: "查询条件", value: "全仓", kind: "object", role: "input" },
          { id: "query", label: "查询库存", kind: "query", role: "process", status: "completed" },
          { id: "output", label: "当前库存为 2 个", value: "2", kind: "field", role: "output" },
        ],
        edges: [
          { id: "in", source: "input", target: "query", label: "输入", kind: "execution" },
          { id: "out", source: "query", target: "output", label: "返回", kind: "execution" },
        ],
      },
    },
  });
  function Harness() {
    const [panel, setPanel] = useState<"evidence" | "execution">("execution");
    return <CurrentExplanationPanel interactionId="i" panel={panel} onPanelChange={setPanel} />;
  }
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "查看结论：生产可用库存为 0 个 →" })).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole("button", { name: "查看结论：生产可用库存为 0 个 →" }));
  expect(screen.getByRole("region", { name: "生产可用库存为 0 个的解释路径" })).toBeTruthy();
});
