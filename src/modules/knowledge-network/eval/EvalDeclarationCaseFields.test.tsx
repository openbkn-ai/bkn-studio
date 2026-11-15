/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalDeclarationCaseFields } from "./EvalDeclarationCaseFields";
import { previewRuleApplication, type RuleApplicationRow } from "./rule-application.service";
import type { EvalCaseDefinition } from "./m0-run.service";
vi.mock("./rule-application.service", () => ({ previewRuleApplication: vi.fn() }));
vi.mock("@/framework/json/JsonInput", () => ({
  JsonInput: ({
    ariaLabel,
    value,
    onChange,
  }: {
    ariaLabel: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "zh-CN",
    fallbackLng: "zh-CN",
    resources: evalLocales,
    interpolation: { escapeValue: false },
  });
});
const row = {
  key: "row",
  target_key: "target",
  target_id: "order",
  resource: { kind: "objectType", id: "order" },
  rule_id: "custom-new-rule",
  sample: {
    target_key: "target",
    sample_id: "default",
    arguments: {},
    scope: { mode: "invocation" },
  },
  check: {
    type: "declaration",
    declaration: {
      version: 1,
      target: "resource",
      parameters: {
        standard: {
          title: "业务标准",
          required: true,
          schema: {
            type: "object",
            required: ["version"],
            properties: { version: { type: "string", minLength: 1 } },
          },
          example: { version: "example-only" },
        },
      },
      assertions: [],
    },
  },
} as unknown as RuleApplicationRow;
const definition = {
  title: "Check",
  input_spec: { arguments: { standard: { version: "v1" } } },
  execution_spec: { runner: "declaration_preflight", parameters: { standard: { version: "v1" } } },
  expected_spec: { status: "passed" },
  diagnostic_spec: {},
} as unknown as EvalCaseDefinition;
it("requires independently entered parameters and never adopts examples as standards", async () => {
  const prepared = vi.fn(),
    sample = vi.fn();
  vi.mocked(previewRuleApplication).mockReset();
  render(
    <EvalDeclarationCaseFields
      networkId="kn"
      row={row}
      onPrepared={prepared}
      onSamplePrepared={sample}
    />,
  );
  expect(screen.getByRole("textbox").textContent).toBe("{}");
  fireEvent.click(screen.getByRole("button", { name: "校验配置" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(previewRuleApplication).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: '{"standard":{"version":"v2"}}' },
  });
  vi.mocked(previewRuleApplication).mockResolvedValue({
    entries: [{ ...row, ready_for_save: true, prepared_definition: definition }],
    page: 1,
    limit: 100,
    total: 1,
    scope_revision: 0,
  });
  fireEvent.click(screen.getByRole("button", { name: "校验配置" }));
  await waitFor(() => expect(prepared).toHaveBeenLastCalledWith(definition));
  expect(vi.mocked(previewRuleApplication).mock.calls[0][1].samples?.[0].arguments).toEqual({
    standard: { version: "v2" },
  });
  expect(sample).toHaveBeenCalled();
});
it("edits frozen Case parameters together without looking up a changed library rule", async () => {
  const prepared = vi.fn();
  vi.mocked(previewRuleApplication).mockClear();
  render(
    <EvalDeclarationCaseFields
      networkId="kn"
      row={row}
      initialDefinition={definition}
      frozenDefinition={definition}
      onPrepared={prepared}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: '{"standard":{"version":"v3"}}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "校验配置" }));
  await waitFor(() =>
    expect(prepared).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input_spec: { arguments: { standard: { version: "v3" } } },
      }),
    ),
  );
  const submitted: unknown = prepared.mock.lastCall?.[0];
  expect(submitted).toMatchObject({
    execution_spec: { parameters: { standard: { version: "v3" } } },
  });
  expect(previewRuleApplication).not.toHaveBeenCalled();
  expect(definition.input_spec.arguments).toEqual({ standard: { version: "v1" } });
});
it("does not reapply an outdated preview after the user edits a standard", async () => {
  const prepared = vi.fn();
  let resolve!: (value: Awaited<ReturnType<typeof previewRuleApplication>>) => void;
  vi.mocked(previewRuleApplication).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(
    <EvalDeclarationCaseFields
      networkId="kn"
      row={row}
      initialDefinition={definition}
      onPrepared={prepared}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "校验配置" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: '{"standard":{"version":"changed"}}' },
  });
  await act(async () => {
    resolve({
      entries: [{ ...row, ready_for_save: true, prepared_definition: definition }],
      page: 1,
      limit: 100,
      total: 1,
      scope_revision: 0,
    });
    await Promise.resolve();
  });
  expect(prepared).not.toHaveBeenCalledWith(definition);
});
