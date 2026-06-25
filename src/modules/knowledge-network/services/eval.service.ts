/**
 * 知识网络「效果评估 / Eval」服务 —— 原型 fixture。
 *
 * 真实 trace-ai eval-set 接口尚未提供，这里用内存样例评测集驱动 UI 与交互
 * （通过率、五维打分、逐例归因、运行评测动画）。后续接入真实接口时替换实现即可。
 */

import type {
  EvalAggregate,
  EvalCase,
  EvalDim,
  EvalScores,
  EvalSet,
  EvalSource,
  EvalStatus,
} from "@/modules/knowledge-network/types/eval";

/** 五个评分维度。 */
export const EVAL_DIMS: EvalDim[] = [
  { key: "schema", name: "Schema 检索", short: "Schema", method: "规则比对", color: "#2e68ff", desc: "search_schema 召回的对象类 / 关系类是否正确（F1）" },
  { key: "instance", name: "实例检索", short: "实例", method: "规则比对", color: "#0d9488", desc: "query_object_instance / 子图取数的实例命中（precision·recall）" },
  { key: "tool", name: "工具 / 技能选择", short: "工具", method: "规则比对", color: "#7c3aed", desc: "Agent 是否调用了期望的检索接口 / skill（Jaccard）" },
  { key: "correctness", name: "回答正确性", short: "正确性", method: "LLM 评审", color: "#16a34a", desc: "答案与参考要点的一致程度（LLM-as-judge）" },
  { key: "faithfulness", name: "忠实度", short: "忠实度", method: "LLM 评审", color: "#4f46e5", desc: "答案是否完全基于检索到的证据，无臆造（LLM-as-judge）" },
];

const SCORE_KEYS = EVAL_DIMS.map((dim) => dim.key);

export const EVAL_SOURCE_META: Record<EvalSource, { label: string; cls: string }> = {
  manual: { label: "人工标注", cls: "manual" },
  replay: { label: "会话回流", cls: "replay" },
  llm: { label: "LLM 生成", cls: "llm" },
};

export const EVAL_STATUS_META: Record<EvalStatus, { label: string; cls: string }> = {
  pass: { label: "通过", cls: "pass" },
  partial: { label: "部分", cls: "partial" },
  fail: { label: "未通过", cls: "fail" },
};

function mk(
  id: string,
  question: string,
  source: EvalSource,
  expect: EvalCase["expect"],
  result: EvalCase["result"],
): EvalCase {
  return { id, question, source, tags: expect.tags, expect, result };
}

/** 样例评测集模板（客户经营 · 核心问答集）。 */
function customerCases(): EvalCase[] {
  return [
    mk("c1", "上个季度下单金额排名前 10 的 VIP 客户有哪些？", "replay",
      { obj: ["客户", "订单"], rel: ["下单"], tools: ["search_schema", "query_object_instance"], instances: 10, tags: ["排序", "Top-N"], ref: "按 order.amount 季度聚合，取 tier=VIP 的客户 Top10，给出客户名与金额。" },
      { status: "pass", scores: { schema: 1.0, instance: 0.95, tool: 1.0, correctness: 0.92, faithfulness: 0.96 }, latencyMs: 820, tokens: 1840, reason: "Schema 与排序正确，Top10 命中 10/10，金额可追溯到订单实例。", actual: { obj: ["客户", "订单"], rel: ["下单"], tools: ["search_schema", "query_object_instance"], instances: 10, answer: "返回季度下单金额最高的 10 个 VIP 客户，附每客户合计金额与订单数。" } }),
    mk("c2", "金融行业、华东地区的客户都签了哪些合同？", "manual",
      { obj: ["客户", "行业", "地区", "合同"], rel: ["属于", "位于", "签署"], tools: ["search_schema", "query_instance_subgraph"], instances: 42, tags: ["多跳", "过滤"], ref: "沿 客户—属于→行业 / 客户—位于→地区 双重过滤后，取 客户—签署→合同 的合同清单。" },
      { status: "partial", scores: { schema: 0.78, instance: 0.70, tool: 1.0, correctness: 0.74, faithfulness: 0.88 }, latencyMs: 1180, tokens: 2600, reason: "Schema 漏召回关系类「位于」，地区过滤退化为全量，合同召回偏多（precision 偏低）。", actual: { obj: ["客户", "行业", "合同"], rel: ["属于", "签署"], tools: ["search_schema", "query_instance_subgraph"], instances: 68, answer: "返回金融行业客户签署的合同，但未按华东地区收敛，含其他地区合同。" } }),
    mk("c3", "客户、订单、合同三者是怎么关联的？", "manual",
      { obj: ["客户", "订单", "合同"], rel: ["下单", "签署", "履约于"], tools: ["search_schema"], instances: null, tags: ["Schema-only", "解释"], ref: "纯 Schema：客户—下单→订单、客户—签署→合同、订单—履约于→合同。" },
      { status: "pass", scores: { schema: 1.0, instance: 1.0, tool: 1.0, correctness: 0.95, faithfulness: 0.98 }, latencyMs: 540, tokens: 980, reason: "纯 Schema 解释，三条关系路径完整，未越权取实例。", actual: { obj: ["客户", "订单", "合同"], rel: ["下单", "签署", "履约于"], tools: ["search_schema"], instances: null, answer: "客户通过「下单」连接订单、「签署」连接合同，订单再「履约于」合同。" } }),
    mk("c4", "工单量最高的 5 个客户，平均首次响应时长是多少？", "replay",
      { obj: ["客户", "服务工单"], rel: ["提交"], tools: ["search_schema", "query_object_instance", "get_logic_properties_values"], instances: 5, tags: ["指标", "逻辑属性"], ref: "先取工单量 Top5 客户，再用逻辑属性 first_response_hours 求平均。" },
      { status: "fail", scores: { schema: 0.90, instance: 0.80, tool: 0.45, correctness: 0.60, faithfulness: 0.42 }, latencyMs: 1460, tokens: 3120, reason: "未调用逻辑属性 get_logic_properties_values，改用 run_sql 直查，响应时长由模型臆测 → 忠实度低。", actual: { obj: ["客户", "服务工单"], rel: ["提交"], tools: ["search_schema", "run_sql"], instances: 5, answer: "给出 Top5 客户与一个「平均 6.2 小时」的响应时长，但该数值无对应逻辑属性证据。" } }),
    mk("c5", "帮我审查客户 C-100231 的最新合同有哪些风险点？", "manual",
      { obj: ["客户", "合同"], rel: ["签署"], tools: ["find_skills", "get_action_info"], instances: 1, tags: ["技能", "行动"], ref: "召回「合同审查」技能，对该客户最新合同实例触发审查行动。" },
      { status: "partial", scores: { schema: 0.85, instance: 0.80, tool: 0.70, correctness: 0.78, faithfulness: 0.80 }, latencyMs: 1320, tokens: 2880, reason: "技能召回正确（合同审查），但 get_action_info 未携带 contract 实例标识，审查行动未实际触发。", actual: { obj: ["客户", "合同"], rel: ["签署"], tools: ["find_skills"], instances: 1, answer: "推荐了「合同审查」技能并给出通用风险清单，但缺该合同的具体条款证据。" } }),
    mk("c6", "华南地区各行业的客户数分布是怎样的？", "llm",
      { obj: ["客户", "地区", "行业"], rel: ["位于", "属于"], tools: ["search_schema", "query_object_instance"], instances: 8, tags: ["分布", "聚合"], ref: "按 客户—位于→地区=华南 过滤，再按 客户—属于→行业 分组计数。" },
      { status: "pass", scores: { schema: 0.95, instance: 0.90, tool: 0.90, correctness: 0.90, faithfulness: 0.93 }, latencyMs: 760, tokens: 1520, reason: "双重维度过滤与分组正确，分布数可追溯。", actual: { obj: ["客户", "地区", "行业"], rel: ["位于", "属于"], tools: ["search_schema", "query_object_instance"], instances: 8, answer: "返回华南地区按行业分组的客户数分布（8 个行业）。" } }),
    mk("c7", "最近 30 天新签合同的总金额是多少？", "replay",
      { obj: ["合同"], rel: [], tools: ["search_schema", "query_object_instance"], instances: 1, tags: ["聚合", "时间窗"], ref: "对 signed_at 在近 30 天的合同求 amount 之和。" },
      { status: "pass", scores: { schema: 1.0, instance: 0.92, tool: 1.0, correctness: 0.94, faithfulness: 0.95 }, latencyMs: 690, tokens: 1240, reason: "时间窗与求和正确，金额可追溯。", actual: { obj: ["合同"], rel: [], tools: ["search_schema", "query_object_instance"], instances: 1, answer: "返回近 30 天新签合同合计金额与合同份数。" } }),
    mk("c8", "客户「示例科技有限公司」关联的所有订单和服务工单。", "replay",
      { obj: ["客户", "订单", "服务工单"], rel: ["下单", "提交"], tools: ["query_instance_subgraph"], instances: 36, tags: ["子图", "实例级"], ref: "以该客户为起点，沿 下单 / 提交 两条关系展开子图。" },
      { status: "pass", scores: { schema: 0.95, instance: 0.88, tool: 1.0, correctness: 0.90, faithfulness: 0.92 }, latencyMs: 980, tokens: 2100, reason: "子图路径正确，订单与工单实例命中较全。", actual: { obj: ["客户", "订单", "服务工单"], rel: ["下单", "提交"], tools: ["query_instance_subgraph"], instances: 33, answer: "返回该客户的订单与服务工单子图（33 个节点）。" } }),
    mk("c9", "哪些客户既是高价值，又有最近未解决的服务工单？", "llm",
      { obj: ["客户", "服务工单"], rel: ["提交"], tools: ["search_schema", "query_object_instance", "get_logic_properties_values"], instances: 14, tags: ["多条件", "逻辑属性"], ref: "高价值由逻辑属性 value_tier 判定；未解决工单按 status≠closed 过滤。" },
      { status: "partial", scores: { schema: 0.85, instance: 0.66, tool: 0.75, correctness: 0.70, faithfulness: 0.72 }, latencyMs: 1540, tokens: 3260, reason: "高价值判定用逻辑属性正确，但「未解决」过滤遗漏 priority/status 组合，工单召回不全。", actual: { obj: ["客户", "服务工单"], rel: ["提交"], tools: ["search_schema", "query_object_instance", "get_logic_properties_values"], instances: 9, answer: "返回 9 个高价值且有未解决工单的客户，少于真实集合（漏召回）。" } }),
    mk("c10", "列出订单状态为「已退款」的客户。", "manual",
      { obj: ["客户", "订单"], rel: ["下单"], tools: ["query_object_instance"], instances: 120, tags: ["过滤", "字段"], ref: "按 order.status='refunded' 过滤后回溯下单客户。" },
      { status: "fail", scores: { schema: 0.90, instance: 0.35, tool: 0.80, correctness: 0.50, faithfulness: 0.60 }, latencyMs: 900, tokens: 1680, reason: "过滤字段名错配（status ↔ 实际 order_status），命中实例几乎全部漏召回。", actual: { obj: ["客户", "订单"], rel: ["下单"], tools: ["query_object_instance"], instances: 4, answer: "仅返回 4 个客户，远少于真实退款订单对应的客户数。" } }),
  ];
}

function buildSets(): EvalSet[] {
  const cases = customerCases();
  return [
    { id: "es-core", name: "核心问答集", desc: "覆盖排序、过滤、多跳、指标与技能调用的 10 条业务问题。", cases },
    { id: "es-smoke", name: "冒烟集", desc: "发布前快速回归的 3 条高频问题。", cases: [cases[0]!, cases[2]!, cases[6]!] },
  ];
}

/** 每个网络一份会话内可变的评测集（运行评测会原地更新逐例结果）。 */
const sessionSets = new Map<string, EvalSet[]>();

export function getEvalSets(networkId: string): EvalSet[] {
  let sets = sessionSets.get(networkId);
  if (!sets) {
    sets = buildSets();
    sessionSets.set(networkId, sets);
  }
  return sets;
}

export function pct(value: number): number {
  return Math.round(value * 100);
}

export function aggregate(cases: EvalCase[]): EvalAggregate {
  const scored = cases.filter((item) => item.result);
  const total = cases.length;
  const evaluated = scored.length;
  if (!evaluated) {
    return { total, evaluated: 0, pass: 0, partial: 0, fail: 0, passRate: null, dims: {}, p50: null, p95: null, tokens: 0, avgTokens: 0 };
  }
  let pass = 0;
  let partial = 0;
  let fail = 0;
  let tokens = 0;
  const dimSum: EvalScores = { schema: 0, instance: 0, tool: 0, correctness: 0, faithfulness: 0 };
  const lats: number[] = [];
  scored.forEach((item) => {
    const result = item.result!;
    if (result.status === "pass") pass += 1;
    else if (result.status === "partial") partial += 1;
    else fail += 1;
    SCORE_KEYS.forEach((key) => {
      dimSum[key] += result.scores[key];
    });
    tokens += result.tokens;
    lats.push(result.latencyMs);
  });
  const dims: Partial<EvalScores> = {};
  SCORE_KEYS.forEach((key) => {
    dims[key] = dimSum[key] / evaluated;
  });
  lats.sort((a, b) => a - b);
  const perc = (p: number) => lats[Math.min(lats.length - 1, Math.floor((p / 100) * lats.length))] ?? 0;
  return {
    total,
    evaluated,
    pass,
    partial,
    fail,
    passRate: pass / evaluated,
    dims,
    p50: perc(50),
    p95: perc(95),
    tokens,
    avgTokens: Math.round(tokens / evaluated),
  };
}

function jitter(value: number, amplitude: number): number {
  const next = value + (Math.random() * 2 - 1) * amplitude;
  return Math.max(0, Math.min(1, Math.round(next * 100) / 100));
}

/** 运行评测（原型）：对已绑定结果加轻微抖动并刷新延迟。 */
export function rerunCase(item: EvalCase): void {
  if (!item.result) {
    return;
  }
  const result = item.result;
  SCORE_KEYS.forEach((key) => {
    result.scores[key] = jitter(result.scores[key], 0.03);
  });
  result.latencyMs = Math.max(300, Math.round(result.latencyMs * (0.92 + Math.random() * 0.16)));
}
