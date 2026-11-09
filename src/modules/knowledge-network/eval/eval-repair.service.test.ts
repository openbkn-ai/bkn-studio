/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
import {
  getKnowledgeNetworkObjectTypeDetail,
  updateKnowledgeNetworkObjectType,
} from "../services/object-type.service";
import type { ObjectTypeDetail } from "../types/object-type";
import {
  getEvalOverview,
  getEvalCaseDefinition,
  getRunCaseDetail,
  type EvalOverview,
  type M0CaseDetail,
  type M0Run,
  type EvalSuiteCaseDetail,
} from "./m0-run.service";
import {
  applyEvalRepair,
  buildRunRepairRequest,
  loadEvalRepairSession,
  validateEvalRepairProposal,
  type EvalRepairProposal,
  type EvalRepairRequest,
} from "./eval-repair.service";
vi.mock("../services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
  updateKnowledgeNetworkObjectType: vi.fn(),
}));
vi.mock("./m0-run.service", () => ({
  getEvalOverview: vi.fn(),
  getRunCaseDetail: vi.fn(),
  getEvalCaseDefinition: vi.fn(),
}));
const request: EvalRepairRequest = {
  networkId: "kn-1",
  id: "request-1",
  target: { kind: "objectType", id: "order", name: "订单" },
  cases: [
    {
      id: "case-1",
      title: "订单 / id 类型一致",
      enabled: true,
      excluded: false,
      runnable: true,
      target_names: [],
      status: "failed",
      latest_run_id: "run-1",
      latest_case_run_id: "cr-1",
      latest_result_revision: 1,
    },
  ],
};
const original = {
  id: "order",
  name: "订单",
  color: "blue",
  description: "保留业务描述",
  tags: ["核心"],
  conceptGroupIds: [],
  operations: ["modify"],
  logicProperties: [],
  dataSource: { id: "source-1" },
  dataProperties: [
    {
      name: "id",
      type: "string",
      primaryKey: true,
      displayKey: true,
      mappedField: { name: "id", type: "integer" },
    },
    { name: "amount", type: "decimal", comment: "保留未修改的属性" },
  ],
} as unknown as ObjectTypeDetail & { operations: string[] };
const detail = {
  id: "cr-1",
  case_id: "case-1",
  quality_outcome: "fail",
  result_revision: 1,
  target_snapshot: { object_data: { rule_id: "property-type" } },
  observation: {
    evidence_status: "complete",
    query_summary: {
      scope: { mode: "sample" },
      checked_rows: 1,
      violations: 1,
      violation_examples: [
        { field: "id", resource_id: "order", actual_type: "number", declared_type: "string" },
      ],
    },
  },
} as unknown as M0CaseDetail;
const proposal = () => ({
  kind: "eval_repair_plan",
  summary: "按独立数据源定义修正字段类型",
  changes: [
    {
      operation: "set_property_type",
      field: "id",
      before: "string",
      after: "integer",
      reason: "数据源字段为 integer，实际执行证据亦显示数值",
      evidence_case_run_ids: ["cr-1"],
    },
  ],
  manual_steps: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockImplementation(() =>
    Promise.resolve(structuredClone(original)),
  );
  vi.mocked(getRunCaseDetail).mockImplementation(() => Promise.resolve(structuredClone(detail)));
  vi.mocked(getEvalCaseDefinition).mockResolvedValue({
    case_id: "case-1",
    archived: false,
    gold_visible: false,
    definition: { title: "id 类型检查", assertions: [] },
  } as unknown as EvalSuiteCaseDetail);
  vi.mocked(getEvalOverview).mockResolvedValue({ case_details: request.cases } as EvalOverview);
  vi.mocked(updateKnowledgeNetworkObjectType).mockResolvedValue(null);
});
const load = () => loadEvalRepairSession("kn-1", request, new AbortController().signal);

it("loads frozen evidence without writing, then applies only the validated field change", async () => {
  const session = await load();
  expect(getRunCaseDetail).toHaveBeenCalledWith(
    "kn-1",
    "run-1",
    "cr-1",
    1,
    expect.any(AbortSignal),
  );
  const checked = validateEvalRepairProposal(proposal(), session);
  expect(updateKnowledgeNetworkObjectType).not.toHaveBeenCalled();
  await applyEvalRepair("kn-1", session, checked);
  const input = vi.mocked(updateKnowledgeNetworkObjectType).mock.calls[0][2];
  expect(input.dataProperties?.[0]).toEqual({ ...original.dataProperties[0], type: "integer" });
  expect(input.dataProperties?.[1]).toEqual(original.dataProperties[1]);
  expect(input).toMatchObject({
    name: original.name,
    description: original.description,
    dataSource: original.dataSource,
    tags: original.tags,
  });
});

it.each(["source", "evidence", "operation", "field"])(
  "rejects ungrounded or unsupported %s changes",
  async (kind) => {
    const session = await load();
    const p = proposal();
    if (kind === "source") p.changes[0].after = "decimal";
    if (kind === "evidence") p.changes[0].evidence_case_run_ids = ["invented"];
    if (kind === "operation") p.changes[0].operation = "delete_resource";
    if (kind === "field") p.changes[0].field = "another_field";
    expect(() => validateEvalRepairProposal(p, session)).toThrow("EVAL_REPAIR_");
    expect(updateKnowledgeNetworkObjectType).not.toHaveBeenCalled();
  },
);

it("does not guess repairs from incomplete or mismatched evidence", async () => {
  vi.mocked(getRunCaseDetail).mockResolvedValue({ ...detail, case_id: "other-case" });
  const session = await load();
  expect(session.context.complete).toBe(false);
  expect(session.context.supportedOperations).toEqual([]);
  expect(() => validateEvalRepairProposal(proposal(), session)).toThrow("EVAL_REPAIR_INVALID_PLAN");
  expect(
    validateEvalRepairProposal(
      { ...proposal(), changes: [], manual_steps: ["补充原始证据"] },
      session,
    ).changes,
  ).toEqual([]);
});

it.each(["resource", "result", "permission", "definition"])(
  "rechecks current %s before writing",
  async (kind) => {
    const session = await load();
    const checked = validateEvalRepairProposal(proposal(), session);
    if (kind === "resource")
      vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue({
        ...original,
        description: "他人已修改",
      });
    if (kind === "permission")
      vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue({
        ...original,
        operations: [],
      });
    if (kind === "result")
      vi.mocked(getEvalOverview).mockResolvedValue({
        case_details: [{ ...request.cases[0], latest_result_revision: 2 }],
      } as EvalOverview);
    if (kind === "definition")
      vi.mocked(getEvalCaseDefinition).mockResolvedValue({
        case_id: "case-1",
        archived: false,
        definition: { title: "他人已修改判定口径", assertions: [] },
      } as unknown as EvalSuiteCaseDetail);
    await expect(applyEvalRepair("kn-1", session, checked)).rejects.toThrow("EVAL_REPAIR_");
    expect(updateKnowledgeNetworkObjectType).not.toHaveBeenCalled();
  },
);

it("keeps masked fields and business scenarios outside automatic resource changes", async () => {
  vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValue({
    ...original,
    dataProperties: [
      { ...original.dataProperties[0], maskRule: { kind: "fixed", replacement: "***" } },
    ],
  });
  const masked = await load();
  expect(() => validateEvalRepairProposal(proposal(), masked)).toThrow(
    "EVAL_REPAIR_UNSUPPORTED_CHANGE",
  );
  const scenario = await loadEvalRepairSession(
    "kn-1",
    { ...request, target: { ...request.target, kind: "scenario" } },
    new AbortController().signal,
  );
  expect(scenario.context.supportedOperations).toEqual([]);
});

it("retains a bounded conversational answer alongside the validated repair plan", async () => {
  const session = await load();
  const p = { ...proposal(), answer: "  只修改 id；依据独立数据源声明。  " };
  expect(validateEvalRepairProposal(p, session).answer).toBe("只修改 id；依据独立数据源声明。");
  expect(() => validateEvalRepairProposal({ ...p, answer: "x".repeat(8001) }, session)).toThrow(
    "EVAL_REPAIR_INVALID_PLAN",
  );
});

const runSnapshot = { id: "run-1", result_revision: 1 } as M0Run;
const failedSnapshot = {
  ...detail,
  case_title: "订单 / id 类型一致",
  execution_status: "completed",
  assessment_target: {
    kind: "resource",
    resources: [{ resource_id: "order", resource_kind: "object_type", name: "订单" }],
  },
} as M0CaseDetail;
const repairOverview = {
  case_details: request.cases,
  resource_details: [{ kind: "objectType", id: "order", name: "订单" }],
} as EvalOverview;

it("binds current run repair to the exact failed case and assessed resource", () => {
  const result = buildRunRepairRequest("kn-1", runSnapshot, failedSnapshot, repairOverview, true);
  expect(result.target).toEqual({ kind: "objectType", id: "order", name: "订单" });
  expect(result.analysisOnly).toBeUndefined();
  expect(result.cases).toEqual([
    expect.objectContaining({
      id: "case-1",
      latest_run_id: "run-1",
      latest_case_run_id: "cr-1",
      latest_result_revision: 1,
    }),
  ]);
});
it("keeps historical repair analysis bound to its frozen execution and forbids current-resource writes", () => {
  const result = buildRunRepairRequest(
    "kn-1",
    { ...runSnapshot, id: "old-run" },
    { ...failedSnapshot, id: "old-case-run", result_revision: 2 },
    repairOverview,
    true,
  );
  expect(result).toMatchObject({ analysisOnly: true, analysisOnlyReason: "history" });
  expect(result.cases[0]).toMatchObject({
    latest_run_id: "old-run",
    latest_case_run_id: "old-case-run",
    latest_result_revision: 2,
  });
  expect(repairOverview.case_details?.[0].latest_run_id).toBe("run-1");
});
it.each(["inconclusive", "execution_failed", "permission", "disabled", "scenario"])(
  "offers analysis without automatic mutation for %s",
  (kind) => {
    const snapshot = { ...failedSnapshot };
    if (kind === "inconclusive") snapshot.quality_outcome = "inconclusive";
    if (kind === "execution_failed") {
      snapshot.execution_status = "failed";
      snapshot.quality_outcome = null;
    }
    if (kind === "scenario")
      snapshot.assessment_target = {
        kind: "business_scenario",
        resources: [{ resource_id: "order", resource_kind: "object_type", name: "订单" }],
      };
    const overview =
      kind === "disabled"
        ? {
            ...repairOverview,
            case_details: request.cases.map((entry) => ({ ...entry, enabled: false })),
          }
        : repairOverview;
    const result = buildRunRepairRequest(
      "kn-1",
      runSnapshot,
      snapshot,
      overview,
      kind !== "permission",
    );
    expect(result.analysisOnly).toBe(true);
    if (kind === "scenario")
      expect(result.target).toMatchObject({
        kind: "scenario",
        id: "case-1",
        name: snapshot.case_title,
      });
  },
);
it("loads technical failure evidence for analysis even if the current case definition is unavailable", async () => {
  vi.mocked(getRunCaseDetail).mockResolvedValue({
    ...failedSnapshot,
    execution_status: "failed",
    quality_outcome: null,
    observation: { failure_class: "DEPENDENCY", evidence_status: "complete" },
  });
  const result = await loadEvalRepairSession(
    "kn-1",
    {
      ...request,
      analysisOnly: true,
      analysisOnlyReason: "outcome",
      cases: request.cases.map((entry) => ({ ...entry, status: "execution_failed" })),
    },
    new AbortController().signal,
  );
  expect(result.context.failures[0]).toMatchObject({
    caseRunId: "cr-1",
    executionStatus: "failed",
    qualityOutcome: null,
    failureClass: "DEPENDENCY",
  });
  expect(result.context.supportedOperations).toEqual([]);
  expect(getEvalCaseDefinition).not.toHaveBeenCalled();
  await expect(applyEvalRepair("kn-1", result, proposal() as EvalRepairProposal)).rejects.toThrow(
    "EVAL_REPAIR_UNSUPPORTED_CHANGE",
  );
  expect(updateKnowledgeNetworkObjectType).not.toHaveBeenCalled();
});
it("does not offer repair for passed or cancelled executions", () => {
  expect(() =>
    buildRunRepairRequest(
      "kn-1",
      runSnapshot,
      { ...failedSnapshot, quality_outcome: "pass" },
      repairOverview,
      true,
    ),
  ).toThrow("EVAL_REPAIR_NO_FAILURES");
  expect(() =>
    buildRunRepairRequest(
      "kn-1",
      runSnapshot,
      { ...failedSnapshot, execution_status: "cancelled" },
      repairOverview,
      true,
    ),
  ).toThrow("EVAL_REPAIR_NO_FAILURES");
});

it("passes unified relation scope to AI without manufacturing totals", async () => {
  const facts = {
    version: 1,
    resource_kind: "relationType",
    resource_id: "order_user",
    source: "resource_query",
    shape: "document",
    scope: "object_pair",
    scope_details: {
      unit: "object_pairs",
      source: { resource_kind: "objectType", resource_id: "order", identity: { id: 0 } },
      target: { resource_kind: "objectType", resource_id: "user", identity: { id: false } },
    },
    checked_rows: 1,
    completeness: "unknown",
    evidence_status: "complete",
  } as const;
  vi.mocked(getRunCaseDetail).mockResolvedValue({
    ...detail,
    observation: { ...detail.observation, facts },
  });
  const session = await load();
  expect(session.context.failures[0].facts).toEqual(facts);
  expect(session.context.failures[0].facts?.total_rows).toBeUndefined();
});
