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

import { CopyOutlined, DownloadOutlined, FileTextOutlined, PauseOutlined } from "@ant-design/icons";
import { App, Modal, Segmented, Switch } from "antd";
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
  type PaneRound,
  type PaneSnapshot,
  type RoundOutcome,
} from "./ChatPane";
import styles from "./AgentChat.module.css";

/**
 * 建议问题在两侧（「仅基础数据」/「业务知识网络」）共用同一组，措辞保持业务向、不带本体术语：
 * 左侧只挂 SQL/表工具，问它「对象类怎么关联」是问一个它定义上就不知道的概念，对比没有说服力；
 * 业务问题才是左侧用 SQL 抓瞎、右侧靠语义层直接答的对比场。
 * 拉不到网络结构时的兜底（不含任何具体业务名词）。
 */
const FALLBACK_SUGGESTIONS = [
  "有哪些数据？先给我一个整体概览",
  "最近有什么值得关注的变化？",
  "帮我找出最需要重点关注的几条记录",
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

/**
 * 无默认模型（或生成失败）时的兜底：拿业务名词套模板，同样保持业务向、不出现本体术语。
 * 概念组实测多数网络为空，故第二条优先用关系名——关系名本身就是业务动词（如「用户下单」）。
 */
function templateSuggestions(detail: KnDetail): string[] {
  const out: string[] = [];
  const [first, second] = detail.object_types;
  if (first) out.push(`${first.name ?? first.id}有哪些数据？先看几条`);
  const groupName = detail.concept_groups.find((g) => g.name)?.name;
  const relName = detail.relation_types.find((r) => r.name)?.name;
  if (groupName) out.push(`${groupName}相关的情况怎么样？`);
  else if (relName) out.push(`${relName}的情况怎么样？`);
  if (second) out.push(`${second.name ?? second.id}里有什么值得关注的？`);
  else if (first) out.push(`${first.name ?? first.id}最近有什么变化？`);
  return out.length >= 2 ? out : FALLBACK_SUGGESTIONS;
}

/**
 * 建议问题的生成提示词。输入是 get_kn_detail 的原始 JSON（网络/对象类的 comment、关系名等业务描述都在里面）——
 * 推荐问题的质量直接取决于 BKN 里这些描述写得好不好，这就是业务侧控制推荐问题的抓手。
 */
const SUGGEST_PROMPT =
  "你在为一个「智能问数」产品的空白对话页写推荐问题。提问的人是不懂技术的业务人员。\n" +
  "下面是某个业务领域的结构定义 JSON（name/comment 是业务含义，object_types 是业务实体，relation_types 是实体间的业务关联）。\n" +
  "请据此写 3 个该领域业务人员真正会问的问题。硬性要求：\n" +
  "1. 只能引用 JSON 里出现过的业务名词，绝对不要编造里面没有的实体或概念（编造的问题一点就会查不到数据）。\n" +
  "2. 不要出现「对象类」「关系类」「知识网络」「图谱」「schema」「表」「字段」这类技术术语，也不要出现 JSON 里的英文字段名，要像业务人员日常说话。\n" +
  "3. 每个问题一句话、不超过 25 字，且能用数据回答（可查询、可统计、可对比），不要开放式主观题。\n" +
  "4. 3 个问题角度各不相同，不要同义重复。\n" +
  '只输出 JSON 数组，形如 ["问题1","问题2","问题3"]，不要任何其他文字，不要代码块标记。';

/** 从模型输出里抠出 JSON 数组；任何不合预期都返回空数组，由调用方回退模板。 */
function parseSuggestions(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 60)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** 建议问题缓存：按 knId 存，指纹变了（网络结构/描述改过）就重生成。 */
const SUGS_LS_PREFIX = "bkn-studio:agentchat:sugs:";

function detailFingerprint(detail: KnDetail): string {
  const ids = detail.object_types.map((o) => o.id).join(",");
  return [ids.length, detail.object_types.length, detail.relation_types.length, detail.concept_groups.length, (detail.comment ?? "").length].join(
    "-",
  );
}

function loadCachedSuggestions(knId: string, fp: string): string[] | null {
  try {
    const raw = localStorage.getItem(SUGS_LS_PREFIX + knId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; list?: unknown };
    if (parsed.fp !== fp || !Array.isArray(parsed.list)) return null;
    const list = parsed.list.filter((s): s is string => typeof s === "string");
    return list.length >= 2 ? list : null;
  } catch {
    return null;
  }
}

function saveCachedSuggestions(knId: string, fp: string, list: string[]): void {
  try {
    localStorage.setItem(SUGS_LS_PREFIX + knId, JSON.stringify({ fp, list }));
  } catch {
    /* 隐私模式/配额满：不缓存即可，不影响功能 */
  }
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
  "特别注意每轮的『结果状态』：若某侧某轮为『无有效回答 / 被用户停止 / 执行出错』，一律视为该侧该轮的负面结果（未完成任务），应判其明显劣于给出有效答案的一侧；某侧负面轮次越多，总评越应反映其不可靠。\n" +
  "输出中文 Markdown：先给一行总评（哪侧更好），再逐轮简要对比（每轮 2-3 句，并点明负面结果），最后分点归纳，简洁克制，不要复述全文。";

/** 结果状态标签；empty/stopped/error 明确标注为负面。 */
function outcomeLabel(o: RoundOutcome): string {
  switch (o) {
    case "answered":
      return "已回答";
    case "stopped":
      return "⏹ 被用户停止（负面）";
    case "error":
      return "⚠️ 执行出错（负面）";
    case "empty":
    default:
      return "⚠️ 无有效回答（负面）";
  }
}

/** 一轮的答案块：有效回答直接给正文；否则标注负面状态（有部分内容则附上）。 */
function answerBlock(r?: PaneRound): string {
  if (!r) return "（未参与本轮）";
  if (r.outcome === "answered") return r.answer ?? "（无回答）";
  const note = `**${outcomeLabel(r.outcome)}**`;
  return r.answer && r.answer.trim() ? `${note}\n\n${r.answer}` : note;
}

/** 某侧未有效完成（无答/停止/出错）的轮数——对比报告里的负面计数。 */
function negativeRounds(s: PaneSnapshot): number {
  return s.rounds.filter((r) => r.outcome !== "answered").length;
}

/** 导出 Markdown：一轮的工具调用摘要。 */
function mdCalls(r?: PaneRound): string {
  if (!r || r.toolCalls.length === 0) return "0 次";
  const ok = r.toolCalls.filter((t) => t.status === "done").length;
  const err = r.toolCalls.filter((t) => t.status === "error").length;
  const names = r.toolCalls.map((t) => (t.status === "error" ? `${t.name}(失败)` : t.name)).join(", ");
  return `${r.toolCalls.length} 次（${ok} 成功${err > 0 ? ` / ${err} 失败` : ""}）：${names}`;
}

/** 把对比报告导出为 Markdown 文本（总览 + 逐轮问答指标 + 双方答案 + AI 总结）。 */
function reportToMarkdown(
  base: PaneSnapshot,
  kn: PaneSnapshot,
  summary: string,
  knLabel: string,
  generatedAt: string,
): string {
  const L: string[] = [];
  L.push(`# Agent 对话对比报告 · ${knLabel}`, "");
  L.push(`- 生成时间：${generatedAt}`);
  L.push(`- 左「仅基础数据」模型：${base.model || "—"}；右「业务知识网络」模型：${kn.model || "—"}`, "");
  L.push("## 会话总览", "");
  L.push("| 指标 | 仅基础数据 | 业务知识网络 |");
  L.push("| --- | --- | --- |");
  L.push(`| 总 token | ${fmtTokens(base.stats.tokens)} | ${fmtTokens(kn.stats.tokens)} |`);
  L.push(`| 总耗时 | ${fmtDuration(base.stats.ms)} | ${fmtDuration(kn.stats.ms)} |`);
  L.push(`| 轮数 | ${base.rounds.length} | ${kn.rounds.length} |`);
  const totalCalls = (s: PaneSnapshot) => s.rounds.reduce((n, r) => n + r.toolCalls.length, 0);
  L.push(`| 工具调用合计 | ${totalCalls(base)} 次 | ${totalCalls(kn)} 次 |`);
  L.push(`| 无效轮次(无答/停止/出错) | ${negativeRounds(base)} | ${negativeRounds(kn)} |`, "");
  const roundCount = Math.max(base.rounds.length, kn.rounds.length);
  for (let i = 0; i < roundCount; i++) {
    const b = base.rounds[i];
    const k = kn.rounds[i];
    const sameQ = !b || !k || b.question === k.question;
    L.push(`## 第 ${i + 1} 轮`, "");
    L.push(`> ${sameQ ? (k?.question ?? b?.question ?? "—") : `左：${b?.question ?? "—"} ／ 右：${k?.question ?? "—"}`}`, "");
    L.push("| 指标 | 仅基础数据 | 业务知识网络 |");
    L.push("| --- | --- | --- |");
    L.push(
      `| token | ${b?.tokens != null ? fmtTokens(b.tokens) : "—"} | ${k?.tokens != null ? fmtTokens(k.tokens) : "—"} |`,
    );
    L.push(
      `| 耗时 | ${b?.ms != null ? fmtDuration(b.ms) : "—"} | ${k?.ms != null ? fmtDuration(k.ms) : "—"} |`,
    );
    L.push(`| 工具调用 | ${mdCalls(b)} | ${mdCalls(k)} |`);
    L.push(`| 结果 | ${b ? outcomeLabel(b.outcome) : "—"} | ${k ? outcomeLabel(k.outcome) : "—"} |`, "");
    L.push(`### 仅基础数据 · 回答`, "", answerBlock(b), "");
    L.push(`### 业务知识网络 · 回答`, "", answerBlock(k), "");
  }
  if (summary.trim()) L.push("## AI 总结", "", summary.trim(), "");
  return L.join("\n");
}

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
        `结果状态：${outcomeLabel(r.outcome)}\n` +
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
  modelTokenProvider,
}: {
  env: ContextLoaderEnv;
  networkName?: string;
  /** 检索工具（agent-retrieval MCP）鉴权：OAuth 会话或 bak_ AppKey。 */
  tokenProvider: AgentTokenProvider;
  /** 大模型（mf-model-api）鉴权：网关不认 bak_，恒用 OAuth 会话；缺省回落 tokenProvider。 */
  modelTokenProvider?: AgentTokenProvider;
}) {
  const knId = env.knId;
  const { message } = App.useApp();
  const llmTokenProvider = useMemo(
    () => modelTokenProvider ?? tokenProvider,
    [modelTokenProvider, tokenProvider],
  );

  const [input, setInput] = useState("");
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // 自动载入的知识网络本体结构（注入系统提示词；也用于定制建议问题）。
  const [knContext, setKnContext] = useState("");
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(null);
  // 当前网络绑定的 resource_id 集（object_type.data_source.id）；用于把 list_resources 默认限定到本网络的数据表。
  const [knResourceIds, setKnResourceIds] = useState<string[] | null>(null);
  // 建议问题：两侧共用一组。先用模板即时渲染，模型就绪后再换成生成结果（见下方 effect）。
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  // 已拉到的网络结构：既派生系统提示词摘要，也作为生成建议问题的业务描述来源。
  const [knDetail, setKnDetail] = useState<KnDetail | null>(null);

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
    setKnResourceIds(null);
    setKnDetail(null);
    setSuggestions(FALLBACK_SUGGESTIONS);
    fetchKnDetail(env, tokenProvider)
      .then((detail) => {
        if (cancelled) return;
        setKnContext(buildKnContext(detail));
        setKnSummary({ objectTypes: detail.object_types.length, relations: detail.relation_types.length });
        setKnResourceIds(detail.object_types.map((o) => o.data_source?.id).filter((id): id is string => !!id));
        setKnDetail(detail);
        // 先给模板结果，空态立刻有东西可点，不等模型。
        setSuggestions(templateSuggestions(detail));
      })
      .catch(() => {
        /* 占位符 / 无权限网络拉不到结构时，回退默认建议，Agent 仍可用工具探索 */
      });
    return () => {
      cancelled = true;
    };
  }, [env, tokenProvider]);

  // 有默认模型就用 BKN 的业务描述生成建议问题，替换模板结果；无模型/失败/输出不合预期时留在模板。
  useEffect(() => {
    if (!knDetail || !modelsLoaded) return;
    const modelName = models.find((m) => m.default)?.modelName ?? models[0]?.modelName;
    if (!modelName) return;
    const fp = detailFingerprint(knDetail);
    const cached = loadCachedSuggestions(knId, fp);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const controller = new AbortController();
    let text = "";
    runAgentChat({
      env,
      modelName,
      system: SUGGEST_PROMPT,
      history: [{ role: "user", content: JSON.stringify(knDetail) }],
      tools: {},
      config: DEFAULT_AGENT_CONFIG,
      tokenProvider: llmTokenProvider,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (chunk.type === "text") text += chunk.delta;
      },
    })
      .then(() => {
        if (controller.signal.aborted) return;
        const list = parseSuggestions(text);
        if (list.length < 2) return; // 输出不可用 → 保持模板
        setSuggestions(list);
        saveCachedSuggestions(knId, fp, list);
      })
      .catch(() => {
        /* 生成失败不打扰用户：空态继续用模板建议 */
      });
    return () => {
      controller.abort();
    };
  }, [knDetail, modelsLoaded, models, env, llmTokenProvider, knId]);

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

  /**
   * 空态点建议问题：和共享输入框走同一套发送目标。
   * （此前是 ChatPane 内直发，绕过 targets：对比模式下点谁只发谁、两侧还各是各的问题，
   * 导致对比报告永远拿不到同题两答。）
   */
  const sendQuestion = useCallback(
    (text: string) => {
      if (!text.trim() || anyTargetBusy) return;
      targets.forEach((key) => refOf(key).current?.send(text));
    },
    [targets, anyTargetBusy, refOf],
  );

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

  const buildMarkdown = useCallback(() => {
    if (!report) return null;
    const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
    return reportToMarkdown(report.base, report.kn, summary, networkName ? `${networkName}（${knId}）` : knId, stamp);
  }, [report, summary, networkName, knId]);

  const copyReportMd = useCallback(() => {
    const md = buildMarkdown();
    if (!md) return;
    void navigator.clipboard
      ?.writeText(md)
      .then(() => message.success("报告 Markdown 已复制"))
      .catch(() => message.error("复制失败"));
  }, [buildMarkdown, message]);

  const exportReportMd = useCallback(() => {
    const md = buildMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `对比报告-${knId}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildMarkdown, knId]);

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
        tokenProvider: llmTokenProvider,
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
  }, [env, llmTokenProvider, report, summarizing]);

  const placeholder = useMemo(() => {
    if (noLlm) return "请先在「模型工厂」接入大模型后再对话";
    if (!compare.on) return `向 Agent 提问，例如：${suggestions[0] ?? FALLBACK_SUGGESTIONS[0]}`;
    if (compare.target === "both") return "同一个问题，同时问两侧，对比两种回答";
    return compare.target === "base" ? "仅问左侧「仅基础数据」" : "仅问右侧「业务知识网络」";
  }, [noLlm, compare, suggestions]);

  const paneShared = {
    env,
    tokenProvider,
    modelTokenProvider: llmTokenProvider,
    networkName,
    models,
    modelsLoaded,
    knContext,
    knSummary,
    getTools,
    toolDefs,
    resourceScope: knResourceIds,
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
              suggestions={suggestions}
              onPick={sendQuestion}
              onBusyChange={onBaseBusy}
            />
          </div>
          <div className={`${styles.pane} ${styles.paneRight} ${styles.paneHl}`}>
            <ChatPane
              ref={knRef}
              {...paneShared}
              profile={KN_PROFILE}
              suggestions={suggestions}
              onPick={sendQuestion}
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
          onPick={sendQuestion}
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

      <Modal
        open={report !== null}
        onCancel={closeReport}
        footer={null}
        width="min(1120px, 94vw)"
        title="对比报告"
      >
        {report ? (
          <div className={styles.rptRoot}>
            {report.base.rounds.length === 0 && report.kn.rounds.length === 0 ? (
              <p className={styles.rptHint}>两侧还没有对话。先用「两侧同问」发一个问题，再来看对比报告。</p>
            ) : (
              <>
                <div className={styles.rptActions}>
                  <button type="button" className={styles.rptActBtn} onClick={copyReportMd}>
                    <CopyOutlined /> 复制 Markdown
                  </button>
                  <button type="button" className={styles.rptActBtn} onClick={exportReportMd}>
                    <DownloadOutlined /> 导出 .md
                  </button>
                </div>
                {/* 会话总览（汇总对比） */}
                {(() => {
                  const agg = (s: PaneSnapshot) => {
                    const calls = s.rounds.flatMap((r) => r.toolCalls);
                    return {
                      rounds: s.rounds.length,
                      calls: calls.length,
                      ok: calls.filter((t) => t.status === "done").length,
                      err: calls.filter((t) => t.status === "error").length,
                      avgTokens: s.rounds.length > 0 ? Math.round(s.stats.tokens / s.rounds.length) : 0,
                      avgMs: s.rounds.length > 0 ? s.stats.ms / s.rounds.length : 0,
                      neg: s.rounds.filter((r) => r.outcome !== "answered").length,
                    };
                  };
                  const b = report.base;
                  const k = report.kn;
                  const ba = agg(b);
                  const ka = agg(k);
                  const both = ba.rounds > 0 && ka.rounds > 0;
                  const bBestTok = both && b.stats.tokens < k.stats.tokens;
                  const kBestTok = both && k.stats.tokens < b.stats.tokens;
                  const bBestMs = both && b.stats.ms < k.stats.ms;
                  const kBestMs = both && k.stats.ms < b.stats.ms;
                  const callsCell = (a: ReturnType<typeof agg>) => (
                    <>
                      {a.calls} 次
                      {a.calls > 0 ? (
                        <>
                          {" · "}
                          <span className={styles.rptOkTxt}>{a.ok} 成功</span>
                          {a.err > 0 ? (
                            <>
                              {" / "}
                              <span className={styles.rptErrTxt}>{a.err} 失败</span>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  );
                  return (
                    <table className={styles.rptTable}>
                      <thead>
                        <tr>
                          <th>会话总览（{Math.max(ba.rounds, ka.rounds)} 轮）</th>
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
                          <td>{b.model || "—"}</td>
                          <td>{k.model || "—"}</td>
                        </tr>
                        <tr>
                          <td>总 token</td>
                          <td className={bBestTok ? styles.rptBest : ""}>{fmtTokens(b.stats.tokens)}</td>
                          <td className={kBestTok ? styles.rptBest : ""}>{fmtTokens(k.stats.tokens)}</td>
                        </tr>
                        <tr>
                          <td>总耗时</td>
                          <td className={bBestMs ? styles.rptBest : ""}>{fmtDuration(b.stats.ms)}</td>
                          <td className={kBestMs ? styles.rptBest : ""}>{fmtDuration(k.stats.ms)}</td>
                        </tr>
                        <tr>
                          <td>平均每轮</td>
                          <td>{ba.rounds > 0 ? `${fmtTokens(ba.avgTokens)} tokens · ${fmtDuration(ba.avgMs)}` : "—"}</td>
                          <td>{ka.rounds > 0 ? `${fmtTokens(ka.avgTokens)} tokens · ${fmtDuration(ka.avgMs)}` : "—"}</td>
                        </tr>
                        <tr>
                          <td>工具调用合计</td>
                          <td>{callsCell(ba)}</td>
                          <td>{callsCell(ka)}</td>
                        </tr>
                        <tr>
                          <td>无效轮次(无答/停止/出错)</td>
                          <td className={ba.neg > 0 ? styles.rptErrTxt : ""}>{ba.neg}</td>
                          <td className={ka.neg > 0 ? styles.rptErrTxt : ""}>{ka.neg}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}

                {/* 逐轮对比 */}
                {Array.from({ length: Math.max(report.base.rounds.length, report.kn.rounds.length) }, (_, i) => {
                  const b = report.base.rounds[i];
                  const k = report.kn.rounds[i];
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
                          <tr>
                            <td>结果</td>
                            <td className={b && b.outcome !== "answered" ? styles.rptErrTxt : ""}>
                              {b ? outcomeLabel(b.outcome) : "—"}
                            </td>
                            <td className={k && k.outcome !== "answered" ? styles.rptErrTxt : ""}>
                              {k ? outcomeLabel(k.outcome) : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className={styles.rptAnsGrid}>
                        {(
                          [
                            { key: "base", title: "仅基础数据", hl: false, round: b },
                            { key: "kn", title: "业务知识网络", hl: true, round: k },
                          ] as const
                        ).map(({ key, title, hl, round }) => {
                          const negative = !!round && round.outcome !== "answered";
                          return (
                            <details key={key} className={styles.rptAnsBox}>
                              <summary className={styles.rptAnsHead}>
                                <span className={`${styles.paneTitle} ${hl ? styles.paneTitleHl : ""}`}>{title}</span>
                                {negative ? (
                                  <span className={styles.rptErrTxt}>{outcomeLabel(round.outcome)}</span>
                                ) : (
                                  <span className={styles.rptAnsLbl}>回答（点击展开/收起）</span>
                                )}
                              </summary>
                              <div className={styles.rptAnsBody}>
                                {negative ? <div className={styles.rptErrTxt}>{outcomeLabel(round.outcome)}</div> : null}
                                {round?.answer ? (
                                  <MarkdownView text={round.answer} />
                                ) : negative ? null : (
                                  <span className={styles.rptHint}>（无回答）</span>
                                )}
                              </div>
                            </details>
                          );
                        })}
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
