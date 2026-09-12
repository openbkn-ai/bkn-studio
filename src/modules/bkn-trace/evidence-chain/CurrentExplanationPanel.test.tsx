/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import "@/app/locales/i18n";
const read = vi.hoisted(() => vi.fn()); const generate = vi.hoisted(() => vi.fn());
vi.mock("./current-explanation.service", () => ({ readCurrentExplanation: read, generateCurrentExplanation: generate }));
import { CurrentExplanationPanel } from "./CurrentExplanationPanel";
beforeEach(() => { read.mockReset(); generate.mockReset(); });
it("only generates after the user requests evidence", async () => {
  read.mockResolvedValue({ status: "not_generated" }); generate.mockResolvedValue({ status: "not_generated" });
  render(<CurrentExplanationPanel interactionId="i" />);
  await waitFor(() => expect(read).toHaveBeenCalledWith("i"));
  await waitFor(() => expect(screen.getByRole("button").className).not.toContain("ant-btn-loading"));
  expect(generate).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(generate).toHaveBeenCalledWith("i"));
});
it("discards a late response from the previous interaction", async () => {
  let resolve: (value: unknown) => void = () => {};
  read.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ status: "not_generated" });
  const view = render(<CurrentExplanationPanel interactionId="a" />); view.rerender(<CurrentExplanationPanel interactionId="b" />);
  await waitFor(() => expect(read).toHaveBeenCalledWith("b"));
  await act(async () => { resolve({ status: "ready", generatedAt: "stale-time" }); await Promise.resolve(); });
  expect(screen.queryByText(/stale-time/)).toBeNull();
});

it("retries a failed read without generating a result", async () => {
  read.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "not_generated" });
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
  await waitFor(() => expect(screen.getByRole("button").className).not.toContain("ant-btn-loading"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText(/依据生成时间/)).toBeTruthy();
});
