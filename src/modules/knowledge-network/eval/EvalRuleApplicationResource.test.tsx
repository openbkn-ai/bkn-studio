/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalRuleApplicationDrawer } from "./EvalRuleApplicationDrawer";
import { previewRuleApplication } from "./rule-application.service";
import type { EvalTemplateRule } from "./types";
import type { EvalCaseDefinition } from "./m0-run.service";

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

vi.mock("./m0-run.service", () => ({
  listEvalCaseResourcesPage: vi.fn(() =>
    Promise.resolve({
      entries: [{ kind: "function", id: "echo", name: "回显函数" }],
      total: 1,
    }),
  ),
}));
vi.mock("./rule-application.service", () => ({
  previewRuleApplication: vi.fn(),
  saveRuleApplication: vi.fn(),
}));
vi.mock("./useEvalFeedback", () => ({
  useEvalFeedback: () => ({ message: { success: vi.fn(), warning: vi.fn() } }),
}));
vi.mock("./useEvalTranslation", async () => {
  const { evalPart } = await import("./locales/zh-CN");
  return {
    useEvalTranslation: () => ({
      t: (key: string) =>
        key
          .split(".")
          .slice(1)
          .reduce<unknown>(
            (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : key),
            evalPart,
          ) ?? key,
    }),
  };
});
vi.mock("./EvalResourceCaseFields", async () => {
  const { useEffect } = await import("react");
  return {
    EvalResourceCaseFields: ({
      contract,
      onPrepared,
    }: {
      contract: unknown;
      onPrepared: (value?: EvalCaseDefinition) => void;
    }) => {
      useEffect(() => {
        onPrepared(undefined);
      }, [contract, onPrepared]);
      return (
        <button
          onClick={() =>
            onPrepared({
              title: "回显函数可调用",
              category: "fact",
              risk_level: "medium",
              execution_spec: { runner: "direct_capability" },
              diagnostic_spec: { form_version: 2 },
              input_spec: { arguments: { count: 0 } },
              assertions: [],
              expected_spec: { criteria: {} },
              expected_source: { kind: "declared_contract", evidence_refs: ["来源合同"] },
            })
          }
        >
          填写参数
        </button>
      );
    },
  };
});

it("allows saving after preview closes a retained resource editor", async () => {
  const rule: EvalTemplateRule = {
    id: "available",
    kind: "function",
    title: "函数调用可用",
    group: "调用",
    description: "只读调用",
    appliesWhen: "函数可读取",
    evidence: "执行回执",
    planDimensions: [],
    preset: "required",
    enabled: true,
    check: { type: "resource_available" },
  };
  const row = {
    key: "target:default",
    target_key: "target",
    resource: { kind: "function", id: "echo" },
    resource_name: "回显函数",
    target_id: "echo",
    target_name: "回显函数",
    rule_id: rule.id,
    rule_title: rule.title,
    rule_checksum: "rule",
    resource_checksum: "resource",
    check: rule.check,
    match: "applicable" as const,
    configuration: "complete" as const,
    execution: "ready",
    execution_reason: "",
    missing: [],
    input_contract: { rule_based: true, available: true },
    sample: {
      target_key: "target",
      sample_id: "default",
      title: "回显函数可调用",
      question: "调用",
      arguments: {},
      scope: { mode: "invocation" },
    },
  };
  vi.mocked(previewRuleApplication).mockImplementation(() =>
    Promise.resolve({
      entries: [structuredClone(row)],
      total: 1,
      page: 1,
      limit: 10,
      scope_revision: 0,
    }),
  );
  render(
    <EvalRuleApplicationDrawer
      networkId="kn"
      rules={[rule]}
      seed={{ ruleIds: [rule.id], resources: [row.resource] }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onOpenCase={vi.fn()}
    />,
  );
  const footer = within(document.querySelector<HTMLElement>(".ant-drawer-footer")!);
  fireEvent.click(footer.getByRole("button", { name: "下一步" }));
  fireEvent.click(await screen.findByLabelText(/Expand row|展开行/, { selector: "button" }));
  fireEvent.click(await screen.findByText("填写参数", { selector: "button" }));
  fireEvent.click(screen.getByText("应用配置", { selector: "button > span" }).closest("button")!);
  fireEvent.click(
    screen.getByText("重新校验配置", { selector: "button > span" }).closest("button")!,
  );
  await waitFor(() => expect(previewRuleApplication).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(footer.getByRole("button", { name: "确定保存" })).toBeEnabled());
});
