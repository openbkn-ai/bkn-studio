/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SpanBrowser } from "./SpanBrowser";
import { listTechnicalSpans } from "./trace-analysis.service";
import type { TechnicalSpanPage } from "./trace-analysis.types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./trace-analysis.service", () => ({ listTechnicalSpans: vi.fn() }));
const page = (name: string, more = false): TechnicalSpanPage => ({
  traceId: "trace",
  hasMore: more,
  nextCursor: more ? "cursor-next" : undefined,
  sort: "span_id_asc",
  consistency: "live",
  entries: name
    ? [
        {
          spanId: name,
          name,
          kind: "client",
          startNano: 1000000,
          endNano: 2000000,
          durationNano: 1000000,
          status: "ok",
        },
      ]
    : [],
});

describe("bounded live Span browser", { timeout: 30_000 }, () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  beforeEach(() => {
    vi.mocked(listTechnicalSpans).mockReset();
  });

  it("replaces pages, can return from an empty terminal page, and refreshes without a cursor", async () => {
    vi.mocked(listTechnicalSpans)
      .mockResolvedValueOnce(page("page-one", true))
      .mockResolvedValueOnce(page(""))
      .mockResolvedValueOnce(page("page-one", true))
      .mockResolvedValueOnce(page("refreshed"));
    render(<SpanBrowser traceId="trace" onClose={vi.fn()} />);
    await screen.findAllByText("page-one");
    expect(listTechnicalSpans).toHaveBeenNthCalledWith(
      1,
      "trace",
      undefined,
      expect.any(AbortSignal),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.traceWorkspace.spanBrowser.next" }),
    );
    await screen.findByText("bknTrace.traceWorkspace.spanBrowser.empty");
    expect(screen.queryByText("page-one")).toBeNull();
    expect(listTechnicalSpans).toHaveBeenNthCalledWith(
      2,
      "trace",
      "cursor-next",
      expect.any(AbortSignal),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.traceWorkspace.spanBrowser.previous" }),
    );
    await screen.findAllByText("page-one");
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
    await screen.findAllByText("refreshed");
    expect(screen.queryByText("page-one")).toBeNull();
    expect(listTechnicalSpans).toHaveBeenLastCalledWith(
      "trace",
      undefined,
      expect.any(AbortSignal),
    );
  });

  it.each([
    [403, "TRACE_SPAN_SCOPE_REQUIRED", "denied"],
    [422, "TRACE_SPAN_FORMAT_UNSUPPORTED", "unsupported"],
    [422, "TRACE_SPAN_STORAGE_UNSUPPORTED", "unsupported"],
    [400, "INVALID_ARGUMENT", "cursor"],
    [413, "TRACE_SPAN_BUDGET_EXCEEDED", "budget"],
    [503, "QUERY_FAILED", "failed"],
    [504, "QUERY_FAILED", "failed"],
  ])(
    "discloses %s errors without dropping an already loaded page",
    async (status, code, reason) => {
      vi.mocked(listTechnicalSpans)
        .mockResolvedValueOnce(page("retained", true))
        .mockRejectedValueOnce(
          new AxiosError("private failure", undefined, undefined, undefined, {
            status: Number(status),
            data: { error_code: code },
            headers: {},
            config: { headers: new AxiosHeaders() },
            statusText: "failure",
          }),
        );
      render(<SpanBrowser traceId="trace" onClose={vi.fn()} />);
      await screen.findAllByText("retained");
      fireEvent.click(
        screen.getByRole("button", { name: "bknTrace.traceWorkspace.spanBrowser.next" }),
      );
      await waitFor(() => expect(listTechnicalSpans).toHaveBeenCalledTimes(2));
      await screen.findByText(
        `bknTrace.traceWorkspace.spanBrowser.errors.${reason}`,
        {},
        { timeout: 5000 },
      );
      expect(screen.getAllByText("retained")).not.toHaveLength(0);
      expect(screen.queryByText("private failure")).toBeNull();
    },
  );

  it("aborts on close/unmount and rejects a late response after switching traces", async () => {
    let resolve!: (value: TechnicalSpanPage) => void;
    vi.mocked(listTechnicalSpans)
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(page("new-trace"));
    const view = render(<SpanBrowser key="old" traceId="old" onClose={vi.fn()} />);
    await waitFor(() => expect(listTechnicalSpans).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(listTechnicalSpans).mock.calls[0][2];
    view.rerender(<SpanBrowser key="new" traceId="new" onClose={vi.fn()} />);
    await screen.findAllByText("new-trace");
    expect(signal?.aborted).toBe(true);
    await act(() => {
      resolve(page("late-old"));
      return Promise.resolve();
    });
    expect(screen.queryByText("late-old")).toBeNull();
    const current = vi.mocked(listTechnicalSpans).mock.calls[1][2];
    view.unmount();
    expect(current?.aborted).toBe(true);
  });
});
