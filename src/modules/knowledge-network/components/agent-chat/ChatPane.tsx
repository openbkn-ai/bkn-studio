/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 立即体验 · Agent 对话 —— 单会话面板（从 AgentChat 抽出，支持对比模式多实例并存）。
 * 每个面板独立持有：消息历史、模型选择、系统提示词、调参、工具勾选、stats、AbortController；
 * 输入框在父级（AgentChat）共享，父级经 ref { send, stop } 驱动本面板。
 * 工具勾选是硬限定：未勾选的工具不会传给模型（tools/list 实时驱动，后端新工具自动可选）。
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
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildAgentTools,
  effectiveToolArgs,
  formatOutputContract,
  formatToolResultLimits,
  runAgentChat,
  DEFAULT_AGENT_CONFIG,
  type AgentChatTurn,
  type AgentChunk,
  type AgentConfig,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  normalizeAgentError,
  type NormalizedAgentError,
} from "@/modules/knowledge-network/services/agent-error";
import {
  createBknLifecycle,
  lifecycleEnv,
  localConversationStore,
  isPlatformManagedTool,
  type TurnOutcome,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  CONTEXT_LOADER_OPS,
  type ContextLoaderOp,
  type ContextLoaderEnv,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import {
  businessInfoOf,
  type ToolBusinessGroupKey,
} from "@/modules/knowledge-network/scenes/context-loader-tool-business-info";

import styles from "./AgentChat.module.css";

/**
 * 默认提示词只讲「这个面板是干什么的、工具怎么用」。
 * 输出契约不写在这里 —— 它由 composedSystem 自动拼接，理由见 formatOutputContract。
 */
export const DEFAULT_PROMPT =
  "You are the BKN business knowledge network retrieval assistant. Answer user questions based on the current knowledge network.";

/** 「仅基础数据」面板默认提示词：只讲表/SQL 工具用法，不提知识网络概念。 */
export const DEFAULT_BASE_PROMPT =
  "You are a data query assistant. Answer by directly querying underlying data tables with list_resources, describe_resource, and run_sql.";

/** 知识网络画像的「依据」写法。 */
export const KN_EVIDENCE_HINT = "which tool was called, what filter conditions were used, or the key SQL points";
/** 仅基础数据画像的「依据」写法。 */
export const BASE_EVIDENCE_HINT = "which tables were used and the key SQL points";

const FALLBACK_SUGGESTIONS = [
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.relations",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.customers",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.links",
];

const TOOL_BUSINESS_GROUP_ORDER: ToolBusinessGroupKey[] = ["data", "network", "model", "query", "logic", "skill", "other", "lifecycle"];

export type PaneKey = "solo" | "base" | "kn";

/** 面板画像：决定提示词默认值、是否注入网络摘要、默认工具集与 localStorage 键。 */
export type PaneProfile = {
  paneKey: PaneKey;
  /** 分屏时面板头显示的身份标签（solo 不显示）。 */
  title?: string;
  emptyTitle?: string;
  defaultPrompt: string;
  /** 是否把知识网络摘要拼进系统提示词（「仅基础数据」为 false）。 */
  injectKnContext: boolean;
  /** 默认勾选的工具名；null = 全部（含后端未来新增）。 */
  defaultToolNames: string[] | null;
  /** 输出契约里「依据」该怎么写（各画像可用的工具不同）。 */
  evidenceHint: string;
  /** 视觉高亮（对比模式的「主角」面板：渐变标签 + 面板泛光）。 */
  highlight?: boolean;
};

/** 一轮的结果状态：有效回答 / 无回答 / 被用户停止 / 出错。后三者为负面。 */
export type RoundOutcome = "answered" | "empty" | "stopped" | "error";

/** 对比报告用：一轮问答 + 指标 + 结果状态。 */
export type PaneRound = {
  question: string;
  answer: string | null;
  tokens: number | null;
  ms: number | null;
  toolCalls: { name: string; status: string }[];
  /** 结果状态；empty/stopped/error 计为负面（该侧该轮未有效完成）。 */
  outcome: RoundOutcome;
};

/** 对比报告用的面板快照：全部轮次 + 会话累计。 */
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
  startedAt: number;
  latencyMs?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  toolCalls?: ToolCallView[];
  /** 本轮真实累计 token（来自 usage，finish 时才有）。 */
  tokens?: number;
  /** 本轮总耗时 ms（完成后填）。 */
  ms?: number;
  /** 本轮被用户中途停止（AbortController）。 */
  stopped?: boolean;
  /** 本轮整体执行失败（非工具级、而是这一轮没跑出结果）。 */
  errored?: boolean;
  /** 本轮的执行错误。独立渲染成错误块，不再拼进正文——原始报文只在「详情」里出现。 */
  errors?: NormalizedAgentError[];
};

type SessionStats = { tokens: number; ms: number };

type Persisted = { messages: ChatMessage[]; model: string; systemPrompt: string; stats?: SessionStats };

/** 粗略 token 估算（中英混排约 2.5 字符/token），仅流式过程实时显示用；结束换真实 usage。 */
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

/** 消息历史键：solo 沿用旧键（老对话不丢），对比面板加 :cmp-* 后缀隔离。 */
function msgsLsKey(knId: string, paneKey: PaneKey): string {
  return paneKey === "solo" ? `bkn-studio:agentchat:${knId}` : `bkn-studio:agentchat:${knId}:cmp-${paneKey}`;
}

/**
 * 受管会话身份键。每个面板一条独立 conversation —— 对比模式两侧是两个不同的 Agent
 * 在各自答题，Trace 里也应当分别溯源、分别统计，不该混进同一条会话。
 */
function conversationLsKey(knId: string, paneKey: PaneKey): string {
  return `bkn-studio:agentchat:conv:v2:${knId}:${paneKey}`;
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

/** Agent 调参缓存（不分 kn）：solo 沿用旧键，对比面板每侧独立。 */
const CONFIG_LS_BASE = "bkn-studio:agentconfig";

function configLsKey(paneKey: PaneKey): string {
  return paneKey === "solo" ? CONFIG_LS_BASE : `${CONFIG_LS_BASE}:cmp-${paneKey}`;
}

function loadConfig(paneKey: PaneKey): AgentConfig {
  try {
    const raw = localStorage.getItem(configLsKey(paneKey));
    return raw ? { ...DEFAULT_AGENT_CONFIG, ...(JSON.parse(raw) as Partial<AgentConfig>) } : { ...DEFAULT_AGENT_CONFIG };
  } catch {
    return { ...DEFAULT_AGENT_CONFIG };
  }
}

/** 工具勾选缓存（不分 kn；solo 恒为全部，不落盘）。null = 全部。 */
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

/** 参数面板字段定义（label + 说明 + key）。 */
const CONFIG_FIELDS: { key: keyof AgentConfig; labelKey: string; hintKey: string }[] = [
  { key: "maxSteps", labelKey: "maxSteps.label", hintKey: "maxSteps.hint" },
  { key: "keepToolResults", labelKey: "keepToolResults.label", hintKey: "keepToolResults.hint" },
  { key: "dataToolCap", labelKey: "dataToolCap.label", hintKey: "dataToolCap.hint" },
  { key: "schemaToolCap", labelKey: "schemaToolCap.label", hintKey: "schemaToolCap.hint" },
  { key: "maxHistoryMessages", labelKey: "maxHistoryMessages.label", hintKey: "maxHistoryMessages.hint" },
  { key: "maxTurnChars", labelKey: "maxTurnChars.label", hintKey: "maxTurnChars.hint" },
  { key: "maxOutputTokens", labelKey: "maxOutputTokens.label", hintKey: "maxOutputTokens.hint" },
];

function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

/** Markdown 渲染（GFM：表格/删除线/任务列表）。对比报告的 AI 总结也复用。 */
export const MarkdownView = memo(function MarkdownView({ text }: { text: string }) {
  return (
    <div className={styles.md}>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
});

/** 思考过程（reasoning_content）流式展示：进行中自动展开，结束后可折叠。 */
function ReasoningBlock({ text, live }: { text: string; live: boolean }) {
  const { t } = useTranslation();
  // 默认收起（思考中靠头部闪烁点体现在跑）；用户可手动展开。
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.reasoning}>
      <button type="button" className={`${styles.reasoningHead} ${live ? styles.reasoningLive : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>
          💭 {live ? t("knowledgeNetwork.agentChat.chatPane.reasoning.live") : t("knowledgeNetwork.agentChat.chatPane.reasoning.done")}
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

/** 单条工具调用卡片（可折叠，展开看真实请求参数与响应）。 */
function ToolCallCard({ call }: { call: ToolCallView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const statusDot =
    call.status === "running" ? styles.dotRunning : call.status === "error" ? styles.dotError : styles.dotOk;
  const statusText =
    call.status === "running"
      ? t("knowledgeNetwork.agentChat.chatPane.toolCall.running")
      : call.status === "error"
        ? t("knowledgeNetwork.agentChat.chatPane.toolCall.failed")
        : `200 · ${call.latencyMs ?? "—"}ms`;
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
            <div className={styles.callLbl}>
              {t("knowledgeNetwork.agentChat.chatPane.toolCall.request", { name: call.name })}
            </div>
            <pre className={styles.callPre}>{formatArgs(call.args)}</pre>
          </div>
          <div className={styles.callSec}>
            <div className={styles.callLbl}>
              {call.status === "error"
                ? t("knowledgeNetwork.agentChat.chatPane.toolCall.error")
                : t("knowledgeNetwork.agentChat.chatPane.toolCall.response")}
            </div>
            <pre className={styles.callPre}>{call.status === "error" ? call.error : call.result ?? "—"}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 一轮的执行错误：一句人话 + 可展开原文。可重试的（上游忙/连接中断）多给一个重试入口，
 * 免得用户以为只能干等——原始报文一律收进折叠里，不再糊到对话正文上。
 */
function ErrorBlock({ err, onRetry }: { err: NormalizedAgentError; onRetry?: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.errBox}>
      <div className={styles.errHead}>
        <span className={styles.errMsg}>⚠️ {err.message}</span>
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
  /** 检索工具（agent-retrieval MCP）鉴权。 */
  tokenProvider: AgentTokenProvider;
  /** 大模型（mf-model-api）鉴权：网关不认 bak_ AppKey，恒用 OAuth 会话；缺省回落 tokenProvider。 */
  modelTokenProvider?: AgentTokenProvider;
  profile: PaneProfile;
  networkName?: string;
  /** 模型列表由父级拉一次，多面板共享。 */
  models: LlmModel[];
  modelsLoaded: boolean;
  /** 知识网络摘要（父级拉取）；是否注入由 profile.injectKnContext 决定。 */
  knContext: string;
  knSummary: { objectTypes: number; relations: number } | null;
  /** 空态建议问题（父级生成，两侧共用一组）。 */
  suggestions: string[];
  /** 点击建议问题的回调：由父级按发送目标派发（对比模式下两侧同题）。缺省则本面板直发。 */
  onPick?: (question: string) => void;
  /** 实时 tools/list（父级缓存共享）；send 时懒取，picker 展示用已加载值。 */
  getTools: () => Promise<McpToolDef[]>;
  toolDefs: McpToolDef[] | null;
  /** 当前知识网络绑定的 resource_id 集；用于默认把 list_resources 限定到本网络的数据表。 */
  resourceScope?: readonly string[] | null;
  /**
   * 问答工作区的页面级滚动容器。消息不再在面板内部滚动，
   * 由该容器统一承载阅读和流式回答的贴底跟随。
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
  // 问答配置：模型、工具、系统提示词与参数集中管理，避免主对话界面过载。
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfigState] = useState<AgentConfig>(() => loadConfig(profile.paneKey));
  const [draftModel, setDraftModel] = useState("");
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(profile.defaultPrompt);
  const [draftConfig, setDraftConfig] = useState<AgentConfig>(() => loadConfig(profile.paneKey));
  // 工具勾选（硬限定）：null = 全部。solo 恒为全部（不显示选择器）。
  const [toolSelection, setToolSelection] = useState<string[] | null>(() => loadToolSelection(profile));
  const [draftToolSelection, setDraftToolSelection] = useState<string[] | null>(() => loadToolSelection(profile));
  // 会话累计 token + 总时长（像 Claude Code 那样累加）。
  const [stats, setStats] = useState<SessionStats>({ tokens: 0, ms: 0 });

  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  // 是否贴底跟随；用户上滚时置 false，回到底部恢复，避免生成时被强制拽到底。
  const stickRef = useRef(true);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // 卸载（如对比模式切换）时中断进行中的流。
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
      localStorage.setItem(configLsKey(profile.paneKey), JSON.stringify(draftConfig));
      if (profile.paneKey !== "solo") {
        localStorage.setItem(toolsLsKey(profile.paneKey), JSON.stringify(draftToolSelection));
      }
      localStorage.setItem(
        msgsLsKey(knId, profile.paneKey),
        JSON.stringify({ messages, model: draftModel, systemPrompt: draftSystemPrompt, stats } satisfies Persisted),
      );
    } catch {
      /* localStorage 不可用时忽略 */
    }
    setSettingsOpen(false);
    message.success(t("knowledgeNetwork.agentChat.chatPane.messages.settingsSaved"));
  }, [draftConfig, draftModel, draftSystemPrompt, draftToolSelection, knId, message, messages, profile.paneKey, stats, t]);
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

  // 载入持久化对话（按 kn + 面板隔离）。
  useEffect(() => {
    const saved = loadPersisted(msgsLsKey(knId, profile.paneKey));
    setMessages(Array.isArray(saved.messages) ? saved.messages : []);
    if (saved.model) setModel(saved.model);
    setSystemPrompt(saved.systemPrompt ?? profile.defaultPrompt);
    setStats(saved.stats ?? { tokens: 0, ms: 0 });
  }, [knId, profile.paneKey, profile.defaultPrompt]);

  // 模型列表就绪后选默认模型（已持久化的选择优先）。
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
          msgsLsKey(knId, profile.paneKey),
          JSON.stringify({ messages: msgs, model, systemPrompt, stats: statsSnapshot } satisfies Persisted),
        );
      } catch {
        /* localStorage 不可用时忽略 */
      }
    },
    [knId, profile.paneKey, model, systemPrompt],
  );

  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el || !stickRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pageScrollRef]);

  // 一轮结束（busy: true→false）把最终 messages+stats（含本轮时长）落盘；流式中不写。
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
              {
                id: chunk.id,
                name: chunk.name,
                // 展示实际发出的业务请求体（含注入的 kn_id 与 schema_brief 等默认值），而非模型原始入参。
                // 受管上下文（bkn_context）在 execute 里逐次注入，不在这条流式事件里，故不展示。
                args: effectiveToolArgs(chunk.name, chunk.args, knId),
                status: "running",
                startedAt: performance.now(),
              },
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
    [updateAssistant, knId],
  );

  /**
   * 本面板的受管生命周期客户端。会话身份跟着 kn + 面板走，只有「清空对话」才换新
   * ——刷新页面复用服务端下发的 conversation ID。
   */
  const lifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(env.base, knId), tokenProvider, {
        conversationStore: localConversationStore(
          conversationLsKey(knId, profile.paneKey),
          legacyConversationLsKey(knId, profile.paneKey),
        ),
      }),
    [env.base, knId, tokenProvider, profile.paneKey],
  );

  // 实际发送的完整系统提示词 = 可编辑提示词 + （按画像）知识网络摘要 + 截断上限 + 输出契约。
  // 后两段都不写进可编辑提示词：上限跟着调参面板变，契约必须和过滤器认的标签逐字节一致，
  // 而提示词是持久化状态（每轮回写、载入优先用存量值），写进默认值对老用户一律不生效。
  const composedSystem = useMemo(() => {
    const sections = [systemPrompt];
    if (profile.injectKnContext && knContext) {
      sections.push(t("knowledgeNetwork.agentChat.chatPane.system.contextSection", { context: knContext }));
    }
    const limits = formatToolResultLimits(config);
    if (limits) sections.push(limits);
    sections.push(formatOutputContract(profile.evidenceHint));
    return sections.join("\n\n");
  }, [profile.injectKnContext, profile.evidenceHint, systemPrompt, knContext, config, t]);

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

      // 重试：把失败的那一轮（user + assistant 一对）摘掉再重发，而不是在下面追加一轮
      // ——否则会多出一条重复的用户气泡，失败轮的空 assistant 也会留在历史里。
      const kept =
        options.replaceLastRound &&
        messages.length >= 2 &&
        messages[messages.length - 1].role === "assistant" &&
        messages[messages.length - 2].role === "user"
          ? messages.slice(0, -2)
          : messages;

      // 多轮上下文压缩：只保留最近若干轮，且单轮文本封顶，防长对话纯文本堆大。
      // （工具结果/思考本就不进历史，见 send() 历史只取 role+content。）
      // 空正文的 assistant 轮不进历史：那是出错/被停的轮次，回灌给严格 router 只会添乱。
      const history: AgentChatTurn[] = kept
        .filter((m) => m.role === "user" || m.content.trim().length > 0)
        .slice(-config.maxHistoryMessages)
        .map((m) => ({
          role: m.role,
          content:
            config.maxTurnChars > 0 && m.content.length > config.maxTurnChars
              ? t("knowledgeNetwork.agentChat.chatPane.system.historyTruncated", {
                  content: m.content.slice(0, config.maxTurnChars),
                })
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
      // 一轮交互 = 一轮问答。答复正文另行累计：终结交互要把它作为 artifact 交给 Core，
      // 而消息 state 是异步的，finally 里读不到本轮最终值。
      let turn: Awaited<ReturnType<typeof lifecycle.beginTurn>> = null;
      let outcome: TurnOutcome = "completed";
      let answer = "";
      /** 本轮流里出过 error chunk。UI 已判 errored，终结也必须记 failed。 */
      let roundFailed = false;
      try {
        turn = await lifecycle.beginTurn(question);
        const allTools = await getTools();
        const modelVisibleTools = allTools.filter(
          (toolDef) =>
            !isPlatformManagedTool(toolDef.name) &&
            (profile.paneKey !== "base" || !profile.defaultToolNames || profile.defaultToolNames.includes(toolDef.name)),
        );
        // 硬限定：只把勾选的工具传给模型（null = 全部）。
        const activeTools = toolSelection ? modelVisibleTools.filter((t) => toolSelection.includes(t.name)) : modelVisibleTools;
        const tools = buildAgentTools(activeTools, env, knId, config, tokenProvider, {
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
            // 流里的错误是 runAgentChat 内部捕获后正常返回的，不会抛到下面的 catch。
            // 不在这里记一笔，交给 Core 的就是 completed + 空 artifact，
            // 而面板上明明是红条——#620 那类失败会被系统性少记。
            if (chunk.type === "error") roundFailed = true;
            if (requestSequence === requestSequenceRef.current) handleChunk(chunk);
          },
        });
      } catch (error) {
        if (requestSequence !== requestSequenceRef.current) return;
        if (controller.signal.aborted) {
          // 用户中途停止：标记本轮 stopped（对比报告计为负面），保留已生成的部分内容。
          outcome = "canceled";
          updateAssistant((m) => ({ ...m, stopped: true }));
        } else {
          outcome = "failed";
          updateAssistant((m) => ({ ...m, errored: true, errors: [...(m.errors ?? []), normalizeAgentError(error)] }));
        }
      } finally {
        // 终结必须挡在 setBusy(false) 之前：一条 conversation 同时只允许一个 active
        // interaction（Core 的 uq_..._interaction_active 唯一约束），提前放开输入框会让
        // 用户手快发出的下一轮直接开不出交互。
        // 用户点停止时 runAgentChat 是正常返回而非抛错，所以结果要认 aborted 而不是 outcome。
        // 收尾失败不改写本轮结果：那是可观测面的问题，不该把答出来的一轮显示成失败。
        const finalOutcome: TurnOutcome = roundFailed && outcome === "completed" ? "failed" : outcome;
        if (turn) {
          await turn.finish(controller.signal.aborted ? "canceled" : finalOutcome, answer).catch(() => undefined);
        }
        if (requestSequence === requestSequenceRef.current) {
          abortRef.current = null;
          const elapsed = performance.now() - startedAt;
          // 本轮耗时写到最后一条 assistant 消息 + 累计会话总时长（token 已在 usage chunk 累计）。
          setMessages((cur) =>
            cur.map((m, i) => (i === cur.length - 1 && m.role === "assistant" ? { ...m, ms: elapsed } : m)),
          );
          setStats((s) => ({ ...s, ms: s.ms + elapsed }));
          setBusy(false); // 触发下方「完成即持久化」effect
        }
      }
    },
    [busy, model, messages, env, knId, composedSystem, config, toolSelection, getTools, tokenProvider, modelTokenProvider, resourceScope, lifecycle, handleChunk, updateAssistant, message, profile, t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 对比报告用：全部轮次（user → 其后紧跟的 assistant 配对）+ 会话累计快照。
  const getSnapshot = useCallback((): PaneSnapshot => {
    const rounds: PaneRound[] = [];
    let current: PaneRound | null = null;
    for (const m of messages) {
      if (m.role === "user") {
        // 默认 empty：只有 user、没有对应 assistant（发出未答）也计为负面。
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
    // 清空对话 = 换一条受管会话。这是 conversation id 唯一的更换点：不清空就一直是同一个，
    // 刷新页面会继续使用已保存的服务端 conversation ID。
    lifecycle.reset();
    try {
      localStorage.removeItem(msgsLsKey(knId, profile.paneKey));
    } catch {
      /* ignore */
    }
  }, [knId, profile.paneKey, lifecycle]);

  useImperativeHandle(
    ref,
    () => ({ send: (text: string) => void send(text), stop, openSettings, clear: clearChat, getSnapshot }),
    [send, stop, openSettings, clearChat, getSnapshot],
  );

  const modelOptions = useMemo(
    () =>
      models.map((m) => ({
        value: m.modelName,
        label: m.default ? t("knowledgeNetwork.agentChat.chatPane.model.defaultSuffix", { modelName: m.modelName }) : m.modelName,
      })),
    [models, t],
  );
  // 模型可见的工具集：tools/list 会连生命周期工具一起返回，那些是平台侧管账的，
  // 不该出现在给模型的工具集里，也不该出现在勾选器里让用户以为可以开关。
    const agentToolDefs = useMemo(() => {
      const visibleTools = toolDefs?.filter((toolDef) => !isPlatformManagedTool(toolDef.name)) ?? null;
      if (!visibleTools || profile.paneKey !== "base" || !profile.defaultToolNames) return visibleTools;
      const baseToolNames = new Set(profile.defaultToolNames);
      return visibleTools.filter((toolDef) => baseToolNames.has(toolDef.name));
    }, [profile.defaultToolNames, profile.paneKey, toolDefs]);
  // 与 MCP 侧栏同款分组：本地 op 定义带组名，线上新增的归 Knowledge Network。
  const toolOptions = useMemo(() => {
    if (!agentToolDefs) return [];
      const opOf = (toolDef: McpToolDef): ContextLoaderOp =>
        CONTEXT_LOADER_OPS.find((op) => op.id === toolDef.name) ?? {
          id: toolDef.name,
          group: "Knowledge Network",
          summary: toolDef.description ?? toolDef.name,
          path: "",
          query: [],
          body: null,
          mcpOnly: true,
        };
      const buckets = new Map<ToolBusinessGroupKey, { value: string; label: ReactNode; title: string; searchText: string }[]>();
      for (const t of agentToolDefs) {
        const info = businessInfoOf(opOf(t));
        const group = info.groupKey;
        if (!buckets.has(group)) buckets.set(group, []);
        buckets.get(group)!.push({
          value: t.name,
          title: `${info.name} · ${t.name}`,
          searchText: `${info.name} ${t.name}`,
          label: (
            <span className={styles.toolOption}>
              <span className={styles.toolOptionName}>{info.name}</span>
              <span className={styles.toolOptionId}>{t.name}</span>
            </span>
          ),
        });
      }
      return [...buckets.keys()]
        .sort((a, b) => {
          const ia = TOOL_BUSINESS_GROUP_ORDER.indexOf(a);
          const ib = TOOL_BUSINESS_GROUP_ORDER.indexOf(b);
          return (ia === -1 ? TOOL_BUSINESS_GROUP_ORDER.length : ia) - (ib === -1 ? TOOL_BUSINESS_GROUP_ORDER.length : ib);
        })
        .map((group) => {
          const label = t(`knowledgeNetwork.contextLoaderPanel.toolGroups.${group}.label`);
          return { label, title: label, options: buckets.get(group)! };
        });
  }, [agentToolDefs, t]);
  // 选择器展示值：null（全部）时显示当前已知的全部工具名。
  const draftToolValue = useMemo(
    () => draftToolSelection ?? (agentToolDefs ? agentToolDefs.map((t) => t.name) : []),
    [draftToolSelection, agentToolDefs],
  );

  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;
  const noLlm = modelsLoaded && models.length === 0;
  const sugList = suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS.map((key) => t(key));
  // 对比分屏时面板只有半宽：压缩头部（去 label、缩 chip/按钮文案），尽量一行放下。
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
      {CONFIG_FIELDS.map((f) => (
        <label key={f.key} className={styles.cfgField}>
          <span className={styles.cfgLabel}>
            {t(`knowledgeNetwork.agentChat.chatPane.configFields.${f.labelKey}`)}
            <Tooltip title={t(`knowledgeNetwork.agentChat.chatPane.configFields.${f.hintKey}`)}>
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
            <SettingOutlined /> {t("knowledgeNetwork.agentChat.chatPane.settings.configTitle")}{" "}
            {settingsOpen ? <DownOutlined /> : <RightOutlined />}
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
              <h3>
                <ThunderboltFilled /> {t("knowledgeNetwork.agentChat.chatPane.settings.promptTitle")}
              </h3>
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
                <>
                  {t("knowledgeNetwork.agentChat.chatPane.empty.knIntro", {
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
                  })}
                </>
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
                          <ToolCallCard key={tc.id} call={tc} />
                        ))}
                      </div>
                    ) : null}
                    {m.content ? (
                      // 流式进行中的最后一条用纯文本，结束后再渲染 Markdown：
                      // 避免每来一个 token 就整段重新解析 Markdown（长答复 O(n²) 卡 UI）。
                      m.role === "assistant" && !(busy && isLast) ? (
                        <MarkdownView text={m.content} />
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
                            // 重试 = 把失败的这一轮原地重跑（摘掉旧的一对再重发），
                            // 不是追加新一轮——否则会多出一条重复的用户气泡。
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
                          · ~{fmtTokens(estimateTokens((m.reasoning?.length ?? 0) + m.content.length))} tokens
                        </div>
                      ) : m.tokens || m.ms ? (
                        <div className={styles.msgMeta}>
                          {m.tokens ? `${fmtTokens(m.tokens)} tokens` : ""}
                          {m.tokens && m.ms ? " · " : ""}
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
