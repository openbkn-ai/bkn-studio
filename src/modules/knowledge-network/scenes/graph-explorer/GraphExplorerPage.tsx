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
  createGraphExplorerClient,
  edgeFromRelation,
  fromExploreSubgraph,
  fromQueryObjectInstance,
  friendlyError,
  fromSearchInstance,
  identityCondition,
  mergeGraph,
  parseRelationPaths,
  relabel,
  shortestChainTo,
  type ExpandDirection,
  type GEdge,
  type GNode,
  type KnCondition,
  type ObjectTypeMeta,
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
import { GraphCanvas, type CanvasMarks, type GraphCanvasHandle } from "./GraphCanvas";
import styles from "./GraphExplorerPage.module.css";
import { NodeDrawer } from "./NodeDrawer";
import { buildCondition } from "./condition-builder";
import { BROWSE_PAGE_SIZE, SearchPanel } from "./SearchPanel";

const SAVE_DEBOUNCE_MS = 500;
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

  const runTurn = useCallback(
    async <T,>(question: string, run: (turn: BknTurn | null) => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      try {
        const value = await withManagedTurn(lifecycle, question, run);
        if (lifecycle.unsupported()) setLifecycleDown(true);
        return value;
      } catch (error) {
        if (lifecycle.unsupported()) setLifecycleDown(true);
        message.error(friendlyError(error));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [lifecycle, message],
  );

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
      const fresh = incomingNodes.filter((node) => !nodesRef.current.has(node.id));
      if (nodesRef.current.size + fresh.length > NODE_LIMIT) {
        message.warning(t("knowledgeNetwork.graphExplorer.toast.limitReached", { limit: NODE_LIMIT }));
        return null;
      }
      const { addedNodes, addedEdges } = mergeGraph(nodesRef.current, edgesRef.current, { nodes: incomingNodes, edges: incomingEdges });
      if (addedNodes.length === 0 && addedEdges.length === 0) return { nodes: 0, edges: 0 };
      assignColors(addedNodes);
      await canvasRef.current?.addElements(addedNodes, addedEdges, anchorId);
      bump();
      return { nodes: addedNodes.length, edges: addedEdges.length };
    },
    [assignColors, bump, message, t],
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
      const result = await runTurn(t("knowledgeNetwork.graphExplorer.turn.expand", { label: node.display }), async (turn) => {
        const payload = await client.exploreSubgraph({ sourceOtId: node.otId, condition, direction, pathLength: 1 }, turn);
        return fromExploreSubgraph(payload, settingsRef.current.labelByOt);
      });
      if (!result) return;
      const added = await addToCanvas(result.nodes, result.edges, id);
      if (added && added.nodes === 0 && added.edges === 0) message.info(t("knowledgeNetwork.graphExplorer.toast.noNeighbors"));
    },
    [addToCanvas, client, message, runTurn, t],
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
    const outcome = await runTurn(t("knowledgeNetwork.graphExplorer.turn.path"), async (turn) => {
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
      const chain = shortestChainTo(parseRelationPaths(payload.relation_paths), start.id, end.id);
      if (!chain) return { chain: null, nodes: [] as GNode[] };
      const subgraph = fromExploreSubgraph(payload, settingsRef.current.labelByOt);
      const onPath = new Set<string>([start.id, end.id]);
      for (const relation of chain) {
        onPath.add(relation.source_object_id);
        onPath.add(relation.target_object_id);
      }
      return { chain, nodes: subgraph.nodes.filter((node) => onPath.has(node.id)) };
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
  }, [addToCanvas, client, message, pathEnd, pathStart, runTurn, t]);

  const removeNode = useCallback(
    async (id: string) => {
      if (!nodesRef.current.delete(id)) return;
      for (const [edgeId, edge] of edgesRef.current) {
        if (edge.source === id || edge.target === id) edgesRef.current.delete(edgeId);
      }
      delete positionsRef.current[id];
      await canvasRef.current?.removeNode(id);
      setPinned((previous) => {
        if (!previous.has(id)) return previous;
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      if (pathStart === id) setPathStart(null);
      if (pathEnd === id) setPathEnd(null);
      if (selectedId === id) setSelectedId(null);
      setHighlight((previous) => (previous && previous.nodes.has(id) ? null : previous));
      bump();
    },
    [bump, pathEnd, pathStart, selectedId],
  );

  const clearCanvas = useCallback(async () => {
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
  }, [bump]);

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
    async (query: string, objectTypeIds: string[]): Promise<GNode[]> => {
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.turn.search", { query }), async (turn) => {
        const payload = await client.searchInstances(query, turn, objectTypeIds);
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
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, loadMetas, message, runTurn, t],
  );

  const handleQuery = useCallback(
    async (otId: string, condition: KnCondition | null): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.turn.query", { ot: otName }), async (turn) => {
        const metas = await loadMetas([otId], turn);
        const meta = metas[otId] ?? { id: otId, name: otName, primaryKeys: [], properties: [] };
        const payload = await client.queryInstances(otId, condition, 50, turn);
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, runTurn, t],
  );

  const handleLocate = useCallback(
    async (otId: string, rawKey: string): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.browse.locateTurn", { ot: otName }), async (turn) => {
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
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, runTurn, t],
  );

  const handleBrowse = useCallback(
    async (otId: string, offset: number): Promise<GNode[]> => {
      const otName = detail?.object_types.find((item) => item.id === otId)?.name ?? otId;
      const page = Math.floor(offset / BROWSE_PAGE_SIZE) + 1;
      const nodes = await runTurn(t("knowledgeNetwork.graphExplorer.browse.turn", { ot: otName, page }), async (turn) => {
        const metas = await loadMetas([otId], turn);
        const meta = metas[otId] ?? { id: otId, name: otName, primaryKeys: [], properties: [] };
        const payload = await client.queryInstances(otId, null, BROWSE_PAGE_SIZE, turn, offset);
        return fromQueryObjectInstance(meta, payload, settingsRef.current.labelByOt[otId]);
      });
      if (nodes === undefined) throw new Error("");
      return nodes;
    },
    [client, detail, loadMetas, runTurn, t],
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
      <SearchPanel
        objectTypes={objectTypes}
        metaByOt={metaByOt}
        ensureMeta={ensureMeta}
        onSearch={handleSearch}
        onLocate={handleLocate}
        onQuery={handleQuery}
        onBrowse={handleBrowse}
        onAdd={handleAdd}
        canvasIds={canvasIds}
        disabled={disabled}
        colorOf={colorOf}
      />
      <div className={styles.main}>
        <ExplorerToolbar
          layout={settings.layout}
          shape={settings.shape}
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
    </div>
  );
}
