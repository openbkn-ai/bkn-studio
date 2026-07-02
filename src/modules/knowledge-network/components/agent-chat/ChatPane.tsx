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

import { ClearOutlined, DownOutlined, RightOutlined, SettingOutlined, ThunderboltFilled } from "@ant-design/icons";
import { App, Select } from "antd";
import {
  forwardRef,
  memo,
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

import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildAgentTools,
  effectiveToolArgs,
  runAgentChat,
  DEFAULT_AGENT_CONFIG,
  type AgentChatTurn,
  type AgentChunk,
  type AgentConfig,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  CONTEXT_LOADER_OPS,
  type ContextLoaderEnv,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./AgentChat.module.css";

export const DEFAULT_PROMPT =
  "你是 BKN 业务知识网络的检索助手。基于当前知识网络上的对象类、关系类与逻辑属性回答用户问题。\n" +
  "需要数据时调用提供的检索工具（search_schema / query_object_instance / query_instance_subgraph / run_sql 等），不要编造；" +
  "kn_id 已锁定为当前网络，无需也不要修改。\n" +
  "查询要高效：聚合/排序/计数尽量交给 SQL（run_sql），用 LIMIT 和精确过滤、只取需要的字段，避免拉全表或返回超大结果；已获得的信息不要重复查询，少而准地调用工具。\n" +
  "重要：单个工具返回的文本会被截断到约 8000 字符，超出部分丢失。务必把过滤/聚合下推到查询里，必要时分多次小批查询；若看到「已截断」提示，说明结果不完整，应缩小查询范围重查，切勿把截断结果当作完整数据下结论。\n" +
  "回答简洁、专业，使用中文（可用 Markdown），并在结论里说明依据。";

/** 「仅基础数据」面板默认提示词：只讲表/SQL 工具用法，不提知识网络概念。 */
export const DEFAULT_BASE_PROMPT =
  "你是数据查询助手。你只能使用三个工具直接查询底层数据表回答用户问题：\n" +
  "list_resources（列出可访问的数据表）、describe_resource（查看表的列结构）、run_sql（执行 SQL）。\n" +
  "流程：先用 list_resources 找到相关表，再用 describe_resource 确认列，再写 SQL 查询。\n" +
  "SQL 中的表名必须用模板占位 {{.<resource_id>}} 引用（resource_id 取自 list_resources 的 entries[].resource_id），不能写裸表名；跨 catalog 不能 join。\n" +
  "查询要高效：聚合/排序/计数交给 SQL，用 LIMIT 和精确过滤、只取需要的字段，避免拉全表；" +
  "单个工具返回的文本会被截断到约 8000 字符，若看到「已截断」提示应缩小查询范围重查，切勿把截断结果当作完整数据下结论。\n" +
  "回答简洁、专业，使用中文（可用 Markdown），并在结论里说明依据（用了哪些表 / 什么 SQL）。";

const FALLBACK_SUGGESTIONS = [
  "这个知识网络里有哪些对象类和关系？",
  "帮我查最近活跃的高价值客户",
  "对象类之间是怎么关联的？",
];

export type PaneKey = "solo" | "base" | "kn";

/** 面板画像：决定提示词默认值、是否注入网络摘要、默认工具集与 localStorage 键。 */
export type PaneProfile = {
  paneKey: PaneKey;
  /** 分屏时面板头显示的身份标签（solo 不显示）。 */
  title?: string;
  defaultPrompt: string;
  /** 是否把知识网络摘要拼进系统提示词（「仅基础数据」为 false）。 */
  injectKnContext: boolean;
  /** 默认勾选的工具名；null = 全部（含后端未来新增）。 */
  defaultToolNames: string[] | null;
  /** 视觉高亮（对比模式的「主角」面板：渐变标签 + 面板泛光）。 */
  highlight?: boolean;
};

/** 对比报告用：一轮问答 + 指标。 */
export type PaneRound = {
  question: string;
  answer: string | null;
  tokens: number | null;
  ms: number | null;
  toolCalls: { name: string; status: string }[];
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
const CONFIG_FIELDS: { key: keyof AgentConfig; label: string; hint: string }[] = [
  { key: "maxSteps", label: "工具步数上限", hint: "一轮最多调多少步工具（防跑飞兜底）" },
  { key: "keepToolResults", label: "步间保留结果数", hint: "每步只保留最近 N 个工具结果全文（0=不驱逐）" },
  { key: "dataToolCap", label: "数据类结果上限(字)", hint: "run_sql / query_* 结果字符上限（0=不截断）" },
  { key: "schemaToolCap", label: "Schema类结果上限(字)", hint: "get_kn_detail / search_schema 等（0=不截断）" },
  { key: "maxHistoryMessages", label: "多轮保留条数", hint: "跨轮历史只保留最近 N 条消息" },
  { key: "maxTurnChars", label: "单轮文本上限(字)", hint: "每条历史消息文本封顶" },
  { key: "maxOutputTokens", label: "最大输出token", hint: "单步最大输出(含思考)；推理模型(deepseek)调大，0=模型默认" },
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
  // 默认收起（思考中靠头部闪烁点体现在跑）；用户可手动展开。
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.reasoning}>
      <button type="button" className={`${styles.reasoningHead} ${live ? styles.reasoningLive : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>
          💭 {live ? "思考中" : "思考过程"}
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
  const [open, setOpen] = useState(false);
  const statusDot =
    call.status === "running" ? styles.dotRunning : call.status === "error" ? styles.dotError : styles.dotOk;
  const statusText =
    call.status === "running" ? "调用中…" : call.status === "error" ? "失败" : `200 · ${call.latencyMs ?? "—"}ms`;
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
            <div className={styles.callLbl}>请求 · tools/call → {call.name}</div>
            <pre className={styles.callPre}>{formatArgs(call.args)}</pre>
          </div>
          <div className={styles.callSec}>
            <div className={styles.callLbl}>{call.status === "error" ? "错误" : "响应"}</div>
            <pre className={styles.callPre}>{call.status === "error" ? call.error : call.result ?? "—"}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type ChatPaneProps = {
  env: ContextLoaderEnv;
  tokenProvider: AgentTokenProvider;
  profile: PaneProfile;
  networkName?: string;
  /** 模型列表由父级拉一次，多面板共享。 */
  models: LlmModel[];
  modelsLoaded: boolean;
  /** 知识网络摘要（父级拉取）；是否注入由 profile.injectKnContext 决定。 */
  knContext: string;
  knSummary: { objectTypes: number; relations: number } | null;
  /** 空态建议问题（父级按面板画像定制）。 */
  suggestions: string[];
  /** 实时 tools/list（父级缓存共享）；send 时懒取，picker 展示用已加载值。 */
  getTools: () => Promise<McpToolDef[]>;
  toolDefs: McpToolDef[] | null;
  onBusyChange?: (busy: boolean) => void;
};

export const ChatPane = forwardRef<ChatPaneHandle, ChatPaneProps>(function ChatPane(
  {
    env,
    tokenProvider,
    profile,
    networkName,
    models,
    modelsLoaded,
    knContext,
    knSummary,
    suggestions,
    getTools,
    toolDefs,
    onBusyChange,
  },
  ref,
) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const knId = env.knId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(profile.defaultPrompt);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptView, setPromptView] = useState<"edit" | "full">("edit");
  // 分屏紧凑模式：提示词 + 参数合并进一个「设置」面板。
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfigState] = useState<AgentConfig>(() => loadConfig(profile.paneKey));
  const [cfgOpen, setCfgOpen] = useState(false);
  // 工具勾选（硬限定）：null = 全部。solo 恒为全部（不显示选择器）。
  const [toolSelection, setToolSelection] = useState<string[] | null>(() => loadToolSelection(profile));
  // 会话累计 token + 总时长（像 Claude Code 那样累加）。
  const [stats, setStats] = useState<SessionStats>({ tokens: 0, ms: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  const setConfigField = useCallback(
    (key: keyof AgentConfig, value: number) => {
      setConfigState((prev) => {
        const next = { ...prev, [key]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : prev[key] };
        try {
          localStorage.setItem(configLsKey(profile.paneKey), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [profile.paneKey],
  );
  const resetConfig = useCallback(() => {
    setConfigState({ ...DEFAULT_AGENT_CONFIG });
    try {
      localStorage.removeItem(configLsKey(profile.paneKey));
    } catch {
      /* ignore */
    }
  }, [profile.paneKey]);

  const setToolSelectionPersist = useCallback(
    (next: string[] | null) => {
      setToolSelection(next);
      try {
        localStorage.setItem(toolsLsKey(profile.paneKey), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [profile.paneKey],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

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
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
      next[idx] = updater(next[idx]!);
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
                // 展示实际发出的请求体（含注入的 kn_id 与 schema_brief 等默认值），而非模型原始入参。
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
          updateAssistant((m) => ({ ...m, content: m.content + (m.content ? "\n\n" : "") + `⚠️ ${chunk.error}` }));
          break;
        case "finish":
        default:
          break;
      }
    },
    [updateAssistant, knId],
  );

  // 实际发送的完整系统提示词 = 可编辑提示词 + （按画像）自动附加的知识网络摘要。
  const composedSystem = useMemo(
    () =>
      profile.injectKnContext && knContext
        ? `${systemPrompt}\n\n## 当前知识网络摘要（已自动载入；完整结构与实例请按需调用工具获取）\n${knContext}`
        : systemPrompt,
    [profile.injectKnContext, systemPrompt, knContext],
  );

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      if (!model) {
        message.error("当前没有可用的大模型，请先在「模型工厂」配置默认模型");
        return;
      }

      setBusy(true);
      const startedAt = performance.now();

      // 多轮上下文压缩：只保留最近若干轮，且单轮文本封顶，防长对话纯文本堆大。
      // （工具结果/思考本就不进历史，见 send() 历史只取 role+content。）
      const history: AgentChatTurn[] = messages.slice(-config.maxHistoryMessages).map((m) => ({
        role: m.role,
        content:
          config.maxTurnChars > 0 && m.content.length > config.maxTurnChars
            ? `${m.content.slice(0, config.maxTurnChars)}\n…[历史过长已截断]`
            : m.content,
      }));
      history.push({ role: "user", content: question });
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "", toolCalls: [] },
      ]);

      try {
        const allTools = await getTools();
        // 硬限定：只把勾选的工具传给模型（null = 全部）。
        const activeTools = toolSelection ? allTools.filter((t) => toolSelection.includes(t.name)) : allTools;
        const tools = buildAgentTools(activeTools, env, knId, config, tokenProvider);

        const controller = new AbortController();
        abortRef.current = controller;
        await runAgentChat({
          env,
          modelName: model,
          system: composedSystem,
          history,
          tools,
          config,
          tokenProvider,
          signal: controller.signal,
          onChunk: handleChunk,
        });
      } catch (error) {
        updateAssistant((m) => ({
          ...m,
          content: m.content + (m.content ? "\n\n" : "") + `⚠️ ${error instanceof Error ? error.message : String(error)}`,
        }));
      } finally {
        abortRef.current = null;
        const elapsed = performance.now() - startedAt;
        // 本轮耗时写到最后一条 assistant 消息 + 累计会话总时长（token 已在 usage chunk 累计）。
        setMessages((cur) =>
          cur.map((m, i) => (i === cur.length - 1 && m.role === "assistant" ? { ...m, ms: elapsed } : m)),
        );
        setStats((s) => ({ ...s, ms: s.ms + elapsed }));
        setBusy(false); // 触发下方「完成即持久化」effect
      }
    },
    [busy, model, messages, env, knId, composedSystem, config, toolSelection, getTools, tokenProvider, handleChunk, updateAssistant, message],
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
        current = { question: m.content, answer: null, tokens: null, ms: null, toolCalls: [] };
        rounds.push(current);
      } else if (m.role === "assistant" && current) {
        current.answer = m.content || null;
        current.tokens = m.tokens ?? null;
        current.ms = m.ms ?? null;
        current.toolCalls = (m.toolCalls ?? []).map((tc) => ({ name: tc.name, status: tc.status }));
        current = null;
      }
    }
    return { model, stats, rounds };
  }, [messages, model, stats]);

  useImperativeHandle(
    ref,
    () => ({ send: (text: string) => void send(text), stop, getSnapshot }),
    [send, stop, getSnapshot],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setStats({ tokens: 0, ms: 0 });
    try {
      localStorage.removeItem(msgsLsKey(knId, profile.paneKey));
    } catch {
      /* ignore */
    }
  }, [knId, profile.paneKey]);

  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m.modelName, label: m.default ? `${m.modelName} · 默认` : m.modelName })),
    [models],
  );

  // 与 MCP 侧栏同款分组：本地精选定义带组名，线上新增的归 Knowledge Network。
  const toolOptions = useMemo(() => {
    if (!toolDefs) return [];
    const groupOf = (name: string) => CONTEXT_LOADER_OPS.find((op) => op.id === name)?.group ?? "Knowledge Network";
    const order = [...new Set(CONTEXT_LOADER_OPS.map((op) => op.group))];
    const buckets = new Map<string, { value: string; label: string }[]>();
    for (const t of toolDefs) {
      const g = groupOf(t.name);
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push({ value: t.name, label: t.name });
    }
    return [...buckets.keys()]
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
      })
      .map((g) => ({ label: g, title: g, options: buckets.get(g)! }));
  }, [toolDefs]);
  // 选择器展示值：null（全部）时显示当前已知的全部工具名。
  const toolValue = useMemo(
    () => toolSelection ?? (toolDefs ? toolDefs.map((t) => t.name) : []),
    [toolSelection, toolDefs],
  );

  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;
  const noLlm = modelsLoaded && models.length === 0;
  const sugList = suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;
  // 对比分屏时面板只有半宽：压缩头部（去 label、缩 chip/按钮文案），尽量一行放下。
  const compact = profile.paneKey !== "solo";

  // 提示词编辑器（tabs + 文本框）与参数表格：solo 独立面板 / compact「设置」合并面板共用。
  const promptEditor = (
    <>
      <div className={styles.promptTabs}>
        <button
          type="button"
          className={`${styles.promptTab} ${promptView === "edit" ? styles.promptTabActive : ""}`}
          onClick={() => setPromptView("edit")}
        >
          编辑
        </button>
        <button
          type="button"
          className={`${styles.promptTab} ${promptView === "full" ? styles.promptTabActive : ""}`}
          onClick={() => setPromptView("full")}
        >
          完整（实际发送）
        </button>
        {promptView === "full" ? (
          <button
            type="button"
            className={styles.linkBtn}
            style={{ marginLeft: "auto" }}
            onClick={() => {
              void navigator.clipboard?.writeText(composedSystem).then(() => message.success("已复制完整提示词"));
            }}
          >
            复制
          </button>
        ) : null}
      </div>
      {promptView === "edit" ? (
        <textarea
          className={styles.promptTa}
          value={systemPrompt}
          spellCheck={false}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="系统提示词（修改即时生效，随对话一起发送）"
        />
      ) : (
        <textarea className={`${styles.promptTa} ${styles.promptFull}`} value={composedSystem} readOnly spellCheck={false} />
      )}
    </>
  );

  const paramsGrid = (
    <div className={styles.cfgGrid}>
      {CONFIG_FIELDS.map((f) => (
        <label key={f.key} className={styles.cfgField} title={f.hint}>
          <span className={styles.cfgLabel}>{f.label}</span>
          <input
            type="number"
            min={0}
            className={styles.cfgInput}
            value={config[f.key]}
            onChange={(e) => setConfigField(f.key, Number(e.target.value))}
          />
          <span className={styles.cfgHint}>{f.hint}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className={styles.paneRoot}>
      <div className={`${styles.bar} ${compact ? styles.barCompact : ""}`}>
        {profile.title ? (
          <span
            className={`${styles.paneTitle} ${profile.highlight ? styles.paneTitleHl : ""}`}
            title={
              profile.injectKnContext && knSummary
                ? `已载入网络摘要 · ${knSummary.objectTypes} 对象类 / ${knSummary.relations} 关系类`
                : undefined
            }
          >
            {profile.title}
          </span>
        ) : null}
        <div className={styles.barField}>
          {compact ? null : <span className={styles.barLabel}>模型</span>}
          <Select
            size="small"
            className={styles.modelSelect}
            popupClassName={styles.paneMenu}
            value={model || undefined}
            onChange={setModel}
            options={modelOptions}
            placeholder="选择模型"
            disabled={busy}
            popupMatchSelectWidth={false}
          />
        </div>
        {profile.paneKey !== "solo" ? (
          <div className={styles.barField} title="勾选本面板可用的 MCP 工具（未勾选的不会传给模型）；清空恢复默认">
            {compact ? null : <span className={styles.barLabel}>工具</span>}
            <Select
              size="small"
              mode="multiple"
              className={styles.toolSelect}
              popupClassName={styles.paneMenu}
              value={toolValue}
              onChange={(next: string[]) => setToolSelectionPersist(next)}
              options={toolOptions}
              placeholder={toolDefs ? "选择工具" : toolSelection ? "按已存勾选" : "全部工具"}
              loading={!toolDefs}
              disabled={busy}
              maxTagCount={0}
              maxTagPlaceholder={() =>
                toolSelection === null
                  ? `全部 · ${toolValue.length}`
                  : `已选 ${toolValue.length}${toolDefs ? ` / ${toolDefs.length}` : ""}`
              }
              allowClear
              onClear={() => setToolSelectionPersist(profile.defaultToolNames ? [...profile.defaultToolNames] : null)}
              popupMatchSelectWidth={false}
            />
          </div>
        ) : null}
        {!compact && profile.injectKnContext && knSummary ? (
          <span className={styles.knChip}>
            已载入网络摘要 · {knSummary.objectTypes} 对象类 / {knSummary.relations} 关系类
          </span>
        ) : null}
        {compact ? (
          // 分屏半宽：提示词 / 参数 / 清空合并到「设置」下拉，头部只留核心（标签 + 模型 + 工具）。
          <>
            <button type="button" className={styles.barBtn} onClick={() => setSettingsOpen((v) => !v)}>
              <SettingOutlined /> 设置 {settingsOpen ? <DownOutlined /> : <RightOutlined />}
            </button>
            <button type="button" className={styles.barBtn} onClick={clearChat} disabled={busy || empty} title="清空对话">
              <ClearOutlined /> 清空
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.barBtn} onClick={() => setPromptOpen((v) => !v)}>
              <ThunderboltFilled /> 系统提示词 {promptOpen ? <DownOutlined /> : <RightOutlined />}
            </button>
            <button type="button" className={styles.barBtn} onClick={() => setCfgOpen((v) => !v)}>
              参数 {cfgOpen ? <DownOutlined /> : <RightOutlined />}
            </button>
            <button type="button" className={styles.barBtn} onClick={clearChat} disabled={busy || empty}>
              清空对话
            </button>
          </>
        )}
        {stats.tokens > 0 || stats.ms > 0 ? (
          <span className={styles.statChip} title="本会话累计 token 与总时长">
            Σ {fmtTokens(stats.tokens)}{compact ? "" : " tokens"} · {fmtDuration(stats.ms)}
          </span>
        ) : null}
      </div>
      {compact && settingsOpen ? (
        // 分屏「设置」：系统提示词 + 参数合并在同一面板。
        <div className={styles.cfgPanel}>
          <div className={styles.setSecHead}>
            <ThunderboltFilled /> 系统提示词
            {promptView === "edit" ? (
              <button type="button" className={styles.linkBtn} onClick={() => setSystemPrompt(profile.defaultPrompt)}>
                恢复默认
              </button>
            ) : null}
          </div>
          {promptEditor}
          <div className={styles.setDivider} />
          <div className={styles.setSecHead}>
            参数
            <button type="button" className={styles.linkBtn} onClick={resetConfig}>
              恢复默认
            </button>
          </div>
          {paramsGrid}
          <div className={styles.promptAct}>
            <span className={styles.hint}>
              修改即时生效并保存到本机；参数 0 表示不限制/不截断/不驱逐。kn_id 已锁定为 {knId}。
            </span>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() => {
                persist(messages, stats);
                setSettingsOpen(false);
                message.success("设置已保存");
              }}
            >
              确认
            </button>
          </div>
        </div>
      ) : null}
      {!compact && cfgOpen ? (
        <div className={styles.cfgPanel}>
          {paramsGrid}
          <div className={styles.promptAct}>
            <button type="button" className={styles.linkBtn} onClick={resetConfig}>
              恢复默认
            </button>
            <span className={styles.hint}>已随输入即时保存到 localStorage，无需重新部署。0 表示不限制/不截断/不驱逐。</span>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() => {
                setCfgOpen(false);
                message.success("参数已保存");
              }}
            >
              确认
            </button>
          </div>
        </div>
      ) : null}
      {!compact && promptOpen ? (
        <div className={styles.promptEdit}>
          {promptEditor}
          {promptView === "edit" ? (
            <div className={styles.promptAct}>
              <button type="button" className={styles.linkBtn} onClick={() => setSystemPrompt(profile.defaultPrompt)}>
                恢复默认
              </button>
              <span className={styles.hint}>
                kn_id 已锁定为 {knId}
                {profile.injectKnContext && knSummary ? "；该网络摘要会自动附加（见「完整」）" : ""}。
              </span>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => {
                  persist(messages, stats);
                  setPromptOpen(false);
                  message.success("系统提示词已保存");
                }}
              >
                确认
              </button>
            </div>
          ) : (
            <div className={styles.promptAct}>
              <span className={styles.hint}>
                每轮随对话实际发送给模型的完整系统提示词
                {profile.injectKnContext ? "（你的提示词 + 自动附加的网络摘要）" : "（本面板不附加网络摘要）"}，只读。
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
        {noLlm ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>还没有可用的大模型</h3>
            <p>Agent 对话需要大模型来驱动。请先到「模型工厂」接入一个大模型并设为默认，再回来对话。</p>
            <div className={styles.sugs}>
              <button type="button" className={styles.sug} onClick={() => navigate("/model-resources/models")}>
                <span className={styles.sugText}>去模型工厂接入大模型</span>
                <RightOutlined className={styles.sugArrow} />
              </button>
            </div>
          </div>
        ) : empty ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>{profile.title ?? "Agent 对话"}</h3>
            <p>
              {profile.paneKey === "base" ? (
                <>
                  用自然语言提问，Agent 只能用基础数据工具（list_resources / describe_resource / run_sql）直接查表作答，
                  不借助知识网络语义。
                </>
              ) : (
                <>
                  用自然语言向 Agent 提问，它会基于知识网络 <code>{knId}</code>
                  {networkName ? `（${networkName}）` : ""} 调用检索工具并作答。
                  {knSummary
                    ? `已自动载入网络摘要（${knSummary.objectTypes} 对象类 / ${knSummary.relations} 关系类），无需先浏览。`
                    : ""}
                </>
              )}
            </p>
            <div className={styles.sugs}>
              {sugList.map((s) => (
                <button key={s} type="button" className={styles.sug} onClick={() => void send(s)}>
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
                  <div className={styles.avatar}>{m.role === "user" ? "我" : <ThunderboltFilled />}</div>
                  <div className={styles.bubble}>
                    <div className={styles.who}>{m.role === "user" ? "我" : "Agent"}</div>
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
