/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 知识网络「立即体验」—— ContextLoader 接口调试台 (agent-retrieval)。
 * 三个 Tab：Agent 对话 / REST 接口 / MCP 工具。REST 与 MCP 一一对应；发送为真实 HTTP 调用。
 */

import {
  ArrowLeftOutlined,
  CopyOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { App, Select, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { buildApiKeyPagePath, consumeApiKeyHandoff } from "@/modules/api-keys/utils/api-key-handoff";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  CONTEXT_LOADER_OPS,
  MCP_PATH,
  REST_CONTEXT_LOADER_OPS,
  REST_PREFIX,
  buildCurl,
  buildTestData,
  createMcpSession,
  exampleBodyText,
  fetchMcpObjectTypes,
  fetchKnDetail,
  fetchObjectInstances,
  pickQueryableObjectType,
  requestDataAssistantKindOf,
  listMcpTools,
  mcpPathOf,
  sendRequest,
  subgraphPathFor,
  type ContextLoaderEnv,
  type ContextLoaderMode,
  type ContextLoaderOp,
  type ContextLoaderResponse,
  type KnDetail,
  type KnObjectType,
  type KnRelationType,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import {
  createBknLifecycle,
  lifecycleEnv,
  memoryConversationStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { AgentChat } from "@/modules/knowledge-network/components/agent-chat/AgentChat";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import { ContextLoaderIntegrationPanel } from "./ContextLoaderIntegrationPanel";
import { DataBrowserPanel } from "./DataBrowserPanel";
import { McpSetupModal, ToolDiscoveryModal } from "./McpIntegrationModals";

import styles from "./ExperienceScene.module.css";

/** 线上有、本地无 op 定义的工具（如 get_object_types / get_relation_types）归到 Knowledge Network 组，不单开分类。 */
const ONLINE_GROUP = "Knowledge Network";

function sampleForSchemaProp(def: unknown): unknown {
  if (!def || typeof def !== "object") return "";
  const d = def as Record<string, unknown>;
  if (d.default !== undefined) return d.default;
  if (Array.isArray(d.enum) && d.enum.length > 0) return d.enum[0];
  switch (d.type) {
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

/** 从工具 inputSchema 生成示例请求体（含 required + kn_id/response_format），供合成 op 使用。 */
function exampleBodyFromSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const s = schema as Record<string, unknown>;
  const props = (s.properties && typeof s.properties === "object" ? s.properties : {}) as Record<string, unknown>;
  const required = Array.isArray(s.required) ? (s.required as string[]) : [];
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(props)) {
    if (required.includes(key) || key === "kn_id" || key === "response_format") {
      out[key] = sampleForSchemaProp(def);
    }
  }
  return out;
}

/** 把线上 MCP 工具（tools/list）合成为 ContextLoaderOp（本地无 op 定义时用）。 */
function synthesizeOp(tool: McpToolDef): ContextLoaderOp {
  const body = exampleBodyFromSchema(tool.inputSchema);
  return {
    id: tool.name,
    group: ONLINE_GROUP,
    summary: tool.description ?? tool.name,
    path: `${REST_PREFIX}/kn/${tool.name}`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body,
    mcpArgs: body,
  };
}

/** 从 MCP tools/call 信封里抽出 result.content[].text（TOON 或 JSON 文本载荷）。 */
function mcpContentTexts(obj: unknown): string[] | null {
  if (!obj || typeof obj !== "object") return null;
  const result = (obj as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return null;
  const content = (result as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;
  const texts = content
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : undefined))
    .filter((value): value is string => typeof value === "string");
  return texts.length > 0 ? texts : null;
}

export type ResponseView = { kind: "json" | "toon"; text: string };

/**
 * 响应展示视图：
 * - MCP 信封抽出 content 文本载荷——能 JSON.parse 的当 JSON 美化，否则当 TOON 纯文本（真换行）。
 * - 其余（REST / 非工具响应）按 JSON 美化；解析失败原样返回。
 * SSE（event:/data:）取最后一条 data。
 */
function formatResponseView(text: string): ResponseView {
  const dataLines = text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("data:"))
    .map((line) => line.replace(/^\s*data:/, "").trim())
    .filter(Boolean);
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1] : text;
  let obj: unknown;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return { kind: "toon", text };
  }
  const texts = mcpContentTexts(obj);
  if (texts) {
    const joined = texts.join("\n");
    try {
      return { kind: "json", text: JSON.stringify(JSON.parse(joined), null, 2) };
    } catch {
      return { kind: "toon", text: joined };
    }
  }
  return { kind: "json", text: JSON.stringify(obj, null, 2) };
}

/** 递归查找名为 key 且值为数组的属性（如嵌套在 search_scope 里的 concept_groups），返回该数组引用。 */
function findArrayProp(node: unknown, key: string): unknown[] | null {
  if (!node || typeof node !== "object") return null;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === key && Array.isArray(v)) return v as unknown[];
    if (v && typeof v === "object") {
      const found = findArrayProp(v, key);
      if (found) return found;
    }
  }
  return null;
}

/* ============================ JSON 语法高亮（无依赖，正则分词） ============================ */
function maskKey(value: string): string {
  const v = value.trim();
  return v.length <= 12 ? v : `${v.slice(0, 8)}****${v.slice(-4)}`;
}

function MaskedKeyInput({
  value,
  onChange,
  onManage,
  onCopy,
}: {
  value: string;
  onChange: (next: string) => void;
  onManage: () => void;
  onCopy: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={styles.keyField}>
      <input
        className={styles.keyInput}
        value={focused ? value : value ? maskKey(value) : ""}
        placeholder="粘贴 bak_ API Key"
        spellCheck={false}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
      />
      {value.trim() ? (
        <Tooltip title="复制 API Key 明文">
          <button type="button" className={styles.keyCopy} onClick={onCopy}>
            <CopyOutlined />
          </button>
        </Tooltip>
      ) : null}
      <button type="button" className={styles.keyManage} onClick={onManage}>
        签发 API Key
      </button>
    </div>
  );
}

/* ============================ MCP 接入指南（Claude Code / Cursor / 通用） ============================ */
type ExperienceSceneProps = {
  embedded?: boolean;
  initialMode?: ContextLoaderMode;
  lockMode?: boolean;
  showMcpConnect?: boolean;
};

export function ExperienceScene({
  embedded = false,
  initialMode = "agent",
  lockMode = false,
  showMcpConnect = false,
}: ExperienceSceneProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const runtimeConfig = useRuntimeConfig();
  const { message } = App.useApp();
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";
  const currentPath = `${location.pathname}${location.search}`;
  const apiKeyPagePath = buildApiKeyPagePath(currentPath);

  const copy = useCallback(
    (text: string, label = "已复制") => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => message.success(label))
        .catch(() => message.error("复制失败"));
    },
    [message],
  );

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [mode, setMode] = useState<ContextLoaderMode>(initialMode);
  const showModeTabs = !lockMode;
  const showEnvSettings = mode !== "agent" && !lockMode;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // 请求基址：走当前源（dev 经 vite 代理转后端，避免浏览器跨域）。
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://agent-retrieval:30779"));
  // 展示/接入指南用真实服务器（网关）地址：dev 取 VITE_DEV_AUTH_ORIGIN，prod 同源。
  const serverAddress = gatewayOrigin() || base;
  // 认证方式：OAuth 会话令牌（默认，每次现取避免过期）或用户从个人中心签发后粘贴的长期 API Key（bak_）。
  const sessionToken = runtimeConfig.auth.tokenManager.getAccessToken() ?? "";
  const [authMode, setAuthMode] = useState<"oauth" | "apikey">("oauth");
  const [appKey, setAppKey] = useState("");

  useEffect(() => {
    const key = consumeApiKeyHandoff(currentPath);
    if (!key) return;
    setAuthMode("apikey");
    setAppKey(key);
    message.success("已自动填入新签发的 API Key");
  }, [currentPath, message]);
  const token = authMode === "apikey" ? appKey.trim() : sessionToken;

  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState(CONTEXT_LOADER_OPS[0].id);
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [queryVals, setQueryVals] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<ContextLoaderResponse | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const requestSequenceRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const fillSequenceRef = useRef(0);
  const fillControllerRef = useRef<AbortController | null>(null);
  const [curlOpen, setCurlOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"res" | "data">("res");
  const [fillingTest, setFillingTest] = useState(false);
  const toolsSequenceRef = useRef(0);
  const toolsControllerRef = useRef<AbortController | null>(null);
  // 缓存当前网络的 schema，避免「填充测试数据」每次重拉；换网络时按 knId 失效。
  const knDetailRef = useRef<{ knId: string; detail: KnDetail } | null>(null);

  const invalidateRequest = useCallback(() => {
    requestSequenceRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setSending(false);
  }, []);

  const invalidateFill = useCallback(() => {
    fillSequenceRef.current += 1;
    fillControllerRef.current?.abort();
    fillControllerRef.current = null;
    setFillingTest(false);
  }, []);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
      fillControllerRef.current?.abort();
      toolsControllerRef.current?.abort();
    },
    [],
  );

  const selectOperation = useCallback(
    (operationId: string) => {
      invalidateRequest();
      invalidateFill();
      setSelectedId(operationId);
    },
    [invalidateFill, invalidateRequest],
  );

  const selectMode = useCallback(
    (nextMode: ContextLoaderMode) => {
      invalidateRequest();
      invalidateFill();
      setMode(nextMode);
    },
    [invalidateFill, invalidateRequest],
  );

  useEffect(() => {
    if (!id) {
      setNetwork(null);
      return;
    }

    let cancelled = false;
    getKnowledgeNetwork(id)
      .then((record) => {
        if (!cancelled && record) {
          setNetwork({ name: record.name, slug: record.identifier });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const knId = network?.slug ?? "kn_legal";
  const currentKnIdRef = useRef(knId);
  currentKnIdRef.current = knId;
  const env: ContextLoaderEnv = useMemo(
    () => ({ base, token, knId }),
    [base, token, knId],
  );

  // Agent 对话用：每请求取新鲜 token、401 时刷新（OAuth 自动续期，避免长对话/长循环 token 过期断掉）。
  // 检索工具（agent-retrieval）按所选认证方式：OAuth 会话或 bak_ AppKey。
  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () =>
        authMode === "apikey" ? appKey.trim() : runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () =>
        authMode === "apikey"
          ? Promise.resolve(appKey.trim() || null)
          : runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [authMode, appKey, runtimeConfig],
  );
  /**
   * 调试台的受管生命周期。这里不是对话，一次「发送请求」/「填充测试数据」就是一轮交互；
   * 会话本身按本次进入调试台算一条，刷新即换新（memory 键），不写 localStorage。
   */
  const lifecycle = useMemo(
    () => createBknLifecycle(lifecycleEnv(base, knId), tokenProvider, { conversationStore: memoryConversationStore() }),
    [base, knId, tokenProvider],
  );

  // 大模型（mf-model-api）不认 bak_ AppKey（AppKey 仅对 Context Loader 有效）→ 恒用 OAuth 会话 token，
  // 否则认证方式切到 API Key 后模型第一步就 401。
  const modelTokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );

  // tools/list 发现结果缓存：MCP 侧栏实时驱动 + 内联 schema + 工具发现弹窗共用。
  const [toolDefs, setToolDefs] = useState<McpToolDef[] | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  useEffect(() => {
    toolsSequenceRef.current += 1;
    toolsControllerRef.current?.abort();
    toolsControllerRef.current = null;
    setToolDefs(null);
    setToolsError(null);
    setToolsLoading(false);
  }, [knId]);
  const loadTools = useCallback(
    (force = false) => {
      if (toolsLoading) return;
      if (!force && toolDefs) return;
      const sequence = ++toolsSequenceRef.current;
      toolsControllerRef.current?.abort();
      const controller = new AbortController();
      toolsControllerRef.current = controller;
      const requestKnId = knId;
      setToolsLoading(true);
      setToolsError(null);
      listMcpTools(env, tokenProvider, controller.signal)
        .then((list) => {
          if (sequence === toolsSequenceRef.current && requestKnId === currentKnIdRef.current) setToolDefs(list);
        })
        .catch((err) => {
          if (sequence === toolsSequenceRef.current && requestKnId === currentKnIdRef.current && !controller.signal.aborted) {
            setToolsError(err instanceof Error ? err.message : "tools/list 失败");
          }
        })
        .finally(() => {
          if (sequence === toolsSequenceRef.current) {
            toolsControllerRef.current = null;
            setToolsLoading(false);
          }
        });
    },
    [env, knId, toolDefs, toolsLoading, tokenProvider],
  );
  // 进入 MCP 模式时按需拉一次（同源 fetch，失败仅内联提示，不弹全局 toast）。
  useEffect(() => {
    if (mode === "mcp" && !toolDefs && !toolsLoading && !toolsError) loadTools();
  }, [mode, toolDefs, toolsLoading, toolsError, loadTools]);

  // MCP 模式接口列表实时由 tools/list 驱动：线上每个工具用本地 op（若有），否则从 inputSchema 合成，后端加工具自动出现，零漂移。
  const mcpOps = useMemo<ContextLoaderOp[]>(
    () =>
      toolDefs
        ? toolDefs.map((t) => CONTEXT_LOADER_OPS.find((o) => o.id === t.name) ?? synthesizeOp(t))
        : CONTEXT_LOADER_OPS,
    [toolDefs],
  );
  const activeOps = mode === "mcp" ? mcpOps : REST_CONTEXT_LOADER_OPS;
  const op = useMemo(
    () => activeOps.find((item) => item.id === selectedId) ?? activeOps[0] ?? null,
    [activeOps, selectedId],
  );
  // selectedId 在当前模式的工具集里失效时（切模式 / 只在另一侧存在）回退到首项，保持侧栏高亮一致。
  useEffect(() => {
    if (activeOps.length > 0 && !activeOps.some((item) => item.id === selectedId)) setSelectedId(activeOps[0].id);
  }, [activeOps, selectedId]);

  // 选中接口 / 模式 / 网络变化时重置请求体与 query 默认值
  useEffect(() => {
    invalidateRequest();
    invalidateFill();
    if (!op) {
      setBodyText("");
      setBodyError(null);
      setQueryVals({});
      setResponse(null);
      setReqError(null);
      return;
    }
    setBodyText(exampleBodyText(op, mode, knId));
    setBodyError(null);
    const next: Record<string, string> = {};
    op.query.forEach((param) => {
      next[param.name] = param.name === "kn_id" ? knId : param.value;
    });
    setQueryVals(next);
    setResponse(null);
    setReqError(null);
  }, [op, mode, knId, invalidateFill, invalidateRequest]);

  /**
   * cURL 展示真实网关地址（终端可直接跑，无浏览器跨域顾虑）；请求本体仍走 env.base 代理。
   * bkn_context 用占位串而不是本页真实 id：受管交互一轮一开、终结后即失效，把当下这轮的
   * id 复制出去，粘到终端时多半已经是 interaction_terminal。占位符至少说清了必须先建会话。
   */
  const curl = useMemo(
    () =>
      op
        ? buildCurl({ ...env, base: serverAddress }, op, mode, queryVals, bodyText, {
            conversation_id: "<bkn_start_interaction 返回的 conversation_id>",
            interaction_id: "<bkn_start_interaction 返回的 interaction_id>",
          })
        : "",
    [env, serverAddress, op, mode, queryVals, bodyText],
  );

  const displayPath = op ? (mode === "mcp" ? mcpPathOf(op) : op.path) : "";
  // MCP 没有 query；但 response_format 必须可调（注入进 arguments），故 MCP 也露出这一项。
  const visibleQuery = op ? (mode === "rest" ? op.query : op.query.filter((param) => param.name === "response_format")) : [];
  const responseView = useMemo(() => (response ? formatResponseView(response.text) : null), [response]);

  const currentTool = useMemo(
    () => (op ? toolDefs?.find((tool) => tool.name === op.id) ?? null : null),
    [toolDefs, op],
  );

  const onSend = useCallback(async () => {
    if (!op) return;
    if (op.body !== null) {
      try {
        JSON.parse(bodyText || "{}");
        setBodyError(null);
      } catch (error) {
        setBodyError(error instanceof Error ? error.message : "JSON 解析失败");
        return;
      }
    }
    setRightTab("res"); // 发送即切回响应视图，免得停在数据浏览器看不到结果
    const requestSequence = ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setSending(true);
    setResponse(null);
    setReqError(null);
    try {
      // OAuth：发送时再取一次最新会话令牌（可能已刷新）；API Key：用粘贴的长期 key。
      const freshToken =
        authMode === "apikey" ? appKey.trim() : runtimeConfig.auth.tokenManager.getAccessToken() ?? env.token;
      const freshEnv = { ...env, token: freshToken };
      // 传 tokenProvider：401（token 过期）时刷新一次再重跑，不用手动重试。
      // 一次点击 = 一轮受管交互：业务调用没有 bkn_context 会被 Context Loader 直接挡回。
      const result = await withManagedTurn(
        lifecycle,
        `调试台调用 ${op.id}`,
        async (turn) => {
          const sent = await sendRequest(
            freshEnv,
            op,
            mode,
            queryVals,
            bodyText,
            tokenProvider,
            controller.signal,
            turn?.nextContext(),
          );
          return sent;
        },
        // 业务返回 500 时这一轮仍算 completed —— 调用失败记在 Operation 的 Receipt 上
        // （Core 已判 failed），Interaction 状态表达的是调用方这一轮走完了没有。
        (sent) => `HTTP ${sent.status} · ${sent.sizeBytes}B`,
      );
      if (requestSequence !== requestSequenceRef.current) return;
      setResponse(result);
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current || controller.signal.aborted) return;
      setReqError(error instanceof Error ? error.message : "请求失败（可能是跨域或服务不可达）");
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        requestControllerRef.current = null;
        setSending(false);
      }
    }
  }, [env, op, mode, queryVals, bodyText, runtimeConfig, authMode, appKey, tokenProvider, lifecycle]);

  // 一键填充测试数据：用当前网络真实 schema + 样本行生成可直接发送的请求体。
  const onFillTestData = useCallback(async () => {
    if (!op) return;
    const fillSequence = ++fillSequenceRef.current;
    fillControllerRef.current?.abort();
    const controller = new AbortController();
    fillControllerRef.current = controller;
    setFillingTest(true);
    try {
      // 取真实 schema / 样本行同样走 /kn/*，一次填充算一轮交互，两次取数共用它。
      const fill = await withManagedTurn(lifecycle, `填充 ${op.id} 测试数据`, async (turn) => {
        const detail =
          knDetailRef.current?.knId === knId
            ? knDetailRef.current.detail
            : await fetchKnDetail(env, tokenProvider, controller.signal, turn ?? undefined);
        if (fillSequence !== fillSequenceRef.current) return null;
        knDetailRef.current = { knId, detail };

        let ot: KnObjectType | null = null;
        let sampleRow: Record<string, unknown> | null = null;
        if (op.id === "query_object_instance" || op.id === "run_sql") {
          ot = pickQueryableObjectType(detail);
          if (!ot) {
            message.warning("当前知识网络没有绑定数据资源的对象类型，无法生成测试数据");
            return null;
          }
        }
        if (op.id === "query_metric") {
          const metricOwner = detail.object_types.find((item) => (item.related_metric_count ?? 0) > 0) ?? detail.object_types[0];
          if (!metricOwner) {
            message.warning("当前知识网络没有对象类，无法生成指标测试数据");
            return null;
          }
          const objectTypes = await fetchMcpObjectTypes(
            createMcpSession(env, tokenProvider),
            knId,
            [metricOwner.id],
            turn ?? undefined,
          );
          if (fillSequence !== fillSequenceRef.current) return null;
          ot = objectTypes.find((item) => item.id === metricOwner.id) ?? objectTypes[0] ?? null;
          if (!ot?.related_metrics?.length) {
            message.warning(`对象类 ${metricOwner.name || metricOwner.id} 没有可用指标，无法生成测试数据`);
            return null;
          }
        }
        if (op.id === "query_object_instance" && ot) {
          const rows = await fetchObjectInstances(env, ot.id, 1, tokenProvider, controller.signal, turn ?? undefined);
          if (fillSequence !== fillSequenceRef.current) return null;
          sampleRow = rows[0] ?? null;
        }
        return buildTestData(op, mode, knId, detail, ot, sampleRow);
      });
      if (!fill || fillSequence !== fillSequenceRef.current) return;
      setBodyText(fill.body);
      setBodyError(null);
      if (fill.query) setQueryVals((prev) => ({ ...prev, ...fill.query }));
      message.success(fill.note ? `已填充测试数据 · ${fill.note}` : "已填充测试数据");
    } catch (error) {
      if (fillSequence !== fillSequenceRef.current || controller.signal.aborted) return;
      message.error(error instanceof Error ? error.message : "生成测试数据失败");
    } finally {
      if (fillSequence === fillSequenceRef.current) {
        fillControllerRef.current = null;
        setFillingTest(false);
      }
    }
  }, [env, op, mode, knId, message, tokenProvider, lifecycle]);

  // 当前接口是否按对象类型取数（决定数据浏览器卡片是否露出「填入测试请求」）。
  const opFillsFromObjectType = op?.id === "query_object_instance" || op?.id === "run_sql";

  // 数据浏览器卡片「填入测试请求」：用指定对象类型的真实样本行填当前接口（用户选实体，不再随机取第一个）。
  const fillTestFromObjectType = useCallback(
    async (ot: KnObjectType) => {
      if (!op) return;
      try {
        if (op.id === "run_sql" && !ot.data_source?.id) {
          message.warning("该对象类型未绑定数据资源，无法生成 SQL 测试数据");
          return;
        }
        let sampleRow: Record<string, unknown> | null = null;
        if (op.id === "query_object_instance") {
          const rows = await withManagedTurn(lifecycle, `取 ${ot.id} 样本行`, (turn) =>
            fetchObjectInstances(env, ot.id, 1, tokenProvider, undefined, turn ?? undefined),
          );
          sampleRow = rows[0] ?? null;
        }
        const detail = knDetailRef.current?.detail ?? { id: knId, object_types: [], concept_groups: [], relation_types: [] };
        const fill = buildTestData(op, mode, knId, detail, ot, sampleRow);
        setBodyText(fill.body);
        setBodyError(null);
        if (fill.query) setQueryVals((prev) => ({ ...prev, ...fill.query }));
        message.success(`已用 ${ot.name || ot.id} 填充测试请求${fill.note ? ` · ${fill.note}` : ""}`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "生成测试数据失败");
      }
    },
    [env, op, mode, knId, message, tokenProvider, lifecycle],
  );

  // 数据浏览器关系卡「填入子图」：用指定关系类拼 query_instance_subgraph 的 relation_type_paths。
  const fillSubgraphFromRelation = useCallback(
    (rel: KnRelationType) => {
      const path = subgraphPathFor(rel);
      const body = mode === "mcp" ? { kn_id: knId, relation_type_paths: [path] } : { relation_type_paths: [path] };
      setBodyText(JSON.stringify(body, null, 2));
      setBodyError(null);
      if (mode === "rest") setQueryVals((prev) => ({ ...prev, kn_id: knId }));
      message.success(`已填入子图路径 · ${rel.name || rel.id}`);
    },
    [mode, knId, message],
  );

  // 数据浏览器「填入」：字段可能是 REST 的 query 参数（如 query_object_instance 的 ot_id），
  // 也可能在请求体里（如 MCP 的 arguments）。按实际位置填，落不到则复制兜底。
  const fillBodyField = useCallback(
    (key: string, value: string) => {
      if (!op) return;
      // 1) 当前接口把该字段作为 REST query 参数 → 填 query
      if (mode === "rest" && op.query.some((param) => param.name === key)) {
        setQueryVals((prev) => ({ ...prev, [key]: value }));
        message.success(`已填入 ${key}`);
        return;
      }
      // 2) 否则写进请求体 JSON
      try {
        const obj: unknown = JSON.parse(bodyText || "{}");
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          (obj as Record<string, unknown>)[key] = value;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(`已填入 ${key}`);
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(value, `已复制（当前接口无 ${key} 字段，可手动粘贴）`);
    },
    [mode, op, bodyText, copy, message],
  );

  const fillResource = useCallback(
    (resourceId: string) => {
      // 后端 SQL 表名占位需前导点：{{.<data_source.id>}}（无点会被当作裸表名报错）。
      const token = `{{.${resourceId}}}`;
      try {
        const obj = JSON.parse(bodyText || "{}") as Record<string, unknown>;
        if (obj && typeof obj === "object" && typeof obj.sql === "string") {
          obj.sql = /\{\{[^}]*\}\}/.test(obj.sql)
            ? obj.sql.replace(/\{\{[^}]*\}\}/, token)
            : `SELECT * FROM ${token} LIMIT 20`;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success("资源已填入 SQL");
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(token, "已复制资源占位");
    },
    [bodyText, copy, message],
  );

  // 资源组（concept_group）→ 加入请求体的 concept_groups 数组（可能嵌套在 search_scope 下）。
  const fillConceptGroup = useCallback(
    (groupId: string) => {
      try {
        const obj: unknown = JSON.parse(bodyText || "{}");
        const arr = findArrayProp(obj, "concept_groups");
        if (arr) {
          if (!arr.includes(groupId)) arr.push(groupId);
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(`已加入资源组 ${groupId}`);
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(groupId, `已复制资源组 ${groupId}（当前接口无 concept_groups）`);
    },
    [bodyText, copy, message],
  );

  return (
    <section className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`}>
      {showModeTabs || showEnvSettings ? (
      <div className={styles.topbar}>
        {!embedded && network ? (
          <button type="button" className={styles.back} onClick={() => void navigate(`/knowledge-network/workspace/${id}/overview`)}>
            <ArrowLeftOutlined /> 返回 {network.name}
          </button>
        ) : null}
        {showModeTabs ? (
        <div className={styles.tabs}>
          {(["agent", "mcp", "rest"] as ContextLoaderMode[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.tab} ${mode === value ? styles.tabActive : ""}`}
              onClick={() => selectMode(value)}
            >
              {value === "agent" ? "Agent 对话" : value === "rest" ? "REST 接口" : "MCP 工具"}
            </button>
          ))}
        </div>
        ) : null}
        {showEnvSettings ? (
        <div className={styles.envset}>
          <div className={styles.ef}>
            <label>知识网络 kn_id</label>
            <div className={styles.knLock}>
              <KeyOutlined />
              <span className={styles.knName}>{network?.name ?? "—"}</span>
              <span className={styles.knSlug}>{knId}</span>
            </div>
          </div>
          <div className={styles.ef}>
            <label>服务地址</label>
            <div
              className={styles.addr}
              title={mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            >
              {mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            </div>
          </div>
          <div className={styles.ef}>
            <label>
              认证方式
              <Tooltip title="OAuth Token：使用当前登录态（短期，仅本页调试）。API Key：在个人中心签发长期 bak_ Key 后粘贴到此处，仅对 Context Loader 有效。">
                <QuestionCircleOutlined className={styles.hintIcon} />
              </Tooltip>
            </label>
            <Select
              className={styles.authSelect}
              value={authMode}
              onChange={setAuthMode}
              options={[
                { value: "oauth", label: "OAuth Token" },
                { value: "apikey", label: "API Key" },
              ]}
            />
          </div>
          {authMode === "apikey" ? (
            <div className={styles.ef}>
              <label>API Key</label>
              <MaskedKeyInput
                value={appKey}
                onChange={setAppKey}
                onManage={() => void navigate(apiKeyPagePath)}
                onCopy={() => copy(appKey.trim(), "API Key 已复制")}
              />
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
      ) : null}

      {mode === "agent" ? (
        <AgentChat
          key={env.knId}
          env={env}
          networkName={network?.name}
          tokenProvider={tokenProvider}
          modelTokenProvider={modelTokenProvider}
        />
      ) : (
        <ContextLoaderIntegrationPanel
          mode={mode}
          knId={knId}
          activeOps={activeOps}
          op={op}
          selectedId={selectedId}
          onSelectOp={selectOperation}
          filter={filter}
          onFilterChange={setFilter}
          visibleQuery={visibleQuery}
          queryVals={queryVals}
          onQueryChange={(name, value) => setQueryVals((prev) => ({ ...prev, [name]: value }))}
          bodyText={bodyText}
          onBodyTextChange={setBodyText}
          bodyError={bodyError}
          onFormatBody={() => {
            try {
              setBodyText(JSON.stringify(JSON.parse(bodyText), null, 2));
              setBodyError(null);
            } catch (error) {
              setBodyError(error instanceof Error ? error.message : "JSON ????");
            }
          }}
          displayPath={displayPath}
          response={response}
          responseView={responseView}
          reqError={reqError}
          sending={sending}
          onSend={() => void onSend()}
          onResetBody={() => op && setBodyText(exampleBodyText(op, mode, knId))}
          fillingTest={fillingTest}
          onFillTestData={() => void onFillTestData()}
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          curlOpen={curlOpen}
          onCurlOpenChange={setCurlOpen}
          curl={curl}
          onCopy={copy}
          toolDefs={toolDefs}
          toolsLoading={toolsLoading}
          toolsError={toolsError}
          currentTool={currentTool}
          onReloadTools={() => loadTools(true)}
          mcpUrl={`${serverAddress}${MCP_PATH}`}
          appKeyValue={appKey.trim()}
          showMcpConnect={showMcpConnect}
          dataBrowserPanel={
            <DataBrowserPanel
              active={rightTab === "data"}
              env={env}
              assistantKind={op ? requestDataAssistantKindOf(op.id) : null}
              onFillField={fillBodyField}
              onFillResource={fillResource}
              onFillConceptGroup={fillConceptGroup}
              onFillTest={opFillsFromObjectType ? fillTestFromObjectType : undefined}
              onFillRelation={op?.id === "query_instance_subgraph" ? fillSubgraphFromRelation : undefined}
              copy={copy}
              auth={tokenProvider}
            />
          }
        />
      )}

      <McpSetupModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        mcpUrl={`${serverAddress}${MCP_PATH}`}
        onManageApiKey={() => void navigate(apiKeyPagePath)}
        copy={copy}
      />
      <ToolDiscoveryModal
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        tools={toolDefs}
        loading={toolsLoading}
        error={toolsError}
        onReload={() => loadTools(true)}
        copy={copy}
      />
    </section>
  );
}
