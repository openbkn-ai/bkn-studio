/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Collapse, Tag, Typography } from "antd";
import type { M0CaseDetail, M0Run, EvalSuiteCaseDetail } from "./m0-run.service";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalExecutionDetails.module.css";
import { definitionText } from "./eval-definition-view";

export function EvalRunMaterials({
  detail,
  run,
  runId,
  definition,
  loading,
  failed,
  onRetry,
}: {
  detail: M0CaseDetail;
  run?: M0Run;
  runId?: string;
  definition?: EvalSuiteCaseDetail;
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.materialsUi.${key}`);
  const snapshot = definition?.definition;
  const runInfo = {
    id: runId ?? run?.id,
    case_run_id: detail.id,
    case_id: detail.case_id,
    case_name: detail.case_title,
    case_version: detail.case_version,
    case_version_id: detail.case_version_id,
    created_at: run?.created_at,
    started_at: run?.started_at,
    finished_at: run?.finished_at,
    execution_status: detail.execution_status,
    quality_outcome: detail.quality_outcome,
    result_revision: detail.result_revision ?? run?.result_revision,
    assessment_scope: detail.assessment_scope,
    runner_type: run?.runner_type,
    suite_name: run?.suite_name,
    suite_id: run?.scope?.kind === "suite" ? run.scope.suite_id : undefined,
    suite_version: run?.scope?.kind === "suite" ? run.scope.version : undefined,
    duration_ms: detail.duration_ms,
  };
  const hasContent = (value: unknown): boolean => {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.values(value).some(hasContent);
    return true;
  };
  const groups = [
    { id: "runMetadata", content: runInfo },
    {
      id: "configuration",
      content: {
        ...(snapshot
          ? {
              case: {
                title: snapshot.title,
                category: snapshot.category,
                risk_level: snapshot.risk_level,
                execution_spec: snapshot.execution_spec,
                diagnostic_spec: snapshot.diagnostic_spec,
              },
              criteria: snapshot.assertions,
              ...(definition?.gold_visible === false
                ? {}
                : { expected: snapshot.expected_spec, expected_source: snapshot.expected_source }),
            }
          : {}),
        input: detail.input_spec,
        assessment_target: detail.assessment_target,
        target_snapshot: detail.target_snapshot,
      },
    },
    {
      id: "evaluationRecords",
      content: {
        observation: detail.observation,
        assertions: detail.assertions,
        findings: detail.findings,
      },
    },
    { id: "traceIdentifiers", content: detail.evidence_refs },
  ].filter((group) => hasContent(group.content));
  return (
    <section aria-label={text("rawMaterials")} className={styles.materials}>
      <Collapse
        items={[
          {
            key: "materials",
            label: (
              <span className={styles.heading}>
                {text("rawMaterials")}
                {failed && <Tag color="warning">{text("partialReadFailure")}</Tag>}
              </span>
            ),
            children: (
              <div className={styles.rawGroups}>
                {!snapshot &&
                  (failed ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={definitionText("definitionFailed")}
                      action={
                        <Button size="small" onClick={onRetry}>
                          {definitionText("retry")}
                        </Button>
                      }
                    />
                  ) : (
                    <Typography.Text type="secondary">
                      {loading ? definitionText("loadingDefinition") : text("snapshotUnavailable")}
                    </Typography.Text>
                  ))}
                {definition?.gold_visible === false && (
                  <Typography.Text type="secondary">
                    {definitionText("protectedExpected")}
                  </Typography.Text>
                )}
                {groups.map((group) => (
                  <section key={group.id} aria-label={text(group.id)}>
                    <Typography.Title level={5}>{text(group.id)}</Typography.Title>
                    <EvalEvidenceContent id={group.id} content={group.content} />
                  </section>
                ))}
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
