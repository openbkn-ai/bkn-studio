/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Agent chat single-session pane extracted from AgentChat, supporting compare-mode instances.
 * Each pane owns its own message history, model selection, prompt, config, tool selection,
 * stats, and AbortController. The parent drives it through ref { send, stop }.
 */

/* eslint-disable react-refresh/only-export-components */

import {
  ClearOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SettingOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import { App, Drawer, Select, Tooltip } from "antd";
import {
  forwardRef,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildAgentTools,
  effectiveToolArgs,
  guardAgentToolArgs,
  isTakenOverLifecycleTool,
  formatOutputContract,
  formatToolResultLimits,
  runAgentChat,
  DEFAULT_AGENT_CONFIG,
  type AgentChatTurn,
  type AgentChunk,
  type AgentConfig,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import { buildPtcTools } from "@/modules/knowledge-network/services/ptc/run-code.tool";
import { fetchPtcToolkit } from "@/modules/knowledge-network/services/ptc/toolkit.service";
import {
  normalizeAgentError,
  type NormalizedAgentError,
} from "@/modules/knowledge-network/services/agent-error";
import {
  createBknLifecycle,
  lifecycleEnv,
  localConversationStore,
  type TurnOutcome,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  type BknContext,
  type ContextLoaderEnv,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import { buildMcpToolGroups, toolDisplayOf } from "@/modules/knowledge-network/services/mcp-tool-display";

import styles from "./AgentChat.module.css";
import { closeOpenMarkdown, splitMarkdownBlocks } from "./markdown-blocks";

/**
 * The default prompt only explains the pane role and tool usage. The output
 * contract is appended by composedSystem; see formatOutputContract.
 */
export const DEFAULT_PROMPT =
  "You are a BKN business knowledge-network retrieval assistant. Answer based on object types, relation types, and logical properties in the current knowledge network.\n" +
  "Call the provided retrieval tools when data is needed, such as search_schema, query_object_instance, query_instance_subgraph, and run_sql. Do not fabricate data.\n" +
  "kn_id is locked to the current network; do not modify it.\n" +
  "Query efficiently: push aggregation, sorting, and counting to SQL where possible, use LIMIT and precise filters, select only needed fields, avoid whole-table scans or huge result sets, and do not repeat already retrieved information.";

/** Default prompt for the base-data pane: table/SQL only, without KN semantics. */
export const DEFAULT_BASE_PROMPT =
  "You are a data query assistant. You can answer only by querying underlying tables with three tools:\n" +
  "list_resources, describe_resource, and run_sql.\n" +
  "Flow: use list_resources to find relevant tables, describe_resource to confirm columns, then write SQL.\n" +
  "SQL table names must use {{.<resource_id>}} placeholders from list_resources entries[].resource_id; do not use raw table names, and do not join across catalogs.\n" +
  "Query efficiently: push aggregation, sorting, and counting into SQL, use LIMIT and precise filters, and select only necessary fields.";

/** Evidence wording for the knowledge-network profile. */
export const KN_EVIDENCE_HINT = "which tool was called, what filter conditions were used, or the key SQL points";
/** Evidence wording for the base-data profile. */
export const BASE_EVIDENCE_HINT = "which tables were used and the key SQL points";

const FALLBACK_SUGGESTION_KEYS = [
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.relations",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.customers",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.links",
];

export type PaneKey = "solo" | "base" | "kn";

/** Pane profile controlling defaults, context injection, tool selection, and storage keys. */
export type PaneProfile = {
  paneKey: PaneKey;
  /** Identity label shown in split view; hidden for solo. */
  title?: string;
  emptyTitle?: string;
  defaultPrompt: string;
  /** Whether to append KN summary to the system prompt. */
  injectKnContext: boolean;
  /** Default selected tool names; null means all tools, including future backend tools. */
  defaultToolNames: string[] | null;
  /** Evidence wording for the output contract. */
  evidenceHint: string;
  /** Visual highlight for the primary compare pane. */
  highlight?: boolean;
  /**
   * 工具面形态。mcp：逐个暴露 BKN 工具（默认）。ptc：只暴露 run_code，模型写
   * Python 交沙箱执行，中间结果留在沙箱。见 services/ptc/run-code.tool.ts。
   */
  toolMode?: "mcp" | "ptc";
};

/** Turn result status; empty/stopped/error are negative outcomes. */
export type RoundOutcome = "answered" | "empty" | "stopped" | "error";

/** Compare-report turn data with metrics and outcome. */
export type PaneRound = {
  question: string;
  answer: string | null;
  tokens: number | null;
  ms: number | null;
  toolCalls: { name: string; status: string }[];
  /** Result status; empty/stopped/error mean this side did not complete effectively. */
  outcome: RoundOutcome;
};

/** Compare-report pane snapshot with all rounds and cumulative stats. */
export type PaneSnapshot = {
  model: string;
  stats: { tokens: number; ms: number };
  rounds: PaneRound[];
};

export type ChatPaneHandle = {
  send: (text: string) => void;
  stop: () => void;
  openSettings: () => void;
  clear: () => void;
  getSnapshot: () => PaneSnapshot;
};

type ToolCallView = {
  id: string;
  name: string;
  args: unknown;
  status: "running" | "done" | "error";
  result?: string;
  error?: string;
  clientBlocked?: boolean;
  startedAt: number;
  latencyMs?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  toolCalls?: ToolCallView[];
  /** Actual token count for this turn, available from usage at finish. */
  tokens?: number;
  /** Total elapsed time for this turn in ms. */
  ms?: number;
  /** Whether this turn was stopped by the user. */
  stopped?: boolean;
  /** Whether this turn failed as a whole, not merely at tool level. */
  errored?: boolean;
  /** Execution error rendered as a separate block; raw details stay collapsed. */
  errors?: NormalizedAgentError[];
};

type SessionStats = { tokens: number; ms: number };

type Persisted = { messages: ChatMessage[]; model: string; systemPrompt: string; stats?: SessionStats };

/** Rough token estimate for live streaming display; replaced by real usage at finish. */
function estimateTokens(chars: number): number {
  return Math.round(chars / 2.5);
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function fmtDuration(ms: number): string {
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}m${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
}

/**
 * 存储身份 = 面板 + 工具面形态。
 *
 * 两种模式的系统提示词互不兼容：常规模式那套要模型去调 query_object_instance
 * 等工具，而 PTC 模式下模型只有 run_code，那些名字根本不存在。共用一个存储键
 * 会让切换后沿用上一模式已保存的提示词，且不会报错，只会表现为模型行为异常。
 * 历史消息同理——两种模式的工具卡片形态不同，混在一条会话里没有意义。
 */
function paneStorageId(paneKey: PaneKey, toolMode?: "mcp" | "ptc"): string {
  return toolMode === "ptc" ? `${paneKey}-ptc` : paneKey;
}

/** Message-history key; solo keeps the legacy key, compare panes use suffixes. */
function msgsLsKey(knId: string, paneKey: PaneKey, toolMode?: "mcp" | "ptc"): string {
  const id = paneStorageId(paneKey, toolMode);
  return id === "solo" ? `bkn-studio:agentchat:${knId}` : `bkn-studio:agentchat:${knId}:cmp-${id}`;
}

/**
 * Managed conversation identity key. Each pane gets an independent conversation
 * so compare-mode agents are traced and counted separately.
 */
function conversationLsKey(knId: string, paneKey: PaneKey, toolMode?: "mcp" | "ptc"): string {
  return `bkn-studio:agentchat:conv:v2:${knId}:${paneStorageId(paneKey, toolMode)}`;
}

function legacyConversationLsKey(knId: string, paneKey: PaneKey): string {
  return `bkn-studio:agentchat:conv:${knId}:${paneKey}`;
}

function loadPersisted(key: string): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

/** Agent config cache; solo keeps the legacy key and compare panes are isolated. */
const CONFIG_LS_BASE = "bkn-studio:agentconfig";

function configLsKey(paneKey: PaneKey, toolMode?: "mcp" | "ptc"): string {
  const id = paneStorageId(paneKey, toolMode);
  return id === "solo" ? CONFIG_LS_BASE : `${CONFIG_LS_BASE}:cmp-${id}`;
}

function loadConfig(paneKey: PaneKey, toolMode?: "mcp" | "ptc"): AgentConfig {
  try {
    const raw = localStorage.getItem(configLsKey(paneKey, toolMode));
    return raw ? { ...DEFAULT_AGENT_CONFIG, ...(JSON.parse(raw) as Partial<AgentConfig>) } : { ...DEFAULT_AGENT_CONFIG };
  } catch {
    return { ...DEFAULT_AGENT_CONFIG };
  }
}

/** Tool-selection cache. Solo is always all tools and is not persisted. */
function toolsLsKey(paneKey: PaneKey): string {
  return `bkn-studio:agenttools:cmp-${paneKey}`;
}

function loadToolSelection(profile: PaneProfile): string[] | null {
  if (profile.paneKey === "solo") return null;
  try {
    const raw = localStorage.getItem(toolsLsKey(profile.paneKey));
    if (raw === null) return profile.defaultToolNames ? [...profile.defaultToolNames] : null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return profile.defaultToolNames ? [...profile.defaultToolNames] : null;
  }
}

/** Config panel field definitions. */
const CONFIG_FIELD_KEYS: { key: keyof AgentConfig }[] = [
  { key: "maxSteps" },
  { key: "keepToolResults" },
  { key: "dataToolCap" },
  { key: "schemaToolCap" },
  { key: "maxHistoryMessages" },
  { key: "maxTurnChars" },
  { key: "maxOutputTokens" },
];

function formatArgs(args: unknown): string {
  // PTC 模式下入参就是模型写的一段 Python，JSON.stringify 会把它压成带 \n 的
  // 单行字符串——那正是这里最该看清楚的东西，所以原样展开代码，其余参数附在后面。
  if (args && typeof args === "object" && !Array.isArray(args)) {
    const { code, ...rest } = args as Record<string, unknown>;
    if (typeof code === "string") {
      const extras = Object.keys(rest).length ? `\n\n# ${JSON.stringify(rest)}` : "";
      return code + extras;
    }
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

/** One Markdown block. memo keeps stable blocks from reparsing during streaming. */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;
});

/**
 * Markdown rendering with GFM. Streaming renders by block and completes the
 * active tail to avoid reparsing the entire body on every token.
 */
export const MarkdownView = memo(function MarkdownView({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => {
    // Non-streaming text is complete, so parse the whole body to preserve constructs
    // that can span blocks, such as reference links and footnotes.
    if (!streaming) return null;
    const bs = splitMarkdownBlocks(text);
    if (bs.length === 0) return bs;
    return [...bs.slice(0, -1), closeOpenMarkdown(bs[bs.length - 1])];
  }, [text, streaming]);
  return (
    <div className={styles.md}>
      {blocks === null ? (
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      ) : (
        blocks.map((b, i) => <MarkdownBlock key={i} text={b} />)
      )}
    </div>
  );
});

/** Streaming reasoning_content display; live reasoning auto-expands. */
function ReasoningBlock({ text, live }: { text: string; live: boolean }) {
  // Collapsed by default; users can expand manually.
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.reasoning}>
      <button type="button" className={`${styles.reasoningHead} ${live ? styles.reasoningLive : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>
          Reasoning {live ? "in progress" : "trace"}
          {live ? (
            <span className={styles.thinkDots}>
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </span>
        <span className={styles.chev}>{open ? <DownOutlined /> : <RightOutlined />}</span>
      </button>
      {open ? <div className={styles.reasoningText}>{text}</div> : null}
    </div>
  );
}

/** Collapsible tool-call card showing actual request parameters and response. */
function ToolCallCard({ call, t }: { call: ToolCallView; t: ReturnType<typeof useTranslation>["t"] }) {
  const [open, setOpen] = useState(false);
  const statusDot =
    call.status === "running" ? styles.dotRunning : call.status === "error" ? styles.dotError : styles.dotOk;
  const statusText =
    call.clientBlocked
      ? t("knowledgeNetwork.agentChat.chatPane.toolCall.clientBlocked")
      : call.status === "running"
        ? t("knowledgeNetwork.agentChat.chatPane.toolCall.running")
        : call.status === "error"
          ? t("knowledgeNetwork.agentChat.chatPane.toolCall.failed")
          : `200 - ${call.latencyMs ?? "-"}ms`;
  const requestLabel = call.clientBlocked
    ? t("knowledgeNetwork.agentChat.chatPane.toolCall.clientBlockedRequest", { name: call.name })
    : t("knowledgeNetwork.agentChat.chatPane.toolCall.request", { name: call.name });
  return (
    <div className={`${styles.call} ${open ? styles.callOpen : ""}`}>
      <button type="button" className={styles.callHead} onClick={() => setOpen((v) => !v)}>
        <span className={styles.verb}>MCP</span>
        <span className={styles.callName}>{call.name}</span>
        <span className={`${styles.dot} ${statusDot}`} />
        <span className={styles.callMeta}>{statusText}</span>
        <span className={styles.chev}>{open ? <DownOutlined /> : <RightOutlined />}</span>
      </button>
      {open ? (
        <div className={styles.callBody}>
          <div className={styles.callSec}>
            <div className={styles.callLbl}>{requestLabel}</div>
            <pre className={styles.callPre}>{formatArgs(call.args)}</pre>
          </div>
          <div className={styles.callSec}>
            <div className={styles.callLbl}>
              {call.clientBlocked
                ? t("knowledgeNetwork.agentChat.chatPane.toolCall.clientBlockedReason")
                : call.status === "error"
                  ? t("knowledgeNetwork.agentChat.chatPane.toolCall.error")
                  : t("knowledgeNetwork.agentChat.chatPane.toolCall.response")}
            </div>
            <pre className={styles.callPre}>{call.status === "error" ? call.error : call.result ?? "-"}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Turn execution error: user-facing message plus expandable raw detail. Retryable
 * errors expose a retry entry point.
 */
function ErrorBlock({
  err,
  onRetry,
  t,
}: {
  err: NormalizedAgentError;
  onRetry?: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.errBox}>
      <div className={styles.errHead}>
        <span className={styles.errMsg}>{err.message}</span>
        {onRetry ? (
          <button type="button" className={styles.errBtn} onClick={onRetry}>
            {t("knowledgeNetwork.agentChat.chatPane.error.retry")}
          </button>
        ) : null}
        {err.detail ? (
          <button type="button" className={styles.errBtn} onClick={() => setOpen((v) => !v)}>
            {t("knowledgeNetwork.agentChat.chatPane.error.detail")} {open ? <DownOutlined /> : <RightOutlined />}
          </button>
        ) : null}
      </div>
      {open && err.detail ? <pre className={styles.errPre}>{err.detail}</pre> : null}
    </div>
  );
}

export type ChatPaneProps = {
  env: ContextLoaderEnv;
  /** Auth for retrieval tools through agent-retrieval MCP. */
  tokenProvider: AgentTokenProvider;
  /** Auth for mf-model-api; falls back to tokenProvider when absent. */
  modelTokenProvider?: AgentTokenProvider;
  profile: PaneProfile;
  networkName?: string;
  /** Model list fetched once by the parent and shared across panes. */
  models: LlmModel[];
  modelsLoaded: boolean;
  /** KN summary fetched by the parent; injection depends on profile.injectKnContext. */
  knContext: string;
  knSummary: { objectTypes: number; relations: number } | null;
  /** Empty-state suggestions generated by the parent and shared by both sides. */
  suggestions: string[];
  /** Suggestion click callback; parent dispatches by target in compare mode. */
  onPick?: (question: string) => void;
  /** Live tools/list shared from parent cache; send lazily fetches when needed. */
  getTools: () => Promise<McpToolDef[]>;
  toolDefs: McpToolDef[] | null;
  /** resource_id set bound to the current KN, used to scope list_resources. */
  resourceScope?: readonly string[] | null;
  /**
   * Page-level scroll container for the QA workspace. Messages do not scroll
   * inside the pane; this container owns reading and stick-to-bottom behavior.
   */
  pageScrollRef: RefObject<HTMLDivElement | null>;
  showToolbar?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export const ChatPane = forwardRef<ChatPaneHandle, ChatPaneProps>(function ChatPane(
  {
    env,
    tokenProvider,
    modelTokenProvider,
    profile,
    networkName,
    models,
    modelsLoaded,
    knContext,
    knSummary,
    suggestions,
    onPick,
    getTools,
    toolDefs,
    resourceScope,
    pageScrollRef,
    showToolbar = true,
    onBusyChange,
  },
  ref,
) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const knId = env.knId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(profile.defaultPrompt);
  // QA config: model, tools, system prompt, and parameters are managed together.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfigState] = useState<AgentConfig>(() => loadConfig(profile.paneKey, profile.toolMode));
  const [draftModel, setDraftModel] = useState("");
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(profile.defaultPrompt);
  const [draftConfig, setDraftConfig] = useState<AgentConfig>(() => loadConfig(profile.paneKey, profile.toolMode));
  // Tool selection is a hard allowlist; null means all tools.
  const [toolSelection, setToolSelection] = useState<string[] | null>(() => loadToolSelection(profile));
  const [draftToolSelection, setDraftToolSelection] = useState<string[] | null>(() => loadToolSelection(profile));
  // Cumulative session tokens and elapsed time.
  const [stats, setStats] = useState<SessionStats>({ tokens: 0, ms: 0 });

  const abortRef = useRef<AbortController | null>(null);
  // Managed context for display in tool cards; buildAgentTools injects true values.
  const turnContextRef = useRef<BknContext | null>(null);
  const requestSequenceRef = useRef(0);
  // Stick-to-bottom flag; user scrolling up disables forced bottom following.
  const stickRef = useRef(true);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Abort in-flight streaming when unmounted, such as compare-mode switches.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Route changes reuse this component, so the old stream must not write into
  // another knowledge network's session while its persisted history is loading.
  useEffect(() => {
    requestSequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, [knId, profile.paneKey]);

  const setDraftConfigField = useCallback(
    (key: keyof AgentConfig, value: number) => {
      setDraftConfig((prev) => ({ ...prev, [key]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : prev[key] }));
    },
    [],
  );
  const openSettings = useCallback(() => {
    setDraftModel(model);
    setDraftSystemPrompt(systemPrompt);
    setDraftConfig(config);
    setDraftToolSelection(toolSelection);
    setSettingsOpen(true);
  }, [config, model, systemPrompt, toolSelection]);
  const cancelSettings = useCallback(() => {
    setDraftModel(model);
    setDraftSystemPrompt(systemPrompt);
    setDraftConfig(config);
    setDraftToolSelection(toolSelection);
    setSettingsOpen(false);
  }, [config, model, systemPrompt, toolSelection]);
  const saveSettings = useCallback(() => {
    setModel(draftModel);
    setSystemPrompt(draftSystemPrompt);
    setConfigState(draftConfig);
    if (profile.paneKey !== "solo") setToolSelection(draftToolSelection);
    try {
      localStorage.setItem(configLsKey(profile.paneKey, profile.toolMode), JSON.stringify(draftConfig));
      if (profile.paneKey !== "solo") {
        localStorage.setItem(toolsLsKey(profile.paneKey), JSON.stringify(draftToolSelection));
      }
      localStorage.setItem(
        msgsLsKey(knId, profile.paneKey, profile.toolMode),
        JSON.stringify({ messages, model: draftModel, systemPrompt: draftSystemPrompt, stats } satisfies Persisted),
      );
    } catch {
      /* Ignore unavailable localStorage. */
    }
    setSettingsOpen(false);
    message.success(t("knowledgeNetwork.agentChat.chatPane.messages.settingsSaved"));
  }, [draftConfig, draftModel, draftSystemPrompt, draftToolSelection, knId, message, messages, profile.paneKey, stats, t, profile.toolMode]);
  const resetDraftSystemPrompt = useCallback(() => {
    setDraftSystemPrompt(profile.defaultPrompt);
    message.success(t("knowledgeNetwork.agentChat.chatPane.messages.promptReset"));
  }, [message, profile.defaultPrompt, t]);
  const resetDraftConfig = useCallback(() => {
    setDraftConfig({ ...DEFAULT_AGENT_CONFIG });
    message.success(t("knowledgeNetwork.agentChat.chatPane.messages.configReset"));
  }, [message, t]);

  const updateStickiness = useCallback(() => {
    const el = pageScrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, [pageScrollRef]);

  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateStickiness, { passive: true });
    updateStickiness();
    return () => el.removeEventListener("scroll", updateStickiness);
  }, [pageScrollRef, updateStickiness]);

  // Load persisted chat history, isolated by KN and pane.
  useEffect(() => {
    const saved = loadPersisted(msgsLsKey(knId, profile.paneKey, profile.toolMode));
    setMessages(Array.isArray(saved.messages) ? saved.messages : []);
    if (saved.model) setModel(saved.model);
    setSystemPrompt(saved.systemPrompt ?? profile.defaultPrompt);
    setStats(saved.stats ?? { tokens: 0, ms: 0 });
  }, [knId, profile.paneKey, profile.defaultPrompt, profile.toolMode]);

  // Select the default model after model list is ready; persisted choice wins.
  useEffect(() => {
    setModel((prev) => {
      if (prev && models.some((m) => m.modelName === prev)) return prev;
      return models.find((m) => m.default)?.modelName ?? models[0]?.modelName ?? "";
    });
  }, [models]);

  const persist = useCallback(
    (msgs: ChatMessage[], statsSnapshot: SessionStats) => {
      try {
        localStorage.setItem(
          msgsLsKey(knId, profile.paneKey, profile.toolMode),
          JSON.stringify({ messages: msgs, model, systemPrompt, stats: statsSnapshot } satisfies Persisted),
        );
      } catch {
        /* Ignore unavailable localStorage. */
      }
    },
    [knId, profile.paneKey, model, systemPrompt, profile.toolMode],
  );

  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el || !stickRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pageScrollRef]);

  // Persist final messages and stats after a turn ends; do not write mid-stream.
  const prevBusyRef = useRef(false);
  useEffect(() => {
    if (prevBusyRef.current && !busy && messages.length) persist(messages, stats);
    prevBusyRef.current = busy;
  }, [busy, messages, stats, persist]);

  const updateAssistant = useCallback((updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const idx = next.length - 1;
      next[idx] = updater(next[idx]);
      return next;
    });
  }, []);

  const handleChunk = useCallback(
    (chunk: AgentChunk) => {
      switch (chunk.type) {
        case "text":
          updateAssistant((m) => ({ ...m, content: m.content + chunk.delta }));
          break;
        case "reasoning":
          updateAssistant((m) => ({ ...m, reasoning: (m.reasoning ?? "") + chunk.delta }));
          break;
        case "tool-call":
          updateAssistant((m) => ({
            ...m,
            toolCalls: [
              ...(m.toolCalls ?? []),
              (() => {
                const bknContext = turnContextRef.current ?? undefined;
                // PTC 模式下工具只有 run_code，入参就是模型写的代码；MCP 那套
                // 「补齐 kn_id / response_format / bkn_context」在这里只会往展示里
                // 塞入并不存在的参数。
                const effectiveArgs =
                  profile.toolMode === "ptc"
                    ? chunk.args
                    : effectiveToolArgs(chunk.name, chunk.args, knId, bknContext);
                // PTC 模式没有 MCP 工具的参数护栏可言：唯一的工具是 run_code，
                // 它的入参是一段代码，不存在「kn_id 被改写」这类需要拦截的形态。
                const clientBlocked =
                  profile.toolMode !== "ptc" &&
                  !!guardAgentToolArgs(chunk.name, effectiveArgs as Record<string, unknown>);
                return {
                  id: chunk.id,
                  name: chunk.name,
                  // Show the effective business request, including injected defaults and bkn_context,
                  // rather than raw model input. Taken-over lifecycle tools do not call session.callTool
                  // for a turn, so retain their original arguments instead of displaying a fictitious request.
                  args: clientBlocked || (turnContextRef.current && isTakenOverLifecycleTool(chunk.name)) ? chunk.args : effectiveArgs,
                  status: "running" as const,
                  clientBlocked,
                  startedAt: performance.now(),
                };
              })(),
            ],
          }));
          break;
        case "tool-result":
          updateAssistant((m) => ({
            ...m,
            toolCalls: (m.toolCalls ?? []).map((tc) =>
              tc.id === chunk.id
                ? { ...tc, status: "done", result: chunk.result, latencyMs: Math.round(performance.now() - tc.startedAt) }
                : tc,
            ),
          }));
          break;
        case "tool-error":
          updateAssistant((m) => ({
            ...m,
            toolCalls: (m.toolCalls ?? []).map((tc) =>
              tc.id === chunk.id ? { ...tc, status: "error", error: chunk.error } : tc,
            ),
          }));
          break;
        case "usage":
          updateAssistant((m) => ({ ...m, tokens: (m.tokens ?? 0) + chunk.totalTokens }));
          setStats((s) => ({ ...s, tokens: s.tokens + chunk.totalTokens }));
          break;
        case "error":
          updateAssistant((m) => ({
            ...m,
            errored: true,
            errors: [
              ...(m.errors ?? []),
              { message: chunk.error, detail: chunk.detail, retryable: chunk.retryable ?? false },
            ],
          }));
          break;
        case "finish":
        default:
          break;
      }
    },
    [updateAssistant, knId, profile.toolMode],
  );

  /**
   * Managed lifecycle client for this pane. Conversation identity follows KN + pane
   * and only changes on clear; page refresh reuses the server-issued conversation ID.
   */
  const lifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(env.base, knId), tokenProvider, {
        conversationStore: localConversationStore(
          conversationLsKey(knId, profile.paneKey, profile.toolMode),
          legacyConversationLsKey(knId, profile.paneKey),
        ),
      }),
    [env.base, knId, tokenProvider, profile.paneKey, profile.toolMode],
  );

  // Full system prompt = editable prompt + optional KN summary + caps + output contract.
  // Dynamic sections stay outside the editable prompt because saved prompt state wins.
  const composedSystem = useMemo(() => {
    const sections = [systemPrompt];
    if (profile.injectKnContext && knContext) {
      sections.push(`## Current Knowledge Network Summary\n${knContext}`);
    }
    const limits = formatToolResultLimits(config);
    if (limits) sections.push(limits);
    sections.push(formatOutputContract(profile.evidenceHint));
    return sections.join("\n\n");
  }, [profile.injectKnContext, profile.evidenceHint, systemPrompt, knContext, config]);

  const send = useCallback(
    async (text: string, options: { replaceLastRound?: boolean } = {}) => {
      const question = text.trim();
      if (!question || busy) return;
      if (!model) {
        message.error(t("knowledgeNetwork.agentChat.chatPane.messages.noModel"));
        return;
      }

      setBusy(true);
      const requestSequence = ++requestSequenceRef.current;
      const startedAt = performance.now();

      // Retry by removing the failed user+assistant pair and sending again.
      const kept =
        options.replaceLastRound &&
        messages.length >= 2 &&
        messages[messages.length - 1].role === "assistant" &&
        messages[messages.length - 2].role === "user"
          ? messages.slice(0, -2)
          : messages;

      // Compress multi-turn context by retaining recent text-only turns with caps.
      const history: AgentChatTurn[] = kept
        .filter((m) => m.role === "user" || m.content.trim().length > 0)
        .slice(-config.maxHistoryMessages)
        .map((m) => ({
          role: m.role,
          content:
            config.maxTurnChars > 0 && m.content.length > config.maxTurnChars
              ? `${m.content.slice(0, config.maxTurnChars)}\n...[History truncated]`
              : m.content,
        }));
      history.push({ role: "user", content: question });
      setMessages(() => [
        ...kept,
        { role: "user", content: question },
        { role: "assistant", content: "", toolCalls: [] },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      // One interaction equals one QA turn. Accumulate answer text separately
      // because message state is asynchronous and finally needs the final artifact.
      let turn: Awaited<ReturnType<typeof lifecycle.beginTurn>> = null;
      let outcome: TurnOutcome = "completed";
      let answer = "";
      /** Whether this turn emitted an error chunk; finish must record failed. */
      let roundFailed = false;
      try {
        turn = await lifecycle.beginTurn(question);
        turnContextRef.current = turn?.nextContext() ?? null;
        const allTools = await getTools();
        // Lifecycle tools stay visible here; buildAgentTools handles takeover.
        const modelVisibleTools = allTools.filter(
          (toolDef) => profile.paneKey !== "base" || !profile.defaultToolNames || profile.defaultToolNames.includes(toolDef.name),
        );
        // Hard allowlist: only selected tools are sent to the model; null means all.
        const activeTools = toolSelection ? modelVisibleTools.filter((t) => toolSelection.includes(t.name)) : modelVisibleTools;
        // PTC 模式只给模型一个 run_code：BKN 能力下沉为沙箱内的函数，中间结果
        // 留在沙箱，只有 stdout 回到上下文。工具说明由同一份 tools/list 渲染。
        const tools =
          profile.toolMode === "ptc"
            ? buildPtcTools({
                toolkit: await fetchPtcToolkit(env.base, env.token),
                bknContext: () => turn?.nextContext() ?? undefined,
                token: env.token,
              })
            : buildAgentTools(activeTools, env, knId, config, tokenProvider, {
                resourceScope,
                session: lifecycle.session,
                turn,
              });

        await runAgentChat({
          env,
          modelName: model,
          system: composedSystem,
          history,
          tools,
          config,
          tokenProvider: modelTokenProvider ?? tokenProvider,
          signal: controller.signal,
          onChunk: (chunk) => {
            if (chunk.type === "text") answer += chunk.delta;
            // Stream errors are caught inside runAgentChat and returned normally.
            // Mark the turn failed so Core does not receive completed with an empty artifact.
            if (chunk.type === "error") roundFailed = true;
            if (requestSequence === requestSequenceRef.current) handleChunk(chunk);
          },
        });
      } catch (error) {
        if (requestSequence !== requestSequenceRef.current) return;
        if (controller.signal.aborted) {
          // User stopped mid-turn; keep partial content and mark negative for compare reports.
          outcome = "canceled";
          updateAssistant((m) => ({ ...m, stopped: true }));
        } else {
          outcome = "failed";
          updateAssistant((m) => ({ ...m, errored: true, errors: [...(m.errors ?? []), normalizeAgentError(error)] }));
        }
      } finally {
        // Finish before setBusy(false) because one conversation allows one active interaction.
        // Stop returns normally, so use aborted state rather than outcome alone.
        const finalOutcome: TurnOutcome = roundFailed && outcome === "completed" ? "failed" : outcome;
        if (turn) {
          await turn.finish(controller.signal.aborted ? "canceled" : finalOutcome, answer).catch(() => undefined);
        }
        if (requestSequence === requestSequenceRef.current) {
          // Clear only if this is still the current turn.
          turnContextRef.current = null;
          abortRef.current = null;
          const elapsed = performance.now() - startedAt;
          // Record turn elapsed time on the final assistant message and cumulative stats.
          setMessages((cur) =>
            cur.map((m, i) => (i === cur.length - 1 && m.role === "assistant" ? { ...m, ms: elapsed } : m)),
          );
          setStats((s) => ({ ...s, ms: s.ms + elapsed }));
          setBusy(false); // Triggers the persist-on-completion effect below.
        }
      }
    },
    [busy, model, messages, env, knId, composedSystem, config, toolSelection, getTools, tokenProvider, modelTokenProvider, resourceScope, lifecycle, handleChunk, updateAssistant, message, profile, t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Compare-report snapshot: user turns paired with following assistant turns plus totals.
  const getSnapshot = useCallback((): PaneSnapshot => {
    const rounds: PaneRound[] = [];
    let current: PaneRound | null = null;
    for (const m of messages) {
      if (m.role === "user") {
        // Default empty covers a user turn without a corresponding assistant answer.
        current = { question: m.content, answer: null, tokens: null, ms: null, toolCalls: [], outcome: "empty" };
        rounds.push(current);
      } else if (m.role === "assistant" && current) {
        current.answer = m.content || null;
        current.tokens = m.tokens ?? null;
        current.ms = m.ms ?? null;
        current.toolCalls = (m.toolCalls ?? []).map((tc) => ({ name: tc.name, status: tc.status }));
        const hasAnswer = !!m.content && m.content.trim().length > 0;
        current.outcome = m.stopped ? "stopped" : m.errored ? "error" : hasAnswer ? "answered" : "empty";
        current = null;
      }
    }
    return { model, stats, rounds };
  }, [messages, model, stats]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStats({ tokens: 0, ms: 0 });
    // Clearing chat starts a new managed conversation; refresh reuses the saved server ID.
    lifecycle.reset();
    try {
      localStorage.removeItem(msgsLsKey(knId, profile.paneKey, profile.toolMode));
    } catch {
      /* ignore */
    }
  }, [knId, profile.paneKey, lifecycle, profile.toolMode]);

  useImperativeHandle(
    ref,
    () => ({ send: (text: string) => void send(text), stop, openSettings, clear: clearChat, getSnapshot }),
    [send, stop, openSettings, clearChat, getSnapshot],
  );

  const modelOptions = useMemo(
    () =>
      models.map((m) => ({
        value: m.modelName,
        label: m.default
          ? t("knowledgeNetwork.agentChat.chatPane.model.defaultSuffix", { modelName: m.modelName })
          : m.modelName,
      })),
    [models, t],
  );
  // Tool set visible to the model. Lifecycle tools remain visible and are taken over later.
  const agentToolDefs = useMemo(() => {
    if (!toolDefs || profile.paneKey !== "base" || !profile.defaultToolNames) return toolDefs ?? null;
    const baseToolNames = new Set(profile.defaultToolNames);
    return toolDefs.filter((toolDef) => baseToolNames.has(toolDef.name));
  }, [profile.defaultToolNames, profile.paneKey, toolDefs]);
  // Same grouping as the MCP sidebar: server title/_meta first, local fallback for old servers.
  const toolOptions = useMemo(() => {
    if (!agentToolDefs) return [];
    return buildMcpToolGroups(agentToolDefs, (tool) => toolDisplayOf(tool.name, tool)).map((group) => ({
      label: group.label,
      title: group.label,
      options: group.items.map(({ item, display }) => ({
        value: item.name,
        title: `${display.name} - ${item.name}`,
        searchText: `${display.name} ${item.name}`,
        label: (
          <span className={styles.toolOption}>
            <span className={styles.toolOptionName}>{display.name}</span>
            <span className={styles.toolOptionId}>{item.name}</span>
          </span>
        ),
      })),
    }));
  }, [agentToolDefs]);
  // Selector value: null (all) shows all currently known tool names.
  const draftToolValue = useMemo(
    () => draftToolSelection ?? (agentToolDefs ? agentToolDefs.map((t) => t.name) : []),
    [draftToolSelection, agentToolDefs],
  );

  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;
  const noLlm = modelsLoaded && models.length === 0;
  const fallbackSuggestionList = useMemo(() => FALLBACK_SUGGESTION_KEYS.map((key) => t(key)), [t]);
  const sugList = suggestions.length > 0 ? suggestions : fallbackSuggestionList;
  // Compare panes are half-width, so compact the header.
  const compact = profile.paneKey !== "solo";

  const promptEditor = (
    <textarea
      className={styles.promptTa}
      value={draftSystemPrompt}
      spellCheck={false}
      onChange={(e) => setDraftSystemPrompt(e.target.value)}
      placeholder={t("knowledgeNetwork.agentChat.chatPane.settings.promptPlaceholder")}
    />
  );

  const paramsGrid = (
    <div className={styles.cfgGrid}>
      {CONFIG_FIELD_KEYS.map((f) => (
        <label key={f.key} className={styles.cfgField}>
          <span className={styles.cfgLabel}>
            {t(`knowledgeNetwork.agentChat.chatPane.configFields.${f.key}.label`)}
            <Tooltip title={t(`knowledgeNetwork.agentChat.chatPane.configFields.${f.key}.hint`)}>
              <QuestionCircleOutlined className={styles.cfgHintIcon} />
            </Tooltip>
          </span>
          <input
            type="number"
            min={0}
            className={styles.cfgInput}
            value={draftConfig[f.key]}
            onChange={(e) => setDraftConfigField(f.key, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  );
  const toolPicker =
    profile.paneKey !== "solo" ? (
      <section className={styles.configSection}>
        <div className={styles.configSectionHead}>
          <div>
            <h3>{t("knowledgeNetwork.agentChat.chatPane.settings.toolScopeTitle")}</h3>
            <p>{t("knowledgeNetwork.agentChat.chatPane.settings.toolScopeDescription")}</p>
          </div>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setDraftToolSelection(profile.defaultToolNames ? [...profile.defaultToolNames] : null)}
          >
            {t("knowledgeNetwork.agentChat.chatPane.settings.resetDefault")}
          </button>
        </div>
        <div className={styles.configCard}>
          <div className={styles.configFieldLabel}>{t("knowledgeNetwork.agentChat.chatPane.settings.availableTools")}</div>
          <Select
            size="small"
            mode="multiple"
            className={styles.toolSelect}
            popupClassName={styles.paneMenu}
            value={draftToolValue}
            onChange={(next: string[]) => setDraftToolSelection(next)}
            options={toolOptions}
            showSearch
            filterOption={(input, option) => {
              const searchText = (option as { searchText?: unknown } | undefined)?.searchText;
              return typeof searchText === "string" && searchText.toLowerCase().includes(input.trim().toLowerCase());
            }}
            placeholder={
              toolDefs
                ? t("knowledgeNetwork.agentChat.chatPane.settings.selectTool")
                : t("knowledgeNetwork.agentChat.chatPane.settings.loadingTools")
            }
            loading={!toolDefs}
            disabled={busy}
            maxTagCount={0}
            maxTagPlaceholder={() =>
              draftToolSelection === null
                ? t("knowledgeNetwork.agentChat.chatPane.settings.allTools", { count: draftToolValue.length })
                : t("knowledgeNetwork.agentChat.chatPane.settings.selectedTools", {
                    count: draftToolValue.length,
                    total: agentToolDefs ? ` / ${agentToolDefs.length}` : "",
                  })
            }
            allowClear
            onClear={() => setDraftToolSelection(profile.defaultToolNames ? [...profile.defaultToolNames] : null)}
            popupMatchSelectWidth={false}
          />
        </div>
      </section>
    ) : null;

  return (
    <div className={styles.paneRoot}>
      {showToolbar ? <div className={`${styles.bar} ${compact ? styles.barCompact : ""}`}>
        <div className={styles.barLeft}>
          {profile.title ? (
            <span
              className={`${styles.paneTitle} ${profile.highlight ? styles.paneTitleHl : ""}`}
              title={
                profile.injectKnContext && knSummary
                  ? t("knowledgeNetwork.agentChat.chatPane.settings.loadedSummary", {
                      objectTypes: knSummary.objectTypes,
                      relations: knSummary.relations,
                    })
                  : undefined
              }
            >
              {profile.title}
            </span>
          ) : null}
        </div>
        <div className={styles.barActions}>
          <button type="button" className={styles.barBtn} onClick={settingsOpen ? cancelSettings : openSettings}>
            <SettingOutlined /> {t("knowledgeNetwork.agentChat.chatPane.settings.configTitle")} {settingsOpen ? <DownOutlined /> : <RightOutlined />}
          </button>
          <button
            type="button"
            className={styles.barBtn}
            onClick={clearChat}
            disabled={busy || empty}
            title={t("knowledgeNetwork.agentChat.chatPane.settings.clearTitle")}
          >
            <ClearOutlined /> {t("knowledgeNetwork.agentChat.chatPane.settings.clear")}
          </button>
        </div>
      </div> : null}
      <Drawer
        title={t("knowledgeNetwork.agentChat.chatPane.settings.configTitle")}
        placement="right"
        width={520}
        open={settingsOpen}
        onClose={cancelSettings}
        destroyOnHidden={false}
        className={styles.configDrawer}
        footer={
          <div className={styles.configFooter}>
            <button type="button" className={styles.cancelBtn} onClick={cancelSettings}>
              {t("knowledgeNetwork.agentChat.chatPane.settings.cancel")}
            </button>
            <button type="button" className={styles.confirmBtn} onClick={saveSettings}>
              {t("knowledgeNetwork.agentChat.chatPane.settings.confirm")}
            </button>
          </div>
        }
      >
        <section className={styles.configSection}>
          <div className={styles.configSectionHead}>
            <div>
              <h3>{t("knowledgeNetwork.agentChat.chatPane.settings.modelConfigTitle")}</h3>
              <p>{t("knowledgeNetwork.agentChat.chatPane.settings.modelConfigDescription")}</p>
            </div>
          </div>
          <div className={styles.configCard}>
            <div className={styles.configFieldLabel}>{t("knowledgeNetwork.agentChat.chatPane.settings.modelLabel")}</div>
              <Select
                size="small"
                className={styles.modelSelect}
                popupClassName={styles.paneMenu}
                value={draftModel || undefined}
                onChange={setDraftModel}
              options={modelOptions}
              placeholder={t("knowledgeNetwork.agentChat.chatPane.settings.selectModel")}
              disabled={busy}
              popupMatchSelectWidth={false}
            />
          </div>
        </section>
        {toolPicker}
        <section className={styles.configSection}>
          <div className={styles.configSectionHead}>
            <div>
              <h3><ThunderboltFilled /> {t("knowledgeNetwork.agentChat.chatPane.settings.promptTitle")}</h3>
              <p>{t("knowledgeNetwork.agentChat.chatPane.settings.promptDescription")}</p>
            </div>
            <button type="button" className={styles.linkBtn} onClick={resetDraftSystemPrompt}>
              {t("knowledgeNetwork.agentChat.chatPane.settings.resetDefault")}
            </button>
          </div>
          {promptEditor}
        </section>
        <section className={styles.configSection}>
          <div className={styles.configSectionHead}>
            <div>
              <h3>{t("knowledgeNetwork.agentChat.chatPane.settings.paramsTitle")}</h3>
              <p>{t("knowledgeNetwork.agentChat.chatPane.settings.paramsDescription")}</p>
            </div>
            <button type="button" className={styles.linkBtn} onClick={resetDraftConfig}>
              {t("knowledgeNetwork.agentChat.chatPane.settings.resetDefault")}
            </button>
          </div>
          {paramsGrid}
        </section>
      </Drawer>

      <div className={styles.scroll}>
        {noLlm ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>{t("knowledgeNetwork.agentChat.chatPane.empty.noLlmTitle")}</h3>
            <p>{t("knowledgeNetwork.agentChat.chatPane.empty.noLlmDescription")}</p>
            <div className={styles.sugs}>
              <button type="button" className={styles.sug} onClick={() => void navigate("/model-resources/models")}>
                <span className={styles.sugText}>{t("knowledgeNetwork.agentChat.chatPane.empty.goModelFactory")}</span>
                <RightOutlined className={styles.sugArrow} />
              </button>
            </div>
          </div>
        ) : empty ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>{profile.emptyTitle ?? t("knowledgeNetwork.agentChat.chatPane.empty.start")}</h3>
            <p>
              {profile.paneKey === "base" ? (
                t("knowledgeNetwork.agentChat.chatPane.empty.baseIntro")
              ) : (
                t("knowledgeNetwork.agentChat.chatPane.empty.knIntro", {
                  knId,
                  networkName: networkName
                    ? t("knowledgeNetwork.agentChat.chatPane.empty.networkName", { networkName })
                    : "",
                  summary: knSummary
                    ? t("knowledgeNetwork.agentChat.chatPane.empty.summary", {
                        objectTypes: knSummary.objectTypes,
                        relations: knSummary.relations,
                      })
                    : "",
                })
              )}
            </p>
            <div className={styles.sugs}>
              {sugList.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.sug}
                  onClick={() => (onPick ? onPick(s) : void send(s))}
                >
                  <span className={styles.sugText}>{s}</span>
                  <RightOutlined className={styles.sugArrow} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.wrap}>
            {messages.map((m, i) => {
              const isLast = i === lastIdx;
              const hasTools = !!m.toolCalls && m.toolCalls.length > 0;
              return (
                <div key={i} className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgBot}`}>
                  <div className={styles.avatar}>
                    {m.role === "user" ? t("knowledgeNetwork.agentChat.chatPane.message.user") : <ThunderboltFilled />}
                  </div>
                  <div className={styles.bubble}>
                    <div className={styles.who}>
                      {m.role === "user"
                        ? t("knowledgeNetwork.agentChat.chatPane.message.user")
                        : t("knowledgeNetwork.agentChat.chatPane.message.agent")}
                    </div>
                    {m.reasoning ? <ReasoningBlock text={m.reasoning} live={busy && isLast && !m.content} /> : null}
                    {hasTools ? (
                      <div className={styles.calls}>
                        {m.toolCalls!.map((tc) => (
                          <ToolCallCard key={tc.id} call={tc} t={t} />
                        ))}
                      </div>
                    ) : null}
                    {m.content ? (
                      // During streaming, MarkdownView reparses only the tail block.
                      m.role === "assistant" ? (
                        <MarkdownView text={m.content} streaming={busy && isLast} />
                      ) : (
                        <div className={styles.txt}>{m.content}</div>
                      )
                    ) : m.role === "assistant" && busy && isLast && !m.reasoning && !hasTools ? (
                      <div className={styles.typing}>
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : null}
                    {m.errors?.length ? (
                      <div className={styles.errs}>
                        {m.errors.map((e, ei) => (
                          <ErrorBlock
                            key={ei}
                            err={e}
                            t={t}
                            // Retry reruns the failed turn in place instead of appending a duplicate user bubble.
                            onRetry={
                              e.retryable && !busy && isLast && messages[i - 1]?.role === "user"
                                ? () => void send(messages[i - 1].content, { replaceLastRound: true })
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                    {m.role === "assistant" ? (
                      busy && isLast ? (
                        <div className={styles.msgMeta}>
                          - ~{fmtTokens(estimateTokens((m.reasoning?.length ?? 0) + m.content.length))} tokens
                        </div>
                      ) : m.tokens || m.ms ? (
                        <div className={styles.msgMeta}>
                          {m.tokens ? `${fmtTokens(m.tokens)} tokens` : ""}
                          {m.tokens && m.ms ? " - " : ""}
                          {m.ms ? fmtDuration(m.ms) : ""}
                        </div>
                      ) : null
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
