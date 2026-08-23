/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Knowledge Network experience console for ContextLoader (agent-retrieval).
 * Tabs: Agent chat, REST APIs, and MCP tools. REST and MCP map one-to-one.
 */

import {
  ArrowLeftOutlined,
  CopyOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { App, Select, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  formatPrecisionSafeJSON,
  parsePrecisionSafeJSON,
} from "@/framework/request/precision-safe-json";
import { buildApiKeyPagePath, consumeApiKeyHandoff } from "@/modules/api-keys/utils/api-key-handoff";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  CONTEXT_LOADER_OPS,
  MCP_PATH,
  REST_CONTEXT_LOADER_OPS,
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
  synthesizeOp,
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
  LIFECYCLE_TOOL_NAMES,
  createBknLifecycle,
  lifecycleEnv,
  memoryConversationStore,
  withManagedTurn,
  type BknTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { AgentChat } from "@/modules/knowledge-network/components/agent-chat/AgentChat";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import { ContextLoaderIntegrationPanel } from "./ContextLoaderIntegrationPanel";
import { DataBrowserPanel } from "./DataBrowserPanel";
import { McpSetupModal, ToolDiscoveryModal } from "./McpIntegrationModals";

import styles from "./ExperienceScene.module.css";

/** Extracts result.content[].text from an MCP tools/call envelope. */
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
 * Response display view:
 * - MCP envelopes use content text; parseable JSON is formatted, otherwise shown as TOON text.
 * - REST and non-tool responses are formatted as JSON when possible.
 * - SSE responses use the last data line.
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
    obj = parsePrecisionSafeJSON(candidate);
  } catch {
    return { kind: "toon", text };
  }
  const texts = mcpContentTexts(obj);
  if (texts) {
    const joined = texts.join("\n");
    try {
      return { kind: "json", text: formatPrecisionSafeJSON(joined) };
    } catch {
      return { kind: "toon", text: joined };
    }
  }
  return { kind: "json", text: formatPrecisionSafeJSON(candidate) };
}

/** Recursively finds an array property by key, such as nested concept_groups. */
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

/* ============================ JSON Syntax Highlighting ============================ */
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
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  return (
    <div className={styles.keyField}>
      <input
        className={styles.keyInput}
        value={focused ? value : value ? maskKey(value) : ""}
        placeholder={t("knowledgeNetwork.contextLoaderPanel.experience.apiKeyPlaceholder")}
        spellCheck={false}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
      />
      {value.trim() ? (
        <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.experience.copyApiKeyPlain")}>
          <button type="button" className={styles.keyCopy} onClick={onCopy}>
            <CopyOutlined />
          </button>
        </Tooltip>
      ) : null}
      <button type="button" className={styles.keyManage} onClick={onManage}>
        {t("knowledgeNetwork.contextLoaderPanel.experience.issueApiKey")}
      </button>
    </div>
  );
}

/* ============================ MCP Setup Guide ============================ */
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
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();
  const { message } = App.useApp();
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";
  const currentPath = `${location.pathname}${location.search}`;
  const apiKeyPagePath = buildApiKeyPagePath(currentPath);

  const copy = useCallback(
    (text: string, label?: string) => {
      void writeTextToClipboard(text)
        .then(() =>
          message.success(
            label ?? t("knowledgeNetwork.contextLoaderPanel.experience.copied"),
          ),
        )
        .catch(() =>
          message.error(t("knowledgeNetwork.contextLoaderPanel.experience.copyFailed")),
        );
    },
    [message, t],
  );

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [mode, setMode] = useState<ContextLoaderMode>(initialMode);
  const showModeTabs = !lockMode;
  const showEnvSettings = mode !== "agent" && !lockMode;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Request base: same-origin so dev can use Vite proxy and avoid browser CORS.
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://agent-retrieval:30779"));
  // Display/setup guide uses the real gateway origin.
  const serverAddress = gatewayOrigin() || base;
  // Auth mode: OAuth session token by default, or pasted long-lived bak_ API Key.
  const sessionToken = runtimeConfig.auth.tokenManager.getAccessToken() ?? "";
  const [authMode, setAuthMode] = useState<"oauth" | "apikey">("oauth");
  const [appKey, setAppKey] = useState("");

  useEffect(() => {
    const key = consumeApiKeyHandoff(currentPath);
    if (!key) return;
    setAuthMode("apikey");
    setAppKey(key);
    message.success(t("knowledgeNetwork.contextLoaderPanel.experience.apiKeyAutoFilled"));
  }, [currentPath, message, t]);
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
  // Cache current KN schema so filling test data does not refetch every time.
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

  // Agent chat uses fresh OAuth tokens per request and refreshes once after 401.
  // Retrieval tools use selected auth mode: OAuth session or bak_ AppKey.
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
   * Managed lifecycle for the console. This is not chat: each Send Request or
   * Fill Test Data action is one interaction. Memory store resets on refresh.
   */
  const lifecycle = useMemo(
    () => createBknLifecycle(lifecycleEnv(base, knId), tokenProvider, { conversationStore: memoryConversationStore() }),
    [base, knId, tokenProvider],
  );

  // mf-model-api does not accept bak_ AppKey, so model calls always use OAuth.
  const modelTokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );

  // tools/list cache shared by MCP sidebar, inline schema, and discovery modal.
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
            setToolsError(
              err instanceof Error
                ? err.message
                : t("knowledgeNetwork.contextLoaderPanel.experience.toolsListFailed"),
            );
          }
        })
        .finally(() => {
          if (sequence === toolsSequenceRef.current) {
            toolsControllerRef.current = null;
            setToolsLoading(false);
          }
        });
    },
    [env, knId, t, toolDefs, toolsLoading, tokenProvider],
  );
  // Fetch once when entering MCP mode; failures are shown inline only.
  useEffect(() => {
    if (mode === "mcp" && !toolDefs && !toolsLoading && !toolsError) loadTools();
  }, [mode, toolDefs, toolsLoading, toolsError, loadTools]);

  // MCP op list is driven by tools/list: use local ops when available, otherwise synthesize from inputSchema.
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
  // Fall back to the first op when selectedId is invalid for the current mode.
  useEffect(() => {
    if (activeOps.length > 0 && !activeOps.some((item) => item.id === selectedId)) setSelectedId(activeOps[0].id);
  }, [activeOps, selectedId]);

  // Reset request body and query defaults when selected op, mode, or network changes.
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
   * cURL displays the real gateway address for terminal use, while in-page calls
   * still use env.base. bkn_context uses placeholders because per-turn ids expire
   * after the managed interaction finishes.
   */
  const curl = useMemo(
    () =>
      op
        ? buildCurl({ ...env, base: serverAddress }, op, mode, queryVals, bodyText, {
            conversation_id: "<conversation_id returned by bkn_start_interaction>",
            interaction_id: "<interaction_id returned by bkn_start_interaction>",
          })
        : "",
    [env, serverAddress, op, mode, queryVals, bodyText],
  );

  const displayPath = op ? (mode === "mcp" ? mcpPathOf(op) : op.path) : "";
  // MCP has no query string, but response_format is still configurable through arguments.
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
        setBodyError(
          error instanceof Error
            ? error.message
            : t("knowledgeNetwork.contextLoaderPanel.experience.jsonParseFailed"),
        );
        return;
      }
    }
    setRightTab("res"); // Return to response view after sending.
    const requestSequence = ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setSending(true);
    setResponse(null);
    setReqError(null);
    try {
      // OAuth reads the latest session token at send time; API Key uses the pasted long-lived key.
      const freshToken =
        authMode === "apikey" ? appKey.trim() : runtimeConfig.auth.tokenManager.getAccessToken() ?? env.token;
      const freshEnv = { ...env, token: freshToken };
      const send = (turn: BknTurn | null = null) =>
        sendRequest(freshEnv, op, mode, queryVals, bodyText, tokenProvider, controller.signal, turn?.nextContext());
      // Lifecycle tools are entered directly by the debugger. Wrapping them would
      // recursively create a turn and inject a bkn_context that their schema rejects.
      const result = LIFECYCLE_TOOL_NAMES.has(op.id)
        ? await send()
        : await withManagedTurn(
            lifecycle,
            t("knowledgeNetwork.contextLoaderPanel.experience.debugTurn", { id: op.id }),
            send,
            // Even if the business call returns 500, this interaction completed from the caller side.
            (sent) => `HTTP ${sent.status} · ${sent.sizeBytes}B`,
          );
      if (requestSequence !== requestSequenceRef.current) return;
      setResponse(result);
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current || controller.signal.aborted) return;
      setReqError(
        error instanceof Error
          ? error.message
          : t("knowledgeNetwork.contextLoaderPanel.experience.requestFailed"),
      );
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        requestControllerRef.current = null;
        setSending(false);
      }
    }
  }, [env, op, mode, queryVals, bodyText, runtimeConfig, authMode, appKey, tokenProvider, lifecycle, t]);

  // Fill test data from the current network schema and sample rows.
  const onFillTestData = useCallback(async () => {
    if (!op) return;
    const fillSequence = ++fillSequenceRef.current;
    fillControllerRef.current?.abort();
    const controller = new AbortController();
    fillControllerRef.current = controller;
    setFillingTest(true);
    try {
      // Fetching schema/sample rows also goes through /kn/* and shares one managed interaction.
      const fill = await withManagedTurn(
        lifecycle,
        t("knowledgeNetwork.contextLoaderPanel.experience.fillTestTurn", { id: op.id }),
        async (turn) => {
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
            message.warning(
              t("knowledgeNetwork.contextLoaderPanel.experience.noQueryableObjectType"),
            );
            return null;
          }
        }
        if (op.id === "query_metric") {
          const metricOwner = detail.object_types.find((item) => (item.related_metric_count ?? 0) > 0) ?? detail.object_types[0];
          if (!metricOwner) {
            message.warning(
              t("knowledgeNetwork.contextLoaderPanel.experience.noObjectTypeForMetric"),
            );
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
            message.warning(
              t("knowledgeNetwork.contextLoaderPanel.experience.noMetricForObjectType", {
                name: metricOwner.name || metricOwner.id,
              }),
            );
            return null;
          }
        }
        if (op.id === "query_object_instance" && ot) {
          const rows = await fetchObjectInstances(env, ot.id, 1, tokenProvider, controller.signal, turn ?? undefined);
          if (fillSequence !== fillSequenceRef.current) return null;
          sampleRow = rows[0] ?? null;
        }
        return buildTestData(op, mode, knId, detail, ot, sampleRow);
        },
      );
      if (!fill || fillSequence !== fillSequenceRef.current) return;
      setBodyText(fill.body);
      setBodyError(null);
      if (fill.query) setQueryVals((prev) => ({ ...prev, ...fill.query }));
      message.success(
        fill.note
          ? t("knowledgeNetwork.contextLoaderPanel.experience.testDataFilledWithNote", {
              note: fill.note,
            })
          : t("knowledgeNetwork.contextLoaderPanel.experience.testDataFilled"),
      );
    } catch (error) {
      if (fillSequence !== fillSequenceRef.current || controller.signal.aborted) return;
      message.error(
        error instanceof Error
          ? error.message
          : t("knowledgeNetwork.contextLoaderPanel.experience.generateTestDataFailed"),
      );
    } finally {
      if (fillSequence === fillSequenceRef.current) {
        fillControllerRef.current = null;
        setFillingTest(false);
      }
    }
  }, [env, op, mode, knId, message, tokenProvider, lifecycle, t]);

  // Whether the current op fetches by object type, controlling data-browser fill action visibility.
  const opFillsFromObjectType = op?.id === "query_object_instance" || op?.id === "run_sql";

  // Data-browser Fill Test Request action using the selected object type and real sample row.
  const fillTestFromObjectType = useCallback(
    async (ot: KnObjectType) => {
      if (!op) return;
      try {
        if (op.id === "run_sql" && !ot.data_source?.id) {
          message.warning(
            t("knowledgeNetwork.contextLoaderPanel.experience.objectTypeNoResource"),
          );
          return;
        }
        let sampleRow: Record<string, unknown> | null = null;
        if (op.id === "query_object_instance") {
          const rows = await withManagedTurn(
            lifecycle,
            t("knowledgeNetwork.contextLoaderPanel.experience.previewRowsTurn", { id: ot.id }),
            (turn) =>
              fetchObjectInstances(env, ot.id, 1, tokenProvider, undefined, turn ?? undefined),
          );
          sampleRow = rows[0] ?? null;
        }
        const detail = knDetailRef.current?.detail ?? { id: knId, object_types: [], concept_groups: [], relation_types: [] };
        const fill = buildTestData(op, mode, knId, detail, ot, sampleRow);
        setBodyText(fill.body);
        setBodyError(null);
        if (fill.query) setQueryVals((prev) => ({ ...prev, ...fill.query }));
        message.success(
          t("knowledgeNetwork.contextLoaderPanel.experience.testRequestFilledFromObject", {
            name: ot.name || ot.id,
            note: fill.note ? ` · ${fill.note}` : "",
          }),
        );
      } catch (error) {
        message.error(
          error instanceof Error
            ? error.message
            : t("knowledgeNetwork.contextLoaderPanel.experience.generateTestDataFailed"),
        );
      }
    },
    [env, op, mode, knId, message, tokenProvider, lifecycle, t],
  );

  // Data-browser relation card fills relation_type_paths for query_instance_subgraph.
  const fillSubgraphFromRelation = useCallback(
    (rel: KnRelationType) => {
      const path = subgraphPathFor(rel);
      const body = mode === "mcp" ? { kn_id: knId, relation_type_paths: [path] } : { relation_type_paths: [path] };
      setBodyText(JSON.stringify(body, null, 2));
      setBodyError(null);
      if (mode === "rest") setQueryVals((prev) => ({ ...prev, kn_id: knId }));
      message.success(
        t("knowledgeNetwork.contextLoaderPanel.experience.subgraphFilled", {
          name: rel.name || rel.id,
        }),
      );
    },
    [mode, knId, message, t],
  );

  // Data-browser fill: write REST query params when present, otherwise JSON body fields.
  const fillBodyField = useCallback(
    (key: string, value: string) => {
      if (!op) return;
      // 1) Current REST op exposes this field as a query parameter.
      if (mode === "rest" && op.query.some((param) => param.name === key)) {
        setQueryVals((prev) => ({ ...prev, [key]: value }));
        message.success(
          t("knowledgeNetwork.contextLoaderPanel.experience.fieldFilled", { key }),
        );
        return;
      }
      // 2) Otherwise write into request-body JSON.
      try {
        const obj: unknown = JSON.parse(bodyText || "{}");
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          (obj as Record<string, unknown>)[key] = value;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(
            t("knowledgeNetwork.contextLoaderPanel.experience.fieldFilled", { key }),
          );
          return;
        }
      } catch {
        /* Fall back to copy. */
      }
      copy(
        value,
        t("knowledgeNetwork.contextLoaderPanel.experience.fieldCopiedFallback", { key }),
      );
    },
    [mode, op, bodyText, copy, message, t],
  );

  const fillResource = useCallback(
    (resourceId: string) => {
      // Backend SQL resource placeholders require a leading dot: {{.<data_source.id>}}.
      const token = `{{.${resourceId}}}`;
      try {
        const obj = JSON.parse(bodyText || "{}") as Record<string, unknown>;
        if (obj && typeof obj === "object" && typeof obj.sql === "string") {
          obj.sql = /\{\{[^}]*\}\}/.test(obj.sql)
            ? obj.sql.replace(/\{\{[^}]*\}\}/, token)
            : `SELECT * FROM ${token} LIMIT 20`;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(
            t("knowledgeNetwork.contextLoaderPanel.experience.resourceFilledSql"),
          );
          return;
        }
      } catch {
        /* Fall back to copy. */
      }
      copy(
        token,
        t("knowledgeNetwork.contextLoaderPanel.experience.resourcePlaceholderCopied"),
      );
    },
    [bodyText, copy, message, t],
  );

  // Add concept_group into the request body's concept_groups array.
  const fillConceptGroup = useCallback(
    (groupId: string) => {
      try {
        const obj: unknown = JSON.parse(bodyText || "{}");
        const arr = findArrayProp(obj, "concept_groups");
        if (arr) {
          if (!arr.includes(groupId)) arr.push(groupId);
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(
            t("knowledgeNetwork.contextLoaderPanel.experience.conceptGroupAdded", {
              id: groupId,
            }),
          );
          return;
        }
      } catch {
        /* Fall back to copy. */
      }
      copy(
        groupId,
        t("knowledgeNetwork.contextLoaderPanel.experience.conceptGroupCopiedFallback", {
          id: groupId,
        }),
      );
    },
    [bodyText, copy, message, t],
  );

  return (
    <section className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`}>
      {showModeTabs || showEnvSettings ? (
      <div className={styles.topbar}>
        {!embedded && network ? (
          <button type="button" className={styles.back} onClick={() => void navigate(`/knowledge-network/workspace/${id}/overview`)}>
            <ArrowLeftOutlined />
            {t("knowledgeNetwork.contextLoaderPanel.experience.back", { name: network.name })}
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
              {t(`knowledgeNetwork.contextLoaderPanel.experience.modes.${value}`)}
            </button>
          ))}
        </div>
        ) : null}
        {showEnvSettings ? (
        <div className={styles.envset}>
          <div className={styles.ef}>
            <label>{t("knowledgeNetwork.contextLoaderPanel.experience.knId")}</label>
            <div className={styles.knLock}>
              <KeyOutlined />
              <span className={styles.knName}>{network?.name ?? "—"}</span>
              <span className={styles.knSlug}>{knId}</span>
            </div>
          </div>
          <div className={styles.ef}>
            <label>{t("knowledgeNetwork.contextLoaderPanel.experience.serviceAddress")}</label>
            <div
              className={styles.addr}
              title={mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            >
              {mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            </div>
          </div>
          <div className={styles.ef}>
            <label>
              {t("knowledgeNetwork.contextLoaderPanel.experience.authMode")}
              <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.experience.authModeTooltip")}>
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
                onCopy={() =>
                  copy(
                    appKey.trim(),
                    t("knowledgeNetwork.contextLoaderPanel.experience.apiKeyCopied"),
                  )
                }
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
              setBodyError(
                error instanceof Error
                  ? error.message
                  : t("knowledgeNetwork.contextLoaderPanel.experience.jsonParseFailed"),
              );
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
