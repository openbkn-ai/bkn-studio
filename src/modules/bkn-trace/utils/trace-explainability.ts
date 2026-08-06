/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  BusinessStoryStage,
  TraceBusinessNode,
  TraceClaim,
  TraceEvidenceRef,
} from "@/modules/bkn-trace/services/trace.service";

const stageOrder: BusinessStoryStage[] = ["intent", "execution", "evidence", "claim", "action"];

export type BusinessStoryStageGroup = {
  nodes: TraceBusinessNode[];
  stage: BusinessStoryStage;
};

export type BusinessEvidenceGroups = {
  action: TraceBusinessNode[];
  data: TraceBusinessNode[];
  logic: TraceBusinessNode[];
};

const dataEvidenceKinds = new Set([
  "data_resource",
  "evidence_ref",
  "field",
  "knowledge_network",
  "object",
  "object_instance",
  "object_type",
  "property",
  "relation",
  "relation_type",
  "resource",
  "row_ref",
]);
const logicEvidenceKinds = new Set([
  "function",
  "function_type",
  "logic",
  "logic_execution",
  "metric",
  "metric_type",
]);
const actionEvidenceKinds = new Set(["action", "action_instance", "action_type"]);

export function businessEvidenceGroups(nodes: TraceBusinessNode[]): BusinessEvidenceGroups {
  const groups: BusinessEvidenceGroups = { action: [], data: [], logic: [] };
  for (const node of nodes) {
    if (["hidden", "unauthorized"].includes(node.visibility ?? "")) continue;
    const kind = businessNodeKind(node);
    if (actionEvidenceKinds.has(kind) || node.stage === "action") {
      groups.action.push(node);
    } else if (logicEvidenceKinds.has(kind)) {
      groups.logic.push(node);
    } else if (dataEvidenceKinds.has(kind) && node.stage !== "intent") {
      groups.data.push(node);
    }
  }
  return groups;
}

export function businessStoryStages(nodes: TraceBusinessNode[]): BusinessStoryStageGroup[] {
  return stageOrder.map((stage) => ({
    nodes: nodes.filter((node) => effectiveBusinessStage(node) === stage),
    stage,
  }));
}

export function explainabilityPartialReasons(
  reasonGroups: string[][],
  businessGraph?: {
    partialReason: string[];
    visibilitySummary: { authorizedRefCount: number; unresolvedRefCount: number };
  },
): string[] {
  const reasons = [...new Set(reasonGroups.flat())];
  const businessReferencesResolved = Boolean(
    businessGraph
    && businessGraph.visibilitySummary.authorizedRefCount > 0
    && businessGraph.visibilitySummary.unresolvedRefCount === 0
    && !businessGraph.partialReason.some((reason) => businessReferenceReasons.has(reason)),
  );
  return businessReferencesResolved
    ? reasons.filter((reason) => !businessReferenceReasons.has(reason))
    : reasons;
}

const businessReferenceReasons = new Set([
  "business_ref_unresolved",
  "missing_business_refs",
  "resolver_unresolved",
]);

function effectiveBusinessStage(node: TraceBusinessNode): BusinessStoryStage | undefined {
  if (node.stage) return node.stage;
  return node.id.startsWith("business:") ? "evidence" : undefined;
}

export type ExplainabilityRow = {
  id: string;
  kind: string;
  primary: string;
  secondary: string;
  status: string;
  versionStatus: string;
  visibility: string;
};

export type BusinessNodePresentation = {
  kind: string;
  subtitle: string;
  technicalId: string;
  title: string;
};

const operationNames: Record<string, string> = {
  "data.query.observed": "查询业务数据",
  "knowledge.read.observed": "读取业务知识网络",
  "logic.execution.observed": "执行业务计算逻辑",
  "retrieval.completed": "完成语义检索",
  "context.run_sql": "查询业务数据",
  "context.search_schema": "检索知识网络结构",
  run_sql: "查询业务数据",
  search_schema: "检索知识网络结构",
};

const artifactNames: Record<string, string> = {
  data_result: "数据查询结果",
  logic_execution: "逻辑计算结果",
  query: "查询条件与口径",
  question: "用户问题",
  result: "业务回答",
};

export function businessNodePresentation(node: TraceBusinessNode): BusinessNodePresentation {
  const refId = stringField(node.properties, "ref_id");
  const eventType = stringField(node.properties, "event_type") || node.label || "";
  const operationName = stringField(node.properties, "operation_name");
  const artifactType = stringField(node.properties, "artifact_type") || node.label || "";
  const technicalId = firstNonEmpty(refId, stringField(node.properties, "artifact_ref"), node.id);
  const resolved = resolveBusinessRef(refId || node.id);
  const displayName = node.display?.name || node.display?.controlledSummary || "";
  const kindLabel = businessKindLabel(businessNodeKind(node));

  if (displayName) {
    return {
      kind: kindLabel,
      subtitle: compactJoin([kindLabel, node.display?.businessPath?.join(" / ") ?? ""]),
      technicalId,
      title: displayName,
    };
  }
  if (resolved) {
    return { ...resolved, technicalId };
  }
  const operationTitle = operationNames[operationName] || operationNames[eventType];
  if (node.nodeType === "operation" && operationTitle) {
    return {
      kind: "执行过程",
      subtitle: operationName || eventType,
      technicalId,
      title: operationTitle,
    };
  }
  if (node.nodeType === "interaction") {
    return {
      kind: "交互意图",
      subtitle: "用户问题与本轮任务",
      technicalId,
      title: "用户发起分析问题",
    };
  }
  if (node.nodeType === "claim") {
    return {
      kind: "业务结论",
      subtitle: stringField(node.properties, "claim_type") || "answer",
      technicalId,
      title: "形成业务回答",
    };
  }
  if (node.nodeType === "artifact" && artifactNames[artifactType]) {
    return {
      kind: "证据制品",
      subtitle: artifactType,
      technicalId,
      title: artifactNames[artifactType],
    };
  }
  return {
    kind: businessKindLabel(node.nodeType),
    subtitle: compactJoin([businessKindLabel(node.nodeType), scalarLike(node.properties.validity), node.versionStatus ?? ""]),
    technicalId,
    title: node.label || shortValue(technicalId),
  };
}

export function claimRows(claims: TraceClaim[]): ExplainabilityRow[] {
  return claims.map((claim, index) => {
    const subjectRefs = objectField(claim, "subject_refs");
    const operation = stringField(subjectRefs, "operation") || stringField(claim, "operation");
    const model = stringField(subjectRefs, "model_name");
    const resource = stringField(subjectRefs, "resource_id");
    const schema = stringField(subjectRefs, "entity_kind");
    const queryHash = stringField(subjectRefs, "query_hash");

    return {
      id: stringField(claim, "claim_id") || `claim:${index}`,
      kind: stringField(claim, "claim_type") || "finding",
      primary: firstNonEmpty(model, resource, schema, queryHash, operation, stringField(claim, "claim_hash")),
      secondary: compactJoin([
        operation,
        model ? `model=${model}` : "",
        resource ? `resource=${resource}` : "",
        queryHash ? `query=${shortValue(queryHash)}` : "",
      ]),
      status: stringField(subjectRefs, "status") || "-",
      versionStatus: stringField(claim, "version_status") || "-",
      visibility: stringField(claim, "visibility") || "-",
    };
  });
}

export function evidenceRows(refs: TraceEvidenceRef[]): ExplainabilityRow[] {
  return refs.map((ref, index) => {
    const summary = objectField(ref, "summary");
    const kind = stringField(summary, "kind") || stringField(ref, "ref_type") || "evidence";
    const primary = firstNonEmpty(
      stringField(summary, "model_name"),
      stringField(summary, "resource_id"),
      stringField(summary, "catalog_id"),
      stringField(summary, "id"),
      stringField(ref, "ref_id"),
    );
    const secondary = compactJoin([
      stringField(ref, "source_system"),
      stringField(summary, "model_provider"),
      stringField(summary, "status"),
      shortValue(stringField(summary, "message_hash")),
      shortValue(stringField(summary, "result_hash")),
      shortValue(stringField(summary, "row_hash")),
      shortValue(stringField(ref, "summary_hash")),
    ]);

    return {
      id: stringField(ref, "ref_id") || `evidence:${index}`,
      kind,
      primary,
      secondary,
      status: stringField(summary, "status") || stringField(ref, "validity") || "-",
      versionStatus: stringField(ref, "version_status") || stringField(summary, "version_status") || "-",
      visibility: stringField(ref, "visibility") || "-",
    };
  });
}

export function businessRows(nodes: TraceBusinessNode[]): ExplainabilityRow[] {
  return nodes.map((node, index) => {
    const properties = node.properties;
    const nodeType = node.nodeType || stringField(properties, "ref_type") || "business";
    const label = node.label ?? "";
    const id = node.id || `business:${index}`;

    return {
      id,
      kind: nodeType,
      primary: firstNonEmpty(label, id),
      secondary: compactJoin([
        node.claimId ?? "",
        stringField(properties, "source_system"),
        stringField(properties, "summary_hash") ? shortValue(stringField(properties, "summary_hash")) : "",
      ]),
      status: stringField(properties, "validity") || "-",
      versionStatus: node.versionStatus || stringField(properties, "version_status") || "-",
      visibility: node.visibility || stringField(properties, "visibility") || "-",
    };
  });
}

function resolveBusinessRef(ref: string): Omit<BusinessNodePresentation, "technicalId"> | undefined {
  const normalized = ref.replace(/^evidence:/, "").replace(/^business:/, "");
  const parts = normalized.split(":");
  const refType = parts[0];
  if (refType === "kn") {
    return { kind: "业务知识网络", subtitle: "业务知识网络 · BKN", title: `BKN：${shortValue(parts[1] ?? ref)}` };
  }
  if (refType === "resource") {
    return { kind: "数据资源", subtitle: "业务数据 · Vega", title: `数据资源：${shortValue(parts[1] ?? ref)}` };
  }
  if (refType === "object") {
    return { kind: "业务对象", subtitle: compactJoin([parts[1] ? `BKN：${shortValue(parts[1])}` : "", "对象"]), title: `业务对象：${shortValue(parts[2] || ref)}` };
  }
  if (refType === "property") {
    const objectName = parts[2] || "";
    const propertyName = parts[3] || ref;
    return { kind: "业务属性", subtitle: compactJoin([objectName, "属性"]), title: `业务属性：${propertyName}` };
  }
  return undefined;
}

function businessKindLabel(nodeType: string): string {
  switch (nodeType) {
  case "artifact":
    return "证据制品";
  case "claim":
    return "业务结论";
  case "evidence_ref":
    return "业务证据";
  case "interaction":
    return "交互意图";
  case "knowledge_network":
    return "业务知识网络";
  case "object":
  case "object_type":
    return "业务对象";
  case "operation":
    return "执行过程";
  case "property":
  case "field":
    return "业务属性";
  case "relation":
  case "relation_type":
    return "业务关系";
  case "resource":
  case "data_resource":
    return "数据资源";
  case "metric":
  case "metric_type":
  case "function":
  case "function_type":
  case "logic":
  case "logic_execution":
    return "业务逻辑";
  case "action":
  case "action_instance":
  case "action_type":
    return "业务行动";
  default:
    return nodeType || "业务节点";
  }
}

function businessNodeKind(node: TraceBusinessNode): string {
  return stringField(node.properties, "ref_type") || node.nodeType;
}

function scalarLike(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function shortValue(value: string): string {
  if (!value) {
    return "";
  }
  if (value.length <= 28) {
    return value;
  }
  return `${value.slice(0, 18)}...${value.slice(-6)}`;
}

function objectField(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim()) ?? "-";
}

function compactJoin(values: string[]): string {
  return values.filter((value) => value.trim()).join(" · ") || "-";
}
