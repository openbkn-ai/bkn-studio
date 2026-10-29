/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AimOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  ExpandOutlined,
  NodeIndexOutlined,
  PauseOutlined,
  ReloadOutlined,
  StopOutlined,
  UpOutlined,
} from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Button,
  Dropdown,
  Segmented,
  Select,
  Spin,
  Tooltip,
  type MenuProps,
} from "antd";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHref, useLocation, useNavigate, useParams } from "react-router-dom";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { useAppServices } from "@/framework/context/use-app-services";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { extensionInstanceHandOvers } from "@/framework/extension/registry";
import { readReturnTo } from "@/modules/execution-factory/utils/back-navigation";
import {
  fetchKnDetailRest,
  type KnDetail,
  type McpAuth,
} from "@/modules/knowledge-network/services/context-loader.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";

import styles from "./GraphOverviewPage.module.css";
import { supportsGpuOverview, supportsWebGL } from "./gpu-support";
import type { OverviewCanvasHandle } from "./OverviewCanvas";
import { overviewSignature, readOverviewCache, writeOverviewCache } from "./overview-cache";
import {
  DEFAULT_LIMITS,
  loadOverview,
  type OverviewData,
  type OverviewProgress,
} from "./overview-loader";
import type { OverviewEdge, OverviewNode, OverviewRelation } from "./overview-queries";
import {
  createOverviewClient,
  friendlyError,
  type ObjectTypeMeta,
  type OverviewInstance,
} from "./overview.service";
import { compactCount, compactTotal } from "./compact-count";
import { OverviewNodeDrawer } from "./OverviewNodeDrawer";

// One engine per browser, so each is its own chunk: cosmos.gl and luma.gl alone are ~600 KB.
const ThreeCanvas = lazy(async () => ({ default: (await import("./ThreeCanvas")).ThreeCanvas }));
const CosmosCanvas = lazy(async () => ({ default: (await import("./CosmosCanvas")).CosmosCanvas }));
const OverviewCanvas = lazy(async () => ({
  default: (await import("./OverviewCanvas")).OverviewCanvas,
}));

const UNKNOWN_COLOR = "#8c8c8c";
/**
 * What the object type mapping fills in when the definition sets no colour. Taken as no colour:
 * a network whose types all carry it would otherwise be drawn in one blue.
 */
const UNSET_OBJECT_TYPE_COLOR = "#1677ff";
/** Colours for object types whose definition sets none, handed out in network order. */
const OBJECT_TYPE_PALETTE = [
  "#2e68ff",
  "#7c4dff",
  "#00b8a3",
  "#f5a623",
  "#eb5757",
  "#11a0d8",
  "#9b51e0",
  "#2bb673",
  "#d4380d",
  "#08979c",
  "#c41d7f",
  "#7cb305",
];
/** How often a load in progress redraws what has arrived. */
const PARTIAL_DRAW_MS = 400;
const SEARCH_OPTIONS = 20;
/** Relation types the neighbour summary lists before folding the rest. */
const SUMMARY_ROWS = 8;
const EMPTY_SET: ReadonlySet<string> = new Set();

type Phase = "meta" | "loading" | "ready" | "error";

/** Point budgets the toolbar offers. The CPU canvas (sigma) stops at ten thousand. */
const CPU_LIMIT_CHOICES = [1_000, 2_000, 5_000, 10_000];
/** The GPU canvas (cosmos.gl) goes to a hundred thousand. */
const GPU_LIMIT_CHOICES = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
/** Lines allowed per point: the World Cup sample ran at about two. */
const EDGES_PER_NODE = 3;
const NODE_LIMIT_KEY = "bkn-studio.graph-overview.node-limit";
const VIEW_KEY = "bkn-studio.graph-overview.view";
const TYPES_OPEN_KEY = "bkn-studio.graph-overview.types-open";

/** Whether the row of object types is shown: shown until someone closes it, then remembered. */
function readTypesOpen(): boolean {
  try {
    return window.localStorage.getItem(TYPES_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveTypesOpen(open: boolean) {
  try {
    window.localStorage.setItem(TYPES_OPEN_KEY, open ? "1" : "0");
  } catch {
    // Not remembered; the choice lasts for this visit.
  }
}
/** Points the 3D view draws at most: its layout runs on the CPU. The first ones loaded are kept. */
const THREE_D_MAX = 20_000;

type View = "2d" | "3d";

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

function saveView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

function readNodeLimit(choices: readonly number[]): number {
  try {
    const value = Number(window.localStorage.getItem(NODE_LIMIT_KEY));
    if (choices.includes(value)) return value;
  } catch {
    // Storage blocked: the default applies.
  }
  return DEFAULT_LIMITS.nodes;
}

function saveNodeLimit(value: number) {
  try {
    window.localStorage.setItem(NODE_LIMIT_KEY, String(value));
  } catch {
    // Not remembered; the choice still applies to this page.
  }
}

export function GraphOverviewScene() {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const { t } = useTranslation();
  const { message } = useAppServices();
  const runtimeConfig = useRuntimeConfig();
  const dark = useResolvedTheme() === "dark";
  // The page another build lets the selection be opened in, if any (see registry.ts). Read once:
  // registrations are frozen before the app mounts.
  const [handOverTarget] = useState(() => extensionInstanceHandOvers()[0]);
  const handOverHref = useHref(handOverTarget ? handOverTarget.path(networkId) : "/");
  const navigate = useNavigate();
  const location = useLocation();

  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  // Read the token manager through a ref: a new runtime config (a token refresh, say) must not
  // rebuild the client and read the network definition again under a loaded overview.
  const runtimeConfigRef = useRef(runtimeConfig);
  useEffect(() => {
    runtimeConfigRef.current = runtimeConfig;
  }, [runtimeConfig]);
  const auth = useMemo<McpAuth>(
    () => ({
      getToken: () => runtimeConfigRef.current.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfigRef.current.auth.tokenManager.refreshAccessToken(),
    }),
    [],
  );
  const client = useMemo(
    () => createOverviewClient({ base, token: "", knId: networkId }, auth),
    [auth, base, networkId],
  );

  const [phase, setPhase] = useState<Phase>("meta");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnDetail | null>(null);
  const [metas, setMetas] = useState<Record<string, ObjectTypeMeta>>({});
  const [data, setData] = useState<OverviewData | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [partial, setPartial] = useState<{
    nodes: OverviewNode[];
    edges: OverviewEdge[];
  }>({
    nodes: [],
    edges: [],
  });
  const [progress, setProgress] = useState<OverviewProgress | null>(null);
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [drawerNode, setDrawerNode] = useState<OverviewInstance | null>(null);
  /** Colours the object type definitions set, by object type. */
  const [definedColors, setDefinedColors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  // The GPU canvas where the browser can run it; everywhere else the CPU one, at smaller budgets.
  const [gpu] = useState(supportsGpuOverview);
  const [webgl] = useState(() => gpu || supportsWebGL());
  const [view, setView] = useState<View>(readView);
  const [typesOpen, setTypesOpen] = useState(readTypesOpen);
  const limitChoices = gpu ? GPU_LIMIT_CHOICES : CPU_LIMIT_CHOICES;
  const [nodeLimit, setNodeLimit] = useState(() => readNodeLimit(limitChoices));
  const limits = useMemo(
    () => ({ ...DEFAULT_LIMITS, nodes: nodeLimit, edges: nodeLimit * EDGES_PER_NODE }),
    [nodeLimit],
  );
  const canvasRef = useRef<OverviewCanvasHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  /* ------------------------------ network definition ------------------------------ */

  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    // Only before the first load: afterwards nothing would move the page out of this phase.
    if (!startedRef.current) setPhase("meta");
    void (async () => {
      try {
        const knDetail = await fetchKnDetailRest({ base, token: "", knId: networkId }, auth);
        const ids = knDetail.object_types.map((item) => item.id);
        const [loaded, definitions] = await Promise.all([
          client.loadObjectTypes(ids),
          // The display property and the colour live on the object type definition.
          Promise.all(
            ids.map((id) => getKnowledgeNetworkObjectTypeDetail(networkId, id).catch(() => null)),
          ),
        ]);
        if (cancelled) return;
        const displayKeyOf = new Map(ids.map((id, index) => [id, definitions[index]?.displayKey]));
        const colors: Record<string, string> = {};
        ids.forEach((id, index) => {
          const color = definitions[index]?.color.trim();
          if (color && color.toLowerCase() !== UNSET_OBJECT_TYPE_COLOR) colors[id] = color;
        });
        const next: Record<string, ObjectTypeMeta> = {};
        for (const meta of loaded)
          next[meta.id] = {
            ...meta,
            displayKey: displayKeyOf.get(meta.id) || undefined,
          };
        setDetail(knDetail);
        setMetas(next);
        setDefinedColors(colors);
      } catch (cause) {
        if (cancelled) return;
        setError(friendlyError(cause));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, base, client, networkId]);

  const objectTypes = useMemo(
    () => (detail?.object_types ?? []).filter((item) => metas[item.id]),
    [detail, metas],
  );
  const relations = useMemo<OverviewRelation[]>(
    () =>
      (detail?.relation_types ?? [])
        .filter((item) => item.id && item.sourceId && item.targetId)
        .map((item) => ({
          id: item.id,
          name: item.name?.trim() || item.id,
          sourceOtId: item.sourceId,
          targetOtId: item.targetId,
        })),
    [detail],
  );
  const relationNames = useMemo(
    () => new Map(relations.map((rel) => [rel.id, rel.name])),
    [relations],
  );
  const relationName = useCallback((id: string) => relationNames.get(id) ?? id, [relationNames]);
  const typeName = useCallback((otId: string) => metas[otId]?.name ?? otId, [metas]);
  /** The display property each object type's definition names, by object type. */
  const labels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, meta] of Object.entries(metas)) if (meta.displayKey) out[id] = meta.displayKey;
    return out;
  }, [metas]);

  /* ------------------------------ colours ------------------------------ */

  // The colour an object type's definition sets, as the ontology graph draws it; a type without
  // one takes a palette slot by its place in the network.
  const colorByOt = useMemo(() => {
    const out: Record<string, string> = {};
    let slot = 0;
    for (const item of objectTypes) {
      const defined = definedColors[item.id];
      if (defined) out[item.id] = defined;
      else {
        out[item.id] = OBJECT_TYPE_PALETTE[slot % OBJECT_TYPE_PALETTE.length];
        slot += 1;
      }
    }
    return out;
  }, [definedColors, objectTypes]);
  const colorOf = useCallback((otId: string) => colorByOt[otId] ?? UNKNOWN_COLOR, [colorByOt]);

  /* ------------------------------ loading ------------------------------ */

  const signature = useMemo(
    () =>
      overviewSignature({
        objectTypeIds: Object.keys(metas),
        relations,
        labels,
        limits,
      }),
    [labels, limits, metas, relations],
  );

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");
    setError(null);
    setData(null);
    setFromCache(false);
    setSelectedId(null);
    setPicked(EMPTY_SET);
    setPartial({ nodes: [], edges: [] });
    let latest: { nodes: OverviewNode[]; edges: OverviewEdge[] } | null = null;
    const flush = () => {
      if (latest) setPartial(latest);
      latest = null;
    };
    const timer = window.setInterval(flush, PARTIAL_DRAW_MS);
    try {
      const result = await loadOverview({
        metas,
        relations,
        labels,
        limits,
        runCypher: (query, signal) => client.runCypher(query.query, signal, query.parameters),
        signal: controller.signal,
        onProgress: setProgress,
        onPartial: (nodes, edges) => {
          latest = { nodes, edges };
        },
      });
      if (controller.signal.aborted) return;
      setData(result);
      setPartial({ nodes: result.nodes, edges: result.edges });
      setPhase("ready");
      void writeOverviewCache(networkId, { signature, data: result });
    } catch (cause) {
      if (controller.signal.aborted) {
        // Stopped by the user: what arrived stays on the canvas.
        flush();
        setPhase("ready");
        return;
      }
      setError(friendlyError(cause));
      setPhase("error");
    } finally {
      window.clearInterval(timer);
      setProgress(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [client, labels, limits, metas, networkId, relations, signature]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // A new budget is a new question: read again once the first load has started.
  const appliedLimitRef = useRef(nodeLimit);
  useEffect(() => {
    if (appliedLimitRef.current === nodeLimit || !startedRef.current) return;
    appliedLimitRef.current = nodeLimit;
    void load();
  }, [load, nodeLimit]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // First load: the copy from last time when it answers the same question, else a fresh read.
  useEffect(() => {
    if (startedRef.current || !detail || Object.keys(metas).length === 0) return;
    startedRef.current = true;
    void (async () => {
      const cached = await readOverviewCache(networkId);
      if (cached && cached.signature === signature) {
        setData(cached.data);
        setPartial({ nodes: cached.data.nodes, edges: cached.data.edges });
        setFromCache(true);
        setPhase("ready");
        return;
      }
      await load();
    })();
  }, [detail, load, metas, networkId, signature]);

  /* ------------------------------ derived ------------------------------ */

  // The 3D view draws a prefix of what is loaded: points arrive along relations, so it holds together.
  const shown = useMemo(() => {
    if (view !== "3d" || partial.nodes.length <= THREE_D_MAX) return partial;
    const nodes = partial.nodes.slice(0, THREE_D_MAX);
    const kept = new Set(nodes.map((node) => node.id));
    return {
      nodes,
      edges: partial.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target)),
    };
  }, [partial, view]);
  const shownPerType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of shown.nodes) counts.set(node.otId, (counts.get(node.otId) ?? 0) + 1);
    return counts;
  }, [shown.nodes]);
  const nodeById = useMemo(
    () => new Map(shown.nodes.map((node) => [node.id, node])),
    [shown.nodes],
  );
  const totals = useMemo(() => {
    if (!data) return null;
    return {
      nodes: Object.values(data.typeTotals),
      edges: Object.values(data.relationTotals),
    };
  }, [data]);

  /* ------------------------------ selection ------------------------------ */

  const neighbourhood = useCallback(
    (id: string) => {
      const ids = new Set([id]);
      for (const edge of shown.edges) {
        if (edge.source === id) ids.add(edge.target);
        if (edge.target === id) ids.add(edge.source);
      }
      return ids;
    },
    [shown.edges],
  );

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setPicked(EMPTY_SET);
  }, []);

  // The drawer reads the instance in full: the overview itself only holds keys and names.
  useEffect(() => {
    if (!selectedId) {
      setDrawerNode(null);
      return;
    }
    const node = nodeById.get(selectedId);
    const meta = node ? metas[node.otId] : undefined;
    if (!node || !meta) return;
    setDrawerNode({
      id: node.id,
      otId: node.otId,
      otName: meta.name,
      identity: node.identity,
      display: node.display,
      props: { ...node.identity },
    });
    let cancelled = false;
    void client
      .fetchInstance(meta, node.identity, labels[node.otId])
      .then((found) => {
        if (!cancelled && found) setDrawerNode({ ...found, id: node.id });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, labels, metas, nodeById, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedId(null);
      setPicked(EMPTY_SET);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** The selected point's neighbours by relation type, most first: a hub's lines are not named. */
  const neighbourSummary = useMemo(() => {
    if (!selectedId) return null;
    const byRelation = new Map<string, Set<string>>();
    const all = new Set<string>();
    for (const edge of shown.edges) {
      const other =
        edge.source === selectedId ? edge.target : edge.target === selectedId ? edge.source : null;
      if (other === null) continue;
      all.add(other);
      const set = byRelation.get(edge.relTypeId) ?? new Set<string>();
      set.add(other);
      byRelation.set(edge.relTypeId, set);
    }
    const rows = [...byRelation]
      .map(([relTypeId, ids]) => ({ relTypeId, count: ids.size }))
      .sort((a, b) => b.count - a.count);
    return { total: all.size, rows };
  }, [selectedId, shown.edges]);

  const handOverIds = useMemo(() => {
    if (picked.size > 0) return [...picked];
    if (selectedId) return [...neighbourhood(selectedId)];
    return [];
  }, [neighbourhood, picked, selectedId]);

  const handOver = useCallback(() => {
    if (!handOverTarget || handOverIds.length === 0) return;
    if (handOverIds.length > handOverTarget.maxInstances) {
      message.warning(
        t("knowledgeNetwork.graphOverview.handOver.tooMany", {
          limit: handOverTarget.maxInstances,
        }),
      );
      return;
    }
    const url = handOverTarget.url(`${base}${handOverHref}`, handOverIds, Object.keys(metas));
    window.open(url, "_blank", "noopener,noreferrer");
  }, [base, handOverHref, handOverIds, handOverTarget, message, metas, t]);

  /* ------------------------------ type chips ------------------------------ */

  const typeMenu = useCallback(
    (otId: string): MenuProps => ({
      items: [
        {
          key: "toggle",
          label: hiddenTypes.has(otId)
            ? t("knowledgeNetwork.graphOverview.types.show")
            : t("knowledgeNetwork.graphOverview.types.hide"),
        },
        { key: "only", label: t("knowledgeNetwork.graphOverview.types.only") },
        { key: "all", label: t("knowledgeNetwork.graphOverview.types.all") },
        { type: "divider" },
        {
          key: "pick",
          label: t("knowledgeNetwork.graphOverview.types.pick"),
          disabled: (shownPerType.get(otId) ?? 0) === 0,
        },
      ],
      onClick: ({ key }) => {
        if (key === "toggle") {
          const next = new Set(hiddenTypes);
          if (next.has(otId)) next.delete(otId);
          else next.add(otId);
          setHiddenTypes(next);
        } else if (key === "only") {
          setHiddenTypes(new Set(objectTypes.map((item) => item.id).filter((id) => id !== otId)));
        } else if (key === "all") {
          setHiddenTypes(EMPTY_SET);
        } else if (key === "pick") {
          setSelectedId(null);
          setPicked(
            new Set(shown.nodes.filter((node) => node.otId === otId).map((node) => node.id)),
          );
        }
      },
    }),
    [hiddenTypes, objectTypes, shown.nodes, shownPerType, t],
  );

  /* ------------------------------ search ------------------------------ */

  const searchOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const options: { value: string; label: string }[] = [];
    for (const node of shown.nodes) {
      if (hiddenTypes.has(node.otId) || !node.display.toLowerCase().includes(query)) continue;
      options.push({
        value: node.id,
        label: `${node.display} · ${typeName(node.otId)}`,
      });
      if (options.length >= SEARCH_OPTIONS) break;
    }
    return options;
  }, [hiddenTypes, search, shown.nodes, typeName]);

  /* ------------------------------ render ------------------------------ */

  const loading = phase === "loading";
  const Canvas = view === "3d" ? ThreeCanvas : gpu ? CosmosCanvas : OverviewCanvas;
  const summary = (() => {
    if (!totals) return null;
    if (data?.complete)
      return t("knowledgeNetwork.graphOverview.summary.complete", {
        nodes: compactCount(shown.nodes.length),
        edges: compactCount(shown.edges.length),
      });
    return t("knowledgeNetwork.graphOverview.summary.sampled", {
      nodes: compactCount(shown.nodes.length),
      totalNodes: compactTotal(totals.nodes, shown.nodes.length),
      edges: compactCount(shown.edges.length),
      totalEdges: compactTotal(totals.edges, shown.edges.length),
    });
  })();
  const failedNames = (data?.failures ?? []).map((failure) =>
    failure.kind === "relation" ? relationName(failure.id) : typeName(failure.id),
  );
  const handOverLimit = handOverTarget?.maxInstances ?? 0;
  const handOverTitle =
    handOverIds.length === 0
      ? t("knowledgeNetwork.graphOverview.handOver.empty")
      : handOverIds.length > handOverLimit
        ? t("knowledgeNetwork.graphOverview.handOver.tooMany", { limit: handOverLimit })
        : t("knowledgeNetwork.graphOverview.handOver.tip");

  return (
    <div className={styles.root} data-testid="graph-overview">
      <div className={styles.toolbar}>
        <Button
          size="small"
          icon={<ArrowLeftOutlined />}
          data-testid="graph-overview-back"
          // Back to the page the sidebar opened this from; a direct hit (a shared link) goes to the
          // network's overview. Not navigate(-1), which would leave the app then.
          onClick={() =>
            void navigate(
              readReturnTo(location.state) ??
                `/knowledge-network/workspace/${encodeURIComponent(networkId)}/overview`,
            )
          }
        >
          {t("knowledgeNetwork.graphOverview.back")}
        </Button>
        <div className={styles.title}>
          <span>{t("knowledgeNetwork.graphOverview.title")}</span>
          {detail?.name ? (
            <span className={styles.networkName} title={detail.name}>
              {detail.name}
            </span>
          ) : null}
        </div>
        {summary ? (
          <Tooltip
            // Cut short: why, on the counts themselves.
            title={
              data && !data.complete
                ? data.limitedBy === "edges"
                  ? t("knowledgeNetwork.graphOverview.summary.limitedByEdges", {
                      limit: compactCount(limits.edges),
                    })
                  : t("knowledgeNetwork.graphOverview.summary.limitedByNodes", {
                      limit: compactCount(limits.nodes),
                    })
                : summary
            }
          >
            <span className={styles.summary} data-testid="graph-overview-summary">
              {summary}
            </span>
          </Tooltip>
        ) : null}
        {fromCache && data
          ? (() => {
              const loadedAt = new Date(data.loadedAt);
              // The time alone today, with the date on other days; the full moment on hover.
              const today = loadedAt.toDateString() === new Date().toDateString();
              const time = loadedAt.toLocaleString(undefined, {
                ...(today ? {} : { month: "2-digit", day: "2-digit" }),
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <span className={styles.summary} title={loadedAt.toLocaleString()}>
                  {t("knowledgeNetwork.graphOverview.summary.cached", { time })}
                </span>
              );
            })()
          : null}
        <div className={styles.spacer} />
        {objectTypes.length > 0 ? (
          <Button
            size="small"
            // The arrow says where the row goes: down to open it, up to put it away.
            icon={typesOpen ? <UpOutlined /> : <DownOutlined />}
            iconPosition="end"
            aria-expanded={typesOpen}
            onClick={() => {
              saveTypesOpen(!typesOpen);
              setTypesOpen(!typesOpen);
            }}
            data-testid="graph-overview-types-toggle"
          >
            {hiddenTypes.size > 0
              ? t("knowledgeNetwork.graphOverview.types.toggleHidden", {
                  count: objectTypes.length,
                  hidden: hiddenTypes.size,
                })
              : t("knowledgeNetwork.graphOverview.types.toggle", { count: objectTypes.length })}
          </Button>
        ) : null}
        <Tooltip title={t("knowledgeNetwork.graphOverview.limit.tip")}>
          <Select
            size="small"
            style={{ width: 150 }}
            value={nodeLimit}
            disabled={phase === "meta"}
            onChange={(value: number) => {
              saveNodeLimit(value);
              setNodeLimit(value);
            }}
            options={limitChoices.map((value) => ({
              value,
              label: t("knowledgeNetwork.graphOverview.limit.option", {
                value: compactCount(value),
              }),
            }))}
            data-testid="graph-overview-limit"
          />
        </Tooltip>
        <AutoComplete
          style={{ width: 240 }}
          size="small"
          value={search}
          options={searchOptions}
          onChange={setSearch}
          onSelect={(id: string) => {
            setSearch("");
            setHiddenTypes((current) => {
              const otId = nodeById.get(id)?.otId;
              if (!otId || !current.has(otId)) return current;
              const next = new Set(current);
              next.delete(otId);
              return next;
            });
            select(id);
            canvasRef.current?.focus(id);
          }}
          placeholder={t("knowledgeNetwork.graphOverview.search")}
          disabled={shown.nodes.length === 0}
          data-testid="graph-overview-search"
        />
        {handOverTarget ? (
          <Tooltip title={handOverTitle}>
            <Button
              size="small"
              type="primary"
              icon={handOverTarget.icon ?? <NodeIndexOutlined />}
              disabled={handOverIds.length === 0 || handOverIds.length > handOverLimit}
              onClick={handOver}
              data-testid="graph-overview-hand-over"
            >
              {t(handOverTarget.labelKey, { count: handOverIds.length })}
            </Button>
          </Tooltip>
        ) : null}
        <Segmented
          size="small"
          value={view}
          disabled={!webgl}
          options={[
            { value: "2d", label: "2D" },
            { value: "3d", label: "3D" },
          ]}
          onChange={(value) => {
            const next = value === "3d" ? "3d" : "2d";
            saveView(next);
            setLayoutRunning(false);
            setView(next);
          }}
          data-testid="graph-overview-view"
        />
        {layoutRunning ? (
          <Button
            size="small"
            icon={<PauseOutlined />}
            onClick={() => canvasRef.current?.stopLayout()}
          >
            {t("knowledgeNetwork.graphOverview.layout.stop")}
          </Button>
        ) : (
          <Button
            size="small"
            icon={<AimOutlined />}
            disabled={shown.nodes.length === 0 || loading}
            onClick={() => canvasRef.current?.runLayout()}
          >
            {t("knowledgeNetwork.graphOverview.layout.run")}
          </Button>
        )}
        <Tooltip title={t("knowledgeNetwork.graphOverview.fit")}>
          <Button size="small" icon={<ExpandOutlined />} onClick={() => canvasRef.current?.fit()} />
        </Tooltip>
        {loading ? (
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={stop}
            data-testid="graph-overview-stop"
          >
            {t("knowledgeNetwork.graphOverview.stop")}
          </Button>
        ) : (
          <Button
            size="small"
            icon={<ReloadOutlined />}
            disabled={phase === "meta"}
            onClick={() => void load()}
            data-testid="graph-overview-reload"
          >
            {t("knowledgeNetwork.graphOverview.reload")}
          </Button>
        )}
      </div>

      {typesOpen && objectTypes.length > 0 ? (
        <div className={styles.types}>
          {objectTypes.map((item) => {
            const total = data?.typeTotals[item.id];
            const count = shownPerType.get(item.id) ?? 0;
            return (
              <Dropdown key={item.id} trigger={["click"]} menu={typeMenu(item.id)}>
                <button
                  type="button"
                  className={`${styles.typeChip} ${hiddenTypes.has(item.id) ? styles.typeChipHidden : ""}`}
                  data-testid={`graph-overview-type-${item.id}`}
                >
                  <span className={styles.typeDot} style={{ background: colorOf(item.id) }} />
                  <span>{metas[item.id]?.name ?? item.id}</span>
                  <span className={styles.typeCount}>
                    {total === undefined || total === null || total === count
                      ? compactCount(count)
                      : `${compactCount(count)} / ${compactCount(total)}`}
                  </span>
                </button>
              </Dropdown>
            );
          })}
        </div>
      ) : null}

      <div className={styles.body}>
        <div className={styles.stage}>
          {webgl ? (
            <Suspense fallback={null}>
              <Canvas
                key={view}
                ref={canvasRef}
                nodes={shown.nodes}
                edges={shown.edges}
                colorOf={colorOf}
                relationName={relationName}
                hiddenTypes={hiddenTypes}
                selectedId={selectedId}
                picked={picked}
                dark={dark}
                settled={phase === "ready"}
                onNodeClick={select}
                onStageClick={() => {
                  setSelectedId(null);
                  setPicked(EMPTY_SET);
                }}
                onBoxSelect={(ids) => {
                  setSelectedId(null);
                  setPicked(new Set(ids));
                }}
                onLayoutRunning={setLayoutRunning}
              />
            </Suspense>
          ) : null}
          {phase === "meta" ? (
            <div className={styles.center}>
              <Spin />
            </div>
          ) : null}
          <div className={styles.overlay}>
            {neighbourSummary && neighbourSummary.total > 0 ? (
              <div className={styles.progress} data-testid="graph-overview-neighbours">
                <div className={styles.neighboursTitle}>
                  {t("knowledgeNetwork.graphOverview.neighbours.title", {
                    name: nodeById.get(selectedId ?? "")?.display ?? "",
                    count: neighbourSummary.total,
                  })}
                </div>
                {neighbourSummary.rows.slice(0, SUMMARY_ROWS).map((row) => (
                  <div key={row.relTypeId} className={styles.neighboursRow}>
                    <span className={styles.neighboursName}>{relationName(row.relTypeId)}</span>
                    <span>{row.count}</span>
                  </div>
                ))}
                {neighbourSummary.rows.length > SUMMARY_ROWS ? (
                  <div className={styles.neighboursRow}>
                    {t("knowledgeNetwork.graphOverview.neighbours.more", {
                      count: neighbourSummary.rows.length - SUMMARY_ROWS,
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {loading && progress ? (
              <div className={styles.progress} data-testid="graph-overview-progress">
                {t("knowledgeNetwork.graphOverview.progress", {
                  nodes: progress.nodes,
                  edges: progress.edges,
                  current: progress.current
                    ? progress.current.kind === "relation"
                      ? relationName(progress.current.id)
                      : typeName(progress.current.id)
                    : t("knowledgeNetwork.graphOverview.counting"),
                })}
              </div>
            ) : null}
            {phase === "error" && error ? (
              <Alert
                type="error"
                showIcon
                message={t("knowledgeNetwork.graphOverview.failed")}
                description={error}
                action={
                  <Button size="small" onClick={() => void load()}>
                    {t("knowledgeNetwork.graphOverview.reload")}
                  </Button>
                }
              />
            ) : null}
            {phase === "ready" && failedNames.length > 0 ? (
              <Alert
                className={styles.notice}
                type="warning"
                showIcon
                closable
                message={t("knowledgeNetwork.graphOverview.partialFailureLine", {
                  count: failedNames.length,
                  names: failedNames.join("、"),
                })}
              />
            ) : null}
            {phase === "ready" && (data?.saturated?.length ?? 0) > 0 ? (
              <Alert
                className={styles.notice}
                type="info"
                showIcon
                closable
                message={t("knowledgeNetwork.graphOverview.saturatedLine", {
                  count: data?.saturated?.length ?? 0,
                  names: (data?.saturated ?? []).map(relationName).join("、"),
                })}
              />
            ) : null}
            {webgl ? null : (
              <Alert
                type="error"
                showIcon
                message={t("knowledgeNetwork.graphOverview.noWebgl")}
                data-testid="graph-overview-no-webgl"
              />
            )}
            {phase === "ready" && shown.nodes.length === 0 ? (
              <Alert type="info" showIcon message={t("knowledgeNetwork.graphOverview.empty")} />
            ) : null}
          </div>
          <div className={styles.hint}>
            {t(
              view === "3d"
                ? "knowledgeNetwork.graphOverview.hint3d"
                : "knowledgeNetwork.graphOverview.hint",
            )}
          </div>
        </div>
        {drawerNode ? (
          <OverviewNodeDrawer
            node={drawerNode}
            color={colorOf(drawerNode.otId)}
            properties={metas[drawerNode.otId]?.properties ?? []}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
