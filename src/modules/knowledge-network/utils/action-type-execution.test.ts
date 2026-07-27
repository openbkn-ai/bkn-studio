/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ActionTypeExecutionConfig } from "@/modules/knowledge-network/types/knowledge-network";

import { validateActionTypeExecutionConfig } from "./action-type-execution";

const t = (key: string) => key;

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
  it("keeps requiring an execution source", () => {
    expect(
      validateActionTypeExecutionConfig(t, createExecutionConfig({
        actionSource: undefined,
        sourceName: "",
      })),
    ).toBe("knowledgeNetwork.actionTypeExecutionSourceNameRequired");
  });

  it("allows empty parameters when the selected tool has no input schema", () => {
    expect(
      validateActionTypeExecutionConfig(t, createExecutionConfig(), {
        allowEmptyParameters: true,
      }),
    ).toBeNull();
  });

  it("keeps rejecting empty parameters when the selected tool requires mappings", () => {
    expect(validateActionTypeExecutionConfig(t, createExecutionConfig())).toBe(
      "knowledgeNetwork.actionTypeExecutionParameterRequired",
    );
  });

  it("accepts configured dynamic input parameters", () => {
    expect(
      validateActionTypeExecutionConfig(
        t,
        createExecutionConfig({
          parameters: [{ name: "order_id", valueFrom: "input" }],
        }),
      ),
    ).toBeNull();
  });

  it("keeps rejecting incomplete constant or property mappings", () => {
    expect(
      validateActionTypeExecutionConfig(
        t,
        createExecutionConfig({
          parameters: [{ name: "status", valueFrom: "const", value: "" }],
        }),
      ),
    ).toBe("knowledgeNetwork.actionTypeExecutionParameterRequired");
  });
});
