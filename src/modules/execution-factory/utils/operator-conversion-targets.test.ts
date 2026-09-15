/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import { eligibleOperatorConversionTargets, operatorConversionPermission } from "./operator-conversion-targets";

const operator: OperatorRecord = {
  operatorId: "operator-api", name: "API operator", version: "1", status: "published", metadataType: "openapi",
};
const boxes: ToolboxRecord[] = [
  { boxId: "api-allowed", name: "API allowed", metadataType: "openapi", status: "published", operations: ["view", "modify"] },
  { boxId: "api-view", name: "API view", metadataType: "openapi", status: "published", operations: ["view"] },
  { boxId: "function", name: "Function", metadataType: "function", status: "published", operations: ["view", "modify"] },
  { boxId: "internal", name: "Internal", metadataType: "openapi", status: "published", operations: ["modify"], isInternal: true },
];

describe("operator conversion targets", () => {
  it("uses the operator's actual type for the conversion gate", () => {
    expect(operatorConversionPermission("openapi")).toBe("execution-factory:toolbox:edit");
    expect(operatorConversionPermission("function")).toBe("execution-factory:function:edit");
    expect(operatorConversionPermission(undefined)).toBe("");
  });

  it("keeps only matching, writable, non-internal API toolboxes", () => {
    expect(eligibleOperatorConversionTargets(operator, boxes, ["execution-factory:toolbox:edit"])
      .map((box) => box.boxId)).toEqual(["api-allowed"]);
    expect(eligibleOperatorConversionTargets(operator, boxes, ["execution-factory:function:edit"])).toEqual([]);
  });

  it("keeps Function and API modification grants independent", () => {
    const functionOperator = { ...operator, metadataType: "function" as const };
    expect(eligibleOperatorConversionTargets(functionOperator, boxes, ["execution-factory:function:edit"])
      .map((box) => box.boxId)).toEqual(["function"]);
  });
});
