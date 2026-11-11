/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import * as definitionService from "./m0-run.service";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { EvalCaseResult } from "./EvalCaseResult";
import { evalLocales } from "./locales";
import type { M0CaseDetail } from "./m0-run.service";

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});
it("explains when the invoking user has no masked result without claiming a pass or missing data", () => {
  const detail = fixture();
  detail.quality_outcome = "inconclusive";
  detail.observation = {
    source_verified: true,
    failure_class: "MASK_NOT_APPLICABLE",
    normalized_output: { violations: 0 },
    query_summary: { scope: { mode: "sample", limit: 100 }, checked_rows: 0, violations: 0 },
  };
  render(<EvalCaseResult networkId="kn" runId="run" detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByText(/当前运行用户未获得该属性的脱敏读取结果/)).toBeTruthy();
  expect(screen.queryByText("本次未获得可检查的数据，无法判定是否符合要求。")).toBeNull();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("zh-CN");
});

it("pairs each frozen criterion with its own actual field and expected condition", async () => {
  const definition: definitionService.EvalSuiteCaseDetail = {
    case_id: "case",
    archived: false,
    gold_visible: true,
    source: {},
    definition: {
      title: "Old run definition",
      category: "fact",
      risk_level: "medium",
      input_spec: {},
      execution_spec: { runner: "direct_capability" },
      diagnostic_spec: {},
      expected_source: { kind: "business_expert", evidence_refs: [] },
      assertions: [
        {
          id: "amount",
          type: "numeric_range",
          path: "$.amount",
          expected_path: "$.criteria.amount",
        },
        { id: "allowed", type: "equals", path: "$.allowed", expected_path: "$.criteria.allowed" },
      ],
      expected_spec: { criteria: { amount: { min: 0, max: 10 }, allowed: false } },
    },
  };
  const reader = vi.spyOn(definitionService, "getEvalCaseDefinition").mockResolvedValue(definition);
  const detail = fixture();
  detail.target_snapshot = { runner: "direct_capability" };
  detail.observation = { source_verified: true, normalized_output: { amount: 0, allowed: false } };
  detail.assertions = [
    { id: "amount", type: "numeric_range", outcome: "pass" },
    { id: "allowed", type: "equals", outcome: "pass" },
  ];
  render(<EvalCaseResult networkId="kn" runId="old-run" detail={detail} onEvidence={vi.fn()} />);
  const range = await screen.findByRole("row", { name: /\$\.amount.*\[0, 10\]/ });
  expect(within(range).getByText("0")).toBeTruthy();
  const bool = screen.getByRole("row", { name: /\$\.allowed.*false/ });
  expect(within(bool).getByText("false")).toBeTruthy();
  expect(reader).toHaveBeenCalledWith("kn", "case", { runId: "old-run", caseRunId: "case-run" });
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    matches: false,
  })),
});
function fixture(): M0CaseDetail {
  return {
    id: "case-run",
    case_id: "case",
    case_title: "物料主键唯一",
    case_version_id: "v2",
    case_version: 2,
    execution_status: "completed",
    quality_outcome: "pass",
    duration_ms: 1234,
    input_spec: { question: "Check material keys", arguments: {} },
    target_snapshot: {
      runner: "object_data_check",
      object_data: {
        rule_id: "object-key-uniqueness",
        rule_revision: 1,
        primary_keys: ["material_code"],
      },
      capability: { name: "物料" },
    },
    observation: {
      source_verified: true,
      source_kind: "object_data_check",
      normalized_output: { violations: 0 },
      query_summary: {
        scope: { mode: "sample", limit: 100 },
        checked_rows: 100,
        total_count: 3497,
        violations: 0,
        primary_keys: ["material_code"],
      },
      evidence_status: "complete",
    },
    assertions: [
      { id: "expected-output", type: "equals", outcome: "pass" },
      { id: "execution-evidence", type: "evidence_complete", outcome: "pass" },
    ],
    findings: [],
  };
}

it("keeps resource availability separate from business correctness and row sampling", () => {
  const detail = fixture();
  detail.target_snapshot = {
    runner: "resource_query",
    capability: { name: "GMV", operation: "query_metric" },
  };
  detail.observation = {
    source_verified: true,
    source_kind: "resource_query",
    normalized_output: { available: true, result: { entries: [{ value: 100 }] } },
    resource_query_summary: {
      resource_kind: "metric",
      resource_id: "gmv",
      scope: { mode: "invocation" },
    },
    evidence_status: "complete",
  };
  detail.assertions = [
    { id: "availability", type: "json_schema", outcome: "pass" },
    { id: "execution-evidence", type: "evidence_complete", outcome: "pass" },
  ];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(
    screen.getByText("此用例检查本次调用是否可用；业务结果正确性需通过独立样本另行验证。"),
  ).toBeTruthy();
  expect(screen.queryByText(/检查统计不完整/)).toBeNull();
  expect(screen.queryByText(/采样检查通过/)).toBeNull();
});

it("shows the recorded resource invocation error without inventing a data conclusion", () => {
  const detail = fixture();
  detail.quality_outcome = "inconclusive";
  detail.target_snapshot = { runner: "resource_query", capability: { name: "API" } };
  detail.observation = {
    source_verified: false,
    source_kind: "resource_query",
    resource_query_summary: {
      resource_kind: "api",
      resource_id: "api",
      scope: { mode: "invocation" },
      execution_error: "来源接口返回非成功 HTTP 状态。",
    },
    evidence_status: "unavailable",
  };
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByRole("region", { name: "本次用例结论" })).toHaveTextContent(
    "来源接口返回非成功 HTTP 状态。",
  );
  expect(screen.queryByText(/未发现违规/)).toBeNull();
});

it("shows sample criteria and actual values without exposing technical identifiers by default", async () => {
  render(<EvalCaseResult detail={fixture()} onEvidence={vi.fn()} />);
  expect(screen.getByText("采样检查通过")).toBeTruthy();
  expect(screen.getByText("material_code")).toBeTruthy();
  expect(screen.queryByText("v2")).toBeNull();
  const check = screen.getByRole("row", { name: /主键唯一性检查.*违规数为 0/ });
  expect(within(check).getByText("违规 0 条")).toBeTruthy();
  expect(screen.getByText("结论仅适用于本次样本，不代表全量数据通过。")).toBeTruthy();
  expect(screen.queryByText(/expected-output/)).toBeNull();
  expect(screen.queryByText("输入参数")).toBeNull();
  await act(() => {
    fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));

    return Promise.resolve();
  });
  fireEvent.click(await screen.findByRole("button", { name: /原始材料/ }));
  const snapshot = await screen.findByRole("region", { name: "用例与配置快照" });
  expect(within(snapshot).getByText(/Check material keys/)).toBeTruthy();
});

it("summarizes the actual sample, named field and rule without guessing a declared type", () => {
  const detail = fixture();
  detail.input_spec = { ...detail.input_spec, template_rule_title: "属性值类型一致" };
  detail.target_snapshot!.object_data!.rule_id = "property-type";
  detail.observation!.query_summary!.check_fields = ["entry_id"];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const conclusion = screen.getByRole("region", { name: "本次用例结论" });
  expect(conclusion).toHaveTextContent(
    "本次从「物料」的3497条可见记录中抽查100条，按「属性值类型一致」检查字段「entry_id」，未发现违规。",
  );
  expect(conclusion).toHaveTextContent("结论仅适用于本次样本，不代表全量数据通过。");
  expect(conclusion).not.toHaveTextContent("integer");
});
it("summarizes a sample without inventing a missing visible total", () => {
  const detail = fixture();
  detail.observation!.query_summary!.total_count = undefined;
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByRole("region", { name: "本次用例结论" })).toHaveTextContent(
    "本次抽查「物料」的100条记录",
  );
});
it.each(["source", "evidence", "statistics"])(
  "does not invent a successful data summary when %s is unreliable",
  (missing) => {
    const detail = fixture();
    if (missing === "source") detail.observation!.source_verified = false;
    if (missing === "evidence") detail.observation!.evidence_status = "unavailable";
    if (missing === "statistics") detail.observation!.query_summary!.violations = Number.NaN;
    render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
    const conclusion = screen.getByRole("region", { name: "本次用例结论" });
    expect(conclusion).not.toHaveTextContent("未发现违规");
    expect(conclusion).not.toHaveTextContent("抽查100条");
    expect(conclusion).toHaveTextContent(
      missing === "source"
        ? "尚无可信的实际输出"
        : missing === "evidence"
          ? "缺少完整执行证据"
          : "检查统计不完整",
    );
  },
);
it("keeps zero data violations distinct from a failed case criterion", () => {
  const detail = fixture();
  detail.quality_outcome = "fail";
  detail.assertions[0].outcome = "fail";
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByRole("region", { name: "本次用例结论" })).toHaveTextContent(
    "未发现违规。本次用例仍未通过，具体原因见判定明细。",
  );
});
it("reports observed violations even when a negative test is expected to pass", () => {
  const detail = fixture();
  detail.observation!.query_summary!.violations = 2;
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const conclusion = screen.getByRole("region", { name: "本次用例结论" });
  expect(conclusion).toHaveTextContent("发现2条违规。");
  expect(conclusion).not.toHaveTextContent("未发现违规");
});
it("summarizes runtime criteria using readable names rather than assertion identifiers", () => {
  const detail = fixture();
  detail.target_snapshot = { runner: "direct_capability" };
  detail.observation!.query_summary = undefined;
  detail.quality_outcome = "fail";
  detail.assertions[0].outcome = "fail";
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const conclusion = screen.getByRole("region", { name: "本次用例结论" });
  expect(conclusion).toHaveTextContent("本次执行已完成：1项判定通过，1项未通过，0项无法判定。");
  expect(conclusion).toHaveTextContent("未通过的判定项：业务结果一致性。");
  expect(conclusion).not.toHaveTextContent("expected-output");
});
it("shows violations and explicitly identifies unavailable examples", () => {
  const detail = fixture();
  detail.quality_outcome = "fail";
  detail.observation!.query_summary!.violations = 2;
  detail.observation!.normalized_output = { violations: 2 };
  detail.assertions[0].outcome = "fail";
  detail.assertions[0].message = "observed value differs from independent expectation";
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByText("违规 2 条")).toBeTruthy();
  expect(screen.getByText("本次结果仅保存了违规数量，未保存可定位的违规样例。")).toBeTruthy();
  expect(screen.queryByText("observed value differs from independent expectation")).toBeNull();
  expect(screen.getByRole("region", { name: "本次用例结论" })).toHaveTextContent("发现2条违规。");
});

it("does not present an empty query as a successful zero-violation check", () => {
  const detail = fixture();
  detail.quality_outcome = "inconclusive";
  detail.observation!.failure_class = "NO_DATA";
  detail.observation!.query_summary!.checked_rows = 0;
  detail.assertions.forEach((a) => (a.outcome = "inconclusive"));
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const summary = screen.getByRole("region", { name: "本次用例结论" });
  expect(within(summary).getByText("本次未获得可检查的数据，无法判定是否符合要求。")).toBeTruthy();
  expect(screen.queryByText("违规 0 条")).toBeNull();
  expect(screen.queryByText("采样检查通过")).toBeNull();
});

it("shows the recorded permission failure without inventing remediation and links evidence", () => {
  const detail = fixture();
  detail.quality_outcome = "inconclusive";
  detail.observation!.failure_class = "PERMISSION";
  detail.observation!.source_verified = false;
  detail.observation!.evidence_status = "unavailable";
  detail.observation!.query_summary = undefined;
  detail.target_snapshot!.object_data!.scope = { mode: "sample", limit: 100 };
  const evidence = vi.fn();
  render(<EvalCaseResult detail={detail} onEvidence={evidence} />);
  expect(screen.queryByText("确认执行账号具备该对象及所需字段的读取权限。")).toBeNull();
  expect(screen.queryByText("建议处理")).toBeNull();
  expect(screen.getByText("采样检查")).toBeTruthy();
  expect(screen.getByText("暂无可判定的实际结果")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看执行详情" }));
  expect(evidence).toHaveBeenCalledOnce();
});

it("renders human review assertion states without turning them into a dash", () => {
  const detail = fixture();
  detail.quality_outcome = "review_required";
  detail.assertions = [
    {
      id: "manual-business",
      type: "manual_review",
      outcome: "pending_review",
      message: "human business decision is required",
    },
  ];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByRole("row", { name: /业务判断.*需人工判断/ })).toBeTruthy();
  expect(screen.queryByText("建议处理")).toBeNull();
});

it("keeps full-data conclusions distinct and supports English copy", async () => {
  await i18n.changeLanguage("en-US");
  const detail = fixture();
  detail.observation!.query_summary!.scope = { mode: "all" };
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(
    screen.getByText("This conclusion covers data visible to the requester in this query."),
  ).toBeTruthy();
  expect(screen.getAllByText("Primary-key uniqueness").length).toBeGreaterThan(0);
  expect(screen.queryByText("Sample checks passed")).toBeNull();
});

it("keeps short assessment metadata paired and gives long input a complete row", () => {
  const detail = fixture();
  detail.assessment_target = {
    kind: "resource",
    resources: [{ resource_id: "purchase", resource_kind: "objectType", name: "采购订单" }],
  };
  detail.input_spec = {
    question: "检查采购订单字段类型，返回违规数量、具体字段和记录主键。",
    template_rule_title: "属性值类型一致",
  };
  detail.target_snapshot!.object_data!.rule_id = "property-type";
  detail.observation!.query_summary!.check_fields = ["entry_id"];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const info = screen.getByRole("region", { name: "评测信息" });
  const objectRow = within(info).getByText("评测对象").closest("tr")!;
  expect(objectRow.cells).toHaveLength(4);
  expect(objectRow).toHaveTextContent("采购订单");
  expect(objectRow).toHaveTextContent("属性值类型一致");
  const inputRow = within(info).getByText("测试输入").closest("tr")!;
  expect(inputRow.cells).toHaveLength(2);
  expect(inputRow.cells[1].colSpan).toBe(3);
  expect(inputRow).toHaveTextContent(detail.input_spec.question as string);
  const checkTargetRow = within(info).getByText("检查目标").closest("tr")!;
  expect(checkTargetRow.cells).toHaveLength(2);
  expect(checkTargetRow).toHaveTextContent("entry_id");
});

it("does not reserve empty suite fields for legacy per-case run metadata", () => {
  render(
    <EvalCaseResult
      detail={fixture()}
      onEvidence={vi.fn()}
      run={{
        id: "run",
        runner_type: "per_case",
        scope: { kind: "cases", suite_id: "", version: 0 },
        execution_status: "completed",
        phase: null,
        quality_outcome: "pass",
        progress: { planned_cases: 1, completed_cases: 1 },
      }}
    />,
  );
  const info = screen.getByRole("region", { name: "评测信息" });
  expect(within(info).queryByText("本次测试集版本")).toBeNull();
  for (const cell of info.querySelectorAll(".ant-descriptions-item-content"))
    expect(cell.textContent?.trim()).not.toBe("");
});

it("keeps execution errors and assertion explanations readable in the same result column", () => {
  const detail = fixture();
  const error = "MCP tool error execute_tool {}";
  detail.quality_outcome = "fail";
  detail.target_snapshot = { capability: { name: "测试 MCP" } };
  detail.observation = {
    source_kind: "external_submission",
    source_verified: true,
    normalized_output: { execution_error: error },
    answer: `联调真实结果：${JSON.stringify({ execution_error: error })}`,
    evidence_status: "incomplete",
  };
  detail.assertions = [
    {
      id: "evidence",
      type: "evidence_complete",
      outcome: "inconclusive",
      message: "complete evidence is unavailable",
    },
    { id: "answer", type: "equals", outcome: "fail", message: "required output field is missing" },
  ];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const checks = screen.getByRole("region", { name: "判定明细" });
  expect(
    within(checks)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["判定项", "判定标准", "实际结果", "结果与说明"]);
  const row = within(checks).getByRole("row", { name: /业务结果一致性/ });
  const cells = within(row).getAllByRole("cell");
  expect(cells[2]).toHaveTextContent(`execution_error：${error}`);
  expect(cells[3]).toHaveTextContent("未通过");
  expect(cells[3]).toHaveTextContent("实际输出缺少要求的字段。");
  expect(cells[2]).toHaveAttribute("data-label", "实际结果");
  const evidence = within(checks).getByRole("row", { name: /执行证据完整性/ });
  expect(within(evidence).getAllByRole("cell")[3]).toHaveTextContent("无法判定");
  expect(within(evidence).getAllByRole("cell")[3]).toHaveTextContent("缺少完整执行证据");
});

it("shows precise violation values with their frozen types and record locator", () => {
  const detail = fixture();
  detail.quality_outcome = "fail";
  detail.observation!.normalized_output = { violations: 1 };
  detail.observation!.query_summary!.violations = 1;
  detail.observation!.query_summary!.violation_examples = [
    {
      resource_id: "material",
      resource_name: "物料",
      field: "quantity",
      declared_type: "string",
      actual_type: "number",
      value: "9007199254740993",
      primary_key: { code: "M-001" },
      record_index: 1,
      reason: "type_mismatch",
    },
  ];
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const examples = screen.getByText("违规样例").closest("section");
  expect(examples).toBeTruthy();
  const example = within(examples!).getByRole("row", {
    name: /quantity.*string.*number.*9007199254740993.*M-001/,
  });
  expect(within(example).getByText("quantity")).toBeTruthy();
  expect(screen.queryByText("本次结果仅保存了违规数量，未保存可定位的违规样例。")).toBeNull();
});

it("keeps schema and structured output side by side in bounded, foldable value viewers", async () => {
  const detail = fixture();
  detail.target_snapshot = { runner: "direct_capability" };
  detail.observation = {
    source_verified: true,
    normalized_output: {
      available: true,
      result: { results: [{ title: "结果一" }, { title: "结果二" }] },
    },
  };
  detail.assertions = [{ id: "structure", type: "json_schema", outcome: "fail" }];
  vi.spyOn(definitionService, "getEvalCaseDefinition").mockResolvedValue({
    case_id: "case",
    archived: false,
    gold_visible: true,
    source: {},
    definition: {
      title: "输出结构检查",
      category: "fact",
      risk_level: "medium",
      input_spec: {},
      execution_spec: {},
      diagnostic_spec: {},
      expected_source: { kind: "business_expert", evidence_refs: [] },
      expected_spec: {},
      assertions: [
        {
          id: "structure",
          type: "json_schema",
          path: "$",
          schema: {
            type: "object",
            required: ["result"],
            properties: {
              result: {
                type: "object",
                properties: { results: { type: "array", minItems: 2, maxItems: 2 } },
              },
            },
          },
        },
      ],
    },
  });
  render(<EvalCaseResult networkId="kn" runId="run" detail={detail} onEvidence={vi.fn()} />);
  const standard = await screen.findByLabelText("判定标准");
  const actual = screen.getByLabelText("实际结果");
  const row = actual.closest("tr")!;
  expect(standard.closest("tr")).toBe(row);
  expect(within(row).getAllByRole("cell")).toHaveLength(4);
  expect(within(actual).getByText('"available":')).toBeTruthy();
  expect(within(actual).queryByText('"title":')).toBeNull();
  fireEvent.click(within(actual).getByRole("button", { name: "展开全部" }));
  expect(within(actual).getByText('"结果一"')).toBeTruthy();
  expect(within(standard).queryByText('"minItems":')).toBeNull();
  fireEvent.click(within(standard).getByRole("button", { name: "展开全部" }));
  expect(within(standard).getByText('"minItems":')).toBeTruthy();
  expect(screen.getByRole("separator", { name: "调整判定标准与实际结果宽度" })).toBeTruthy();
});
