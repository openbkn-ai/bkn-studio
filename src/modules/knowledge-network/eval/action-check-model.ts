/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License. See LICENSE for the full text.
 */

import type { CaseTargetSchema, CaseSchema } from "./case-form.service";

export function defaultActionCheck(binding: string): Record<string, unknown> {
  if (binding === "authorization") return { expected_decision: "accepted", phase: "submission" };
  if (binding === "failure") return { phase: "source", scenario: "failure" };
  if (["precondition", "target"].includes(binding)) return { expected_decision: "accepted" };
  return {};
}

export function actionCheckArgumentsSchema(
  contract: CaseTargetSchema,
  binding: string,
): CaseSchema {
  return {
    type: "object",
    properties: {
      action_input: { type: "object" },
      check: contract.action_checks?.[binding] ?? { type: "object" },
    },
    required: ["action_input", "check"],
    additionalProperties: false,
  };
}
