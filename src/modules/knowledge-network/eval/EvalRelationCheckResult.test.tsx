/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EvalRelationCheckResult } from "./EvalRelationCheckResult";
import type { EvalResourceQuerySummary } from "./m0-run.service";

vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const name = key.split(".").at(-1) ?? key;
      return name === "findingsTruncated"
        ? `Showing ${String(values?.shown)} of ${String(values?.total)} findings`
        : name;
    },
  }),
}));

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

afterEach(() => vi.restoreAllMocks());

const property = {
  name: "edge_value",
  display_name: "Edge value",
  type: "integer",
  required: true,
  mapped_field: { name: "edge_value", type: "integer" },
  constraints: { range: { min: 7, max: 11 } },
};

function summary(): EvalResourceQuerySummary {
  return {
    resource_kind: "relationType",
    resource_id: "relation-1",
    scope: { mode: "sample", limit: 100 },
    relation_check: {
      rule: "relation-property-values",
      relation_type: "Association",
      source_object_type: "Source",
      target_object_type: "Target",
      checked: 2,
      violations: 1,
      violation_unit: "record_properties",
      findings_total: 1,
      findings_truncated: false,
      declaration_snapshot: {
        relation_id: "relation-1",
        source_object_type_id: "source-1",
        target_object_type_id: "target-1",
        bridge_resource_id: "bridge-1",
        sha256: "executed-declaration-sha256",
        properties: [property],
      },
      findings: [
        {
          record_index: 1,
          field: "edge_value",
          value: 12,
          reason: "Range violation",
          source_identity: { qa_id: "B" },
          target_identity: { qa_id: "A" },
          bridge_resource_id: "bridge-1",
          record: { from_id: "B", to_id: "A", edge_value: 12 },
          property_snapshot: property,
          constraint_sha256: "executed-property-sha256",
        },
      ],
    },
  };
}

it("shows the executed constraint snapshot and never fetches a newer declaration", () => {
  const currentDeclaration = { ...property, constraints: { range: { min: 7, max: 20 } } };
  const fetchCurrent = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(currentDeclaration), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(<EvalRelationCheckResult summary={summary()} />);
  fireEvent.click(screen.getByRole("button", { name: "viewConstraint" }));
  const dialog = screen.getByRole("dialog", { name: "executedDeclaration" });
  expect(within(dialog).getByText("executed-declaration-sha256")).toBeVisible();
  const constraint = within(dialog).getByRole("region", { name: "constraint" });
  fireEvent.click(within(constraint).getByRole("button", { name: "expandAll" }));
  expect(constraint.textContent).toContain('"edge_value"');
  expect(constraint.textContent).toContain('"min": 7');
  expect(constraint.textContent).toContain('"max": 11');
  expect(constraint.textContent).not.toContain('"max": 20');
  expect(fetchCurrent).not.toHaveBeenCalled();
});

it("opens the sampled B to A record with its executed property and one-based row index", () => {
  render(<EvalRelationCheckResult summary={summary()} />);
  fireEvent.click(screen.getByRole("button", { name: "viewRecord" }));
  const dialog = screen.getByRole("dialog", { name: "dataSnapshot" });
  expect(dialog.textContent).toContain("recordIndex2");
  expect(dialog.textContent).toContain("qa_id=B");
  expect(dialog.textContent).toContain("qa_id=A");
  const record = within(dialog).getByRole("region", { name: "record" });
  expect(record.textContent).toContain('"from_id": "B"');
  expect(record.textContent).toContain('"to_id": "A"');
  expect(record.textContent).toContain('"edge_value": 12');
  const constraint = within(dialog).getByRole("region", { name: "constraint" });
  fireEvent.click(within(constraint).getByRole("button", { name: "expandAll" }));
  expect(constraint.textContent).toContain('"max": 11');
  expect(within(dialog).getByText("executed-property-sha256")).toBeVisible();
});

it("distinguishes property violations from records and explains finding truncation", () => {
  const result = summary();
  const check = result.relation_check!;
  check.checked = 11;
  check.violations = 22;
  check.findings_total = 22;
  check.findings_truncated = true;
  check.findings = Array.from({ length: 20 }, (_, index) => ({
    field: `field-${index}`,
    value: 12,
    reason: "Range violation",
  }));
  render(<EvalRelationCheckResult summary={result} />);
  expect(screen.getByText("22 propertyViolationUnit")).toBeVisible();
  expect(screen.getByText("Showing 20 of 22 findings")).toBeVisible();
  expect(screen.getAllByRole("button", { name: "viewRecord" })).toHaveLength(5);
});

it("rejects incomplete declaration material instead of rendering a legacy result", () => {
  const result = summary();
  delete result.relation_check!.declaration_snapshot;
  render(<EvalRelationCheckResult summary={result} />);
  expect(screen.getByText("incompleteDeclaration")).toBeVisible();
  expect(screen.queryByRole("button", { name: "viewRecord" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "viewConstraint" })).not.toBeInTheDocument();
});

it("uses record counting for integrity checks and retains null actual values", () => {
  const result = summary();
  const check = result.relation_check!;
  check.rule = "relation-integrity";
  check.violation_unit = "bridge_records";
  check.findings = [
    { field: "edge_value", value: null, record: { edge_value: null }, reason: "Required" },
  ];
  render(<EvalRelationCheckResult summary={result} />);
  expect(screen.getByText("1 recordViolationUnit")).toBeVisible();
  expect(screen.getByRole("region", { name: "actual" }).textContent).toContain("null");
});
