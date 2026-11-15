/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Card, Skeleton, Spin } from "antd";
import { workspaceUi } from "./workspace-ui-text";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";

export function EvalOverviewPending({
  view,
  loading,
  caseTotal,
  suiteCount,
}: {
  view: "resources" | "execution";
  loading: boolean;
  caseTotal?: number;
  suiteCount: number | null;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.overviewLoading.${key}`);
  const metrics =
    view === "resources"
      ? [
          workspaceUi("totalResources"),
          t("knowledgeNetwork.eval.resourceOverview.problemMetric"),
          workspaceUi("resourceCoverage"),
          workspaceUi("ruleCheckCoverage"),
        ]
      : [
          workspaceUi("totalCases"),
          workspaceUi("enabledCases"),
          workspaceUi("knowledgeNetwork.eval.externalUi.suite"),
          workspaceUi("executionCoverage"),
        ];
  return (
    <div className={styles.overviewPane}>
      <section
        className={styles.overviewMetrics}
        aria-label={
          view === "resources"
            ? workspaceUi("knowledgeNetworkResourceCoverageStatistics")
            : workspaceUi("caseAndRunStatistics")
        }
      >
        {metrics.map((label, index) => (
          <div className={styles.pendingMetric} key={label}>
            <span>{label}</span>
            <strong>
              {view === "execution" && index === 0 && caseTotal !== undefined
                ? caseTotal
                : view === "execution" && index === 2 && suiteCount !== null
                  ? suiteCount
                  : "—"}
            </strong>
            <small>
              {loading ? (
                <>
                  <Spin size="small" /> {text(view === "resources" ? "resources" : "results")}
                </>
              ) : (
                text("unavailable")
              )}
            </small>
          </div>
        ))}
      </section>
      <Card
        title={
          view === "resources"
            ? t("knowledgeNetwork.eval.resourceOverview.title")
            : text("resultsTitle")
        }
      >
        {loading ? (
          <div role="status" aria-label={text("loadingSection")}>
            <Skeleton active title={false} paragraph={{ rows: 4 }} />
          </div>
        ) : (
          <span>{text("unavailable")}</span>
        )}
      </Card>
    </div>
  );
}
