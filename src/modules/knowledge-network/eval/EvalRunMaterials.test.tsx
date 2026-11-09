/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeAll, afterEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { EvalCaseResult } from "./EvalCaseResult";
import { EvalRunMaterials } from "./EvalRunMaterials";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { evalLocales } from "./locales";
import * as service from "./m0-run.service";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
afterEach(() => vi.restoreAllMocks());
const detail: service.M0CaseDetail = {
  id: "case-run-frozen",
  case_id: "case",
  case_title: "API 查询",
  case_version_id: "case-version-1",
  case_version: 1,
  execution_status: "completed",
  quality_outcome: "fail",
  result_revision: 2,
  duration_ms: 2034,
  input_spec: { question: "查询 id=1", arguments: { id: 1 } },
  target_snapshot: { runner: "direct_capability", capability: { name: "qa_get_post" } },
  observation: {
    normalized_output: { execution_error: "MCP tool error execute_tool {}" },
    source_verified: false,
    evidence_status: "partial",
  },
  assertions: [
    {
      id: "equals-1",
      type: "equals",
      outcome: "fail",
      message: "required output field is missing",
    },
  ],
  findings: [{ id: "finding-1", category: "EVIDENCE", title: "Missing receipt" }],
  evidence_refs: { operation_id: "op-frozen", receipt_id: "receipt-frozen" },
};
const run: service.M0Run = {
  id: "run-frozen",
  runner_type: "per_case",
  scope: { kind: "cases", case_ids: ["case"] },
  execution_status: "completed",
  quality_outcome: "pass",
  phase: null,
  progress: { completed_cases: 1, planned_cases: 1 },
  created_at: "2026-11-04T12:59:03Z",
  result_revision: 9,
};
const definition: service.EvalSuiteCaseDetail = {
  case_id: "case",
  archived: false,
  gold_visible: true,
  source: {},
  definition: {
    title: "本次冻结标题",
    category: "fact",
    risk_level: "medium",
    input_spec: detail.input_spec!,
    execution_spec: { runner: "direct_capability" },
    diagnostic_spec: { note: "冻结的规则说明" },
    assertions: [{ id: "equals-1", type: "equals", path: "$.id", expected_path: "$.id" }],
    expected_spec: { id: 1 },
    expected_source: { kind: "independent_sample", evidence_refs: ["document-frozen"] },
  },
};

it("keeps original materials collapsed behind four groups and preserves the exact execution snapshot", async () => {
  const reader = vi.spyOn(service, "getEvalCaseDefinition").mockResolvedValue(definition);
  render(<EvalCaseResult networkId="kn" run={run} detail={detail} onEvidence={vi.fn()} />);
  await screen.findByRole("row", { name: /\$\.id/ });
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  expect(screen.getByRole("region", { name: "执行概况" })).toBeVisible();
  const raw = screen.getByRole("region", { name: "原始材料" });
  expect(within(raw).getByRole("button", { name: /原始材料/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(within(raw).queryByText(/run-frozen/, { selector: "pre" })).toBeNull();
  fireEvent.click(within(raw).getByRole("button", { name: /原始材料/ }));
  const metadata = within(raw).getByRole("region", { name: "运行与版本信息" });
  const json = within(metadata).getByText(/run-frozen/, { selector: "pre" }).textContent;
  expect(json).toContain('"result_revision": 2');
  expect(json).toContain('"quality_outcome": "fail"');
  expect(json).toContain("case-version-1");
  expect(within(raw).getByRole("region", { name: "用例与配置快照" })).toHaveTextContent(
    '"arguments"',
  );
  expect(within(raw).getByRole("region", { name: "原始判定记录" })).toHaveTextContent(
    "MCP tool error execute_tool",
  );
  expect(within(raw).getByRole("region", { name: "Trace 引用与标识" })).toHaveTextContent(
    "receipt-frozen",
  );
  expect(
    within(raw)
      .getAllByRole("heading")
      .map((node) => node.textContent),
  ).toEqual(["运行与版本信息", "用例与配置快照", "原始判定记录", "Trace 引用与标识"]);
  expect(reader).toHaveBeenCalledTimes(1);
  expect(reader).toHaveBeenCalledWith("kn", "case", {
    runId: "run-frozen",
    caseRunId: "case-run-frozen",
  });
});

it("keeps protected expected values and references out of every material view", () => {
  const hidden = {
    ...definition,
    gold_visible: false,
    definition: {
      ...definition.definition,
      expected_spec: { answer: "protected-value" },
      expected_source: { kind: "business_expert" as const, evidence_refs: ["protected-reference"] },
    },
  };
  render(<EvalRunMaterials run={run} detail={detail} definition={hidden} onRetry={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /原始材料/ }));
  expect(screen.getByText("预期值受权限保护")).toBeVisible();
  expect(document.body.textContent).not.toContain("protected-value");
  expect(document.body.textContent).not.toContain("protected-reference");
});

it("retries the frozen definition after a read failure, without reading the current case", async () => {
  const reader = vi
    .spyOn(service, "getEvalCaseDefinition")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(definition);
  render(<EvalCaseResult networkId="kn" run={run} detail={detail} onEvidence={vi.fn()} />);
  await screen.findByText("未能读取本次运行的判定标准，请重试。");
  fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
  await waitFor(() => expect(reader).toHaveBeenCalledTimes(2));
  await screen.findByRole("row", { name: /\$\.id/ });
  for (const call of reader.mock.calls)
    expect(call[2]).toEqual({ runId: "run-frozen", caseRunId: "case-run-frozen" });
});

it("isolates late snapshots when switching cases", async () => {
  let resolveOld!: (value: service.EvalSuiteCaseDetail) => void;
  vi.spyOn(service, "getEvalCaseDefinition")
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValue({
      ...definition,
      definition: { ...definition.definition, title: "新用例快照" },
    });
  const view = render(
    <EvalCaseResult networkId="kn" run={run} detail={detail} onEvidence={vi.fn()} />,
  );
  view.rerender(
    <EvalCaseResult
      networkId="kn"
      run={run}
      detail={{ ...detail, id: "new-case-run", case_id: "new-case" }}
      onEvidence={vi.fn()}
    />,
  );
  await screen.findByRole("row", { name: /\$\.id/ });
  resolveOld(definition);
  fireEvent.click(screen.getByRole("tab", { name: "执行详情" }));
  fireEvent.click(screen.getByRole("button", { name: /原始材料/ }));
  expect(await screen.findByText(/新用例快照/, { selector: "pre" })).toBeTruthy();
  expect(screen.queryByText(/本次冻结标题/, { selector: "pre" })).toBeNull();
});

it("uses one evidence renderer with credential redaction and exact numeric values", () => {
  const content = parsePrecisionPreservingJSON(
    '{"large":900719925474099312345,"amount":0,"allowed":false,"token":"private-token","nested":{"Authorization":"Bearer private-auth"},"error":"request failed: Bearer private-value","endpoint":"https://user:pass@example.test/path"}',
  );
  render(<EvalEvidenceContent id="observation" content={content} />);
  const json = screen.getByText(/900719925474099312345/, { selector: "pre" }).textContent;
  expect(json).toContain('"amount": 0');
  expect(json).toContain('"allowed": false');
  expect(json).toContain("[REDACTED]");
  for (const secret of ["private-token", "private-auth", "private-value", "user:pass"])
    expect(json).not.toContain(secret);
});

it("shows the executed definition and expected references separately from actual results", () => {
  render(<EvalRunMaterials run={run} detail={detail} definition={definition} onRetry={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /原始材料/ }));
  expect(screen.getByText(/本次冻结标题/, { selector: "pre" })).toBeTruthy();
  expect(screen.getByText(/required output field is missing/, { selector: "pre" })).toBeTruthy();
  expect(screen.getByText(/expected_path/, { selector: "pre" })).toBeTruthy();
  expect(screen.getByText(/document-frozen/, { selector: "pre" })).toBeTruthy();
});

it("omits empty raw groups without hiding snapshot read failures", () => {
  render(
    <EvalRunMaterials
      detail={{
        ...detail,
        input_spec: undefined,
        target_snapshot: undefined,
        observation: undefined,
        evidence_refs: undefined,
        assertions: [],
        findings: [],
      }}
      failed
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: /原始材料/ })).toHaveTextContent("部分材料读取失败");
  fireEvent.click(screen.getByRole("button", { name: /原始材料/ }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Trace 引用与标识" })).toBeNull();
  expect(screen.queryByRole("region", { name: "原始判定记录" })).toBeNull();
});
