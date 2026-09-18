/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { layoutChain } from "./chain-layout";
import type {
  ChainClaim,
  ChainEdge,
  ChainGraph,
  ChainNode,
  EvidenceChainView,
} from "./evidence-chain.types";
import styles from "./EvidenceChainPanels.module.css";

function upstream(graph: ChainGraph, roots: string[]): ChainGraph {
  const ids = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (ids.has(edge.target) && !ids.has(edge.source)) {
        ids.add(edge.source);
        changed = true;
      }
    }
  }
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}

function preferredExecutionProcess(
  evidence: ChainGraph,
  execution: ChainGraph,
  claim?: ChainClaim,
) {
  if (!claim) return undefined;
  const recorded = upstream(evidence, claim.nodeIds);
  const referencedProcessIds = new Set(
    recorded.nodes.map((node) => node.executionNodeId).filter((id): id is string => Boolean(id)),
  );
  const executionProcessIds = new Set(
    execution.nodes.filter((node) => node.role === "process").map((node) => node.id),
  );
  const processForOutputs = (outputs: ChainNode[]) => {
    for (const output of outputs) {
      const processId = execution.edges.find(
        (edge) =>
          edge.target === output.id &&
          referencedProcessIds.has(edge.source) &&
          executionProcessIds.has(edge.source),
      )?.source;
      if (processId) return processId;
    }
    return undefined;
  };
  const byLabel = processForOutputs(
    execution.nodes.filter((node) => node.role === "output" && node.label === claim.label),
  );
  if (byLabel) return byLabel;
  const matchingValues = execution.nodes.filter(
    (node) =>
      node.role === "output" &&
      node.value !== undefined &&
      claim.value !== undefined &&
      String(node.value) === String(claim.value),
  );
  if (matchingValues.length === 1) {
    const byValue = processForOutputs(matchingValues);
    if (byValue) return byValue;
  }
  let frontier = [...claim.nodeIds];
  const seen = new Set(frontier);
  while (frontier.length) {
    for (const id of frontier) {
      const processId = evidence.nodes.find((node) => node.id === id)?.executionNodeId;
      if (processId && executionProcessIds.has(processId)) return processId;
    }
    const next = evidence.edges
      .filter((edge) => frontier.includes(edge.target) && !seen.has(edge.source))
      .map((edge) => edge.source);
    next.forEach((id) => seen.add(id));
    frontier = next;
  }
  return undefined;
}

function clampGraphScale(value: number) {
  return Math.min(1.8, Math.max(0.45, Math.round(value * 100) / 100));
}

function readableGraphScale(value: number) {
  return Math.max(0.72, clampGraphScale(value));
}

function Graph({
  graph,
  title,
  mode,
  onSelect,
  onEdge,
  selectedId,
}: {
  graph: ChainGraph;
  title: string;
  mode: "evidence" | "execution";
  onSelect: (node: ChainNode) => void;
  onEdge: (edge: ChainEdge) => void;
  selectedId?: string;
}) {
  const { t } = useTranslation();
  const marker = useId();
  const { positions, width, height, columns } = layoutChain(graph, mode);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState<string>();
  const [activeEdgeId, setActiveEdgeId] = useState<string>();
  const graphKey = `${graph.nodes.map((node) => node.id).join("\u0000")}|${graph.edges.map((edge) => edge.id).join("\u0000")}`;
  const zoom = (delta: number) => setScale((value) => clampGraphScale(value + delta));
  const fit = () => {
    const box = viewport.current;
    const next =
      box && box.clientWidth > 0 && box.clientHeight > 0
        ? clampGraphScale(
            Math.min(1, (box.clientWidth - 32) / width, (box.clientHeight - 32) / height),
          )
        : 1;
    setScale(next);
    setPan({ x: 0, y: 0 });
  };
  useEffect(() => {
    const box = viewport.current;
    const next =
      box && box.clientWidth > 0 && box.clientHeight > 0
        ? readableGraphScale(
            Math.min(1, (box.clientWidth - 32) / width, (box.clientHeight - 32) / height),
          )
        : 1;
    setScale(next);
    setPan({ x: 0, y: 0 });
    setActiveNodeId(undefined);
    setActiveEdgeId(undefined);
  }, [graphKey, height, width]);
  useEffect(() => {
    const box = viewport.current;
    if (!box) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setScale((value) => clampGraphScale(value + (event.deltaY < 0 ? 0.1 : -0.1)));
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,[role=button]")) return;
    drag.current = { x: event.clientX, y: event.clientY, left: pan.x, top: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.left + event.clientX - drag.current.x,
      y: drag.current.top + event.clientY - drag.current.y,
    });
  };
  const stopPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return (
    <section aria-label={title} className={styles.graph}>
      <header
        className={styles.graphTools}
        role="group"
        aria-label={t("bknTrace.evidenceChain.graphTools")}
      >
        <span aria-live="polite">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => zoom(-0.1)}
          aria-label={t("bknTrace.evidenceChain.zoomOut")}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => zoom(0.1)}
          aria-label={t("bknTrace.evidenceChain.zoomIn")}
        >
          ＋
        </button>
        <button type="button" onClick={fit}>
          {t("bknTrace.evidenceChain.fitGraph")}
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          {t("bknTrace.evidenceChain.resetGraph")}
        </button>
      </header>
      {!graph.nodes.length ? (
        <p className={styles.empty}>{t("bknTrace.evidenceChain.noGraph")}</p>
      ) : (
        <div
          ref={viewport}
          className={styles.graphViewport}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
        >
          <div
            className={styles.canvas}
            style={{
              width,
              height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            {columns.map((column, index) => (
              <span className={styles.columnTitle} key={column} style={{ left: 28 + index * 310 }}>
                {t(`bknTrace.evidenceChain.column.${column}`)}
              </span>
            ))}
            <svg
              width={width}
              height={height}
              className={styles.lines}
              aria-label={t("bknTrace.evidenceChain.relations")}
            >
              <defs>
                <marker
                  id={marker}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {graph.edges.map((edge) => {
                const from = positions.get(edge.source),
                  to = positions.get(edge.target);
                if (!from || !to) return null;
                const forward = to.x > from.x,
                  same = from.x === to.x;
                const x1 = from.x + (forward || same ? from.width : 0),
                  x2 = to.x + (forward ? 0 : to.width);
                const y1 = from.y + from.height / 2,
                  y2 = to.y + to.height / 2;
                const bend = same ? 48 : Math.max(35, Math.abs(x2 - x1) * 0.45);
                const d = `M ${x1} ${y1} C ${x1 + (forward || same ? bend : -bend)} ${y1}, ${x2 + (forward ? -bend : bend)} ${y2}, ${x2} ${y2}`;
                const metadata = edge.kind === "key" || edge.kind === "context";
                const selectEdge = () => {
                  setActiveEdgeId(edge.id);
                  setActiveNodeId(undefined);
                  onEdge(edge);
                };
                return (
                  <g
                    key={edge.id}
                    data-metadata={metadata}
                    data-selected={activeEdgeId === edge.id}
                  >
                    <path data-testid="chain-edge" d={d} markerEnd={`url(#${marker})`} />
                    <path
                      className={styles.edgeHit}
                      d={d}
                      role="button"
                      tabIndex={0}
                      aria-label={edge.label}
                      onClick={selectEdge}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectEdge();
                        }
                      }}
                    />
                    {!metadata && (
                      <text
                        onClick={selectEdge}
                        x={same ? x1 + 22 : (x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 9}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {graph.nodes.map((node) => (
              <button
                key={node.id}
                data-kind={node.kind}
                aria-pressed={(selectedId ?? activeNodeId) === node.id}
                className={styles.node}
                style={
                  positions.get(node.id)
                    ? { left: positions.get(node.id)!.x, top: positions.get(node.id)!.y }
                    : undefined
                }
                onClick={() => {
                  setActiveNodeId(node.id);
                  setActiveEdgeId(undefined);
                  onSelect(node);
                }}
              >
                <small>{t(`bknTrace.evidenceChain.kind.${node.kind}`)}</small>
                <strong title={node.label}>{node.label}</strong>
                {node.value !== undefined && <span title={node.value}>{node.value}</span>}
                {node.status && <small>{t(`bknTrace.evidenceChain.status.${node.status}`)}</small>}
              </button>
            ))}
          </div>
        </div>
      )}
      {graph.edges.some((e) => !positions.has(e.source) || !positions.has(e.target)) && (
        <p className={styles.notice}>{t("bknTrace.evidenceChain.missingNode")}</p>
      )}
      <div className={styles.legend}>
        <span>{t("bknTrace.evidenceChain.valueLegend")}</span>
        <span>{t("bknTrace.evidenceChain.metadataLegend")}</span>
      </div>
    </section>
  );
}

function Answer({
  text,
  claims,
  select,
  selectedId,
}: {
  text: string;
  claims: ChainClaim[];
  select: (id: string) => void;
  selectedId?: string;
}) {
  const chars = Array.from(text);
  let cursor = 0;
  const pieces = [];
  for (const claim of [...claims].sort(
    (a, b) => (a.answerRange?.start ?? Infinity) - (b.answerRange?.start ?? Infinity),
  )) {
    const range = claim.answerRange;
    if (
      !range ||
      !["checked", "located"].includes(claim.status) ||
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end) ||
      range.start < cursor ||
      range.end <= range.start ||
      range.end > chars.length ||
      chars.slice(range.start, range.end).join("") !== range.exact
    )
      continue;
    pieces.push(chars.slice(cursor, range.start).join(""));
    pieces.push(
      <button
        className={styles.anchor}
        aria-pressed={selectedId === claim.id}
        key={claim.id}
        onClick={() => select(claim.id)}
      >
        {range.exact}
      </button>,
    );
    cursor = range.end;
  }
  pieces.push(chars.slice(cursor).join(""));
  return <div className={styles.answer}>{pieces}</div>;
}

function ViewportPortal({ active, children }: { active: boolean; children: ReactNode }) {
  return active ? createPortal(children, document.body) : children;
}

function InspectorDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className={styles.inspectorBackdrop} onClick={onClose}>
      <aside
        className={styles.inspector}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  );
}

interface BusinessFlow {
  process: ChainNode;
  inputs: ChainNode[];
  outputs: ChainNode[];
  parents: ChainNode[];
}

function businessFlows(graph: ChainGraph): BusinessFlow[] {
  return graph.nodes
    .filter((node) => node.role === "process")
    .flatMap((process) => {
      const inputIds = graph.edges
        .filter((edge) => edge.target === process.id)
        .map((edge) => edge.source);
      const outputIds = graph.edges
        .filter((edge) => edge.source === process.id)
        .map((edge) => edge.target);
      const parentIds = graph.edges
        .filter((edge) => edge.target === process.id)
        .map((edge) => edge.source);
      const inputs = graph.nodes.filter(
        (node) => inputIds.includes(node.id) && node.role === "input",
      );
      const outputs = graph.nodes.filter(
        (node) => outputIds.includes(node.id) && node.role === "output",
      );
      const parents = graph.nodes.filter(
        (node) => parentIds.includes(node.id) && node.role === "process",
      );
      return inputs.length && outputs.length ? [{ process, inputs, outputs, parents }] : [];
    });
}

function BusinessValue({ node }: { node: ChainNode }) {
  return (
    <div className={styles.businessValue}>
      <span>{node.label}</span>
      {node.value !== undefined && <strong>{node.value}</strong>}
    </div>
  );
}

function ClaimStates({ claim }: { claim: ChainClaim }) {
  const { t } = useTranslation();
  if (!claim.supportStatus && !claim.attributionStatus)
    return <em>{t(`bknTrace.evidenceChain.status.${claim.status}`)}</em>;
  return (
    <span className={styles.claimStates}>
      {claim.supportStatus && (
        <em data-state={claim.supportStatus}>
          {t(`bknTrace.evidenceChain.support.${claim.supportStatus}`)}
        </em>
      )}
      {claim.attributionStatus && (
        <em>{t(`bknTrace.evidenceChain.attribution.${claim.attributionStatus}`)}</em>
      )}
    </span>
  );
}

function ExecutionFlows({
  graph,
  preferredProcessId,
  preferredClaimId,
  selectedId,
  relatedClaimsByProcess,
  onSelect,
  onClaim,
}: {
  graph: ChainGraph;
  preferredProcessId?: string;
  preferredClaimId?: string;
  selectedId?: string;
  relatedClaimsByProcess: Map<string, ChainClaim[]>;
  onSelect: (node: ChainNode) => void;
  onClaim: (claimId: string) => void;
}) {
  const { t } = useTranslation();
  const flows = businessFlows(graph).sort(
    (left, right) =>
      Number(right.process.id === preferredProcessId) -
      Number(left.process.id === preferredProcessId),
  );
  const [expanded, setExpanded] = useState(
    () => new Set(flows.slice(0, 1).map((flow) => flow.process.id)),
  );
  useEffect(() => {
    if (selectedId)
      setExpanded((current) =>
        current.has(selectedId) ? current : new Set([...current, selectedId]),
      );
  }, [selectedId]);
  const flowNodeIds = new Set(
    flows.flatMap((flow) => [
      flow.process.id,
      ...flow.inputs.map((node) => node.id),
      ...flow.outputs.map((node) => node.id),
      ...flow.parents.map((node) => node.id),
    ]),
  );
  const technical = graph.nodes.filter((node) => !flowNodeIds.has(node.id));
  if (!flows.length)
    return (
      <div className={styles.executionEmpty}>
        <h4>{t("bknTrace.evidenceChain.noBusinessFlow")}</h4>
        <p>{t("bknTrace.evidenceChain.noBusinessFlowDescription")}</p>
        <TechnicalRecords nodes={graph.nodes} onSelect={onSelect} />
      </div>
    );
  return (
    <div className={styles.executionFlows}>
      <p className={styles.executionIntro}>{t("bknTrace.evidenceChain.executionIntro")}</p>
      {flows.map((flow) => {
        const accessibleTitle = flow.outputs.map((node) => node.label).join("、");
        const relatedClaims = relatedClaimsByProcess.get(flow.process.id) ?? [];
        const uniqueRelatedClaims = relatedClaims.filter(
          (claim, index, candidates) =>
            candidates.findIndex(
              (candidate) => candidate.label === claim.label && candidate.value === claim.value,
            ) === index,
        );
        const primaryClaims = uniqueRelatedClaims.filter((claim) => claim.role === "primary");
        const displayedClaims = primaryClaims.length ? primaryClaims : uniqueRelatedClaims;
        const focusedClaim =
          flow.process.id === preferredProcessId
            ? displayedClaims.find((claim) => claim.id === preferredClaimId)
            : undefined;
        const focusedClaims = focusedClaim ? [focusedClaim] : displayedClaims;
        const otherClaims = focusedClaim
          ? displayedClaims.filter((claim) => claim.id !== focusedClaim.id)
          : [];
        const focusedOutputs = focusedClaim
          ? flow.outputs.filter(
              (node) =>
                node.label === focusedClaim.label ||
                (node.value !== undefined &&
                  focusedClaim.value !== undefined &&
                  String(node.value) === String(focusedClaim.value)),
            )
          : [];
        const primaryLabels = new Set(primaryClaims.map((claim) => claim.label));
        const preferredOutputs = focusedOutputs.length
          ? focusedOutputs
          : primaryLabels.size
            ? flow.outputs.filter((node) => primaryLabels.has(node.label))
            : flow.outputs.slice(0, 3);
        const visibleOutputs = preferredOutputs.length
          ? preferredOutputs
          : flow.outputs.slice(0, 3);
        const visibleOutputIds = new Set(visibleOutputs.map((node) => node.id));
        const secondaryOutputs = flow.outputs.filter((node) => !visibleOutputIds.has(node.id));
        return (
          <details
            key={flow.process.id}
            role="region"
            aria-label={t("bknTrace.evidenceChain.businessFlowLabel", {
              title: flow.process.label || accessibleTitle,
            })}
            className={`${styles.businessFlow} ${selectedId === flow.process.id ? styles.selectedFlow : ""}`}
            open={expanded.has(flow.process.id)}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                onSelect(flow.process);
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(flow.process.id)) next.delete(flow.process.id);
                  else next.add(flow.process.id);
                  return next;
                });
              }}
            >
              <div>
                <small>{t("bknTrace.evidenceChain.businessTask")}</small>
                <h4>{flow.process.label || accessibleTitle}</h4>
              </div>
              <div className={styles.flowSummary}>
                <strong>
                  {focusedClaim?.label ??
                    (primaryClaims.length
                      ? primaryClaims.map((claim) => claim.label).join("；")
                      : t("bknTrace.evidenceChain.resultCount", { count: flow.outputs.length }))}
                </strong>
                <span>
                  {t("bknTrace.evidenceChain.flowSummary", {
                    inputs: flow.inputs.length,
                    outputs: flow.outputs.length,
                  })}
                </span>
              </div>
              <em>{t(`bknTrace.evidenceChain.status.${flow.process.status ?? "unknown"}`)}</em>
            </summary>
            {focusedClaim && secondaryOutputs.length > 0 && (
              <p className={styles.focusedFlowNotice}>
                {t("bknTrace.evidenceChain.focusedExecutionNotice", {
                  count: secondaryOutputs.length,
                })}
              </p>
            )}
            <div className={styles.flowBody}>
              <section className={styles.flowNode}>
                <small>{t("bknTrace.evidenceChain.businessInputs")}</small>
                <h5>{t("bknTrace.evidenceChain.conditionsUsed")}</h5>
                {flow.inputs.map((node) => (
                  <BusinessValue key={node.id} node={node} />
                ))}
              </section>
              <div className={styles.flowArrow}>
                <span>{t("bknTrace.evidenceChain.asInput")}</span>
                <b>→</b>
              </div>
              <button
                className={`${styles.flowNode} ${styles.flowProcess}`}
                onClick={() => onSelect(flow.process)}
              >
                <span className={styles.functionIcon}>ƒ</span>
                <small>{t("bknTrace.evidenceChain.businessProcessing")}</small>
                <h5>{flow.process.label}</h5>
                <em>{t(`bknTrace.evidenceChain.status.${flow.process.status ?? "unknown"}`)}</em>
              </button>
              <div className={styles.flowArrow}>
                <span>{t("bknTrace.evidenceChain.returnsResult")}</span>
                <b>→</b>
              </div>
              <section className={`${styles.flowNode} ${styles.flowOutput}`}>
                <small>{t("bknTrace.evidenceChain.businessResults")}</small>
                <h5>{t("bknTrace.evidenceChain.recordedResults")}</h5>
                {visibleOutputs.map((node) => (
                  <BusinessValue key={node.id} node={node} />
                ))}
                {secondaryOutputs.length > 0 && (
                  <details className={styles.secondaryOutputs}>
                    <summary>
                      {t("bknTrace.evidenceChain.otherReturnedFields", {
                        count: secondaryOutputs.length,
                      })}
                    </summary>
                    {secondaryOutputs.map((node) => (
                      <BusinessValue key={node.id} node={node} />
                    ))}
                  </details>
                )}
              </section>
            </div>
            {focusedClaims.length > 0 && (
              <nav
                className={styles.relatedClaims}
                aria-label={t("bknTrace.evidenceChain.relatedConclusions")}
              >
                {focusedClaims.map((claim) => (
                  <button type="button" key={claim.id} onClick={() => onClaim(claim.id)}>
                    {t("bknTrace.evidenceChain.viewRelatedClaim", { label: claim.label })}
                  </button>
                ))}
                {otherClaims.length > 0 && (
                  <details className={styles.relatedClaimDetails}>
                    <summary>
                      {t("bknTrace.evidenceChain.otherRelatedConclusions", {
                        count: otherClaims.length,
                      })}
                    </summary>
                    <div>
                      {otherClaims.map((claim) => (
                        <button type="button" key={claim.id} onClick={() => onClaim(claim.id)}>
                          {t("bknTrace.evidenceChain.viewRelatedClaim", { label: claim.label })}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </nav>
            )}
            {flow.parents.length > 0 && (
              <details className={styles.orchestrators}>
                <summary>
                  {t("bknTrace.evidenceChain.orchestrators", { count: flow.parents.length })}
                </summary>
                <div>
                  {flow.parents.map((parent) => (
                    <button key={parent.id} onClick={() => onSelect(parent)}>
                      <span>{parent.label}</span>
                      <small>
                        {t(`bknTrace.evidenceChain.status.${parent.status ?? "unknown"}`)}
                      </small>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </details>
        );
      })}
      <TechnicalRecords nodes={technical} onSelect={onSelect} />
    </div>
  );
}

function TechnicalRecords({
  nodes,
  onSelect,
}: {
  nodes: ChainNode[];
  onSelect: (node: ChainNode) => void;
}) {
  const { t } = useTranslation();
  if (!nodes.length) return null;
  return (
    <details className={styles.technicalRecords}>
      <summary>{t("bknTrace.evidenceChain.technicalRecords", { count: nodes.length })}</summary>
      <p>{t("bknTrace.evidenceChain.technicalRecordsDescription")}</p>
      <div>
        {nodes.map((node) => (
          <button key={node.id} onClick={() => onSelect(node)}>
            <span>{node.label}</span>
            <small>{t(`bknTrace.evidenceChain.status.${node.status ?? "unknown"}`)}</small>
          </button>
        ))}
      </div>
    </details>
  );
}

function RecordedEvidencePath({ claim, graph }: { claim: ChainClaim; graph: ChainGraph }) {
  const { t } = useTranslation();
  const path = upstream(graph, claim.nodeIds);
  const inputs = path.nodes.filter((node) => node.role === "input" || node.role === "context");
  const processes = path.nodes.filter(
    (node) =>
      node.role === "process" ||
      (!node.role && ["relation", "query", "function", "calculation"].includes(node.kind)),
  );
  if (!processes.length) return null;
  return (
    <div className={styles.derivationPath}>
      <section>
        <small>{t("bknTrace.evidenceChain.objectAndConditions")}</small>
        <h5>{claim.objectLabel ?? t("bknTrace.evidenceChain.recordedObject")}</h5>
        {inputs.map((node) => (
          <BusinessValue key={node.id} node={node} />
        ))}
      </section>
      <b>→</b>
      <section className={styles.derivationProcess}>
        <small>{t("bknTrace.evidenceChain.businessProcessing")}</small>
        {processes.map((node) => (
          <BusinessValue key={node.id} node={node} />
        ))}
      </section>
      <b>→</b>
      <section className={styles.derivationResult}>
        <small>{t("bknTrace.evidenceChain.derivation.recordedResult")}</small>
        <h5>{claim.label}</h5>
        <strong>{claim.value}</strong>
      </section>
      <b>→</b>
      <section className={styles.derivationConclusion}>
        <small>
          {t(
            claim.role === "scope"
              ? "bknTrace.evidenceChain.adoptedScope"
              : "bknTrace.evidenceChain.adoptedConclusion",
          )}
        </small>
        <h5>{claim.label}</h5>
        <strong>{claim.value}</strong>
      </section>
    </div>
  );
}

function EvidencePaths({
  claims,
  selectedId,
  graph,
  allGraph,
  metadata,
  setMetadata,
  onNode,
  onEdge,
}: {
  claims: ChainClaim[];
  selectedId?: string;
  graph: ChainGraph;
  allGraph: ChainGraph;
  metadata: boolean;
  setMetadata: (value: boolean) => void;
  onNode: (node: ChainNode) => void;
  onEdge: (edge: ChainEdge) => void;
}) {
  const { t } = useTranslation();
  const selectedClaim = claims.find((claim) => claim.id === selectedId) ?? claims[0];
  const [allFactsOpen, setAllFactsOpen] = useState(false);
  if (!selectedClaim) return null;
  const derivation = selectedClaim.derivation;
  const recorded = derivation ? null : (
    <RecordedEvidencePath claim={selectedClaim} graph={allGraph} />
  );
  return (
    <div className={styles.evidencePaths}>
      <p className={styles.executionIntro}>{t("bknTrace.evidenceChain.evidenceIntro")}</p>
      <details
        role="region"
        aria-label={t("bknTrace.evidenceChain.claimPath", { label: selectedClaim.label })}
        className={styles.evidenceClaim}
        open={Boolean(derivation)}
      >
        <summary>
          <div>
            <small>
              {t(
                selectedClaim.role === "scope"
                  ? "bknTrace.evidenceChain.answerScope"
                  : "bknTrace.evidenceChain.answerConclusion",
              )}
            </small>
            <h4>{selectedClaim.label}</h4>
            <span>{selectedClaim.objectLabel}</span>
          </div>
          <strong>{selectedClaim.value}</strong>
          <ClaimStates claim={selectedClaim} />
        </summary>
        <div className={styles.derivationBody}>
          {derivation ? (
            <>
              <div className={styles.derivationPath}>
                <section>
                  <small>{t("bknTrace.evidenceChain.objectAndConditions")}</small>
                  <h5>{selectedClaim.objectLabel ?? t("bknTrace.evidenceChain.recordedObject")}</h5>
                  {derivation.inputs.map((item) => (
                    <BusinessValue
                      key={`${item.label}:${item.value}`}
                      node={{ id: item.label, label: item.label, value: item.value, kind: "field" }}
                    />
                  ))}
                </section>
                <b>→</b>
                <section className={styles.derivationProcess}>
                  <small>{t("bknTrace.evidenceChain.businessProcessing")}</small>
                  <h5>
                    {derivation.processName || t("bknTrace.evidenceChain.recordedProcessing")}
                  </h5>
                </section>
                <b>→</b>
                <section className={styles.derivationResult}>
                  <small>
                    {t(
                      `bknTrace.evidenceChain.derivation.${derivation.method === "sum" ? "independentVerification" : derivation.method === "distinct_count" ? "returnedComponents" : "recordedResult"}`,
                    )}
                  </small>
                  <h5>
                    {derivation.formula || `${selectedClaim.label} = ${selectedClaim.value ?? ""}`}
                  </h5>
                </section>
                <b>→</b>
                <section className={styles.derivationConclusion}>
                  <small>
                    {t(
                      selectedClaim.role === "scope"
                        ? "bknTrace.evidenceChain.adoptedScope"
                        : "bknTrace.evidenceChain.adoptedConclusion",
                    )}
                  </small>
                  <h5>{selectedClaim.label}</h5>
                  <strong>{selectedClaim.value}</strong>
                </section>
              </div>
              {derivation.components.length ? (
                <details className={styles.componentDetails}>
                  <summary>
                    {t("bknTrace.evidenceChain.viewComponents", {
                      count: derivation.components.length,
                    })}
                  </summary>
                  <div>
                    {derivation.components.map((item, index) => (
                      <div key={`${item.label}:${item.value}:${index}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              {derivation.boundary && (
                <p className={styles.evidenceBoundary}>
                  <strong>{t("bknTrace.evidenceChain.evidenceBoundary")}</strong>
                  {derivation.boundary}
                </p>
              )}
            </>
          ) : (
            <>
              {recorded}
              <p className={styles.evidenceBoundary}>
                <strong>{t("bknTrace.evidenceChain.evidenceBoundary")}</strong>
                {selectedClaim.detail ??
                  t(`bknTrace.evidenceChain.explain.${selectedClaim.status}`)}
              </p>
            </>
          )}
        </div>
      </details>
      <section className={styles.focusedEvidence}>
        <header>
          <div>
            <small>{t("bknTrace.evidenceChain.claimEvidence")}</small>
            <h4>{selectedClaim.label}</h4>
          </div>
        </header>
        <div className={styles.toolbar}>
          <span>{t("bknTrace.evidenceChain.interactHint")}</span>
          <label>
            <input
              type="checkbox"
              checked={metadata}
              onChange={(event) => setMetadata(event.target.checked)}
            />
            {t("bknTrace.evidenceChain.metadata")}
          </label>
        </div>
        <Graph
          graph={graph}
          title={t("bknTrace.evidenceChain.evidenceGraph")}
          mode="evidence"
          selectedId={undefined}
          onSelect={onNode}
          onEdge={onEdge}
        />
      </section>
      <section className={styles.rawEvidence}>
        <button
          type="button"
          className={styles.rawEvidenceToggle}
          aria-expanded={allFactsOpen}
          onClick={() => setAllFactsOpen((open) => !open)}
        >
          {t("bknTrace.evidenceChain.otherEvidence")}
        </button>
        {allFactsOpen && (
          <>
            <p className={styles.rawEvidenceScope}>
              {t("bknTrace.evidenceChain.rawEvidenceAllScope")}
            </p>
            <div className={styles.toolbar}>
              <span>{t("bknTrace.evidenceChain.interactHint")}</span>
              <label>
                <input
                  type="checkbox"
                  checked={metadata}
                  onChange={(event) => setMetadata(event.target.checked)}
                />
                {t("bknTrace.evidenceChain.metadata")}
              </label>
            </div>
            <Graph
              graph={allGraph}
              title={t("bknTrace.evidenceChain.allFactsGraph")}
              mode="evidence"
              selectedId={undefined}
              onSelect={onNode}
              onEdge={onEdge}
            />
          </>
        )}
      </section>
    </div>
  );
}

function answerSupportStatus(
  view: EvidenceChainView,
): "supported" | "partial" | "unsupported" | "contradicted" {
  if (view.requirements?.length) {
    const requirementStates = view.requirements.map((requirement) => requirement.status);
    if (requirementStates.includes("contradicted")) return "contradicted";
    if (requirementStates.every((state) => state === "supported"))
      return view.evidenceStatus && view.evidenceStatus !== "complete" ? "partial" : "supported";
    if (requirementStates.some((state) => state === "supported" || state === "partial"))
      return "partial";
    return "unsupported";
  }
  if (!view.claims.length) return "unsupported";
  // Older projections only recorded the verified calculation state. Preserve
  // that meaning without treating merely located values as semantic support.
  const states = view.claims.map(
    (claim) => claim.supportStatus ?? (claim.status === "checked" ? "supported" : "unsupported"),
  );
  if (states.includes("contradicted")) return "contradicted";
  if (states.every((state) => state === "supported"))
    return view.evidenceStatus && view.evidenceStatus !== "complete" ? "partial" : "supported";
  if (states.some((state) => state === "supported" || state === "partial")) return "partial";
  return "unsupported";
}

function Panels({
  view,
  initialPanel = "evidence",
  panel: controlledPanel,
  onPanelChange,
}: {
  view: EvidenceChainView;
  initialPanel?: "evidence" | "execution";
  panel?: "evidence" | "execution";
  onPanelChange?: (panel: "evidence" | "execution") => void;
}) {
  const { t } = useTranslation();
  const [localPanel, setLocalPanel] = useState<"evidence" | "execution">(initialPanel);
  const panel = controlledPanel ?? localPanel;
  const setPanel = (next: "evidence" | "execution") => {
    setLocalPanel(next);
    onPanelChange?.(next);
  };
  const [claimId, setClaimId] = useState<string | undefined>(() => view.claims[0]?.id);
  const [node, setNode] = useState<ChainNode>();
  const [edge, setEdge] = useState<ChainEdge>();
  const [metadata, setMetadata] = useState(false);
  const [executionId, setExecutionId] = useState<string>();
  const [fullScreen, setFullScreen] = useState(false);
  const [answerExpanded, setAnswerExpanded] = useState(false);
  const factMode = view.claims.length === 0;
  const supportStatus = answerSupportStatus(view);
  const claim = view.claims.find((c) => c.id === claimId);
  const answerIsLong = Array.from(view.answer ?? "").length > 240;
  const collapseAnswer = answerIsLong && !answerExpanded;
  const selectedAnswerExact = claim?.answerRange?.exact;
  const selectClaim = (id: string) => {
    setClaimId(id);
    setPanel("evidence");
    setNode(undefined);
    setEdge(undefined);
  };
  const recordedClaimGraph = claim
    ? upstream(view.evidence, claim.nodeIds)
    : factMode
      ? { nodes: [], edges: [] }
      : view.evidence;
  const fullGraph = claim
    ? {
        nodes: [
          {
            id: `claim:${claim.id}`,
            label: claim.label,
            value: claim.value,
            kind: "conclusion" as const,
            role: "conclusion" as const,
            status: claim.supportStatus ?? claim.status,
            detail: claim.detail,
          },
          ...recordedClaimGraph.nodes,
        ],
        edges: [
          ...claim.nodeIds
            .filter((id) => recordedClaimGraph.nodes.some((node) => node.id === id))
            .map((id) => ({
              id: `claim:${claim.id}:${id}`,
              source: `claim:${claim.id}`,
              target: id,
              label: t("bknTrace.evidenceChain.claimBinding"),
              kind: "binding" as const,
            })),
          ...recordedClaimGraph.edges,
        ],
      }
    : recordedClaimGraph;
  const visibleGraph = (candidate: ChainGraph): ChainGraph =>
    metadata
      ? candidate
      : {
          nodes: candidate.nodes.filter((n) => n.role !== "context" || n.kind === "object"),
          edges: candidate.edges.filter(
            (e) =>
              e.kind !== "key" &&
              e.kind !== "context" &&
              candidate.nodes.some(
                (n) => n.id === e.source && (n.role !== "context" || n.kind === "object"),
              ) &&
              candidate.nodes.some(
                (n) => n.id === e.target && (n.role !== "context" || n.kind === "object"),
              ),
          ),
        };
  const graph = visibleGraph(fullGraph);
  const allGraph = visibleGraph(view.evidence);
  const objectLabels = [
    ...new Set(
      view.claims.map((c) => c.objectLabel ?? t("bknTrace.evidenceChain.otherConclusions")),
    ),
  ];
  const primaryClaims = view.claims.filter((c) => c.role === "primary");
  const supportingClaims = view.claims.filter((c) => c.role === "supporting");
  const otherClaims = view.claims.filter((c) => c.role !== "primary" && c.role !== "supporting");
  const primaryRequirementOwner = new Map<string, string>();
  for (const requirement of view.requirements ?? []) {
    for (const id of requirement.claimIds)
      if (!primaryRequirementOwner.has(id)) primaryRequirementOwner.set(id, requirement.id);
  }
  const propositionMode = (view.requirements?.length ?? 0) > 0 || primaryClaims.length > 0;
  const selectedExecution = node?.executionNodeId
    ? view.execution.nodes.find((n) => n.id === node.executionNodeId)
    : undefined;
  const relatedClaims =
    panel === "execution" && node
      ? view.claims.filter((c) =>
          upstream(view.evidence, c.nodeIds).nodes.some((n) => n.executionNodeId === node.id),
        )
      : [];
  const evidenceNode = (id: string) =>
    fullGraph.nodes.find((node) => node.id === id) ??
    view.evidence.nodes.find((node) => node.id === id);
  const preferredClaim =
    claim ?? view.claims.find((candidate) => candidate.role !== "scope") ?? view.claims[0];
  const preferredProcessId = preferredExecutionProcess(
    view.evidence,
    view.execution,
    preferredClaim,
  );
  const relatedClaimsByProcess = new Map<string, ChainClaim[]>();
  for (const candidate of view.claims) {
    const processIds = new Set(
      upstream(view.evidence, candidate.nodeIds)
        .nodes.map((candidateNode) => candidateNode.executionNodeId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const processId of processIds)
      relatedClaimsByProcess.set(processId, [
        ...(relatedClaimsByProcess.get(processId) ?? []),
        candidate,
      ]);
  }
  const fullScreenLabel = t("bknTrace.evidenceChain.fullscreenLabel", {
    panel: t(
      panel === "evidence" ? "bknTrace.evidenceChain.evidence" : "bknTrace.evidenceChain.execution",
    ),
  });
  return (
    <ViewportPortal active={fullScreen}>
      <div
        className={`${styles.root} ${fullScreen ? styles.fullScreen : ""}`}
        role={fullScreen ? "dialog" : undefined}
        aria-modal={fullScreen || undefined}
        aria-label={fullScreen ? fullScreenLabel : undefined}
      >
        <header className={styles.heading}>
          <div>
            <small>{t("bknTrace.evidenceChain.title")}</small>
            <h2>{t("bknTrace.evidenceChain.question")}</h2>
          </div>
          <div className={styles.headerActions}>
            <span>
              {view.revisionLabel} · {t(`bknTrace.evidenceChain.status.${view.status}`)}
            </span>
            <button
              className={styles.fullScreenButton}
              onClick={() => setFullScreen((value) => !value)}
            >
              {t(
                fullScreen
                  ? "bknTrace.evidenceChain.exitFullscreen"
                  : "bknTrace.evidenceChain.fullscreen",
              )}
            </button>
          </div>
        </header>
        <section className={styles.summary}>
          <h3>{view.question || t("bknTrace.evidenceChain.noQuestion")}</h3>
          {factMode && (
            <section
              className={styles.trustWarning}
              role="status"
              aria-label={t("bknTrace.evidenceChain.unverifiedAnswerTitle")}
            >
              <strong>{t("bknTrace.evidenceChain.unverifiedAnswerTitle")}</strong>
              <span>{t("bknTrace.evidenceChain.unverifiedAnswerDescription")}</span>
            </section>
          )}
          <div className={styles.trustSummary}>
            <div>
              <span>{t("bknTrace.evidenceChain.answerSupport")}</span>
              <strong data-state={supportStatus}>
                {t(`bknTrace.evidenceChain.answerSupportStatus.${supportStatus}`)}
              </strong>
            </div>
            <div>
              <span>{t("bknTrace.evidenceChain.evidenceRecord")}</span>
              <strong>
                {t(
                  `bknTrace.evidenceChain.evidenceRecordStatus.${view.evidenceStatus ?? "unknown"}`,
                )}
              </strong>
            </div>
            <div>
              <span>{t("bknTrace.evidenceChain.interactionExecution")}</span>
              <strong>{t(`bknTrace.evidenceChain.status.${view.status}`)}</strong>
            </div>
          </div>
          <h4>{t("bknTrace.evidenceChain.answer")}</h4>
          {view.answer?.trim() ? (
            collapseAnswer ? (
              <div className={styles.answerPreview}>
                {selectedAnswerExact && (
                  <>
                    <small>{t("bknTrace.evidenceChain.selectedAnswerAnchor")}</small>
                    <button
                      type="button"
                      className={styles.anchor}
                      aria-pressed="true"
                      onClick={() => claimId && selectClaim(claimId)}
                    >
                      {selectedAnswerExact}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={styles.answerToggle}
                  aria-expanded="false"
                  onClick={() => setAnswerExpanded(true)}
                >
                  {t("bknTrace.evidenceChain.viewOriginalAnswer")}
                </button>
              </div>
            ) : (
              <>
                <Answer
                  text={view.answer}
                  claims={view.claims}
                  select={selectClaim}
                  selectedId={claimId}
                />
                {answerIsLong && (
                  <button
                    type="button"
                    className={styles.answerToggle}
                    aria-expanded="true"
                    onClick={() => setAnswerExpanded(false)}
                  >
                    {t("bknTrace.evidenceChain.collapseOriginalAnswer")}
                  </button>
                )}
              </>
            )
          ) : (
            <p>{t("bknTrace.evidenceChain.noAnswer")}</p>
          )}
          {!factMode && <p className={styles.muted}>{t("bknTrace.evidenceChain.bindingNotice")}</p>}
        </section>
        {view.notices?.[0] && <p className={styles.notice}>{view.notices[0]}</p>}
        {(view.notices?.length ?? 0) > 1 && (
          <details className={styles.scopeDetails}>
            <summary>{t("bknTrace.evidenceChain.scopeDetails")}</summary>
            {view.notices?.slice(1).map((notice, i) => (
              <p className={styles.notice} key={i}>
                {notice}
              </p>
            ))}
          </details>
        )}
        {!controlledPanel && (
          <nav className={styles.tabs} aria-label={t("bknTrace.evidenceChain.views")}>
            <button
              aria-pressed={panel === "evidence"}
              onClick={() => {
                setPanel("evidence");
                setNode(undefined);
                setEdge(undefined);
              }}
            >
              {t("bknTrace.evidenceChain.evidence")}
            </button>
            <button
              aria-pressed={panel === "execution"}
              onClick={() => {
                setPanel("execution");
                setNode(undefined);
                setEdge(undefined);
              }}
            >
              {t("bknTrace.evidenceChain.execution")}
            </button>
          </nav>
        )}
        <div className={styles.workspace}>
          {panel === "evidence" && !factMode && (
            <aside className={styles.catalog}>
              <h3>
                {t(
                  propositionMode
                    ? "bknTrace.evidenceChain.questionRequirements"
                    : "bknTrace.evidenceChain.conclusions",
                )}
              </h3>
              {propositionMode ? (
                <>
                  {view.requirements?.map((requirement) => {
                    const matchingClaims = primaryClaims.filter((claim) =>
                      requirement.claimIds.includes(claim.id),
                    );
                    const displayedClaims = matchingClaims.filter(
                      (claim) => primaryRequirementOwner.get(claim.id) === requirement.id,
                    );
                    return (
                      <section className={styles.objectGroup} key={requirement.id}>
                        <h4>{requirement.label}</h4>
                        <small>
                          {t(`bknTrace.evidenceChain.requirementStatus.${requirement.status}`)}
                        </small>
                        <div className={styles.claims}>
                          {displayedClaims.map((claim) => (
                            <button
                              key={claim.id}
                              aria-pressed={claimId === claim.id}
                              onClick={() => selectClaim(claim.id)}
                            >
                              <span>{claim.label}</span>
                              <ClaimStates claim={claim} />
                            </button>
                          ))}
                        </div>
                        {matchingClaims.length > displayedClaims.length && (
                          <p className={styles.sharedCoverage}>
                            {t("bknTrace.evidenceChain.sharedRequirementCoverage")}
                          </p>
                        )}
                      </section>
                    );
                  })}
                  {primaryClaims
                    .filter(
                      (claim) =>
                        !view.requirements?.some((requirement) =>
                          requirement.claimIds.includes(claim.id),
                        ),
                    )
                    .map((claim) => (
                      <div className={styles.claims} key={claim.id}>
                        <button
                          aria-pressed={claimId === claim.id}
                          onClick={() => selectClaim(claim.id)}
                        >
                          <span>{claim.label}</span>
                          <ClaimStates claim={claim} />
                        </button>
                      </div>
                    ))}
                  {supportingClaims.length > 0 && (
                    <details className={styles.objectGroup}>
                      <summary>
                        {t("bknTrace.evidenceChain.supportingConclusions", {
                          count: supportingClaims.length,
                        })}
                      </summary>
                      <div className={styles.claims}>
                        {supportingClaims.map((claim) => (
                          <button
                            key={claim.id}
                            aria-pressed={claimId === claim.id}
                            onClick={() => selectClaim(claim.id)}
                          >
                            <span>{claim.label}</span>
                            <ClaimStates claim={claim} />
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  {otherClaims.length > 0 && (
                    <section className={styles.objectGroup}>
                      <h4>{t("bknTrace.evidenceChain.otherConclusions")}</h4>
                      <div className={styles.claims}>
                        {otherClaims.map((claim) => (
                          <button
                            key={claim.id}
                            aria-pressed={claimId === claim.id}
                            onClick={() => selectClaim(claim.id)}
                          >
                            <span>{claim.label}</span>
                            <ClaimStates claim={claim} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                objectLabels.map((label) => (
                  <section className={styles.objectGroup} key={label}>
                    <h4>{label}</h4>
                    <div className={styles.claims}>
                      {view.claims
                        .filter(
                          (c) =>
                            (c.objectLabel ?? t("bknTrace.evidenceChain.otherConclusions")) ===
                            label,
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            aria-pressed={claimId === c.id}
                            onClick={() => selectClaim(c.id)}
                          >
                            <span>{c.label}</span>
                            <strong>{c.value}</strong>
                            <ClaimStates claim={c} />
                          </button>
                        ))}
                    </div>
                  </section>
                ))
              )}
            </aside>
          )}
          <div className={styles.graphColumn}>
            {panel === "evidence" && factMode ? (
              <section className={styles.unbound}>
                <h3>{t("bknTrace.evidenceChain.unboundTitle")}</h3>
                <p>{t("bknTrace.evidenceChain.unboundDescription")}</p>
                <button className={styles.sourceLink} onClick={() => setPanel("execution")}>
                  {t("bknTrace.evidenceChain.viewRecordedExecution")}
                </button>
              </section>
            ) : (
              <section className={styles.graphCard}>
                <header className={styles.graphHeading}>
                  <div>
                    <small>{t("bknTrace.evidenceChain.path")}</small>
                    <h3>
                      {claim && panel === "evidence"
                        ? claim.label
                        : t(
                            panel === "execution"
                              ? "bknTrace.evidenceChain.execution"
                              : "bknTrace.evidenceChain.recordedFacts",
                          )}
                    </h3>
                  </div>
                  {claim && panel === "evidence" && (
                    <span className={styles.badge}>
                      <ClaimStates claim={claim} />
                    </span>
                  )}
                </header>
                {claim && panel === "evidence" && (
                  <div className={styles.scope}>
                    <p>{claim.detail ?? t(`bknTrace.evidenceChain.explain.${claim.status}`)}</p>
                  </div>
                )}
                {panel === "execution" ? (
                  <ExecutionFlows
                    graph={view.execution}
                    preferredProcessId={preferredProcessId}
                    preferredClaimId={preferredClaim?.id}
                    selectedId={executionId}
                    relatedClaimsByProcess={relatedClaimsByProcess}
                    onSelect={(n) => {
                      setExecutionId(n.id);
                      setNode(n);
                      setEdge(undefined);
                    }}
                    onClaim={selectClaim}
                  />
                ) : view.claims.length ? (
                  <EvidencePaths
                    claims={view.claims}
                    selectedId={claimId}
                    graph={graph}
                    allGraph={allGraph}
                    metadata={metadata}
                    setMetadata={setMetadata}
                    onNode={(n) => {
                      setNode(n);
                      setEdge(undefined);
                    }}
                    onEdge={(e) => {
                      setEdge(e);
                      setNode(undefined);
                    }}
                  />
                ) : (
                  <>
                    <div className={styles.toolbar}>
                      <span>{t("bknTrace.evidenceChain.interactHint")}</span>
                      <label>
                        <input
                          type="checkbox"
                          checked={metadata}
                          onChange={(event) => setMetadata(event.target.checked)}
                        />
                        {t("bknTrace.evidenceChain.metadata")}
                      </label>
                    </div>
                    <Graph
                      graph={graph}
                      title={t("bknTrace.evidenceChain.evidenceGraph")}
                      mode="evidence"
                      selectedId={node?.id}
                      onSelect={(n) => {
                        setNode(n);
                        setEdge(undefined);
                      }}
                      onEdge={(e) => {
                        setEdge(e);
                        setNode(undefined);
                      }}
                    />
                    <p className={styles.scope}>{t("bknTrace.evidenceChain.graphNotice")}</p>
                  </>
                )}
              </section>
            )}
            {node && (
              <InspectorDialog
                label={t("bknTrace.evidenceChain.detail")}
                onClose={() => setNode(undefined)}
              >
                <button onClick={() => setNode(undefined)}>
                  {t("bknTrace.evidenceChain.close")}
                </button>
                <small>{t(`bknTrace.evidenceChain.kind.${node.kind}`)}</small>
                <h3>{node.label}</h3>
                <p className={styles.detailValue}>{node.value}</p>
                <p>{node.detail ?? t("bknTrace.evidenceChain.noDetail")}</p>
                {selectedExecution && (
                  <button
                    className={styles.sourceLink}
                    onClick={() => {
                      setExecutionId(selectedExecution.id);
                      setPanel("execution");
                      setNode(selectedExecution);
                      setEdge(undefined);
                    }}
                  >
                    {t("bknTrace.evidenceChain.viewExecution")}
                  </button>
                )}
                {relatedClaims.map((c) => (
                  <button
                    key={c.id}
                    className={styles.sourceLink}
                    onClick={() => selectClaim(c.id)}
                  >
                    {t("bknTrace.evidenceChain.returnClaim", { label: c.label })}
                  </button>
                ))}
                {node.technical && (
                  <details>
                    <summary>{t("bknTrace.evidenceChain.technical")}</summary>
                    <pre>{node.technical}</pre>
                  </details>
                )}
              </InspectorDialog>
            )}
            {edge && (
              <InspectorDialog
                label={t("bknTrace.evidenceChain.edgeDetail")}
                onClose={() => setEdge(undefined)}
              >
                <button onClick={() => setEdge(undefined)}>
                  {t("bknTrace.evidenceChain.close")}
                </button>
                <small>{t("bknTrace.evidenceChain.edgeDetail")}</small>
                <h3>{edge.label}</h3>
                <p>
                  {evidenceNode(edge.source)?.label} → {evidenceNode(edge.target)?.label}
                </p>
                {edge.role && <p>{edge.role}</p>}
                <p>
                  {edge.detail ??
                    t(
                      edge.kind === "key" || edge.kind === "context" || edge.kind === "object"
                        ? "bknTrace.evidenceChain.metadataBoundary"
                        : "bknTrace.evidenceChain.edgeBoundary",
                    )}
                </p>
                {edge.technical && (
                  <details>
                    <summary>{t("bknTrace.evidenceChain.technical")}</summary>
                    <pre>{edge.technical}</pre>
                  </details>
                )}
              </InspectorDialog>
            )}
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
}

export function EvidenceChainPanels({
  view,
  initialPanel,
  panel,
  onPanelChange,
}: {
  view: EvidenceChainView;
  initialPanel?: "evidence" | "execution";
  panel?: "evidence" | "execution";
  onPanelChange?: (panel: "evidence" | "execution") => void;
}) {
  return (
    <Panels
      key={`${view.interactionId}:${view.revisionLabel ?? ""}`}
      view={view}
      initialPanel={initialPanel}
      panel={panel}
      onPanelChange={onPanelChange}
    />
  );
}
