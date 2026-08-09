/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  BusinessStoryStage,
  TraceBusinessEdge,
  TraceBusinessNode,
  TraceClaim,
  TraceEvidenceRef,
} from "@/modules/bkn-trace/services/trace.service";
import i18n from "@/app/locales/i18n";

const stageOrder: BusinessStoryStage[] = ["intent", "execution", "evidence", "claim", "action"];

export type BusinessStoryStageGroup = {
  nodes: TraceBusinessNode[];
  stage: BusinessStoryStage;
};

export type BusinessEvidenceGroups = {
  action: TraceBusinessNode[];
  data: TraceBusinessNode[];
  discovered: TraceBusinessNode[];
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

export function businessEvidenceGroups(
  nodes: TraceBusinessNode[],
  edges: TraceBusinessEdge[] = [],
): BusinessEvidenceGroups {
  const discoveryOperations = new Set(nodes
    .filter((node) => node.nodeType === "operation" && isSearchSchemaOperation(node))
    .map((node) => node.id));
  const otherOperations = new Set(nodes
    .filter((node) => node.nodeType === "operation" && !isSearchSchemaOperation(node))
    .map((node) => node.id));
  const discoveredTargets = new Set(edges
    .filter((edge) => discoveryOperations.has(edge.sourceId))
    .map((edge) => edge.targetId));
  const usedTargets = new Set(edges
    .filter((edge) => otherOperations.has(edge.sourceId))
    .map((edge) => edge.targetId));
  const groups: BusinessEvidenceGroups = { action: [], data: [], discovered: [], logic: [] };
  for (const node of nodes) {
    if (["hidden", "unauthorized"].includes(node.visibility ?? "")) continue;
    if (discoveredTargets.has(node.id) && !usedTargets.has(node.id)) {
      groups.discovered.push(node);
      continue;
    }
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

function isSearchSchemaOperation(node: TraceBusinessNode): boolean {
  const operation = stringField(node.properties, "operation_name");
  return operation === "search_schema" || operation === "context.search_schema";
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

const operationNameKeys: Record<string, string> = {
  "data.query.observed": "runSql",
  "knowledge.read.observed": "getKnowledgeNetworkDetail",
  "logic.execution.observed": "calculateLogic",
  "retrieval.completed": "semanticRetrievalCompleted",
  "context.run_sql": "runSql",
  "context.search_schema": "searchSchema",
  run_sql: "runSql",
  search_schema: "searchSchema",
};

const artifactNameKeys: Record<string, string> = {
  data_result: "dataResult",
  logic_execution: "logicExecution",
  query: "query",
  question: "question",
  result: "result",
};

function traceText(key: string, options?: Record<string, unknown>) {
  return i18n.t(`bknTrace.explainability.${key}`, options);
}

function translateOperationName(key?: string) {
  return key ? i18n.t(`bknTrace.operations.${key}`) : undefined;
}

function artifactName(key?: string) {
  return key ? traceText(`artifacts.${key}`) : undefined;
}

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
  const operationTitle =
    translateOperationName(operationNameKeys[operationName]) ||
    translateOperationName(operationNameKeys[eventType]);
  if (node.nodeType === "operation" && operationTitle) {
    return {
      kind: traceText("kinds.operation"),
      subtitle: operationName || eventType,
      technicalId,
      title: operationTitle,
    };
  }
  if (node.nodeType === "interaction") {
    return {
      kind: traceText("kinds.interaction"),
      subtitle: traceText("interactionSubtitle"),
      technicalId,
      title: traceText("interactionTitle"),
    };
  }
  if (node.nodeType === "claim") {
    return {
      kind: traceText("kinds.claim"),
      subtitle: stringField(node.properties, "claim_type") || "answer",
      technicalId,
      title: traceText("claimTitle"),
    };
  }
  const artifactTitle = artifactName(artifactNameKeys[artifactType]);
  if (node.nodeType === "artifact" && artifactTitle) {
    return {
      kind: traceText("kinds.artifact"),
      subtitle: artifactType,
      technicalId,
      title: artifactTitle,
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
    return {
      kind: traceText("kinds.knowledgeNetwork"),
      subtitle: traceText("refs.knowledgeNetworkSubtitle"),
      title: traceText("refs.knowledgeNetworkTitle", { value: shortValue(parts[1] ?? ref) }),
    };
  }
  if (refType === "resource") {
    return {
      kind: traceText("kinds.dataResource"),
      subtitle: traceText("refs.dataResourceSubtitle"),
      title: traceText("refs.dataResourceTitle", { value: shortValue(parts[1] ?? ref) }),
    };
  }
  if (refType === "object") {
    return {
      kind: traceText("kinds.businessObject"),
      subtitle: compactJoin([
        parts[1] ? traceText("refs.knowledgeNetworkTitle", { value: shortValue(parts[1]) }) : "",
        traceText("refs.objectLabel"),
      ]),
      title: traceText("refs.businessObjectTitle", { value: shortValue(parts[2] || ref) }),
    };
  }
  if (refType === "property") {
    const objectName = parts[2] || "";
    const propertyName = parts[3] || ref;
    return {
      kind: traceText("kinds.businessProperty"),
      subtitle: compactJoin([objectName, traceText("refs.propertyLabel")]),
      title: traceText("refs.businessPropertyTitle", { value: propertyName }),
    };
  }
  return undefined;
}

function businessKindLabel(nodeType: string): string {
  switch (nodeType) {
  case "artifact":
    return traceText("kinds.artifact");
  case "claim":
    return traceText("kinds.claim");
  case "evidence_ref":
    return traceText("kinds.businessEvidence");
  case "interaction":
    return traceText("kinds.interaction");
  case "knowledge_network":
    return traceText("kinds.knowledgeNetwork");
  case "object":
  case "object_type":
    return traceText("kinds.businessObject");
  case "operation":
    return traceText("kinds.operation");
  case "property":
  case "field":
    return traceText("kinds.businessProperty");
  case "relation":
  case "relation_type":
    return traceText("kinds.businessRelation");
  case "resource":
  case "data_resource":
    return traceText("kinds.dataResource");
  case "metric":
  case "metric_type":
  case "function":
  case "function_type":
  case "logic":
  case "logic_execution":
    return traceText("kinds.businessLogic");
  case "action":
  case "action_instance":
  case "action_type":
    return traceText("kinds.businessAction");
  default:
    return nodeType || traceText("kinds.businessNode");
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
