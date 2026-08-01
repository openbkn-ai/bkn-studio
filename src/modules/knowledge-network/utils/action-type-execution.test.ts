/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ActionTypeExecutionConfig } from "@/modules/knowledge-network/types/knowledge-network";

import {
  ACTION_TYPE_EXECUTION_PARAMETER_REQUIRED_KEY,
  ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY,
  validateActionTypeExecutionConfig,
} from "./action-type-execution";

function createExecutionConfig(
  patch: Partial<ActionTypeExecutionConfig> = {},
): ActionTypeExecutionConfig {
  return {
    actionSource: {
      boxId: "box-1",
      boxName: "Demo Box",
      toolId: "tool-1",
      toolName: "No Input Tool",
      type: "tool",
    },
    parameters: [],
    sourceName: "Demo Box/No Input Tool",
    sourceType: "tool",
    ...patch,
  };
}

describe("validateActionTypeExecutionConfig", () => {
  it("keeps requiring an execution tool", () => {
    expect(
      validateActionTypeExecutionConfig(createExecutionConfig({
        actionSource: undefined,
        sourceName: "",
      })),
    ).toBe(ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY);
  });

  it("allows empty parameters when the selected tool has no input schema", () => {
    expect(
      validateActionTypeExecutionConfig(createExecutionConfig(), {
        allowEmptyParameters: true,
      }),
    ).toBeNull();
  });

  it("keeps rejecting empty parameters when the selected tool requires mappings", () => {
    expect(validateActionTypeExecutionConfig(createExecutionConfig())).toBe(
      ACTION_TYPE_EXECUTION_PARAMETER_REQUIRED_KEY,
    );
  });

  it("accepts configured dynamic input parameters", () => {
    expect(
      validateActionTypeExecutionConfig(
        createExecutionConfig({
          parameters: [{ name: "order_id", valueFrom: "input" }],
        }),
      ),
    ).toBeNull();
  });

  it("keeps rejecting incomplete constant or property mappings", () => {
    expect(
      validateActionTypeExecutionConfig(
        createExecutionConfig({
          parameters: [{ name: "status", valueFrom: "const", value: "" }],
        }),
      ),
    ).toBe(ACTION_TYPE_EXECUTION_PARAMETER_REQUIRED_KEY);
  });
});
