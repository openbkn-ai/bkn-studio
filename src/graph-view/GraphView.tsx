/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_APP_BASENAME } from "@/app/router/app-basename";
import { getStoredAccessToken } from "@/framework/auth/token-store";
import { GraphCanvas, type GraphCanvasHandle } from "@/modules/knowledge-network/scenes/graph-explorer/GraphCanvas";
import { OBJECT_TYPE_PALETTE, type MenuAction } from "@/modules/knowledge-network/scenes/graph-explorer/constants";
import { buildShareUrl } from "@/modules/knowledge-network/scenes/graph-explorer/deep-link";
import { createBknLifecycle, lifecycleEnv, memoryConversationStore, withManagedTurn, type BknTurn } from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { fetchKnDetail, type KnDetail } from "@/modules/knowledge-network/services/context-loader.service";
import {
  NODE_LIMIT,
  capIncomingNodes,
  collectSubgraphByIds,
  createGraphExplorerClient,
  expandSeeds,
  friendlyError,
  mergeGraph,
  orientEdges,
  parseIdList,
  stringifyValue,
  type ExpandDirection,
  type GEdge,
  type GNode,
  type ObjectTypeMeta,
} from "@/modules/knowledge-network/services/graph-explorer.service";
import { LAYOUTS, type ExplorerLayout } from "@/modules/knowledge-network/utils/graph-explorer-cache";

import styles from "./GraphView.module.css";
import { parseViewParams, type ViewParams } from "./params";

const UNKNOWN_COLOR = "#94a3b8";
const EXPAND_SEED_LIMIT = 50;
const VIEW_MENU: MenuAction[] = ["expandOut", "expandIn", "expandBoth", "remove"];
const DIRECTION_OF: Partial<Record<MenuAction, ExpandDirection>> = { expandOut: "forward", expandIn: "backward", expandBoth: "bidirectional" };
const MENU_ACTIONS: MenuAction[] = ["expandOut", "expandIn", "expandBoth", "setPathStart", "clearPathStart", "setPathEnd", "clearPathEnd", "pin", "unpin", "remove"];
const NO_LABELS: Record<string, string> = {};

type Status = { kind: "loading" | "ready" | "error"; text: string };

/**
 * A page that only shows a graph: the instances named in the URL, the relations among them,
 * optionally their neighbours. It lives outside the Studio shell and its login gate, and talks
 * to Context Loader with a fixed token, so an agent client can hand a user a link to a subgraph.
 */
export function GraphView() {
  const { t } = useTranslation();
  const [params] = useState<ViewParams>(() => parseViewParams(window.location.search, window.__BKN_GRAPH_VIEW__?.token, getStoredAccessToken() ?? ""));
  const [status, setStatus] = useState<Status>({ kind: "loading", text: "" });
  const [detail, setDetail] = useState<KnDetail | null>(null);
  const [layout, setLayout] = useState<ExplorerLayout>(params.layout);
  const [counts, setCounts] = useState({ nodes: 0, edges: 0 });
  const [selected, setSelected] = useState<GNode | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const nodesRef = useRef(new Map<string, GNode>());
  const edgesRef = useRef(new Map<string, GEdge>());
  const metaRef = useRef<Record<string, ObjectTypeMeta>>({});
  const detailRef = useRef<KnDetail | null>(null);
  const colorIndexRef = useRef(new Map<string, number>());
  const startedRef = useRef(false);

  const base = window.location.origin;
  const lifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(base, params.kn), { getToken: () => params.token }, {
        agentName: "bkn-agent-graph-view",
        conversationStore: memoryConversationStore(),
      }),
    [base, params.kn, params.token],
  );
  const client = useMemo(() => createGraphExplorerClient(lifecycle.session, params.kn), [lifecycle, params.kn]);

  const colorOf = useCallback((otId: string) => {
    const index = colorIndexRef.current.get(otId);
    return index === undefined ? UNKNOWN_COLOR : OBJECT_TYPE_PALETTE[index % OBJECT_TYPE_PALETTE.length];
  }, []);

  const loadMetas = useCallback(
    async (otIds: string[], turn: BknTurn | null) => {
      const missing = otIds.filter((id) => !metaRef.current[id]);
      if (missing.length > 0) {
        for (const meta of await client.loadObjectTypes(missing, turn)) metaRef.current[meta.id] = meta;
      }
      return metaRef.current;
    },
    [client],
  );

  const addToCanvas = useCallback(async (incomingNodes: GNode[], incomingEdges: GEdge[], anchorId?: string) => {
    const capped = capIncomingNodes(incomingNodes, new Set(nodesRef.current.keys()), NODE_LIMIT);
    const relations = new Map((detailRef.current?.relation_types ?? []).map((item) => [item.id, { id: item.id, sourceOtId: item.sourceId, targetOtId: item.targetId }]));
    const incoming = new Map(capped.nodes.map((node) => [node.id, node.otId]));
    const oriented = orientEdges(incomingEdges, relations, (id) => incoming.get(id) ?? nodesRef.current.get(id)?.otId);
    const { addedNodes, addedEdges } = mergeGraph(nodesRef.current, edgesRef.current, { nodes: capped.nodes, edges: oriented });
    for (const node of addedNodes) {
      if (!colorIndexRef.current.has(node.otId)) colorIndexRef.current.set(node.otId, colorIndexRef.current.size);
    }
    await canvasRef.current?.addElements(addedNodes, addedEdges, anchorId);
    setCounts({ nodes: nodesRef.current.size, edges: edgesRef.current.size });
    return { nodes: addedNodes.length, edges: addedEdges.length, dropped: capped.dropped };
  }, []);

  const expand = useCallback(
    async (ids: string[], direction: ExpandDirection) => {
      const seeds = ids.map((id) => nodesRef.current.get(id)).filter((node): node is GNode => Boolean(node)).slice(0, EXPAND_SEED_LIMIT);
      if (seeds.length === 0) return;
      const result = await withManagedTurn(lifecycle, t("knowledgeNetwork.graphExplorer.turn.expandMany", { count: seeds.length }), async (turn) => {
        const metas = await loadMetas([...new Set(seeds.map((node) => node.otId))], turn);
        return expandSeeds(client, seeds, metas, direction, NO_LABELS, turn);
      });
      await addToCanvas(result.nodes, result.edges, seeds.length === 1 ? seeds[0].id : undefined);
    },
    [addToCanvas, client, lifecycle, loadMetas, t],
  );

  const removeNode = useCallback(async (id: string) => {
    if (!nodesRef.current.delete(id)) return;
    for (const [edgeId, edge] of edgesRef.current) {
      if (edge.source === id || edge.target === id) edgesRef.current.delete(edgeId);
    }
    await canvasRef.current?.removeNode(id);
    setSelected((current) => (current?.id === id ? null : current));
    setCounts({ nodes: nodesRef.current.size, edges: edgesRef.current.size });
  }, []);

  // Everything happens once, in order: definition, the named instances, their edges, the
  // optional expansion, then a layout that fits.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!params.kn || params.ids.length === 0) {
      setStatus({ kind: "error", text: t("knowledgeNetwork.graphExplorer.view.missingParams") });
      return;
    }
    if (!params.token) {
      setStatus({ kind: "error", text: t("knowledgeNetwork.graphExplorer.view.missingToken") });
      return;
    }
    const run = async () => {
      setStatus({ kind: "loading", text: t("knowledgeNetwork.graphExplorer.view.status.loading") });
      const data = await withManagedTurn(lifecycle, t("knowledgeNetwork.graphExplorer.turn.schema"), (turn) =>
        fetchKnDetail({ base, token: "", knId: params.kn }, { getToken: () => params.token }, undefined, turn ?? undefined),
      );
      detailRef.current = data;
      setDetail(data);
      const parsed = parseIdList(params.ids.join("\n"), data.object_types.map((item) => item.id));
      const messages: string[] = [];
      if (parsed.unknown.length > 0) messages.push(t("knowledgeNetwork.graphExplorer.view.unknownIds", { list: parsed.unknown.slice(0, 5).join(", ") }));
      if (parsed.items.length === 0) {
        setStatus({ kind: "error", text: messages[0] ?? t("knowledgeNetwork.graphExplorer.view.missingParams") });
        return;
      }
      setStatus({ kind: "loading", text: t("knowledgeNetwork.graphExplorer.view.status.fetching", { count: parsed.items.length }) });
      const collected = await withManagedTurn(lifecycle, t("knowledgeNetwork.graphExplorer.browse.idsTurn", { count: parsed.items.length }), async (turn) => {
        const otIds = [...new Set(parsed.items.map((item) => item.otId))];
        const metas = await loadMetas(otIds, turn);
        return collectSubgraphByIds(client, parsed.items, metas, data.relation_types, NO_LABELS, turn);
      });
      const added = await addToCanvas(collected.nodes, collected.edges);
      const missing = parsed.items.length - collected.nodes.length;
      if (missing > 0) messages.push(t("knowledgeNetwork.graphExplorer.view.missing", { count: missing }));
      if (added.dropped > 0) messages.push(t("knowledgeNetwork.graphExplorer.toast.limitTruncated", { limit: NODE_LIMIT, dropped: added.dropped }));
      if (params.expand) {
        setStatus({ kind: "loading", text: t("knowledgeNetwork.graphExplorer.view.status.expanding") });
        await expand(collected.nodes.map((node) => node.id), params.expand);
      }
      await canvasRef.current?.relayout();
      await canvasRef.current?.fitView();
      setNotes(messages);
      setStatus({ kind: "ready", text: "" });
    };
    run().catch((error: unknown) => {
      setStatus({ kind: "error", text: t("knowledgeNetwork.graphExplorer.view.status.error", { message: friendlyError(error) }) });
    });
  }, [addToCanvas, base, client, expand, lifecycle, loadMetas, params, t]);

  const menuLabels = useMemo(
    () => Object.fromEntries(MENU_ACTIONS.map((action) => [action, t(`knowledgeNetwork.graphExplorer.menu.${action}`)])) as Record<MenuAction, string>,
    [t],
  );
  const studioUrl = useMemo(
    () => buildShareUrl(`${base}${DEFAULT_APP_BASENAME}/knowledge-network/workspace/${params.kn}/graph-explorer`, [...nodesRef.current.keys()], { layout }).url,
    // The node set is what counts tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, params.kn, layout, counts],
  );

  const changeLayout = (next: ExplorerLayout) => {
    setLayout(next);
    canvasRef.current?.setLayout(next);
    void canvasRef.current?.relayout();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.title}>{t("knowledgeNetwork.graphExplorer.view.title")}</span>
        <span className={styles.muted}>{detail?.name ?? params.kn}</span>
        <span className={styles.spacer} />
        {status.kind === "ready" ? (
          <span data-testid="graph-view-stats">{t("knowledgeNetwork.graphExplorer.view.status.ready", { nodes: counts.nodes, edges: counts.edges })}</span>
        ) : (
          <span className={styles.muted} data-testid="graph-view-status">
            {status.text}
          </span>
        )}
        <label className={styles.control}>
          {t("knowledgeNetwork.graphExplorer.view.layout")}
          <select value={layout} onChange={(event) => changeLayout(event.target.value as ExplorerLayout)} data-testid="graph-view-layout">
            {LAYOUTS.map((value) => (
              <option key={value} value={value}>
                {t(`knowledgeNetwork.graphExplorer.layouts.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void canvasRef.current?.relayout()}>
          {t("knowledgeNetwork.graphExplorer.view.relayout")}
        </button>
        <button type="button" onClick={() => void canvasRef.current?.fitView()}>
          {t("knowledgeNetwork.graphExplorer.view.fit")}
        </button>
        <a href={studioUrl} target="_blank" rel="noreferrer">
          {t("knowledgeNetwork.graphExplorer.view.openInStudio")}
        </a>
      </header>
      {notes.length > 0 ? <div className={styles.notes}>{notes.join(" ")}</div> : null}
      {status.kind === "error" ? (
        <div className={styles.error} data-testid="graph-view-error">
          {status.text}
        </div>
      ) : null}
      <div className={styles.body}>
        <div className={styles.canvas}>
          <GraphCanvas
            ref={canvasRef}
            initialNodes={[]}
            initialEdges={[]}
            initialPositions={{}}
            layout={layout}
            shape="circle"
            showNodeLabels
            showEdgeLabels
            dragMode="single"
            colorOf={colorOf}
            menuLabels={menuLabels}
            menuActions={VIEW_MENU}
            onNodeClick={(id) => setSelected(nodesRef.current.get(id) ?? null)}
            onNodeDoubleClick={(id) => void expand([id], "bidirectional")}
            onCanvasClick={() => setSelected(null)}
            onMenu={(action, id) => {
              const direction = DIRECTION_OF[action];
              if (direction) void expand([id], direction);
              else if (action === "remove") void removeNode(id);
            }}
          />
        </div>
        {selected ? (
          <aside className={styles.panel} data-testid="graph-view-panel">
            <div className={styles.panelHead}>
              <span>{selected.display}</span>
              <button type="button" onClick={() => setSelected(null)}>
                {t("knowledgeNetwork.graphExplorer.view.close")}
              </button>
            </div>
            <div className={styles.muted}>
              {selected.otName} · {selected.id}
            </div>
            <dl>
              {Object.entries(selected.props).map(([key, value]) => (
                <div key={key} style={{ display: "contents" }}>
                  <dt>{key}</dt>
                  <dd>{stringifyValue(value)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
