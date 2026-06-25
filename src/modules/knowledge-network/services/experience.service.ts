/**
 * 知识网络「立即体验」服务 —— 智能问数对话（原型 fixture）。
 *
 * 让用户直接「体验」一个知识网络：用自然语言提问，Agent 基于本体检索并作答，
 * 并展示检索过程（命中的实体类 / 关系类、实例数、调用链）。
 *
 * 真实问数 / Agent 接口尚未提供，这里用内存样例问答驱动 UI 与交互。
 * 后续接入真实接口时替换 `askKnowledgeNetwork` 实现即可。
 */

export type ExperienceTrace = {
  /** 命中的实体类（展示名）。 */
  obj: string[];
  /** 命中的关系类（展示名）。 */
  rel: string[];
  /** 调用的检索接口 / 技能。 */
  tools: string[];
  /** 命中实例数；null = 纯 Schema。 */
  instances: number | null;
};

export type ExperienceAnswer = {
  answer: string;
  trace: ExperienceTrace;
  latencyMs: number;
  tokens: number;
};

type CannedAnswer = ExperienceAnswer & { question: string };

const CANNED: CannedAnswer[] = [
  {
    question: "上个季度下单金额排名前 10 的 VIP 客户有哪些？",
    answer: "返回季度下单金额最高的 10 个 VIP 客户，附每客户合计金额与订单数。",
    trace: { obj: ["客户", "订单"], rel: ["下单"], tools: ["search_schema", "query_object_instance"], instances: 10 },
    latencyMs: 820, tokens: 1840,
  },
  {
    question: "金融行业、华东地区的客户都签了哪些合同？",
    answer: "沿「客户—属于→行业」「客户—位于→地区」双重过滤后，给出金融行业、华东地区客户签署的合同清单。",
    trace: { obj: ["客户", "行业", "地区", "合同"], rel: ["属于", "位于", "签署"], tools: ["search_schema", "query_instance_subgraph"], instances: 42 },
    latencyMs: 1180, tokens: 2600,
  },
  {
    question: "客户、订单、合同三者是怎么关联的？",
    answer: "客户通过「下单」连接订单、「签署」连接合同，订单再「履约于」合同。",
    trace: { obj: ["客户", "订单", "合同"], rel: ["下单", "签署", "履约于"], tools: ["search_schema"], instances: null },
    latencyMs: 540, tokens: 980,
  },
  {
    question: "工单量最高的 5 个客户，平均首次响应时长是多少？",
    answer: "给出工单量 Top5 客户，并用逻辑属性 first_response_hours 计算平均首次响应时长。",
    trace: { obj: ["客户", "服务工单"], rel: ["提交"], tools: ["search_schema", "query_object_instance", "get_logic_properties_values"], instances: 5 },
    latencyMs: 1460, tokens: 3120,
  },
  {
    question: "华南地区各行业的客户数分布是怎样的？",
    answer: "按「客户—位于→地区=华南」过滤，再按「客户—属于→行业」分组计数，返回 8 个行业的客户数分布。",
    trace: { obj: ["客户", "地区", "行业"], rel: ["位于", "属于"], tools: ["search_schema", "query_object_instance"], instances: 8 },
    latencyMs: 760, tokens: 1520,
  },
  {
    question: "最近 30 天新签合同的总金额是多少？",
    answer: "对 signed_at 在近 30 天的合同求 amount 之和，返回合计金额与合同份数。",
    trace: { obj: ["合同"], rel: [], tools: ["search_schema", "query_object_instance"], instances: 1 },
    latencyMs: 690, tokens: 1240,
  },
  {
    question: "客户「示例科技有限公司」关联的所有订单和服务工单。",
    answer: "以该客户为起点，沿「下单 / 提交」两条关系展开子图，返回其订单与服务工单（33 个节点）。",
    trace: { obj: ["客户", "订单", "服务工单"], rel: ["下单", "提交"], tools: ["query_instance_subgraph"], instances: 33 },
    latencyMs: 980, tokens: 2100,
  },
];

const DEFAULT_BY_INDEX = [820, 760, 980, 1180, 690];

/** 样例问题（点击直接体验）。 */
export const SAMPLE_QUESTIONS: string[] = CANNED.slice(0, 5).map((item) => item.question);

function genericAnswer(networkName: string, question: string): ExperienceAnswer {
  const seed = question.length;
  return {
    answer: `已基于「${networkName}」的本体检索相关实体与关系，并据此作答。（原型演示：接入真实问数接口后将返回基于图谱实例的精确答案。）`,
    trace: {
      obj: [],
      rel: [],
      tools: ["search_schema", "query_object_instance"],
      instances: (seed % 20) + 1,
    },
    latencyMs: DEFAULT_BY_INDEX[seed % DEFAULT_BY_INDEX.length] ?? 760,
    tokens: 900 + (seed % 12) * 120,
  };
}

/** 向知识网络提问（原型，含小幅人为延迟）。 */
export async function askKnowledgeNetwork(
  networkName: string,
  question: string,
): Promise<ExperienceAnswer> {
  const trimmed = question.trim();
  const hit = CANNED.find((item) => item.question === trimmed);
  const answer = hit
    ? { answer: hit.answer, trace: hit.trace, latencyMs: hit.latencyMs, tokens: hit.tokens }
    : genericAnswer(networkName, trimmed);
  await new Promise((resolve) => setTimeout(resolve, 520));
  return answer;
}
