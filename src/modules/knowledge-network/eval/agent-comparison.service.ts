/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { M0Run } from "./m0-run.service";

export const MAX_AGENT_COMPARISON_RUNS = 6;

export type AgentComparedRun = M0Run & {
  data_baseline_id: string;
  mean_case_duration_ms: number | null;
  duration_case_count: number;
};
export type AgentComparisonCell = {
  run_id: string;
  case_run_id: string;
  quality_outcome: NonNullable<M0Run["quality_outcome"]>;
  duration_ms: number | null;
};
export type AgentComparisonCase = {
  case_id: string;
  case_version_id: string;
  title: string;
  results: AgentComparisonCell[];
};
export type AgentComparison = {
  suite_id: string;
  suite_version: number;
  target_snapshot_compatible: boolean;
  data_baseline_matched: boolean;
  runs: AgentComparedRun[];
  cases: AgentComparisonCase[];
};

export async function compareAgentRuns(
  networkId: string,
  suiteId: string,
  suiteVersion: number,
  runs: M0Run[],
  signal?: AbortSignal,
): Promise<AgentComparison> {
  if (
    !suiteId ||
    !Number.isInteger(suiteVersion) ||
    suiteVersion < 1 ||
    runs.some(
      (run) => !run.id || !Number.isInteger(run.result_revision) || (run.result_revision ?? 0) < 1,
    ) ||
    runs.length < 2 ||
    runs.length > MAX_AGENT_COMPARISON_RUNS ||
    new Set(runs.map((run) => run.id)).size !== runs.length
  ) {
    throw new Error("Invalid Agent comparison selection");
  }
  const response = await http.post<AgentComparison>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/runs/compare-agents`,
    {
      suite_id: suiteId,
      suite_version: suiteVersion,
      runs: runs.map((run) => ({ run_id: run.id, result_revision: run.result_revision })),
    },
    { skipErrorToast: true, signal },
  );
  return response.data;
}
