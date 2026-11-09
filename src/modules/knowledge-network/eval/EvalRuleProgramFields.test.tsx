/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it } from "vitest";
import i18n from "i18next";
import { evalLocales } from "./locales";
import { EvalRuleProgramFields } from "./EvalRuleProgramFields";
import { newRuleProgram, validateRuleProgram, type EvalRuleProgram } from "./rule-check-model";
beforeAll(async () => {
  await i18n.init({ lng: "zh-CN", resources: evalLocales, showSupportNotice: false });
});

function Editor() {
  const [value, setValue] = useState<EvalRuleProgram>(newRuleProgram("objectProperty"));
  return (
    <>
      <EvalRuleProgramFields kind="objectProperty" value={value} onChange={setValue} />
      <output data-testid="plan">{JSON.stringify(value)}</output>
    </>
  );
}
it("combines structured predicates and aggregate comparison without asking for a program", () => {
  render(<Editor />);
  expect(screen.getByRole("textbox", { name: "检查字段" })).toHaveValue("$property");
  fireEvent.click(screen.getByRole("button", { name: "添加逐行校验" }));
  expect(screen.getAllByRole("group", { name: /逐行校验第/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "添加聚合比较" }));
  const plan = JSON.parse(screen.getByTestId("plan").textContent ?? "") as EvalRuleProgram;
  expect(plan.aggregates).toEqual([{ function: "count", operator: "gte", value: 1 }]);
  expect(() => validateRuleProgram(plan)).not.toThrow();
});
it("requires independently supplied reference data and clears conflicting sampling operations", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("checkbox", { name: "只检查满足条件的采样记录" }));
  fireEvent.click(screen.getByRole("button", { name: "添加聚合比较" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "按独立对照样本定位并核对" }));
  expect(screen.queryByRole("combobox", { name: "聚合统计范围" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "对象主键字段" }), {
    target: { value: "id" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "对照主键字段" }), {
    target: { value: "key" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "独立对照记录" }), {
    target: { value: '[{"key":1,"gold":false}]' },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "对照依据" }), {
    target: { value: "已核对的业务记录" },
  });
  const plan = JSON.parse(screen.getByTestId("plan").textContent ?? "") as EvalRuleProgram;
  expect(plan.where).toBeUndefined();
  expect(plan.aggregates).toBeUndefined();
  expect(plan.reference?.rows[0].gold).toBe(false);
  expect(() => validateRuleProgram(plan)).not.toThrow();
  fireEvent.change(screen.getByRole("textbox", { name: "独立对照记录" }), {
    target: { value: "invalid" },
  });
  expect(() =>
    validateRuleProgram(
      JSON.parse(screen.getByTestId("plan").textContent ?? "") as EvalRuleProgram,
    ),
  ).toThrow("对照记录");
});
it("changes comparison operand from literal to another real field", () => {
  render(<Editor />);
  const group = screen.getByRole("group", { name: "逐行校验第1条" });
  fireEvent.mouseDown(within(group).getByRole("combobox", { name: "判断方式" }));
  fireEvent.click(screen.getByText("大于等于"));
  fireEvent.mouseDown(within(group).getByRole("combobox", { name: "比较对象" }));
  fireEvent.click(screen.getByText("另一字段"));
  fireEvent.change(within(group).getByRole("textbox", { name: "比较字段" }), {
    target: { value: "minimum" },
  });
  const plan = JSON.parse(screen.getByTestId("plan").textContent ?? "") as EvalRuleProgram;
  expect(plan.expect?.conditions[0]).toEqual({
    field: "$property",
    operator: "gte",
    other_field: "minimum",
  });
  expect(() => validateRuleProgram(plan)).not.toThrow();
});

it("lets business users type decimal boundaries without losing intermediate zeros", () => {
  render(<Editor />);
  const group = screen.getByRole("group", { name: "逐行校验第1条" });
  fireEvent.mouseDown(within(group).getByRole("combobox", { name: "判断方式" }));
  fireEvent.click(screen.getByText("大于等于"));
  fireEvent.mouseDown(within(group).getByRole("combobox", { name: "比较值类型" }));
  fireEvent.click(screen.getByText("数值"));
  const input = within(group).getByRole("textbox", { name: "比较值" });
  for (const value of ["0", "0.", "0.0", "0.01"]) fireEvent.change(input, { target: { value } });
  expect(input).toHaveValue("0.01");
  expect(
    (JSON.parse(screen.getByTestId("plan").textContent ?? "") as EvalRuleProgram).expect
      ?.conditions[0].value,
  ).toBe(0.01);
});
