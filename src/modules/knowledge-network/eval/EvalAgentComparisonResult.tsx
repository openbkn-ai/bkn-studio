/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel } from "./eval-readable-references";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useMemo, useRef, useState } from "react";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { EvalAgentCaseComparison, type ComparisonInspect } from "./EvalAgentCaseComparison";
import {
  buildAgentMetrics,
  filterComparisonCases,
  isDifferent,
  uniquePassRunId,
  type AgentMetrics,
  type ComparisonDifference,
  type ComparisonFocus,
} from "./agent-comparison-metrics";
import type {
  AgentComparison,
  AgentComparisonCase,
  AgentComparedRun,
} from "./agent-comparison.service";
import type { M0CaseDetail } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalAgentComparisonResult.module.css";

const prefix = "knowledgeNetwork.eval.agentCompare.";
const metricKeys = [
  "passRate",
  "passed",
  "failed",
  "inconclusive",
  "review_required",
  "changes",
  "unique",
  "percentiles",
] as const;
type MetricRow = { key: (typeof metricKeys)[number] };
export function EvalAgentComparisonResult({
  networkId,
  comparison,
  onInspect,
}: {
  networkId: string;
  comparison: AgentComparison;
  onInspect: ComparisonInspect;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`${prefix}${key}`);
  const [baselineId, setBaselineId] = useState(comparison.runs[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [difference, setDifference] = useState<ComparisonDifference>("all");
  const [outcome, setOutcome] = useState("all");
  const [changesOnly, setChangesOnly] = useState(false);
  const [focus, setFocus] = useState<ComparisonFocus>();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string>();
  const detailsCache = useRef(new Map<string, M0CaseDetail>());
  const matrixRef = useRef<HTMLDivElement>(null);
  const metrics = useMemo(
    () => buildAgentMetrics(comparison, baselineId),
    [comparison, baselineId],
  );
  const rows = useMemo(
    () =>
      filterComparisonCases(comparison, {
        query,
        difference,
        outcome,
        changesOnly,
        baselineId,
        focus,
      }),
    [comparison, query, difference, outcome, changesOnly, baselineId, focus],
  );
  const name = (run: AgentComparedRun) => run.external_agent?.name || text("unknownAgent");
  const runLabel = (run: AgentComparedRun, index: number) => `${index + 1}. ${name(run)}`;
  const duration = (value: number | null) =>
    value == null
      ? "—"
      : value < 1000
        ? `${value.toLocaleString()} ms`
        : `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
  const rate = (value: number | null) => (value == null ? "—" : `${Number(value.toFixed(1))}%`);
  const chooseFocus = (run: AgentComparedRun, kind: ComparisonFocus["kind"]) => {
    setFocus({ runId: run.id, kind });
    setQuery("");
    setDifference("all");
    setOutcome("all");
    setChangesOnly(false);
    setPage(1);
    setExpandedId(undefined);
    matrixRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };
  const countButton = (
    run: AgentComparedRun,
    kind: ComparisonFocus["kind"],
    count: number,
    label?: string,
  ) => (
    <Button
      type="link"
      className={styles.metricButton}
      aria-label={t(`${prefix}drilldown`, {
        agent: runLabel(run, comparison.runs.indexOf(run)),
        metric: label || text(`focusKinds.${kind}`),
        count,
      })}
      onClick={() => chooseFocus(run, kind)}
    >
      {label || count}
    </Button>
  );
  const metricContent = (row: MetricRow, run: AgentComparedRun) => {
    const stats: AgentMetrics = metrics[run.id];
    switch (row.key) {
      case "passRate":
        return (
          <div className={styles.rate}>
            {countButton(run, "pass", stats.passed, rate(stats.passRate))}
            {run.id === baselineId ? (
              <Tag>{text("baseline")}</Tag>
            ) : (
              stats.delta != null && (
                <span
                  className={
                    stats.delta > 0
                      ? styles.positive
                      : stats.delta < 0
                        ? styles.negative
                        : styles.secondary
                  }
                >
                  {t(`${prefix}percentagePoints`, {
                    value: `${stats.delta > 0 ? "+" : ""}${Number(stats.delta.toFixed(1))}`,
                  })}
                </span>
              )
            )}
          </div>
        );
      case "passed":
        return countButton(run, "pass", stats.passed, `${stats.passed} / ${stats.total}`);
      case "failed":
        return countButton(run, "fail", stats.failed);
      case "inconclusive":
        return countButton(run, "inconclusive", stats.inconclusive);
      case "review_required":
        return countButton(run, "review_required", stats.reviewRequired);
      case "changes":
        return run.id === baselineId ? (
          "—"
        ) : (
          <div className={styles.changeButtons}>
            {countButton(
              run,
              "gained",
              stats.gained,
              t(`${prefix}gainedCount`, { count: stats.gained }),
            )}
            {countButton(run, "lost", stats.lost, t(`${prefix}lostCount`, { count: stats.lost }))}
          </div>
        );
      case "unique":
        return countButton(run, "unique", stats.unique);
      case "percentiles":
        return (
          <Tooltip
            title={t(`${prefix}timingSample`, { count: stats.timingCount, total: stats.total })}
          >
            <span className={styles.timing}>
              {duration(stats.p50)} / {duration(stats.p90)}
              <small>
                {t(`${prefix}validTimings`, { count: stats.timingCount, total: stats.total })}
              </small>
            </span>
          </Tooltip>
        );
    }
  };
  const header = (run: AgentComparedRun, index: number) => (
    <div className={styles.agentHeader}>
      <strong title={runLabel(run, index)}>{runLabel(run, index)}</strong>
      <span title={run.external_agent?.model}>
        {run.external_agent?.model || text("unknownModel")}
      </span>
      <span title={run.external_agent?.client_version}>
        {run.external_agent?.client_version || text("unknownClient")}
      </span>
      <span>
        {run.created_at ? new Date(run.created_at).toLocaleString() : "—"} · {text("resultVersion")}{" "}
        v{run.result_revision}
      </span>
    </div>
  );
  const differenceTag = (row: AgentComparisonCase) => {
    const uniqueId = uniquePassRunId(row);
    if (uniqueId)
      return (
        <Tag color="blue">
          {t(`${prefix}uniqueAgent`, {
            index: comparison.runs.findIndex((run) => run.id === uniqueId) + 1,
          })}
        </Tag>
      );
    if (row.results.every((cell) => cell.quality_outcome === "pass"))
      return <Tag color="success">{text("differenceOptions.all_pass")}</Tag>;
    if (row.results.every((cell) => cell.quality_outcome === "fail"))
      return <Tag color="error">{text("allFailed")}</Tag>;
    return (
      <Tag color={isDifferent(row) ? "warning" : undefined}>
        {isDifferent(row) ? text("filters.different") : text("sameOutcome")}
      </Tag>
    );
  };
  const activeFocusRun = comparison.runs.find((run) => run.id === focus?.runId);
  const clear = () => {
    setQuery("");
    setDifference("all");
    setOutcome("all");
    setChangesOnly(false);
    setFocus(undefined);
    setPage(1);
    setExpandedId(undefined);
  };
  return (
    <div className={styles.result}>
      <div className={styles.conditions}>
        <Typography.Text>
          {t(`${prefix}comparisonScope`, {
            cases: comparison.cases.length,
            runs: comparison.runs.length,
          })}
        </Typography.Text>
        <label>
          <span>{text("baseline")}</span>
          <Select
            aria-label={text("chooseBaseline")}
            className={styles.baselineSelect}
            value={baselineId}
            onChange={(id) => {
              setBaselineId(id);
              setPage(1);
              setExpandedId(undefined);
            }}
            options={comparison.runs.map((run, index) => ({
              value: run.id,
              label: runLabel(run, index),
            }))}
          />
        </label>
      </div>
      {(!comparison.target_snapshot_compatible || !comparison.data_baseline_matched) && (
        <Alert
          type="warning"
          showIcon
          message={text("compatibilityWarning")}
          description={
            <>
              {!comparison.target_snapshot_compatible && <div>{text("targetWarning")}</div>}
              {!comparison.data_baseline_matched && <div>{text("baselineWarning")}</div>}
            </>
          }
        />
      )}
      <div className={styles.surface} role="region" aria-label={text("summary")}>
        <div className={styles.sectionHeader}>
          <strong>{text("summary")}</strong>
          <Typography.Text type="secondary">{text("rateHelp")}</Typography.Text>
        </div>
        <Table<MetricRow>
          rowKey="key"
          size="small"
          dataSource={metricKeys.map((key) => ({ key }))}
          pagination={false}
          scroll={{ x: 220 + comparison.runs.length * 240 }}
          columns={[
            {
              title: text("metric"),
              width: 220,
              fixed: "left",
              render: (_: unknown, row) => (
                <Tooltip
                  title={
                    row.key === "unique"
                      ? text("uniqueHelp")
                      : row.key === "changes"
                        ? text("changesHelp")
                        : row.key === "percentiles"
                          ? text("percentileHelp")
                          : undefined
                  }
                >
                  <span>
                    {row.key === "changes" || row.key === "unique" || row.key === "percentiles"
                      ? text(row.key)
                      : text(row.key === "passed" ? "passedCases" : row.key)}
                  </span>
                </Tooltip>
              ),
            },
            ...comparison.runs.map((run, index) => ({
              key: run.id,
              width: 240,
              title: header(run, index),
              render: (_: unknown, row: MetricRow) => metricContent(row, run),
            })),
          ]}
        />
      </div>
      <div ref={matrixRef} className={styles.surface} role="region" aria-label={text("matrix")}>
        <div className={styles.sectionHeader}>
          <Space>
            <strong>{text("matrix")}</strong>
            <Tag>
              {rows.length} / {comparison.cases.length}
            </Tag>
          </Space>
          <Typography.Text type="secondary">{text("differencesFirst")}</Typography.Text>
        </div>
        <div className={styles.filters}>
          <Input.Search
            className={styles.search}
            aria-label={text("searchCase")}
            placeholder={text("searchCase")}
            value={query}
            allowClear
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              setExpandedId(undefined);
            }}
          />
          <label>
            <span>{text("difference")}</span>
            <Select
              aria-label={text("caseFilter")}
              value={difference}
              onChange={(value) => {
                setDifference(value);
                setPage(1);
                setExpandedId(undefined);
              }}
              options={(["all", "different", "unique", "all_pass", "none_pass"] as const).map(
                (value) => ({ value, label: text(`differenceOptions.${value}`) }),
              )}
            />
          </label>
          <label>
            <span>{text("outcome")}</span>
            <Select
              aria-label={text("outcomeFilter")}
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(1);
                setExpandedId(undefined);
              }}
              options={["all", "pass", "fail", "inconclusive", "review_required"].map((value) => ({
                value,
                label: value === "all" ? text("allOutcomes") : text(`outcomes.${value}`),
              }))}
            />
          </label>
          <Checkbox
            checked={changesOnly}
            onChange={(event) => {
              setChangesOnly(event.target.checked);
              setPage(1);
              setExpandedId(undefined);
            }}
          >
            {text("changesOnly")}
          </Checkbox>
          {(query || difference !== "all" || outcome !== "all" || changesOnly || focus) && (
            <Button type="link" onClick={clear}>
              {text("clearFilters")}
            </Button>
          )}
        </div>
        {focus && activeFocusRun && (
          <div className={styles.focus}>
            <Tag
              closable
              onClose={() => {
                setFocus(undefined);
                setPage(1);
              }}
            >
              {runLabel(activeFocusRun, comparison.runs.indexOf(activeFocusRun))} ·{" "}
              {text(`focusKinds.${focus.kind}`)}
            </Tag>
          </div>
        )}
        <Table<AgentComparisonCase>
          rowKey="case_id"
          size="small"
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: 20,
            onChange: (next) => {
              setPage(next);
              setExpandedId(undefined);
            },
          }}
          scroll={{ x: 410 + comparison.runs.length * 240 }}
          locale={{
            emptyText: (
              <Empty description={text("noMatchingCases")}>
                <Button onClick={clear}>{text("showAllCases")}</Button>
              </Empty>
            ),
          }}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            onExpand: (expanded, row) => setExpandedId(expanded ? row.case_id : undefined),
            columnWidth: 36,
            fixed: "left",
            expandedRowRender: (row) =>
              expandedId === row.case_id ? (
                <EvalAgentCaseComparison
                  key={row.case_id}
                  networkId={networkId}
                  row={row}
                  runs={comparison.runs}
                  cache={detailsCache.current}
                  onInspect={onInspect}
                />
              ) : null,
          }}
          columns={[
            {
              title: text("case"),
              width: 244,
              fixed: "left",
              render: (_: unknown, row) => (
                <Button
                  className={styles.caseName}
                  title={row.title || evalReferenceLabel("unnamedCase")}
                  type="link"
                  aria-expanded={expandedId === row.case_id}
                  onClick={() =>
                    setExpandedId((value) => (value === row.case_id ? undefined : row.case_id))
                  }
                >
                  {row.title || evalReferenceLabel("unnamedCase")}
                </Button>
              ),
            },
            {
              title: text("difference"),
              width: 130,
              render: (_: unknown, row) => differenceTag(row),
            },
            ...comparison.runs.map((run, index) => ({
              key: run.id,
              width: 240,
              title: header(run, index),
              render: (_: unknown, row: AgentComparisonCase) => {
                const cell = row.results.find((item) => item.run_id === run.id);
                if (!cell) return "—";
                return (
                  <Button
                    type="link"
                    className={styles.resultCell}
                    aria-label={t(`${prefix}inspect`, { agent: name(run), title: row.title })}
                    onClick={() => onInspect(run, cell.case_run_id)}
                  >
                    <Tag
                      color={
                        cell.quality_outcome === "pass"
                          ? "success"
                          : cell.quality_outcome === "fail"
                            ? "error"
                            : "warning"
                      }
                    >
                      {text(`outcomes.${cell.quality_outcome}`)}
                    </Tag>
                    <span className={styles.secondary}>{duration(cell.duration_ms)}</span>
                  </Button>
                );
              },
            })),
          ]}
        />
      </div>
    </div>
  );
}
