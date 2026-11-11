/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import { getEvalCaseDefinition, type EvalSuiteCaseDetail } from "./m0-run.service";

/** Read the executed case version, never the current editable definition. */
export function useEvalRunDefinition(
  networkId?: string,
  runId?: string,
  caseRunId?: string,
  caseId?: string,
) {
  const key = `${networkId}:${runId}:${caseRunId}:${caseId}`;
  const [state, setState] = useState<{ key: string; detail: EvalSuiteCaseDetail }>();
  const [failedKey, setFailedKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const enabled = !!(networkId && runId && caseRunId && caseId);
  useEffect(() => {
    setFailedKey("");
    if (!networkId || !runId || !caseRunId || !caseId) return;
    let active = true;
    void getEvalCaseDefinition(networkId, caseId, { runId, caseRunId })
      .then((detail) => {
        if (active) setState({ key, detail });
      })
      .catch(() => {
        if (active) setFailedKey(key);
      });
    return () => {
      active = false;
    };
  }, [networkId, runId, caseRunId, caseId, key, attempt]);
  const definition = state?.key === key ? state.detail : undefined;
  const failed = failedKey === key;
  return {
    definition,
    failed,
    loading: enabled && !definition && !failed,
    retry: () => setAttempt((value) => value + 1),
  };
}
