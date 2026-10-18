/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Agent chat single-session pane extracted from AgentChat. It owns its message history, stats,
 * and the in-flight execution. The model/tool loop runs in BKN Agent (studio_smart_qa); this pane
 * submits each question and renders the streamed events. The parent drives it through
 * ref { send, stop, clear }.
 */

import { DownOutlined, RightOutlined, ThunderboltFilled } from "@ant-design/icons";
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
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import type { NormalizedAgentError } from "@/modules/knowledge-network/services/agent-error";
import {
  BknAgentExecutionError,
  cancelExecution,
  executionRequestError,
  getExecution,
  newClientRequestId,
  startExecution,
  terminalError,
  type ExecutionEvent,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import type { ContextLoaderEnv } from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./AgentChat.module.css";
import { closeOpenMarkdown, splitMarkdownBlocks } from "./markdown-blocks";

const FALLBACK_SUGGESTION_KEYS = [
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.relations",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.customers",
  "knowledgeNetwork.agentChat.chatPane.fallbackSuggestions.links",
];

export type ChatPaneHandle = {
  send: (text: string) => void;
  stop: () => void;
  clear: () => void;
};

type ToolCallView = {
  id: string;
  name: string;
  args: unknown;
  status: "running" | "done" | "error";
  result?: string;
  error?: string;
  /** Only present in history from the former browser loop. */
  clientBlocked?: boolean;
  /** For a failed call: unavailable when it did not go through at all. */
  errorKind?: "unavailable" | "error";
  startedAt: number;
  latencyMs?: number;
};

/**
 * Ordered render segment. A turn interleaves tool calls and text across several
 * steps; parts preserve that order so a run of consecutive calls can collapse
 * into one group and text output starts the next run.
 */
type MessagePart = { kind: "text"; text: string } | { kind: "tools"; ids: string[] };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** The model's streamed thinking, shown collapsed above the answer. */
  reasoning?: string;
  toolCalls?: ToolCallView[];
  /** Render order only; content and toolCalls stay flat for history. */
  parts?: MessagePart[];
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

/**
 * History written by the former browser loop also carried model and systemPrompt; those
 * fields are ignored now, and its messages stay readable. A missing threadId starts a new
 * server thread on the next send.
 */
type Persisted = {
  messages: ChatMessage[];
  stats?: SessionStats;
  threadId?: string;
};

/** The committed answer as the turn's text, keeping its tool calls in place. */
function withAnswer(m: ChatMessage, answer: string): ChatMessage {
  const parts = (m.parts ?? []).filter((part) => part.kind === "tools");
  return { ...m, content: answer, parts: [...parts, { kind: "text", text: answer }] };
}

function appendTextPart(parts: MessagePart[] | undefined, delta: string): MessagePart[] {
  const next = [...(parts ?? [])];
  const last = next[next.length - 1];
  if (last?.kind === "text") next[next.length - 1] = { kind: "text", text: last.text + delta };
  else next.push({ kind: "text", text: delta });
  return next;
}

function appendToolPart(parts: MessagePart[] | undefined, id: string): MessagePart[] {
  const next = [...(parts ?? [])];
  const last = next[next.length - 1];
  if (last?.kind === "tools") next[next.length - 1] = { kind: "tools", ids: [...last.ids, id] };
  else next.push({ kind: "tools", ids: [id] });
  return next;
}

/** Messages persisted before parts existed: all calls first, then all text. */
function legacyParts(m: ChatMessage): MessagePart[] {
  const parts: MessagePart[] = [];
  if (m.toolCalls?.length) parts.push({ kind: "tools", ids: m.toolCalls.map((tc) => tc.id) });
  if (m.content) parts.push({ kind: "text", text: m.content });
  return parts;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDuration(ms: number): string {
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}m${Math.round(s % 60)}s` : `${s.toFixed(1)}s`;
}

/**
 * Message-history key. The value keeps the legacy format so existing chat history stays readable.
 */
function msgsLsKey(knId: string): string {
  return `bkn-studio:agentchat:${knId}`;
}

function loadPersisted(key: string): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(key);
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

/** One Markdown block. memo keeps stable blocks from reparsing during streaming. */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;
});

/**
 * Markdown rendering with GFM. Streaming renders by block and completes the
 * active tail to avoid reparsing the entire body on every token.
 */
export const MarkdownView = memo(function MarkdownView({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
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

/**
 * A call that did not go through. History saved before the backend reported error_kind has
 * failures without it; those keep the red "failed" they were shown with then.
 */
function callUnavailable(call: ToolCallView): boolean {
  return call.status === "error" && (call.errorKind ?? "unavailable") === "unavailable";
}

/** Streaming reasoning_content display; live reasoning auto-expands. */
function ReasoningBlock({ text, live }: { text: string; live: boolean }) {
  const { t } = useTranslation();
  // Collapsed by default; users can expand manually.
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.reasoning}>
      <button
        type="button"
        className={`${styles.reasoningHead} ${live ? styles.reasoningLive : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {live
            ? t("knowledgeNetwork.agentChat.chatPane.reasoning.live")
            : t("knowledgeNetwork.agentChat.chatPane.reasoning.done")}
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
function ToolCallCard({
  call,
  open,
  onToggle,
  t,
}: {
  call: ToolCallView;
  open: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const statusDot =
    call.status === "running"
      ? styles.dotRunning
      : call.status === "error"
        ? callUnavailable(call)
          ? styles.dotError
          : styles.dotWarn
        : styles.dotOk;
  const statusText = call.clientBlocked
    ? t("knowledgeNetwork.agentChat.chatPane.toolCall.clientBlocked")
    : call.status === "running"
      ? t("knowledgeNetwork.agentChat.chatPane.toolCall.running")
      : call.status === "error"
        ? `${t(
            callUnavailable(call)
              ? "knowledgeNetwork.agentChat.chatPane.toolCall.failed"
              : "knowledgeNetwork.agentChat.chatPane.toolCall.returnedError",
          )}${call.latencyMs === undefined ? "" : ` - ${call.latencyMs}ms`}`
        : `200 - ${call.latencyMs ?? "-"}ms`;
  const requestLabel = call.clientBlocked
    ? t("knowledgeNetwork.agentChat.chatPane.toolCall.clientBlockedRequest", { name: call.name })
    : t("knowledgeNetwork.agentChat.chatPane.toolCall.request", { name: call.name });
  return (
    <div className={`${styles.call} ${open ? styles.callOpen : ""}`}>
      <button
        type="button"
        className={`${styles.callHead} ${call.status === "running" ? styles.callLive : ""}`}
        onClick={onToggle}
      >
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
            <pre className={styles.callPre}>
              {call.status === "error" ? call.error : (call.result ?? "-")}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One run of consecutive tool calls. A lone call stays a bare card; a run collapses
 * into a single closed group so the transcript reads as text, not as a wall of calls.
 *
 * Card expansion is held here, keyed by call id. A streaming run switches from the
 * bare card to the group the moment its second call arrives, and that swaps the child
 * structure, so state owned by the card itself would be thrown away mid-stream: the
 * card a user just expanded to read the request would silently close. For the same
 * reason the group opens by default when a card inside it is already expanded.
 */
function ToolCallSegment({
  calls,
  live = false,
  t,
}: {
  calls: ToolCallView[];
  /** The turn is still streaming and this is its latest run of calls. */
  live?: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [openCalls, setOpenCalls] = useState<Record<string, boolean>>({});
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null);
  const toggleCall = (id: string) => setOpenCalls((prev) => ({ ...prev, [id]: !prev[id] }));
  if (calls.length === 0) return null;
  if (calls.length === 1) {
    return (
      <div className={styles.calls}>
        <ToolCallCard
          call={calls[0]}
          open={!!openCalls[calls[0].id]}
          onToggle={() => toggleCall(calls[0].id)}
          t={t}
        />
      </div>
    );
  }
  // While the turn is still working (the model thinking between calls), the run is
  // in progress even if no single call is running right now.
  const running = live || calls.some((call) => call.status === "running");
  const failed = calls.filter((call) => call.status === "error").length;
  // Only calls that did not go through are failures worth flagging; errors a tool
  // returned (bad syntax, say) are trial and error the model works around, and
  // the card shows them individually.
  const unavailable = calls.filter(callUnavailable).length;
  const showFailed = unavailable > 0;
  const statusDot = running ? styles.dotRunning : showFailed ? styles.dotError : styles.dotOk;
  const totalMs = `${calls.reduce((ms, call) => ms + (call.latencyMs ?? 0), 0)}ms`;
  const meta = running
    ? t("knowledgeNetwork.agentChat.chatPane.toolCall.running")
    : showFailed
      ? t("knowledgeNetwork.agentChat.chatPane.toolGroup.failed", { count: unavailable })
      : failed > 0
        ? `${totalMs} · ${t("knowledgeNetwork.agentChat.chatPane.toolGroup.someFailed", { count: failed })}`
        : totalMs;
  // Once the user has toggled the group, their choice wins over the expanded-card default.
  const open = groupOpen ?? calls.some((call) => openCalls[call.id]);
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={`${styles.callHead} ${running ? styles.callLive : ""}`}
        onClick={() => setGroupOpen(!open)}
      >
        <span className={styles.verb}>MCP</span>
        <span className={styles.callName}>
          {t("knowledgeNetwork.agentChat.chatPane.toolGroup.summary", { count: calls.length })}
        </span>
        <span className={`${styles.dot} ${statusDot}`} />
        <span className={styles.callMeta}>{meta}</span>
        <span className={styles.chev}>{open ? <DownOutlined /> : <RightOutlined />}</span>
      </button>
      {open ? (
        <div className={styles.groupBody}>
          {calls.map((call) => (
            <ToolCallCard
              key={call.id}
              call={call}
              open={!!openCalls[call.id]}
              onToggle={() => toggleCall(call.id)}
              t={t}
            />
          ))}
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
            {t("knowledgeNetwork.agentChat.chatPane.error.detail")}{" "}
            {open ? <DownOutlined /> : <RightOutlined />}
          </button>
        ) : null}
      </div>
      {open && err.detail ? <pre className={styles.errPre}>{err.detail}</pre> : null}
    </div>
  );
}

/** Tool projections arrive as JSON values; cards show them as text. */
function formatToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  // MCP tools return content blocks; show their text rather than the escaped JSON.
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (block) =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
  ) {
    return (value as { text: string }[]).map((block) => block.text).join("\n");
  }
  return formatArgs(value);
}

export type ChatPaneProps = {
  env: ContextLoaderEnv;
  /** Credential for BKN Agent executions: OAuth session or bak_ AppKey. */
  tokenProvider: AgentTokenProvider;
  emptyTitle?: string;
  networkName?: string;
  knSummary: { objectTypes: number; relations: number } | null;
  /** Empty-state suggestions generated by the parent. */
  suggestions: string[];
  /** Suggestion click callback; the parent routes it through its send guard. */
  onPick?: (question: string) => void;
  /**
   * Page-level scroll container for the QA workspace. Messages do not scroll
   * inside the pane; this container owns reading and stick-to-bottom behavior.
   */
  pageScrollRef: RefObject<HTMLDivElement | null>;
  onBusyChange?: (busy: boolean) => void;
};

export const ChatPane = forwardRef<ChatPaneHandle, ChatPaneProps>(function ChatPane(
  {
    env,
    tokenProvider,
    emptyTitle,
    networkName,
    knSummary,
    suggestions,
    onPick,
    pageScrollRef,
    onBusyChange,
  },
  ref,
) {
  const { t } = useTranslation();
  const knId = env.knId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  // Cumulative session tokens and elapsed time.
  const [stats, setStats] = useState<SessionStats>({ tokens: 0, ms: 0 });
  // Server thread for this network's conversation; switching networks uses another history key.
  const [threadId, setThreadId] = useState<string | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);
  // Run being streamed, so stop can ask the server to cancel it.
  const runIdRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);
  // Stick-to-bottom flag; user scrolling up disables forced bottom following.
  const stickRef = useRef(true);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Abort in-flight streaming when unmounted; the server cancels on disconnect.
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
    runIdRef.current = null;
    setBusy(false);
  }, [knId]);

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

  // Load persisted chat history, isolated by KN.
  useEffect(() => {
    const saved = loadPersisted(msgsLsKey(knId));
    setMessages(Array.isArray(saved.messages) ? saved.messages : []);
    setStats(saved.stats ?? { tokens: 0, ms: 0 });
    setThreadId(typeof saved.threadId === "string" ? saved.threadId : undefined);
  }, [knId]);

  const persist = useCallback(
    (msgs: ChatMessage[], statsSnapshot: SessionStats, thread: string | undefined) => {
      try {
        localStorage.setItem(
          msgsLsKey(knId),
          JSON.stringify({
            messages: msgs,
            stats: statsSnapshot,
            threadId: thread,
          } satisfies Persisted),
        );
      } catch {
        /* Ignore unavailable localStorage. */
      }
    },
    [knId],
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
    if (prevBusyRef.current && !busy && messages.length) persist(messages, stats, threadId);
    prevBusyRef.current = busy;
  }, [busy, messages, stats, threadId, persist]);

  const updateAssistant = useCallback((updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const idx = next.length - 1;
      next[idx] = updater(next[idx]);
      return next;
    });
  }, []);

  const addError = useCallback(
    (error: NormalizedAgentError) =>
      updateAssistant((m) => ({ ...m, errored: true, errors: [...(m.errors ?? []), error] })),
    [updateAssistant],
  );

  const handleEvent = useCallback(
    (event: ExecutionEvent) => {
      switch (event.type) {
        case "meta":
          runIdRef.current = event.runId;
          if (event.threadId) setThreadId(event.threadId);
          break;
        case "token":
          updateAssistant((m) => ({
            ...m,
            content: m.content + event.content,
            parts: appendTextPart(m.parts, event.content),
          }));
          break;
        case "reasoning":
          // One merged block above the turn, as before the migration.
          updateAssistant((m) => ({ ...m, reasoning: (m.reasoning ?? "") + event.content }));
          break;
        case "tool_started":
          updateAssistant((m) => ({
            ...m,
            parts: appendToolPart(m.parts, event.id),
            toolCalls: [
              ...(m.toolCalls ?? []),
              {
                id: event.id,
                name: event.name,
                args: event.input,
                status: "running",
                startedAt: performance.now(),
              },
            ],
          }));
          break;
        case "tool_finished":
          updateAssistant((m) => ({
            ...m,
            toolCalls: (m.toolCalls ?? []).map((tc) =>
              tc.id === event.id
                ? {
                    ...tc,
                    status: event.status === "failed" ? "error" : "done",
                    errorKind: event.errorKind,
                    result: event.status === "failed" ? undefined : formatToolValue(event.output),
                    error:
                      event.status === "failed"
                        ? formatToolValue(event.error ?? event.output)
                        : undefined,
                    latencyMs: event.durationMs ?? Math.round(performance.now() - tc.startedAt),
                  }
                : tc,
            ),
          }));
          break;
        case "usage": {
          const total = event.usage?.total_tokens;
          if (typeof total === "number") {
            updateAssistant((m) => ({ ...m, tokens: total }));
            setStats((s) => ({ ...s, tokens: s.tokens + total }));
          }
          break;
        }
        case "terminal":
          if (event.status === "cancelled") updateAssistant((m) => ({ ...m, stopped: true }));
          else if (event.status === "failed")
            addError(
              terminalError(event.code, {
                detail: event.detail,
                upstream: event.upstream,
                runId: event.runId,
              }),
            );
          break;
        case "result":
          // Tokens normally carry the answer already; a run that streamed none
          // (a replayed retry, say) still shows the committed one.
          if (event.answer) updateAssistant((m) => (m.content ? m : withAnswer(m, event.answer)));
          break;
        default:
          break;
      }
    },
    [updateAssistant, addError],
  );

  /**
   * The stream ended without a terminal event, so read what the server committed. A
   * committed answer that never streamed fills the bubble; anything else is reported.
   */
  const recover = useCallback(
    async (runId: string | null) => {
      if (!runId) {
        addError(executionRequestError(new Error("stream ended before the run started")));
        return;
      }
      try {
        const record = await getExecution({ base: env.base, tokenProvider, runId });
        if (record.status === "succeeded") {
          const answer = record.result?.answer ?? "";
          // A dropped stream may have shown only part of the answer; the committed
          // one replaces it rather than leaving a silently truncated reply.
          updateAssistant((m) =>
            !answer || m.content.trimEnd().endsWith(answer.trimEnd()) ? m : withAnswer(m, answer),
          );
        } else if (record.status === "cancelled") {
          updateAssistant((m) => ({ ...m, stopped: true }));
        } else if (record.status === "failed") {
          addError(
            terminalError(record.error?.code, {
              detail: record.error?.detail,
              upstream: record.error?.upstream,
              runId,
            }),
          );
        } else {
          addError(executionRequestError(new Error(`run is still ${record.status}`)));
        }
      } catch (error) {
        addError(executionRequestError(error));
      }
    },
    [env.base, tokenProvider, updateAssistant, addError],
  );

  const send = useCallback(
    async (text: string, options: { replaceLastRound?: boolean } = {}) => {
      const question = text.trim();
      if (!question || busy) return;

      setBusy(true);
      const requestSequence = ++requestSequenceRef.current;
      const isCurrent = () => requestSequence === requestSequenceRef.current;
      const startedAt = performance.now();

      // Retry by removing the failed user+assistant pair and sending again.
      const kept =
        options.replaceLastRound &&
        messages.length >= 2 &&
        messages[messages.length - 1].role === "assistant" &&
        messages[messages.length - 2].role === "user"
          ? messages.slice(0, -2)
          : messages;
      setMessages(() => [
        ...kept,
        { role: "user", content: question },
        { role: "assistant", content: "", toolCalls: [], parts: [] },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      runIdRef.current = null;
      const execute = (thread: string | undefined) =>
        startExecution({
          base: env.base,
          tokenProvider,
          knId,
          message: question,
          clientRequestId: newClientRequestId(),
          threadId: thread,
          signal: controller.signal,
          onEvent: (event) => {
            if (isCurrent()) handleEvent(event);
          },
        });
      try {
        let terminal;
        try {
          terminal = await execute(threadId);
        } catch (error) {
          // The server forgot this thread (for example after a reinstall). History stays
          // on screen; continue in a new thread instead of failing every later turn.
          if (
            threadId &&
            error instanceof BknAgentExecutionError &&
            error.status === 404 &&
            !controller.signal.aborted
          ) {
            // Keep the saved thread until a new one actually starts: the same 404
            // also means the Agent is unpublished, and then the old thread must
            // survive for when it is published again. meta replaces it on success.
            terminal = await execute(undefined);
          } else {
            throw error;
          }
        }
        if (!terminal && isCurrent() && !controller.signal.aborted) {
          await recover(runIdRef.current);
        }
      } catch (error) {
        if (!isCurrent()) return;
        if (controller.signal.aborted) {
          // User stopped mid-turn; keep partial content and mark the turn stopped.
          updateAssistant((m) => ({ ...m, stopped: true }));
        } else {
          addError(executionRequestError(error));
        }
      } finally {
        if (isCurrent()) {
          abortRef.current = null;
          runIdRef.current = null;
          const elapsed = performance.now() - startedAt;
          const now = performance.now();
          const interrupted = t("knowledgeNetwork.agentChat.chatPane.toolCall.interrupted");
          // Record turn elapsed time on the final assistant message and cumulative stats. A
          // call still running when the turn ended never got a result; close it with its time.
          setMessages((cur) =>
            cur.map((m, i) =>
              i === cur.length - 1 && m.role === "assistant"
                ? {
                    ...m,
                    ms: elapsed,
                    toolCalls: m.toolCalls?.map((tc) =>
                      tc.status === "running"
                        ? {
                            ...tc,
                            status: "error",
                            // Cut off by the turn, not refused by the tool.
                            errorKind: "error",
                            error: interrupted,
                            latencyMs: Math.round(now - tc.startedAt),
                          }
                        : tc,
                    ),
                  }
                : m,
            ),
          );
          setStats((s) => ({ ...s, ms: s.ms + elapsed }));
          setBusy(false); // Triggers the persist-on-completion effect above.
        }
      }
    },
    [
      busy,
      messages,
      env.base,
      knId,
      threadId,
      tokenProvider,
      handleEvent,
      recover,
      updateAssistant,
      addError,
      t,
    ],
  );

  const stop = useCallback(() => {
    // Ask the server to cancel explicitly; closing the stream also cancels it, so a
    // failed cancel request needs no handling here.
    const runId = runIdRef.current;
    if (runId) {
      void cancelExecution({ base: env.base, tokenProvider, runId }).catch(() => undefined);
    }
    abortRef.current?.abort();
  }, [env.base, tokenProvider]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStats({ tokens: 0, ms: 0 });
    // Clearing chat starts a new server thread on the next send.
    setThreadId(undefined);
    try {
      localStorage.removeItem(msgsLsKey(knId));
    } catch {
      /* ignore */
    }
  }, [knId]);

  useImperativeHandle(
    ref,
    () => ({
      send: (text: string) => void send(text),
      stop,
      clear: clearChat,
    }),
    [send, stop, clearChat],
  );

  const empty = messages.length === 0;
  const lastIdx = messages.length - 1;
  const fallbackSuggestionList = useMemo(() => FALLBACK_SUGGESTION_KEYS.map((key) => t(key)), [t]);
  const sugList = suggestions.length > 0 ? suggestions : fallbackSuggestionList;

  return (
    <div className={styles.paneRoot}>
      <div className={styles.scroll}>
        {empty ? (
          <div className={styles.intro}>
            <div className={styles.introGlyph}>
              <ThunderboltFilled />
            </div>
            <h3>{emptyTitle ?? t("knowledgeNetwork.agentChat.chatPane.empty.start")}</h3>
            <p>
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
              // Assistant turns render by segment order; user turns are plain text.
              const renderParts = m.role === "assistant" ? (m.parts ?? legacyParts(m)) : [];
              const callById = new Map((m.toolCalls ?? []).map((tc) => [tc.id, tc]));
              return (
                <div
                  key={i}
                  className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgBot}`}
                >
                  <div className={styles.avatar}>
                    {m.role === "user" ? (
                      t("knowledgeNetwork.agentChat.chatPane.message.user")
                    ) : (
                      <ThunderboltFilled />
                    )}
                  </div>
                  <div className={styles.bubble}>
                    <div className={styles.who}>
                      {m.role === "user"
                        ? t("knowledgeNetwork.agentChat.chatPane.message.user")
                        : t("knowledgeNetwork.agentChat.chatPane.message.agent")}
                    </div>
                    {m.reasoning ? (
                      <ReasoningBlock text={m.reasoning} live={busy && isLast && !m.content} />
                    ) : null}
                    {m.role === "user" ? (
                      <div className={styles.txt}>{m.content}</div>
                    ) : (
                      renderParts.map((part, pi) =>
                        part.kind === "tools" ? (
                          <ToolCallSegment
                            key={pi}
                            live={busy && isLast && pi === renderParts.length - 1}
                            calls={part.ids
                              .map((id) => callById.get(id))
                              .filter((call): call is ToolCallView => !!call)}
                            t={t}
                          />
                        ) : (
                          // During streaming, MarkdownView reparses only the tail block.
                          <MarkdownView
                            key={pi}
                            text={part.text}
                            streaming={busy && isLast && pi === renderParts.length - 1}
                          />
                        ),
                      )
                    )}
                    {m.role === "assistant" &&
                    renderParts.length === 0 &&
                    busy &&
                    isLast &&
                    !m.reasoning ? (
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
                                ? () =>
                                    void send(messages[i - 1].content, { replaceLastRound: true })
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                    {/* Usage arrives with the result; an estimate while streaming read as a wrong count. */}
                    {m.role === "assistant" && !(busy && isLast) ? (
                      m.tokens || m.ms ? (
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
