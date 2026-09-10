/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Spin, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { createBknLifecycle, lifecycleEnv, memoryConversationStore, withManagedTurn, type BknTurn } from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { fetchKnDetail, type KnDetail, type McpAuth } from "@/modules/knowledge-network/services/context-loader.service";
import {
  NODE_LIMIT,
  PATH_MAX_HOPS,
  capIncomingNodes,
  edgesAmong,
  keyValueFor,
  parseIdList,
  createGraphExplorerClient,
  edgeFromRelation,
  fromExploreSubgraph,
  fromQueryObjectInstance,
  friendlyError,
  fromSearchInstance,
  identityCondition,
  knSearchInstances,
  mergeGraph,
  needsKnSearch,
  parseRelationPaths,
  relabel,
  runCypherQuery,
  shortestChainTo,
  type ExpandDirection,
  type GEdge,
  type GNode,
  type KnCondition,
  type ObjectTypeMeta,
  type RrfOptions,
  type SearchOptions,
} from "@/modules/knowledge-network/services/graph-explorer.service";
import {
  DEFAULT_SETTINGS,
  clearCache,
  readCache,
  writeCache,
  type ExplorerLayout,
  type ExplorerSettings,
  type ExplorerShape,
  type NodePosition,
} from "@/modules/knowledge-network/utils/graph-explorer-cache";

import { ExplorerToolbar } from "./ExplorerToolbar";
import { OBJECT_TYPE_PALETTE, type MenuAction } from "./constants";
import { GraphCanvas, type CanvasMarks, type ConceptGrouping, type GraphCanvasHandle } from "./GraphCanvas";
import styles from "./GraphExplorerPage.module.css";
import { HistoryDrawer } from "./HistoryDrawer";
import { NodeDrawer } from "./NodeDrawer";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";

import {
  newHistoryId,
  pushHistory,
  pushSnapshot,
  takeSnapshot,
  type CanvasSnapshot,
  type HistoryEntry,
  type HistoryKind,
} from "@/modules/knowledge-network/utils/graph-explorer-history";

import { buildCondition } from "./condition-builder";
import { generateCypherFragment, type CypherPromptTexts } from "./cypher-ai";
import { buildCypherQuery, cypherRowsToGraph, isCypherParseError, parseCypherPattern, type ResolvedEdgeRef, type ResolvedNodeRef } from "./cypher-pattern";
import { BROWSE_PAGE_SIZE, SearchPanel } from "./SearchPanel";

const SAVE_DEBOUNCE_MS = 500;
const CYPHER_ROW_LIMIT = 200;
const UNKNOWN_COLOR = "#8c8c8c";

type Highlight = { nodes: Set<string>; edges: Set<string> } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function GraphExplorerScene() {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const { t } = useTranslation();
  const { message } = useAppServices();
  const runtimeConfig = useRuntimeConfig();

  // Same-origin base so dev goes through the Vite proxy, like the MCP console.
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const auth = useMemo<McpAuth>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );
  const lifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(base, networkId), auth, {
        agentName: "bkn-agent-graph-explorer",
        conversationStore: memoryConversationStore(),
      }),
    [base, networkId, auth],
  );
  const client = useMemo(() => createGraphExplorerClient(lifecycle.session, networkId), [lifecycle, networkId]);

  // Snapshot read once; the canvas is seeded from it and the maps below are filled from it.
  const [snapshot] = useState(() => readCache(networkId));
  const nodesRef = useRef<Map<string, GNode>>(new Map(snapshot?.nodes.map((node) => [node.id, node]) ?? []));
  const edgesRef = useRef<Map<string, GEdge>>(new Map(snapshot?.edges.map((edge) => [edge.id, edge]) ?? []));
  const positionsRef = useRef<Record<string, NodePosition>>(snapshot?.positions ?? {});
  const [graphRev, setGraphRev] = useState(0);
  const bump = useCallback(() => setGraphRev((value) => value + 1), []);

  const [settings, setSettings] = useState<ExplorerSettings>(snapshot?.settings ?? DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [pinned, setPinned] = useState<Set<string>>(
    () => new Set(Object.entries(snapshot?.positions ?? {}).filter(([, position]) => position.fixed).map(([id]) => id)),
  );
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lifecycleDown, setLifecycleDown] = useState(false);
  const [restored, setRestored] = useState((snapshot?.nodes.length ?? 0) > 0);
  const [detail, setDetail] = useState<KnDetail | null>(null);
  const undoRef = useRef<CanvasSnapshot[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [llmModels, setLlmModels] = useState<{ name: string; isDefault?: boolean }[]>([]);

  // Model factory LLMs for Cypher generation; an empty list hides the AI box.
  useEffect(() => {
    let cancelled = false;
    listLlmModels({ page: 1, size: 100 })
      .then((result) => {
        if (cancelled) return;
        const models = result.items.map((item) => ({ name: item.modelName, isDefault: item.default }));
        models.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
        setLlmModels(models);
      })
      .catch(() => {
        if (!cancelled) setLlmModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [metaByOt, setMetaByOt] = useState<Record<string, ObjectTypeMeta>>({});
  const metaRef = useRef(metaByOt);
  metaRef.current = metaByOt;

  const canvasRef = useRef<GraphCanvasHandle | null>(null);

  /* ------------------------------ colours ------------------------------ */

  const colorOf = useCallback(
    (otId: string): string => {
      const index = settingsRef.current.colorByOt[otId];
      return index === undefined ? UNKNOWN_COLOR : OBJECT_TYPE_PALETTE[index % OBJECT_TYPE_PALETTE.length];
    },
    [],
  );

  const assignColors = useCallback((nodes: GNode[]) => {
    const current = settingsRef.current.colorByOt;
    const missing = [...new Set(nodes.map((node) => node.otId))].filter((otId) => current[otId] === undefined);
    if (missing.length === 0) return;
    const next = { ...current };
    let cursor = Object.keys(next).length;
    for (const otId of missing) {
      next[otId] = cursor;
      cursor += 1;
    }
    const updated = { ...settingsRef.current, colorByOt: next };
    settingsRef.current = updated;
    setSettings(updated);
  }, []);

  /* ------------------------------ managed turns ------------------------------ */

  /** What a call records in the history drawer; `raw` is filled by the closure with the backend payload. */
  type TurnLog<T> = {
    kind: HistoryKind;
    title: string;
    input: unknown;
    summarize: (value: T) => string;
    rerun?: HistoryEntry["rerun"];
  };
  type TurnContext = { raw?: unknown };

  const logCall = useCallback((entry: Omit<HistoryEntry, "id" | "at">) => {
    setHistory((previous) => pushHistory(previous, { ...entry, id: newHistoryId(), at: Date.now() }));
  }, []);

  const runTurn = useCallback(
    async <T,>(
      question: string,
      run: (turn: BknTurn | null, ctx: TurnContext) => Promise<T>,
      options: { rethrow?: boolean; log?: TurnLog<T> } = {},
    ): Promise<T | undefined> => {
      setBusy(true);
      const ctx: TurnContext = {};
      const started = performance.now();
      try {
        const value = await withManagedTurn(lifecycle, question, (turn) => run(turn, ctx));
        if (lifecycle.unsupported()) setLifecycleDown(true);
        if (options.log) {
          logCall({ kind: options.log.kind, title: options.log.title, input: options.log.input, output: ctx.raw ?? value, ok: true, ms: Math.round(performance.now() - started), summary: options.log.summarize(value), rerun: options.log.rerun });
        }
        return value;
      } catch (error) {
        if (lifecycle.unsupported()) setLifecycleDown(true);
        const text = friendlyError(error);
        if (options.log) {
          logCall({ kind: options.log.kind, title: options.log.title, input: options.log.input, output: ctx.raw ?? text, ok: false, ms: Math.round(performance.now() - started), summary: t("knowledgeNetwork.graphExplorer.history.summary.failed"), rerun: options.log.rerun });
        }
        // Panels with their own error area ask for the readable message instead of a toast.
        if (options.rethrow) throw new Error(text);
        message.error({ content: text, key: "graph-explorer-error", duration: 6 });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [lifecycle, logCall, message, t],
  );

  const rememberForUndo = useCallback(() => {
    pushSnapshot(undoRef.current, takeSnapshot(nodesRef.current.values(), edgesRef.current.values(), positionsRef.current));
    setUndoCount(undoRef.current.length);
  }, []);

  const loadMetas = useCallback(
    async (ids: string[], turn: BknTurn | null): Promise<Record<string, ObjectTypeMeta>> => {
      const missing = ids.filter((id) => !metaRef.current[id]);
      if (missing.length === 0) return metaRef.current;
      const loaded = await client.loadObjectTypes(missing, turn);
      const next = { ...metaRef.current };
      for (const meta of loaded) next[meta.id] = meta;
      metaRef.current = next;
      setMetaByOt(next);
      return next;
    },
    [client],
  );

  const ensureMeta = useCallback(
    async (otId: string): Promise<ObjectTypeMeta | null> => {
      if (metaRef.current[otId]) return metaRef.current[otId];
      const metas = await runTurn(t("knowledgeNetwork.graphExplorer.turn.schema"), (turn) => loadMetas([otId], turn));
      return metas?.[otId] ?? null;
    },
    [loadMetas, runTurn, t],
  );

  // Object type list for the filter tab.
  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    void withManagedTurn(lifecycle, t("knowledgeNetwork.graphExplorer.turn.schema"), (turn) =>
      fetchKnDetail({ base, token: "", knId: networkId }, auth, undefined, turn ?? undefined),
    )
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled && lifecycle.unsupported()) setLifecycleDown(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, base, lifecycle, networkId, t]);

  /* ------------------------------ graph mutations ------------------------------ */

  const addToCanvas = useCallback(
    async (incomingNodes: GNode[], incomingEdges: GEdge[], anchorId?: string): Promise<{ nodes: number; edges: number } | null> => {
      // Over the limit the batch is cut to what still fits, never refused outright: partial data on
      // the canvas beats a warning and nothing. Edges to dropped nodes fall out in mergeGraph.
      const capped = capIncomingNodes(incomingNodes, new Set(nodesRef.current.keys()), NODE_LIMIT);
      if (capped.dropped > 0) {
        message.warning(t("knowledgeNetwork.graphExplorer.toast.limitTruncated", { limit: NODE_LIMIT, dropped: capped.dropped }));
      }
      if (capped.nodes.length === 0 && incomingNodes.length > 0) return null;
      rememberForUndo();
      const { addedNodes, addedEdges } = mergeGraph(nodesRef.current, edgesRef.current, { nodes: capped.nodes, edges: incomingEdges });
      if (addedNodes.length === 0 && addedEdges.length === 0) {
        undoRef.current.pop();
        setUndoCount(undoRef.current.length);
        return { nodes: 0, edges: 0 };
      }
      assignColors(addedNodes);
      await canvasRef.current?.addElements(addedNodes, addedEdges, anchorId);
      bump();
      return { nodes: addedNodes.length, edges: addedEdges.length };
    },
    [assignColors, bump, message, rememberForUndo, t],
  );

  const handleAdd = useCallback(
    (nodes: GNode[]) => {
      void addToCanvas(nodes, []).then((added) => {
        if (added && added.nodes > 0) message.success(t("knowledgeNetwork.graphExplorer.toast.added", { count: added.nodes }));
        else if (added) message.info(t("knowledgeNetwork.graphExplorer.toast.nothingNew"));
      });
    },
    [addToCanvas, message, t],
  );

  const expand = useCallback(
    async (id: string, direction: ExpandDirection) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      const condition = identityCondition(node.identity);
      if (!condition) {
        message.warning(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: node.otName }));
        return;
      }
      const input = { tool: "explore_subgraph", kn_id: networkId, source_object_type_id: node.otId, direction, path_length: 1, condition, limit: 1 };
      const result = await runTurn(
        t("knowledgeNetwork.graphExplorer.turn.expand", { label: node.display }),
        async (turn, ctx) => {
          const payload = await client.exploreSubgraph({ sourceOtId: node.otId, condition, direction, pathLength: 1 }, turn);
          ctx.raw = payload;
          return fromExploreSubgraph(payload, settingsRef.current.labelByOt);
        },
        {
          log: {
            kind: "expand",
            title: `${node.display} · ${direction}`,
            input,
            summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.nodes", { nodes: value.nodes.length, edges: value.edges.length }),
            rerun: { kind: "expand", id, direction },
          },
        },
      );
      if (!result) return;
      const added = await addToCanvas(result.nodes, result.edges, id);
      if (added && added.nodes === 0 && added.edges === 0) message.info(t("knowledgeNetwork.graphExplorer.toast.noNeighbors"));
    },
    [addToCanvas, client, message, networkId, runTurn, t],
  );

  const findPath = useCallback(async () => {
    const start = pathStart ? nodesRef.current.get(pathStart) : undefined;
    const end = pathEnd ? nodesRef.current.get(pathEnd) : undefined;
    if (!start || !end) {
      message.info(t("knowledgeNetwork.graphExplorer.toast.pathNeedBoth"));
      return;
    }
    const condition = identityCondition(start.identity);
    if (!condition) {
      message.warning(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: start.otName }));
      return;
    }
    const outcome = await runTurn(t("knowledgeNetwork.graphExplorer.turn.path"), async (turn, ctx) => {
      // The widest radius can fail downstream on a path that crosses an object type with no
      // published data. Narrow the radius before giving up, so a short path is still found.
      let payload: Record<string, unknown> | null = null;
      let lastError: unknown = null;
      for (let hops = PATH_MAX_HOPS; hops >= 1; hops -= 1) {
        try {
          payload = await client.exploreSubgraph({ sourceOtId: start.otId, condition, direction: "bidirectional", pathLength: hops }, turn);
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!payload) throw lastError instanceof Error ? lastError : new Error(String(lastError));
      ctx.raw = payload;
      const chain = shortestChainTo(parseRelationPaths(payload.relation_paths), start.id, end.id);
      if (!chain) return { chain: null, nodes: [] as GNode[] };
      const subgraph = fromExploreSubgraph(payload, settingsRef.current.labelByOt);
      const onPath = new Set<string>([start.id, end.id]);
      for (const relation of chain) {
        onPath.add(relation.source_object_id);
        onPath.add(relation.target_object_id);
      }
      return { chain, nodes: subgraph.nodes.filter((node) => onPath.has(node.id)) };
    }, {
      log: {
        kind: "path",
        title: `${start.display} → ${end.display}`,
        input: { tool: "explore_subgraph", kn_id: networkId, source_object_type_id: start.otId, direction: "bidirectional", path_length: `${PATH_MAX_HOPS}→1`, condition, target: end.id },
        summarize: (value) => (value.chain ? t("knowledgeNetwork.graphExplorer.toast.pathFound", { hops: value.chain.length }) : t("knowledgeNetwork.graphExplorer.toast.pathNotFound")),
        rerun: { kind: "path" },
      },
    });
    if (!outcome) return;
    if (!outcome.chain) {
      setHighlight(null);
      message.info(t("knowledgeNetwork.graphExplorer.toast.pathNotFound"));
      return;
    }
    const edges = outcome.chain.map(edgeFromRelation);
    const added = await addToCanvas(outcome.nodes, edges, start.id);
    if (added === null) return;
    setHighlight({
      nodes: new Set([start.id, end.id, ...edges.flatMap((edge) => [edge.source, edge.target])]),
      edges: new Set(edges.map((edge) => edge.id)),
    });
    message.success(t("knowledgeNetwork.graphExplorer.toast.pathFound", { hops: outcome.chain.length }));
  }, [addToCanvas, client, message, networkId, pathEnd, pathStart, runTurn, t]);

  const removeNodes = useCallback(
    async (ids: string[]) => {
      const present = ids.filter((id) => nodesRef.current.has(id));
      if (present.length === 0) return 0;
      rememberForUndo();
      const removed = new Set(present);
      for (const id of present) nodesRef.current.delete(id);
      for (const [edgeId, edge] of edgesRef.current) {
        if (removed.has(edge.source) || removed.has(edge.target)) edgesRef.current.delete(edgeId);
      }
      for (const id of present) delete positionsRef.current[id];
      for (const id of present) await canvasRef.current?.removeNode(id);
      setPinned((previous) => {
        const next = new Set([...previous].filter((id) => !removed.has(id)));
        return next.size === previous.size ? previous : next;
      });
      if (pathStart && removed.has(pathStart)) setPathStart(null);
      if (pathEnd && removed.has(pathEnd)) setPathEnd(null);
      if (selectedId && removed.has(selectedId)) setSelectedId(null);
      setHighlight((previous) => (previous && [...removed].some((id) => previous.nodes.has(id)) ? null : previous));
      bump();
      return present.length;
    },
    [bump, pathEnd, pathStart, rememberForUndo, selectedId],
  );

  const removeNode = useCallback((id: string) => removeNodes([id]), [removeNodes]);

  const removeSelected = useCallback(async () => {
    const ids = canvasRef.current?.getSelectedIds() ?? [];
    if (ids.length === 0) {
      message.info(t("knowledgeNetwork.graphExplorer.toast.noSelection"));
      return;
    }
    const count = await removeNodes(ids);
    if (count > 0) message.success(t("knowledgeNetwork.graphExplorer.toast.removedSelected", { count }));
  }, [message, removeNodes, t]);

  const handleUndo = useCallback(async () => {
    const snapshot = undoRef.current.pop();
    setUndoCount(undoRef.current.length);
    if (!snapshot) {
      message.info(t("knowledgeNetwork.graphExplorer.toast.nothingToUndo"));
      return;
    }
    nodesRef.current = new Map(snapshot.nodes.map((node) => [node.id, node]));
    edgesRef.current = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
    positionsRef.current = { ...snapshot.positions };
    await canvasRef.current?.replaceAll(snapshot.nodes, snapshot.edges, snapshot.positions);
    const ids = nodesRef.current;
    setPinned((previous) => new Set([...previous].filter((id) => ids.has(id))));
    setPathStart((previous) => (previous && ids.has(previous) ? previous : null));
    setPathEnd((previous) => (previous && ids.has(previous) ? previous : null));
    setSelectedId((previous) => (previous && ids.has(previous) ? previous : null));
    setHighlight(null);
    bump();
    message.success({ content: t("knowledgeNetwork.graphExplorer.toast.undone"), key: "graph-explorer-undo", duration: 2 });
  }, [bump, message, t]);

  const handleExport = useCallback(async () => {
    try {
      const url = await canvasRef.current?.exportImage();
      if (!url) return;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `graph-explorer-${networkId}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      anchor.click();
      message.success(t("knowledgeNetwork.graphExplorer.toast.exported"));
    } catch (error) {
      message.error(friendlyError(error));
    }
  }, [message, networkId, t]);

  const clearCanvas = useCallback(async () => {
    if (nodesRef.current.size > 0) rememberForUndo();
    nodesRef.current.clear();
    edgesRef.current.clear();
    positionsRef.current = {};
    await canvasRef.current?.clear();
    setPinned(new Set());
    setPathStart(null);
    setPathEnd(null);
    setHighlight(null);
    setSelectedId(null);
    setRestored(false);
    bump();
  }, [bump, rememberForUndo]);

  const handleMenu = useCallback(
    (action: MenuAction, id: string) => {
      switch (action) {
        case "expandOut":
          void expand(id, "forward");
          break;
        case "expandIn":
          void expand(id, "backward");
          break;
        case "expandBoth":
          void expand(id, "bidirectional");
          break;
        case "setPathStart":
          setPathStart(id);
          setHighlight(null);
          break;
        case "setPathEnd":
          setPathEnd(id);
          setHighlight(null);
          break;
        case "clearPathStart":
          setPathStart(null);
          setHighlight(null);
          break;
        case "clearPathEnd":
          setPathEnd(null);
          setHighlight(null);
          break;
        case "remove":
          void removeNode(id);
          break;
        case "pin":
        case "unpin":
          setPinned((previous) => {
            const next = new Set(previous);
            if (action === "pin") next.add(id);
            else next.delete(id);
            return next;
          });
          break;
        default:
          break;
      }
    },
    [expand, removeNode],
  );

  /* ------------------------------ settings ------------------------------ */

  const updateSettings = useCallback((patch: Partial<ExplorerSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const handleLayoutChange = useCallback(
    (layout: ExplorerLayout) => {
      updateSettings({ layout });
      canvasRef.current?.setLayout(layout);
      void canvasRef.current?.relayout();
    },
    [updateSettings],
  );

  const handleShapeChange = useCallback(
    (shape: ExplorerShape) => {
      updateSettings({ shape });
      void canvasRef.current?.setShape(shape);
    },
    [updateSettings],
  );

  const handleLabelVisibilityChange = useCallback(
    (nodeLabels: boolean, edgeLabels: boolean) => {
      updateSettings({ showNodeLabels: nodeLabels, showEdgeLabels: edgeLabels });
      void canvasRef.current?.setLabelVisibility(nodeLabels, edgeLabels);
    },
    [updateSettings],
  );

  const handleLabelChange = useCallback(
    (otId: string, property: string | null) => {
      const labelByOt = { ...settingsRef.current.labelByOt };
      if (property) labelByOt[otId] = property;
      else delete labelByOt[otId];
      updateSettings({ labelByOt });
      const relabeled = relabel([...nodesRef.current.values()].filter((node) => node.otId === otId), labelByOt);
      for (const node of relabeled) nodesRef.current.set(node.id, node);
      void canvasRef.current?.updateNodes(relabeled);
      bump();
    },
    [bump, updateSettings],
  );

  /* ------------------------------ marks & persistence ------------------------------ */

  useEffect(() => {
    const marks: CanvasMarks = {
      pathStart,
      pathEnd,
      pinned,
      highlightNodes: highlight?.nodes ?? new Set(),
      highlightEdges: highlight?.edges ?? new Set(),
    };
    void canvasRef.current?.applyMarks(marks);
  }, [highlight, pathEnd, pathStart, pinned]);

  const [positionsRev, setPositionsRev] = useState(0);
  const handlePositionsChange = useCallback((positions: Record<string, NodePosition>) => {
    positionsRef.current = positions;
    setPositionsRev((value) => value + 1);
  }, []);

  // Pending debounced save, so "clear cache" can drop a write that was already scheduled.
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!networkId) return;
    const handle = window.setTimeout(() => {
      saveTimerRef.current = null;
      const positions: Record<string, NodePosition> = {};
      for (const [id, position] of Object.entries(positionsRef.current)) {
        positions[id] = pinned.has(id) ? { ...position, fixed: true } : { x: position.x, y: position.y };
      }
      const outcome = writeCache(networkId, {
        nodes: [...nodesRef.current.values()],
        edges: [...edgesRef.current.values()],
        positions,
        settings,
      });
      if (outcome === "settings-only") message.warning(t("knowledgeNetwork.graphExplorer.toast.cacheSaveFailed"));
    }, SAVE_DEBOUNCE_MS);
    saveTimerRef.current = handle;
    return () => {
      window.clearTimeout(handle);
      if (saveTimerRef.current === handle) saveTimerRef.current = null;
    };
  }, [graphRev, message, networkId, pinned, positionsRev, settings, t]);

  const handleClearCache = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    clearCache(networkId);
    setRestored(false);
    message.success(t("knowledgeNetwork.graphExplorer.toast.cacheCleared"));
  }, [message, networkId, t]);

  /* ------------------------------ search callbacks ------------------------------ */

  const handleSearch = useCallback(
    async (query: string, options: SearchOptions, rrf: RrfOptions): Promise<GNode[]> => {
      const viaKnSearch = needsKnSearch(rrf);
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.turn.search", { query }), async (turn, ctx) => {
        // Fusion knobs are only reachable through kn_search's retrieval_config; defaults keep the MCP tool.
        const payload = viaKnSearch
          ? await knSearchInstances({ base, token: "", knId: networkId }, auth, query, options, rrf, turn)
          : await client.searchInstances(query, turn, options);
        ctx.raw = payload;
        const hits = Array.isArray(payload.nodes) ? payload.nodes : [];
        const needMeta = new Set<string>();
        for (const hit of hits) {
          if (!isRecord(hit) || typeof hit.object_type_id !== "string") continue;
          const props = isRecord(hit.properties) ? hit.properties : {};
          if (typeof props._instance_id !== "string") needMeta.add(hit.object_type_id);
        }
        const metas = await loadMetas([...needMeta], turn);
        const mapped = fromSearchInstance(payload, metas, settingsRef.current.labelByOt);
        for (const skipped of mapped.skipped) {
          message.warning(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: skipped.otName }));
        }
        return mapped.nodes;
      }, {
        log: {
          kind: "search",
          title: query,
          input: { tool: viaKnSearch ? "kn_search" : "search_instance", kn_id: networkId, query, ...options, ...(viaKnSearch ? { rrf } : {}) },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.hits", { count: value.length }),
        },
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [auth, base, client, loadMetas, message, networkId, runTurn, t],
  );

  const handleQuery = useCallback(
    async (otId: string, condition: KnCondition | null): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.turn.query", { ot: otName }), async (turn, ctx) => {
        const metas = await loadMetas([otId], turn);
        const meta = metas[otId] ?? { id: otId, name: otName, primaryKeys: [], properties: [] };
        const payload = await client.queryInstances(otId, condition, 50, turn);
        ctx.raw = payload;
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      }, {
        log: {
          kind: "query",
          title: otName,
          input: { tool: "query_object_instance", kn_id: networkId, ot_id: otId, condition, limit: 50 },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.hits", { count: value.length }),
        },
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, networkId, runTurn, t],
  );

  const handleLocate = useCallback(
    async (otId: string, rawKey: string): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.browse.locateTurn", { ot: otName }), async (turn, ctx) => {
        const metas = await loadMetas([otId], turn);
        const meta = metas[otId];
        if (!meta || meta.primaryKeys.length === 0) {
          throw new Error(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: otName }));
        }
        // One value per primary key, in key order; a single-key type takes the whole input verbatim.
        const values = meta.primaryKeys.length === 1 ? [rawKey] : rawKey.split(",").map((part) => part.trim());
        const rows = meta.primaryKeys.map((field, index) => ({ field, operator: "==", value: values[index] ?? "" }));
        const condition = buildCondition(rows, meta.properties);
        if (!condition) return [];
        const payload = await client.queryInstances(otId, condition, 10, turn);
        ctx.raw = payload;
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      }, {
        log: {
          kind: "locate",
          title: `${otName} = ${rawKey}`,
          input: { tool: "query_object_instance", kn_id: networkId, ot_id: otId, key: rawKey },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.hits", { count: value.length }),
        },
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, networkId, runTurn, t],
  );

  const handleCypher = useCallback(
    async (fragment: string): Promise<{ nodes: GNode[]; edges: GEdge[]; rows: number }> => {
      const parsed = parseCypherPattern(fragment);
      if (isCypherParseError(parsed)) {
        const key = {
          empty: "parseEmpty",
          no_match: "parseNoNodes",
          no_nodes: "parseNoNodes",
          return_present: "parseReturn",
          unlabeled: "parseUnlabeled",
          multiple_match: "parseMultipleMatch",
          multiple_patterns: "parseMultiplePatterns",
        }[parsed.error];
        throw new Error(t(`knowledgeNetwork.graphExplorer.cypher.${key}`, { variable: parsed.detail ?? "" }));
      }
      const types = detail?.object_types ?? [];
      const relations = detail?.relation_types ?? [];
      const typeByLabel = (label: string) => types.find((item) => item.id === label) ?? types.find((item) => (item.name ?? "").trim() === label);
      const otIds: string[] = [];
      for (const node of parsed.nodes) {
        const found = typeByLabel(node.label);
        if (!found) throw new Error(t("knowledgeNetwork.graphExplorer.cypher.unknownLabel", { label: node.label }));
        otIds.push(found.id);
      }
      const resolvedEdges: ResolvedEdgeRef[] = parsed.edges.map((edge) => {
        const found = relations.find((item) => item.id === edge.relation) ?? relations.find((item) => (item.name ?? "").trim() === edge.relation);
        if (!found) throw new Error(t("knowledgeNetwork.graphExplorer.cypher.unknownRelation", { relation: edge.relation }));
        return { ...edge, relTypeId: found.id, relTypeName: found.name?.trim() || found.id };
      });
      let sentQuery = "";
      const outcome = await runTurn(t("knowledgeNetwork.graphExplorer.cypher.turn"), async (turn, ctx) => {
        const metas = await loadMetas([...new Set(otIds)], turn);
        const resolvedNodes: ResolvedNodeRef[] = parsed.nodes.map((node, index) => {
          const otId = otIds[index];
          const meta = metas[otId];
          if (!meta || meta.primaryKeys.length === 0) {
            throw new Error(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: meta?.name ?? otId }));
          }
          return { ...node, otId, otName: meta.name, primaryKeys: meta.primaryKeys };
        });
        sentQuery = buildCypherQuery(parsed, resolvedNodes, CYPHER_ROW_LIMIT);
        const result = await runCypherQuery(networkId, sentQuery);
        ctx.raw = result;
        const graph = cypherRowsToGraph(result.entries, resolvedNodes, resolvedEdges);
        // Rows carry primary keys only; fetch the instances so labels and the drawer show real properties.
        const enriched = new Map(graph.nodes.map((node) => [node.id, node]));
        for (const node of resolvedNodes) {
          if (node.primaryKeys.length !== 1) continue;
          const pk = node.primaryKeys[0];
          const values = graph.nodes.filter((item) => item.otId === node.otId).map((item) => item.identity[pk]);
          for (let start = 0; start < values.length; start += 50) {
            const chunk = values.slice(start, start + 50);
            const payload = await client.queryInstances(node.otId, { field: pk, operation: "in", value: chunk }, chunk.length, turn);
            for (const full of fromQueryObjectInstance(metas[node.otId], payload, settingsRef.current.labelByOt[node.otId])) {
              if (enriched.has(full.id)) enriched.set(full.id, full);
            }
          }
        }
        return { nodes: [...enriched.values()], edges: graph.edges, rows: result.entries.length };
      }, {
        rethrow: true,
        log: {
          kind: "cypher",
          title: fragment.trim().split("\n")[0],
          input: { endpoint: "cypher-queries", kn_id: networkId, fragment, get query() { return sentQuery; } },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.rows", { rows: value.rows, nodes: value.nodes.length, edges: value.edges.length }),
        },
      });
      if (!outcome) throw new Error("");
      return outcome;
    },
    [client, detail, loadMetas, networkId, runTurn, t],
  );

  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );

  const cypherPromptTexts = useMemo<CypherPromptTexts>(() => {
    const rules: unknown = t("knowledgeNetwork.graphExplorer.cypher.prompt.rules", { returnObjects: true });
    return {
      intro: t("knowledgeNetwork.graphExplorer.cypher.prompt.intro"),
      rulesHeader: t("knowledgeNetwork.graphExplorer.cypher.prompt.rulesHeader"),
      rules: Array.isArray(rules) ? rules.filter((rule): rule is string => typeof rule === "string") : [],
      propertiesLabel: t("knowledgeNetwork.graphExplorer.cypher.prompt.propertiesLabel"),
      objectTypesHeader: t("knowledgeNetwork.graphExplorer.cypher.prompt.objectTypesHeader"),
      relationTypesHeader: t("knowledgeNetwork.graphExplorer.cypher.prompt.relationTypesHeader"),
    };
  }, [t]);

  const handleGenerateCypher = useCallback(
    async (question: string, modelName: string): Promise<string> => {
      if (!detail) return "";
      setBusy(true);
      const started = performance.now();
      try {
        const fragment = await generateCypherFragment({ base, token: "", knId: networkId }, tokenProvider, modelName, detail, question, cypherPromptTexts);
        logCall({ kind: "ai", title: question, input: { model: modelName, question }, output: fragment, ok: true, ms: Math.round(performance.now() - started), summary: t("knowledgeNetwork.graphExplorer.history.summary.text", { chars: fragment.length }) });
        return fragment;
      } catch (error) {
        logCall({ kind: "ai", title: question, input: { model: modelName, question }, output: friendlyError(error), ok: false, ms: Math.round(performance.now() - started), summary: t("knowledgeNetwork.graphExplorer.history.summary.failed") });
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [base, cypherPromptTexts, detail, logCall, networkId, t, tokenProvider],
  );

  const handleAddGraph = useCallback(
    (nodes: GNode[], edges: GEdge[]) => {
      void addToCanvas(nodes, edges).then((added) => {
        if (added && (added.nodes > 0 || added.edges > 0)) message.success(t("knowledgeNetwork.graphExplorer.toast.added", { count: added.nodes }));
        else if (added) message.info(t("knowledgeNetwork.graphExplorer.toast.nothingNew"));
      });
    },
    [addToCanvas, message, t],
  );

  const handleBrowse = useCallback(
    async (otId: string, offset: number): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const page = Math.floor(offset / BROWSE_PAGE_SIZE) + 1;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.browse.turn", { ot: otName, page }), async (turn, ctx) => {
        const metas = await loadMetas([otId], turn);
        const meta = metas[otId] ?? { id: otId, name: otName, primaryKeys: [], properties: [] };
        const payload = await client.queryInstances(otId, null, BROWSE_PAGE_SIZE, turn, offset);
        ctx.raw = payload;
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      }, {
        log: {
          kind: "browse",
          title: `${otName} · ${page}`,
          input: { tool: "query_object_instance", kn_id: networkId, ot_id: otId, limit: BROWSE_PAGE_SIZE, offset },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.hits", { count: value.length }),
        },
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, networkId, runTurn, t],
  );

  const handleSubgraphByIds = useCallback(
    async (text: string, fallbackOt?: string): Promise<void> => {
      const typeIds = (detail?.object_types ?? []).map((item) => item.id);
      const parsed = parseIdList(text, typeIds, fallbackOt);
      if (parsed.unknown.length > 0) {
        throw new Error(t("knowledgeNetwork.graphExplorer.browse.idsUnknown", { list: parsed.unknown.slice(0, 5).join(", ") }));
      }
      if (parsed.items.length === 0) return;
      const relations = detail?.relation_types ?? [];
      const outcome = await runTurn(t("knowledgeNetwork.graphExplorer.browse.idsTurn", { count: parsed.items.length }), async (turn, ctx) => {
        const byOt = new Map<string, string[]>();
        for (const item of parsed.items) byOt.set(item.otId, [...(byOt.get(item.otId) ?? []), item.key]);
        const metas = await loadMetas([...byOt.keys()], turn);
        // 1. Resolve the instances, one `in` query per object type (50 keys a batch).
        const nodes: GNode[] = [];
        const rawPayloads: Record<string, unknown[]> = {};
        for (const [otId, keys] of byOt) {
          const meta = metas[otId];
          if (!meta || meta.primaryKeys.length !== 1) {
            throw new Error(t("knowledgeNetwork.graphExplorer.toast.missingPrimaryKey", { name: meta?.name ?? otId }));
          }
          const pk = meta.primaryKeys[0];
          for (let start = 0; start < keys.length; start += 50) {
            const chunk = keys.slice(start, start + 50).map((key) => keyValueFor(meta, key));
            const payload = await client.queryInstances(otId, { field: pk, operation: "in", value: chunk }, chunk.length, turn);
            (rawPayloads[otId] ??= []).push(payload);
            nodes.push(...fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]));
          }
        }
        const nodeIds = new Set(nodes.map((node) => node.id));
        // 2. Relations among the set: one path query per relation type whose ends are both present.
        const edges: GEdge[] = [];
        const keysOf = (otId: string) => {
          const meta = metas[otId];
          return (byOt.get(otId) ?? []).map((key) => keyValueFor(meta, key));
        };
        const paths = relations
          .filter((relation) => byOt.has(relation.sourceId) && byOt.has(relation.targetId))
          .map((relation) => ({
            object_types: [
              { id: relation.sourceId, condition: { field: metas[relation.sourceId].primaryKeys[0], operation: "in", value: keysOf(relation.sourceId) } },
              { id: relation.targetId, condition: { field: metas[relation.targetId].primaryKeys[0], operation: "in", value: keysOf(relation.targetId) } },
            ],
            relation_types: [{ relation_type_id: relation.id, source_object_type_id: relation.sourceId, target_object_type_id: relation.targetId }],
            limit: Math.min(1000, Math.max(10, keysOf(relation.sourceId).length)),
          }));
        const pathPayloads: unknown[] = [];
        for (let start = 0; start < paths.length; start += 5) {
          const batch = paths.slice(start, start + 5);
          try {
            const payload = await client.queryInstanceSubgraph(batch, turn);
            pathPayloads.push(payload);
            const entries = Array.isArray(payload.entries) ? payload.entries : [];
            for (const entry of entries) edges.push(...edgesAmong(fromExploreSubgraph(entry, settingsRef.current.labelByOt).edges, nodeIds));
          } catch (error) {
            // A dead binding on one relation type must not sink the whole subgraph.
            pathPayloads.push({ error: friendlyError(error), paths: batch });
          }
        }
        ctx.raw = { instances: rawPayloads, paths: pathPayloads };
        return { nodes, edges, requested: parsed.items.length };
      }, {
        rethrow: true,
        log: {
          kind: "ids",
          title: `${parsed.items.length} ids`,
          input: { tools: ["query_object_instance", "query_instance_subgraph"], kn_id: networkId, ids: parsed.items },
          summarize: (value) => t("knowledgeNetwork.graphExplorer.history.summary.nodes", { nodes: value.nodes.length, edges: value.edges.length }),
        },
      });
      if (!outcome) return;
      const added = await addToCanvas(outcome.nodes, outcome.edges);
      if (added === null) return;
      const missing = outcome.requested - outcome.nodes.length;
      if (missing > 0) message.warning(t("knowledgeNetwork.graphExplorer.browse.idsMissing", { count: missing }));
      message.success(t("knowledgeNetwork.graphExplorer.browse.idsDone", { nodes: outcome.nodes.length, edges: outcome.edges.length }));
    },
    [addToCanvas, client, detail, loadMetas, message, networkId, runTurn, t],
  );

  /* ------------------------------ grouping, sidebar, keyboard ------------------------------ */

  const conceptGrouping = useMemo<ConceptGrouping | null>(() => {
    const groups = detail?.concept_groups ?? [];
    if (groups.length === 0) return null;
    const comboByOt: Record<string, string> = {};
    const combos = groups.map((group) => {
      const id = `cg:${group.id}`;
      for (const otId of group.object_type_ids ?? []) {
        if (!comboByOt[otId]) comboByOt[otId] = id;
      }
      return { id, name: group.name?.trim() || group.id };
    });
    return { combos, comboByOt };
  }, [detail]);

  const handleToggleGroup = useCallback(
    (checked: boolean) => {
      updateSettings({ groupByConceptGroup: checked });
      void canvasRef.current?.setGrouping(checked ? conceptGrouping : null);
    },
    [conceptGrouping, updateSettings],
  );

  // Apply a persisted grouping once the concept groups are known.
  const groupingAppliedRef = useRef(false);
  useEffect(() => {
    if (groupingAppliedRef.current || !conceptGrouping || !settings.groupByConceptGroup) return;
    groupingAppliedRef.current = true;
    void canvasRef.current?.setGrouping(conceptGrouping);
  }, [conceptGrouping, settings.groupByConceptGroup]);

  const handleToggleSidebar = useCallback(() => {
    updateSettings({ sidebarCollapsed: !settingsRef.current.sidebarCollapsed });
  }, [updateSettings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        void handleUndo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        const ids = canvasRef.current?.getSelectedIds() ?? [];
        if (ids.length > 0) {
          event.preventDefault();
          void removeNodes(ids).then((count) => {
            if (count > 0) message.success(t("knowledgeNetwork.graphExplorer.toast.removedSelected", { count }));
          });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, message, removeNodes, t]);

  const handleRerun = useCallback(
    (entry: HistoryEntry) => {
      if (!entry.rerun) return;
      if (entry.rerun.kind === "expand") void expand(entry.rerun.id, entry.rerun.direction);
      else void findPath();
    },
    [expand, findPath],
  );

  const copyText = useCallback(
    (text: string) => {
      void navigator.clipboard
        .writeText(text)
        .then(() => message.success({ content: t("knowledgeNetwork.graphExplorer.toast.copied"), key: "graph-explorer-copy", duration: 1.5 }))
        .catch(() => undefined);
    },
    [message, t],
  );

  /* ------------------------------ derived view data ------------------------------ */

  const canvasIds = useMemo(() => new Set(nodesRef.current.keys()), [graphRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const canvasObjectTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const node of nodesRef.current.values()) {
      if (!seen.has(node.otId)) seen.set(node.otId, node.otName);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [graphRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const propertyNamesByOt = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const { id } of canvasObjectTypes) {
      const fromMeta = metaByOt[id]?.properties.map((property) => property.name) ?? [];
      if (fromMeta.length > 0) {
        out[id] = fromMeta;
        continue;
      }
      const names = new Set<string>();
      for (const node of nodesRef.current.values()) {
        if (node.otId !== id) continue;
        for (const key of Object.keys(node.props)) {
          if (!key.startsWith("_")) names.add(key);
        }
      }
      out[id] = [...names];
    }
    return out;
  }, [canvasObjectTypes, metaByOt]);

  const objectTypes = useMemo(
    () => (detail?.object_types ?? []).map((item) => ({ id: item.id, name: item.name?.trim() || item.id })),
    [detail],
  );
  const conceptGroups = useMemo(
    () => (detail?.concept_groups ?? []).map((item) => ({ id: item.id, name: item.name?.trim() || item.id })),
    [detail],
  );

  const menuLabels = useMemo<Record<MenuAction, string>>(
    () => ({
      expandOut: t("knowledgeNetwork.graphExplorer.menu.expandOut"),
      expandIn: t("knowledgeNetwork.graphExplorer.menu.expandIn"),
      expandBoth: t("knowledgeNetwork.graphExplorer.menu.expandBoth"),
      setPathStart: t("knowledgeNetwork.graphExplorer.menu.setPathStart"),
      clearPathStart: t("knowledgeNetwork.graphExplorer.menu.clearPathStart"),
      setPathEnd: t("knowledgeNetwork.graphExplorer.menu.setPathEnd"),
      clearPathEnd: t("knowledgeNetwork.graphExplorer.menu.clearPathEnd"),
      remove: t("knowledgeNetwork.graphExplorer.menu.remove"),
      pin: t("knowledgeNetwork.graphExplorer.menu.pin"),
      unpin: t("knowledgeNetwork.graphExplorer.menu.unpin"),
    }),
    [t],
  );

  const selectedNode = selectedId ? nodesRef.current.get(selectedId) ?? null : null;
  const disabled = lifecycleDown || !networkId;

  return (
    <div className={styles.root}>
      {settings.sidebarCollapsed ? null : (
      <SearchPanel
        objectTypes={objectTypes}
        conceptGroups={conceptGroups}
        metaByOt={metaByOt}
        ensureMeta={ensureMeta}
        onSearch={handleSearch}
        onLocate={handleLocate}
        onQuery={handleQuery}
        onBrowse={handleBrowse}
        onSubgraphByIds={handleSubgraphByIds}
        onCypher={handleCypher}
        onAddGraph={handleAddGraph}
        cypherRowLimit={CYPHER_ROW_LIMIT}
        onGenerateCypher={llmModels.length > 0 && detail ? handleGenerateCypher : null}
        cypherModels={llmModels}
        onAdd={handleAdd}
        canvasIds={canvasIds}
        disabled={disabled}
        colorOf={colorOf}
      />
      )}
      <div className={styles.main}>
        <ExplorerToolbar
          layout={settings.layout}
          shape={settings.shape}
          showNodeLabels={settings.showNodeLabels}
          showEdgeLabels={settings.showEdgeLabels}
          nodeCount={nodesRef.current.size}
          edgeCount={edgesRef.current.size}
          canvasObjectTypes={canvasObjectTypes}
          propertyNamesByOt={propertyNamesByOt}
          labelByOt={settings.labelByOt}
          pathStart={pathStart ? nodesRef.current.get(pathStart) ?? null : null}
          pathEnd={pathEnd ? nodesRef.current.get(pathEnd) ?? null : null}
          pathActive={highlight !== null}
          busy={busy}
          disabled={disabled}
          onLayoutChange={handleLayoutChange}
          onShapeChange={handleShapeChange}
          onLabelVisibilityChange={handleLabelVisibilityChange}
          onLabelChange={handleLabelChange}
          onRelayout={() => void canvasRef.current?.relayout()}
          onFitView={() => void canvasRef.current?.fitView()}
          onFindPath={() => void findPath()}
          onClearPath={() => {
            setPathStart(null);
            setPathEnd(null);
            setHighlight(null);
          }}
          onClearPathStart={() => {
            setPathStart(null);
            setHighlight(null);
          }}
          onClearPathEnd={() => {
            setPathEnd(null);
            setHighlight(null);
          }}
          onClear={() => void clearCanvas()}
          onClearCache={handleClearCache}
          sidebarCollapsed={settings.sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          undoCount={undoCount}
          onUndo={() => void handleUndo()}
          onExport={() => void handleExport()}
          historyCount={history.length}
          onToggleHistory={() => setHistoryOpen((previous) => !previous)}
          canGroup={conceptGrouping !== null}
          groupByConceptGroup={settings.groupByConceptGroup}
          onToggleGroup={handleToggleGroup}
          onRemoveSelected={() => void removeSelected()}
        />
        {lifecycleDown ? <Alert type="warning" showIcon banner message={t("knowledgeNetwork.graphExplorer.lifecycleUnavailable")} /> : null}
        {restored ? (
          <Alert
            type="info"
            showIcon
            banner
            closable
            onClose={() => setRestored(false)}
            message={t("knowledgeNetwork.graphExplorer.toast.cacheRestored")}
            action={
              <Button size="small" onClick={() => void clearCanvas().then(handleClearCache)}>
                {t("knowledgeNetwork.graphExplorer.restore.clear")}
              </Button>
            }
          />
        ) : null}
        <div className={styles.canvasHost}>
          <GraphCanvas
            ref={canvasRef}
            initialNodes={snapshot?.nodes ?? []}
            initialEdges={snapshot?.edges ?? []}
            initialPositions={snapshot?.positions ?? {}}
            layout={settings.layout}
            shape={settings.shape}
            showNodeLabels={settings.showNodeLabels}
            showEdgeLabels={settings.showEdgeLabels}
            colorOf={colorOf}
            menuLabels={menuLabels}
            onNodeClick={setSelectedId}
            onNodeDoubleClick={(id) => void expand(id, "bidirectional")}
            onCanvasClick={() => setSelectedId(null)}
            onMenu={handleMenu}
            onPositionsChange={handlePositionsChange}
          />
          {nodesRef.current.size === 0 ? (
            <div className={styles.emptyHint}>
              <Typography.Text type="secondary">{t("knowledgeNetwork.graphExplorer.emptyCanvas")}</Typography.Text>
            </div>
          ) : null}
          {busy ? (
            <div className={styles.busy}>
              <Spin />
            </div>
          ) : null}
        </div>
      </div>
      <NodeDrawer node={selectedNode} color={selectedNode ? colorOf(selectedNode.otId) : UNKNOWN_COLOR} onClose={() => setSelectedId(null)} />
      <HistoryDrawer open={historyOpen} entries={history} onClose={() => setHistoryOpen(false)} onCopy={copyText} onRerun={handleRerun} onClear={() => setHistory([])} />
    </div>
  );
}
