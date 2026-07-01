/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 立即体验 · Agent 对话 —— 前端编排的真实工具调用循环 UI。
 * 模型走「模型工厂」(mf-model-api OpenAI 兼容)，检索工具走 agent-retrieval MCP；
 * 上下文全在前端缓存（localStorage，按 kn_id 隔离）。see agent-chat.service.ts。
 * 进入时自动载入选定知识网络的本体结构注入系统提示词（免去先浏览）；回答 Markdown 渲染。
 */

import { DownOutlined, RightOutlined, ThunderboltFilled } from "@ant-design/icons";
import { App, Select } from "antd";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildAgentTools,
  runAgentChat,
  DEFAULT_AGENT_CONFIG,
  type AgentChatTurn,
  type AgentChunk,
  type AgentConfig,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  fetchKnDetail,
  listMcpTools,
  type ContextLoaderEnv,
  type KnDetail,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./AgentChat.module.css";

const DEFAULT_PROMPT =
  "你是 BKN 业务知识网络的检索助手。基于当前知识网络上的对象类、关系类与逻辑属性回答用户问题。\n" +
  "需要数据时调用提供的检索工具（search_schema / query_object_instance / query_instance_subgraph / run_sql 等），不要编造；" +
  "kn_id 已锁定为当前网络，无需也不要修改。\n" +
  "查询要高效：聚合/排序/计数尽量交给 SQL（run_sql），用 LIMIT 和精确过滤、只取需要的字段，避免拉全表或返回超大结果；已获得的信息不要重复查询，少而准地调用工具。\n" +
  "重要：单个工具返回的文本会被截断到约 8000 字符，超出部分丢失。务必把过滤/聚合下推到查询里，必要时分多次小批查询；若看到「已截断」提示，说明结果不完整，应缩小查询范围重查，切勿把截断结果当作完整数据下结论。\n" +
  "回答简洁、专业，使用中文（可用 Markdown），并在结论里说明依据。";

const FALLBACK_SUGGESTIONS = [
  "这个知识网络里有哪些对象类和关系？",
  "帮我查最近活跃的高价值客户",
  "对象类之间是怎么关联的？",
];

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

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDuration(ms: number): string {
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}m${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
}

function lsKey(knId: string): string {
  return `bkn-studio:agentchat:${knId}`;
}

function loadPersisted(knId: string): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(lsKey(knId));
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

/** Agent 调参全局缓存（不分 kn），UI 实时改。 */
const CONFIG_LS_KEY = "bkn-studio:agentconfig";

function loadConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(CONFIG_LS_KEY);
    return raw ? { ...DEFAULT_AGENT_CONFIG, ...(JSON.parse(raw) as Partial<AgentConfig>) } : { ...DEFAULT_AGENT_CONFIG };
  } catch {
    return { ...DEFAULT_AGENT_CONFIG };
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

/**
 * 注入系统提示词的知识网络**摘要**（非完整结构）：名称 + 简介 + 规模 + 对象类名（截断）。
 * 完整本体/实例由 Agent 按需调 get_kn_detail / search_schema 等工具获取。
 */
function buildKnContext(detail: KnDetail): string {
  const otNames = detail.object_types.map((o) => o.name || o.id);
  const shown = otNames.slice(0, 12);
  const lines = [`名称：${detail.name ?? detail.id}（${detail.id}）`];
  if (detail.comment) lines.push(`简介：${detail.comment.replace(/\s+/g, " ").trim().slice(0, 200)}`);
  lines.push(`规模：${detail.object_types.length} 个对象类、${detail.relation_types.length} 个关系类`);
  if (otNames.length) {
    lines.push(`对象类：${shown.join("、")}${otNames.length > shown.length ? ` 等 ${otNames.length} 个` : ""}`);
  }
  return lines.join("\n");
}

/** Markdown 渲染（GFM：表格/删除线/任务列表）。 */
const MarkdownView = memo(function MarkdownView({ text }: { text: string }) {
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

export function AgentChat({
  env,
  networkName,
  tokenProvider,
}: {
  env: ContextLoaderEnv;
  networkName?: string;
  tokenProvider: AgentTokenProvider;
}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const knId = env.knId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptView, setPromptView] = useState<"edit" | "full">("edit");
  const [config, setConfigState] = useState<AgentConfig>(loadConfig);
  const [cfgOpen, setCfgOpen] = useState(false);
  const setConfigField = useCallback((key: keyof AgentConfig, value: number) => {
    setConfigState((prev) => {
      const next = { ...prev, [key]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : prev[key] };
      try {
        localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const resetConfig = useCallback(() => {
    setConfigState({ ...DEFAULT_AGENT_CONFIG });
    try {
      localStorage.removeItem(CONFIG_LS_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  // 自动载入的知识网络本体结构（注入系统提示词；也用于定制建议问题）。
  const [knContext, setKnContext] = useState("");
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  // 会话累计 token + 总时长（像 Claude Code 那样累加）。
  const [stats, setStats] = useState<SessionStats>({ tokens: 0, ms: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mcpToolsRef = useRef<{ knId: string; tools: McpToolDef[] } | null>(null);
  // 是否贴底跟随；用户上滚时置 false，回到底部恢复，避免生成时被强制拽到底。
  const stickRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // 载入持久化对话（按 kn 隔离）。
  useEffect(() => {
    const saved = loadPersisted(knId);
    setMessages(Array.isArray(saved.messages) ? saved.messages : []);
    if (saved.model) setModel(saved.model);
    setSystemPrompt(saved.systemPrompt ?? DEFAULT_PROMPT);
    setStats(saved.stats ?? { tokens: 0, ms: 0 });
    mcpToolsRef.current = null;
  }, [knId]);

  // 拉模型列表（模型工厂），默认选系统默认模型。
  useEffect(() => {
    let cancelled = false;
    listLlmModels({ page: 1, size: 100 })
      .then((res) => {
        if (cancelled) return;
        setModels(res.items);
        setModel((prev) => {
          if (prev && res.items.some((m) => m.modelName === prev)) return prev;
          return res.items.find((m) => m.default)?.modelName ?? res.items[0]?.modelName ?? "";
        });
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 自动载入选定知识网络的本体结构 → 注入系统提示词 + 定制建议（免去先浏览业务知识网络）。
  useEffect(() => {
    let cancelled = false;
    setKnContext("");
    setKnSummary(null);
    setSuggestions(FALLBACK_SUGGESTIONS);
    fetchKnDetail(env)
      .then((detail) => {
        if (cancelled) return;
        setKnContext(buildKnContext(detail));
        setKnSummary({ objectTypes: detail.object_types.length, relations: detail.relation_types.length });
        const firstOt = detail.object_types[0];
        const firstRel = detail.relation_types[0];
        const tailored: string[] = ["列出这个知识网络的对象类和关系类"];
        if (firstOt) tailored.push(`${firstOt.name ?? firstOt.id} 有哪些数据？举几条实例`);
        if (firstRel) tailored.push(`${firstRel.name ?? firstRel.id} 关系连接了哪些对象？`);
        setSuggestions(tailored.length >= 2 ? tailored : FALLBACK_SUGGESTIONS);
      })
      .catch(() => {
        /* 占位符 / 无权限网络拉不到结构时，回退默认建议，Agent 仍可用工具探索 */
      });
    return () => {
      cancelled = true;
    };
  }, [env]);

  const persist = useCallback(
    (msgs: ChatMessage[], statsSnapshot: SessionStats) => {
      try {
        localStorage.setItem(
          lsKey(knId),
          JSON.stringify({ messages: msgs, model, systemPrompt, stats: statsSnapshot } satisfies Persisted),
        );
      } catch {
        /* localStorage 不可用时忽略 */
      }
    },
    [knId, model, systemPrompt],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
              { id: chunk.id, name: chunk.name, args: chunk.args, status: "running", startedAt: performance.now() },
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
    [updateAssistant],
  );

  // 实际发送的完整系统提示词 = 可编辑提示词 + 自动附加的知识网络摘要。
  const composedSystem = useMemo(
    () =>
      knContext
        ? `${systemPrompt}\n\n## 当前知识网络摘要（已自动载入；完整结构与实例请按需调用工具获取）\n${knContext}`
        : systemPrompt,
    [systemPrompt, knContext],
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
      setInput("");
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
        if (!mcpToolsRef.current || mcpToolsRef.current.knId !== knId) {
          mcpToolsRef.current = { knId, tools: await listMcpTools(env) };
        }
        const tools = buildAgentTools(mcpToolsRef.current.tools, env, knId, config, tokenProvider);

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
        setBusy(false);
        const elapsed = performance.now() - startedAt;
        // 本轮耗时写到最后一条 assistant 消息 + 累计会话总时长；token 已在 usage chunk 累计。
        setStats((prevStats) => {
          const nextStats = { ...prevStats, ms: prevStats.ms + elapsed };
          setMessages((prevMsgs) => {
            const nextMsgs = prevMsgs.map((m, i) =>
              i === prevMsgs.length - 1 && m.role === "assistant" ? { ...m, ms: elapsed } : m,
            );
            persist(nextMsgs, nextStats);
            return nextMsgs;
          });
          return nextStats;
        });
      }
    },
    [busy, model, messages, env, knId, composedSystem, config, tokenProvider, handleChunk, updateAssistant, persist, message],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStats({ tokens: 0, ms: 0 });
    try {
      localStorage.removeItem(lsKey(knId));
    } catch {
      /* ignore */
    }
  }, [knId]);

  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m.modelName, label: m.default ? `${m.modelName} · 默认` : m.modelName })),
    [models],
  );

  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;
  const noLlm = modelsLoaded && models.length === 0;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.barField}>
          <span className={styles.barLabel}>模型</span>
          <Select
            size="small"
            className={styles.modelSelect}
            value={model || undefined}
            onChange={setModel}
            options={modelOptions}
            placeholder="选择模型"
            disabled={busy}
            popupMatchSelectWidth={false}
          />
        </div>
        {knSummary ? (
          <span className={styles.knChip}>
            已载入网络摘要 · {knSummary.objectTypes} 对象类 / {knSummary.relations} 关系类
          </span>
        ) : null}
        <button type="button" className={styles.barBtn} onClick={() => setPromptOpen((v) => !v)}>
          <ThunderboltFilled /> 系统提示词 {promptOpen ? <DownOutlined /> : <RightOutlined />}
        </button>
        <button type="button" className={styles.barBtn} onClick={() => setCfgOpen((v) => !v)}>
          参数 {cfgOpen ? <DownOutlined /> : <RightOutlined />}
        </button>
        <button type="button" className={styles.barBtn} onClick={clearChat} disabled={busy || empty}>
          清空对话
        </button>
        {stats.tokens > 0 || stats.ms > 0 ? (
          <span className={styles.statChip} title="本会话累计 token 与总时长">
            Σ {fmtTokens(stats.tokens)} tokens · {fmtDuration(stats.ms)}
          </span>
        ) : null}
      </div>
      {cfgOpen ? (
        <div className={styles.cfgPanel}>
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
      {promptOpen ? (
        <div className={styles.promptEdit}>
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
            <>
              <textarea
                value={systemPrompt}
                spellCheck={false}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="系统提示词（修改即时生效，随对话一起发送）"
              />
              <div className={styles.promptAct}>
                <button type="button" className={styles.linkBtn} onClick={() => setSystemPrompt(DEFAULT_PROMPT)}>
                  恢复默认
                </button>
                <span className={styles.hint}>
                  kn_id 已锁定为 {knId}
                  {knSummary ? "；该网络摘要会自动附加（见「完整」）" : ""}。
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
            </>
          ) : (
            <>
              <textarea className={styles.promptFull} value={composedSystem} readOnly spellCheck={false} />
              <div className={styles.promptAct}>
                <span className={styles.hint}>每轮随对话实际发送给模型的完整系统提示词（你的提示词 + 自动附加的网络摘要），只读。</span>
              </div>
            </>
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
            <h3>Agent 对话</h3>
            <p>
              用自然语言向 Agent 提问，它会基于知识网络 <code>{knId}</code>
              {networkName ? `（${networkName}）` : ""} 调用检索工具并作答。
              {knSummary ? `已自动载入网络摘要（${knSummary.objectTypes} 对象类 / ${knSummary.relations} 关系类），无需先浏览。` : ""}
            </p>
            <div className={styles.sugs}>
              {suggestions.map((s) => (
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

      <div className={styles.composer}>
        <div className={styles.cwrap}>
          <textarea
            className={styles.cInput}
            value={input}
            rows={1}
            disabled={noLlm}
            placeholder={
              noLlm
                ? "请先在「模型工厂」接入大模型后再对话"
                : `向 Agent 提问，例如：${suggestions[0] ?? "这个知识网络里有哪些对象类和关系？"}`
            }
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 跳过中文输入法组字中的回车（确认候选词），避免误发送。
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className={styles.stopBtn} onClick={stop}>
              停止
            </button>
          ) : (
            <button type="button" className={styles.sendBtn} onClick={() => void send(input)} disabled={!input.trim()}>
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
