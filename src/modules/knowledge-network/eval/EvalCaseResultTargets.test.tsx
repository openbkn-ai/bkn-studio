/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { EvalCaseResult } from "./EvalCaseResult";
import { evalLocales } from "./locales";
import type { M0CaseDetail } from "./m0-run.service";
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi
    .fn()
    .mockReturnValue({ addEventListener: vi.fn(), removeEventListener: vi.fn(), matches: false }),
});
const fixture = (): M0CaseDetail => ({
  id: "r",
  case_id: "c",
  case_title: "库存",
  case_version_id: "v1",
  execution_status: "completed",
  quality_outcome: "pass",
  duration_ms: 100,
  assertions: [],
  findings: [],
  input_spec: { question: "查看库存", arguments: {} },
  target_snapshot: {
    runner: "direct",
    capability: { name: "query_stock", metadata_type: "function" },
  },
});
it("uses the frozen assessment resource and labels the executing function separately", () => {
  const detail = fixture();
  detail.assessment_target = {
    kind: "resource",
    resources: [{ resource_id: "product", resource_kind: "objectType", name: "产品" }],
  };
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  const info = screen.getByRole("region", { name: "评测信息" });
  expect(within(info).getByText("评测对象")).toBeTruthy();
  expect(within(info).getByText("产品")).toBeTruthy();
  expect(within(info).getByText("执行函数")).toBeTruthy();
  expect(within(info).getByText("query_stock")).toBeTruthy();
  expect(within(info).getByText("未关联规则")).toBeTruthy();
  expect(screen.queryByText("检查对象")).toBeNull();
});
it("does not invent a tested resource from an old function execution snapshot", () => {
  render(<EvalCaseResult detail={fixture()} onEvidence={vi.fn()} />);
  expect(screen.getByText("未记录评测对象")).toBeTruthy();
  expect(screen.getByText("query_stock")).toBeTruthy();
});
it("keeps a scenario unbound even when it has an executing capability", () => {
  const detail = fixture();
  detail.assessment_target = { kind: "business_scenario", resources: [] };
  render(<EvalCaseResult detail={detail} onEvidence={vi.fn()} />);
  expect(screen.getByText("业务场景（不绑定单一评测对象）")).toBeTruthy();
  expect(screen.getByText("query_stock")).toBeTruthy();
});
