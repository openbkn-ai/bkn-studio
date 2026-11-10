/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import { compareAgentRuns } from "./agent-comparison.service";
import type { M0Run } from "./m0-run.service";
const post = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { post } }));
const run = (id: string): M0Run => ({
  id,
  result_revision: 3,
  execution_status: "completed",
  phase: null,
  quality_outcome: "pass",
  progress: { planned_cases: 1, completed_cases: 1 },
});
beforeEach(() => post.mockReset());
it("sends pinned revisions and excludes client-supplied metrics from the comparison request", async () => {
  post.mockResolvedValue({ data: { cases: [] } });
  const signal = new AbortController().signal;
  await compareAgentRuns("kn/one", "suite", 2, [run("a"), run("b")], signal);
  expect(post).toHaveBeenCalledWith(
    expect.stringContaining("kn%2Fone/evals/runs/compare-agents"),
    {
      suite_id: "suite",
      suite_version: 2,
      runs: [
        { run_id: "a", result_revision: 3 },
        { run_id: "b", result_revision: 3 },
      ],
    },
    { skipErrorToast: true, signal },
  );
});
it("rejects duplicate or oversized selections without an HTTP call", async () => {
  await expect(compareAgentRuns("kn", "suite", 1, [run("a"), run("a")])).rejects.toThrow();
  await expect(
    compareAgentRuns(
      "kn",
      "suite",
      1,
      Array.from({ length: 7 }, (_, i) => run(String(i))),
    ),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
