/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, CopyOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Result, Segmented, Select, Spin, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/app/locales/i18n";
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

type View = "timeline" | "knowledge";
type KnowledgeSelection = { network: string; elementId: string; elementName: string };
type AgentSuggestion = { id?: string; category?: string; location?: string; problem?: string; sourceEvidence?: string; verificationEvidence?: string; change?: string; acceptance?: string };
type AgentAdvice = { verdicts: Record<string, string | undefined>; conclusion?: string; suggestions: AgentSuggestion[]; notEvaluable?: string };
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(i18n.language, { hour12: false });
}

function formatDuration(value?: number) {
  if (value === undefined) return bpText("durationNotRecorded");
  if (value < 1000) return `${value}ms`;
  if (value < 60_000) return bpText("durationSeconds", { count: (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) });
  return bpText("durationMinutes", { minutes: Math.floor(value / 60_000), seconds: Math.round((value % 60_000) / 1000) });
}

function statusLabel(value?: string) {
  if (value === "completed") return bpText("status.completed");
  if (value === "failed") return bpText("status.failed");
  if (value === "running" || value === "active") return bpText("status.running");
  return value || bpText("notRecorded");
}

function roundLabel(item: BusinessProvenanceInteractionListItem | undefined) {
  if (item?.roundNumber && item.roundNumber > 0) return bpText("roundLabel", { index: item.roundNumber });
  return bpText("roundNotRecorded");
}

function operationTitle(operation: OperationResolution) {
  const primary = operation.elements.filter((item) => !["property", "logic"].includes(item.kind));
  const elements = (primary.length ? primary : operation.elements).map((item) => item.name || item.id).filter(Boolean);
  if (operation.toolName === "run_sql") return elements.length ? bpText("operation.queryElements", { elements: elements.join(bpText("listSeparator")) }) : bpText("operation.runSql");
  if (operation.toolName === "search_schema" || operation.toolName === "get_object_types") return bpText("operation.exploreSchema");
  if (operation.toolName === "list_knowledge_networks") return bpText("operation.findNetwork");
  if (operation.toolName === "query_object_instance") return elements.length ? bpText("operation.queryElements", { elements: elements.join(bpText("listSeparator")) }) : bpText("operation.queryObject");
  return elements.length ? `${operation.toolName || bpText("operation.call")} · ${elements.join(bpText("listSeparator"))}` : operation.toolName || bpText("operation.detail");
}

function operationCondition(operation: OperationResolution) {
  const condition = operation.query?.conditions;
  if ((condition === undefined || condition === null) && operation.query?.sql) return bpText("operation.sqlConditionBelow");
  if (condition === undefined || condition === null) return bpText("operation.conditionNotRecorded");
  if (typeof condition === "string") return condition;
  if (typeof condition === "object") return Object.entries(condition as Record<string, unknown>).map(([key, value]) => `${key} = ${conditionValue(value)}`).join(bpText("conditionSeparator"));
  if (typeof condition === "number" || typeof condition === "boolean") return String(condition);
  return bpText("operation.conditionNotRecorded");
}

function resourceDescription(operation: OperationResolution) {
  const resources = operation.query?.resources ?? [];
  if (resources.length) {
    return resources.map((resource) => {
      const businessName = resource.objectName || resource.objectId;
      const physicalName = resource.name || resource.id;
      return businessName ? `${businessName} · ${physicalName}` : physicalName;
    }).join(bpText("listSeparator"));
  }
  return operation.query?.resourceIds?.join(bpText("listSeparator")) || bpText("operation.resourceNotRecorded");
}

function conditionValue(value: unknown) {
  if (value === null) return "null";
  if (["string", "number", "boolean", "bigint"].includes(typeof value)) return `${value as string | number | boolean | bigint}`;
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value;
}

function operationResult(operation: OperationResolution, derivedFacts: BusinessProvenanceInteraction["derivedFacts"] = []) {
  if (operation.error) return bpText("operation.failedResult");
  if (derivedFacts.some((fact) => fact.rule === "changed_query_still_zero_result" && fact.operationId === operation.operationId)) return bpText("operation.changedQueryNoResult");
  if (operation.query?.resultCount !== undefined) return operation.query.resultCount === 0 ? bpText("operation.zeroRows") : bpText("operation.rows", { count: operation.query.resultCount });
  return operation.callStatus === "completed" ? bpText("operation.completedUnknownSize") : bpText("operation.resultNotRecorded");
}

function bindingDescription(operation: OperationResolution) {
  if (operation.status === "resolved") return bpText("binding.resolved");
  if (operation.status === "ambiguous") return bpText("binding.ambiguous");
  if (operation.status === "not_evaluable" && operation.missingFacts.includes("permission_denied")) return bpText("binding.permissionDenied");
  if (operation.missingFacts.includes("resource_binding")) return bpText("binding.resourceMissing");
  return bpText("binding.unresolved");
}

function businessElementNames(operation: OperationResolution, kinds: string[]) {
  return operation.elements.filter((item) => kinds.includes(item.kind)).map((item) => item.name || item.id).filter(Boolean);
}

function propertyDescriptions(operation: OperationResolution) {
  return operation.elements.filter((item) => item.kind === "property" || item.kind === "logic").map((item) => {
    const name = item.name || item.id;
    if (item.kind === "logic") return `${name}（${item.id}）· ${bpText("element.logic")}`;
    return `${name}（${item.id}）${item.field ? ` → ${item.field}` : ""}`;
  });
}

function elementKindText(kind: string) {
  return ({ object: bpText("element.object"), relation: bpText("element.relation"), action: bpText("element.action"), property: bpText("element.property"), logic: bpText("element.logic"), metric: bpText("element.metric") } as Record<string, string>)[kind] || kind;
}

function conversationTitle(conversation: BusinessProvenanceConversation) {
  const agent = conversation.agentName?.trim();
  return agent ? bpText("conversation.titleWithAgent", { agent }) : bpText("conversation.title");
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
  return ({ bkn: "BKN", bkn_trace: "BKN Trace", mcp: "MCP", sdk: "SDK", agent: "Agent" } as Record<string, string>)[value ?? ""];
}

function agentAdvice(result?: Record<string, unknown>): AgentAdvice {
  if (!result) return { verdicts: {}, suggestions: [] };
  const source = (result.analysis && typeof result.analysis === "object" ? result.analysis : result) as Record<string, unknown>;
  const rawVerdicts = (source.verdicts ?? source.classifications ?? source.category_decisions) as Record<string, unknown> | undefined;
  const verdicts: Record<string, string | undefined> = {};
  ["BKN", "BKN Trace", "MCP", "SDK", "Agent"].forEach((category) => {
    const key = category.toLowerCase().replace(" ", "_");
    const raw = rawVerdicts?.[category] ?? rawVerdicts?.[key] ?? source[key];
    verdicts[category] = typeof raw === "object" && raw ? textValue((raw as Record<string, unknown>).decision) : textValue(raw);
  });
  const suggestions = [source.recommendations, source.suggestions]
    .find(Array.isArray)
    ?.flatMap((item): AgentSuggestion[] => {
      if (typeof item === "string") return [{ change: item }];
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const scope = textValue(record.scope);
      return [{
        id: textValue(record.id) ?? textValue(record.recommendation_id),
        category: textValue(record.category) ?? textValue(record.type) ?? scopeLabel(scope),
        location: textValue(record.location) ?? textValue(record.target),
        problem: textValue(record.problem) ?? textValue(record.issue),
        sourceEvidence: textValue(record.source_evidence) ?? textValue(record.trace_evidence) ?? textList(record.trace_evidence_operation_ids),
        verificationEvidence: textValue(record.verification_evidence) ?? textValue(record.core_evidence) ?? textList(record.bkn_schema_evidence),
        change: textValue(record.change) ?? textValue(record.recommendation) ?? textValue(record.suggestion) ?? textValue(record.action),
        acceptance: textValue(record.acceptance) ?? textValue(record.acceptance_criteria) ?? textValue(record.verification),
      }];
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
    conclusion: textValue(source.conclusion) ?? textValue(source.summary) ?? textValue(source.message) ?? textValue(source.content),
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
  const verdicts = ["BKN", "BKN Trace", "MCP", "SDK", "Agent"].map((category) => `- ${category}: ${decisionLabel(advice.verdicts[category])}`).join("\n");
  const recommendations = advice.suggestions.map((item, index) => `### ${item.id || `REC-${index + 1}`}\n\n- ${bpText("agent.category")}: ${item.category || missing}\n- ${bpText("agent.location")}: ${item.location || missing}\n- ${bpText("agent.problem")}: ${item.problem || missing}\n- ${bpText("agent.sourceEvidence")}: ${item.sourceEvidence || missing}\n- ${bpText("agent.verificationEvidence")}: ${item.verificationEvidence || missing}\n- ${bpText("agent.change")}: ${item.change || missing}\n- ${bpText("agent.acceptance")}: ${item.acceptance || missing}`).join("\n\n");
  return `# ${bpText("agent.markdownTitle")}\n\n## ${bpText("agent.verdicts")}\n\n${verdicts}\n\n## ${bpText("agent.recommendations")}\n\n${recommendations || bpText("agent.noRecommendations")}${advice.notEvaluable ? `\n\n## ${bpText("agent.unableToDetermine")}\n\n${advice.notEvaluable}` : ""}`;
}

function knowledgeGroups(projection: BusinessProvenanceInteraction) {
  const groups = new Map<string, Map<string, { kind: string; id: string; name: string; operationIds: string[] }>>();
  projection.operations.forEach((operation) => {
    const network = operation.knowledgeNetworkId || bpText("networkUnresolved");
    const elements = groups.get(network) ?? new Map<string, { kind: string; id: string; name: string; operationIds: string[] }>();
    operation.elements.forEach((element) => {
      const key = `${element.kind}:${element.id}`;
      const existing = elements.get(key) ?? { kind: element.kind, id: element.id, name: element.name || element.id, operationIds: [] };
      if (!existing.operationIds.includes(operation.operationId)) existing.operationIds.push(operation.operationId);
      elements.set(key, existing);
    });
    groups.set(network, elements);
  });
  return [...groups.entries()]
    .map(([network, elements]) => [network, [...elements.values()]] as const)
    .filter(([, elements]) => elements.length > 0);
}

export function BusinessProvenanceScene() {
  const { t } = useTranslation();
  const [linkedConversationId] = useState(() => new URLSearchParams(window.location.search).get("conversation_id")?.trim() ?? "");
  const [conversations, setConversations] = useState<BusinessProvenanceConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationKeyword, setConversationKeyword] = useState("");
  const [conversationAgent, setConversationAgent] = useState("");
  const [conversationKnowledgeNetwork, setConversationKnowledgeNetwork] = useState("");
  const [conversationStatus, setConversationStatus] = useState<string>();
  const [conversationEvidence, setConversationEvidence] = useState<string>();
  const [conversationQuery, setConversationQuery] = useState<Parameters<typeof getBusinessProvenanceConversations>[0]>(() => linkedConversationId ? { conversationId: linkedConversationId } : {});
  const [selectedConversation, setSelectedConversation] = useState<BusinessProvenanceConversation>();
  const [interactionKeyword, setInteractionKeyword] = useState("");
  const [interactions, setInteractions] = useState<BusinessProvenanceInteractionListItem[]>([]);
  const [interactionTotal, setInteractionTotal] = useState(0);
  const [selectedInteraction, setSelectedInteraction] = useState<BusinessProvenanceInteractionListItem>();
  const [projection, setProjection] = useState<BusinessProvenanceInteraction>();
  const [interactionListLoading, setInteractionListLoading] = useState(false);
  const [interactionListError, setInteractionListError] = useState(false);
  const [interactionDetailLoading, setInteractionDetailLoading] = useState(false);
  const [interactionDetailError, setInteractionDetailError] = useState(false);
  const [interactionReload, setInteractionReload] = useState(0);
  const [view, setView] = useState<View>("timeline");
  const [detailOperation, setDetailOperation] = useState<OperationResolution>();
  const [knowledgeSelection, setKnowledgeSelection] = useState<KnowledgeSelection>();
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

  const loadConversations = useCallback(async () => {
    const request = ++conversationRequest.current;
    setLoading(true);
    setConversationLoadState(undefined);
    try {
      const page = await getBusinessProvenanceConversations({ ...conversationQuery, page: conversationPage, pageSize: 20 });
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
      setConversationLoadState(status === 404 ? "not-installed" : status === 403 ? "forbidden" : "failed");
    } finally { if (request === conversationRequest.current) setLoading(false); }
  }, [conversationPage, conversationQuery, linkedConversationId]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedConversation) return;
    let current = true;
    setInteractions([]); setInteractionTotal(0); setSelectedInteraction(undefined);
    setInteractionListLoading(true); setInteractionListError(false);
    setProjection(undefined); setDetailOperation(undefined); setKnowledgeSelection(undefined); setAnalysisResult(undefined); setAnalysisHistory([]); setAnalysisPanelOpen(false); setAnalysisError(undefined);
    void getBusinessProvenanceInteractions({ conversationId: selectedConversation.conversationId, page: 1, pageSize: 50, keyword: interactionKeyword })
      .then((page) => { if (current) { setInteractions(page.entries); setInteractionTotal(page.total); setSelectedInteraction(page.entries[0]); } })
      .catch(() => { if (current) { setInteractionListError(true); message.error(bpText("errors.interactionsLoad")); } })
      .finally(() => { if (current) setInteractionListLoading(false); });
    return () => { current = false; };
  }, [interactionKeyword, selectedConversation]);
  useEffect(() => {
    if (!selectedInteraction) {
      setInteractionDetailLoading(false);
      setInteractionDetailError(false);
      return;
    }
    let current = true;
    setProjection(undefined); setDetailOperation(undefined); setKnowledgeSelection(undefined); setInteractionDetailLoading(true); setInteractionDetailError(false);
    setAnalysisMarkdown(""); setAnalysisMarkdownLoading(true); setAnalysisResult(undefined); setAnalysisHistory([]); setAnalysisStreamText(""); setAnalysisPanelOpen(false); setAnalysisError(undefined); setAnalysisStarting(false);
    void getBusinessProvenanceInteraction(selectedInteraction.interactionId)
      .then((value) => { if (current) setProjection(value); })
      .catch(() => { if (current) { setInteractionDetailError(true); message.error(bpText("errors.factsLoad")); } })
      .finally(() => { if (current) setInteractionDetailLoading(false); });
    void getBusinessProvenanceMarkdown(selectedInteraction.interactionId)
      .then((value) => { if (current) setAnalysisMarkdown(value); })
      .catch(() => { if (current) message.error(bpText("errors.markdownLoad")); })
      .finally(() => { if (current) setAnalysisMarkdownLoading(false); });
    void getBusinessProvenanceAnalysisHistory(selectedInteraction.interactionId).then((entries) => {
      if (!current) return;
      setAnalysisHistory(entries);
      const latest = entries.find((entry) => entry.status === "completed" && entry.result);
      setAnalysisResult(latest?.result);
    }).catch(() => { if (current) setAnalysisHistory([]); });
    return () => { current = false; };
  }, [interactionReload, selectedInteraction]);

  const groups = useMemo(() => projection ? knowledgeGroups(projection) : [], [projection]);
  const selectedKnowledgeCalls = useMemo(() => {
    if (!projection || !knowledgeSelection) return [];
    return projection.operations.filter((operation) => operation.elements.some((element) => element.id === knowledgeSelection.elementId));
  }, [knowledgeSelection, projection]);

  const startAnalysis = useCallback(async () => {
    if (!selectedInteraction || !analysisMarkdown.trim()) return;
    setAnalysisError(undefined); setAnalysisResult(undefined); setAnalysisStreamText(""); setAnalysisStarting(true);
    try {
      const result = await streamBusinessProvenanceAnalysis(selectedInteraction.interactionId, analysisMarkdown, (token) => setAnalysisStreamText((current) => current + token));
      setAnalysisResult(result);
      setAnalysisHistory(await getBusinessProvenanceAnalysisHistory(selectedInteraction.interactionId));
    } catch (error) { setAnalysisError(bpText("agent.failureWithReason", { reason: analysisErrorMessage(error) })); } finally { setAnalysisStarting(false); }
  }, [analysisMarkdown, selectedInteraction]);

  const copyMarkdown = useCallback(async () => {
    if (!selectedInteraction || !analysisMarkdown) return;
    await navigator.clipboard?.writeText(analysisMarkdown);
    message.success(bpText("agent.markdownCopied"));
  }, [analysisMarkdown, selectedInteraction]);

  const downloadMarkdown = useCallback(() => {
    if (!selectedInteraction || !analysisMarkdown) return;
    const url = URL.createObjectURL(new Blob([analysisMarkdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `interaction-${selectedInteraction.interactionId}.md`; link.click();
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
  }, [conversationAgent, conversationEvidence, conversationKeyword, conversationKnowledgeNetwork, conversationStatus]);

  const conversationColumns: ColumnsType<BusinessProvenanceConversation> = [
    { dataIndex: "startedAt", title: bpText("columns.startedAt"), width: 180, render: (value: string | undefined, item) => <div className={styles.timeCell}><b>{formatTime(value)}</b><small>{item.conversationId}</small></div> },
    { dataIndex: "questionPreview", title: bpText("columns.question"), width: 260, render: (value: string | undefined, item) => <Button type="link" className={styles.questionLink} onClick={() => setSelectedConversation(item)}>{value || bpText("questionNotRecorded")}</Button> },
    { dataIndex: "interactionCount", title: bpText("columns.interactions"), width: 90, align: "center", render: (value?: number) => value ?? 0 },
    { dataIndex: "resultPreview", title: bpText("columns.result"), width: 260, ellipsis: true, render: (value?: string) => <span className={styles.tableClamp}>{value || "—"}</span> },
    { dataIndex: "agentName", title: "Agent", width: 140, render: (value?: string) => <span className={styles.tableClamp}>{value || bpText("agentNotRecorded")}</span> },
    { dataIndex: "status", title: bpText("columns.status"), width: 90, render: (value?: string) => <span className={styles.statusText}>{statusLabel(value)}</span> },
    { title: bpText("columns.evidence"), width: 120, render: (_, item) => <span className={styles.evidence}>{evidenceLabel(item)}</span> },
    { dataIndex: "durationMs", title: bpText("columns.duration"), width: 90, render: (value?: number) => formatDuration(value) },
  ];

  if (conversationLoadState) {
    const state = {
      failed: { status: "error" as const, title: t("bknTrace.businessProvenance.loadFailed"), subTitle: t("bknTrace.businessProvenance.loadFailedDescription") },
      forbidden: { status: "403" as const, title: t("bknTrace.businessProvenance.forbidden"), subTitle: t("bknTrace.businessProvenance.forbiddenDescription") },
      "not-installed": { status: "warning" as const, title: t("bknTrace.businessProvenance.imageMissing"), subTitle: t("bknTrace.businessProvenance.imageMissingDescription") },
    }[conversationLoadState];
    return <main className={`${styles.page} ${styles.pageSurface}`}>
      <Result
        status={state.status}
        title={state.title}
        subTitle={state.subTitle}
        extra={conversationLoadState === "failed" ? <Button type="primary" onClick={() => void loadConversations()}>{t("bknTrace.businessProvenance.retry")}</Button> : undefined}
      />
    </main>;
  }

  if (!selectedConversation) return <main className={`${styles.page} ${styles.pageSurface}`}>
    <header className={styles.pageHeader}>
      <div><Typography.Title level={2}>{bpText("list.title")}</Typography.Title><Typography.Text>{bpText("list.description")}</Typography.Text></div>
      <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>{bpText("actions.refresh")}</Button>
    </header>
    <section className={styles.listCard}>
      <div className={styles.filters}>
        <Input value={conversationKeyword} onChange={(event) => setConversationKeyword(event.target.value)} onPressEnter={submitConversationQuery} prefix={<SearchOutlined />} placeholder={bpText("filters.keyword")} />
        <Input value={conversationAgent} onChange={(event) => setConversationAgent(event.target.value)} onPressEnter={submitConversationQuery} placeholder={bpText("filters.agent")} />
        <Input value={conversationKnowledgeNetwork} onChange={(event) => setConversationKnowledgeNetwork(event.target.value)} onPressEnter={submitConversationQuery} placeholder={bpText("filters.network")} />
        <Select aria-label={bpText("filters.status")} allowClear placeholder={bpText("filters.status")} value={conversationStatus} options={[{ value: "completed", label: statusLabel("completed") }, { value: "failed", label: statusLabel("failed") }, { value: "active", label: statusLabel("active") }]} onChange={setConversationStatus} />
        <Select allowClear placeholder={bpText("filters.evidence")} value={conversationEvidence} options={[{ value: "complete", label: bpText("evidence.complete") }, { value: "partial", label: bpText("evidence.partial") }]} onChange={setConversationEvidence} />
        <Button type="primary" icon={<SearchOutlined />} onClick={submitConversationQuery}>{bpText("actions.query")}</Button>
        <Button aria-label={bpText("actions.reset")} icon={<ReloadOutlined />} onClick={() => { setConversationKeyword(""); setConversationAgent(""); setConversationKnowledgeNetwork(""); setConversationStatus(undefined); setConversationEvidence(undefined); setConversationPage(1); setConversationQuery({}); }} />
      </div>
      <Table rowKey="conversationId" columns={conversationColumns} dataSource={conversations} loading={loading} tableLayout="fixed" scroll={{ x: 1230 }} locale={{ emptyText: <Empty description={bpText("list.empty")} /> }} pagination={{ current: conversationPage, pageSize: 20, total: conversationTotal, showSizeChanger: false, showTotal: (total) => bpText("list.total", { count: total }), onChange: setConversationPage }} />
    </section>
  </main>;

  return <main className={`${styles.page} ${styles.pageSurface}`}>
    <header className={styles.pageHeader}>
      <div><Typography.Title level={2}>{bpText("analysis.title")}</Typography.Title><Typography.Text>{bpText("analysis.description")}</Typography.Text></div>
      <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>{bpText("actions.refresh")}</Button>
    </header>
    <section className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <Button type="link" className={styles.backButton} onClick={() => { setSelectedConversation(undefined); setSelectedInteraction(undefined); setProjection(undefined); }}>← {bpText("actions.back")}</Button>
        <div className={styles.conversationHeading}><h1>{conversationTitle(selectedConversation)}</h1><span>{selectedConversation.conversationId}</span><span>{bpText("interactionCount", { count: selectedConversation.interactionCount ?? interactionTotal })}</span><span>{bpText("callCount", { count: projection?.operations.length ?? 0 })}</span><span>{selectedConversation.agentName || bpText("agentNotRecorded")}</span></div>
      </header>
      <aside className={styles.roundSidebar}>
        <div className={styles.roundSidebarTitle}><div><h3>{bpText("rounds.title")}</h3><span>{interactionListLoading ? bpText("rounds.loading") : bpText("rounds.summary", { total: selectedConversation.interactionCount ?? interactionTotal, current: selectedInteraction?.roundNumber && selectedInteraction.roundNumber > 0 ? selectedInteraction.roundNumber : bpText("roundNotRecorded") })}</span></div></div>
        <Input value={interactionKeyword} onChange={(event) => setInteractionKeyword(event.target.value)} prefix={<SearchOutlined />} placeholder={bpText("rounds.search")} />
        <div className={styles.roundList}>{interactionListLoading ? <div className={styles.roundLoading}><Spin size="small" />{bpText("rounds.loading")}</div> : interactionListError ? <Alert type="error" showIcon message={bpText("errors.interactionsLoad")} /> : interactions.map((item) => <button key={item.interactionId} className={item.interactionId === selectedInteraction?.interactionId ? styles.roundSelected : ""} onClick={() => setSelectedInteraction(item)}><b>{roundLabel(item)}</b><strong>{item.questionPreview || bpText("questionNotRecorded")}</strong><small>{formatClock(item.startedAt)} · {formatDuration(item.durationMs)} · {statusLabel(item.status)}</small></button>)}</div>
      </aside>
      <section className={styles.analysisPane}>
        {interactionListLoading ? <div className={styles.workspaceEmpty}><Spin size="large" /><span>{bpText("rounds.loading")}</span></div> : interactionDetailLoading ? <div className={styles.workspaceEmpty}><Spin size="large" /><span>{bpText("rounds.loadingFacts")}</span></div> : interactionDetailError ? <Result status="error" title={bpText("errors.factsLoad")} extra={<Button type="primary" onClick={() => setInteractionReload((value) => value + 1)}>{t("bknTrace.businessProvenance.retry")}</Button>} /> : projection ? <>
          <section className={styles.interactionSummary}>
            <header><span>{roundLabel(selectedInteraction)}</span><h2>{selectedInteraction?.questionPreview || bpText("roundQuestionNotRecorded")}</h2><small>{selectedConversation.agentName || bpText("agentNotRecorded")} · {formatTime(selectedInteraction?.startedAt)} · {formatDuration(selectedInteraction?.durationMs)} · {bpText("callCount", { count: projection.operations.length })} · {statusLabel(selectedInteraction?.status)}</small></header>
            <div className={styles.sourceTexts}><div><h4>{bpText("rounds.inputOriginal")}</h4><p>{selectedInteraction?.questionPreview || bpText("inputNotRecorded")}</p></div><div><h4>{bpText("rounds.outputOriginal")}</h4><p>{selectedInteraction?.resultPreview || bpText("resultNotRecorded")}</p></div></div>
            <footer><Button icon={<CopyOutlined />} disabled={analysisMarkdownLoading || !analysisMarkdown} onClick={() => void copyMarkdown()}>{bpText("actions.copyMarkdown")}</Button><Button icon={<DownloadOutlined />} disabled={analysisMarkdownLoading || !analysisMarkdown} onClick={() => void downloadMarkdown()}>{bpText("actions.downloadMarkdown")}</Button><Button type="primary" onClick={() => { setDetailOperation(undefined); setKnowledgeSelection(undefined); setAnalysisPanelOpen(true); }}>{bpText("actions.analyze")}</Button></footer>
          </section>
          <Segmented className={styles.viewSwitch} value={view} onChange={(value) => { setView(value as View); setDetailOperation(undefined); }} options={[{ label: bpText("views.timeline"), value: "timeline" }, { label: bpText("views.knowledge"), value: "knowledge" }]} />
          {view === "timeline" ? <section className={styles.timeline}>
            <div className={styles.inputNode}><i /><div><b>{bpText("rounds.input")}</b><span>{formatTime(selectedInteraction?.startedAt)}</span></div></div>
            {projection.operations.length === 0 ? <Empty description={bpText("rounds.noOperations")} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : projection.operations.map((operation, index) => <div className={styles.timelineItem} key={operation.operationId}>
              <div className={styles.timelineRail}><i />{index < projection.operations.length - 1 ? <span /> : null}</div>
              <article className={styles.operationCard} onClick={() => setDetailOperation(operation)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setDetailOperation(operation); }}>
                <header><h3>{operationTitle(operation)}</h3>{operation.elements[0] ? <Tag>{operation.elements[0].name || operation.elements[0].id}</Tag> : null}</header>
                <p><b>{bpText("detail.condition")}:</b>{operationCondition(operation)}</p>
                <small>{formatClock(operation.startedAt)} · {formatDuration(operation.durationMs)} · {operation.toolName || bpText("interfaceNotRecorded")}</small>
                <p className={styles.operationResult}>{operationResult(operation, projection.derivedFacts)}</p>
                <Button type="link" onClick={(event) => { event.stopPropagation(); setDetailOperation(operation); }}>{bpText("operation.detail")}</Button>
              </article>
            </div>)}
          </section> : <section className={styles.knowledgeCanvas}>
            <p className={styles.knowledgePath}>{bpText("knowledge.path")}</p>
            {groups.length ? groups.map(([network, elements]) => <div className={styles.knowledgeGrid} key={network}>
              <section className={styles.knowledgeColumn}><h3><span>1</span>{bpText("knowledge.network")}</h3><article className={styles.networkCard}><b>{network}</b><small>{network}</small></article><p className={styles.candidateNote}>{bpText("knowledge.observedOnly")}</p></section>
              <section className={styles.knowledgeColumn}><h3><span>2</span>{bpText("knowledge.observed")}</h3>{elements.map((element) => <button key={`${element.kind}:${element.id}`} className={knowledgeSelection?.elementId === element.id ? styles.knowledgeSelected : ""} onClick={() => setKnowledgeSelection({ network, elementId: element.id, elementName: element.name })}><b>{element.name}</b><small>{elementKindText(element.kind)} · {bpText("knowledge.deterministicCalls", { count: element.operationIds.length })}</small></button>)}</section>
              <section className={styles.knowledgeColumn}><h3><span>3</span>{bpText("knowledge.relations")}</h3>{projection.contextRelations.filter((relation) => relation.knowledgeNetworkId === network).length ? projection.contextRelations.filter((relation) => relation.knowledgeNetworkId === network).map((relation) => <article className={styles.contextCard} key={relation.id}><b>{relation.name || relation.id}</b><small>{bpText("knowledge.contextOnly")}</small></article>) : <p className={styles.emptyContext}>{bpText("knowledge.noContext")}</p>}</section>
            </div>) : <Empty description={bpText("knowledge.empty")} />}
          </section>}
        </> : <Empty className={styles.workspaceEmpty} description={bpText("rounds.select")} />}
      </section>
    </section>
    {view === "knowledge" && knowledgeSelection && !detailOperation ? <aside className={styles.knowledgeInspector}><header><small>{bpText("knowledge.observed")}</small><b>{knowledgeSelection.elementName}</b><Button type="text" icon={<CloseOutlined />} aria-label={bpText("knowledge.closeDetail")} onClick={() => setKnowledgeSelection(undefined)} /></header><section><h4>{bpText("knowledge.factBoundary")}</h4><p>{bpText("knowledge.factBoundaryDescription", { count: selectedKnowledgeCalls.length })}</p></section><section><h4>{bpText("knowledge.relatedCalls")}</h4>{selectedKnowledgeCalls.map((operation) => <button key={operation.operationId} onClick={() => { setKnowledgeSelection(undefined); setDetailOperation(operation); }}><b>{operationTitle(operation)}</b><small>{operation.toolName || bpText("interfaceNotRecorded")} · {operationCondition(operation)}</small></button>)}</section></aside> : null}
    {detailOperation ? <aside className={styles.detailPanel}>
      <header><div><small>{bpText("detail.roundCall")}</small><b>{operationTitle(detailOperation)}</b></div><span className={detailOperation.callStatus === "completed" ? styles.completed : styles.failed}>{statusLabel(detailOperation.callStatus)}</span><Button type="text" aria-label={bpText("detail.close")} icon={<CloseOutlined />} onClick={() => setDetailOperation(undefined)} /></header>
      <section><h4>{bpText("detail.what")}</h4><p>{operationTitle(detailOperation)}</p></section>
      <section><h4>{bpText("detail.businessElement")}</h4><dl>
        <dt>{bpText("knowledge.network")}</dt><dd>{detailOperation.knowledgeNetworkId || bpText("undetermined")}</dd>
        <dt>{bpText("detail.businessObject")}</dt><dd>{businessElementNames(detailOperation, ["object"]).join(bpText("listSeparator")) || bpText("undetermined")}</dd>
        {detailOperation.status === "ambiguous" && detailOperation.objects?.length ? <><dt>{bpText("detail.candidateObjects")}</dt><dd>{detailOperation.objects.map((object) => object.name || object.id).join(bpText("listSeparator"))}</dd></> : null}
        {businessElementNames(detailOperation, ["relation", "action", "metric"]).length ? <><dt>{bpText("detail.relationActionMetric")}</dt><dd>{businessElementNames(detailOperation, ["relation", "action", "metric"]).join(bpText("listSeparator"))}</dd></> : null}
        <dt>{bpText("detail.binding")}</dt><dd>{bindingDescription(detailOperation)}</dd>
        {projection?.conversationContext.find((item) => item.knowledgeNetworkId === detailOperation.knowledgeNetworkId) ? <><dt>{bpText("detail.conversationContext")}</dt><dd>{(() => { const source = projection.conversationContext.find((item) => item.knowledgeNetworkId === detailOperation.knowledgeNetworkId); return `${source?.sourceInteractionId} · ${source?.sourceOperationId}`; })()}</dd></> : null}
      </dl></section>
      <section><h4>{bpText("detail.how")}</h4><dl><dt>{bpText("detail.interface")}</dt><dd>{detailOperation.toolName || bpText("notRecorded")}</dd><dt>{bpText("detail.condition")}</dt><dd>{operationCondition(detailOperation)}</dd><dt>{bpText("detail.resource")}</dt><dd>{resourceDescription(detailOperation)}</dd></dl></section>
      <section><h4>{bpText("detail.properties")}</h4>{propertyDescriptions(detailOperation).length ? propertyDescriptions(detailOperation).map((item) => <p key={item}>{item}</p>) : <p>{bpText("detail.noProperties")}</p>}</section>
      <section><h4>{bpText("detail.actualResult")}</h4><p>{operationResult(detailOperation, projection?.derivedFacts)}</p></section>
      {detailOperation.query?.sql ? <section><h4>SQL</h4><pre>{detailOperation.query.sql}</pre></section> : null}
    </aside> : null}
    {analysisPanelOpen ? (
      <div className={styles.agentDrawerMask}>
        <aside className={styles.agentPanel}>
          <header>
            <div><small>{bpText("agent.title")}</small><b>{bpText("agent.currentRound")}</b></div>
            <Button type="text" icon={<CloseOutlined />} aria-label={bpText("agent.close")} onClick={() => setAnalysisPanelOpen(false)} />
          </header>
          <p className={styles.agentIntro}>{bpText("agent.intro")}</p>
          <div className={styles.agentSource}>
            <strong>{roundLabel(selectedInteraction)} · {selectedInteraction?.questionPreview || bpText("roundQuestionNotRecorded")}</strong>
            <small>{selectedInteraction?.interactionId}<br />{formatTime(selectedInteraction?.startedAt)} · {formatDuration(selectedInteraction?.durationMs)} · {bpText("callCount", { count: projection?.operations.length ?? 0 })}</small>
          </div>
          {analysisHistory.length ? <Select aria-label={bpText("agent.history")} value={analysisHistory.find((item) => item.result === analysisResult)?.analysisId ?? analysisHistory[0]?.analysisId} options={analysisHistory.map((item, index) => ({ value: item.analysisId, label: bpText("agent.historyItem", { index: analysisHistory.length - index, time: formatTime(item.startedAt), status: item.status === "completed" ? statusLabel("completed") : item.status === "failed" ? statusLabel("failed") : bpText("agent.analyzing") }) }))} onChange={(analysisId) => { const selected = analysisHistory.find((item) => item.analysisId === analysisId); setAnalysisResult(selected?.result); setAnalysisError(selected?.status === "failed" ? bpText("agent.failureWithReason", { reason: selected.failureMessage || bpText("agent.failureReasonMissing") }) : undefined); }} /> : null}
          {!analysisStarting && !analysisResult && !analysisError ? <section className={styles.agentEditor}>
            <h4>{bpText("agent.markdownToAnalyze")}</h4>
            <p>{bpText("agent.editorDescription")}</p>
            <Input.TextArea aria-label={bpText("agent.markdownToAnalyze")} value={analysisMarkdown} onChange={(event) => setAnalysisMarkdown(event.target.value)} autoSize={{ minRows: 14, maxRows: 24 }} disabled={analysisMarkdownLoading} placeholder={analysisMarkdownLoading ? bpText("agent.generatingMarkdown") : bpText("agent.markdownUnavailable")} />
            <div className={styles.agentEditorActions}><Button icon={<CopyOutlined />} disabled={!analysisMarkdown} onClick={() => void copyMarkdown()}>{bpText("actions.copyMarkdown")}</Button><Button icon={<DownloadOutlined />} disabled={!analysisMarkdown} onClick={() => void downloadMarkdown()}>{bpText("actions.downloadMarkdown")}</Button><Button type="primary" disabled={analysisMarkdownLoading || !analysisMarkdown.trim()} onClick={() => void startAnalysis()}>{bpText("agent.start")}</Button></div>
          </section> : null}
          {analysisStarting ? <section className={styles.agentLoading}><div><i /><strong>{bpText("agent.analyzingRound")}</strong><p>{analysisStreamText || bpText("agent.verifying")}</p></div></section> : null}
          {analysisError ? <section className={styles.agentError}><strong>{bpText("agent.failed")}</strong><p>{analysisError.replace(bpText("agent.failurePrefix"), "")}</p><div><Button onClick={() => void copyMarkdown()}>{bpText("agent.copyCurrentMarkdown")}</Button><Button type="primary" onClick={prepareAnalysis}>{bpText("agent.backToEdit")}</Button></div></section> : null}
          {analysisResult ? <AnalysisResult result={analysisResult} onRestart={prepareAnalysis} /> : null}
        </aside>
      </div>
    ) : null}
  </main>;
}

function AnalysisResult({ result, onRestart }: { result: Record<string, unknown>; onRestart: () => void }) {
  const advice = agentAdvice(result);
  const missing = bpText("notReturned");
  return <section className={styles.agentResult}>
    {advice.conclusion ? <div className={styles.agentNote}>{advice.conclusion}</div> : null}
    <h3>{bpText("agent.verdicts")}</h3>
    <div className={styles.verdictGrid}>{["BKN", "BKN Trace", "MCP", "SDK", "Agent"].map((category) => <div key={category} className={styles.verdict}><strong>{category}</strong><small>{decisionLabel(advice.verdicts[category])}</small></div>)}</div>
    <h3>{bpText("agent.recommendations")}</h3>
    {advice.suggestions.length ? advice.suggestions.map((suggestion, index) => <article className={styles.recommendation} key={`${suggestion.id ?? "recommendation"}-${index}`}><header><strong>{suggestion.change || bpText("agent.suggestionTitleMissing")}</strong><span>{suggestion.id || `REC-${index + 1}`}</span></header><dl><dt>{bpText("agent.category")}</dt><dd>{suggestion.category || missing}</dd><dt>{bpText("agent.location")}</dt><dd>{suggestion.location || missing}</dd><dt>{bpText("agent.problem")}</dt><dd>{suggestion.problem || missing}</dd><dt>{bpText("agent.sourceEvidence")}</dt><dd>{suggestion.sourceEvidence || missing}</dd><dt>{bpText("agent.verificationEvidence")}</dt><dd>{suggestion.verificationEvidence || missing}</dd><dt>{bpText("agent.change")}</dt><dd>{suggestion.change || missing}</dd><dt>{bpText("agent.acceptance")}</dt><dd>{suggestion.acceptance || missing}</dd></dl></article>) : <div className={styles.agentSection}>{bpText("agent.noStrictSuggestion")}</div>}
    <h3>{bpText("agent.unableToDetermine")}</h3><div className={styles.agentSection}>{advice.notEvaluable || bpText("none")}</div>
    <footer><Button onClick={() => { void navigator.clipboard?.writeText(adviceMarkdown(advice)); }}>{bpText("agent.copyAdviceMarkdown")}</Button><Button type="primary" onClick={onRestart}>{bpText("agent.restart")}</Button></footer>
  </section>;
}

function analysisErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return bpText("agent.noDiagnosticInfo");
}
