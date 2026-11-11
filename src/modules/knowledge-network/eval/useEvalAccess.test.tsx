/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getEvalCapabilities } from "./m0-run.service";
import { useEvalAccess } from "./useEvalAccess";

vi.mock("./m0-run.service", () => ({ getEvalCapabilities: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it("uses backend admission rather than frontend role guesses", async () => {
  vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: false });
  const { result } = renderHook(() => useEvalAccess("network-1"));
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("allowed"));
});

it.each([
  [403, "denied"],
  [503, "failed"],
  [504, "failed"],
  [401, "failed"],
] as const)(
  "distinguishes permission denial from dependency failure (%s)",
  async (status, expected) => {
    vi.mocked(getEvalCapabilities).mockRejectedValue({ isAxiosError: true, response: { status } });
    const { result } = renderHook(() => useEvalAccess("network-1"));
    await waitFor(() => expect(result.current.status).toBe(expected));
    vi.mocked(getEvalCapabilities).mockResolvedValue({ case_management: true });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("allowed"));
  },
);

it("never reuses access from the previous network or a stale response", async () => {
  let completeOld!: (value: { case_management: boolean }) => void;
  vi.mocked(getEvalCapabilities)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        completeOld = resolve;
      }),
    )
    .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } });
  const { result, rerender } = renderHook(({ id }) => useEvalAccess(id), {
    initialProps: { id: "old" },
  });
  rerender({ id: "new" });
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("denied"));
  await act(() => Promise.resolve(completeOld({ case_management: true })));
  expect(result.current.status).toBe("denied");
});
