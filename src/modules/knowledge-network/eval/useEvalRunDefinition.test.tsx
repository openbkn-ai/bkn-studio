/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getEvalCaseDefinition, type EvalSuiteCaseDetail } from "./m0-run.service";
import { useEvalRunDefinition } from "./useEvalRunDefinition";
vi.mock("./m0-run.service", () => ({ getEvalCaseDefinition: vi.fn() }));
const read = vi.mocked(getEvalCaseDefinition);
const detail = (id: string) => ({ case_id: id, gold_visible: false }) as EvalSuiteCaseDetail;
const deferred = () => {
  let resolve!: (value: EvalSuiteCaseDetail) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<EvalSuiteCaseDetail>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
beforeEach(() => read.mockReset());
it.each([undefined, ""])("does not read an incomplete run identity (%s)", (missing) => {
  const { result } = renderHook(() => useEvalRunDefinition("kn", "run", missing, "case"));
  expect(read).not.toHaveBeenCalled();
  expect(result.current).toMatchObject({ definition: undefined, failed: false, loading: false });
});
it("reads the frozen run definition rather than the current editable case", async () => {
  read.mockResolvedValue(detail("case"));
  const { result } = renderHook(() => useEvalRunDefinition("kn", "run-old", "attempt", "case"));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.definition?.case_id).toBe("case"));
  expect(read).toHaveBeenCalledWith("kn", "case", { runId: "run-old", caseRunId: "attempt" });
});
it.each(["resolve", "reject"] as const)(
  "ignores a late %s from the previous selection",
  async (mode) => {
    const old = deferred();
    const current = deferred();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(({ id }) => useEvalRunDefinition("kn", "run", id, id), {
      initialProps: { id: "old" },
    });
    rerender({ id: "new" });
    await act(() => Promise.resolve(current.resolve(detail("new"))));
    await act(() =>
      Promise.resolve(
        mode === "resolve" ? old.resolve(detail("old")) : old.reject(new Error("old failed")),
      ),
    );
    expect(result.current).toMatchObject({
      definition: { case_id: "new" },
      failed: false,
      loading: false,
    });
  },
);
it("hides the previous definition while another case loads and supports retry", async () => {
  read
    .mockResolvedValueOnce(detail("old"))
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(detail("new"));
  const { result, rerender } = renderHook(({ id }) => useEvalRunDefinition("kn", "run", id, id), {
    initialProps: { id: "old" },
  });
  await waitFor(() => expect(result.current.definition?.case_id).toBe("old"));
  rerender({ id: "new" });
  expect(result.current.definition).toBeUndefined();
  await waitFor(() => expect(result.current.failed).toBe(true));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.definition?.case_id).toBe("new"));
  expect(result.current.failed).toBe(false);
  expect(read).toHaveBeenCalledTimes(3);
});
it("drops an in-flight response after unmount", async () => {
  const pending = deferred();
  read.mockReturnValue(pending.promise);
  const { unmount } = renderHook(() => useEvalRunDefinition("kn", "run", "attempt", "case"));
  unmount();
  await act(() => Promise.resolve(pending.resolve(detail("case"))));
  expect(read).toHaveBeenCalledTimes(1);
});
