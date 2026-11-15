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
import { getKnowledgeNetworkObjectTypeDetail } from "../services/object-type.service";
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
vi.mock("../services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
}));
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
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue(null);
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

it("requires a business standard and prepares the shared data program", async () => {
  const check = { type: "program", binding: "fields", program_input: true };
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    rules: [
      {
        id: "object-business-constraints",
        kind: "objectType",
        title: "实例业务约束符合标准",
        enabled: true,
        check,
      },
    ],
    execution_support: { "object-business-constraints": { status: "supported", check } },
  } as unknown as EvalTemplateConfig);
  const pending = {
    ...row,
    rule_id: "object-business-constraints",
    ready_for_save: false,
    prepared_definition: undefined,
    check,
    configuration: "incomplete",
    execution: "unsupported",
    missing: ["业务标准"],
  } as RuleApplicationRow;
  vi.mocked(previewRuleApplication)
    .mockResolvedValueOnce(preview([pending]))
    .mockResolvedValue(
      preview([{ ...pending, ready_for_save: true, prepared_definition: prepared }]),
    );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查项", "实例业务约束符合标准");
  const button = await screen.findByRole("button", { name: "校验标准并配置检查" });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("业务标准版本"), { target: { value: "customer-v1" } });
  fireEvent.change(screen.getByLabelText("业务标准依据（必填，每行一条）"), {
    target: { value: "policy://customer/v1" },
  });
  fireEvent.change(screen.getByLabelText("检查字段", { selector: "input" }), {
    target: { value: "customer_name" },
  });
  fireEvent.click(button);
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
  const submitted = vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples![0].arguments;
  expect(submitted).toMatchObject({
    program: {
      version: 1,
      standard: { version: "customer-v1", evidence_refs: ["policy://customer/v1"] },
      expect: { conditions: [{ field: "customer_name", operator: "non_empty" }] },
    },
  });
  fireEvent.change(screen.getByLabelText("业务标准版本"), { target: { value: "customer-v2" } });
  expect(onPrepared).toHaveBeenLastCalledWith(undefined);
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
it.each([
  { objectName: "仓库", propertyName: "province_id" },
  { objectName: "仓库", propertyName: "所在省份" },
  { objectName: "国内 / 仓库", propertyName: "地址 / 省份" },
])(
  "shows only the property name for $objectName / $propertyName",
  async ({ objectName, propertyName }) => {
    const targetName = `${objectName} / ${propertyName}`;
    vi.mocked(previewRuleApplication).mockResolvedValue(
      preview([{ ...row, resource_name: objectName, target_name: targetName }]),
    );
    const onPrepared = vi.fn();
    render(
      <EvalObjectCaseFields
        networkId="kn"
        resource={{ ...resource, name: objectName }}
        onPrepared={onPrepared}
      />,
    );
    await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
    choose("检查内容", "对象属性");
    choose("检查项", "属性类型");
    await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
    choose("检查属性", propertyName);
    expect(
      screen.queryByText(targetName, { selector: ".ant-select-item-option-content" }),
    ).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "检查属性" }).closest(".ant-select"),
    ).toHaveTextContent(propertyName);
    expect(onPrepared).toHaveBeenLastCalledWith(prepared);
  },
);

type ObjectDetail = NonNullable<Awaited<ReturnType<typeof getKnowledgeNetworkObjectTypeDetail>>>;

function mockPropertyUniqueness(entries: RuleApplicationRow[]) {
  vi.mocked(getEvalTemplateConfig).mockResolvedValue({
    rules: [
      {
        id: "property-unique",
        kind: "objectProperty",
        title: "属性值唯一",
        origin: "builtin",
        enabled: true,
        check: { type: "unique", binding: "property" },
        appliesWhen: "属性明确设置了唯一约束",
      },
    ],
    execution_support: { "property-unique": { status: "supported" } },
  } as unknown as EvalTemplateConfig);
  vi.mocked(previewRuleApplication).mockResolvedValue(preview(entries));
}

it("lets users select an inapplicable property and explains it only after selection", async () => {
  mockPropertyUniqueness([
    {
      ...row,
      target_name: "订单 / contact_person",
      ready_for_save: false,
      prepared_definition: undefined,
      match: "not_applicable",
      match_reason: "当前资源不满足规则适用条件。",
    },
  ]);
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue(
    propertyDetail([{ name: "contact_person", displayName: "联系人" }]),
  );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性值唯一");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  expect(screen.queryByText("尚未具备完整运行条件")).toBeNull();
  expect(screen.queryByRole("button", { name: "先配置用例定义" })).toBeNull();
  choose("检查属性", "联系人");
  expect(
    screen.getByRole("combobox", { name: "检查属性" }).closest(".ant-select"),
  ).toHaveTextContent("联系人");
  expect(screen.getByRole("alert")).toHaveTextContent("属性明确设置了唯一约束");
  expect(screen.getByRole("alert")).toHaveTextContent("联系人");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
  fireEvent.click(screen.getByRole("button", { name: "先配置用例定义" }));
  expect(await screen.findByRole("textbox", { name: "测试步骤与验证目标" })).toBeVisible();
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
});

it("reports the selected blocked property even if another property can execute", async () => {
  mockPropertyUniqueness([
    row,
    {
      ...row,
      target_key: "blocked",
      target_name: "订单 / 联系人",
      ready_for_save: false,
      prepared_definition: prepared,
      match: "unverified",
      match_reason: "无法读取此属性的约束声明",
    },
  ]);
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性值唯一");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  choose("检查属性", "联系人");
  expect(
    screen.getByRole("combobox", { name: "检查属性" }).closest(".ant-select"),
  ).toHaveTextContent("联系人");
  expect(screen.getByRole("alert")).toHaveTextContent("无法读取此属性的约束声明");
  expect(onPrepared).toHaveBeenLastCalledWith(undefined);
  choose("检查属性", "订单号");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(onPrepared).toHaveBeenLastCalledWith(prepared);
});

it.each(["excluded", "disabled"] as const)("keeps %s properties unavailable", async (match) => {
  mockPropertyUniqueness([
    { ...row, match, ready_for_save: false, prepared_definition: undefined },
  ]);
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性值唯一");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "检查属性" }));
  expect(
    screen
      .getByText("订单号", { selector: ".ant-select-item-option-content" })
      .closest(".ant-select-item-option"),
  ).toHaveClass("ant-select-item-option-disabled");
  expect(onPrepared).not.toHaveBeenCalledWith(prepared);
});

function propertyDetail(properties: Array<{ name: string; displayName: string }>) {
  return { dataProperties: properties, logicProperties: [] } as unknown as ObjectDetail;
}

it.each([
  { displayName: "详细地址", label: "详细地址" },
  { displayName: "   ", label: "detail_address" },
])("uses the business name with a field-name fallback ($label)", async ({ displayName, label }) => {
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue(
    propertyDetail([{ name: "detail_address", displayName }]),
  );
  vi.mocked(previewRuleApplication).mockResolvedValue(
    preview([{ ...row, target_name: "订单 / detail_address" }]),
  );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  choose("检查属性", label);
  expect(
    screen.getByRole("combobox", { name: "检查属性" }).closest(".ant-select"),
  ).toHaveTextContent(label);
  expect(onPrepared).toHaveBeenLastCalledWith(prepared);
});

it("retains usable preview fields if the optional display-name lookup fails", async () => {
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockRejectedValue(Error("unavailable"));
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  choose("检查属性", "订单号");
  expect(onPrepared).toHaveBeenLastCalledWith(prepared);
});

it("searches business names while selecting the server's original check target", async () => {
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue(
    propertyDetail([{ name: "contact_phone", displayName: "联系电话" }]),
  );
  vi.mocked(previewRuleApplication).mockImplementation((_network, request) =>
    Promise.resolve(
      preview(
        request.q === "contact_phone" ? [{ ...row, target_name: "订单 / contact_phone" }] : [],
      ),
    ),
  );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  const select = screen.getByRole("combobox", { name: "检查属性" });
  fireEvent.change(select, { target: { value: "联系电话" } });
  await waitFor(() =>
    expect(previewRuleApplication).toHaveBeenLastCalledWith(
      "kn",
      expect.objectContaining({ q: "contact_phone" }),
    ),
  );
  choose("检查属性", "联系电话");
  expect(onPrepared).toHaveBeenLastCalledWith(prepared);
});

it("finds matching business names beyond the first preview page", async () => {
  const secondDefinition = { ...prepared, title: "备用电话检查" };
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue(
    propertyDetail([
      { name: "contact_phone", displayName: "联系电话" },
      { name: "backup_phone", displayName: "备用电话" },
    ]),
  );
  const first = { ...row, target_name: "订单 / contact_phone" };
  const second = {
    ...row,
    target_key: "target-2",
    target_id: "backup-phone-target",
    target_name: "订单 / backup_phone",
    prepared_definition: secondDefinition,
  };
  const other = Array.from({ length: 99 }, (_, i) => ({
    ...row,
    target_key: `other-${i}`,
    target_name: `订单 / other_${i}`,
  }));
  vi.mocked(previewRuleApplication).mockImplementation((_network, request) =>
    Promise.resolve({
      ...preview(request.page === 2 ? [second] : [first, ...other]),
      total: 101,
      page: request.page ?? 1,
    }),
  );
  const onPrepared = vi.fn();
  render(<EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />);
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  fireEvent.change(screen.getByRole("combobox", { name: "检查属性" }), {
    target: { value: "电话" },
  });
  await waitFor(() =>
    expect(previewRuleApplication).toHaveBeenLastCalledWith(
      "kn",
      expect.objectContaining({ page: 2 }),
    ),
  );
  choose("检查属性", "备用电话");
  expect(onPrepared).toHaveBeenLastCalledWith(secondDefinition);
});

it("ignores display names returned for a previously selected object", async () => {
  let resolveOld!: (detail: ObjectDetail) => void;
  vi.mocked(getKnowledgeNetworkObjectTypeDetail)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(propertyDetail([{ name: "detail_address", displayName: "新地址" }]));
  vi.mocked(previewRuleApplication).mockResolvedValue(
    preview([{ ...row, resource_name: "产品", target_name: "产品 / detail_address" }]),
  );
  const onPrepared = vi.fn();
  const view = render(
    <EvalObjectCaseFields networkId="kn" resource={resource} onPrepared={onPrepared} />,
  );
  await waitFor(() => expect(getEvalTemplateConfig).toHaveBeenCalled());
  choose("检查内容", "对象属性");
  await waitFor(() => expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledTimes(1));
  view.rerender(
    <EvalObjectCaseFields
      networkId="kn"
      resource={{ ...resource, id: "product", name: "产品" }}
      onPrepared={onPrepared}
    />,
  );
  await waitFor(() => expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveOld(propertyDetail([{ name: "detail_address", displayName: "旧地址" }]));
    await Promise.resolve();
  });
  choose("检查项", "属性类型");
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalled());
  choose("检查属性", "新地址");
  expect(screen.queryByText("旧地址", { selector: ".ant-select-item-option-content" })).toBeNull();
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
it.each([true, false])(
  "requires independent lookup rows with optional notes (%s)",
  async (includeNotes) => {
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
    if (includeNotes)
      fireEvent.change(screen.getByLabelText("独立依据（选填，每行一条）"), {
        target: { value: "业务核对表" },
      });
    fireEvent.click(screen.getByRole("button", { name: "校验样本并配置检查" }));
    await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(prepared));
    const sample = vi.mocked(previewRuleApplication).mock.calls[1][1].samples![0];
    expect(sample.arguments.evidence_refs).toEqual(includeNotes ? ["业务核对表"] : []);
    expect(String((sample.arguments.rows as { id: unknown }[])[0].id)).toBe("9007199254740993");
    fireEvent.change(screen.getByLabelText("独立样本（JSON数组）"), { target: { value: "[]" } });
    expect(onPrepared).toHaveBeenLastCalledWith(undefined);
  },
);
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
  fireEvent.change(screen.getByLabelText("独立依据（选填，每行一条）"), {
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
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue({
    ...propertyDetail([{ name: "profit", displayName: "原始利润" }]),
    logicProperties: [{ name: "profit", displayName: "计算利润" }],
  });
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
        target_name: "订单 / profit",
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
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "检查属性" }));
  fireEvent.click(
    await screen.findByText("计算利润", { selector: ".ant-select-item-option-content" }),
  );
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
