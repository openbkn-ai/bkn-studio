/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";
import { definitionOnlyCase } from "./definition-only-case";
import type { EvalTemplateRule } from "./types";

const input = {
  networkId: "kn",
  resource: { kind: "function", id: "resource", name: "订单查询" },
  rule: {
    id: "function-input",
    title: "函数输入处理正确",
    kind: "function",
    enabled: true,
    revision: 1,
  } as EvalTemplateRule,
  question: "缺少编号时返回参数错误",
  argumentsJson: "{}",
  criteria: [
    {
      id: "error",
      type: "equals",
      path: "$.error",
      value: "缺少编号",
      valueType: "string" as const,
    },
  ],
  source: "business_expert" as const,
  evidence: "接口合同第3节",
  reason: "尚未接入异常判定执行方式",
};
it("preserves an independently specified expectation and cannot carry a runnable target", () => {
  const result = definitionOnlyCase(input);
  expect(result.execution_spec.runner).toBe("unbound");
  expect(result.expected_spec).toEqual({ criteria: { value_0: "缺少编号" } });
  expect(result.diagnostic_spec).toMatchObject({
    definition_only: true,
    form_version: 2,
    template_rule_id: "function-input",
  });
  expect(result.execution_spec.target).toMatchObject({ kn_id: "kn", resource_id: "resource" });
});
it.each([{ question: " " }, { argumentsJson: "[]" }, { evidence: " " }, { criteria: [] }])(
  "cannot prepare an incomplete or ambiguous definition: %j",
  (change) => {
    expect(() => definitionOnlyCase({ ...input, ...change })).toThrow();
  },
);
