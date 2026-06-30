/**
 * 立即体验 · Agent 对话 —— 前端编排的真实工具调用循环 UI。
 * 模型走「模型工厂」(mf-model-api OpenAI 兼容)，检索工具走 agent-retrieval MCP；
 * 上下文全在前端缓存（localStorage，按 kn_id 隔离）。see agent-chat.service.ts。
 */

import { DownOutlined, RightOutlined, ThunderboltFilled } from "@ant-design/icons";
import { App, Select } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildAgentTools,
  runAgentChat,
  type AgentChatTurn,
  type AgentChunk,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  listMcpTools,
  type ContextLoaderEnv,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./AgentChat.module.css";

const DEFAULT_PROMPT =
  "你是 BKN 业务知识网络的检索助手。基于当前知识网络上的对象类、关系类与逻辑属性回答用户问题。\n" +
  "需要数据时调用提供的检索工具（search_schema / query_object_instance / query_instance_subgraph / run_sql 等），不要编造；" +
  "kn_id 已锁定为当前网络，无需也不要修改。回答简洁、专业，使用中文，并在结论里说明依据。";

const SUGGESTIONS = [
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
};

type Persisted = { messages: ChatMessage[]; model: string; systemPrompt: string };

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

function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
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

export function AgentChat({ env, networkName }: { env: ContextLoaderEnv; networkName?: string }) {
  const { message } = App.useApp();
  const knId = env.knId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [promptOpen, setPromptOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 缓存 MCP 工具定义（tools/list）；按 kn 失效重取。
  const mcpToolsRef = useRef<{ knId: string; tools: McpToolDef[] } | null>(null);

  // 载入持久化对话（按 kn 隔离）。
  useEffect(() => {
    const saved = loadPersisted(knId);
    setMessages(Array.isArray(saved.messages) ? saved.messages : []);
    if (saved.model) setModel(saved.model);
    setSystemPrompt(saved.systemPrompt ?? DEFAULT_PROMPT);
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
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 持久化（对话除外，对话在每轮结束时落盘，避免逐字写）。
  const persist = useCallback(
    (msgs: ChatMessage[]) => {
      try {
        const data: Persisted = { messages: msgs, model, systemPrompt };
        localStorage.setItem(lsKey(knId), JSON.stringify(data));
      } catch {
        /* localStorage 不可用时忽略 */
      }
    },
    [knId, model, systemPrompt],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /** 更新当前（最后一条）assistant 消息。 */
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
        case "error":
          updateAssistant((m) => ({ ...m, content: m.content + (m.content ? "\n\n" : "") + `⚠️ ${chunk.error}` }));
          break;
        case "finish":
          break;
        default:
          break;
      }
    },
    [updateAssistant],
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

      // 先拼历史（不含本轮），再 push user + assistant 占位。
      const history: AgentChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: question });
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "", toolCalls: [] },
      ]);

      try {
        // 构造/复用工具：tools/list 按 kn 缓存；每轮新建会话以用当轮新鲜 token。
        if (!mcpToolsRef.current || mcpToolsRef.current.knId !== knId) {
          const tools = await listMcpTools(env);
          mcpToolsRef.current = { knId, tools };
        }
        const tools = buildAgentTools(mcpToolsRef.current.tools, env, knId);

        const controller = new AbortController();
        abortRef.current = controller;
        await runAgentChat({
          env,
          modelName: model,
          system: systemPrompt,
          history,
          tools,
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
        setMessages((cur) => {
          persist(cur);
          return cur;
        });
      }
    },
    [busy, model, messages, env, knId, systemPrompt, handleChunk, updateAssistant, persist, message],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
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

  return (
    <div className={styles.root}>
      {/* 顶部工具条：模型选择 + 系统提示词 + 清空 */}
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
        <button type="button" className={styles.barBtn} onClick={() => setPromptOpen((v) => !v)}>
          <ThunderboltFilled /> 系统提示词 {promptOpen ? <DownOutlined /> : <RightOutlined />}
        </button>
        <button type="button" className={styles.barBtn} onClick={clearChat} disabled={busy || empty}>
          清空对话
        </button>
      </div>
      {promptOpen ? (
        <div className={styles.promptEdit}>
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
            <span className={styles.hint}>kn_id 已锁定为 {knId}，无需在提示词里指定。</span>
          </div>
        </div>
      ) : null}

      {/* 消息区 */}
      <div className={styles.scroll} ref={scrollRef}>
        {empty ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>Agent 对话</h3>
            <p>
              用自然语言向 Agent 提问，它会基于知识网络 <code>{knId}</code>
              {networkName ? `（${networkName}）` : ""} 调用检索工具并作答。
            </p>
            <div className={styles.sugs}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={styles.sug} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.wrap}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgBot}`}>
                <div className={styles.avatar}>{m.role === "user" ? "我" : <ThunderboltFilled />}</div>
                <div className={styles.bubble}>
                  <div className={styles.who}>{m.role === "user" ? "我" : "Agent"}</div>
                  {m.toolCalls && m.toolCalls.length > 0 ? (
                    <div className={styles.calls}>
                      {m.toolCalls.map((tc) => (
                        <ToolCallCard key={tc.id} call={tc} />
                      ))}
                    </div>
                  ) : null}
                  {m.content ? (
                    <div className={styles.txt}>{m.content}</div>
                  ) : m.role === "assistant" && busy && i === messages.length - 1 && (!m.toolCalls || m.toolCalls.length === 0) ? (
                    <div className={styles.typing}>
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className={styles.composer}>
        <div className={styles.cwrap}>
          <textarea
            className={styles.cInput}
            value={input}
            rows={1}
            placeholder="向 Agent 提问，例如：最近活跃的高价值客户有哪些？"
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
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
