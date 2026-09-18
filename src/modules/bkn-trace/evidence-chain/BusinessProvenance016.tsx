/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Alert, Empty, Tag } from "antd";
import i18n from "@/app/locales/i18n";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";

import type {
  AttributedBusinessFunctionView,
  EvidenceChainView,
  PairProvenanceGraph,
  ProvenanceEdgeView,
  QuestionPairView,
  TimeRailItem,
  TimeRailPayload,
} from "./evidence-chain.types";
import styles from "./BusinessProvenance016.module.css";

type DisplayMode = "reading" | "graph";
type GraphLayer = "business" | "ontology" | "technical";
type WorkspacePanel = "timeline" | "evidence";

function p16Text(key: string, options?: Record<string, string | number>) {
  return i18n.t(`bknTrace.evidenceChain.v016.${key}`, options);
}

function statusLabel(value?: string) {
  if (!value) return p16Text("status.unknown");
  const translated = p16Text(`status.${value}`);
  return translated.endsWith(`status.${value}`) ? value : translated;
}

function capabilityLabel(value: string) {
  const translated = p16Text(`capability.${value}`);
  return translated.endsWith(`capability.${value}`) ? value : translated;
}

function pairGraph(view: EvidenceChainView, pair?: QuestionPairView): PairProvenanceGraph | undefined {
  if (!pair) return undefined;
  return view.selectedPairGraphs?.[pair.id];
}

function answerSummary(value: string) {
  return value.split(/\n\s*\n/).map(part => part.trim()).find(Boolean) || value;
}

function QuestionPairCards({ pairs, selectedId, onSelect }: { pairs: QuestionPairView[]; selectedId?: string; onSelect: (id: string) => void }) {
  return <aside className={styles.pairPanel} aria-label={p16Text("pairs.title")}>
    <header><div><strong>{p16Text("pairs.title")}</strong><Tag>{pairs.length}</Tag></div><p>{p16Text("pairs.description")}</p></header>
    <div className={styles.pairList}>{pairs.map((pair, index) => <button
      type="button"
      key={pair.id}
      className={pair.id === selectedId ? styles.pairActive : undefined}
      onClick={() => onSelect(pair.id)}
      aria-pressed={pair.id === selectedId}
      aria-label={`${pair.summary}，${statusLabel(pair.status)}`}
    >
      <span className={styles.pairNumber}>{index + 1}</span>
      <span><b>{pair.summary}</b><small>{pair.answer ? answerSummary(pair.answer) : p16Text("pairs.answerMissing")}</small></span>
      <em className={styles[pair.status] || styles.neutral}>{statusLabel(pair.status)}</em>
    </button>)}</div>
  </aside>;
}

function payloadContent(value?: TimeRailPayload) {
  if (!value) return p16Text("function.notRecorded");
  if (value.mode === "inline" && value.inline !== undefined) return typeof value.inline === "string" ? value.inline : JSON.stringify(value.inline, null, 2);
  if (value.mode === "referenced") return value.ref || p16Text("function.notRecorded");
  return value.omitted_reason || p16Text("function.notRecorded");
}

function RecordedAttempt({ item }: { item: TimeRailItem }) {
  const [open, setOpen] = useState(false);
  const name = managedFunctionInfo(item)?.name || timelineBusinessName(item.interface_name);
  return <details className={styles.attempt} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><code>{name} ({item.interface_name})</code> · #{item.attempt} · {statusLabel(item.status)}</summary>
    {open && <>
      <small>{item.operation_id}</small>
      <div><b>{p16Text("function.inputPayload")}</b><pre>{payloadContent(item.input)}</pre></div>
      {item.output && <div><b>{p16Text("function.outputPayload")}</b><pre>{payloadContent(item.output)}</pre></div>}
      {item.error && <div><b>{p16Text("function.errorPayload")}</b><pre>{payloadContent(item.error)}</pre></div>}
    </>}
  </details>;
}

function BusinessFunctionCard({ value, timeRail }: { value: AttributedBusinessFunctionView; timeRail: TimeRailItem[] }) {
  const [technical, setTechnical] = useState(false);
  const attempts = timeRail.filter(item => value.operationIds.includes(item.operation_id));
  const managedRoot = attempts.find(item => item.capability?.evidence_contract === managedFunctionContract);
  const recordedResult = managedRoot ? managedFunctionFacts(managedRoot).outputSummary : undefined;
  return <article className={styles.functionCard}>
    <header>
      <div><span className={styles.kicker}>{p16Text("function.title")}</span><h3>{value.displayName}</h3></div>
      <Tag color={value.validationStatus === "invalid" ? "error" : "blue"}>{capabilityLabel(value.capabilityKind)}{value.technicalExecution.completeness === "failed" ? ` · ${statusLabel("failed")}` : value.technicalExecution.completeness === "partial" ? ` · ${statusLabel("partial")}` : ""}</Tag>
    </header>
    <p className={styles.purpose}>{value.businessPurpose}</p>
    <div className={styles.functionFlow}>
      <section><span>{p16Text("function.input")}</span>{value.businessInputs.length ? value.businessInputs.map((input, index) => <div key={`${input.name}:${index}`}><b>{businessFieldLabel(input.name)}</b><p>{input.value ? businessCardSummary(input.value) : input.sourceRef || p16Text("function.valueMissing")}</p><small>{input.sourceKind ? p16Text("function.source", { source: input.sourceKind }) : ""}</small></div>) : <p>{p16Text("function.inputMissing")}</p>}</section>
      <i aria-hidden="true">→</i>
      <section><span>{p16Text("function.process")}</span><b>{value.displayName}</b><p>{value.logicSummary}</p></section>
      <i aria-hidden="true">→</i>
      <section><span>{p16Text("function.output")}</span>{recordedResult ? <p>{recordedResult}</p> : value.businessOutputs.length ? value.businessOutputs.map((output, index) => <p key={`${output.summary}:${index}`}>{businessCardSummary(output.summary, businessResultPriority)}</p>) : <p>{p16Text("function.outputMissing")}</p>}</section>
    </div>
    <button type="button" className={styles.technicalToggle} onClick={() => setTechnical(current => !current)} aria-expanded={technical}>
      {technical ? p16Text("function.collapseTechnical") : p16Text("function.expandTechnical", { count: value.operationIds.length || value.technicalExecution.interfaceNames.length })}
    </button>
    {technical && <section className={styles.technicalDetails} aria-label={p16Text("function.technicalLabel", { name: value.displayName })}>
      <dl>
        <div><dt>{p16Text("function.realInterface")}</dt><dd>{value.technicalExecution.interfaceNames.length ? value.technicalExecution.interfaceNames.map(name => <code key={name}>{name}</code>) : p16Text("function.notRecorded")}</dd></div>
        <div><dt>{p16Text("function.operationId")}</dt><dd>{value.operationIds.length ? value.operationIds.map(id => <code key={id}>{id}</code>) : p16Text("function.notRecorded")}</dd></div>
        <div><dt>{p16Text("function.inputPayload")}</dt><dd>{value.technicalExecution.inputPayloadRef || p16Text("function.inlineOrMissing")}</dd></div>
        <div><dt>{p16Text("function.outputPayload")}</dt><dd>{value.technicalExecution.outputPayloadRef || p16Text("function.inlineOrMissing")}</dd></div>
        <div><dt>{p16Text("function.completeness")}</dt><dd>{value.technicalExecution.completeness || p16Text("function.notRecorded")}</dd></div>
      </dl>
      {attempts.map(item => <RecordedAttempt key={item.id} item={item} />)}
    </section>}
  </article>;
}

function ReadingView({ pair, graph, timeRail, selectedClaimId, onSelectClaim }: { pair: QuestionPairView; graph: PairProvenanceGraph; timeRail: TimeRailItem[]; selectedClaimId?: string; onSelectClaim: (id: string) => void }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const summary = answerSummary(pair.answer || p16Text("pairs.answerMissing"));
  const selectedClaim = graph.claims.find(claim => claim.id === selectedClaimId) || graph.claims[0];
  const linkedFunctions = selectedClaim ? graph.businessFunctions.filter(item => item.supportsClaimIds.includes(selectedClaim.id)) : graph.businessFunctions;
  const visibleFunctions = selectedClaim && linkedFunctions.length === 0 ? graph.businessFunctions : linkedFunctions;
  const evidenceIds = new Set(selectedClaim?.nodeIds || []);
  graph.edges.forEach(edge => { if (selectedClaim && edge.toId === selectedClaim.id) evidenceIds.add(edge.fromId); });
  const visibleEvidence = selectedClaim ? graph.evidenceNodes.filter(node => evidenceIds.has(node.id)) : graph.evidenceNodes;
  return <div className={styles.reading}>
    <section className={styles.answerCard}>
      <div><span className={styles.kicker}>{p16Text("reading.currentQuestion")}</span><h2>{pair.summary}</h2><p>{pair.question}</p></div>
      <div className={styles.answer}><span>{p16Text("reading.answer")}</span><div className={styles.answerSummary}><MarkdownText text={summary} variant="document" /></div><div className={styles.answerActions}><em className={styles[pair.status] || styles.neutral}>{statusLabel(pair.status)}</em>{pair.answer && pair.answer !== summary ? <button type="button" onClick={() => setAnswerOpen(current => !current)}>{answerOpen ? p16Text("reading.collapseAnswer") : p16Text("reading.expandAnswer")}</button> : null}</div></div>
    </section>
    {answerOpen ? <section className={styles.answerDocument} aria-label={p16Text("reading.fullAnswer")}><MarkdownText text={pair.answer} variant="document" /></section> : null}
    {graph.claims.length > 0 && <section className={styles.claimTableWrap}>
      <header><div><span className={styles.kicker}>{p16Text("reading.conclusion")}</span><h3>{p16Text("reading.memberConclusions", { count: graph.claims.length })}</h3></div><Tag color="success">{p16Text("reading.supportedCount", { count: graph.claims.filter(claim => claim.supportStatus === "supported").length })}</Tag></header>
      <div className={styles.claimTableScroller}><table className={styles.claimTable} aria-label={p16Text("reading.conclusion")}><thead><tr><th>#</th><th>{p16Text("reading.conclusion")}</th><th>{p16Text("reading.value")}</th><th>{p16Text("reading.state")}</th></tr></thead><tbody>{graph.claims.map((claim, index) => <tr key={claim.id} className={claim.id === selectedClaim?.id ? styles.claimSelected : undefined}><td>{index + 1}</td><td><button type="button" className={styles.claimSelect} aria-label={p16Text("reading.selectConclusion", { label: claim.label })} aria-pressed={claim.id === selectedClaim?.id} onClick={() => onSelectClaim(claim.id)}>{claim.label}</button></td><td>{claim.value || "—"}</td><td><span className={`${styles.claimState} ${styles[claim.supportStatus || "neutral"]}`}>{statusLabel(claim.supportStatus)}</span></td></tr>)}</tbody></table></div>
    </section>}
    <section className={styles.sectionHead}><div><span className={styles.kicker}>{p16Text("reading.attribution")}</span><h2>{p16Text("reading.processAndEvidence")}</h2></div><p>{p16Text("reading.explanation")}</p></section>
    {visibleFunctions.length ? visibleFunctions.map(item => <BusinessFunctionCard key={item.id} value={item} timeRail={timeRail} />) : <Empty description={p16Text("reading.noFunction")} />}
    {visibleEvidence.length > 0 && <details className={styles.evidenceList}>
      <summary>{p16Text(selectedClaim ? "reading.adoptedEvidence" : "reading.recordedEvidence")} · {p16Text("reading.itemCount", { count: visibleEvidence.length })}</summary>
      <div>{visibleEvidence.map(node => <article key={node.id}><span>{node.kind}</span><b>{node.label}</b>{node.value && <strong>{node.value}</strong>}<p>{node.detail}</p></article>)}</div>
    </details>}
  </div>;
}

type VisualNode = {
  id: string;
  type: "function" | "claim" | "evidence" | "schema" | "step";
  title: string;
  copy?: string;
  meta?: string;
  x: number;
  y: number;
};

function graphNodes(graph: PairProvenanceGraph, layers: Set<GraphLayer>, selectedClaimId?: string): VisualNode[] {
  const nodes: VisualNode[] = [];
  graph.businessFunctions.forEach((value, index) => nodes.push({ id: value.id, type: "function", title: value.displayName, copy: value.logicSummary, meta: capabilityLabel(value.capabilityKind), x: 28, y: 52 + index * 150 }));
  const technicalStart = 52 + graph.businessFunctions.length * 150 + (graph.businessFunctions.length ? 30 : 0);
  if (layers.has("technical")) graph.executionSteps.forEach((value, index) => nodes.push({ id: value.id, type: "step", title: value.businessRole || value.interfaceName, copy: value.interfaceName, meta: value.operationId, x: 28, y: technicalStart + index * 135 }));
  graph.evidenceNodes.forEach((value, index) => nodes.push({ id: value.id, type: "evidence", title: value.label, copy: value.value || value.detail, meta: value.kind, x: 300, y: 52 + index * 125 }));
  const schemaStart = 52 + graph.evidenceNodes.length * 125 + (graph.evidenceNodes.length ? 30 : 0);
  if (layers.has("ontology")) graph.schemaNodes.forEach((value, index) => nodes.push({ id: value.id, type: "schema", title: value.label, copy: value.detail, meta: value.kind, x: 300, y: schemaStart + index * 120 }));
  const selectedClaim = graph.claims.find(value => value.id === selectedClaimId) || graph.claims[0];
  if (selectedClaim) nodes.push({ id: selectedClaim.id, type: "claim", title: selectedClaim.label, copy: selectedClaim.value, meta: statusLabel(selectedClaim.supportStatus), x: 572, y: 52 });
  return nodes;
}

function nodeTypeLabel(value: VisualNode["type"]) {
  return p16Text(`graph.${value}`);
}

function GraphView({ graph, selectedClaimId, onSelectClaim }: { graph: PairProvenanceGraph; selectedClaimId?: string; onSelectClaim: (id: string) => void }) {
  const [layers, setLayers] = useState<Set<GraphLayer>>(() => new Set(["business"]));
  const nodes = useMemo(() => graphNodes(graph, layers, selectedClaimId), [graph, layers, selectedClaimId]);
  const [selectedId, setSelectedId] = useState<string>(selectedClaimId || graph.businessFunctions[0]?.id);
  useEffect(() => setSelectedId(selectedClaimId || graph.businessFunctions[0]?.id), [graph, selectedClaimId]);
  const visible = useMemo(() => new Set(nodes.map(node => node.id)), [nodes]);
  const edges = graph.edges.filter(edge => visible.has(edge.fromId) && visible.has(edge.toId));
  const selected = nodes.find(node => node.id === selectedId) || nodes[0];
  const connected = useMemo(() => {
    const ids = new Set<string>(selected ? [selected.id] : []);
    if (!selected) return ids;
    let changed = true;
    while (changed) {
      changed = false;
      edges.forEach(edge => {
        if (ids.has(edge.fromId) && !ids.has(edge.toId)) { ids.add(edge.toId); changed = true; }
        if (ids.has(edge.toId) && !ids.has(edge.fromId)) { ids.add(edge.fromId); changed = true; }
      });
    }
    return ids;
  }, [edges, selected]);
  const toggleLayer = (layer: GraphLayer) => setLayers(current => {
    const next = new Set(current);
    if (next.has(layer)) next.delete(layer); else next.add(layer);
    next.add("business");
    return next;
  });
  const maxY = Math.max(500, ...nodes.map(node => node.y + 120));
  return <section className={styles.graphPanel}>
    <header className={styles.graphHeader}><div><span className={styles.kicker}>{p16Text("graph.kicker")}</span><h2>{p16Text("graph.title")}</h2><p>{p16Text("graph.description")}</p></div></header>
    <div className={styles.graphToolbar}>
      <label className={styles.graphClaimPicker}><span>{p16Text("graph.selectClaim")}</span><select aria-label={p16Text("graph.selectClaim")} value={selectedClaimId || ""} onChange={event => onSelectClaim(event.target.value)}>{graph.claims.map(claim => <option key={claim.id} value={claim.id}>{claim.label}</option>)}</select></label>
      <span>{p16Text("graph.layers")}</span>
      <button type="button" className={styles.layerActive}>{p16Text("graph.businessLayer")}</button>
      <button type="button" className={layers.has("ontology") ? styles.layerActive : undefined} onClick={() => toggleLayer("ontology")} aria-pressed={layers.has("ontology")}>{p16Text("graph.ontologyLayer")}</button>
      <button type="button" className={layers.has("technical") ? styles.layerActive : undefined} onClick={() => toggleLayer("technical")} aria-pressed={layers.has("technical")}>{p16Text("graph.technicalLayer")}</button>
    </div>
    <div className={styles.graphLayout}>
      <div className={styles.graphViewport} style={{ minHeight: maxY }}>
        <svg className={styles.graphEdges} viewBox={`0 0 1160 ${maxY}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id="bp016-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
          {edges.map((edge: ProvenanceEdgeView) => {
            const from = nodes.find(node => node.id === edge.fromId); const to = nodes.find(node => node.id === edge.toId);
            if (!from || !to) return null;
            const x1 = from.x + 210; const y1 = from.y + 45; const x2 = to.x; const y2 = to.y + 45; const mid = (x1 + x2) / 2;
            return <path key={edge.edgeId} className={selected && connected.has(from.id) && connected.has(to.id) ? styles.edgeActive : undefined} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} markerEnd="url(#bp016-arrow)" />;
          })}
        </svg>
        {nodes.map(node => <button
          type="button"
          key={node.id}
          onClick={() => setSelectedId(node.id)}
          className={`${styles.graphNode} ${styles[`node_${node.type}`]} ${node.id === selected?.id ? styles.nodeSelected : ""} ${selected && !connected.has(node.id) ? styles.nodeDim : ""}`}
          style={{ left: node.x, top: node.y }}
          aria-label={`${nodeTypeLabel(node.type)}：${node.title}`}
        ><small>{nodeTypeLabel(node.type)}</small><b>{node.title}</b>{node.copy && <span>{node.copy}</span>}{node.meta && <em>{node.meta}</em>}</button>)}
      </div>
      <aside className={styles.inspector} aria-label={p16Text("graph.inspector")}>
        {selected ? <><span className={styles.kicker}>{nodeTypeLabel(selected.type)}</span><h3>{selected.title}</h3><p>{selected.copy || p16Text("graph.noDetail")}</p><dl><div><dt>{p16Text("graph.projectedNode")}</dt><dd><code>{selected.id}</code></dd></div><div><dt>{p16Text("graph.source")}</dt><dd>{selected.meta || nodeTypeLabel(selected.type)}</dd></div>{connected.size > 1 && <div><dt>{p16Text("graph.proofPath")}</dt><dd>{nodes.filter(node => node.id !== selected.id && connected.has(node.id)).map(node => <span className={styles.pathNode} key={node.id}>{nodeTypeLabel(node.type)} · {node.title}</span>)}</dd></div>}</dl>{selected.type === "function" && <button type="button" onClick={() => toggleLayer("technical")}>{layers.has("technical") ? p16Text("graph.collapseExecution") : p16Text("graph.expandExecution")}</button>}</> : <p>{p16Text("graph.selectNode")}</p>}
      </aside>
    </div>
  </section>;
}

function timeLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function durationLabel(value?: number) {
  if (value === undefined) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function payloadSummary(value?: TimeRailPayload) {
  if (!value) return p16Text("function.notRecorded");
  if (value.mode === "referenced") return p16Text("timeline.referenced", { bytes: value.byte_length });
  if (value.mode === "omitted") return value.omitted_reason || p16Text("timeline.omitted");
  if (value.inline && typeof value.inline === "object") {
    const row = value.inline as Record<string, unknown>;
    if (Array.isArray(row.rows)) return p16Text("timeline.rows", { count: row.rows.length });
    if (Array.isArray(row.data)) return p16Text("timeline.rows", { count: row.data.length });
    return Object.keys(row).slice(0, 4).join(" · ") || p16Text("timeline.inline");
  }
  if (value.inline === undefined || value.inline === null) return p16Text("timeline.inline");
  if (typeof value.inline === "string") return value.inline;
  if (typeof value.inline === "number" || typeof value.inline === "boolean" || typeof value.inline === "bigint") return String(value.inline);
  return p16Text("timeline.inline");
}

const managedFunctionContract = "managed_function_execution/v1";

type ManagedFunctionInfo = { name: string; description: string };
type TimeRailEntry = { root: TimeRailItem; members: TimeRailItem[]; managed: boolean };

function inlineObject(value?: TimeRailPayload): Record<string, unknown> | undefined {
  if (value?.mode !== "inline" || value.inline === undefined || value.inline === null) return undefined;
  if (typeof value.inline === "object" && !Array.isArray(value.inline)) return value.inline as Record<string, unknown>;
  if (typeof value.inline !== "string") return undefined;
  try {
    const parsed = JSON.parse(value.inline) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function businessFieldLabel(key: string) {
  const translated = p16Text(`timeline.field.${key}`);
  return translated.endsWith(`timeline.field.${key}`) ? key : translated;
}

function businessValue(value: unknown): string {
  if (typeof value === "boolean") return value ? p16Text("timeline.booleanTrue") : p16Text("timeline.booleanFalse");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const primitives = value.filter(item => ["string", "number", "boolean"].includes(typeof item)).slice(0, 3).map(businessValue);
    if (primitives.length === value.length && primitives.length > 0) return `${value.length} ${p16Text("timeline.items")}：${primitives.join("、")}`;
    const demandText = value.map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const record = item as Record<string, unknown>;
      const product = record.product ?? record.product_code;
      const qty = record.qty ?? record.demand_qty;
      return product !== undefined && qty !== undefined ? `${businessValue(product)} × ${businessValue(qty)}` : "";
    }).filter(Boolean);
    if (demandText.length === value.length && demandText.length > 0) return demandText.join("；");
    return primitives.length ? `${value.length} ${p16Text("timeline.items")}：${primitives.join("、")}${value.length > primitives.length ? "…" : ""}` : `${value.length} ${p16Text("timeline.items")}`;
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return p16Text("function.valueMissing");
}

function unwrapBusinessResult(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return unwrapBusinessResult(JSON.parse(trimmed) as unknown); } catch { return value; }
    }
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.body !== undefined) return unwrapBusinessResult(record.body);
  if (record.result !== undefined && record.result !== null) return unwrapBusinessResult(record.result);
  if (record.stdout !== undefined && record.stdout !== "") return unwrapBusinessResult(record.stdout);
  return record;
}

const businessResultPriority = [
  "l1_main_count", "affected_product_count", "total_sellable_qty", "fg_qty", "theoretical_build_qty",
  "kitting_ok", "gap_count", "all_satisfied", "unsatisfied_demand_count", "shared_shortage_count",
  "node_count_total", "shared_count", "line_count", "lead_time_days", "count",
];

function businessRecordSummary(value: unknown, priority: string[] = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return businessValue(value);
  const record = value as Record<string, unknown>;
  const ordered = [...priority, ...Object.keys(record)].filter((key, index, all) => all.indexOf(key) === index);
  const chosen = ordered.filter(key => record[key] !== undefined && !["status_code", "exit_code", "metrics", "artifacts", "session_id"].includes(key)).slice(0, 3);
  return chosen.map(key => `${businessFieldLabel(key)} ${businessValue(record[key])}`).join("；");
}

function businessCardSummary(value: string, priority: string[] = []) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return businessRecordSummary(unwrapBusinessResult(JSON.parse(trimmed) as unknown), priority) || value;
  } catch {
    return value;
  }
}

function managedFunctionFacts(item: TimeRailItem) {
  const input = inlineObject(item.input);
  const inputSummary = businessRecordSummary(input?.arguments, ["product", "material_code", "qty", "demands", "forecast_id", "substitute_enabled", "depth", "include_substitute"]);
  const output = item.output?.mode === "inline" ? unwrapBusinessResult(item.output.inline) : undefined;
  return { inputSummary, outputSummary: businessRecordSummary(output, businessResultPriority) };
}

function managedFunctionInfo(item?: TimeRailItem): ManagedFunctionInfo | undefined {
  if (!item || item.capability?.evidence_contract !== managedFunctionContract) return undefined;
  const input = inlineObject(item.input);
  const name = typeof input?.function_name === "string" ? input.function_name.trim() : "";
  const description = typeof input?.function_description === "string" ? input.function_description.trim() : "";
  return { name: name || timelineBusinessName(item.interface_name), description };
}

function timelineBusinessName(interfaceName: string) {
  switch (interfaceName) {
    case "search_capabilities": return p16Text("timeline.interface.searchCapabilities");
    case "execute_tool": return p16Text("timeline.interface.executeTool");
    case "query_object_instance": return p16Text("timeline.interface.queryObject");
    case "query_relation_instance": return p16Text("timeline.interface.queryRelation");
    case "run_sql": return p16Text("timeline.interface.runSql");
    case "run_cypher": return p16Text("timeline.interface.runCypher");
    case "run_code": return p16Text("timeline.interface.runCode");
    default: return interfaceName;
  }
}

function buildTimeRailEntries(ordered: TimeRailItem[]): TimeRailEntry[] {
  const children = new Map<string, TimeRailItem[]>();
  ordered.forEach(item => {
    if (!item.parent_operation_id) return;
    children.set(item.parent_operation_id, [...(children.get(item.parent_operation_id) || []), item]);
  });
  const hidden = new Set<string>();
  ordered.forEach(item => {
    if (item.capability?.evidence_contract === managedFunctionContract && item.parent_operation_id) hidden.add(item.parent_operation_id);
  });
  const claimed = new Set<string>();
  const descendants = (root: TimeRailItem) => {
    const result: TimeRailItem[] = [];
    const visit = (item: TimeRailItem) => {
      if (claimed.has(item.id)) return;
      claimed.add(item.id);
      result.push(item);
      (children.get(item.operation_id) || []).forEach(visit);
    };
    visit(root);
    return result.sort((left, right) => left.order - right.order);
  };
  const entries: TimeRailEntry[] = [];
  ordered.forEach(item => {
    if (hidden.has(item.operation_id) || claimed.has(item.id)) return;
    const managed = item.capability?.evidence_contract === managedFunctionContract;
    entries.push({ root: item, members: managed ? descendants(item) : [item], managed });
    if (!managed) claimed.add(item.id);
  });
  return entries;
}

function timelineTechnicalName(entry: TimeRailEntry) {
  return entry.managed ? `execute_tool · ${entry.root.interface_name}` : entry.root.interface_name;
}

function timeRailEntryStatus(entry: TimeRailEntry): "completed" | "failed" {
  return entry.members.some(item => item.status === "failed") ? "failed" : "completed";
}

export type TimeRailBusinessSummary = { name?: string; object?: string; condition?: string; result?: string };

export function TimeRailView({ items, summaries = {} }: { items: TimeRailItem[]; summaries?: Record<string, TimeRailBusinessSummary> }) {
  const ordered = useMemo(() => [...items].sort((left, right) => left.order - right.order), [items]);
	const entries = useMemo(() => buildTimeRailEntries(ordered), [ordered]);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");
	const filtered = filter === "all" ? entries : entries.filter(entry => timeRailEntryStatus(entry) === filter);
	const [selectedId, setSelectedId] = useState(entries[0]?.root.id);
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const firstItemId = entries[0]?.root.id;
  useEffect(() => setSelectedId(firstItemId), [firstItemId]);
	const visibleIds = new Set(filtered.flatMap(entry => entry.members.map(item => item.id)));
	const selected = visibleIds.has(selectedId || "") ? ordered.find(item => item.id === selectedId) : filtered[0]?.root;
  if (!ordered.length) return <Empty description={p16Text("timeline.empty")} />;
  return <section className={styles.timeWorkspace}>
	<header className={styles.timeIntro}><div><span className={styles.kicker}>{p16Text("timeline.kicker")}</span><h2>{p16Text("timeline.title")}</h2><p>{p16Text("timeline.description")}</p></div><div className={styles.timeFilters} role="group" aria-label={p16Text("timeline.filterLabel")}><button type="button" className={filter === "all" ? styles.filterActive : undefined} onClick={() => setFilter("all")}>{p16Text("timeline.all", { count: entries.length })}</button><button type="button" className={filter === "completed" ? styles.filterActive : undefined} onClick={() => setFilter("completed")}>{p16Text("timeline.completed", { count: entries.filter(entry => timeRailEntryStatus(entry) === "completed").length })}</button><button type="button" className={filter === "failed" ? styles.filterActive : undefined} onClick={() => setFilter("failed")}>{p16Text("timeline.failed", { count: entries.filter(entry => timeRailEntryStatus(entry) === "failed").length })}</button></div></header>
    <div className={styles.timeLayout}>
	  <div className={styles.timeList}>{filtered.map((entry, index) => {
		const item = entry.root;
		const functionInfo = managedFunctionInfo(item);
		const facts = entry.managed ? managedFunctionFacts(item) : undefined;
		const isExpanded = expanded.has(item.id);
		const entryStatus = timeRailEntryStatus(entry);
		const internal = entry.members.slice(1);
		return <article className={styles.timeGroup} key={item.id}>
		  <button type="button" className={`${styles.timeItem} ${entry.members.some(member => member.id === selected?.id) ? styles.timeSelected : ""}`} onClick={() => setSelectedId(item.id)}>
			<time>{timeLabel(item.started_at)}</time><span className={`${styles.timeDot} ${styles[item.status] || ""}`}>{item.order}</span>
			<span className={styles.timeCopy}><span className={`${styles.timeStatus} ${styles[entryStatus]}`}>{statusLabel(entryStatus)}</span><b>{functionInfo?.name || summaries[item.operation_id]?.name || timelineBusinessName(item.interface_name)}</b><small><code>{timelineTechnicalName(entry)}</code> · {durationLabel(item.duration_ms)}</small><em>{functionInfo?.description || (summaries[item.operation_id]?.result || (item.status === "failed" ? payloadSummary(item.error) : payloadSummary(item.output)))}</em>{facts?.inputSummary ? <small className={styles.timeFact}>{p16Text("timeline.businessInput")}：{facts.inputSummary}</small> : null}{facts?.outputSummary ? <small className={styles.timeFact}>{p16Text("timeline.actualResult")}：{facts.outputSummary}</small> : null}</span>
			{index < filtered.length - 1 ? <i aria-hidden="true" /> : null}
		  </button>
		  {internal.length > 0 ? <button type="button" className={styles.timeGroupToggle} aria-expanded={isExpanded} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}>{isExpanded ? p16Text("timeline.collapseInternal") : p16Text("timeline.expandInternal", { count: internal.length })}</button> : null}
		  {isExpanded ? <div className={styles.timeChildren}>{internal.map(child => <button type="button" key={child.id} className={child.id === selected?.id ? styles.timeChildSelected : undefined} onClick={() => setSelectedId(child.id)}><span>{summaries[child.operation_id]?.object || summaries[child.operation_id]?.name || timelineBusinessName(child.interface_name)}</span><code>{child.interface_name}</code><strong className={`${styles.timeStatus} ${styles[child.status] || ""}`}>{statusLabel(child.status)}</strong>{summaries[child.operation_id]?.condition ? <small title={summaries[child.operation_id].condition}>{summaries[child.operation_id].condition}</small> : null}<em>{summaries[child.operation_id]?.result || (child.status === "failed" ? payloadSummary(child.error) : payloadSummary(child.output))}</em></button>)}</div> : null}
		</article>;
	  })}</div>
	  <aside className={styles.timeInspector} aria-label={p16Text("timeline.inspector")}><span className={styles.kicker}>{p16Text("timeline.selectedCall")}</span>{selected ? <><h3>{managedFunctionInfo(selected)?.name || summaries[selected.operation_id]?.name || timelineBusinessName(selected.interface_name)}</h3>{managedFunctionInfo(selected) ? <small className={styles.inspectorInterface}>execute_tool · {selected.interface_name}</small> : null}<p>{selected.status === "failed" ? p16Text("timeline.failedCall") : managedFunctionInfo(selected)?.description || summaries[selected.operation_id]?.result || payloadSummary(selected.output)}</p>{managedFunctionInfo(selected) ? <div className={styles.inspectorFacts}>{managedFunctionFacts(selected).inputSummary ? <p><b>{p16Text("timeline.businessInput")}</b>{managedFunctionFacts(selected).inputSummary}</p> : null}{managedFunctionFacts(selected).outputSummary ? <p><b>{p16Text("timeline.actualResult")}</b>{managedFunctionFacts(selected).outputSummary}</p> : null}</div> : null}<dl><div><dt>{p16Text("function.operationId")}</dt><dd><code>{selected.operation_id}</code></dd></div><div><dt>{p16Text("timeline.status")}</dt><dd>{statusLabel(selected.status)}</dd></div><div><dt>{p16Text("timeline.started")}</dt><dd>{timeLabel(selected.started_at)}</dd></div><div><dt>{p16Text("timeline.duration")}</dt><dd>{durationLabel(selected.duration_ms)}</dd></div><div><dt>{p16Text("function.realInterface")}</dt><dd><code>{selected.interface_name}</code></dd></div></dl><details><summary>{p16Text("function.inputPayload")}</summary><pre>{payloadContent(selected.input)}</pre></details>{selected.output ? <details><summary>{p16Text("function.outputPayload")}</summary><pre>{payloadContent(selected.output)}</pre></details> : null}{selected.error ? <details><summary>{p16Text("function.errorPayload")}</summary><pre>{payloadContent(selected.error)}</pre></details> : null}</> : <p>{p16Text("timeline.empty")}</p>}</aside>
    </div>
  </section>;
}

export function BusinessProvenance016({ view, panel = "evidence", onPanelChange, evidenceOnly = false }: { view: EvidenceChainView; panel?: WorkspacePanel; onPanelChange?: (panel: WorkspacePanel) => void; evidenceOnly?: boolean }) {
  const pairs = view.questionPairs || [];
  const firstPairId = pairs[0]?.id;
  const [selectedId, setSelectedId] = useState(firstPairId);
  const [mode, setMode] = useState<DisplayMode>("reading");
  const [activePanel, setActivePanel] = useState<WorkspacePanel>(panel);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>();
  useEffect(() => setSelectedId(firstPairId), [view.interactionId, view.revisionLabel, firstPairId]);
  useEffect(() => setActivePanel(panel), [panel]);
  useEffect(() => {
    if (!fullScreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [fullScreen]);
  const selectedPair = pairs.find(pair => pair.id === selectedId) || pairs[0];
  const sourceGraph = pairGraph(view, selectedPair);
  const graph = sourceGraph ? { ...sourceGraph, evidenceNodes: sourceGraph.evidenceNodes.map(node => {
    const root = (view.timeRail || []).find(item => item.capability?.evidence_contract === managedFunctionContract && node.executionNodeId === `operation:${item.operation_id}:${item.attempt}`);
    if (!root) return node;
    return { ...node, label: managedFunctionInfo(root)?.name || node.label, value: managedFunctionFacts(root).outputSummary || node.value };
  }) } : undefined;
  const firstClaimId = graph?.claims[0]?.id;
  useEffect(() => setSelectedClaimId(firstClaimId), [selectedPair?.id, firstClaimId]);
  const selectPanel = (next: WorkspacePanel) => { setActivePanel(next); onPanelChange?.(next); };
  const supported = view.claims.filter(claim => claim.supportStatus === "supported").length;
  const failed = (view.timeRail || []).filter(item => item.status === "failed").length;
  const content = <div className={`${styles.shell} ${fullScreen ? styles.fullScreen : ""}`}>
    <header className={styles.workspaceToolbar}>
      {!evidenceOnly ? <div className={styles.primaryTabs} role="tablist" aria-label={p16Text("workspace.tabs")}><button type="button" role="tab" aria-selected={activePanel === "timeline"} className={activePanel === "timeline" ? styles.primaryActive : undefined} onClick={() => selectPanel("timeline")}>{p16Text("workspace.timeline")}</button><button type="button" role="tab" aria-selected={activePanel === "evidence"} className={activePanel === "evidence" ? styles.primaryActive : undefined} onClick={() => selectPanel("evidence")}>{p16Text("workspace.evidence")}</button></div> : <div><span className={styles.kicker}>{p16Text("workspace.evidence")}</span><strong>{p16Text("reading.processAndEvidence")}</strong></div>}
      <button type="button" className={styles.fullScreenButton} aria-label={fullScreen ? p16Text("workspace.exitFullScreen") : p16Text("workspace.fullScreen")} aria-pressed={fullScreen} onClick={() => setFullScreen(current => !current)}>{fullScreen ? "↙ " : "↗ "}{fullScreen ? p16Text("workspace.exitFullScreen") : p16Text("workspace.fullScreen")}</button>
    </header>
    {!evidenceOnly ? <><section className={styles.questionBanner}><span>Q</span><div><small>{p16Text("workspace.userQuestion")}</small><strong>{view.question || selectedPair?.question || p16Text("pairs.answerMissing")}</strong></div></section><section className={styles.summaryGrid} aria-label={p16Text("workspace.summary")}><article><span>{p16Text("workspace.pairs")}</span><b>{pairs.length}</b><small>{p16Text("workspace.byQuestion")}</small></article><article><span>{p16Text("workspace.supported")}</span><b>{supported}</b><small>{p16Text("workspace.ofClaims", { count: view.claims.length })}</small></article><article><span>{p16Text("workspace.businessCalls")}</span><b>{new Set(Object.values(view.selectedPairGraphs || {}).flatMap(value => value.executionSteps.map(step => step.operationId))).size}</b><small>{p16Text("workspace.usedByAnswers")}</small></article><article><span>{p16Text("workspace.recordedCalls")}</span><b>{(view.timeRail || []).length}</b><small>{p16Text("workspace.failedCalls", { count: failed })}</small></article></section></> : null}
    {!evidenceOnly && activePanel === "timeline" ? <TimeRailView items={view.timeRail || []} /> : <>
    {view.generationStatus === "analysis_pending" && <Alert type="info" showIcon message={p16Text("pending.title")} description={p16Text("pending.description")} />}
    {!selectedPair ? <Alert type="warning" showIcon message={p16Text("pending.missingGraph")} description={p16Text("pending.missingGraphDescription")} /> : <div className={styles.layout}>
      <QuestionPairCards pairs={pairs} selectedId={selectedPair.id} onSelect={setSelectedId} />
      <main className={styles.main}>
        {!graph ? <Alert type="warning" showIcon message={p16Text("pending.missingGraph")} description={p16Text("pending.missingGraphDescription")} /> : <>
        <div className={styles.modebar}>
          <div role="group" aria-label={p16Text("modes.label")}><button type="button" className={mode === "reading" ? styles.modeActive : undefined} onClick={() => setMode("reading")}>{p16Text("modes.reading")}</button><button type="button" className={mode === "graph" ? styles.modeActive : undefined} onClick={() => setMode("graph")}>{p16Text("modes.graph")}</button></div>
          <span>{p16Text("modes.description")}</span><em>{p16Text("modes.persistedOnly")}</em>
        </div>
        {mode === "reading" ? <ReadingView pair={selectedPair} graph={graph} timeRail={view.timeRail || []} selectedClaimId={selectedClaimId} onSelectClaim={setSelectedClaimId} /> : <GraphView graph={graph} selectedClaimId={selectedClaimId} onSelectClaim={setSelectedClaimId} />}
        </>}
      </main>
    </div>}
    </>}
  </div>;
  return fullScreen ? createPortal(content, document.body) : content;
}
