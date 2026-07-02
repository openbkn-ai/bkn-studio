/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 立即体验 · Agent 对话 —— 容器：单会话 / 对比模式（分屏）。
 * 会话本体在 ChatPane（独立的消息/模型/提示词/调参/工具勾选）；本容器负责共享资源
 * （模型列表、知识网络摘要、tools/list 缓存）、对比开关与共享输入框（发送目标可选）。
 * 对比模式：左「仅基础数据」（默认只挂 list_resources/describe_resource/run_sql，不注入网络摘要）
 * vs 右「业务知识网络」（全部工具 + 注入摘要）——同一问题两侧同问，直观对比语义层价值。
 */

import { FileTextOutlined, PauseOutlined } from "@ant-design/icons";
import { Modal, Segmented, Switch } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  BASE_DATA_TOOL_NAMES,
  DEFAULT_AGENT_CONFIG,
  runAgentChat,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  fetchKnDetail,
  listMcpTools,
  type ContextLoaderEnv,
  type KnDetail,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

import {
  ChatPane,
  DEFAULT_BASE_PROMPT,
  DEFAULT_PROMPT,
  MarkdownView,
  fmtDuration,
  fmtTokens,
  type ChatPaneHandle,
  type PaneKey,
  type PaneProfile,
  type PaneSnapshot,
} from "./ChatPane";
import styles from "./AgentChat.module.css";

const FALLBACK_SUGGESTIONS = [
  "这个知识网络里有哪些对象类和关系？",
  "帮我查最近活跃的高价值客户",
  "对象类之间是怎么关联的？",
];

const FALLBACK_BASE_SUGGESTIONS = [
  "有哪些数据表？分别存什么数据？",
  "帮我查最近活跃的高价值客户",
];

/** 对比模式开关 + 发送目标（全局缓存，不分 kn）。 */
const COMPARE_LS_KEY = "bkn-studio:agentchat:compare";

type CompareTarget = "both" | "base" | "kn";

type CompareState = { on: boolean; target: CompareTarget };

function loadCompareState(): CompareState {
  let state: CompareState = { on: false, target: "both" };
  try {
    const raw = localStorage.getItem(COMPARE_LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CompareState>) : {};
    state = {
      on: parsed.on === true,
      target: parsed.target === "base" || parsed.target === "kn" ? parsed.target : "both",
    };
  } catch {
    /* 用默认 */
  }
  try {
    // 深链覆盖：?compare=on / ?compare=off（可分享演示链接，也便于自动化冒烟）。
    const qp = new URLSearchParams(window.location.search).get("compare");
    if (qp === "on" || qp === "1") state = { ...state, on: true };
    else if (qp === "off" || qp === "0") state = { ...state, on: false };
  } catch {
    /* SSR/异常时忽略 */
  }
  return state;
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

const SOLO_PROFILE: PaneProfile = {
  paneKey: "solo",
  defaultPrompt: DEFAULT_PROMPT,
  injectKnContext: true,
  defaultToolNames: null,
};

const BASE_PROFILE: PaneProfile = {
  paneKey: "base",
  title: "仅基础数据",
  defaultPrompt: DEFAULT_BASE_PROMPT,
  injectKnContext: false,
  defaultToolNames: BASE_DATA_TOOL_NAMES,
};

/** 对比报告 AI 总结的评审提示词。 */
const JUDGE_PROMPT =
  "你是对比评审员。同样的问题由两个 Agent 分别回答（可能有多轮）：A「仅基础数据」只能用 SQL/表工具直接查库；B「业务知识网络」可用全部知识网络检索工具（语义 Schema、实例、子图、逻辑属性等）。\n" +
  "请基于给出的各轮回答与指标，从这些维度对比：①结论正确性与完整度 ②依据是否充分可信 ③效率（工具调用次数、token、耗时）④哪一侧对业务用户更有用、为什么。\n" +
  "输出中文 Markdown：先给一行总评（哪侧更好），再逐轮简要对比（每轮 2-3 句），最后分点归纳，简洁克制，不要复述全文。";

/** 报告里单侧全部轮次的评审语料（长回答截断，防提示词爆炸）。 */
function paneBrief(label: string, s: PaneSnapshot): string {
  const parts = [
    `### ${label}（模型 ${s.model || "—"}；会话累计 ${fmtTokens(s.stats.tokens)} tokens · ${fmtDuration(s.stats.ms)}）`,
  ];
  s.rounds.forEach((r, i) => {
    const tools = r.toolCalls.map((t) => (t.status === "error" ? `${t.name}(失败)` : t.name)).join(", ") || "无";
    const answer = r.answer ? (r.answer.length > 1500 ? `${r.answer.slice(0, 1500)}…[已截断]` : r.answer) : "（无回答）";
    parts.push(
      `【第 ${i + 1} 轮】问题：${r.question}\n` +
        `指标：token ${r.tokens ?? "—"}，耗时 ${r.ms != null ? fmtDuration(r.ms) : "—"}，工具 ${r.toolCalls.length} 次（${tools}）\n` +
        `回答：${answer}`,
    );
  });
  return parts.join("\n\n");
}

const KN_PROFILE: PaneProfile = {
  paneKey: "kn",
  title: "业务知识网络",
  defaultPrompt: DEFAULT_PROMPT,
  injectKnContext: true,
  defaultToolNames: null,
  highlight: true,
};

export function AgentChat({
  env,
  networkName,
  tokenProvider,
}: {
  env: ContextLoaderEnv;
  networkName?: string;
  tokenProvider: AgentTokenProvider;
}) {
  const knId = env.knId;

  const [input, setInput] = useState("");
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // 自动载入的知识网络本体结构（注入系统提示词；也用于定制建议问题）。
  const [knContext, setKnContext] = useState("");
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [baseSuggestions, setBaseSuggestions] = useState<string[]>(FALLBACK_BASE_SUGGESTIONS);

  const [compare, setCompare] = useState<CompareState>(loadCompareState);
  const setCompareState = useCallback((updater: (prev: CompareState) => CompareState) => {
    setCompare((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(COMPARE_LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // 每面板 busy 上报（禁发/停止逻辑用）。
  const [busyMap, setBusyMap] = useState<Record<PaneKey, boolean>>({ solo: false, base: false, kn: false });
  const setPaneBusy = useCallback((key: PaneKey, busy: boolean) => {
    setBusyMap((prev) => (prev[key] === busy ? prev : { ...prev, [key]: busy }));
  }, []);
  const onSoloBusy = useCallback((b: boolean) => setPaneBusy("solo", b), [setPaneBusy]);
  const onBaseBusy = useCallback((b: boolean) => setPaneBusy("base", b), [setPaneBusy]);
  const onKnBusy = useCallback((b: boolean) => setPaneBusy("kn", b), [setPaneBusy]);

  const soloRef = useRef<ChatPaneHandle>(null);
  const baseRef = useRef<ChatPaneHandle>(null);
  const knRef = useRef<ChatPaneHandle>(null);

  // 拉模型列表（模型工厂）一次，两侧共享；默认模型在 ChatPane 内选。
  useEffect(() => {
    let cancelled = false;
    listLlmModels({ page: 1, size: 100 })
      .then((res) => {
        if (!cancelled) setModels(res.items);
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
    setBaseSuggestions(FALLBACK_BASE_SUGGESTIONS);
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
        const tailoredBase: string[] = ["有哪些数据表？分别存什么数据？"];
        if (firstOt) tailoredBase.push(`查几条 ${firstOt.name ?? firstOt.id} 相关的数据看看`);
        setBaseSuggestions(tailoredBase);
      })
      .catch(() => {
        /* 占位符 / 无权限网络拉不到结构时，回退默认建议，Agent 仍可用工具探索 */
      });
    return () => {
      cancelled = true;
    };
  }, [env]);

  // tools/list 缓存：按 knId 拉一次，多面板共享（send 懒取 promise；picker 用已解析的 toolDefs）。
  const [toolDefs, setToolDefs] = useState<McpToolDef[] | null>(null);
  const toolsCacheRef = useRef<{ knId: string; promise: Promise<McpToolDef[]> } | null>(null);
  const envRef = useRef(env);
  envRef.current = env;
  const getTools = useCallback((): Promise<McpToolDef[]> => {
    if (!toolsCacheRef.current || toolsCacheRef.current.knId !== knId) {
      const promise = listMcpTools(envRef.current)
        .then((list) => {
          setToolDefs(list);
          return list;
        })
        .catch((error: unknown) => {
          // 失败不缓存，下次重试。
          toolsCacheRef.current = null;
          throw error;
        });
      toolsCacheRef.current = { knId, promise };
    }
    return toolsCacheRef.current.promise;
  }, [knId]);
  useEffect(() => {
    setToolDefs(null);
    toolsCacheRef.current = null;
  }, [knId]);
  // 对比模式下工具选择器需要 options → 打开时预拉一次。
  useEffect(() => {
    if (compare.on && !toolDefs) {
      getTools().catch(() => {
        /* picker 显示加载失败前的 loading 态；send 时会重试并把错误写进消息 */
      });
    }
  }, [compare.on, toolDefs, getTools]);

  const targets = useMemo<PaneKey[]>(() => {
    if (!compare.on) return ["solo"];
    return compare.target === "both" ? ["base", "kn"] : [compare.target];
  }, [compare]);

  const refOf = useCallback(
    (key: PaneKey) => (key === "solo" ? soloRef : key === "base" ? baseRef : knRef),
    [],
  );

  const anyTargetBusy = targets.some((k) => busyMap[k]);
  const anyBusy = busyMap.solo || busyMap.base || busyMap.kn;
  const noLlm = modelsLoaded && models.length === 0;

  const sendShared = useCallback(() => {
    const text = input.trim();
    if (!text || anyTargetBusy) return;
    targets.forEach((key) => refOf(key).current?.send(text));
    setInput("");
  }, [input, targets, anyTargetBusy, refOf]);

  const stopAll = useCallback(() => {
    (Object.keys(busyMap) as PaneKey[]).forEach((key) => {
      if (busyMap[key]) refOf(key).current?.stop();
    });
  }, [busyMap, refOf]);

  // 对比报告：两侧快照 + 指标表 + AI 总结（用右侧模型评审，流式）。
  const [report, setReport] = useState<{ base: PaneSnapshot; kn: PaneSnapshot } | null>(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const openReport = useCallback(() => {
    const base = baseRef.current?.getSnapshot();
    const kn = knRef.current?.getSnapshot();
    if (base && kn) {
      setReport({ base, kn });
      setSummary("");
    }
  }, []);

  const closeReport = useCallback(() => {
    summaryAbortRef.current?.abort();
    setReport(null);
  }, []);

  const generateSummary = useCallback(async () => {
    if (!report || summarizing) return;
    const modelName = report.kn.model || report.base.model;
    if (!modelName) return;
    const content = [paneBrief("A · 仅基础数据", report.base), "", paneBrief("B · 业务知识网络", report.kn)].join("\n");
    setSummarizing(true);
    setSummary("");
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    try {
      await runAgentChat({
        env,
        modelName,
        system: JUDGE_PROMPT,
        history: [{ role: "user", content }],
        tools: {},
        config: DEFAULT_AGENT_CONFIG,
        tokenProvider,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (chunk.type === "text") setSummary((s) => s + chunk.delta);
          else if (chunk.type === "error") setSummary((s) => s + (s ? "\n\n" : "") + `⚠️ ${chunk.error}`);
        },
      });
    } finally {
      summaryAbortRef.current = null;
      setSummarizing(false);
    }
  }, [report, summarizing, env, tokenProvider]);

  const placeholder = useMemo(() => {
    if (noLlm) return "请先在「模型工厂」接入大模型后再对话";
    if (!compare.on) return `向 Agent 提问，例如：${suggestions[0] ?? FALLBACK_SUGGESTIONS[0]!}`;
    if (compare.target === "both") return "同一个问题，同时问两侧，对比两种回答";
    return compare.target === "base" ? "仅问左侧「仅基础数据」" : "仅问右侧「业务知识网络」";
  }, [noLlm, compare, suggestions]);

  const paneShared = {
    env,
    tokenProvider,
    networkName,
    models,
    modelsLoaded,
    knContext,
    knSummary,
    getTools,
    toolDefs,
  };

  return (
    <div className={styles.root}>
      <div className={styles.cmpBar}>
        <Switch
          size="small"
          checked={compare.on}
          disabled={anyBusy}
          onChange={(on) => setCompareState((prev) => ({ ...prev, on }))}
        />
        <span className={styles.cmpTitle}>
          <PauseOutlined rotate={90} /> 对比模式
        </span>
        <span className={styles.cmpDesc}>同一问题，对比「仅基础数据」与「有业务知识网络」两种回答</span>
        {compare.on ? (
          <button
            type="button"
            className={styles.cmpReport}
            onClick={openReport}
            disabled={anyBusy}
            title="对比两侧最近一轮的回答与指标，可生成 AI 总结"
          >
            <FileTextOutlined /> 对比报告
          </button>
        ) : null}
      </div>

      {compare.on ? (
        <div className={styles.panes}>
          <div className={styles.pane}>
            <ChatPane
              ref={baseRef}
              {...paneShared}
              profile={BASE_PROFILE}
              suggestions={baseSuggestions}
              onBusyChange={onBaseBusy}
            />
          </div>
          <div className={`${styles.pane} ${styles.paneRight} ${styles.paneHl}`}>
            <ChatPane
              ref={knRef}
              {...paneShared}
              profile={KN_PROFILE}
              suggestions={suggestions}
              onBusyChange={onKnBusy}
            />
          </div>
        </div>
      ) : (
        <ChatPane
          ref={soloRef}
          {...paneShared}
          profile={SOLO_PROFILE}
          suggestions={suggestions}
          onBusyChange={onSoloBusy}
        />
      )}

      <div className={styles.composer}>
        {compare.on ? (
          <div className={styles.targetRow}>
            <Segmented
              className={styles.targetSeg}
              value={compare.target}
              onChange={(value) => setCompareState((prev) => ({ ...prev, target: value as CompareTarget }))}
              options={[
                { label: "两侧同问", value: "both" },
                { label: "仅基础数据", value: "base" },
                { label: "仅业务知识网络", value: "kn" },
              ]}
            />
          </div>
        ) : null}
        <div className={styles.cwrap}>
          <textarea
            className={styles.cInput}
            value={input}
            rows={1}
            disabled={noLlm}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 跳过中文输入法组字中的回车（确认候选词），避免误发送。
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                sendShared();
              }
            }}
          />
          {anyTargetBusy ? (
            <button type="button" className={styles.stopBtn} onClick={stopAll}>
              停止
            </button>
          ) : (
            <button type="button" className={styles.sendBtn} onClick={sendShared} disabled={!input.trim() || noLlm}>
              发送
            </button>
          )}
        </div>
      </div>

      <Modal open={report !== null} onCancel={closeReport} footer={null} width={880} title="对比报告">
        {report ? (
          <div className={styles.rptRoot}>
            {report.base.rounds.length === 0 && report.kn.rounds.length === 0 ? (
              <p className={styles.rptHint}>两侧还没有对话。先用「两侧同问」发一个问题，再来看对比报告。</p>
            ) : (
              <>
                {/* 会话总览 */}
                <table className={styles.rptTable}>
                  <thead>
                    <tr>
                      <th>会话总览</th>
                      <th>
                        <span className={styles.paneTitle}>仅基础数据</span>
                      </th>
                      <th>
                        <span className={`${styles.paneTitle} ${styles.paneTitleHl}`}>业务知识网络</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>模型</td>
                      <td>{report.base.model || "—"}</td>
                      <td>{report.kn.model || "—"}</td>
                    </tr>
                    <tr>
                      <td>会话累计</td>
                      <td>
                        {fmtTokens(report.base.stats.tokens)} tokens · {fmtDuration(report.base.stats.ms)} ·{" "}
                        {report.base.rounds.length} 轮
                      </td>
                      <td>
                        {fmtTokens(report.kn.stats.tokens)} tokens · {fmtDuration(report.kn.stats.ms)} ·{" "}
                        {report.kn.rounds.length} 轮
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 逐轮对比 */}
                {Array.from({ length: Math.max(report.base.rounds.length, report.kn.rounds.length) }, (_, i) => {
                  const b = report.base.rounds[i];
                  const k = report.kn.rounds[i];
                  const isLast = i === Math.max(report.base.rounds.length, report.kn.rounds.length) - 1;
                  const sameQ = !b || !k || b.question === k.question;
                  const bBestTokens = b?.tokens != null && k?.tokens != null && b.tokens < k.tokens;
                  const kBestTokens = b?.tokens != null && k?.tokens != null && k.tokens < b.tokens;
                  const bBestMs = b?.ms != null && k?.ms != null && b.ms < k.ms;
                  const kBestMs = b?.ms != null && k?.ms != null && k.ms < b.ms;
                  const toolCell = (r?: (typeof report.base.rounds)[number]) => {
                    if (!r) return "—";
                    const ok = r.toolCalls.filter((t) => t.status === "done").length;
                    const err = r.toolCalls.filter((t) => t.status === "error").length;
                    return (
                      <>
                        {r.toolCalls.length} 次
                        {r.toolCalls.length > 0 ? (
                          <>
                            {" · "}
                            <span className={styles.rptOkTxt}>{ok} 成功</span>
                            {err > 0 ? (
                              <>
                                {" / "}
                                <span className={styles.rptErrTxt}>{err} 失败</span>
                              </>
                            ) : null}
                            <div className={styles.rptToolTags}>
                              {r.toolCalls.map((t, j) => (
                                <span
                                  key={`${t.name}-${j}`}
                                  className={`${styles.rptTool} ${t.status === "error" ? styles.rptToolErr : ""}`}
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </>
                    );
                  };
                  return (
                    <div key={i} className={styles.rptRound}>
                      <div className={styles.rptQ}>
                        <span className={styles.rptRoundNo}>第 {i + 1} 轮</span>
                        <span className={styles.rptQMark}>❝</span>
                        <span>
                          {sameQ
                            ? (k?.question ?? b?.question ?? "—")
                            : `左：${b?.question ?? "—"} ／ 右：${k?.question ?? "—"}`}
                        </span>
                      </div>
                      <table className={styles.rptTable}>
                        <tbody>
                          <tr>
                            <td>token</td>
                            <td className={bBestTokens ? styles.rptBest : ""}>
                              {b?.tokens != null ? fmtTokens(b.tokens) : "—"}
                            </td>
                            <td className={kBestTokens ? styles.rptBest : ""}>
                              {k?.tokens != null ? fmtTokens(k.tokens) : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td>耗时</td>
                            <td className={bBestMs ? styles.rptBest : ""}>{b?.ms != null ? fmtDuration(b.ms) : "—"}</td>
                            <td className={kBestMs ? styles.rptBest : ""}>{k?.ms != null ? fmtDuration(k.ms) : "—"}</td>
                          </tr>
                          <tr>
                            <td>工具调用</td>
                            <td>{toolCell(b)}</td>
                            <td>{toolCell(k)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className={styles.rptAnsGrid}>
                        {(
                          [
                            { key: "base", title: "仅基础数据", hl: false, ans: b?.answer ?? null },
                            { key: "kn", title: "业务知识网络", hl: true, ans: k?.answer ?? null },
                          ] as const
                        ).map(({ key, title, hl, ans }) => (
                          <details key={key} className={styles.rptAnsBox} open={isLast}>
                            <summary className={styles.rptAnsHead}>
                              <span className={`${styles.paneTitle} ${hl ? styles.paneTitleHl : ""}`}>{title}</span>
                              <span className={styles.rptAnsLbl}>回答（点击展开/收起）</span>
                            </summary>
                            <div className={styles.rptAnsBody}>
                              {ans ? <MarkdownView text={ans} /> : <span className={styles.rptHint}>（无回答）</span>}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className={styles.rptSumHead}>
                  <span>AI 总结</span>
                  <button
                    type="button"
                    className={styles.rptGenBtn}
                    onClick={() => void generateSummary()}
                    disabled={summarizing}
                  >
                    {summarizing ? "生成中…" : summary ? "重新生成" : "生成总结"}
                  </button>
                </div>
                {summary ? (
                  <div className={styles.rptSummary}>
                    <MarkdownView text={summary} />
                  </div>
                ) : (
                  <p className={styles.rptHint}>
                    {summarizing ? "评审模型思考中…" : "用右侧模型对全部轮次做正确性 / 依据 / 效率评审。"}
                  </p>
                )}
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
