/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CloseOutlined,
  CopyOutlined,
  DownloadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Input,
  Popover,
  Result,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CurrentExplanationPanel } from "../evidence-chain/CurrentExplanationPanel";
import i18n from "@/app/locales/i18n";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import {
  getBusinessProvenanceAnalysisHistory,
  getBusinessProvenanceConversations,
  getBusinessProvenanceInteraction,
  getBusinessProvenanceInteractions,
  getBusinessProvenanceMarkdown,
  streamBusinessProvenanceAnalysis,
  type BusinessProvenanceAnalysisHistory,
  type BusinessProvenanceConversation,
  type BusinessProvenanceInteraction,
  type BusinessProvenanceInteractionListItem,
  type OperationResolution,
} from "@/modules/bkn-trace/business-provenance/business-provenance.service";
import styles from "@/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css";

import {
  recordedCallScope,
  recordedResourceMappings,
  requestedObjectLabels,
  recordedMetricTarget,
} from "./call-scope";

type View = "timeline" | "evidence";
type AgentSuggestion = {
  id?: string;
  category?: string;
  location?: string;
  problem?: string;
  sourceEvidence?: string;
  verificationEvidence?: string;
  change?: string;
  acceptance?: string;
};
type AgentAdvice = {
  verdicts: Record<string, string | undefined>;
  conclusion?: string;
  suggestions: AgentSuggestion[];
  notEvaluable?: string;
};
type ConversationLoadState = "failed" | "forbidden" | "not-installed";

function bpText(key: string, options?: Record<string, string | number>) {
  return i18n.t(`bknTrace.businessProvenance.workspace.${key}`, options);
}

function responseStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== "object" || !("status" in response)) return undefined;
  return typeof response.status === "number" ? response.status : undefined;
}

function formatTime(value?: string) {
  if (!value) return bpText("timeNotRecorded");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString(i18n.language, { hour12: false })}`;
}

function formatClock(value?: string) {
  if (!value) return bpText("timeNotRecorded");
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(i18n.language, { hour12: false });
}

function formatDuration(value?: number) {
  if (value === undefined) return bpText("durationNotRecorded");
  if (value < 1000) return `${value}ms`;
  if (value < 60_000)
    return bpText("durationSeconds", { count: (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) });
  return bpText("durationMinutes", {
    minutes: Math.floor(value / 60_000),
    seconds: Math.round((value % 60_000) / 1000),
  });
}

function statusLabel(value?: string) {
  if (value === "completed") return bpText("status.completed");
  if (value === "failed") return bpText("status.failed");
  if (value === "active") return bpText("status.active");
  if (value === "running") return bpText("status.running");
  return value || bpText("notRecorded");
}

function roundLabel(item: BusinessProvenanceInteractionListItem | undefined) {
  if (item?.roundNumber && item.roundNumber > 0)
    return bpText("roundLabel", { index: item.roundNumber });
  return bpText("roundNotRecorded");
}

const MCP_TOOL_NAMES = [
  "bkn_finish_interaction",
  "bkn_start_interaction",
  "search_schema",
  "search_instance",
  "query_object_instance",
  "query_instance_subgraph",
  "explore_subgraph",
  "get_logic_properties_values",
  "query_metric",
  "get_action_info",
  "execute_action",
  "get_action_execution",
  "list_action_executions",
  "list_knowledge_networks",
  "get_kn_detail",
  "get_object_types",
  "get_relation_types",
  "run_sql",
  "run_cypher",
  "list_resources",
  "describe_resource",
  "list_skills",
  "get_skill_content",
  "read_skill_file",
  "execute_skill",
  "run_code",
  "run_shell",
  "search_capabilities",
  "execute_tool",
] as const;

function toolBusinessTitle(toolName?: string) {
  if (!toolName) return bpText("operation.call");
  const key = `toolTitles.${toolName}`;
  const translated = bpText(key);
  return translated === key || translated.endsWith(`.${key}`) ? toolName : translated;
}

function operationTitle(operation: OperationResolution) {
  const primary = operation.elements.filter((item) => !["property", "logic"].includes(item.kind));
  const elements = (primary.length ? primary : operation.elements)
    .map((item) => item.name || item.id)
    .filter(Boolean);
  if (
    ["run_sql", "run_cypher", "query_object_instance"].includes(operation.toolName ?? "") &&
    elements.length
  )
    return bpText("operation.queryElements", { elements: elements.join(bpText("listSeparator")) });
  return toolBusinessTitle(operation.toolName);
}

function compactText(value: string, maxLength = 150) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseRecordedValue(value: unknown): unknown {
  const payload = recordedPayload(value);
  if (typeof payload !== "string") return payload;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}

function toolCallsFromCode(value: unknown) {
  if (typeof value !== "string") return [];
  return MCP_TOOL_NAMES.filter((toolName) => value.includes(`${toolName}(`)).map(toolBusinessTitle);
}

function inputRecord(operation: OperationResolution) {
  const root = recordValue(parseRecordedValue(operation.input));
  if (!root) return undefined;
  return (
    recordValue(root.json) ?? recordValue(root.arguments) ?? recordValue(root.parameters) ?? root
  );
}

function conditionOperator(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const operator =
    (
      {
        "==": "=",
        eq: "=",
        equals: "=",
        "!=": "≠",
        ne: "≠",
        not_equals: "≠",
        gt: ">",
        gte: "≥",
        ge: "≥",
        lt: "<",
        lte: "≤",
        le: "≤",
        in: "in",
        not_in: "notIn",
        contains: "contains",
        not_contains: "notContains",
        and: "and",
        or: "or",
      } as Record<string, string>
    )[value.toLowerCase()] ?? value;
  return ["in", "notIn", "contains", "notContains", "and", "or"].includes(operator)
    ? bpText(`operation.operators.${operator}`)
    : operator;
}

function formatCondition(value: unknown): string {
  if (typeof value === "string") {
    const text = value.trim();
    if (/^(?:\[object Object\]\s*[,;；、]?\s*)+$/i.test(text)) return "";
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "object" && parsed !== null) return formatCondition(parsed);
    } catch {
      // Natural-language conditions are already useful as recorded.
    }
    return compactText(text);
  }
  if (Array.isArray(value))
    return value.map(formatCondition).filter(Boolean).join(bpText("conditionSeparator"));
  const condition = recordValue(value);
  if (!condition) return conditionValue(value);

  const field = [condition.field, condition.property, condition.column, condition.name].find(
    (candidate) => typeof candidate === "string",
  );
  const operator = conditionOperator(condition.operation ?? condition.operator ?? condition.op);
  const children =
    condition.sub_conditions ??
    condition.subConditions ??
    condition.conditions ??
    condition.children;
  if (Array.isArray(children)) {
    const nested = children.map(formatCondition).filter(Boolean).join(bpText("conditionSeparator"));
    if (nested) return operator ? `${operator}（${nested}）` : nested;
  }
  if (field && operator && Object.hasOwn(condition, "value"))
    return `${field} ${operator} ${conditionValue(condition.value)}`;
  if (field && Object.hasOwn(condition, "value"))
    return `${field} = ${conditionValue(condition.value)}`;

  return Object.entries(condition)
    .filter(([key]) => !["value_from", "valueFrom"].includes(key))
    .map(([key, item]) => `${key} = ${conditionValue(item)}`)
    .join(bpText("conditionSeparator"));
}

function operationCondition(operation: OperationResolution): string | undefined {
  const condition = operation.query?.conditions;
  if ((condition === undefined || condition === null) && operation.query?.sql)
    return bpText("operation.sqlSummary", { value: compactText(operation.query.sql) });
  if (condition !== undefined && condition !== null) {
    const formatted = formatCondition(condition);
    if (formatted) return formatted;
  }

  const input = inputRecord(operation);
  if (!input) return undefined;
  const codeCalls = toolCallsFromCode(input.code);
  if (operation.toolName === "run_code")
    return codeCalls.length
      ? bpText("operation.codeCalls", { calls: codeCalls.join(bpText("listSeparator")) })
      : undefined;
  if (typeof input.sql === "string")
    return bpText("operation.sqlSummary", { value: compactText(input.sql) });
  if (typeof input.cypher === "string")
    return bpText("operation.cypherSummary", { value: compactText(input.cypher) });
  if (typeof input.query === "string")
    return bpText(
      operation.toolName === "run_cypher" ? "operation.cypherSummary" : "operation.searchSummary",
      { value: compactText(input.query) },
    );
  if (operation.toolName === "run_shell" && typeof input.command === "string")
    return bpText("operation.commandSummary", { value: compactText(input.command) });
  const embeddedCondition = input.condition ?? input.conditions ?? input.filter ?? input.filters;
  if (embeddedCondition !== undefined) return formatCondition(embeddedCondition) || undefined;
  const identity = [
    ["kn_id", "operation.inputLabels.knowledgeNetwork"],
    ["resource_id", "operation.inputLabels.resource"],
    ["object_type_id", "operation.inputLabels.objectType"],
    ["ot_id", "operation.inputLabels.objectType"],
    ["relation_type_id", "operation.inputLabels.relationType"],
    ["metric_id", "operation.inputLabels.metric"],
    ["action_type_id", "operation.inputLabels.action"],
    ["skill_id", "operation.inputLabels.skill"],
    ["tool_name", "operation.inputLabels.tool"],
    ["ids", "operation.inputLabels.objectTypes"],
    ["object_type_ids", "operation.inputLabels.objectTypes"],
    ["relation_type_ids", "operation.inputLabels.relationTypes"],
  ] as const;
  const facts = identity.flatMap(([key, label]) =>
    input[key] === undefined ? [] : [`${bpText(label)}：${conditionValue(input[key])}`],
  );
  return facts.length ? facts.join(bpText("conditionSeparator")) : undefined;
}

function recordedPayload(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  const envelope = value as Record<string, unknown>;
  if (envelope.mode === "inline") return envelope.inline;
  if (envelope.mode === "omitted" || envelope.mode === "referenced") return undefined;
  return value;
}

function payloadText(value: unknown) {
  const content = recordedPayload(value);
  if (content === undefined) return undefined;
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 2);
}

function SourceText({
  title,
  preview,
  original,
  viewLabel,
  onCopy,
}: {
  title: string;
  preview?: string;
  original?: string;
  viewLabel: string;
  onCopy: (value: string) => void;
}) {
  if (!original) {
    if (!preview) return <p className={styles.sourceTextUnavailable}>{bpText("notRecorded")}</p>;
    return (
      <div className={styles.sourceTextUnavailable}>
        <span>{preview}</span>
        <small>{bpText("rounds.originalUnavailable")}</small>
      </div>
    );
  }
  return (
    <Popover
      trigger={["hover", "click"]}
      overlayClassName={styles.sourceTextPopover}
      content={
        <section className={styles.sourceTextPopoverContent}>
          <h4>{title}</h4>
          <MarkdownText text={original} variant="document" />
          <Button size="small" icon={<CopyOutlined />} onClick={() => onCopy(original)}>
            {bpText("detail.copyPayload")}
          </Button>
        </section>
      }
    >
      <button type="button" className={styles.sourceTextPreview} aria-label={viewLabel}>
        <span>{preview || bpText("notRecorded")}</span>
        <small>{bpText("rounds.viewFull")}</small>
      </button>
    </Popover>
  );
}

function conditionValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.map(conditionValue).join(bpText("listSeparator"));
  if (["string", "number", "boolean", "bigint"].includes(typeof value))
    return `${value as string | number | boolean | bigint}`;
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value;
}

function payloadMessage(value: unknown): string | undefined {
  const payload = parseRecordedValue(value);
  if (typeof payload === "string") return compactText(payload);
  const record = recordValue(payload);
  if (!record) return undefined;
  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      const text = recordValue(item)?.text;
      if (typeof text === "string" && text.trim()) return compactText(text);
    }
  }
  for (const key of ["message", "detail", "reason", "stderr", "error"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return compactText(candidate);
    const nested = payloadMessage(candidate);
    if (nested) return nested;
  }
  return undefined;
}

function resultRecord(value: unknown): Record<string, unknown> | undefined {
  const root = recordValue(parseRecordedValue(value));
  if (!root) return undefined;
  const structured =
    recordValue(root.structuredContent) ??
    recordValue(root.structured_content) ??
    recordValue(root.result);
  if (structured) return structured;
  if (Array.isArray(root.content)) {
    for (const item of root.content) {
      const text = recordValue(item)?.text;
      if (typeof text !== "string") continue;
      try {
        const parsed = recordValue(JSON.parse(text) as unknown);
        if (parsed) return parsed;
      } catch {
        /* Non-JSON MCP text remains available as a concise output message. */
      }
    }
  }
  return root;
}

function operationResult(
  operation: OperationResolution,
  derivedFacts: BusinessProvenanceInteraction["derivedFacts"] = [],
): string | undefined {
  if (operation.error) return payloadMessage(operation.error);
  if (
    derivedFacts.some(
      (fact) =>
        fact.rule === "changed_query_still_zero_result" &&
        fact.operationId === operation.operationId,
    )
  )
    return bpText("operation.changedQueryNoResult");
  if (operation.query?.resultCount !== undefined)
    return operation.query.resultCount === 0
      ? bpText("operation.zeroRows")
      : bpText("operation.rows", { count: operation.query.resultCount });
  const output = resultRecord(operation.output);
  if (!output) return payloadMessage(operation.output);
  const total = output.total_count ?? output.totalCount ?? output.row_count ?? output.rowCount;
  if (typeof total === "number")
    return total === 0 ? bpText("operation.zeroRows") : bpText("operation.rows", { count: total });
  for (const key of ["datas", "data", "rows", "items", "results"]) {
    if (Array.isArray(output[key]))
      return output[key].length === 0
        ? bpText("operation.zeroRows")
        : bpText("operation.rows", { count: output[key].length });
  }
  const countKeys = [
    ["object_types", "operation.resultLabels.objectTypes"],
    ["relation_types", "operation.resultLabels.relationTypes"],
    ["action_types", "operation.resultLabels.actionTypes"],
    ["metric_types", "operation.resultLabels.metricTypes"],
    ["knowledge_networks", "operation.resultLabels.networks"],
    ["columns", "operation.resultLabels.fields"],
    ["resources", "operation.resultLabels.resources"],
    ["skills", "operation.resultLabels.skills"],
    ["tools", "operation.resultLabels.tools"],
  ] as const;
  const counts = countKeys.flatMap(([key, label]) =>
    Array.isArray(output[key])
      ? [bpText("operation.namedCount", { count: output[key].length, name: bpText(label) })]
      : [],
  );
  if (counts.length)
    return bpText("operation.countResult", { counts: counts.join(bpText("listSeparator")) });
  const outputMessage =
    payloadMessage(output.stdout) ??
    payloadMessage(output.stderr) ??
    payloadMessage(output.message) ??
    payloadMessage(output.summary) ??
    payloadMessage(operation.output);
  return outputMessage ? bpText("operation.outputSummary", { value: outputMessage }) : undefined;
}

function requestedObjectDescription(
  operation: OperationResolution,
  operations: OperationResolution[] = [],
): string | undefined {
  const scope = recordedCallScope(operation);
  const names = requestedObjectLabels(operation, operations);
  if (scope.scopeConflict)
    return scope.objectIds.join(bpText("listSeparator")) || bpText("binding.scopeConflict");
  if (names.length) return names.join(bpText("listSeparator"));
  if (scope.objectIds.length) return scope.objectIds.join(bpText("listSeparator"));
  const mappings = scope.resourceMappings.length
    ? scope.resourceMappings
    : recordedResourceMappings(operation, operations);
  const mapped = mappings.map((item) => item.objectName || item.objectId).filter(Boolean);
  if (mapped.length) return [...new Set(mapped)].join(bpText("listSeparator"));
  if (scope.resourceIds.length) return scope.resourceIds.join(bpText("listSeparator"));
  if (scope.metricId) {
    const metric = recordedMetricTarget(operation, operations);
    if (metric?.objectId)
      return `${metric.name || scope.metricId} → ${metric.objectName || metric.objectId}${bpText("scope.recordedDefinition")}`;
    return bpText("scope.metricTarget", { id: metric?.name || scope.metricId });
  }
  if (operation.toolName === "run_code") {
    const calls = toolCallsFromCode(inputRecord(operation)?.code);
    return calls.length
      ? bpText("operation.callsObject", { calls: calls.join(bpText("listSeparator")) })
      : undefined;
  }
  return scope.networkId ? bpText("operation.networkObject", { id: scope.networkId }) : undefined;
}

function OperationName({ operation }: { operation: OperationResolution }) {
  return (
    <>
      {operationTitle(operation)}
      {operation.toolName ? (
        <small className={styles.operationInterface}>（{operation.toolName}）</small>
      ) : null}
    </>
  );
}

function OperationSummaryRows({
  operation,
  operations,
  derivedFacts,
}: {
  operation: OperationResolution;
  operations: OperationResolution[];
  derivedFacts: BusinessProvenanceInteraction["derivedFacts"];
}) {
  const rows = [
    [bpText("detail.businessObject"), requestedObjectDescription(operation, operations)],
    [bpText("detail.condition"), operationCondition(operation)],
    [bpText("detail.actualResult"), operationResult(operation, derivedFacts)],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <>
      {rows.flatMap(([label, value]) => [
        <dt key={`${label}-label`}>{label}</dt>,
        <dd key={`${label}-value`}>{value}</dd>,
      ])}
    </>
  );
}

function conversationTitle(conversation: BusinessProvenanceConversation) {
  const agent = conversation.agentName?.trim();
  return agent ? bpText("conversation.titleWithAgent", { agent }) : bpText("conversation.title");
}

function ClampedText({ value }: { value: string }) {
  return (
    <Tooltip title={value}>
      <span aria-label={value} className={styles.tableClamp}>
        {value}
      </span>
    </Tooltip>
  );
}

function evidenceLabel(conversation: BusinessProvenanceConversation) {
  if (conversation.evidenceCompleteness === "complete") return bpText("evidence.complete");
  if (conversation.evidenceCompleteness === "partial") return bpText("evidence.partial");
  return conversation.evidenceCompleteness || bpText("evidence.byRound");
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(textValue).filter((item): item is string => Boolean(item));
  return items.length ? items.join(bpText("listSeparator")) : undefined;
}

function scopeLabel(value?: string) {
  return (
    { bkn: "BKN", bkn_trace: "BKN Trace", mcp: "MCP", sdk: "SDK", agent: "Agent" } as Record<
      string,
      string
    >
  )[value ?? ""];
}

function agentAdvice(result?: Record<string, unknown>): AgentAdvice {
  if (!result) return { verdicts: {}, suggestions: [] };
  const source = (
    result.analysis && typeof result.analysis === "object" ? result.analysis : result
  ) as Record<string, unknown>;
  const rawVerdicts = (source.verdicts ?? source.classifications ?? source.category_decisions) as
    Record<string, unknown> | undefined;
  const verdicts: Record<string, string | undefined> = {};
  ["BKN", "BKN Trace", "MCP", "SDK", "Agent"].forEach((category) => {
    const key = category.toLowerCase().replace(" ", "_");
    const raw = rawVerdicts?.[category] ?? rawVerdicts?.[key] ?? source[key];
    verdicts[category] =
      typeof raw === "object" && raw
        ? textValue((raw as Record<string, unknown>).decision)
        : textValue(raw);
  });
  const suggestions =
    [source.recommendations, source.suggestions]
      .find(Array.isArray)
      ?.flatMap((item): AgentSuggestion[] => {
        if (typeof item === "string") return [{ change: item }];
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const scope = textValue(record.scope);
        return [
          {
            id: textValue(record.id) ?? textValue(record.recommendation_id),
            category: textValue(record.category) ?? textValue(record.type) ?? scopeLabel(scope),
            location: textValue(record.location) ?? textValue(record.target),
            problem: textValue(record.problem) ?? textValue(record.issue),
            sourceEvidence:
              textValue(record.source_evidence) ??
              textValue(record.trace_evidence) ??
              textList(record.trace_evidence_operation_ids),
            verificationEvidence:
              textValue(record.verification_evidence) ??
              textValue(record.core_evidence) ??
              textList(record.bkn_schema_evidence),
            change:
              textValue(record.change) ??
              textValue(record.recommendation) ??
              textValue(record.suggestion) ??
              textValue(record.action),
            acceptance:
              textValue(record.acceptance) ??
              textValue(record.acceptance_criteria) ??
              textValue(record.verification),
          },
        ];
      }) ?? [];
  const overall = textValue(source.decision);
  if (!rawVerdicts && overall) {
    ["BKN", "BKN Trace", "MCP", "SDK", "Agent"].forEach((category) => {
      verdicts[category] = overall === "no_change" ? "no_change" : "not_evaluable";
    });
    suggestions.forEach((suggestion) => {
      if (suggestion.category) verdicts[suggestion.category] = "change_required";
    });
  }
  return {
    verdicts,
    conclusion:
      textValue(source.conclusion) ??
      textValue(source.summary) ??
      textValue(source.message) ??
      textValue(source.content),
    suggestions,
    notEvaluable: textValue(source.not_evaluable) ?? textValue(source.unknowns),
  };
}

function decisionLabel(value?: string) {
  if (value === "change_required") return bpText("decision.changeRequired");
  if (value === "no_change") return bpText("decision.noChange");
  if (value === "not_evaluable") return bpText("decision.notEvaluable");
  return value || bpText("notReturned");
}

function adviceMarkdown(advice: AgentAdvice) {
  const missing = bpText("notReturned");
  const verdicts = ["BKN", "BKN Trace", "MCP", "SDK", "Agent"]
    .map((category) => `- ${category}: ${decisionLabel(advice.verdicts[category])}`)
    .join("\n");
  const recommendations = advice.suggestions
    .map(
      (item, index) =>
        `### ${item.id || `REC-${index + 1}`}\n\n- ${bpText("agent.category")}: ${item.category || missing}\n- ${bpText("agent.location")}: ${item.location || missing}\n- ${bpText("agent.problem")}: ${item.problem || missing}\n- ${bpText("agent.sourceEvidence")}: ${item.sourceEvidence || missing}\n- ${bpText("agent.verificationEvidence")}: ${item.verificationEvidence || missing}\n- ${bpText("agent.change")}: ${item.change || missing}\n- ${bpText("agent.acceptance")}: ${item.acceptance || missing}`,
    )
    .join("\n\n");
  return `# ${bpText("agent.markdownTitle")}\n\n## ${bpText("agent.verdicts")}\n\n${verdicts}\n\n## ${bpText("agent.recommendations")}\n\n${recommendations || bpText("agent.noRecommendations")}${advice.notEvaluable ? `\n\n## ${bpText("agent.unableToDetermine")}\n\n${advice.notEvaluable}` : ""}`;
}

export function BusinessProvenanceScene() {
  const { t } = useTranslation();
  const [linkedConversationId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("conversation_id") ?? params.get("conversationId"))?.trim() ?? "";
  });
  const [linkedInteractionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("interaction_id") ?? params.get("interactionId"))?.trim() ?? "";
  });
  const [conversations, setConversations] = useState<BusinessProvenanceConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationKeyword, setConversationKeyword] = useState("");
  const [conversationAgent, setConversationAgent] = useState("");
  const [conversationKnowledgeNetwork, setConversationKnowledgeNetwork] = useState("");
  const [conversationStatus, setConversationStatus] = useState<string>();
  const [conversationEvidence, setConversationEvidence] = useState<string>();
  const [conversationQuery, setConversationQuery] = useState<
    Parameters<typeof getBusinessProvenanceConversations>[0]
  >(() => (linkedConversationId ? { conversationId: linkedConversationId } : {}));
  const [selectedConversation, setSelectedConversation] =
    useState<BusinessProvenanceConversation>();
  const [interactionKeyword, setInteractionKeyword] = useState("");
  const [interactions, setInteractions] = useState<BusinessProvenanceInteractionListItem[]>([]);
  const [interactionTotal, setInteractionTotal] = useState(0);
  const [selectedInteraction, setSelectedInteraction] =
    useState<BusinessProvenanceInteractionListItem>();
  const [projection, setProjection] = useState<BusinessProvenanceInteraction>();
  const [interactionListLoading, setInteractionListLoading] = useState(false);
  const [interactionListError, setInteractionListError] = useState(false);
  const [interactionDetailLoading, setInteractionDetailLoading] = useState(false);
  const [interactionDetailError, setInteractionDetailError] = useState(false);
  const [projectionUnavailable, setProjectionUnavailable] = useState(false);
  const [interactionReload, setInteractionReload] = useState(0);
  const [view, setView] = useState<View>("timeline");
  const [roundsCollapsed, setRoundsCollapsed] = useState(
    () =>
      typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1200px)").matches,
  );
  const [timelineFilter, setTimelineFilter] = useState<"all" | "completed" | "failed">("all");
  const [detailOperation, setDetailOperation] = useState<OperationResolution>();
  const [evidencePanel, setEvidencePanel] = useState<"evidence" | "execution">("evidence");
  const [loading, setLoading] = useState(true);
  const [conversationLoadState, setConversationLoadState] = useState<ConversationLoadState>();
  const [analysisStarting, setAnalysisStarting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown>>();
  const [analysisHistory, setAnalysisHistory] = useState<BusinessProvenanceAnalysisHistory[]>([]);
  const [analysisStreamText, setAnalysisStreamText] = useState("");
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [analysisMarkdown, setAnalysisMarkdown] = useState("");
  const [analysisMarkdownLoading, setAnalysisMarkdownLoading] = useState(false);
  const conversationRequest = useRef(0);
  const timelineInspectorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (timelineInspectorRef.current) timelineInspectorRef.current.scrollTop = 0;
  }, [detailOperation?.operationId]);

  const loadConversations = useCallback(async () => {
    const request = ++conversationRequest.current;
    setLoading(true);
    setConversationLoadState(undefined);
    try {
      const page = await getBusinessProvenanceConversations({
        ...conversationQuery,
        page: conversationPage,
        pageSize: 20,
      });
      if (request !== conversationRequest.current) return;
      setConversations(page.entries);
      setConversationTotal(page.total);
      if (linkedConversationId) {
        const linked = page.entries.find((entry) => entry.conversationId === linkedConversationId);
        if (linked) setSelectedConversation((current) => current ?? linked);
      }
    } catch (error) {
      if (request !== conversationRequest.current) return;
      const status = responseStatus(error);
      setConversationLoadState(
        status === 404 ? "not-installed" : status === 403 ? "forbidden" : "failed",
      );
    } finally {
      if (request === conversationRequest.current) setLoading(false);
    }
  }, [conversationPage, conversationQuery, linkedConversationId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);
  useEffect(() => {
    if (!selectedConversation) return;
    let current = true;
    setInteractions([]);
    setInteractionTotal(0);
    setSelectedInteraction(undefined);
    setInteractionListLoading(true);
    setInteractionListError(false);
    setProjection(undefined);
    setDetailOperation(undefined);
    setProjectionUnavailable(false);
    setAnalysisResult(undefined);
    setAnalysisHistory([]);
    setAnalysisPanelOpen(false);
    setAnalysisError(undefined);
    void getBusinessProvenanceInteractions({
      conversationId: selectedConversation.conversationId,
      page: 1,
      pageSize: 50,
      keyword: interactionKeyword,
    })
      .then((page) => {
        if (current) {
          setInteractions(page.entries);
          setInteractionTotal(page.total);
          setSelectedInteraction(
            page.entries.find((item) => item.interactionId === linkedInteractionId) ||
              page.entries[0],
          );
        }
      })
      .catch(() => {
        if (current) {
          setInteractionListError(true);
          message.error(bpText("errors.interactionsLoad"));
        }
      })
      .finally(() => {
        if (current) setInteractionListLoading(false);
      });
    return () => {
      current = false;
    };
  }, [interactionKeyword, linkedInteractionId, selectedConversation]);
  useEffect(() => {
    if (!selectedInteraction) {
      setProjection(undefined);
      setDetailOperation(undefined);
      setInteractionDetailLoading(false);
      setInteractionDetailError(false);
      setProjectionUnavailable(false);
      return;
    }
    let current = true;
    setProjection(undefined);
    setDetailOperation(undefined);
    setTimelineFilter("all");
    setEvidencePanel("evidence");
    setInteractionDetailLoading(true);
    setInteractionDetailError(false);
    setProjectionUnavailable(false);
    setAnalysisMarkdown("");
    setAnalysisMarkdownLoading(false);
    setAnalysisResult(undefined);
    setAnalysisHistory([]);
    setAnalysisStreamText("");
    setAnalysisPanelOpen(false);
    setAnalysisError(undefined);
    setAnalysisStarting(false);
    void getBusinessProvenanceInteraction(selectedInteraction.interactionId)
      .then((value) => {
        if (!current) return;
        setProjection(value);
        setDetailOperation(value.operations[0]);
        setAnalysisMarkdownLoading(true);
        void getBusinessProvenanceMarkdown(selectedInteraction.interactionId)
          .then((markdown) => {
            if (current) setAnalysisMarkdown(markdown);
          })
          .catch(() => {
            if (current) message.error(bpText("errors.markdownLoad"));
          })
          .finally(() => {
            if (current) setAnalysisMarkdownLoading(false);
          });
        void getBusinessProvenanceAnalysisHistory(selectedInteraction.interactionId)
          .then((entries) => {
            if (!current) return;
            setAnalysisHistory(entries);
            const latest = entries.find((entry) => entry.status === "completed" && entry.result);
            setAnalysisResult(latest?.result);
          })
          .catch(() => {
            if (current) setAnalysisHistory([]);
          });
      })
      .catch((error) => {
        if (!current) return;
        if (responseStatus(error) !== 404) {
          setInteractionDetailError(true);
          message.error(bpText("errors.factsLoad"));
          return;
        }
        setProjectionUnavailable(true);
        setAnalysisMarkdownLoading(true);
        void getBusinessProvenanceMarkdown(selectedInteraction.interactionId)
          .then((markdown) => {
            if (current) setAnalysisMarkdown(markdown);
          })
          .catch(() => {
            if (current) message.error(bpText("errors.markdownLoad"));
          })
          .finally(() => {
            if (current) setAnalysisMarkdownLoading(false);
          });
      })
      .finally(() => {
        if (current) setInteractionDetailLoading(false);
      });
    return () => {
      current = false;
    };
  }, [interactionReload, selectedInteraction]);

  const startAnalysis = useCallback(async () => {
    if (!selectedInteraction || !analysisMarkdown.trim()) return;
    setAnalysisError(undefined);
    setAnalysisResult(undefined);
    setAnalysisStreamText("");
    setAnalysisStarting(true);
    try {
      const result = await streamBusinessProvenanceAnalysis(
        selectedInteraction.interactionId,
        analysisMarkdown,
        (token) => setAnalysisStreamText((current) => current + token),
      );
      setAnalysisResult(result);
      setAnalysisHistory(
        await getBusinessProvenanceAnalysisHistory(selectedInteraction.interactionId),
      );
    } catch (error) {
      setAnalysisError(bpText("agent.failureWithReason", { reason: analysisErrorMessage(error) }));
    } finally {
      setAnalysisStarting(false);
    }
  }, [analysisMarkdown, selectedInteraction]);

  const copyMarkdown = useCallback(async () => {
    if (!selectedInteraction || !analysisMarkdown) return;
    try {
      await writeTextToClipboard(analysisMarkdown);
      message.success(bpText("agent.markdownCopied"));
    } catch {
      message.error(bpText("agent.copyFailed"));
    }
  }, [analysisMarkdown, selectedInteraction]);

  const copyPayload = useCallback(async (value: unknown) => {
    const content = payloadText(value);
    if (!content) return;
    await writeTextToClipboard(content);
    message.success(bpText("detail.payloadCopied"));
  }, []);

  const copySourceText = useCallback((value: string) => {
    void writeTextToClipboard(value).then(() => message.success(bpText("detail.payloadCopied")));
  }, []);

  const downloadMarkdown = useCallback(() => {
    if (!selectedInteraction || !analysisMarkdown) return;
    const url = URL.createObjectURL(
      new Blob([analysisMarkdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `knowledge-network-optimization-${selectedInteraction.interactionId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [analysisMarkdown, selectedInteraction]);

  const prepareAnalysis = useCallback(() => {
    setAnalysisResult(undefined);
    setAnalysisError(undefined);
    setAnalysisStreamText("");
  }, []);

  const submitConversationQuery = useCallback(() => {
    setConversationPage(1);
    setConversationQuery({
      keyword: conversationKeyword,
      agentOrApp: conversationAgent,
      knowledgeNetwork: conversationKnowledgeNetwork,
      status: conversationStatus,
      evidenceCompleteness: conversationEvidence,
    });
  }, [
    conversationAgent,
    conversationEvidence,
    conversationKeyword,
    conversationKnowledgeNetwork,
    conversationStatus,
  ]);

  const conversationColumns: ColumnsType<BusinessProvenanceConversation> = [
    {
      dataIndex: "startedAt",
      title: bpText("columns.startedAt"),
      width: "15%",
      render: (value: string | undefined, item) => (
        <div className={styles.timeCell}>
          <b>{formatTime(value)}</b>
          <small>{item.conversationId}</small>
        </div>
      ),
    },
    {
      dataIndex: "questionPreview",
      title: bpText("columns.question"),
      width: "20%",
      render: (value: string | undefined, item) => {
        const text = value || bpText("questionNotRecorded");
        return (
          <Tooltip title={text}>
            <Button
              aria-label={text}
              type="link"
              className={styles.questionLink}
              onClick={() => setSelectedConversation(item)}
            >
              {text}
            </Button>
          </Tooltip>
        );
      },
    },
    {
      dataIndex: "interactionCount",
      title: bpText("columns.interactions"),
      width: "8%",
      align: "center",
      render: (value?: number) => value ?? 0,
    },
    {
      dataIndex: "resultPreview",
      title: bpText("columns.result"),
      width: "20%",
      render: (value?: string) => <ClampedText value={value || "—"} />,
    },
    {
      dataIndex: "agentName",
      title: "Agent",
      width: "14%",
      render: (value?: string) => <ClampedText value={value || bpText("agentNotRecorded")} />,
    },
    {
      dataIndex: "status",
      title: bpText("columns.status"),
      width: "8%",
      render: (value?: string) => <span className={styles.statusText}>{statusLabel(value)}</span>,
    },
    {
      title: bpText("columns.evidence"),
      width: "9%",
      render: (_, item) => <span className={styles.evidence}>{evidenceLabel(item)}</span>,
    },
    {
      dataIndex: "durationMs",
      title: bpText("columns.duration"),
      width: "6%",
      render: (value?: number) => formatDuration(value),
    },
  ];

  if (conversationLoadState) {
    const state = {
      failed: {
        status: "error" as const,
        title: t("bknTrace.businessProvenance.loadFailed"),
        subTitle: t("bknTrace.businessProvenance.loadFailedDescription"),
      },
      forbidden: {
        status: "403" as const,
        title: t("bknTrace.businessProvenance.forbidden"),
        subTitle: t("bknTrace.businessProvenance.forbiddenDescription"),
      },
      "not-installed": {
        status: "warning" as const,
        title: t("bknTrace.businessProvenance.imageMissing"),
        subTitle: t("bknTrace.businessProvenance.imageMissingDescription"),
      },
    }[conversationLoadState];
    return (
      <main className={`${styles.page} ${styles.pageSurface}`}>
        <Result
          status={state.status}
          title={state.title}
          subTitle={state.subTitle}
          extra={
            conversationLoadState === "failed" ? (
              <Button type="primary" onClick={() => void loadConversations()}>
                {t("bknTrace.businessProvenance.retry")}
              </Button>
            ) : undefined
          }
        />
      </main>
    );
  }

  if (!selectedConversation)
    return (
      <main className={`${styles.page} ${styles.pageSurface}`}>
        <header className={styles.pageHeader}>
          <div>
            <Typography.Title level={3}>{bpText("list.title")}</Typography.Title>
            <Typography.Text>{bpText("list.description")}</Typography.Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>
            {bpText("actions.refresh")}
          </Button>
        </header>
        <section className={styles.listCard}>
          <div className={styles.filters}>
            <Input
              value={conversationKeyword}
              onChange={(event) => setConversationKeyword(event.target.value)}
              onPressEnter={submitConversationQuery}
              prefix={<SearchOutlined />}
              placeholder={bpText("filters.keyword")}
            />
            <Input
              value={conversationAgent}
              onChange={(event) => setConversationAgent(event.target.value)}
              onPressEnter={submitConversationQuery}
              placeholder={bpText("filters.agent")}
            />
            <Input
              value={conversationKnowledgeNetwork}
              onChange={(event) => setConversationKnowledgeNetwork(event.target.value)}
              onPressEnter={submitConversationQuery}
              placeholder={bpText("filters.network")}
            />
            <Select
              aria-label={bpText("filters.status")}
              allowClear
              placeholder={bpText("filters.status")}
              value={conversationStatus}
              options={[
                { value: "completed", label: statusLabel("completed") },
                { value: "failed", label: statusLabel("failed") },
                { value: "active", label: statusLabel("active") },
              ]}
              onChange={setConversationStatus}
            />
            <Select
              allowClear
              placeholder={bpText("filters.evidence")}
              value={conversationEvidence}
              options={[
                { value: "complete", label: bpText("evidence.complete") },
                { value: "partial", label: bpText("evidence.partial") },
              ]}
              onChange={setConversationEvidence}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={submitConversationQuery}>
              {bpText("actions.query")}
            </Button>
            <Button
              aria-label={bpText("actions.reset")}
              icon={<ReloadOutlined />}
              onClick={() => {
                setConversationKeyword("");
                setConversationAgent("");
                setConversationKnowledgeNetwork("");
                setConversationStatus(undefined);
                setConversationEvidence(undefined);
                setConversationPage(1);
                setConversationQuery({});
              }}
            />
          </div>
          <Table
            rowKey="conversationId"
            columns={conversationColumns}
            dataSource={conversations}
            loading={loading}
            tableLayout="fixed"
            locale={{ emptyText: <Empty description={bpText("list.empty")} /> }}
            pagination={{
              current: conversationPage,
              pageSize: 20,
              total: conversationTotal,
              showSizeChanger: false,
              showTotal: (total) => bpText("list.total", { count: total }),
              onChange: setConversationPage,
            }}
          />
        </section>
      </main>
    );

  const visibleOperations =
    projection?.operations
      .map((operation, index) => ({ operation, index }))
      .filter(
        ({ operation }) => timelineFilter === "all" || operation.callStatus === timelineFilter,
      ) ?? [];

  return (
    <main className={`${styles.page} ${styles.pageSurface}`}>
      <header className={styles.pageHeader}>
        <div>
          <Typography.Title level={3}>{bpText("analysis.title")}</Typography.Title>
          <Typography.Text>{bpText("analysis.description")}</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>
          {bpText("actions.refresh")}
        </Button>
      </header>
      <section
        className={`${styles.workspace} ${roundsCollapsed ? styles.workspaceRoundsCollapsed : ""}`}
      >
        <header className={styles.workspaceHeader}>
          <Button
            type="link"
            className={styles.backButton}
            onClick={() => {
              setSelectedConversation(undefined);
              setSelectedInteraction(undefined);
              setProjection(undefined);
            }}
          >
            ← {bpText("actions.back")}
          </Button>
          <div className={styles.conversationHeading}>
            <h1>{conversationTitle(selectedConversation)}</h1>
            <span>{selectedConversation.conversationId}</span>
            <span>
              {bpText("interactionCount", {
                count: selectedConversation.interactionCount ?? interactionTotal,
              })}
            </span>
            <span>{selectedConversation.agentName || bpText("agentNotRecorded")}</span>
          </div>
        </header>
        <aside
          className={`${styles.roundSidebar} ${roundsCollapsed ? styles.roundSidebarCollapsed : ""}`}
        >
          <div className={styles.roundSidebarTitle}>
            <div>
              <h3>{bpText("rounds.title")}</h3>
              <span>
                {interactionListLoading
                  ? bpText("rounds.loading")
                  : bpText("rounds.summary", {
                      total: selectedConversation.interactionCount ?? interactionTotal,
                      current:
                        selectedInteraction?.roundNumber && selectedInteraction.roundNumber > 0
                          ? selectedInteraction.roundNumber
                          : bpText("roundNotRecorded"),
                    })}
              </span>
            </div>
            <Button
              type="text"
              className={styles.roundCollapseButton}
              aria-label={roundsCollapsed ? bpText("rounds.expand") : bpText("rounds.collapse")}
              icon={roundsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setRoundsCollapsed((value) => !value)}
            />
          </div>
          <Input
            value={interactionKeyword}
            onChange={(event) => setInteractionKeyword(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder={bpText("rounds.search")}
          />
          <div className={styles.roundList}>
            {interactionListLoading ? (
              <div className={styles.roundLoading}>
                <Spin size="small" />
                {bpText("rounds.loading")}
              </div>
            ) : interactionListError ? (
              <Alert type="error" showIcon message={bpText("errors.interactionsLoad")} />
            ) : (
              interactions.map((item) => (
                <button
                  key={item.interactionId}
                  className={
                    item.interactionId === selectedInteraction?.interactionId
                      ? styles.roundSelected
                      : ""
                  }
                  onClick={() => setSelectedInteraction(item)}
                >
                  <span className={styles.roundCompactLabel}>
                    {item.roundNumber && item.roundNumber > 0 ? item.roundNumber : "•"}
                  </span>
                  <b>{roundLabel(item)}</b>
                  <strong>{item.questionPreview || bpText("questionNotRecorded")}</strong>
                  <small>
                    {formatClock(item.startedAt)} · {formatDuration(item.durationMs)} ·{" "}
                    {statusLabel(item.status)}
                  </small>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className={styles.analysisPane}>
          {interactionListLoading ? (
            <div className={styles.workspaceEmpty}>
              <Spin size="large" />
              <span>{bpText("rounds.loading")}</span>
            </div>
          ) : interactionDetailLoading ? (
            <div className={styles.workspaceEmpty}>
              <Spin size="large" />
              <span>{bpText("rounds.loadingFacts")}</span>
            </div>
          ) : interactionDetailError ? (
            <Result
              status="error"
              title={bpText("errors.factsLoad")}
              extra={
                <Button type="primary" onClick={() => setInteractionReload((value) => value + 1)}>
                  {t("bknTrace.businessProvenance.retry")}
                </Button>
              }
            />
          ) : projectionUnavailable ? (
            <Result
              status="info"
              title={bpText("legacy.title")}
              subTitle={bpText("legacy.description")}
              extra={
                <>
                  <Button
                    aria-label={bpText("legacy.copyMarkdown")}
                    icon={<CopyOutlined />}
                    disabled={analysisMarkdownLoading || !analysisMarkdown}
                    onClick={() => void copyMarkdown()}
                  >
                    {bpText("legacy.copyMarkdown")}
                  </Button>
                  <Button
                    aria-label={bpText("legacy.downloadMarkdown")}
                    icon={<DownloadOutlined />}
                    disabled={analysisMarkdownLoading || !analysisMarkdown}
                    onClick={() => void downloadMarkdown()}
                  >
                    {bpText("legacy.downloadMarkdown")}
                  </Button>
                </>
              }
            />
          ) : projection && selectedInteraction ? (
            <>
              <section className={styles.interactionSummary}>
                <header>
                  <div>
                    <span>{roundLabel(selectedInteraction)}</span>
                    <h2>{bpText("rounds.currentInteraction")}</h2>
                  </div>
                  <small>
                    {selectedConversation.agentName || bpText("agentNotRecorded")} ·{" "}
                    {formatTime(selectedInteraction.startedAt)} ·{" "}
                    {formatDuration(selectedInteraction.durationMs)} ·{" "}
                    {statusLabel(selectedInteraction.status)}
                  </small>
                </header>
                <div className={styles.sourceTexts}>
                  <div>
                    <h4>{bpText("rounds.inputOriginal")}</h4>
                    <SourceText
                      title={bpText("rounds.inputOriginal")}
                      preview={
                        projection.interactionQuestion || selectedInteraction.questionPreview
                      }
                      original={projection.interactionQuestion}
                      viewLabel={bpText("rounds.viewFullInput")}
                      onCopy={copySourceText}
                    />
                  </div>
                  <div>
                    <h4>{bpText("rounds.outputOriginal")}</h4>
                    <SourceText
                      title={bpText("rounds.outputOriginal")}
                      preview={projection.interactionResult || selectedInteraction.resultPreview}
                      original={projection.interactionResult}
                      viewLabel={bpText("rounds.viewFullOutput")}
                      onCopy={copySourceText}
                    />
                  </div>
                </div>
                <footer className={styles.interactionActions}>
                  <Button
                    aria-label={bpText("actions.copyMarkdown")}
                    icon={<CopyOutlined />}
                    disabled={analysisMarkdownLoading || !analysisMarkdown}
                    onClick={() => void copyMarkdown()}
                  >
                    {bpText("actions.copyMarkdown")}
                  </Button>
                  <Button
                    aria-label={bpText("actions.downloadMarkdown")}
                    icon={<DownloadOutlined />}
                    disabled={analysisMarkdownLoading || !analysisMarkdown}
                    onClick={downloadMarkdown}
                  >
                    {bpText("actions.downloadMarkdown")}
                  </Button>
                  <Button
                    aria-label={bpText("actions.analyze")}
                    type="primary"
                    disabled={analysisMarkdownLoading || !analysisMarkdown.trim()}
                    onClick={() => setAnalysisPanelOpen(true)}
                  >
                    {bpText("actions.analyze")}
                  </Button>
                </footer>
              </section>
              <div className={styles.viewTabs} role="tablist" aria-label={bpText("views.label")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "timeline"}
                  className={view === "timeline" ? styles.viewTabSelected : ""}
                  onClick={() => setView("timeline")}
                >
                  {bpText("views.timeline")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "evidence"}
                  className={view === "evidence" ? styles.viewTabSelected : ""}
                  onClick={() => setView("evidence")}
                >
                  {bpText("views.evidence")}
                </button>
              </div>
              {view === "timeline" ? (
                <section className={styles.timelineWorkspace}>
                  <header className={styles.timelineHeader}>
                    <div>
                      <h3>{bpText("timeline.title")}</h3>
                      <p>{bpText("timeline.description")}</p>
                    </div>
                    <span>{bpText("callCount", { count: projection.operations.length })}</span>
                  </header>
                  <div
                    className={styles.timelineFilters}
                    role="group"
                    aria-label={bpText("timeline.filterLabel")}
                  >
                    <button
                      type="button"
                      className={timelineFilter === "all" ? styles.timelineFilterActive : ""}
                      onClick={() => {
                        setTimelineFilter("all");
                        setDetailOperation(projection.operations[0]);
                      }}
                    >
                      {bpText("timeline.all", { count: projection.operations.length })}
                    </button>
                    <button
                      type="button"
                      className={timelineFilter === "completed" ? styles.timelineFilterActive : ""}
                      onClick={() => {
                        setTimelineFilter("completed");
                        setDetailOperation(
                          projection.operations.find((item) => item.callStatus === "completed"),
                        );
                      }}
                    >
                      {bpText("timeline.completed", {
                        count: projection.operations.filter(
                          (item) => item.callStatus === "completed",
                        ).length,
                      })}
                    </button>
                    <button
                      type="button"
                      className={timelineFilter === "failed" ? styles.timelineFilterActive : ""}
                      onClick={() => {
                        setTimelineFilter("failed");
                        setDetailOperation(
                          projection.operations.find((item) => item.callStatus === "failed"),
                        );
                      }}
                    >
                      {bpText("timeline.failed", {
                        count: projection.operations.filter((item) => item.callStatus === "failed")
                          .length,
                      })}
                    </button>
                  </div>
                  {projection.operations.length === 0 ? (
                    <Empty
                      description={bpText("rounds.noOperations")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : visibleOperations.length === 0 ? (
                    <Empty
                      description={bpText("timeline.emptyFiltered")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <div className={styles.timelineLayout}>
                      <div className={styles.timelineList}>
                        {visibleOperations.map(({ operation, index }) => (
                          <button
                            type="button"
                            className={`${styles.timelineBusinessCard} ${detailOperation?.operationId === operation.operationId ? styles.timelineBusinessCardSelected : ""}`}
                            key={operation.operationId}
                            onClick={() => setDetailOperation(operation)}
                          >
                            <span className={styles.timelineOrder}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <header>
                                <h4>
                                  <OperationName operation={operation} />
                                </h4>
                                <Tag
                                  color={operation.callStatus === "completed" ? "success" : "error"}
                                >
                                  {statusLabel(operation.callStatus)}
                                </Tag>
                              </header>
                              <dl>
                                <OperationSummaryRows
                                  operation={operation}
                                  operations={projection.operations}
                                  derivedFacts={projection.derivedFacts}
                                />
                              </dl>
                              <footer>
                                <small>
                                  {formatClock(operation.startedAt)} ·{" "}
                                  {formatDuration(operation.durationMs)}
                                </small>
                              </footer>
                            </div>
                          </button>
                        ))}
                      </div>
                      <aside
                        ref={timelineInspectorRef}
                        className={styles.timelineInspector}
                        aria-label={bpText("detail.roundCall")}
                      >
                        {detailOperation ? (
                          <>
                            <header>
                              <div>
                                <small>{bpText("detail.roundCall")}</small>
                                <h3>
                                  <OperationName operation={detailOperation} />
                                </h3>
                              </div>
                              <span
                                className={
                                  detailOperation.callStatus === "completed"
                                    ? styles.completed
                                    : styles.failed
                                }
                              >
                                {statusLabel(detailOperation.callStatus)}
                              </span>
                            </header>
                            <dl>
                              <OperationSummaryRows
                                operation={detailOperation}
                                operations={projection.operations}
                                derivedFacts={projection.derivedFacts}
                              />
                              <dt>{bpText("detail.operationId")}</dt>
                              <dd>
                                <code>{detailOperation.operationId}</code>
                              </dd>
                            </dl>
                            {payloadText(detailOperation.input) ? (
                              <details>
                                <summary>{bpText("detail.recordedInput")}</summary>
                                <pre>{payloadText(detailOperation.input)}</pre>
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => void copyPayload(detailOperation.input)}
                                >
                                  {bpText("detail.copyPayload")}
                                </Button>
                              </details>
                            ) : null}
                            {payloadText(detailOperation.output) ? (
                              <details>
                                <summary>{bpText("detail.recordedOutput")}</summary>
                                <pre>{payloadText(detailOperation.output)}</pre>
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => void copyPayload(detailOperation.output)}
                                >
                                  {bpText("detail.copyPayload")}
                                </Button>
                              </details>
                            ) : null}
                            {payloadText(detailOperation.error) ? (
                              <details>
                                <summary>{bpText("detail.recordedError")}</summary>
                                <pre>{payloadText(detailOperation.error)}</pre>
                              </details>
                            ) : null}
                          </>
                        ) : (
                          <Empty
                            description={bpText("timeline.selectCall")}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        )}
                      </aside>
                    </div>
                  )}
                </section>
              ) : (
                <CurrentExplanationPanel
                  key={selectedInteraction.interactionId}
                  interactionId={selectedInteraction.interactionId}
                  panel={evidencePanel}
                  onPanelChange={(next) =>
                    setEvidencePanel(next === "execution" ? "execution" : "evidence")
                  }
                />
              )}
            </>
          ) : (
            <Empty className={styles.workspaceEmpty} description={bpText("rounds.select")} />
          )}
        </section>
      </section>
      {analysisPanelOpen ? (
        <div className={styles.agentDrawerMask}>
          <aside className={styles.agentPanel}>
            <header>
              <div>
                <small>{bpText("agent.title")}</small>
                <b>{bpText("agent.currentRound")}</b>
              </div>
              <Button
                type="text"
                icon={<CloseOutlined />}
                aria-label={bpText("agent.close")}
                onClick={() => setAnalysisPanelOpen(false)}
              />
            </header>
            <p className={styles.agentIntro}>{bpText("agent.intro")}</p>
            <div className={styles.agentSource}>
              <strong>
                {roundLabel(selectedInteraction)} ·{" "}
                {selectedInteraction?.questionPreview || bpText("roundQuestionNotRecorded")}
              </strong>
              <small>
                {selectedInteraction?.interactionId}
                <br />
                {formatTime(selectedInteraction?.startedAt)} ·{" "}
                {formatDuration(selectedInteraction?.durationMs)} ·{" "}
                {bpText("callCount", { count: projection?.operations.length ?? 0 })}
              </small>
            </div>
            {analysisHistory.length ? (
              <Select
                aria-label={bpText("agent.history")}
                value={
                  analysisHistory.find((item) => item.result === analysisResult)?.analysisId ??
                  analysisHistory[0]?.analysisId
                }
                options={analysisHistory.map((item, index) => ({
                  value: item.analysisId,
                  label: bpText("agent.historyItem", {
                    index: analysisHistory.length - index,
                    time: formatTime(item.startedAt),
                    status:
                      item.status === "completed"
                        ? statusLabel("completed")
                        : item.status === "failed"
                          ? statusLabel("failed")
                          : bpText("agent.analyzing"),
                  }),
                }))}
                onChange={(analysisId) => {
                  const selected = analysisHistory.find((item) => item.analysisId === analysisId);
                  setAnalysisResult(selected?.result);
                  setAnalysisError(
                    selected?.status === "failed"
                      ? bpText("agent.failureWithReason", {
                          reason: selected.failureMessage || bpText("agent.failureReasonMissing"),
                        })
                      : undefined,
                  );
                }}
              />
            ) : null}
            {!analysisStarting && !analysisResult && !analysisError ? (
              <section className={styles.agentEditor}>
                <h4>{bpText("agent.markdownToAnalyze")}</h4>
                <p>{bpText("agent.editorDescription")}</p>
                <Input.TextArea
                  aria-label={bpText("agent.markdownToAnalyze")}
                  value={analysisMarkdown}
                  readOnly
                  autoSize={{ minRows: 14, maxRows: 24 }}
                  disabled={analysisMarkdownLoading}
                  placeholder={
                    analysisMarkdownLoading
                      ? bpText("agent.generatingMarkdown")
                      : bpText("agent.markdownUnavailable")
                  }
                />
                <div className={styles.agentEditorActions}>
                  <Button
                    icon={<CopyOutlined />}
                    disabled={!analysisMarkdown}
                    onClick={() => void copyMarkdown()}
                  >
                    {bpText("actions.copyMarkdown")}
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    disabled={!analysisMarkdown}
                    onClick={() => void downloadMarkdown()}
                  >
                    {bpText("actions.downloadMarkdown")}
                  </Button>
                  <Button
                    type="primary"
                    disabled={analysisMarkdownLoading || !analysisMarkdown.trim()}
                    onClick={() => void startAnalysis()}
                  >
                    {bpText("agent.start")}
                  </Button>
                </div>
              </section>
            ) : null}
            {analysisStarting ? (
              <section className={styles.agentLoading}>
                <div>
                  <i />
                  <strong>{bpText("agent.analyzingRound")}</strong>
                  <p>{analysisStreamText || bpText("agent.verifying")}</p>
                </div>
              </section>
            ) : null}
            {analysisError ? (
              <section className={styles.agentError}>
                <strong>{bpText("agent.failed")}</strong>
                <p>{analysisError.replace(bpText("agent.failurePrefix"), "")}</p>
                <div>
                  <Button onClick={() => void copyMarkdown()}>
                    {bpText("agent.copyCurrentMarkdown")}
                  </Button>
                  <Button type="primary" onClick={prepareAnalysis}>
                    {bpText("agent.backToEdit")}
                  </Button>
                </div>
              </section>
            ) : null}
            {analysisResult ? (
              <AnalysisResult result={analysisResult} onRestart={prepareAnalysis} />
            ) : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function AnalysisResult({
  result,
  onRestart,
}: {
  result: Record<string, unknown>;
  onRestart: () => void;
}) {
  const advice = agentAdvice(result);
  const missing = bpText("notReturned");
  return (
    <section className={styles.agentResult}>
      {advice.conclusion ? <div className={styles.agentNote}>{advice.conclusion}</div> : null}
      <h3>{bpText("agent.verdicts")}</h3>
      <div className={styles.verdictGrid}>
        {["BKN", "BKN Trace", "MCP", "SDK", "Agent"].map((category) => (
          <div key={category} className={styles.verdict}>
            <strong>{category}</strong>
            <small>{decisionLabel(advice.verdicts[category])}</small>
          </div>
        ))}
      </div>
      <h3>{bpText("agent.recommendations")}</h3>
      {advice.suggestions.length ? (
        advice.suggestions.map((suggestion, index) => (
          <article
            className={styles.recommendation}
            key={`${suggestion.id ?? "recommendation"}-${index}`}
          >
            <header>
              <strong>{suggestion.change || bpText("agent.suggestionTitleMissing")}</strong>
              <span>{suggestion.id || `REC-${index + 1}`}</span>
            </header>
            <dl>
              <dt>{bpText("agent.category")}</dt>
              <dd>{suggestion.category || missing}</dd>
              <dt>{bpText("agent.location")}</dt>
              <dd>{suggestion.location || missing}</dd>
              <dt>{bpText("agent.problem")}</dt>
              <dd>{suggestion.problem || missing}</dd>
              <dt>{bpText("agent.sourceEvidence")}</dt>
              <dd>{suggestion.sourceEvidence || missing}</dd>
              <dt>{bpText("agent.verificationEvidence")}</dt>
              <dd>{suggestion.verificationEvidence || missing}</dd>
              <dt>{bpText("agent.change")}</dt>
              <dd>{suggestion.change || missing}</dd>
              <dt>{bpText("agent.acceptance")}</dt>
              <dd>{suggestion.acceptance || missing}</dd>
            </dl>
          </article>
        ))
      ) : (
        <div className={styles.agentSection}>{bpText("agent.noStrictSuggestion")}</div>
      )}
      <h3>{bpText("agent.unableToDetermine")}</h3>
      <div className={styles.agentSection}>{advice.notEvaluable || bpText("none")}</div>
      <footer>
        <Button
          onClick={() => {
            void writeTextToClipboard(adviceMarkdown(advice))
              .then(() => message.success(bpText("agent.adviceMarkdownCopied")))
              .catch(() => message.error(bpText("agent.copyFailed")));
          }}
        >
          {bpText("agent.copyAdviceMarkdown")}
        </Button>
        <Button type="primary" onClick={onRestart}>
          {bpText("agent.restart")}
        </Button>
      </footer>
    </section>
  );
}

function analysisErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return bpText("agent.noDiagnosticInfo");
}
