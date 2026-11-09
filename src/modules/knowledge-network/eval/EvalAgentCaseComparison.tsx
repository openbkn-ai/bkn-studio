/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel } from "./eval-readable-references";
import { Alert, Button, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { getRunCaseDetail, type M0CaseDetail, type M0Run } from "./m0-run.service";
import type { AgentComparisonCase, AgentComparedRun } from "./agent-comparison.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalAgentComparisonResult.module.css";

export type ComparisonInspect = (
  run: M0Run,
  caseRunId: string,
  tab?: "result" | "evidence",
) => void;
type Loaded =
  | { status: "loading"; detail?: undefined }
  | { status: "error"; detail?: undefined }
  | { status: "loaded"; detail: M0CaseDetail };
const prefix = "knowledgeNetwork.eval.agentCompare.";
const fields = ["answer", "output", "assertions", "evidence", "trace"] as const;
type Field = (typeof fields)[number];

export function EvalAgentCaseComparison({
  networkId,
  row,
  runs,
  cache,
  onInspect,
}: {
  networkId: string;
  row: AgentComparisonCase;
  runs: AgentComparedRun[];
  cache: Map<string, M0CaseDetail>;
  onInspect: ComparisonInspect;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`${prefix}${key}`);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    for (const run of runs) {
      const cell = row.results.find((item) => item.run_id === run.id);
      if (!cell) continue;
      const key = `${networkId}:${run.id}:${run.result_revision}:${run.result_checksum}:${cell.case_run_id}`;
      const saved = cache.get(key);
      if (saved) {
        setLoaded((current) => ({ ...current, [run.id]: { status: "loaded", detail: saved } }));
        continue;
      }
      setLoaded((current) => ({ ...current, [run.id]: { status: "loading" } }));
      void getRunCaseDetail(
        networkId,
        run.id,
        cell.case_run_id,
        run.result_revision ?? undefined,
        controller.signal,
      )
        .then((detail) => {
          if (controller.signal.aborted) return;
          if (
            detail.id !== cell.case_run_id ||
            detail.case_id !== row.case_id ||
            detail.case_version_id !== row.case_version_id ||
            detail.result_revision !== run.result_revision ||
            detail.result_checksum !== run.result_checksum ||
            detail.quality_outcome !== cell.quality_outcome
          )
            throw new Error("Mismatched frozen result");
          cache.set(key, detail);
          if (cache.size > 18) {
            const first = cache.keys().next().value;
            if (first) cache.delete(first);
          }
          setLoaded((current) => ({ ...current, [run.id]: { status: "loaded", detail } }));
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setLoaded((current) => ({ ...current, [run.id]: { status: "error" } }));
        });
    }
    return () => controller.abort();
  }, [networkId, row, runs, cache, retry]);
  const first = runs.map((run) => loaded[run.id]?.detail).find(Boolean);
  const assertionList = (items: M0CaseDetail["assertions"]) => (
    <ul className={styles.assertions}>
      {items.map((item, index) => (
        <li key={item.id}>
          <Tag
            color={
              item.outcome === "pass" ? "success" : item.outcome === "fail" ? "error" : "warning"
            }
          >
            {t(
              `${prefix}outcomes.${item.outcome === "pending_review" ? "review_required" : item.outcome === "error" ? "inconclusive" : item.outcome}`,
              { defaultValue: item.outcome },
            )}
          </Tag>
          <span>{item.message || evalReferenceLabel("decision", { index: index + 1 })}</span>
        </li>
      ))}
    </ul>
  );
  const content = (field: Field, run: AgentComparedRun) => {
    const state = loaded[run.id];
    if (!state || state.status === "loading")
      return field === "answer" ? <Spin size="small" aria-label={text("loadingDetail")} /> : "—";
    if (state.status === "error")
      return field === "answer" ? (
        <Alert
          type="error"
          showIcon
          message={text("detailFailed")}
          action={
            <Button type="link" onClick={() => setRetry((value) => value + 1)}>
              {text("retry")}
            </Button>
          }
        />
      ) : (
        "—"
      );
    const detail = state.detail;
    switch (field) {
      case "answer":
        return detail.observation?.answer ? (
          <Typography.Paragraph
            className={styles.answer}
            ellipsis={{ rows: 3, expandable: true, symbol: text("expandText") }}
          >
            {detail.observation.answer}
          </Typography.Paragraph>
        ) : (
          <span className={styles.secondary}>{text("notProvided")}</span>
        );
      case "output":
        return detail.observation?.normalized_output != null ? (
          <details>
            <summary>{text("showOutput")}</summary>
            <pre className={styles.code}>
              {JSON.stringify(detail.observation.normalized_output, null, 2)}
            </pre>
          </details>
        ) : (
          "—"
        );
      case "assertions": {
        const failed = detail.assertions.filter((item) => item.outcome !== "pass");
        if (!detail.assertions.length) return text("notProvided");
        return (
          <>
            {failed.length ? (
              assertionList(failed.slice(0, 3))
            ) : (
              <span>{t(`${prefix}allAssertionsPassed`, { count: detail.assertions.length })}</span>
            )}
            <details>
              <summary>{t(`${prefix}allAssertions`, { count: detail.assertions.length })}</summary>
              {assertionList(detail.assertions)}
            </details>
          </>
        );
      }
      case "evidence": {
        const status = detail.observation?.evidence_status;
        return (
          <Tag color={status === "complete" ? "success" : "warning"}>
            {t(`${prefix}evidenceStates.${status ?? "unknown"}`, {
              defaultValue: text("notProvided"),
            })}
          </Tag>
        );
      }
      case "trace":
        return (
          <Button
            type="link"
            className={styles.textButton}
            disabled={
              !detail.evidence_refs?.interaction_id &&
              !detail.evidence_refs?.operation_id &&
              !detail.evidence_refs?.receipt_id
            }
            onClick={() => onInspect(run, detail.id, "evidence")}
          >
            {text("viewTrace")}
          </Button>
        );
    }
  };
  return (
    <section
      className={styles.caseDetails}
      aria-label={t(`${prefix}caseComparison`, { title: row.title })}
    >
      <div className={styles.sharedInput}>
        <strong>{text("testInput")}</strong>
        <span>
          {typeof first?.input_spec?.question === "string" ? first.input_spec.question : "—"}
        </span>
        {first?.input_spec?.arguments != null && (
          <details>
            <summary>{text("arguments")}</summary>
            <pre className={styles.code}>{JSON.stringify(first.input_spec.arguments, null, 2)}</pre>
          </details>
        )}
      </div>
      <Table
        rowKey="field"
        size="small"
        pagination={false}
        dataSource={fields.map((field) => ({ field }))}
        scroll={{ x: 180 + runs.length * 240 }}
        columns={[
          {
            title: text("detailDimension"),
            width: 180,
            fixed: "left",
            render: (_: unknown, item) => text(`detailFields.${item.field}`),
          },
          ...runs.map((run, index) => ({
            key: run.id,
            width: 240,
            title: `${index + 1}. ${run.external_agent?.name || text("unknownAgent")}`,
            render: (_: unknown, item: { field: Field }) => content(item.field, run),
          })),
        ]}
      />
    </section>
  );
}
