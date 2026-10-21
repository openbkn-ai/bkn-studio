/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricV1Part as enUS } from "./en-US/object-metric-v1";
import { objectMetricV1Part as zhCN } from "./zh-CN/object-metric-v1";

describe("Object Metric V1 translations", () => {
  it("has matching keys and interpolation tokens in both languages", () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(zhCN).sort());
    for (const key of Object.keys(zhCN) as Array<keyof typeof zhCN>) {
      expect(enUS[key].trim(), key).not.toBe("");
      expect(enUS[key], key).not.toMatch(/[\u4e00-\u9fff]/);
      const tokens = (value: string) =>
        [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
      expect(tokens(enUS[key]), key).toEqual(tokens(zhCN[key]));
    }
  });

  it("renders natural English time-window summaries", () => {
    expect(enUS.mf145846aa1ef).toBe("By {{p0}}");
    expect(enUS.mb0da3e3a8637).toBe("{{p0}}: data for {{p1}}");
    expect(enUS.mb57a559179e5).toBe("{{p0}}: data for the last {{p1}} {{p2}}");
    expect(enUS.mf412ae95d897).toBe("{{p0}}: data from {{p1}} to {{p2}}");
  });
});
