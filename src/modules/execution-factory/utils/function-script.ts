/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";

export type FunctionScriptFields = Pick<
  FunctionInputPayload,
  "script_type" | "kn_id" | "result_shape"
>;

/**
 * The script fields an edit must send back as they were stored. The backend fills an absent
 * script_type with python and refuses turning a Cypher function into a Python one, so an edit
 * that forgot them would fail; a Cypher function also keeps its network and result shape.
 */
export function storedScriptFields(input?: FunctionInputPayload): FunctionScriptFields {
  if (input?.script_type === "cypher") {
    return {
      script_type: "cypher",
      kn_id: input.kn_id,
      result_shape: input.result_shape ?? "value",
    };
  }
  return { script_type: "python" };
}
