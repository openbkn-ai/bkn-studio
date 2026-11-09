/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Button, Card, Space, Tooltip, Typography } from "antd";

import type { EvalOverview } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";

export type OverviewSummaryFilter =
  | "passed"
  | "failed"
  | "inconclusive"
  | "review_required"
  | "no_result"
  | "in_progress"
  | "execution_failed"
  | "cancelled"
  | "declaration";

type Props = {
  cases: EvalOverview["cases"];
  onCaseFilter: (filter: OverviewSummaryFilter) => void;
  onScope: () => void;
};

export function EvalOverviewExecutionSummary({ cases, onCaseFilter, onScope }: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.overviewSummary.${key}`);
  const coverage =
    cases.enabled > 0 ? Math.round((cases.evaluated / cases.enabled) * 1000) / 10 : 0;
  const metric = (key: string, count: number, filter: OverviewSummaryFilter) => {
    const content = (
      <>
        <span>{text(key)}</span>
        <strong>{count}</strong>
      </>
    );
    return count > 0 ? (
      <button key={filter} type="button" onClick={() => onCaseFilter(filter)}>
        {content}
      </button>
    ) : (
      <div key={filter}>{content}</div>
    );
  };
  const executionStates = [
    ["inProgress", cases.in_progress, "in_progress"],
    ["executionFailed", cases.execution_failed, "execution_failed"],
    ["cancelled", cases.cancelled, "cancelled"],
  ] as const;
  const declarationCount = (cases.declaration_passed ?? 0) + (cases.declaration_problems ?? 0);
  const title = (key: string, help: string) => (
    <Space size={8}>
      <span>{text(key)}</span>
      <Tooltip title={text(help)}>
        <QuestionCircleOutlined className={styles.overviewSummaryHelp} aria-label={text(help)} />
      </Tooltip>
    </Space>
  );

  return (
    <>
      <Card
        data-testid="eval-overview-results"
        className={styles.overviewSummaryCard}
        title={title("results", "resultsHelp")}
        extra={
          <Typography.Text type="secondary">
            {t("knowledgeNetwork.eval.overviewSummary.coverage", {
              evaluated: cases.evaluated,
              enabled: cases.enabled,
              percent: coverage,
            })}
          </Typography.Text>
        }
      >
        <div className={styles.overviewResultDistribution}>
          {metric("passed", cases.passed, "passed")}
          {metric("failed", cases.failed, "failed")}
          {metric("inconclusive", cases.inconclusive, "inconclusive")}
          {metric("reviewRequired", cases.review_required, "review_required")}
          {metric("noResult", Math.max(0, cases.enabled - cases.evaluated), "no_result")}
        </div>
        {executionStates.some(([, count]) => count > 0) && (
          <div className={styles.overviewExecutionStates}>
            {executionStates
              .filter(([, count]) => count > 0)
              .map(([key, count, filter]) => (
                <Button key={filter} type="link" onClick={() => onCaseFilter(filter)}>
                  {text(key)} {count}
                </Button>
              ))}
          </div>
        )}
        {declarationCount > 0 && (
          <Button
            className={styles.overviewDeclarationNote}
            type="link"
            onClick={() => onCaseFilter("declaration")}
          >
            {t("knowledgeNetwork.eval.overviewSummary.declarationOnly", {
              count: declarationCount,
            })}
          </Button>
        )}
      </Card>
      {cases.excluded > 0 && (
        <div className={styles.overviewScopeNote}>
          <Typography.Text type="secondary">
            {t("knowledgeNetwork.eval.overviewSummary.excluded", { count: cases.excluded })}
          </Typography.Text>
          <Button type="link" onClick={onScope}>
            {text("viewScope")}
          </Button>
        </div>
      )}
    </>
  );
}
