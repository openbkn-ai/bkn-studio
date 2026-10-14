/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricFormErrorCount } from "./object-metric-form-validation";

describe("objectMetricFormErrorCount", () => {
  it("counts invalid form fields for the page-level validation summary", () => {
    expect(
      objectMetricFormErrorCount({
        errorFields: [
          { errors: ["请输入逻辑属性名称"], name: ["logicPropertyName"] },
          { errors: ["请输入逻辑属性显示名称"], name: ["logicPropertyDisplayName"] },
          { errors: [], name: ["description"] },
        ],
      }),
    ).toBe(2);
  });

  it("does not turn unrelated exceptions into form validation failures", () => {
    expect(objectMetricFormErrorCount(new Error("network failed"))).toBe(0);
  });
});
