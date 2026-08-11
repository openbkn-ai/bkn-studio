/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, CopyOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Result, Segmented, Select, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

function responseStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== "object" || !("status" in response)) return undefined;
  return typeof response.status === "number" ? response.status : undefined;
}

function isInternalAnalysisConversation(conversation: BusinessProvenanceConversation) {
  return conversation.agentName === "业务溯源优化Agent"
    || conversation.questionPreview?.startsWith("你是业务溯源优化分析 Agent") === true;
}

function formatTime(value?: string) {
  if (!value) return "时间未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString("zh-CN", { hour12: false })}`;
}

function formatClock(value?: string) {
  if (!value) return "时间未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString("zh-CN", { hour12: false });
}

function formatDuration(value?: number) {
  if (value === undefined) return "耗时未记录";
  if (value < 1000) return `${value}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} 秒`;
  return `${Math.floor(value / 60_000)} 分${Math.round((value % 60_000) / 1000)} 秒`;
}

function statusLabel(value?: string) {
  if (value === "completed") return "已完成";
  if (value === "failed") return "失败";
  if (value === "running" || value === "active") return "进行中";
  return value || "未记录";
}

function operationTitle(operation: OperationResolution) {
  const primary = operation.elements.filter((item) => !["property", "logic"].includes(item.kind));
  const elements = (primary.length ? primary : operation.elements).map((item) => item.name || item.id).filter(Boolean);
  if (operation.toolName === "run_sql") return elements.length ? `查询${elements.join("、")}` : "执行数据查询";
  if (operation.toolName === "search_schema" || operation.toolName === "get_object_types") return "探索知识网络结构";
  if (operation.toolName === "list_knowledge_networks") return "查找业务知识网络";
  if (operation.toolName === "query_object_instance") return elements.length ? `查询${elements.join("、")}` : "查询业务对象";
  return elements.length ? `${operation.toolName || "调用"} · ${elements.join("、")}` : operation.toolName || "调用详情";
}

function operationCondition(operation: OperationResolution) {
  const condition = operation.query?.conditions;
  if ((condition === undefined || condition === null) && operation.query?.sql) return "SQL 条件见下方完整 SQL";
  if (condition === undefined || condition === null) return "输入条件未记录";
  if (typeof condition === "string") return condition;
  if (typeof condition === "object") return Object.entries(condition as Record<string, unknown>).map(([key, value]) => `${key} = ${conditionValue(value)}`).join("；");
  if (typeof condition === "number" || typeof condition === "boolean") return String(condition);
  return "输入条件未记录";
}

function resourceDescription(operation: OperationResolution) {
  const resources = operation.query?.resources ?? [];
  if (resources.length) {
    return resources.map((resource) => {
      const businessName = resource.objectName || resource.objectId;
      const physicalName = resource.name || resource.id;
      return businessName ? `${businessName} · ${physicalName}` : physicalName;
    }).join("、");
  }
  return operation.query?.resourceIds?.join("、") || "本轮事实未记录资源绑定";
}

function conditionValue(value: unknown) {
  if (value === null) return "null";
  if (["string", "number", "boolean", "bigint"].includes(typeof value)) return `${value as string | number | boolean | bigint}`;
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value;
}

function operationResult(operation: OperationResolution, derivedFacts: BusinessProvenanceInteraction["derivedFacts"] = []) {
  if (operation.error) return "调用失败；错误事实已记录在本次调用中。";
  if (derivedFacts.some((fact) => fact.rule === "changed_query_still_zero_result" && fact.operationId === operation.operationId)) return "调整查询后仍无匹配记录。";
  if (operation.query?.resultCount !== undefined) return operation.query.resultCount === 0 ? "返回 0 条。" : `返回 ${operation.query.resultCount} 条。`;
  return operation.callStatus === "completed" ? "调用完成；结果规模未记录。" : "结果未记录。";
}

function bindingDescription(operation: OperationResolution) {
  if (operation.status === "resolved") return "调用事实与 BKN 正式定义映射";
  if (operation.status === "ambiguous") return "同一资源绑定到多个业务对象，无法唯一定位";
  if (operation.status === "not_evaluable" && operation.missingFacts.includes("permission_denied")) return "无权读取源 BKN 定义，调用事实仍已保留";
  if (operation.missingFacts.includes("resource_binding")) return "资源未绑定到业务对象";
  return "调用事实未能确定定位";
}

function businessElementNames(operation: OperationResolution, kinds: string[]) {
  return operation.elements.filter((item) => kinds.includes(item.kind)).map((item) => item.name || item.id).filter(Boolean);
}

function propertyDescriptions(operation: OperationResolution) {
  return operation.elements.filter((item) => item.kind === "property" || item.kind === "logic").map((item) => {
    const name = item.name || item.id;
    if (item.kind === "logic") return `${name}（${item.id}）· 逻辑/函数`;
    return `${name}（${item.id}）${item.field ? ` → ${item.field}` : ""}`;
  });
}

function elementKindText(kind: string) {
  return ({ object: "对象", relation: "关系", action: "行动", property: "属性", logic: "逻辑/函数", metric: "指标" } as Record<string, string>)[kind] || kind;
}

function conversationTitle(conversation: BusinessProvenanceConversation) {
  const agent = conversation.agentName?.trim();
  return agent ? `${agent} 的业务会话` : "业务会话";
}

function evidenceLabel(conversation: BusinessProvenanceConversation) {
  return conversation.resultPreview ? "部分可溯源" : "按轮次查看";
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(textValue).filter((item): item is string => Boolean(item));
  return items.length ? items.join("、") : undefined;
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
  if (value === "change_required") return "需要优化";
  if (value === "no_change") return "暂未发现需要优化项";
  if (value === "not_evaluable") return "当前事实不足以评估";
  return value === "not_evaluable" ? "无法判断" : value || "未返回";
}

function adviceMarkdown(advice: AgentAdvice) {
  const verdicts = ["BKN", "BKN Trace", "MCP", "SDK", "Agent"].map((category) => `- ${category}：${decisionLabel(advice.verdicts[category])}`).join("\n");
  const recommendations = advice.suggestions.map((item, index) => `### ${item.id || `REC-${index + 1}`}\n\n- 类别：${item.category || "未返回"}\n- 修改位置：${item.location || "未返回"}\n- 问题：${item.problem || "未返回"}\n- 源证据：${item.sourceEvidence || "未返回"}\n- 核验证据：${item.verificationEvidence || "未返回"}\n- 修改方式：${item.change || "未返回"}\n- 验收：${item.acceptance || "未返回"}`).join("\n\n");
  return `# 业务溯源优化建议\n\n## 分类结论\n\n${verdicts}\n\n## 修改建议\n\n${recommendations || "当前结果未返回具体修改建议。"}${advice.notEvaluable ? `\n\n## 无法判断\n\n${advice.notEvaluable}` : ""}`;
}

function knowledgeGroups(projection: BusinessProvenanceInteraction) {
  const groups = new Map<string, Map<string, { kind: string; id: string; name: string; operationIds: string[] }>>();
  projection.operations.forEach((operation) => {
    const network = operation.knowledgeNetworkId || "尚未定位知识网络";
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
  const [conversations, setConversations] = useState<BusinessProvenanceConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationKeyword, setConversationKeyword] = useState("");
  const [conversationAgent, setConversationAgent] = useState("");
  const [conversationStatus, setConversationStatus] = useState<string>();
  const [selectedConversation, setSelectedConversation] = useState<BusinessProvenanceConversation>();
  const [interactionKeyword, setInteractionKeyword] = useState("");
  const [interactions, setInteractions] = useState<BusinessProvenanceInteractionListItem[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<BusinessProvenanceInteractionListItem>();
  const [projection, setProjection] = useState<BusinessProvenanceInteraction>();
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

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setConversationLoadState(undefined);
    try {
      const page = await getBusinessProvenanceConversations({ page: conversationPage, pageSize: 20, keyword: conversationKeyword, agentOrApp: conversationAgent, status: conversationStatus });
      const visibleEntries = page.entries.filter((entry) => !isInternalAnalysisConversation(entry));
      setConversations(visibleEntries);
      setConversationTotal(Math.max(0, page.total - (page.entries.length - visibleEntries.length)));
    } catch (error) {
      const status = responseStatus(error);
      setConversationLoadState(status === 404 ? "not-installed" : status === 403 ? "forbidden" : "failed");
    } finally { setLoading(false); }
  }, [conversationAgent, conversationKeyword, conversationPage, conversationStatus]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedConversation) return;
    setProjection(undefined); setDetailOperation(undefined); setKnowledgeSelection(undefined); setAnalysisResult(undefined); setAnalysisHistory([]); setAnalysisPanelOpen(false); setAnalysisError(undefined);
    void getBusinessProvenanceInteractions({ conversationId: selectedConversation.conversationId, page: 1, pageSize: 50, keyword: interactionKeyword })
      .then((page) => { setInteractions(page.entries); setSelectedInteraction(page.entries[0]); })
      .catch(() => message.error("交互轮次加载失败"));
  }, [interactionKeyword, selectedConversation]);
  useEffect(() => {
    if (!selectedInteraction) return;
    let current = true;
    setProjection(undefined); setDetailOperation(undefined); setKnowledgeSelection(undefined);
    setAnalysisMarkdown(""); setAnalysisMarkdownLoading(true); setAnalysisResult(undefined); setAnalysisHistory([]); setAnalysisStreamText(""); setAnalysisPanelOpen(false); setAnalysisError(undefined); setAnalysisStarting(false);
    void getBusinessProvenanceInteraction(selectedInteraction.interactionId)
      .then((value) => { if (current) setProjection(value); })
      .catch(() => { if (current) message.error("调用事实加载失败"); });
    void getBusinessProvenanceMarkdown(selectedInteraction.interactionId)
      .then((value) => { if (current) setAnalysisMarkdown(value); })
      .catch(() => { if (current) message.error("过程事实 Markdown 加载失败"); })
      .finally(() => { if (current) setAnalysisMarkdownLoading(false); });
    void getBusinessProvenanceAnalysisHistory(selectedInteraction.interactionId).then((entries) => {
      if (!current) return;
      setAnalysisHistory(entries);
      const latest = entries.find((entry) => entry.status === "completed" && entry.result);
      setAnalysisResult(latest?.result);
    }).catch(() => { if (current) setAnalysisHistory([]); });
    return () => { current = false; };
  }, [selectedInteraction]);

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
    } catch (error) { setAnalysisError(`分析失败：${analysisErrorMessage(error)}`); } finally { setAnalysisStarting(false); }
  }, [analysisMarkdown, selectedInteraction]);

  const copyMarkdown = useCallback(async () => {
    if (!selectedInteraction || !analysisMarkdown) return;
    await navigator.clipboard?.writeText(analysisMarkdown);
    message.success("本轮 Markdown 已复制");
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

  const conversationColumns: ColumnsType<BusinessProvenanceConversation> = [
    { dataIndex: "startedAt", title: "开始时间", width: 180, render: (value: string | undefined, item) => <div className={styles.timeCell}><b>{formatTime(value)}</b><small>{item.conversationId}</small></div> },
    { dataIndex: "questionPreview", title: "用户问题", width: 260, render: (value: string | undefined, item) => <Button type="link" className={styles.questionLink} onClick={() => setSelectedConversation(item)}>{value || "未记录问题"}</Button> },
    { dataIndex: "interactionCount", title: "交互轮次", width: 90, align: "center", render: (value?: number) => value ?? 0 },
    { dataIndex: "resultPreview", title: "业务结果", width: 260, ellipsis: true, render: (value?: string) => <span className={styles.tableClamp}>{value || "—"}</span> },
    { dataIndex: "agentName", title: "Agent", width: 140, render: (value?: string) => <span className={styles.tableClamp}>{value || "未记录 Agent"}</span> },
    { dataIndex: "status", title: "状态", width: 90, render: (value?: string) => <span className={styles.statusText}>{statusLabel(value)}</span> },
    { title: "证据完整性", width: 120, render: (_, item) => <span className={styles.evidence}>{evidenceLabel(item)}</span> },
    { dataIndex: "durationMs", title: "耗时", width: 90, render: (value?: number) => formatDuration(value) },
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
      <div><Typography.Title level={2}>业务溯源</Typography.Title><Typography.Text>从用户问题和业务结果出发，查看 Agent 如何调用业务知识网络并形成结论。</Typography.Text></div>
      <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>刷新</Button>
    </header>
    <section className={styles.listCard}>
      <div className={styles.filters}>
        <Input value={conversationKeyword} onChange={(event) => setConversationKeyword(event.target.value)} prefix={<SearchOutlined />} placeholder="搜索问题、结果或会话 ID" onPressEnter={() => { setConversationPage(1); void loadConversations(); }} />
        <Input placeholder="开始时间" aria-label="开始时间" />
        <Input placeholder="结束时间" aria-label="结束时间" />
        <Input value={conversationAgent} onChange={(event) => setConversationAgent(event.target.value)} placeholder="Agent / 应用" onPressEnter={() => { setConversationPage(1); void loadConversations(); }} />
        <Input placeholder="业务域" aria-label="业务域" />
        <Input placeholder="知识网络" aria-label="知识网络" />
        <Select allowClear placeholder="运行状态" value={conversationStatus} options={[{ value: "completed", label: "已完成" }, { value: "failed", label: "失败" }, { value: "running", label: "进行中" }]} onChange={(value) => { setConversationPage(1); setConversationStatus(value); }} />
        <Select allowClear placeholder="证据完整性" options={[{ value: "complete", label: "完整可溯源" }, { value: "partial", label: "部分可溯源" }]} />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => { setConversationPage(1); void loadConversations(); }}>查询</Button>
        <Button aria-label="重置筛选" icon={<ReloadOutlined />} onClick={() => { setConversationKeyword(""); setConversationAgent(""); setConversationStatus(undefined); setConversationPage(1); }} />
      </div>
      <Table rowKey="conversationId" columns={conversationColumns} dataSource={conversations} loading={loading} tableLayout="fixed" scroll={{ x: 1230 }} locale={{ emptyText: <Empty description="暂无业务会话" /> }} pagination={{ current: conversationPage, pageSize: 20, total: conversationTotal, showSizeChanger: true, showTotal: (total) => `共 ${total} 条`, onChange: setConversationPage }} />
    </section>
  </main>;

  return <main className={`${styles.page} ${styles.pageSurface}`}>
    <header className={styles.pageHeader}>
      <div><Typography.Title level={2}>业务溯源分析</Typography.Title><Typography.Text>从真实调用事实查看 Agent 如何使用业务知识网络。</Typography.Text></div>
      <Button icon={<ReloadOutlined />} onClick={() => void loadConversations()}>刷新</Button>
    </header>
    <section className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <Button type="link" className={styles.backButton} onClick={() => { setSelectedConversation(undefined); setSelectedInteraction(undefined); setProjection(undefined); }}>← 返回业务会话</Button>
        <div className={styles.conversationHeading}><h1>{conversationTitle(selectedConversation)}</h1><span>{selectedConversation.conversationId}</span><span>{interactions.length || selectedConversation.interactionCount || 0} 轮交互</span><span>{projection?.operations.length ?? "—"} 次调用</span><span>{selectedConversation.agentName || "未记录 Agent"}</span></div>
      </header>
      <aside className={styles.roundSidebar}>
        <div className={styles.roundSidebarTitle}><div><h3>交互轮次</h3><span>共 {interactions.length} 轮 · 当前 {Math.max(1, interactions.findIndex((item) => item.interactionId === selectedInteraction?.interactionId) + 1)} 轮</span></div></div>
        <Input value={interactionKeyword} onChange={(event) => setInteractionKeyword(event.target.value)} prefix={<SearchOutlined />} placeholder="搜索问题或业务对象" />
        <div className={styles.roundList}>{interactions.map((item, index) => <button key={item.interactionId} className={item.interactionId === selectedInteraction?.interactionId ? styles.roundSelected : ""} onClick={() => setSelectedInteraction(item)}><b>第 {index + 1} 轮</b><strong>{item.questionPreview || "未记录问题"}</strong><small>{formatClock(item.startedAt)} · {formatDuration(item.durationMs)} · {statusLabel(item.status)}</small></button>)}</div>
      </aside>
      <section className={styles.analysisPane}>
        {projection ? <>
          <section className={styles.interactionSummary}>
            <header><span>第 {Math.max(1, interactions.findIndex((item) => item.interactionId === selectedInteraction?.interactionId) + 1)} 轮</span><h2>{selectedInteraction?.questionPreview || "本轮问题未记录"}</h2><small>{selectedConversation.agentName || "未记录 Agent"} · {formatTime(selectedInteraction?.startedAt)} · {formatDuration(selectedInteraction?.durationMs)} · {projection.operations.length} 次调用 · {statusLabel(selectedInteraction?.status)}</small></header>
            <div className={styles.sourceTexts}><div><h4>本轮输入（原文）</h4><p>{selectedInteraction?.questionPreview || "用户输入未记录"}</p></div><div><h4>本轮输出（原文）</h4><p>{selectedInteraction?.resultPreview || "业务结果未记录"}</p></div></div>
            <footer><Button icon={<CopyOutlined />} disabled={analysisMarkdownLoading || !analysisMarkdown} onClick={() => void copyMarkdown()}>复制 Markdown</Button><Button icon={<DownloadOutlined />} disabled={analysisMarkdownLoading || !analysisMarkdown} onClick={() => void downloadMarkdown()}>下载 Markdown</Button><Button type="primary" onClick={() => { setDetailOperation(undefined); setKnowledgeSelection(undefined); setAnalysisPanelOpen(true); }}>交给 BKN Agent 分析</Button></footer>
          </section>
          <Segmented className={styles.viewSwitch} value={view} onChange={(value) => { setView(value as View); setDetailOperation(undefined); }} options={[{ label: "时间链视图", value: "timeline" }, { label: "知识网络视图", value: "knowledge" }]} />
          {view === "timeline" ? <section className={styles.timeline}>
            <div className={styles.inputNode}><i /><div><b>本轮输入</b><span>{formatTime(selectedInteraction?.startedAt)}</span></div></div>
            {projection.operations.map((operation, index) => <div className={styles.timelineItem} key={operation.operationId}>
              <div className={styles.timelineRail}><i />{index < projection.operations.length - 1 ? <span /> : null}</div>
              <article className={styles.operationCard} onClick={() => setDetailOperation(operation)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setDetailOperation(operation); }}>
                <header><h3>{operationTitle(operation)}</h3>{operation.elements[0] ? <Tag>{operation.elements[0].name || operation.elements[0].id}</Tag> : null}</header>
                <p><b>条件：</b>{operationCondition(operation)}</p>
                <small>{formatClock(operation.startedAt)} · {formatDuration(operation.durationMs)} · {operation.toolName || "接口未记录"}</small>
                <p className={styles.operationResult}>{operationResult(operation, projection.derivedFacts)}</p>
                <Button type="link" onClick={(event) => { event.stopPropagation(); setDetailOperation(operation); }}>调用详情</Button>
              </article>
            </div>)}
          </section> : <section className={styles.knowledgeCanvas}>
            <p className={styles.knowledgePath}>业务知识网络 → 本轮触达对象 → 源 BKN 关系（上下文）→ 相邻对象</p>
            {groups.length ? groups.map(([network, elements]) => <div className={styles.knowledgeGrid} key={network}>
              <section className={styles.knowledgeColumn}><h3><span>1</span>业务知识网络</h3><article className={styles.networkCard}><b>{network}</b><small>{network}</small></article><p className={styles.candidateNote}>仅展示本轮调用确定性触达的业务元素。</p></section>
              <section className={styles.knowledgeColumn}><h3><span>2</span>本轮已触达</h3>{elements.map((element) => <button key={`${element.kind}:${element.id}`} className={knowledgeSelection?.elementId === element.id ? styles.knowledgeSelected : ""} onClick={() => setKnowledgeSelection({ network, elementId: element.id, elementName: element.name })}><b>{element.name}</b><small>{elementKindText(element.kind)} · {element.operationIds.length} 次确定性调用</small></button>)}</section>
              <section className={styles.knowledgeColumn}><h3><span>3</span>相关 BKN 关系</h3>{projection.contextRelations.filter((relation) => relation.knowledgeNetworkId === network).length ? projection.contextRelations.filter((relation) => relation.knowledgeNetworkId === network).map((relation) => <article className={styles.contextCard} key={relation.id}><b>{relation.name || relation.id}</b><small>知识网络上下文，非本轮调用</small></article>) : <p className={styles.emptyContext}>本轮未记录可展示的关系上下文。</p>}</section>
            </div>) : <Empty description="本轮尚未记录能够确定性定位到 BKN 元素的调用" />}
          </section>}
        </> : <Empty className={styles.workspaceEmpty} description="选择交互轮次查看调用事实" />}
      </section>
    </section>
    {view === "knowledge" && knowledgeSelection && !detailOperation ? <aside className={styles.knowledgeInspector}><header><small>本轮已触达</small><b>{knowledgeSelection.elementName}</b><Button type="text" icon={<CloseOutlined />} aria-label="关闭知识网络详情" onClick={() => setKnowledgeSelection(undefined)} /></header><section><h4>事实边界</h4><p>本轮有 {selectedKnowledgeCalls.length} 次调用确定性定位到该业务元素。</p></section><section><h4>关联调用</h4>{selectedKnowledgeCalls.map((operation) => <button key={operation.operationId} onClick={() => { setKnowledgeSelection(undefined); setDetailOperation(operation); }}><b>{operationTitle(operation)}</b><small>{operation.toolName || "接口未记录"} · {operationCondition(operation)}</small></button>)}</section></aside> : null}
    {detailOperation ? <aside className={styles.detailPanel}>
      <header><div><small>本轮业务调用</small><b>{operationTitle(detailOperation)}</b></div><span className={detailOperation.callStatus === "completed" ? styles.completed : styles.failed}>{statusLabel(detailOperation.callStatus)}</span><Button type="text" aria-label="关闭调用详情" icon={<CloseOutlined />} onClick={() => setDetailOperation(undefined)} /></header>
      <section><h4>做了什么</h4><p>{operationTitle(detailOperation)}</p></section>
      <section><h4>操作哪个业务元素</h4><dl>
        <dt>知识网络</dt><dd>{detailOperation.knowledgeNetworkId || "未确定"}</dd>
        <dt>业务对象</dt><dd>{businessElementNames(detailOperation, ["object"]).join("、") || "未确定"}</dd>
        {detailOperation.status === "ambiguous" && detailOperation.objects?.length ? <><dt>候选业务对象</dt><dd>{detailOperation.objects.map((object) => object.name || object.id).join("、")}</dd></> : null}
        {businessElementNames(detailOperation, ["relation", "action", "metric"]).length ? <><dt>关系 / 行动 / 指标</dt><dd>{businessElementNames(detailOperation, ["relation", "action", "metric"]).join("、")}</dd></> : null}
        <dt>定位方式</dt><dd>{bindingDescription(detailOperation)}</dd>
        {projection?.conversationContext.find((item) => item.knowledgeNetworkId === detailOperation.knowledgeNetworkId) ? <><dt>会话上下文</dt><dd>{(() => { const source = projection.conversationContext.find((item) => item.knowledgeNetworkId === detailOperation.knowledgeNetworkId); return `${source?.sourceInteractionId} · ${source?.sourceOperationId}`; })()}</dd></> : null}
      </dl></section>
      <section><h4>怎么调用</h4><dl><dt>接口</dt><dd>{detailOperation.toolName || "未记录"}</dd><dt>条件</dt><dd>{operationCondition(detailOperation)}</dd><dt>资源</dt><dd>{resourceDescription(detailOperation)}</dd></dl></section>
      <section><h4>属性与字段</h4>{propertyDescriptions(detailOperation).length ? propertyDescriptions(detailOperation).map((item) => <p key={item}>{item}</p>) : <p>本轮调用没有确定性定位到属性、字段或逻辑。</p>}</section>
      <section><h4>实际结果</h4><p>{operationResult(detailOperation, projection?.derivedFacts)}</p></section>
      {detailOperation.query?.sql ? <section><h4>SQL</h4><pre>{detailOperation.query.sql}</pre></section> : null}
    </aside> : null}
    {analysisPanelOpen ? (
      <div className={styles.agentDrawerMask}>
        <aside className={styles.agentPanel}>
          <header>
            <div><small>业务溯源优化 BKN Agent</small><b>当前交互轮次分析</b></div>
            <Button type="text" icon={<CloseOutlined />} aria-label="关闭 BKN Agent 分析" onClick={() => setAnalysisPanelOpen(false)} />
          </header>
          <p className={styles.agentIntro}>先确认或编辑待分析 Markdown，再启动分析。Agent 实际收到的内容与此处完全相同；可按需查询源 BKN 进行核验，但不得补写 Trace 中不存在的事实。</p>
          <div className={styles.agentSource}>
            <strong>第 {Math.max(1, interactions.findIndex((item) => item.interactionId === selectedInteraction?.interactionId) + 1)} 轮 · {selectedInteraction?.questionPreview || "本轮问题未记录"}</strong>
            <small>{selectedInteraction?.interactionId}<br />{formatTime(selectedInteraction?.startedAt)} · {formatDuration(selectedInteraction?.durationMs)} · {projection?.operations.length ?? 0} 次调用</small>
          </div>
          {analysisHistory.length ? <Select aria-label="历史分析记录" value={analysisHistory.find((item) => item.result === analysisResult)?.analysisId ?? analysisHistory[0]?.analysisId} options={analysisHistory.map((item, index) => ({ value: item.analysisId, label: `分析记录 ${analysisHistory.length - index} · ${formatTime(item.startedAt)} · ${item.status === "completed" ? "已完成" : item.status === "failed" ? "失败" : "分析中"}` }))} onChange={(analysisId) => { const selected = analysisHistory.find((item) => item.analysisId === analysisId); setAnalysisResult(selected?.result); setAnalysisError(selected?.status === "failed" ? `分析失败：${selected.failureMessage || "未返回失败原因"}` : undefined); }} /> : null}
          {!analysisStarting && !analysisResult && !analysisError ? <section className={styles.agentEditor}>
            <h4>待分析 Markdown</h4>
            <p>仅包含当前交互轮次的调用过程事实；编辑只影响本次分析，不修改 Trace。</p>
            <Input.TextArea aria-label="待分析 Markdown" value={analysisMarkdown} onChange={(event) => setAnalysisMarkdown(event.target.value)} autoSize={{ minRows: 14, maxRows: 24 }} disabled={analysisMarkdownLoading} placeholder={analysisMarkdownLoading ? "正在生成过程事实 Markdown…" : "未生成可分析的 Markdown"} />
            <div className={styles.agentEditorActions}><Button icon={<CopyOutlined />} disabled={!analysisMarkdown} onClick={() => void copyMarkdown()}>复制 Markdown</Button><Button icon={<DownloadOutlined />} disabled={!analysisMarkdown} onClick={() => void downloadMarkdown()}>下载 Markdown</Button><Button type="primary" disabled={analysisMarkdownLoading || !analysisMarkdown.trim()} onClick={() => void startAnalysis()}>开始分析</Button></div>
          </section> : null}
          {analysisStarting ? <section className={styles.agentLoading}><div><i /><strong>正在分析当前交互轮次</strong><p>{analysisStreamText || "BKN Agent 正在读取事实并核验源 BKN…"}</p></div></section> : null}
          {analysisError ? <section className={styles.agentError}><strong>分析失败</strong><p>{analysisError.replace(/^分析失败：/, "")}</p><div><Button onClick={() => void copyMarkdown()}>复制本次 Markdown</Button><Button type="primary" onClick={prepareAnalysis}>返回编辑</Button></div></section> : null}
          {analysisResult ? <AnalysisResult result={analysisResult} onRestart={prepareAnalysis} /> : null}
        </aside>
      </div>
    ) : null}
  </main>;
}

function AnalysisResult({ result, onRestart }: { result: Record<string, unknown>; onRestart: () => void }) {
  const advice = agentAdvice(result);
  return <section className={styles.agentResult}>
    {advice.conclusion ? <div className={styles.agentNote}>{advice.conclusion}</div> : null}
    <h3>分类结论</h3>
    <div className={styles.verdictGrid}>{["BKN", "BKN Trace", "MCP", "SDK", "Agent"].map((category) => <div key={category} className={styles.verdict}><strong>{category}</strong><small>{decisionLabel(advice.verdicts[category])}</small></div>)}</div>
    <h3>修改建议</h3>
    {advice.suggestions.length ? advice.suggestions.map((suggestion, index) => <article className={styles.recommendation} key={`${suggestion.id ?? "recommendation"}-${index}`}><header><strong>{suggestion.change || "未返回建议标题"}</strong><span>{suggestion.id || `REC-${index + 1}`}</span></header><dl><dt>类别</dt><dd>{suggestion.category || "未返回"}</dd><dt>修改位置</dt><dd>{suggestion.location || "未返回"}</dd><dt>问题</dt><dd>{suggestion.problem || "未返回"}</dd><dt>源证据</dt><dd>{suggestion.sourceEvidence || "未返回"}</dd><dt>核验证据</dt><dd>{suggestion.verificationEvidence || "未返回"}</dd><dt>修改方式</dt><dd>{suggestion.change || "未返回"}</dd><dt>验收</dt><dd>{suggestion.acceptance || "未返回"}</dd></dl></article>) : <div className={styles.agentSection}>本轮无需修改，或现有事实不足以形成严格建议。</div>}
    <h3>无法判断</h3><div className={styles.agentSection}>{advice.notEvaluable || "无。"}</div>
    <footer><Button onClick={() => { void navigator.clipboard?.writeText(adviceMarkdown(advice)); }}>复制建议 Markdown</Button><Button type="primary" onClick={onRestart}>重新分析</Button></footer>
  </section>;
}

function analysisErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "业务溯源优化 Agent 请求未返回可诊断信息";
}
