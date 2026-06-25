/** 知识网络「立即体验 · 效果评估」工作台。通过率 + 五维打分 + 逐例归因 + 运行评测。 */

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import { Drawer, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  EVAL_DIMS,
  EVAL_SOURCE_META,
  EVAL_STATUS_META,
  aggregate,
  getEvalSets,
  pct,
  rerunCase,
} from "@/modules/knowledge-network/services/eval.service";
import type { EvalCase, EvalSet } from "@/modules/knowledge-network/types/eval";

import styles from "./EvalScene.module.css";

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
function formatTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function ringColor(pr: number): string {
  if (pr >= 0.8) return "#16a34a";
  if (pr >= 0.55) return "#2e68ff";
  if (pr >= 0.35) return "#d97706";
  return "#dc2626";
}
const STATUS_TAG: Record<string, string> = { pass: "success", partial: "warning", fail: "error" };
const SOURCE_TAG: Record<string, string> = { manual: "blue", replay: "cyan", llm: "purple" };

function ScoreBars({ item }: { item: EvalCase }) {
  if (!item.result) {
    return <span className={styles.scoreNa}>— 未评测</span>;
  }
  return (
    <span className={styles.scoreRow}>
      {EVAL_DIMS.map((dim) => {
        const value = item.result!.scores[dim.key];
        return (
          <span key={dim.key} className={styles.scoreBar} title={`${dim.short} ${pct(value)}%`}>
            <span
              className={styles.scoreBarFill}
              style={{ height: `${Math.max(8, Math.round(value * 100))}%`, background: dim.color }}
            />
          </span>
        );
      })}
    </span>
  );
}

function DiffChips({ items, missing }: { items: string[]; missing?: string[] }) {
  if (items.length === 0) {
    return <span className={styles.muted}>—</span>;
  }
  return (
    <span className={styles.chips}>
      {items.map((label) => (
        <span
          key={label}
          className={`${styles.miniChip} ${missing?.includes(label) ? styles.miniChipMiss : ""}`}
        >
          {label}
          {missing?.includes(label) ? " · 漏" : ""}
        </span>
      ))}
    </span>
  );
}

export function EvalScene() {
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [sets, setSets] = useState<EvalSet[]>([]);
  const [curSetId, setCurSetId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [activeCase, setActiveCase] = useState<EvalCase | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const loaded = getEvalSets(id);
    setSets(loaded);
    setCurSetId(loaded[0]?.id ?? "");
    let cancelled = false;
    getKnowledgeNetwork(id)
      .then((record) => {
        if (!cancelled && record) {
          setNetwork({ name: record.name, slug: record.identifier });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current = [];
    };
  }, [id]);

  const set = useMemo(() => sets.find((item) => item.id === curSetId) ?? sets[0], [sets, curSetId]);
  // version 用于在原地修改用例结果后强制重算聚合
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agg = useMemo(() => (set ? aggregate(set.cases) : null), [set, version]);

  const runEval = useCallback(() => {
    if (running || !set) {
      return;
    }
    const cases = set.cases;
    setRunning(true);
    setRevealed(new Set());
    setCurrent(null);
    const stagger = Math.min(160, Math.max(80, Math.floor(1100 / cases.length)));
    cases.forEach((item, index) => {
      timers.current.push(setTimeout(() => setCurrent(item.id), index * stagger));
      timers.current.push(
        setTimeout(() => {
          rerunCase(item);
          setRevealed((prev) => new Set(prev).add(item.id));
          setCurrent((cur) => (cur === item.id ? null : cur));
          setVersion((value) => value + 1);
        }, index * stagger + Math.floor(stagger * 0.62)),
      );
    });
    timers.current.push(
      setTimeout(() => {
        setRunning(false);
        setCurrent(null);
        setRevealed(new Set());
        setVersion((value) => value + 1);
        const result = aggregate(cases);
        void message.success(`评测完成 · 通过率 ${pct(result.passRate ?? 0)}%（${result.pass}/${result.evaluated}）`);
      }, cases.length * stagger + 480),
    );
  }, [running, set, message]);

  if (!set || !agg) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  const ring = (() => {
    const r = 58;
    const c = 2 * Math.PI * r;
    const pr = agg.passRate ?? 0;
    const color = ringColor(pr);
    return (
      <div className={styles.ring}>
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle className={styles.ringTrack} cx="66" cy="66" r={r} strokeWidth="11" />
          <circle
            className={styles.ringFill}
            cx="66"
            cy="66"
            r={r}
            strokeWidth="11"
            stroke={color}
            strokeDasharray={c.toFixed(1)}
            strokeDashoffset={(agg.passRate == null ? c : c * (1 - pr)).toFixed(1)}
          />
        </svg>
        <div className={styles.ringCore}>
          {agg.passRate == null ? (
            <span className={styles.ringNa}>未评测</span>
          ) : (
            <>
              <span className={styles.ringPct}>
                {pct(agg.passRate)}
                <small>%</small>
              </span>
              <span className={styles.ringLbl}>通过率</span>
            </>
          )}
        </div>
      </div>
    );
  })();

  const columns: ColumnsType<EvalCase> = [
    {
      title: "用例 · 问题",
      key: "question",
      render: (_, item) => (
        <div>
          <div className={styles.qText}>{item.question}</div>
          {item.tags.length > 0 ? (
            <div className={styles.qTags}>
              {item.tags.map((tag) => (
                <span key={tag} className={styles.qTag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "来源",
      key: "source",
      width: 100,
      render: (_, item) => (
        <Tag color={SOURCE_TAG[item.source]} bordered={false}>
          {EVAL_SOURCE_META[item.source].label}
        </Tag>
      ),
    },
    {
      title: "维度得分",
      key: "scores",
      width: 140,
      render: (_, item) => {
        if (running && current === item.id) {
          return <span className={styles.runningDot} />;
        }
        if (running && !revealed.has(item.id)) {
          return <span className={styles.scoreNa}>…</span>;
        }
        return <ScoreBars item={item} />;
      },
    },
    {
      title: "结果",
      key: "status",
      width: 90,
      render: (_, item) => {
        if (running && current === item.id) {
          return <span className={styles.muted}>评测中…</span>;
        }
        if (running && !revealed.has(item.id)) {
          return <span className={styles.muted}>排队</span>;
        }
        return item.result ? (
          <Tag color={STATUS_TAG[item.result.status]} bordered={false}>
            {EVAL_STATUS_META[item.result.status].label}
          </Tag>
        ) : (
          <span className={styles.muted}>待运行</span>
        );
      },
    },
  ];

  return (
    <section className={styles.page}>
      <button type="button" className={styles.backLink} onClick={() => navigate(`/knowledge-network/workspace/${id}/overview`)}>
        <ArrowLeftOutlined />
        返回 {network?.name ?? "知识网络"}
      </button>

      <div className={styles.titleRow}>
        <h2 className={styles.title}>效果评估</h2>
        <span className={styles.expBadge}>
          <ThunderboltFilled /> 立即体验
        </span>
        {network ? <span className={styles.slug}>{network.slug}</span> : null}
        <span className={styles.subMeta}>trace-ai · eval-set · 规则比对 + LLM 评审</span>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        {running ? (
          <div className={styles.ring}>
            <svg width="132" height="132" viewBox="0 0 132 132">
              <circle className={styles.ringTrack} cx="66" cy="66" r="58" strokeWidth="11" />
            </svg>
            <div className={styles.ringCore}>
              <span className={styles.ringLbl}>评测中…</span>
            </div>
          </div>
        ) : (
          ring
        )}
        <div className={styles.heroMeta}>
          <div className={styles.heroTitle}>
            <h3>{set.name}</h3>
          </div>
          <div className={styles.heroSub}>
            共 {agg.total} 个用例 · 已评测 {agg.evaluated} · P95 {formatMs(agg.p95)}
          </div>
          <div className={styles.heroChips}>
            <span className={`${styles.heroChip} ${styles.chipPass}`}>
              <CheckCircleOutlined /> 通过 <b>{agg.pass}</b>
            </span>
            <span className={`${styles.heroChip} ${styles.chipPartial}`}>部分 <b>{agg.partial}</b></span>
            <span className={`${styles.heroChip} ${styles.chipFail}`}>未通过 <b>{agg.fail}</b></span>
            <span className={styles.heroChip}>{formatTok(agg.avgTokens)} tok/例</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={styles.runBtn} onClick={runEval} disabled={running}>
            <ThunderboltFilled />
            {running ? "评测中…" : "运行评测"}
          </button>
          <span className={styles.runHint}>对当前评测集重新打分</span>
        </div>
      </div>

      {/* 指标网格 */}
      <div className={styles.metricGrid}>
        {EVAL_DIMS.map((dim) => {
          const value = agg.dims[dim.key];
          return (
            <div key={dim.key} className={styles.metric} style={{ "--ec": dim.color } as CSSProperties}>
              <div className={styles.metricTop}>
                <span className={styles.metricName}>
                  <span className={styles.metricDot} />
                  {dim.short}
                </span>
                <span className={styles.methodTag}>{dim.method}</span>
              </div>
              <div className={styles.metricVal}>
                {value == null ? "—" : pct(value)}
                {value != null ? <small>%</small> : null}
              </div>
              <div className={styles.metricBar}>
                <div className={styles.metricBarFill} style={{ width: `${value == null ? 0 : pct(value)}%` }} />
              </div>
            </div>
          );
        })}
        <div className={styles.metric} style={{ "--ec": "#d97706" } as CSSProperties}>
          <div className={styles.metricTop}>
            <span className={styles.metricName}>
              <span className={styles.metricDot} />
              性能 · 成本
            </span>
            <span className={styles.methodTag}>实测</span>
          </div>
          <div className={styles.metricVal}>{formatMs(agg.p95)}</div>
          <div className={styles.metricSub}>
            P95 延迟 · 中位 {agg.p50}ms · {formatTok(agg.avgTokens)} tok/例
          </div>
        </div>
      </div>

      {/* 用例表 */}
      <div className={styles.caseCard}>
        <div className={styles.caseHead}>
          <h3 className={styles.caseTitle}>
            评测用例 <span className={styles.caseHint}>点击查看逐项归因</span>
          </h3>
          <span className={styles.badge}>{set.cases.length}</span>
        </div>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={set.cases}
          pagination={false}
          onRow={(item) => ({
            onClick: () => {
              if (!running) {
                setActiveCase(item);
              }
            },
          })}
          rowClassName={styles.caseRow}
        />
      </div>

      {/* 评分口径 */}
      <div className={styles.rubric}>
        <div className={styles.rubricTitle}>评分口径 <span className={styles.caseHint}>混合评估</span></div>
        {EVAL_DIMS.map((dim) => (
          <div key={dim.key} className={styles.rubricRow}>
            <span className={styles.metricDot} style={{ "--ec": dim.color } as CSSProperties} />
            <div>
              <b>
                {dim.name}（{dim.method}）
              </b>{" "}
              · {dim.desc}
            </div>
          </div>
        ))}
        <div className={styles.callout}>
          <InfoCircleOutlined />
          <span>
            用例来源三类：人工标注、真实会话回流、LLM 生成后人工确认；规则维度可确定性回归，LLM 维度用于答案质量。通过 = 五维均达阈值。
          </span>
        </div>
      </div>

      <CaseDrawer item={activeCase} onClose={() => setActiveCase(null)} />
    </section>
  );
}

function CaseDrawer({ item, onClose }: { item: EvalCase | null; onClose: () => void }) {
  const open = Boolean(item);
  const result = item?.result ?? null;
  const expect = item?.expect ?? null;

  return (
    <Drawer title="评测用例 · 逐项归因" width={560} open={open} onClose={onClose} destroyOnClose>
      {item ? (
        <div className={styles.drawer}>
          <div className={styles.drawerQ}>{item.question}</div>
          <div className={styles.drawerTags}>
            <Tag color={SOURCE_TAG[item.source]} bordered={false}>
              {EVAL_SOURCE_META[item.source].label}
            </Tag>
            {result ? (
              <Tag color={STATUS_TAG[result.status]} bordered={false}>
                {EVAL_STATUS_META[result.status].label}
              </Tag>
            ) : (
              <span className={styles.muted}>未评测</span>
            )}
            {item.tags.map((tag) => (
              <span key={tag} className={styles.qTag}>
                {tag}
              </span>
            ))}
          </div>

          {result && expect ? (
            <>
              <DiffSection
                title="规则比对"
                hint="确定性打分"
                rows={[
                  {
                    name: "Schema 检索",
                    color: "#2e68ff",
                    score: result.scores.schema,
                    expected: [...expect.obj, ...expect.rel],
                    actual: [...result.actual.obj, ...result.actual.rel],
                    expectedMissing: [...expect.obj, ...expect.rel].filter(
                      (label) => ![...result.actual.obj, ...result.actual.rel].includes(label),
                    ),
                  },
                  {
                    name: "工具 / 技能",
                    color: "#7c3aed",
                    score: result.scores.tool,
                    expected: expect.tools,
                    actual: result.actual.tools,
                    expectedMissing: expect.tools.filter((label) => !result.actual.tools.includes(label)),
                  },
                ]}
              />

              <div className={styles.sec}>
                <div className={styles.secTitle}>
                  LLM 评审 <span className={styles.caseHint}>LLM-as-judge</span>
                </div>
                <div className={styles.judge}>
                  <div className={styles.judgeHead}>
                    <span>
                      <CheckCircleOutlined /> 回答正确性
                    </span>
                    <span className={styles.judgeScore}>{pct(result.scores.correctness)}%</span>
                  </div>
                </div>
                <div className={styles.judge}>
                  <div className={styles.judgeHead}>
                    <span>
                      <SafetyOutlined /> 忠实度
                    </span>
                    <span className={styles.judgeScore}>{pct(result.scores.faithfulness)}%</span>
                  </div>
                </div>
              </div>

              {result.status !== "pass" ? (
                <div className={styles.warnCallout}>
                  <InfoCircleOutlined />
                  <span>
                    <b>失分原因：</b>
                    {result.reason}
                  </span>
                </div>
              ) : null}

              <div className={styles.sec}>
                <div className={styles.secTitle}>
                  实际调用链 <span className={styles.caseHint}>
                    {formatMs(result.latencyMs)} · {formatTok(result.tokens)} token
                  </span>
                </div>
                <div className={styles.chain}>
                  {result.actual.tools.length > 0 ? (
                    result.actual.tools.map((tool, index) => (
                      <span key={tool} className={styles.chainStep}>
                        {index > 0 ? <span className={styles.chainArrow}>→</span> : null}
                        <span className={styles.chainDot} />
                        {tool}
                      </span>
                    ))
                  ) : (
                    <span className={styles.muted}>无</span>
                  )}
                </div>
              </div>

              <div className={styles.sec}>
                <div className={styles.secTitle}>实际答复</div>
                <div className={styles.answer}>{result.actual.answer}</div>
              </div>
              <div className={styles.sec}>
                <div className={styles.secTitle}>参考答案</div>
                <div className={`${styles.answer} ${styles.answerRef}`}>{expect.ref}</div>
              </div>
            </>
          ) : expect ? (
            <>
              <div className={styles.sec}>
                <div className={styles.secTitle}>期望 Schema</div>
                <DiffChips items={[...expect.obj, ...expect.rel]} />
              </div>
              <div className={styles.sec}>
                <div className={styles.secTitle}>期望工具</div>
                <DiffChips items={expect.tools} />
              </div>
              <div className={styles.sec}>
                <div className={styles.secTitle}>参考答案</div>
                <div className={`${styles.answer} ${styles.answerRef}`}>{expect.ref}</div>
              </div>
              <div className={styles.warnCallout}>
                <InfoCircleOutlined />
                <span>该用例尚未运行评测。点击「运行评测」生成逐例打分。</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

type DiffRow = {
  name: string;
  color: string;
  score: number;
  expected: string[];
  actual: string[];
  expectedMissing: string[];
};

function DiffSection({ title, hint, rows }: { title: string; hint: string; rows: DiffRow[] }) {
  return (
    <div className={styles.sec}>
      <div className={styles.secTitle}>
        {title} <span className={styles.caseHint}>{hint}</span>
      </div>
      {rows.map((row) => (
        <div key={row.name} className={styles.diffRow}>
          <div className={styles.diffName}>
            <span className={styles.metricDot} style={{ "--ec": row.color } as CSSProperties} />
            {row.name}
          </div>
          <div className={styles.diffCompare}>
            <div className={styles.diffLine}>
              <span className={styles.diffLbl}>期望</span>
              <DiffChips items={row.expected} />
            </div>
            <div className={styles.diffLine}>
              <span className={styles.diffLbl}>实际</span>
              <DiffChips items={row.actual} missing={row.expectedMissing} />
            </div>
          </div>
          <div className={styles.diffScore} style={{ color: row.color }}>
            {pct(row.score)}
            <small>%</small>
          </div>
        </div>
      ))}
    </div>
  );
}
