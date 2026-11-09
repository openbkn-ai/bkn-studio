/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import "./locales";

import { evalTerm } from "./eval-terminology";

import type { EvalCaseSummary } from "./m0-run.service";

const executionText = (key: string, values?: Record<string, unknown>): string =>
  i18n.t(`knowledgeNetwork.eval.foundation.executionSetup.${key}`, {
    ...values,
    interpolation: { escapeValue: false },
  });

export const caseExecutionSetupLabel = (entry: EvalCaseSummary): string => {
  switch (entry.execution_setup) {
    case "ready_for_preflight":
      return executionText("runnable");
    default:
      return caseExecutionSetupReason(entry.execution_setup);
  }
};

export const caseExecutionSetupReason = (setup: EvalCaseSummary["execution_setup"]): string => {
  switch (setup) {
    case "review_required":
      return evalTerm("notReady");
    case "execution_not_configured":
      return executionText("notConfigured");
    case "unsupported_runner":
      return executionText("unsupported");
    case "invalid_contract":
      return executionText("invalidContract");
    case "grant_missing":
      return executionText("grantMissing");
    default:
      return executionText("pending");
  }
};

export const caseCanConfigureObjectCheck = (entry: EvalCaseSummary): boolean =>
  entry.source_type === "template" &&
  entry.execution_spec?.runner === "unbound" &&
  ["object-key-uniqueness", "object-key-completeness"].includes(
    entry.template_rule_id ?? entry.input_spec?.template_rule_id ?? "",
  );
