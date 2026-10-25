/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootServicePicker } from "./RootServicePicker";
import { listRootServices } from "./trace-analysis.service";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./trace-analysis.service", () => ({ listRootServices: vi.fn() }));
const key = (name: string) => `bknTrace.traceWorkspace.serviceOptions.${name}`;
const open = () => fireEvent.click(screen.getByRole("button", { name: key("open") }));

describe("explicit root service candidates", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.mocked(listRootServices).mockReset();
  });
  it("retains server substring candidates and reports more results", async () => {
    vi.mocked(listRootServices).mockResolvedValue({ entries: ["CanonicalService"], hasMore: true });
    render(<RootServicePicker value="SERVICE" query={{ tool: "sql" }} />);
    expect(listRootServices).not.toHaveBeenCalled();
    open();
    expect(await screen.findByTitle("CanonicalService")).toBeInTheDocument();
    expect(screen.getByText(key("more"))).toBeInTheDocument();
    expect(listRootServices).toHaveBeenCalledWith(
      { tool: "sql", q: "SERVICE" },
      expect.any(AbortSignal),
    );
  });
  it.each([
    ["", "empty"],
    ["fragment", "noMatches"],
  ])("reports no candidates for %s", async (value, feedback) => {
    vi.mocked(listRootServices).mockResolvedValue({ entries: [], hasMore: false });
    render(<RootServicePicker value={value} query={{}} />);
    open();
    expect(await screen.findByText(key(feedback))).toBeInTheDocument();
  });
  it("retains exact manual entry after an unavailable or older backend", async () => {
    vi.mocked(listRootServices).mockRejectedValue(new Error("404"));
    const onChange = vi.fn();
    render(<RootServicePicker onChange={onChange} query={{}} />);
    open();
    await screen.findByText(key("failed"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "MyService" } });
    expect(onChange).toHaveBeenLastCalledWith("MyService");
  });
  it("aborts and ignores stale results on draft changes, close and unmount", async () => {
    let resolve: (result: { entries: string[]; hasMore: boolean }) => void = () => undefined;
    vi.mocked(listRootServices).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<RootServicePicker query={{ tool: "old" }} />);
    open();
    expect(screen.getByRole("button", { name: key("open") })).toBeDisabled();
    const signal = vi.mocked(listRootServices).mock.calls[0]?.[1];
    view.rerender(<RootServicePicker query={{ tool: "new" }} />);
    expect(signal?.aborted).toBe(true);
    await act(() => {
      resolve({ entries: ["Stale"], hasMore: false });
      return Promise.resolve();
    });
    expect(screen.queryByTitle("Stale")).toBeNull();
    open();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(vi.mocked(listRootServices).mock.calls[1]?.[1]?.aborted).toBe(true);
    open();
    view.unmount();
    expect(vi.mocked(listRootServices).mock.calls[2]?.[1]?.aborted).toBe(true);
  });
  it.each(["empty", "failed"])(
    "retries %s candidates with one click and reports actual popup state",
    async (state) => {
      const mock = vi.mocked(listRootServices);
      if (state === "failed") mock.mockRejectedValueOnce(new Error("unavailable"));
      else mock.mockResolvedValueOnce({ entries: [], hasMore: false });
      mock.mockResolvedValueOnce({ entries: ["CanonicalService"], hasMore: false });
      render(<RootServicePicker query={{}} />);
      open();
      await screen.findByText(key(state));
      expect(screen.getByRole("button", { name: key("open") })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      open();
      expect(await screen.findByTitle("CanonicalService")).toBeInTheDocument();
      expect(mock).toHaveBeenCalledTimes(2);
    },
  );

  it("does not replace manual text with the first candidate on Enter", async () => {
    vi.mocked(listRootServices).mockResolvedValue({
      entries: ["CanonicalService"],
      hasMore: false,
    });
    const onChange = vi.fn();
    render(<RootServicePicker value="can" onChange={onChange} query={{}} />);
    open();
    await screen.findByTitle("CanonicalService");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter", keyCode: 13, which: 13 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveValue("can");
  });

  it("searches only while expanded", async () => {
    vi.mocked(listRootServices).mockResolvedValue({ entries: [], hasMore: false });
    render(<RootServicePicker query={{}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "before" } });
    expect(listRootServices).not.toHaveBeenCalled();
    open();
    await screen.findByText(key("empty"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "after" } });
    await waitFor(() =>
      expect(listRootServices).toHaveBeenLastCalledWith({ q: "after" }, expect.any(AbortSignal)),
    );
  });
});
