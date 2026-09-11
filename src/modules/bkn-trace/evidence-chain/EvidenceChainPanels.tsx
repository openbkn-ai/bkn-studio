/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { layoutChain } from "./chain-layout";
import type { ChainClaim, ChainEdge, ChainGraph, ChainNode, EvidenceChainView } from "./evidence-chain.types";
import styles from "./EvidenceChainPanels.module.css";

function upstream(graph: ChainGraph, roots: string[]): ChainGraph {
  const ids = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (ids.has(edge.target) && !ids.has(edge.source)) { ids.add(edge.source); changed = true; }
    }
  }
  return { nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
}

function Graph({ graph, title, mode, onSelect, onEdge, selectedId }: { graph: ChainGraph; title: string; mode: "evidence" | "execution"; onSelect: (node: ChainNode) => void; onEdge: (edge: ChainEdge) => void; selectedId?: string }) {
  const { t } = useTranslation();
  const marker = useId();
  const { positions, width, height, columns } = layoutChain(graph, mode);
  return <section aria-label={title} className={styles.graph}>
    {!graph.nodes.length ? <p className={styles.empty}>{t("bknTrace.evidenceChain.noGraph")}</p> : <div className={styles.canvas} style={{ width, height }}>
      {columns.map((column, index) => <span className={styles.columnTitle} key={column} style={{ left: 28 + index * 310 }}>{t(`bknTrace.evidenceChain.column.${column}`)}</span>)}
      <svg width={width} height={height} className={styles.lines} aria-label={t("bknTrace.evidenceChain.relations")}>
        <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
        {graph.edges.map(edge => {
          const from = positions.get(edge.source), to = positions.get(edge.target);
          if (!from || !to) return null;
          const forward = to.x > from.x, same = from.x === to.x;
          const x1 = from.x + (forward || same ? from.width : 0), x2 = to.x + (forward ? 0 : to.width);
          const y1 = from.y + from.height / 2, y2 = to.y + to.height / 2;
          const bend = same ? 48 : Math.max(35, Math.abs(x2 - x1) * 0.45);
          const d = `M ${x1} ${y1} C ${x1 + (forward || same ? bend : -bend)} ${y1}, ${x2 + (forward ? -bend : bend)} ${y2}, ${x2} ${y2}`;
          const metadata = edge.kind === "key" || edge.kind === "context";
          return <g key={edge.id} data-metadata={metadata}><path data-testid="chain-edge" d={d} markerEnd={`url(#${marker})`} /><path className={styles.edgeHit} d={d} role="button" tabIndex={0} aria-label={edge.label} onClick={() => onEdge(edge)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdge(edge); } }} />{!metadata && <text onClick={() => onEdge(edge)} x={same ? x1 + 22 : (x1 + x2) / 2} y={(y1 + y2) / 2 - 9} textAnchor="middle">{edge.label}</text>}</g>;
        })}
      </svg>
      {graph.nodes.map(node => <button key={node.id} data-kind={node.kind} aria-pressed={selectedId === node.id} className={styles.node} style={positions.get(node.id) ? { left: positions.get(node.id)!.x, top: positions.get(node.id)!.y } : undefined} onClick={() => onSelect(node)}>
        <small>{t(`bknTrace.evidenceChain.kind.${node.kind}`)}</small><strong title={node.label}>{node.label}</strong>{node.value !== undefined && <span title={node.value}>{node.value}</span>}{node.status && <small>{t(`bknTrace.evidenceChain.status.${node.status}`)}</small>}
      </button>)}
    </div>}
    {graph.edges.some(e => !positions.has(e.source) || !positions.has(e.target)) && <p className={styles.notice}>{t("bknTrace.evidenceChain.missingNode")}</p>}
    <div className={styles.legend}><span>{t("bknTrace.evidenceChain.valueLegend")}</span><span>{t("bknTrace.evidenceChain.metadataLegend")}</span></div>
  </section>;
}

function Answer({ text, claims, select, selectedId }: { text: string; claims: ChainClaim[]; select: (id: string) => void; selectedId?: string }) {
  const chars = Array.from(text);
  let cursor = 0;
  const pieces = [];
  for (const claim of [...claims].sort((a, b) => (a.answerRange?.start ?? Infinity) - (b.answerRange?.start ?? Infinity))) {
    const range = claim.answerRange;
    if (!range || !["checked", "located"].includes(claim.status) || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < cursor || range.end <= range.start || range.end > chars.length || chars.slice(range.start, range.end).join("") !== range.exact) continue;
    pieces.push(chars.slice(cursor, range.start).join(""));
    pieces.push(<button className={styles.anchor} aria-pressed={selectedId === claim.id} key={claim.id} onClick={() => select(claim.id)}>{range.exact}</button>);
    cursor = range.end;
  }
  pieces.push(chars.slice(cursor).join(""));
  return <div className={styles.answer}>{pieces}</div>;
}

function ViewportPortal({ active, children }: { active: boolean; children: ReactNode }) {
  return active ? createPortal(children, document.body) : children;
}

interface BusinessFlow { process: ChainNode; inputs: ChainNode[]; outputs: ChainNode[] }

function businessFlows(graph: ChainGraph): BusinessFlow[] {
  return graph.nodes.filter(node => node.role === "process").flatMap(process => {
    const inputIds = graph.edges.filter(edge => edge.target === process.id).map(edge => edge.source);
    const outputIds = graph.edges.filter(edge => edge.source === process.id).map(edge => edge.target);
    const inputs = graph.nodes.filter(node => inputIds.includes(node.id) && node.role === "input");
    const outputs = graph.nodes.filter(node => outputIds.includes(node.id) && node.role === "output");
    return inputs.length && outputs.length ? [{ process, inputs, outputs }] : [];
  });
}

function BusinessValue({ node }: { node: ChainNode }) {
  return <div className={styles.businessValue}><span>{node.label}</span>{node.value !== undefined && <strong>{node.value}</strong>}</div>;
}

function ExecutionFlows({ graph, outputValues, preferredProcessId, selectedId, onSelect }: { graph: ChainGraph; outputValues: Map<string, string>; preferredProcessId?: string; selectedId?: string; onSelect: (node: ChainNode) => void }) {
  const { t } = useTranslation();
  const flows = businessFlows(graph).sort((left, right) => Number(right.process.id === preferredProcessId) - Number(left.process.id === preferredProcessId));
  const [expanded, setExpanded] = useState(() => new Set(flows.slice(0, 1).map(flow => flow.process.id)));
  useEffect(() => { if (selectedId) setExpanded(current => current.has(selectedId) ? current : new Set([...current, selectedId])); }, [selectedId]);
  const flowNodeIds = new Set(flows.flatMap(flow => [flow.process.id, ...flow.inputs.map(node => node.id), ...flow.outputs.map(node => node.id)]));
  const technical = graph.nodes.filter(node => !flowNodeIds.has(node.id));
  if (!flows.length) return <div className={styles.executionEmpty}><h4>{t("bknTrace.evidenceChain.noBusinessFlow")}</h4><p>{t("bknTrace.evidenceChain.noBusinessFlowDescription")}</p><TechnicalRecords nodes={graph.nodes} onSelect={onSelect} /></div>;
  return <div className={styles.executionFlows}>
    <p className={styles.executionIntro}>{t("bknTrace.evidenceChain.executionIntro")}</p>
    {flows.map(flow => {
      const title = flow.outputs.map(node => node.label).join("、");
      const displayOutput = (node: ChainNode) => ({ ...node, value: outputValues.get(`${flow.process.id}:${node.id}`) ?? node.value });
      return <details key={flow.process.id} role="region" aria-label={t("bknTrace.evidenceChain.businessFlowLabel", { title })} className={`${styles.businessFlow} ${selectedId === flow.process.id ? styles.selectedFlow : ""}`} open={expanded.has(flow.process.id)}>
        <summary onClick={event => { event.preventDefault(); onSelect(flow.process); setExpanded(current => { const next = new Set(current); if (next.has(flow.process.id)) next.delete(flow.process.id); else next.add(flow.process.id); return next; }); }}><div><small>{t("bknTrace.evidenceChain.businessTask")}</small><h4>{title}</h4></div><div className={styles.flowSummary}><strong>{flow.outputs.map(displayOutput).map(node => node.value).filter(Boolean).join(" · ")}</strong><span>{t("bknTrace.evidenceChain.flowSummary", { inputs: flow.inputs.length, outputs: flow.outputs.length })}</span></div><em>{t(`bknTrace.evidenceChain.status.${flow.process.status ?? "unknown"}`)}</em></summary>
        <div className={styles.flowBody}>
          <section className={styles.flowNode}><small>{t("bknTrace.evidenceChain.businessInputs")}</small><h5>{t("bknTrace.evidenceChain.conditionsUsed")}</h5>{flow.inputs.map(node => <BusinessValue key={node.id} node={node} />)}</section>
          <div className={styles.flowArrow}><span>{t("bknTrace.evidenceChain.asInput")}</span><b>→</b></div>
          <button className={`${styles.flowNode} ${styles.flowProcess}`} onClick={() => onSelect(flow.process)}><span className={styles.functionIcon}>ƒ</span><small>{t("bknTrace.evidenceChain.businessProcessing")}</small><h5>{flow.process.label}</h5><em>{t(`bknTrace.evidenceChain.status.${flow.process.status ?? "unknown"}`)}</em></button>
          <div className={styles.flowArrow}><span>{t("bknTrace.evidenceChain.returnsResult")}</span><b>→</b></div>
          <section className={`${styles.flowNode} ${styles.flowOutput}`}><small>{t("bknTrace.evidenceChain.businessResults")}</small><h5>{t("bknTrace.evidenceChain.recordedResults")}</h5>{flow.outputs.map(node => <BusinessValue key={node.id} node={displayOutput(node)} />)}</section>
        </div>
      </details>;
    })}
    <TechnicalRecords nodes={technical} onSelect={onSelect} />
  </div>;
}

function TechnicalRecords({ nodes, onSelect }: { nodes: ChainNode[]; onSelect: (node: ChainNode) => void }) {
  const { t } = useTranslation();
  if (!nodes.length) return null;
  return <details className={styles.technicalRecords}><summary>{t("bknTrace.evidenceChain.technicalRecords", { count: nodes.length })}</summary><p>{t("bknTrace.evidenceChain.technicalRecordsDescription")}</p><div>{nodes.map(node => <button key={node.id} onClick={() => onSelect(node)}><span>{node.label}</span><small>{t(`bknTrace.evidenceChain.status.${node.status ?? "unknown"}`)}</small></button>)}</div></details>;
}

function derivationInputLabel(label: string, translate: (key: string) => string): string {
  const key = ({ instant: "instant", include_substitute: "includeSubstitute", caliber: "caliber", demand_end: "demandEnd", demand_qty: "demandQuantity" } as Record<string, string>)[label];
  return key ? translate(`bknTrace.evidenceChain.derivation.${key}`) : label;
}

function EvidencePaths({ claims, selectedId, select, graph, metadata, setMetadata, onNode, onEdge }: { claims: ChainClaim[]; selectedId?: string; select:(id:string)=>void; graph:ChainGraph; metadata:boolean; setMetadata:(value:boolean)=>void; onNode:(node:ChainNode)=>void; onEdge:(edge:ChainEdge)=>void }) {
  const { t } = useTranslation();
  const initial = selectedId ?? claims[0]?.id;
  const [expanded, setExpanded] = useState(() => new Set(initial ? [initial] : []));
  useEffect(() => { if (selectedId) setExpanded(current => current.has(selectedId) ? current : new Set([...current, selectedId])); }, [selectedId]);
  return <div className={styles.evidencePaths}>
    <p className={styles.executionIntro}>{t("bknTrace.evidenceChain.evidenceIntro")}</p>
    {claims.map(claim => {
      const derivation = claim.derivation;
      return <details key={claim.id} role="region" aria-label={t("bknTrace.evidenceChain.claimPath", { label: claim.label })} className={styles.evidenceClaim} open={expanded.has(claim.id)}>
        <summary onClick={event => { event.preventDefault(); select(claim.id); setExpanded(current => { const next = new Set(current); if (next.has(claim.id)) next.delete(claim.id); else next.add(claim.id); return next; }); }}>
          <div><small>{t(claim.role === "scope" ? "bknTrace.evidenceChain.answerScope" : "bknTrace.evidenceChain.answerConclusion")}</small><h4>{claim.label}</h4><span>{claim.objectLabel}</span></div><strong>{claim.value}</strong><em>{t(`bknTrace.evidenceChain.status.${claim.status}`)}</em>
        </summary>
        <div className={styles.derivationBody}>
          <div className={styles.derivationPath}>
            <section><small>{t("bknTrace.evidenceChain.objectAndConditions")}</small><h5>{claim.objectLabel ?? t("bknTrace.evidenceChain.recordedObject")}</h5>{derivation?.inputs.map(item => <BusinessValue key={`${item.label}:${item.value}`} node={{id:item.label,label:derivationInputLabel(item.label, t),value:item.value,kind:"field"}} />)}</section>
            <b>→</b><section className={styles.derivationProcess}><small>{t("bknTrace.evidenceChain.businessProcessing")}</small><h5>{derivation?.processName || t("bknTrace.evidenceChain.recordedProcessing")}</h5></section>
            <b>→</b><section className={styles.derivationResult}><small>{t(`bknTrace.evidenceChain.derivation.${derivation?.method === "sum" ? "independentVerification" : derivation?.method === "distinct_count" ? "returnedComponents" : "recordedResult"}`)}</small><h5>{derivation?.formula || `${claim.label} = ${claim.value ?? ""}`}</h5></section>
            <b>→</b><section className={styles.derivationConclusion}><small>{t(claim.role === "scope" ? "bknTrace.evidenceChain.adoptedScope" : "bknTrace.evidenceChain.adoptedConclusion")}</small><h5>{claim.label}</h5><strong>{claim.value}</strong></section>
          </div>
          {derivation?.components.length ? <details className={styles.componentDetails}><summary>{t(derivation.method === "sum" ? "bknTrace.evidenceChain.viewWarehouseChecks" : "bknTrace.evidenceChain.viewProducts", { count: derivation.components.length })}</summary><div>{derivation.components.map((item,index) => <div key={`${item.label}:${item.value}:${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></details> : null}
          {derivation?.boundary && <p className={styles.evidenceBoundary}><strong>{t("bknTrace.evidenceChain.evidenceBoundary")}</strong>{derivation.boundary}</p>}
        </div>
      </details>;
    })}
    <details className={styles.rawEvidence}><summary>{t("bknTrace.evidenceChain.rawEvidence")}</summary><div className={styles.toolbar}><span>{t("bknTrace.evidenceChain.interactHint")}</span><label><input type="checkbox" checked={metadata} onChange={event => setMetadata(event.target.checked)} />{t("bknTrace.evidenceChain.metadata")}</label></div><Graph graph={graph} title={t("bknTrace.evidenceChain.evidenceGraph")} mode="evidence" selectedId={undefined} onSelect={onNode} onEdge={onEdge} /></details>
  </div>;
}

function Panels({ view, initialPanel = "evidence", panel: controlledPanel, onPanelChange }: { view: EvidenceChainView; initialPanel?: "evidence" | "execution"; panel?: "evidence" | "execution"; onPanelChange?: (panel: "evidence" | "execution") => void }) {
  const { t } = useTranslation();
  const [localPanel, setLocalPanel] = useState<"evidence" | "execution">(initialPanel);
  const panel = controlledPanel ?? localPanel;
  const setPanel = (next: "evidence" | "execution") => { setLocalPanel(next); onPanelChange?.(next); };
  const [claimId, setClaimId] = useState<string>();
  const [node, setNode] = useState<ChainNode>();
  const [edge, setEdge] = useState<ChainEdge>();
  const [metadata, setMetadata] = useState(false);
  const [executionId, setExecutionId] = useState<string>();
  const [fullScreen, setFullScreen] = useState(false);
  const factMode = view.claims.length === 0;
  const claim = view.claims.find(c => c.id === claimId);
  const selectClaim = (id: string) => { setClaimId(id); setPanel("evidence"); setNode(undefined); setEdge(undefined); };
  const fullGraph = claim ? upstream(view.evidence, claim.nodeIds) : factMode ? { nodes: [], edges: [] } : view.evidence;
  const graph = metadata ? fullGraph : { nodes: fullGraph.nodes.filter(n => (n.role !== "context" || n.kind === "object")), edges: fullGraph.edges.filter(e => e.kind !== "key" && e.kind !== "context" && fullGraph.nodes.some(n => n.id === e.source && (n.role !== "context" || n.kind === "object")) && fullGraph.nodes.some(n => n.id === e.target && (n.role !== "context" || n.kind === "object"))) };
  const objectLabels = [...new Set(view.claims.map(c => c.objectLabel ?? t("bknTrace.evidenceChain.otherConclusions")))];
  const selectedExecution = node?.executionNodeId ? view.execution.nodes.find(n => n.id === node.executionNodeId) : undefined;
  const relatedClaims = panel === "execution" && node ? view.claims.filter(c => upstream(view.evidence, c.nodeIds).nodes.some(n => n.executionNodeId === node.id)) : [];
  const preferredClaim = view.claims.find(claim => claim.role !== "scope") ?? view.claims[0];
  const preferredProcessId = preferredClaim
    ? upstream(view.evidence, preferredClaim.nodeIds).nodes.find(node => node.executionNodeId)?.executionNodeId
    : undefined;
  const executionOutputValues = new Map<string, string>();
  for (const claim of view.claims) {
    const processId = upstream(view.evidence, claim.nodeIds).nodes.find(item => item.executionNodeId)?.executionNodeId;
    if (!processId) continue;
    const outputs = view.execution.edges
      .filter(edge => edge.source === processId)
      .map(edge => view.execution.nodes.find(item => item.id === edge.target))
      .filter((item): item is ChainNode => item?.role === "output");
    const output = outputs.find(item => item.label === claim.label) ?? (outputs.length === 1 ? outputs[0] : undefined);
    if (output && claim.value !== undefined) executionOutputValues.set(`${processId}:${output.id}`, claim.value);
  }
  const fullScreenLabel = t("bknTrace.evidenceChain.fullscreenLabel", { panel: t(panel === "evidence" ? "bknTrace.evidenceChain.evidence" : "bknTrace.evidenceChain.execution") });
  return <ViewportPortal active={fullScreen}><div className={`${styles.root} ${fullScreen ? styles.fullScreen : ""}`} role={fullScreen ? "dialog" : undefined} aria-modal={fullScreen || undefined} aria-label={fullScreen ? fullScreenLabel : undefined}>
    <header className={styles.heading}><div><small>{t("bknTrace.evidenceChain.title")}</small><h2>{t("bknTrace.evidenceChain.question")}</h2></div><div className={styles.headerActions}><span>{view.revisionLabel} · {t(`bknTrace.evidenceChain.status.${view.status}`)}</span><button className={styles.fullScreenButton} onClick={() => setFullScreen(value => !value)}>{t(fullScreen ? "bknTrace.evidenceChain.exitFullscreen" : "bknTrace.evidenceChain.fullscreen")}</button></div></header>
    <section className={styles.summary}><h3>{view.question || t("bknTrace.evidenceChain.noQuestion")}</h3><h4>{t("bknTrace.evidenceChain.answer")}</h4>{view.answer?.trim() ? <Answer text={view.answer} claims={view.claims} select={selectClaim} selectedId={claimId} /> : <p>{t("bknTrace.evidenceChain.noAnswer")}</p>}<p className={styles.muted}>{t("bknTrace.evidenceChain.bindingNotice")}</p></section>
    {view.notices?.[0] && <p className={styles.notice}>{view.notices[0]}</p>}
    {(view.notices?.length ?? 0) > 1 && <details className={styles.scopeDetails}><summary>{t("bknTrace.evidenceChain.scopeDetails")}</summary>{view.notices?.slice(1).map((notice, i) => <p className={styles.notice} key={i}>{notice}</p>)}</details>}
    {!controlledPanel && <nav className={styles.tabs} aria-label={t("bknTrace.evidenceChain.views")}><button aria-pressed={panel === "evidence"} onClick={() => { setPanel("evidence"); setNode(undefined); setEdge(undefined); }}>{t("bknTrace.evidenceChain.evidence")}</button><button aria-pressed={panel === "execution"} onClick={() => { setPanel("execution"); setNode(undefined); setEdge(undefined); }}>{t("bknTrace.evidenceChain.execution")}</button></nav>}
    <div className={styles.workspace}>
    {panel === "evidence" && !factMode && <aside className={styles.catalog}><h3>{t("bknTrace.evidenceChain.conclusions")}</h3>{objectLabels.map(label => <section className={styles.objectGroup} key={label}><h4>{label}</h4><div className={styles.claims}>{view.claims.filter(c => (c.objectLabel ?? t("bknTrace.evidenceChain.otherConclusions")) === label).map(c => <button key={c.id} aria-pressed={claimId === c.id} onClick={() => selectClaim(c.id)}><span>{c.label}</span><strong>{c.value}</strong><small>{t(`bknTrace.evidenceChain.status.${c.status}`)}</small></button>)}</div></section>)}</aside>}
    <div className={styles.graphColumn}>
    {panel === "evidence" && factMode ? <section className={styles.unbound}><h3>{t("bknTrace.evidenceChain.unboundTitle")}</h3><p>{t("bknTrace.evidenceChain.unboundDescription")}</p><button className={styles.sourceLink} onClick={() => setPanel("execution")}>{t("bknTrace.evidenceChain.viewRecordedExecution")}</button></section> : <section className={styles.graphCard}>
    <header className={styles.graphHeading}><div><small>{t("bknTrace.evidenceChain.path")}</small><h3>{claim && panel === "evidence" ? claim.label : t(panel === "execution" ? "bknTrace.evidenceChain.execution" : "bknTrace.evidenceChain.recordedFacts")}</h3></div>{claim && panel === "evidence" && <span className={styles.badge}>{t(`bknTrace.evidenceChain.status.${claim.status}`)}</span>}</header>
    {claim && panel === "evidence" && <div className={styles.scope}><p>{claim.detail ?? t(`bknTrace.evidenceChain.explain.${claim.status}`)}</p><button onClick={() => { setClaimId(undefined); setNode(undefined); setEdge(undefined); }}>{t("bknTrace.evidenceChain.showAll")}</button></div>}
    {panel === "execution" ? <ExecutionFlows graph={view.execution} outputValues={executionOutputValues} preferredProcessId={preferredProcessId} selectedId={executionId} onSelect={n => { setExecutionId(n.id); setNode(n); setEdge(undefined); }} /> : view.claims.some(c => c.derivation) ? <EvidencePaths claims={view.claims} selectedId={claimId} select={selectClaim} graph={graph} metadata={metadata} setMetadata={setMetadata} onNode={n => { setNode(n); setEdge(undefined); }} onEdge={e => { setEdge(e); setNode(undefined); }} /> : <><div className={styles.toolbar}><span>{t("bknTrace.evidenceChain.interactHint")}</span><label><input type="checkbox" checked={metadata} onChange={event => setMetadata(event.target.checked)} />{t("bknTrace.evidenceChain.metadata")}</label></div><Graph graph={graph} title={t("bknTrace.evidenceChain.evidenceGraph")} mode="evidence" selectedId={node?.id} onSelect={n => { setNode(n); setEdge(undefined); }} onEdge={e => { setEdge(e); setNode(undefined); }} /><p className={styles.scope}>{t("bknTrace.evidenceChain.graphNotice")}</p></>}
    </section>}
    {node && <aside className={styles.inspector} aria-label={t("bknTrace.evidenceChain.detail")}><button onClick={() => setNode(undefined)}>{t("bknTrace.evidenceChain.close")}</button><small>{t(`bknTrace.evidenceChain.kind.${node.kind}`)}</small><h3>{node.label}</h3><p className={styles.detailValue}>{node.value}</p><p>{node.detail ?? t("bknTrace.evidenceChain.noDetail")}</p>{selectedExecution && <button className={styles.sourceLink} onClick={() => { setExecutionId(selectedExecution.id); setPanel("execution"); setNode(selectedExecution); setEdge(undefined); }}>{t("bknTrace.evidenceChain.viewExecution")}</button>}{relatedClaims.map(c => <button key={c.id} className={styles.sourceLink} onClick={() => selectClaim(c.id)}>{t("bknTrace.evidenceChain.returnClaim", { label: c.label })}</button>)}{node.technical && <details><summary>{t("bknTrace.evidenceChain.technical")}</summary><pre>{node.technical}</pre></details>}</aside>}
    {edge && <aside className={styles.inspector} aria-label={t("bknTrace.evidenceChain.edgeDetail")}><button onClick={() => setEdge(undefined)}>{t("bknTrace.evidenceChain.close")}</button><small>{t("bknTrace.evidenceChain.edgeDetail")}</small><h3>{edge.label}</h3><p>{fullGraph.nodes.find(n => n.id === edge.source)?.label} → {fullGraph.nodes.find(n => n.id === edge.target)?.label}</p>{edge.role && <p>{edge.role}</p>}<p>{edge.detail ?? t(edge.kind === "key" || edge.kind === "context" || edge.kind === "object" ? "bknTrace.evidenceChain.metadataBoundary" : "bknTrace.evidenceChain.edgeBoundary")}</p>{edge.technical && <details><summary>{t("bknTrace.evidenceChain.technical")}</summary><pre>{edge.technical}</pre></details>}</aside>}
    </div></div>
  </div></ViewportPortal>;
}

export function EvidenceChainPanels({ view, initialPanel, panel, onPanelChange }: { view: EvidenceChainView; initialPanel?: "evidence" | "execution"; panel?: "evidence" | "execution"; onPanelChange?: (panel: "evidence" | "execution") => void }) {
  return <Panels key={`${view.interactionId}:${view.revisionLabel ?? ""}:${initialPanel ?? "evidence"}`} view={view} initialPanel={initialPanel} panel={panel} onPanelChange={onPanelChange} />;
}
