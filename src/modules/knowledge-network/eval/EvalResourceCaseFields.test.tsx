/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EvalResourceCaseFields } from "./EvalResourceCaseFields";
import { resourceCaseKinds } from "./rule-check-model";
import { getEvalTemplateConfig, type EvalCaseDefinition } from "./m0-run.service";
import { previewRuleApplication } from "./rule-application.service";
import { compileCriteria } from "./case-form-model";

vi.mock("./m0-run.service", () => ({ getEvalTemplateConfig: vi.fn() }));
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));
vi.mock("./useEvalTranslation", async () => {
  const { evalPart } = await import("./locales/zh-CN");
  return {
    useEvalTranslation: () => ({
      t: (key: string) =>
        key
          .split(".")
          .slice(1)
          .reduce<unknown>(
            (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined),
            evalPart,
          ) ?? key,
    }),
  };
});
let kind = "function";
let mode = "resource_available";
let independentValue = false;
const prepared = (): EvalCaseDefinition => ({
  title: "检查",
  category: "fact",
  risk_level: "medium",
  input_spec: { question: "读取", arguments: {} },
  execution_spec: { runner: kind === "function" ? "direct_capability" : "resource_query" },
  assertions: [],
  expected_spec: {},
  expected_source: { kind: "declared_contract", evidence_refs: ["规则"] },
  diagnostic_spec: { resource_case_form: true },
});
beforeEach(() => {
  kind = "function";
  mode = "resource_available";
  independentValue = false;
  vi.mocked(getEvalTemplateConfig).mockReset();
  vi.mocked(previewRuleApplication).mockReset();
  vi.mocked(getEvalTemplateConfig).mockImplementation(() =>
    Promise.resolve({
      revision: 1,
      checksum: "config",
      rules: [
        {
          id: "rule",
          kind,
          title: "可配置检查",
          group: "查询",
          description: "按当前身份查询",
          appliesWhen: "当前资源",
          evidence: "执行回执",
          planDimensions: [],
          preset: "required",
          enabled: true,
          check: { type: mode, independent_value: independentValue },
        },
      ],
      execution_support: {
        rule: {
          status: "supported",
          reason: "",
          check: { type: mode, independent_value: independentValue },
        },
      },
    } as Awaited<ReturnType<typeof getEvalTemplateConfig>>),
  );
  vi.mocked(previewRuleApplication).mockImplementation((_kn, request) =>
    Promise.resolve({
      page: 1,
      limit: 1,
      total: 1,
      scope_revision: 1,
      entries: [
        {
          key: "row",
          target_key: "target",
          resource: { kind, id: "resource" },
          resource_name: "业务资源",
          target_name: "业务资源",
          target_id: "resource",
          rule_title: "可配置检查",
          execution_reason: "",
          rule_id: "rule",
          rule_checksum: "rule-hash",
          resource_checksum: "resource-hash",
          check: { type: mode, independent_value: independentValue },
          match: "applicable",
          configuration: "complete",
          execution: "ready",
          missing: [],
          sample: {
            target_key: "target",
            sample_id: "default",
            title: "检查",
            question: "读取",
            arguments: {},
            scope: { mode: "invocation" },
            expected: {},
            source_kind: "declared_contract",
            evidence_refs: ["规则"],
          },
          ...(request.samples ? { ready_for_save: true, prepared_definition: prepared() } : {}),
        },
      ],
    } as Awaited<ReturnType<typeof previewRuleApplication>>),
  );
});

it.each(resourceCaseKinds)(
  "uses the same server-prepared definition for %s",
  async (resourceKind) => {
    kind = resourceKind;
    const onPrepared = vi.fn();
    render(
      <EvalResourceCaseFields
        networkId="kn"
        resource={{ kind, id: "resource", name: "业务资源" }}
        contract={{
          rule_based: true,
          available: true,
          runner: kind === "function" ? "direct_capability" : "resource_query",
          input: { type: "object", properties: {} },
        }}
        ruleId="rule"
        onPrepared={onPrepared}
      />,
    );
    await waitFor(() =>
      expect(onPrepared).toHaveBeenCalledWith(
        expect.objectContaining({ diagnostic_spec: { resource_case_form: true } }),
      ),
    );
    const request = vi.mocked(previewRuleApplication).mock.calls.at(-1)![1];
    expect(request.resources).toEqual([{ kind, id: "resource" }]);
    expect(request.samples?.[0].arguments).toEqual({});
    expect(request.samples?.[0].assertions).toBeUndefined();
  },
);

it("starts an unconfigured application row with one criterion and a readable independent source", async () => {
  mode = "resource_result";
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "resource", name: "业务资源" }}
      contract={{ rule_based: true, available: true, input: { type: "object", properties: {} } }}
      initialDefinition={prepared()}
      ruleId="rule"
      onPrepared={vi.fn()}
    />,
  );
  expect(await screen.findByRole("combobox", { name: "如何判断 1" })).toBeTruthy();
  expect(screen.getByText("业务人员独立确认", { exact: true })).toBeTruthy();
});

it("keeps zero, false and independent criteria while changing real source parameters", async () => {
  mode = "resource_result";
  const compiled = compileCriteria([
    {
      id: "value",
      type: "equals",
      path: "$.result",
      value: "0",
      valueType: "number",
      valueProvided: true,
    },
  ]);
  const initial: EvalCaseDefinition = {
    ...prepared(),
    ...compiled,
    input_spec: { question: "回显", arguments: { count: 0, enabled: false } },
    expected_source: { kind: "business_expert", evidence_refs: ["独立核算为零"] },
  };
  const onPrepared = vi.fn();
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "resource", name: "业务资源" }}
      contract={{
        available: true,
        rule_based: true,
        input: {
          type: "object",
          properties: { count: { type: "integer" }, enabled: { type: "boolean" } },
          required: ["count", "enabled"],
        },
      }}
      ruleId="rule"
      initialDefinition={initial}
      onPrepared={onPrepared}
    />,
  );
  await waitFor(() =>
    expect(onPrepared).toHaveBeenCalledWith(expect.objectContaining({ title: "检查" })),
  );
  let sample = vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples![0];
  expect(sample.arguments).toEqual({ count: 0, enabled: false });
  expect(sample.expected).toEqual(compiled.expected_spec);
  expect(sample.assertions).toEqual(compiled.assertions);
  fireEvent.change(screen.getByRole("spinbutton", { name: "count" }), { target: { value: "2" } });
  await waitFor(() =>
    expect(vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples?.[0].arguments).toEqual({
      count: 2,
      enabled: false,
    }),
  );
  sample = vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples![0];
  expect(sample.expected).toEqual(compiled.expected_spec);
  expect(onPrepared).toHaveBeenCalledWith(undefined);
});

it("does not prepare a business value comparison without an independent reference", async () => {
  mode = "resource_result";
  const initial: EvalCaseDefinition = {
    ...prepared(),
    ...compileCriteria([
      { id: "value", type: "equals", path: "$", value: "5", valueType: "number" },
    ]),
    expected_source: { kind: "business_expert", evidence_refs: [] },
  };
  const onPrepared = vi.fn();
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "resource", name: "业务资源" }}
      contract={{ available: true, input: { type: "object", properties: {} } }}
      ruleId="rule"
      initialDefinition={initial}
      onPrepared={onPrepared}
    />,
  );
  await screen.findByRole("textbox", { name: "预期依据" });
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(1));
  expect(onPrepared.mock.calls.every(([d]) => d === undefined)).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "预期依据" }), {
    target: { value: "独立核算为5" },
  });
  await waitFor(() =>
    expect(onPrepared).toHaveBeenCalledWith(expect.objectContaining({ title: "检查" })),
  );
});

it("blocks preparation and hides inputs when the resource execution contract is unavailable", async () => {
  const onPrepared = vi.fn();
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "resource", name: "业务资源" }}
      contract={{
        available: false,
        reason: "当前资源没有执行授权",
        input: { type: "object", properties: { secret: { type: "string" } } },
      }}
      ruleId="rule"
      onPrepared={onPrepared}
    />,
  );
  await screen.findByText("当前资源没有执行授权");
  expect(screen.queryByRole("textbox", { name: "secret" })).not.toBeInTheDocument();
  expect(onPrepared.mock.calls.every(([d]) => d === undefined)).toBe(true);
});

it.each(resourceCaseKinds)(
  "allows an unsupported %s check to be authored without pretending it can execute",
  async (resourceKind) => {
    kind = resourceKind;
    const config = await getEvalTemplateConfig("kn");
    config.rules.push({
      ...config.rules[0],
      id: "not-ready",
      title: "安全边界检查",
      check: undefined,
    });
    config.execution_support = {
      ...config.execution_support,
      "not-ready": {
        status: "unsupported",
        reason: "需要独立身份和拒绝访问证据，尚未支持自动执行。",
      },
    };
    vi.mocked(getEvalTemplateConfig).mockResolvedValue(config);
    const onPrepared = vi.fn();
    render(
      <EvalResourceCaseFields
        networkId="kn"
        resource={{ kind, id: "resource", name: "业务资源" }}
        contract={{ available: false, reason: "当前资源没有执行授权" }}
        ruleId="not-ready"
        initialDefinition={{
          ...prepared(),
          ...compileCriteria([
            {
              id: "error",
              type: "equals",
              path: "$.error",
              value: "缺少编号",
              valueType: "string",
            },
          ]),
          input_spec: { question: "不传编号，检查拒绝原因", arguments: {} },
          expected_source: { kind: "business_expert", evidence_refs: ["接口合同第3节"] },
          diagnostic_spec: { definition_only: true, template_rule_id: "not-ready" },
        }}
        onPrepared={onPrepared}
      />,
    );
    expect(await screen.findByText("可保存用例定义，暂不能自动执行")).toBeInTheDocument();
    await waitFor(() =>
      expect(onPrepared).toHaveBeenCalledWith(
        expect.objectContaining({
          execution_spec: expect.objectContaining({ runner: "unbound" }) as unknown,
        }),
      ),
    );
    expect(previewRuleApplication).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "预期依据" }), { target: { value: "" } });
    await waitFor(() => expect(onPrepared.mock.calls.at(-1)?.[0]).toBeUndefined());
  },
);

it("lets a supported check with missing runtime authorization save an explicit definition", async () => {
  const onPrepared = vi.fn();
  const onDefinitionOnlyChange = vi.fn();
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "resource", name: "业务资源" }}
      contract={{ available: false, reason: "缺少当前来源执行授权" }}
      ruleId="rule"
      onPrepared={onPrepared}
      onDefinitionOnlyChange={onDefinitionOnlyChange}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "先配置用例定义" }));
  expect(onDefinitionOnlyChange).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByRole("textbox", { name: "测试步骤与验证目标" }), {
    target: { value: "授权可用后检查真实调用，不在保存时调用" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "正确值 1" }), {
    target: { value: "独立确认的业务结果" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "预期依据" }), {
    target: { value: "合同第3节" },
  });
  await waitFor(() =>
    expect(onPrepared).toHaveBeenCalledWith(
      expect.objectContaining({
        execution_spec: expect.objectContaining({ runner: "unbound" }) as unknown,
      }),
    ),
  );
});

it.each(["function", "metric"])(
  "requires independently computed values for %s samples",
  async (resourceKind) => {
    kind = resourceKind;
    mode = "resource_result";
    independentValue = true;
    const compiled = compileCriteria([
      { id: "sample", type: "exists", path: "$", value: "", valueType: "string" },
    ]);
    const onPrepared = vi.fn();
    render(
      <EvalResourceCaseFields
        networkId="kn"
        resource={{ kind, id: "resource", name: "业务资源" }}
        contract={{ rule_based: true, available: true, input: { type: "object", properties: {} } }}
        initialDefinition={{ ...prepared(), ...compiled }}
        ruleId="rule"
        onPrepared={onPrepared}
      />,
    );
    expect(
      await screen.findByText(
        "本项必须至少比较一个独立确认的结果值；仅检查存在或返回结构不足以判断结果正确。",
        { exact: true },
      ),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "预期依据" })).toBeTruthy();
    expect(
      screen.getByText(
        resourceKind === "function" ? /本项当前执行合法输入样本/ : /独立明细或依赖结果核算正确值/,
      ),
    ).toBeTruthy();
    expect(onPrepared.mock.calls.every(([definition]) => definition === undefined)).toBe(true);
    expect(
      vi.mocked(previewRuleApplication).mock.calls.every(([, request]) => !request.samples),
    ).toBe(true);
  },
);

it("explains source input validation without claiming target rejection or business correctness", async () => {
  kind = "mcp";
  mode = "input_contract";
  const onPrepared = vi.fn();
  render(
    <EvalResourceCaseFields
      networkId="kn"
      resource={{ kind, id: "tool", name: "加法" }}
      contract={{
        rule_based: true,
        available: true,
        runner: "resource_query",
        input: { type: "object", properties: {} },
      }}
      ruleId="rule"
      onPrepared={onPrepared}
    />,
  );
  await waitFor(() =>
    expect(onPrepared).toHaveBeenCalledWith(
      expect.objectContaining({ diagnostic_spec: { resource_case_form: true } }),
    ),
  );
  expect(screen.getByText(/非法参数会在调用前拦截/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "添加判定标准" })).toBeNull();
  expect(
    vi.mocked(previewRuleApplication).mock.calls.at(-1)![1].samples?.[0].assertions,
  ).toBeUndefined();
});
