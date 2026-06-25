/**
 * 知识网络「效果评估 / Eval」类型。
 * 对应 bkn-sdk trace-ai ▸ eval-set：评测集 → 评测用例（问题 + 期望）→ 运行（逐例打分 → 聚合报告）。
 * 评分口径（混合）：规则比对（Schema/实例/工具）+ LLM 评审（正确性/忠实度）+ 实测（延迟/token）。
 *
 * 真实 trace-ai eval 接口尚未提供，当前由原型 fixture 驱动，UI 与交互对齐设计。
 */

export type EvalDimKey =
  | "schema"
  | "instance"
  | "tool"
  | "correctness"
  | "faithfulness";

export type EvalDim = {
  key: EvalDimKey;
  name: string;
  short: string;
  method: string;
  color: string;
  desc: string;
};

export type EvalSource = "manual" | "replay" | "llm";

export type EvalStatus = "pass" | "partial" | "fail";

export type EvalScores = Record<EvalDimKey, number>;

export type EvalExpect = {
  /** 期望召回的实体类（展示名）。 */
  obj: string[];
  /** 期望命中的关系类（展示名）。 */
  rel: string[];
  /** 期望调用的检索接口 / 技能。 */
  tools: string[];
  /** 期望实例数；null = 纯 Schema。 */
  instances: number | null;
  tags: string[];
  /** 参考答案。 */
  ref: string;
};

export type EvalActual = {
  obj: string[];
  rel: string[];
  tools: string[];
  instances: number | null;
  answer: string;
};

export type EvalResult = {
  status: EvalStatus;
  scores: EvalScores;
  latencyMs: number;
  tokens: number;
  reason: string;
  actual: EvalActual;
};

export type EvalCase = {
  id: string;
  question: string;
  source: EvalSource;
  tags: string[];
  expect: EvalExpect;
  /** null = 尚未运行评测。 */
  result: EvalResult | null;
};

export type EvalSet = {
  id: string;
  name: string;
  desc: string;
  cases: EvalCase[];
};

export type EvalAggregate = {
  total: number;
  evaluated: number;
  pass: number;
  partial: number;
  fail: number;
  passRate: number | null;
  dims: Partial<EvalScores>;
  p50: number | null;
  p95: number | null;
  tokens: number;
  avgTokens: number;
};
