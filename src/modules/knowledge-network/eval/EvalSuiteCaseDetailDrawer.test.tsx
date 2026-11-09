/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalSuiteCaseDetailDrawer } from "./EvalSuiteCaseDetailDrawer";
import {
  getEvalCaseDefinition,
  getEvalSuiteCaseDetail,
  type EvalSuiteCaseDetail,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  getEvalCaseDefinition: vi.fn(),
  getEvalSuiteCaseDetail: vi.fn(),
}));
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
const fixture = (): EvalSuiteCaseDetail => ({
  case_id: "case-1",
  archived: false,
  gold_visible: true,
  source: { type: "manual", rule_title: "来源中的规则" },
  definition: {
    title: "退款检查",
    category: "fact",
    risk_level: "medium",
    input_spec: {
      question: "检查退款金额",
      arguments: { id: 3 },
      check_scope: { mode: "invocation" },
    },
    execution_spec: {
      runner: "direct_capability",
      target: { resource_id: "refund", name: "退款" },
    },
    assertions: [
      { id: "amount", type: "numeric_range", path: "$.amount", expected_path: "$.criteria.range" },
    ],
    expected_spec: { criteria: { range: { min: 0, max: 100, include_max: false } } },
    expected_source: { kind: "business_expert", evidence_refs: ["验收工单-42"] },
    diagnostic_spec: { case_type: "security", note: "核对退款权限" },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEvalCaseDefinition).mockResolvedValue(fixture());
  vi.mocked(getEvalSuiteCaseDetail).mockResolvedValue(fixture());
});

it("shows the same complete current definition in library and Suite details", async () => {
  const { rerender } = render(
    <EvalSuiteCaseDetailDrawer networkId="kn" caseId="case-1" onClose={vi.fn()} />,
  );
  await screen.findAllByText("退款检查");
  for (const value of [
    "安全测试",
    "本次输入",
    "来源中的规则",
    "验收工单-42",
    "核对退款权限",
    "[0, 100)",
  ])
    expect(screen.getByText(value)).toBeTruthy();
  expect(screen.queryByText(/NaN/)).toBeNull();
  expect(screen.queryByText(/value_0/)).toBeNull();
  rerender(
    <EvalSuiteCaseDetailDrawer
      networkId="kn"
      suiteId="suite"
      suiteVersion={2}
      caseId="case-1"
      onClose={vi.fn()}
    />,
  );
  await screen.findByText(/此处展示用例当前内容/);
  expect(await screen.findByText("[0, 100)")).toBeTruthy();
  expect(getEvalSuiteCaseDetail).toHaveBeenCalledWith("kn", "suite", 2, "case-1");
});

it("keeps protected expected values hidden while retaining criteria and inputs", async () => {
  const detail = fixture();
  detail.gold_visible = false;
  detail.definition.expected_spec = null;
  vi.mocked(getEvalCaseDefinition).mockResolvedValue(detail);
  render(<EvalSuiteCaseDetailDrawer networkId="kn" caseId="case-1" onClose={vi.fn()} />);
  await screen.findAllByText("退款检查");
  expect(screen.getByText("预期结果受权限保护，需用例管理权限才能查看。")).toBeTruthy();
  const row = screen.getByRole("row", { name: /\$\.amount.*数值范围/ });
  expect(within(row).getByText("预期值受权限保护")).toBeTruthy();
  expect(screen.queryByText("[0, 100)")).toBeNull();
});

it("resolves associated rules from diagnostic provenance and renders missing sampling limits safely", async () => {
  const detail = fixture();
  detail.source = {};
  detail.definition.diagnostic_spec.template_rule_title = "诊断中的规则";
  detail.definition.input_spec.check_scope = { mode: "sample" };
  vi.mocked(getEvalCaseDefinition).mockResolvedValue(detail);
  render(<EvalSuiteCaseDetailDrawer networkId="kn" caseId="case-1" onClose={vi.fn()} />);
  expect(await screen.findByText("诊断中的规则")).toBeTruthy();
  expect(screen.getByText("采样检查")).toBeTruthy();
  expect(screen.queryByText(/NaN/)).toBeNull();
});
