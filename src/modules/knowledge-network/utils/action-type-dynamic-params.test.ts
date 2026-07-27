/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ActionTypeExecutionParameter } from "@/modules/knowledge-network/types/knowledge-network";

import {
  buildActionTypeDynamicParams,
  getActionTypeDynamicParameters,
} from "./action-type-dynamic-params";

describe("action type dynamic params", () => {
  it("keeps only configured dynamic input parameters", () => {
    const parameters: ActionTypeExecutionParameter[] = [
      { name: "city", valueFrom: "input" },
      { name: "limit", value: "10", valueFrom: "const" },
      { name: "name", value: "display_name", valueFrom: "property" },
    ];

    expect(getActionTypeDynamicParameters(parameters)).toEqual([
      { name: "city", valueFrom: "input" },
    ]);
  });

  it("preserves primitive types and expands dotted parameter paths", () => {
    const parameters: ActionTypeExecutionParameter[] = [
      { name: "city", type: "string", valueFrom: "input" },
      { name: "limit", type: "integer", valueFrom: "input" },
      { name: "enabled", type: "boolean", valueFrom: "input" },
      { name: "filter.tags", type: "array", valueFrom: "input" },
    ];

    expect(
      buildActionTypeDynamicParams(parameters, {
        city: "Shanghai",
        enabled: false,
        "filter.tags": "[\"priority\", \"active\"]",
        limit: 10,
      }),
    ).toEqual({
      city: "Shanghai",
      enabled: false,
      filter: {
        tags: ["priority", "active"],
      },
      limit: 10,
    });
  });
});
