/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalObjectCaseFields } from "./EvalObjectCaseFields";
import {
  getEvalTemplateConfig,
  type EvalCaseDefinition,
  type EvalTemplateConfig,
} from "./m0-run.service";
import {
  previewRuleApplication,
  type RuleApplicationPreview,
  type RuleApplicationRow,
} from "./rule-application.service";
vi.mock("./m0-run.service", () => ({ getEvalTemplateConfig: vi.fn() }));
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "zh-CN",
    fallbackLng: "zh-CN",
    resources: evalLocales,
    interpolation: { escapeValue: false },
  });
});
const prepared = {
  title: "对象主键",
  category: "fact",
  risk_level: "medium",
  input_spec: {},
  assertions: [],
  expected_spec: {},
  expected_source: { kind: "declared_contract", evidence_refs: ["规则声明"] },
  diagnostic_spec: {},
  execution_spec: { runner: "object_data_check" },
} as EvalCaseDefinition;
const row: RuleApplicationRow = {
  key: "row-1",
  resource: { kind: "objectType", id: "order" },
  resource_name: "订单",
  target_id: "order",
  rule_id: "object-key-uniqueness",
  rule_title: "实例唯一",
  rule_checksum: "rule",
  resource_checksum: "resource",
  match: "applicable",
  configuration: "complete",
  execution: "ready",
  execution_reason: "",
  sample: {
    target_key: "target-1",
    sample_id: "default",
    title: "对象主键",
    question: "检查主键",
    arguments: {},
    scope: { mode: "sample", limit: 100 },
  },
  target_key: "target-1",
  target_name: "订单号",
  ready_for_save: true,
  prepared_definition: prepared,
  missing: [],
};
const preview = (entries: RuleApplicationRow[]): RuleApplicationPreview => ({
  entries,
  total: entries.length,
  page: 1,
  limit: 100,
  scope_revision: 1,
});
const resource = { kind: "objectType", id: "order", name: "订单" };
const choose = (name: string, label: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
  fireEvent.click(screen.getByText(label, { selector: ".ant-select-item-option-content" }));
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    rules: [
      { id: "object-key-uniqueness", kind: "objectType", title: "实例唯一", enabled: true },
      { id: "property-type", kind: "objectProperty", title: "属性类型", enabled: true },
    ],
    execution_support: {
      "object-key-uniqueness": { status: "supported" },
      "property-type": { status: "supported" },
    },
  } as unknown as EvalTemplateConfig);
  vi.mocked(previewRuleApplication).mockResolvedValue(preview([row]));
});
it("discards a previous resource response when the user changes objects", async () => {
  let resolve!: (value: RuleApplicationPreview) => void;
  vi.mocked(previewRuleApplication)
    .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    .mockResolvedValueOnce(preview([]));
  const onPrepared = vi.fn();
  const view = render(
    <EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />,
  );
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查项", "实例唯一");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(1));
  view.rerender(
    <EvalObjectCaseFields
      networkId="kn"
      resource={{ ...resource, id: "product" }}
      onPrepared={onPrepared}
    />,
  );
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(2));
  resolve(preview([row]));
  await screen.findByText("当前对象没有可用的匹配检查目标。");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
});
it("requires a specific real property before providing an executable definition", async () => {
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  choose("检查属性", "订单号");
  expect(onPrepared).toHaveBeenLastCalledWith(prepared);
});
it("clears the executable definition when preview fails and allows retry", async () => {
  vi.mocked(previewRuleApplication).mockRejectedValueOnce(Error("dependency"));
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查项", "实例唯一");
  await screen.findByText("检查配置读取失败，请重试；当前不能保存或运行。");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
});

function mockLookup() {
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    rules: [
      { id: "object-lookup-correctness", kind: "objectType", title: "实例定位正确", enabled: true },
    ],
    execution_support: {
      "object-lookup-correctness": {
        status: "supported",
        check: { type: "instance_lookup", binding: "fields" },
      },
    },
  } as unknown as EvalTemplateConfig);
  vi.mocked(previewRuleApplication).mockResolvedValueOnce(
    preview([
      {
        ...row,
        ready_for_save: false,
        prepared_definition: undefined,
        configuration: "incomplete",
        missing: ["独立样本"],
      },
    ]),
  );
}
it("requires independent lookup samples and clears a prepared definition when samples change", async () => {
  mockLookup();
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查项", "实例定位正确");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(1));
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  fireEvent.change(screen.getByLabelText("独立样本（JSON数组）"), {
    target: { value: '[{"id":9007199254740993,"__matches":1},{"id":-1,"__matches":0}]' },
  });
  fireEvent.change(screen.getByLabelText("独立依据（每行一条）"), {
    target: { value: "业务核对表" },
  });
  fireEvent.click(screen.getByRole("button", { name: "校验样本并配置检查" }));
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
  const sample = vi.mocked(previewRuleApplication).mock.calls[1][1].samples![0];
  expect(sample.arguments.evidence_refs).toEqual(["业务核对表"]);
  expect(String((sample.arguments.rows as { id: unknown }[])[0].id)).toBe("9007199254740993");
  fireEvent.change(screen.getByLabelText("独立样本（JSON数组）"), { target: { value: "[]" } });
  expect(onPrepared).toHaveBeenLastCalledWith(undefined);
});
it("ignores a late sample validation response after the sample is changed", async () => {
  mockLookup();
  let resolve!: (value: RuleApplicationPreview) => void;
  vi.mocked(previewRuleApplication)
    .mockReset()
    .mockImplementationOnce(() =>
      Promise.resolve(preview([{ ...row, ready_for_save: false, prepared_definition: undefined }])),
    )
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查项", "实例定位正确");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("独立样本（JSON数组）"), {
    target: { value: '[{"id":1,"__matches":1},{"id":-1,"__matches":0}]' },
  });
  fireEvent.change(screen.getByLabelText("独立依据（每行一条）"), {
    target: { value: "核对记录" },
  });
  fireEvent.click(screen.getByRole("button", { name: "校验样本并配置检查" }));
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByLabelText("独立样本（JSON数组）"), { target: { value: "[]" } });
  await act(() => Promise.resolve(resolve(preview([row]))));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "校验样本并配置检查" })).not.toHaveClass(
      "ant-btn-loading",
    ),
  );
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
});

it("allows a real logical property without an executable source to be authored but not run", async () => {
  const config = await getEvalTemplateConfig("kn-1");
  config.rules.push({
    ...config.rules[1],
    id: "logic-property-call",
    title: "逻辑属性调用及参数正确",
  });
  config.execution_support = {
    ...config.execution_support,
    "logic-property-call": { status: "unsupported", reason: "需要实际调用记录；可先保存定义。" },
  };
  vi.mocked(getEvalTemplateConfig).mockResolvedValue(config);
  vi.mocked(previewRuleApplication).mockResolvedValue(
    preview([
      {
        ...row,
        rule_id: "logic-property-call",
        target_id: "logic-1",
        target_name: "订单 / 利润",
        ready_for_save: false,
        prepared_definition: undefined,
        match: "not_applicable",
        execution: "unsupported",
      },
    ]),
  );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn-1" resource={resource} onPrepared={onPrepared} />);
  await screen.findByRole("combobox", { name: "检查内容" });
  choose("检查内容", "对象属性");
  await waitFor(() => expect(screen.getByRole("combobox", { name: "检查项" })).not.toBeDisabled());
  choose("检查项", "逻辑属性调用及参数正确");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  choose("检查属性", "订单 / 利润");
  fireEvent.change(await screen.findByRole("textbox", { name: "测试步骤与验证目标" }), {
    target: { value: "对独立实例核对利润公式" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "正确值 1" }), { target: { value: "10" } });
  fireEvent.change(screen.getByRole("textbox", { name: "预期依据" }), {
    target: { value: "财务确认表" },
  });
  await waitFor(() =>
    expect(onPrepared).toHaveBeenCalledWith(
      expect.objectContaining({
        execution_spec: expect.objectContaining({ runner: "unbound" }) as unknown,
        diagnostic_spec: expect.objectContaining({
          target_id: "logic-1",
          definition_only: true,
        }) as unknown,
      }),
    ),
  );
});
