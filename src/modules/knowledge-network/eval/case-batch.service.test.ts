/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import { applyEvalCaseBatch } from "./case-batch.service";
import { removeEvalCase, setEvalCaseEnabled } from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  removeEvalCase: vi.fn(),
  setEvalCaseEnabled: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());

it("enables selected cases directly without creating versions", async () => {
  const entries = [
    { id: "draft", title: "Draft" },
    { id: "disabled", title: "Disabled" },
  ];
  const results = await applyEvalCaseBatch("kn", entries, "enable");
  expect(results.every((result) => result.success)).toBe(true);
  expect(setEvalCaseEnabled).toHaveBeenCalledWith("kn", "draft", true);
  expect(setEvalCaseEnabled).toHaveBeenCalledWith("kn", "disabled", true);
  expect(setEvalCaseEnabled).toHaveBeenCalledTimes(2);
});

it("reports an incomplete case rejected by the server", async () => {
  vi.mocked(setEvalCaseEnabled).mockRejectedValue(
    Object.assign(new Error("incomplete"), { isAxiosError: true, response: { status: 400 } }),
  );
  const results = await applyEvalCaseBatch(
    "kn",
    [{ id: "incomplete", title: "Incomplete", enabled: false }],
    "enable",
  );
  expect(results[0]).toMatchObject({ success: false, error: "incomplete" });
});

it("deletes each selected id once, reports failures and continues other items", async () => {
  vi.mocked(removeEvalCase).mockImplementation((_kn, id) =>
    id === "protected"
      ? Promise.reject(
          Object.assign(new Error("protected"), { isAxiosError: true, response: { status: 409 } }),
        )
      : Promise.resolve({ result: "deleted" }),
  );
  const entries = [
    { id: "ok", title: "OK" },
    { id: "protected", title: "Protected" },
    { id: "last", title: "Last" },
  ];
  const results = await applyEvalCaseBatch("kn", [...entries, entries[0]], "delete");
  expect(results.map((result) => result.success)).toEqual([true, false, true]);
  expect(results[1].error).toBe("conflict");
  expect(removeEvalCase).toHaveBeenCalledTimes(3);
  expect(removeEvalCase).toHaveBeenCalledWith("kn", "ok", "delete");
});

it("bounds concurrent requests and returns results in selection order", async () => {
  let active = 0,
    peak = 0;
  vi.mocked(removeEvalCase).mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
    active--;
    return { result: "deleted" };
  });
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    title: String(index),
  }));
  const results = await applyEvalCaseBatch("kn", entries, "delete");
  expect(peak).toBe(4);
  expect(results.map((result) => result.id)).toEqual(entries.map((entry) => entry.id));
  expect(results.every((result) => result.success)).toBe(true);
});

it("retries a lost enable response idempotently", async () => {
  vi.mocked(setEvalCaseEnabled)
    .mockRejectedValueOnce(new Error("response lost after commit"))
    .mockResolvedValueOnce(undefined);
  const entries = [{ id: "case", title: "Case" }];
  expect((await applyEvalCaseBatch("kn", entries, "enable"))[0].success).toBe(false);
  expect((await applyEvalCaseBatch("kn", entries, "enable"))[0].success).toBe(true);
  expect(setEvalCaseEnabled).toHaveBeenCalledTimes(2);
  expect(setEvalCaseEnabled).toHaveBeenCalledWith("kn", "case", true);
});
