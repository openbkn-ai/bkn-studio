/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import {
  eligibleOperatorConversionTargets,
  operatorConversionPermission,
} from "./operator-conversion-targets";

const operator: OperatorRecord = {
  operatorId: "operator-api",
  name: "API operator",
  version: "1",
  status: "published",
  metadataType: "openapi",
};
const boxes: ToolboxRecord[] = [
  // The management list only projects object-grant `authorize`, not `modify`.
  {
    boxId: "api-authorized",
    name: "API authorized",
    metadataType: "openapi",
    status: "published",
    operations: ["authorize"],
  },
  {
    boxId: "api-no-operations",
    name: "API no operations",
    metadataType: "openapi",
    status: "published",
  },
  {
    boxId: "function",
    name: "Function",
    metadataType: "function",
    status: "published",
    operations: ["authorize"],
  },
  {
    boxId: "internal",
    name: "Internal",
    metadataType: "openapi",
    status: "published",
    operations: ["authorize"],
    isInternal: true,
  },
];

describe("operator conversion targets", () => {
  it("uses the operator's actual type for the conversion gate", () => {
    expect(operatorConversionPermission("openapi")).toBe("execution-factory:toolbox:edit");
    expect(operatorConversionPermission("function")).toBe("execution-factory:function:edit");
    expect(operatorConversionPermission(undefined)).toBe("");
  });

  it("keeps matching non-internal API toolboxes when the list projects only authorize", () => {
    expect(
      eligibleOperatorConversionTargets(operator, boxes, ["execution-factory:toolbox:edit"]).map(
        (box) => box.boxId,
      ),
    ).toEqual(["api-authorized", "api-no-operations"]);
    expect(
      eligibleOperatorConversionTargets(operator, boxes, ["execution-factory:function:edit"]),
    ).toEqual([]);
  });

  it("keeps Function and API modification grants independent", () => {
    const functionOperator = { ...operator, metadataType: "function" as const };
    expect(
      eligibleOperatorConversionTargets(functionOperator, boxes, [
        "execution-factory:function:edit",
      ]).map((box) => box.boxId),
    ).toEqual(["function"]);
  });
});
