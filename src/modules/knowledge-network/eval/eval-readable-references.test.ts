/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { beforeAll, expect, it } from "vitest";
import { evalLocales } from "./locales";
import { readableEvalText, repairReadableReferences } from "./eval-readable-references";
import type { EvalRepairContext } from "./eval-repair.service";

beforeAll(async () => {
  await i18n.init({ lng: "zh-CN", resources: evalLocales });
});
const id = "01a1af6c-6841-790f-bcbc-b2bcffee9d68";
const context = {
  target: { id: "po-resource", kind: "objectType", name: "采购订单" },
  failures: [
    {
      caseId: "case-1",
      caseRunId: id,
      runId: "run-1",
      title: "采购订单 / entry_id · 属性值类型一致",
    },
  ],
} as EvalRepairContext;

it("replaces machine references with exact case and execution names while preserving field names", () => {
  const source = `entry_id、id 改为 integer 后，使用原用例 caseRunId ${id} 复测。`;
  expect(readableEvalText(source, repairReadableReferences(context))).toBe(
    "entry_id、id 改为 integer 后，使用原用例 用例「采购订单 / entry_id · 属性值类型一致」的执行记录 复测。",
  );
  expect(context.failures[0].caseRunId).toBe(id);
});
it.each(["caseRunId ", "case_run_id: ", "用例执行 ID：", "caseRunId="])(
  "reads technical prefix %s without displaying it",
  (prefix) => {
    expect(readableEvalText(prefix + id, [{ id, label: "原用例的执行记录" }])).toBe(
      "原用例的执行记录",
    );
  },
);
it("escapes special characters, prefers the full reference and does not replace substrings", () => {
  expect(
    readableEvalText("case-1 case-10 case-100 xcase-1 case-1-extra a.b+(2)", [
      { id: "case-1", label: "用例一" },
      { id: "case-10", label: "用例十" },
      { id: "a.b+(2)", label: "执行材料" },
    ]),
  ).toBe("用例一 用例十 case-100 xcase-1 case-1-extra 执行材料");
});
it("leaves unknown and ambiguous references untouched rather than inventing a name", () => {
  expect(
    readableEvalText("case-1 unknown-id", [
      { id: "case-1", label: "订单" },
      { id: "case-1", label: "库存" },
    ]),
  ).toBe("case-1 unknown-id");
});
it("preserves real field identifiers even when a resource happens to have the same identifier", () => {
  expect(
    readableEvalText("字段 id 和 product_id；resource_id=id", [
      { id: "id", label: "订单" },
      { id: "product_id", label: "产品" },
    ]),
  ).toBe("字段 id 和 product_id；订单");
});
it("uses English display names without changing IDs in the executable context", async () => {
  await i18n.changeLanguage("en-US");
  const result = readableEvalText(id, repairReadableReferences(context));
  expect(result).toContain("Execution of case");
  expect(result).not.toContain(id);
  await i18n.changeLanguage("zh-CN");
});

it("preserves copyable JSON and technical code while formatting surrounding prose", () => {
  const code = '```json\n{"case_run_id":"case-run-1"}\n```';
  expect(
    readableEvalText(`查看 case-run-1\n${code}`, [
      { id: "case-run-1", label: "订单用例的执行记录" },
    ]),
  ).toBe(`查看 订单用例的执行记录\n${code}`);
});
