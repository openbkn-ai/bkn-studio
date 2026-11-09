/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { resultUiText } from "./result-ui-text";

import { evalScalarText } from "./eval-scalar-text";

import { evalReferenceLabel } from "./eval-readable-references";
import { evalTerm } from "./eval-terminology";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { Alert, Button, Descriptions, Space, Tag, Typography } from "antd";
import { useState, type ReactNode } from "react";
import type { M0CaseDetail, M0Run } from "./m0-run.service";
import { useEvalRunDefinition } from "./useEvalRunDefinition";
import { EvalComparisonColumnHandle } from "./EvalComparisonColumnHandle";
import { EvalRelationCheckResult } from "./EvalRelationCheckResult";
import { EvalResultValue } from "./EvalResultValue";
import { EvalExecutionDetails } from "./EvalExecutionDetails";
import { EvalCaseDetailTabs } from "./EvalCaseDetailTabs";
import {
  criterionLabel,
  criterionStandard,
  definitionText,
  definitionValue,
  valueAtPath,
} from "./eval-definition-view";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalMultiRunPanel.module.css";

const comparisonColumnWidths = [18, 23, 30, 29];

type Assertion = M0CaseDetail["assertions"][number];
const knownReasons: Record<string, string> = {
  "target execution did not complete": "executionIncomplete",
  "complete evidence is unavailable": "evidenceMissing",
  "resource use cannot be verified without complete evidence": "resourceUnverified",
  "reviewed Function call is absent from complete evidence": "resourceMissing",
  "review source was not verified": "outputUnverified",
  "normalized output source was not verified": "outputUnverified",
  "observed value differs from independent expectation": "mismatch",
  "observed field is missing": "fieldMissing",
  "required output field is missing": "fieldMissing",
  "human business decision is required": "reviewNeeded",
  "assertion type has no registered evaluator": "unsupportedCheck",
  "observed value does not meet the configured criterion": "mismatch",
  "observed value has an incompatible type": "outputTypeMismatch",
  "output is recorded without an automatic pass criterion": "observationOnly",
  "evaluation criterion configuration is invalid": "contract",
};
const failureReasons: Record<string, string> = {
  MASK_NOT_APPLICABLE: "maskNotApplicable",
  NO_DATA: "noData",
  PARTIAL_RESULT: "partialData",
  PERMISSION: "permission",
  EVIDENCE: "evidenceMissing",
  ENVIRONMENT: "environment",
  EVALUATION_CONTRACT: "contract",
  DEPENDENCY: "dependency",
};
const assertionNames: Record<string, string> = {
  equals: "checkEquals",
  json_schema: "checkSchema",
  exists: "checkExists",
  resource_used: "checkResource",
  evidence_complete: "checkEvidence",
  manual_review: "checkManual",
  numeric_range: "checkRange",
  approx: "checkApprox",
  contains: "checkContains",
  regex: "checkRegex",
  observation_only: "checkObserve",
};

export function EvalCaseResult({
  detail,
  run,
  onEvidence,
  initialTab,
  onExecutionActive,
  actions,
  notice,
  resultRevision,
  technicalDetails,
  networkId,
  runId,
  onRepair,
}: {
  detail: M0CaseDetail;
  run?: M0Run;
  onEvidence: () => void;
  initialTab?: "result" | "execution";
  onExecutionActive?: (active: boolean) => void;
  actions?: ReactNode;
  notice?: ReactNode;
  resultRevision?: number;
  technicalDetails?: ReactNode;
  networkId?: string;
  runId?: string;
  onRepair?: () => void | Promise<void>;
}) {
  const { t, i18n } = useEvalTranslation();
  const [columnWidths, setColumnWidths] = useState(comparisonColumnWidths);
  const {
    definition: frozenDefinition,
    failed: definitionFailed,
    loading: definitionLoading,
    retry: retryDefinition,
  } = useEvalRunDefinition(networkId, runId ?? run?.id, detail.id, detail.case_id);
  const text = (key: string) => t(`knowledgeNetwork.eval.resultUi.${key}`);
  const assessment = detail.assessment_target;
  const assessedNames =
    assessment?.resources
      .map((resource) => resource.name || evalReferenceLabel("unnamedResource"))
      .filter(Boolean) ?? [];
  // Only resource-check snapshots identify a tested resource; a direct function
  // capability is an execution tool and must never masquerade as that resource.
  const resourceCheck = ["object_data_check", "declaration_preflight", "resource_query"].includes(
    detail.target_snapshot?.runner ?? "",
  );
  const assessmentName =
    assessment?.kind === "business_scenario"
      ? evalTerm("scenarioTarget")
      : assessedNames.join("、") ||
        (resourceCheck ? detail.target_snapshot?.capability?.name : undefined) ||
        evalTerm("targetUnrecorded");
  const executionName = !resourceCheck ? detail.target_snapshot?.capability?.name : undefined;
  const obs = detail.observation;
  const query = obs?.query_summary;
  const resourceInvocation = detail.target_snapshot?.runner === "resource_query";
  const availabilityOnly =
    resourceInvocation &&
    (detail.assertions.some((item) => item.id === "availability" && item.type === "json_schema") ||
      obs?.resource_query_summary?.relation_check?.rule === "relation-query");
  const plannedScope = query?.scope ?? detail.target_snapshot?.object_data?.scope;
  const ruleID =
    detail.target_snapshot?.object_data?.rule_id ?? detail.input_spec?.template_rule_id;
  const keyRule =
    ruleID === "object-key-uniqueness"
      ? "uniqueKeys"
      : ruleID === "object-key-completeness"
        ? "completeKeys"
        : undefined;
  const verified = obs?.source_verified !== false;
  const emptyData =
    obs?.failure_class === "NO_DATA" ||
    (query?.checked_rows === 0 && obs?.failure_class !== "MASK_NOT_APPLICABLE");
  const successful = detail.quality_outcome === "pass";
  const terminal = ["completed", "failed", "cancelled"].includes(detail.execution_status);
  const failureClass =
    obs?.failure_class ?? detail.findings.find((item) => failureReasons[item.category])?.category;
  const failureKey = failureClass ? failureReasons[failureClass] : undefined;
  const reason = emptyData
    ? text("noData")
    : failureKey
      ? text(failureKey)
      : detail.execution_status === "cancelled"
        ? text("cancelledReason")
        : detail.execution_status === "failed"
          ? text("environment")
          : !terminal
            ? text("pendingReason")
            : detail.quality_outcome === "review_required"
              ? text("reviewNeeded")
              : detail.quality_outcome === "inconclusive"
                ? text("inconclusiveReason")
                : successful
                  ? text("passedReason")
                  : detail.quality_outcome === "fail"
                    ? text("mismatch")
                    : text("inconclusiveReason");
  const resultTitle = !terminal
    ? text(detail.execution_status === "queued" ? "queued" : "pending")
    : detail.execution_status === "cancelled"
      ? text("cancelled")
      : detail.execution_status === "failed"
        ? text("executionFailed")
        : detail.quality_outcome === "pass" && query?.scope.mode === "sample"
          ? text("samplePassed")
          : detail.quality_outcome === "pass" && detail.assessment_scope === "declaration"
            ? text("declarationPassed")
            : detail.quality_outcome === "pass"
              ? text("passed")
              : detail.quality_outcome === "fail"
                ? text("failed")
                : detail.quality_outcome === "review_required"
                  ? text("review")
                  : text("inconclusive");
  const color =
    successful && !emptyData ? "success" : detail.quality_outcome === "fail" ? "error" : "warning";
  const outcome = (value: string) =>
    text(
      (
        {
          pass: "passed",
          fail: "failed",
          inconclusive: "inconclusive",
          pending_review: "review",
          review_required: "review",
        } as Record<string, string>
      )[value] ?? "unknown",
    );
  const checkName = (item: Assertion) =>
    item.type === "equals" && keyRule
      ? text(keyRule)
      : text(assertionNames[item.type] ?? "checkOther");
  const message = (item: Assertion) =>
    item.outcome === "pass"
      ? "—"
      : emptyData
        ? text("noData")
        : failureKey
          ? text(failureKey)
          : item.message
            ? knownReasons[item.message]
              ? text(knownReasons[item.message])
              : /[\u3400-\u9fff]/.test(item.message)
                ? item.message
                : text("detailsInRaw")
            : item.outcome === "pending_review" || item.outcome === "review_required"
              ? text("reviewNeeded")
              : text("inconclusiveReason");
  const actualOutput = obs?.normalized_output;
  const actual =
    !verified || emptyData || !actualOutput
      ? text("noTrustedOutput")
      : query
        ? t("knowledgeNetwork.eval.resultUi.violationCount", { count: query.violations })
        : typeof actualOutput.answer === "string"
          ? actualOutput.answer
          : typeof actualOutput.leadtime_days === "number"
            ? t("knowledgeNetwork.eval.resultUi.days", { count: actualOutput.leadtime_days })
            : Object.entries(actualOutput)
                .slice(0, 3)
                .map(
                  ([key, value]) =>
                    `${key}：${typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : value == null ? "—" : text("structuredValue")}`,
                )
                .join("；") || text("emptyOutput");
  const assertionDefinition = (item: Assertion) =>
    frozenDefinition?.definition.assertions.find((a) => a.id === item.id);
  const standard = (item: Assertion) => {
    const assertion = assertionDefinition(item);
    if (assertion && frozenDefinition) {
      const path = typeof assertion.path === "string" ? assertion.path : undefined;
      const caption = `${path ? `${path === "$" ? definitionText("wholeResult") : path} · ` : ""}${criterionLabel(assertion)}`;
      const expected =
        item.type === "json_schema"
          ? assertion.schema
          : item.type === "equals" || item.type === "contains"
            ? frozenDefinition.gold_visible
              ? valueAtPath(
                  frozenDefinition.definition.expected_spec,
                  evalScalarText(assertion.expected_path ?? assertion.path ?? "$"),
                )
              : undefined
            : undefined;
      if (
        (expected !== null && typeof expected === "object") ||
        (typeof expected === "string" && expected.length > 160)
      ) {
        return (
          <div>
            <div className={styles.comparisonCaption}>{caption}</div>
            <EvalResultValue value={expected} label={text("standard")} />
          </div>
        );
      }
      return `${caption} · ${criterionStandard(assertion, frozenDefinition)}`;
    }
    return text(
      item.type === "equals" && keyRule
        ? "zeroViolations"
        : ((
            {
              equals: "standardEquals",
              json_schema: "standardSchema",
              exists: "standardExists",
              resource_used: "standardResource",
              evidence_complete: "standardEvidence",
              manual_review: "standardManual",
            } as Record<string, string>
          )[item.type] ?? "standardOther"),
    );
  };
  const checkActual = (item: Assertion) => {
    const assertion = assertionDefinition(item);
    if (assertion && typeof assertion.path === "string") {
      if (!verified || emptyData || !actualOutput) return text("noTrustedOutput");
      const value = valueAtPath(actualOutput, assertion.path);
      if (value === undefined) return definitionText("missingActual");
      return (value !== null && typeof value === "object") ||
        (typeof value === "string" && value.length > 160) ? (
        <div>
          <div className={styles.comparisonCaption}>
            {assertion.path === "$" ? definitionText("wholeResult") : assertion.path}
          </div>
          <EvalResultValue key={`${detail.id}:${item.id}`} value={value} label={text("actual")} />
        </div>
      ) : (
        definitionValue(value)
      );
    }
    return item.type === "equals" ? (
      actual.length > 160 ? (
        <EvalResultValue value={actual} label={text("actual")} />
      ) : (
        actual
      )
    ) : item.type === "evidence_complete" ? (
      text(obs?.evidence_status === "complete" ? "evidenceComplete" : "evidenceIncomplete")
    ) : item.type === "resource_used" ? (
      text(item.outcome === "pass" ? "resourceConfirmed" : "resourceUnverified")
    ) : item.type === "manual_review" ? (
      text("reviewNeeded")
    ) : [
        "exists",
        "json_schema",
        "numeric_range",
        "approx",
        "contains",
        "regex",
        "observation_only",
      ].includes(item.type) ? (
      definitionText("missingActual")
    ) : (
      outcome(item.outcome)
    );
  };
  const keys = query?.check_fields?.length
    ? query.check_fields
    : detail.target_snapshot?.object_data?.fields?.length
      ? detail.target_snapshot.object_data.fields
      : (query?.primary_keys ?? detail.target_snapshot?.object_data?.primary_keys);
  const stamp = run?.created_at ?? run?.started_at;
  const date = stamp ? new Date(stamp) : undefined;
  const startedAt =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "medium" }).format(
          date,
        )
      : "—";
  const assertions = [...detail.assertions].sort(
    (a, b) => Number(a.outcome === "pass") - Number(b.outcome === "pass"),
  );
  const summaryText = (key: string, values: Record<string, unknown> = {}) =>
    t(`knowledgeNetwork.eval.resultUi.summary.${key}`, {
      ...values,
      interpolation: { escapeValue: false },
    });
  let resultSummary = obs?.resource_query_summary?.execution_error || reason;
  if (
    detail.execution_status === "completed" &&
    ["pass", "fail"].includes(detail.quality_outcome ?? "") &&
    !emptyData &&
    !failureKey
  ) {
    if (!verified) resultSummary = text("outputUnverified");
    else if (query) {
      if (obs?.evidence_status !== "complete") resultSummary = text("evidenceMissing");
      else if (
        !Number.isSafeInteger(query.checked_rows) ||
        query.checked_rows < 1 ||
        !Number.isSafeInteger(query.violations) ||
        query.violations < 0
      )
        resultSummary = summaryText("statisticsUnavailable");
      else {
        const name =
          assessedNames.join("、") ||
          (resourceCheck && assessment?.kind !== "business_scenario"
            ? detail.target_snapshot?.capability?.name
            : undefined);
        const target = name ? summaryText("target", { name }) : "";
        const validTotal =
          Number.isSafeInteger(query.total_count) && query.total_count! >= query.checked_rows;
        const scope =
          query.scope.mode === "sample" ? (validTotal ? "sampleFrom" : "sample") : "all";
        resultSummary = summaryText(scope, {
          target,
          count: query.checked_rows,
          total: query.total_count,
        });
        const rule = keyRule
          ? text(keyRule)
          : [
              detail.input_spec?.template_rule_title,
              frozenDefinition?.definition.diagnostic_spec.template_rule_title,
              frozenDefinition?.source.rule_title,
            ].find((value): value is string => typeof value === "string" && !!value.trim());
        const fieldNames = keys?.slice(0, 3).join(summaryText("listSeparator"));
        const fields =
          fieldNames && keys!.length > 3
            ? summaryText("moreFields", { fields: fieldNames, count: keys!.length })
            : fieldNames;
        if (rule || fields)
          resultSummary += summaryText(rule && fields ? "ruleFields" : rule ? "rule" : "fields", {
            rule,
            fields,
          });
        resultSummary +=
          query.violations === 0
            ? summaryText("noViolations")
            : summaryText("violations", { count: query.violations });
        if (!successful && query.violations === 0)
          resultSummary += summaryText("otherCriteriaFailed");
      }
    } else if (obs?.evidence_status === "complete" && assertions.length) {
      resultSummary = summaryText("assertions", {
        execution: summaryText(
          detail.assessment_scope === "declaration" ? "declaration" : "execution",
        ),
        passed: assertions.filter((item) => item.outcome === "pass").length,
        failed: assertions.filter((item) => item.outcome === "fail").length,
        inconclusive: assertions.filter((item) => !["pass", "fail"].includes(item.outcome)).length,
      });
      const failedChecks = assertions
        .filter((item) => item.outcome === "fail")
        .slice(0, 3)
        .map(checkName);
      if (failedChecks.length)
        resultSummary += summaryText("failedChecks", {
          names: failedChecks.join(summaryText("listSeparator")),
        });
    }
  }

  if (query?.aggregate_checks && terminal && !failureClass) {
    resultSummary = resultUiText("aggregateSummary", {
      rows: query.checked_rows,
      checks: query.aggregate_checks,
      outcome: query.violations
        ? resultUiText("aggregateFailures", { count: query.violations })
        : resultUiText("aggregatePass"),
    });
  }
  return (
    <EvalCaseDetailTabs
      key={`${networkId}:${runId ?? run?.id}:${detail.id}:${detail.result_revision ?? resultRevision ?? run?.result_revision ?? 0}`}
      networkId={networkId ?? ""}
      runId={runId ?? run?.id ?? ""}
      caseRunId={detail.id}
      resultRevision={detail.result_revision ?? resultRevision ?? run?.result_revision ?? 0}
      eligible={
        !!networkId &&
        !!(runId ?? run?.id) &&
        ["completed", "failed"].includes(detail.execution_status) &&
        (detail.execution_status === "failed" ||
          ["fail", "inconclusive"].includes(detail.quality_outcome ?? ""))
      }
      actions={actions}
      onRepair={onRepair}
      notice={notice}
      initialTab={initialTab}
      onTabChange={(key) => onExecutionActive?.(key === "execution")}
      executionDetails={
        <section
          data-eval-execution-details
          aria-label={t("knowledgeNetwork.eval.detailTabs.executionTab")}
        >
          <EvalExecutionDetails
            target={assessmentName}
            tool={
              executionName ||
              (resourceInvocation ? detail.target_snapshot?.capability?.operation : undefined) ||
              (detail.target_snapshot?.runner === "object_data_check"
                ? plannedScope?.mode === "all"
                  ? "run_cypher"
                  : "query_object_instance"
                : undefined)
            }
            detail={detail}
            run={run}
            runId={runId}
            definition={frozenDefinition}
            failed={definitionFailed}
            loading={definitionLoading}
            onRetry={retryDefinition}
          >
            {technicalDetails}
          </EvalExecutionDetails>
        </section>
      }
    >
      {(showExecution) => (
        <div className={styles.tabPanel}>
          <section className={styles.caseConclusion} aria-label={text("conclusion")}>
            <div className={styles.conclusionTitle}>
              <Tag color={color}>{resultTitle}</Tag>
              <span>{resultSummary}</span>
            </div>
            {availabilityOnly && (
              <Typography.Text type="secondary">{text("availabilityBoundary")}</Typography.Text>
            )}
            {query && (
              <Typography.Text type="secondary">
                {text(query.scope.mode === "sample" ? "sampleBoundary" : "allBoundary")}
              </Typography.Text>
            )}
            {(!successful || emptyData) && terminal && (
              <Button
                type="link"
                onClick={() => {
                  onEvidence();
                  showExecution();
                }}
              >
                {text("viewEvidence")}
              </Button>
            )}
          </section>
          <EvalRelationCheckResult summary={obs?.resource_query_summary} />
          {query?.program_version && (
            <section aria-label={resultUiText("programStatistics")}>
              <Space wrap style={{ margin: "12px 0" }}>
                {query.read_rows !== undefined && (
                  <Typography.Text>
                    {resultUiText("readRows", { count: query.read_rows })}
                  </Typography.Text>
                )}
                <Typography.Text>
                  {resultUiText("checkedRows", { count: query.checked_rows })}
                </Typography.Text>
                {query.reference_rows !== undefined && (
                  <Typography.Text>
                    {resultUiText("referenceRows", { count: query.reference_rows })}
                  </Typography.Text>
                )}
              </Space>
              {!!query.aggregate_results?.length && (
                <Table
                  rowKey={(_, index) => String(index)}
                  dataSource={query.aggregate_results}
                  pagination={false}
                  columns={[
                    {
                      title: resultUiText("aggregateFunction"),
                      dataIndex: "function",
                      render: (value: string) =>
                        ({
                          count: resultUiText("count"),
                          non_null_count: resultUiText("nonNullCount"),
                          distinct_count: resultUiText("distinctCount"),
                          sum: resultUiText("sum"),
                          min: resultUiText("min"),
                          max: resultUiText("max"),
                        })[value as "count"] ?? value,
                    },
                    {
                      title: resultUiText("field"),
                      dataIndex: "field",
                      render: (v: string) => v || resultUiText("allRows"),
                    },
                    { title: resultUiText("actual"), dataIndex: "actual_exact" },
                    {
                      title: resultUiText("criterion"),
                      render: (_, row) =>
                        `${{ eq: resultUiText("eq"), ne: resultUiText("ne"), gt: resultUiText("gt"), gte: resultUiText("gte"), lt: resultUiText("lt"), lte: resultUiText("lte") }[row.operator as "eq"] ?? row.operator} ${String(row.expected)}`,
                    },
                    {
                      title: resultUiText("result"),
                      dataIndex: "passed",
                      render: (v: boolean) => (
                        <Tag color={v ? "green" : "red"}>
                          {v ? resultUiText("passed") : resultUiText("failed")}
                        </Tag>
                      ),
                    },
                  ]}
                />
              )}
            </section>
          )}
          {query?.violation_examples && query.violation_examples.length > 0 && (
            <section className={styles.violationNotice}>
              <h4>{text("violationExamples")}</h4>
              <Table
                rowKey={(row) => `${row.record_index}:${row.field}:${row.reason}`}
                dataSource={query.violation_examples}
                pagination={{ pageSize: 5 }}
                scroll={{ x: 850 }}
                columns={[
                  {
                    title: text("violationResource"),
                    width: 150,
                    render: (_, row) =>
                      row.resource_name ||
                      assessment?.resources.find(
                        (resource) => resource.resource_id === row.resource_id,
                      )?.name ||
                      evalReferenceLabel("unnamedResource"),
                  },
                  { title: text("violationField"), dataIndex: "field", width: 130 },
                  {
                    title: text("declaredType"),
                    dataIndex: "declared_type",
                    width: 100,
                    render: (value: string | undefined) => value || "—",
                  },
                  { title: text("actualType"), dataIndex: "actual_type", width: 100 },
                  {
                    title: text("violationValue"),
                    width: 160,
                    render: (_, row) => (
                      <Typography.Text style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {definitionValue(row.value)}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: text("recordKey"),
                    width: 210,
                    render: (_, row) =>
                      Object.keys(row.primary_key).length ? (
                        <Typography.Text style={{ wordBreak: "break-all" }}>
                          {definitionValue(row.primary_key)}
                        </Typography.Text>
                      ) : (
                        text("recordKeyUnavailable")
                      ),
                  },
                ]}
              />
              {query.violation_examples_truncated && (
                <Typography.Text type="secondary">
                  {t("knowledgeNetwork.eval.resultUi.examplesLimited", {
                    count: query.violation_examples_limit,
                  })}
                </Typography.Text>
              )}
            </section>
          )}
          {detail.quality_outcome === "fail" &&
            query &&
            query.violations > 0 &&
            !query.violation_examples?.length && (
              <Alert
                className={styles.violationNotice}
                type="warning"
                showIcon
                message={text("violationSamplesUnavailable")}
              />
            )}
          <section aria-label={text("checkInfo")}>
            <Typography.Title level={5} className={styles.subsectionTitle}>
              {text("checkInfo")}
            </Typography.Title>
            <Descriptions className={styles.testInfo} size="small" bordered column={2}>
              <Descriptions.Item label={text("resource")}>{assessmentName}</Descriptions.Item>
              <Descriptions.Item label={text("rule")}>
                {keyRule
                  ? text(keyRule)
                  : typeof detail.input_spec?.template_rule_title === "string"
                    ? detail.input_spec.template_rule_title
                    : typeof ruleID === "string" && ruleID
                      ? ruleID
                      : evalTerm("noRelatedRule")}
              </Descriptions.Item>
              {keys?.length ? (
                <Descriptions.Item label={text("keys")} span={2}>
                  {keys.join("、")}
                </Descriptions.Item>
              ) : null}
              {run?.scope?.kind === "suite" &&
                run.scope.version != null &&
                run.scope.version > 0 && (
                  <Descriptions.Item label={text("suiteVersion")} span={2}>
                    {run.suite_name ? `${run.suite_name} · ` : ""}v{run.scope.version}
                  </Descriptions.Item>
                )}
              {executionName && (
                <Descriptions.Item
                  span={2}
                  label={evalTerm(
                    detail.target_snapshot?.capability?.metadata_type === "function"
                      ? "executionFunction"
                      : "executionCapability",
                  )}
                >
                  {executionName}
                </Descriptions.Item>
              )}

              {typeof detail.input_spec?.question === "string" &&
                (!keyRule || run?.runner_type === "external_agent") && (
                  <Descriptions.Item label={text("testQuestion")} span={2}>
                    <Typography.Paragraph className={styles.testQuestion}>
                      {detail.input_spec.question}
                    </Typography.Paragraph>
                  </Descriptions.Item>
                )}
              {plannedScope && !query && (
                <Descriptions.Item label={text("scope")}>
                  {text(plannedScope.mode === "sample" ? "sampleScope" : "allScope")}
                </Descriptions.Item>
              )}
              {query && (
                <>
                  <Descriptions.Item label={text("scope")}>
                    {text(query.scope.mode === "sample" ? "sampleScope" : "allScope")}
                  </Descriptions.Item>
                  <Descriptions.Item label={text("checked")}>
                    {query.checked_rows}
                  </Descriptions.Item>
                  {query.total_count != null && (
                    <Descriptions.Item label={text("visibleTotal")}>
                      {query.total_count}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label={text("violations")}>
                    {verified && !emptyData ? query.violations : "—"}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label={text("runTime")}>{startedAt}</Descriptions.Item>
              <Descriptions.Item label={text("totalDuration")}>
                {detail.duration_ms == null ? "—" : `${detail.duration_ms} ms`}
              </Descriptions.Item>
            </Descriptions>
            {technicalDetails && !assertions.some((item) => item.type === "equals") && (
              <Typography.Paragraph className={styles.resultValue}>
                <strong>{text("actual")}：</strong>
                {actual}
              </Typography.Paragraph>
            )}
          </section>
          {obs?.source_kind === "external_submission" && obs.answer && (
            <>
              <Typography.Title level={5} className={styles.subsectionTitle}>
                {text("agentAnswer")}
              </Typography.Title>
              <Typography.Paragraph className={styles.agentAnswer}>
                {obs.answer}
              </Typography.Paragraph>
            </>
          )}
          <section className={styles.assertionSection} aria-label={text("checkDetails")}>
            {definitionFailed && (
              <Alert
                type="warning"
                showIcon
                message={definitionText("definitionFailed")}
                action={
                  <Button onClick={() => retryDefinition()}>{definitionText("retry")}</Button>
                }
              />
            )}
            {definitionLoading && (
              <Typography.Paragraph type="secondary">
                {definitionText("loadingDefinition")}
              </Typography.Paragraph>
            )}
            <Typography.Title level={5} className={styles.subsectionTitle}>
              {text("checkDetails")}
            </Typography.Title>
            <Table<Assertion>
              className={styles.assertionTable}
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={assertions}
              locale={{ emptyText: text("noAssertions") }}
              columns={[
                {
                  title: (
                    <>
                      <span>{text("checkItem")}</span>
                      <EvalComparisonColumnHandle
                        index={0}
                        widths={columnWidths}
                        onChange={setColumnWidths}
                        onReset={() => setColumnWidths(comparisonColumnWidths)}
                        label={t("knowledgeNetwork.eval.resultValueUi.resizeColumns", {
                          left: text("checkItem"),
                          right: text("standard"),
                        })}
                      />
                    </>
                  ),
                  width: `${columnWidths[0]}%`,
                  onHeaderCell: () => ({ className: styles.comparisonResizableHeader }),
                  onCell: () => ({
                    className: styles.assertionCell,
                    "data-label": text("checkItem"),
                  }),
                  render: (_, item) => checkName(item),
                },
                {
                  title: (
                    <>
                      <span>{text("standard")}</span>
                      <EvalComparisonColumnHandle
                        index={1}
                        widths={columnWidths}
                        onChange={setColumnWidths}
                        onReset={() => setColumnWidths(comparisonColumnWidths)}
                        label={t("knowledgeNetwork.eval.resultValueUi.resizeColumns", {
                          left: text("standard"),
                          right: text("actual"),
                        })}
                      />
                    </>
                  ),
                  width: `${columnWidths[1]}%`,
                  onHeaderCell: () => ({ className: styles.comparisonResizableHeader }),
                  onCell: () => ({
                    className: styles.assertionCell,
                    "data-label": text("standard"),
                  }),
                  render: (_, item) => standard(item),
                },
                {
                  title: (
                    <>
                      <span>{text("actual")}</span>
                      <EvalComparisonColumnHandle
                        index={2}
                        widths={columnWidths}
                        onChange={setColumnWidths}
                        onReset={() => setColumnWidths(comparisonColumnWidths)}
                        label={t("knowledgeNetwork.eval.resultValueUi.resizeColumns", {
                          left: text("actual"),
                          right: text("resultAndExplanation"),
                        })}
                      />
                    </>
                  ),
                  width: `${columnWidths[2]}%`,
                  onHeaderCell: () => ({ className: styles.comparisonResizableHeader }),
                  onCell: () => ({ className: styles.assertionCell, "data-label": text("actual") }),
                  render: (_, item) => (
                    <div className={styles.resultValue}>{checkActual(item)}</div>
                  ),
                },
                {
                  title: text("resultAndExplanation"),
                  width: `${columnWidths[3]}%`,
                  onCell: () => ({
                    className: styles.assertionCell,
                    "data-label": text("resultAndExplanation"),
                  }),
                  render: (_, item) => {
                    const explanation = message(item);
                    return (
                      <div className={styles.assertionConclusion}>
                        <Tag
                          color={
                            item.outcome === "pass"
                              ? "success"
                              : item.outcome === "fail"
                                ? "error"
                                : "warning"
                          }
                        >
                          {outcome(item.outcome)}
                        </Tag>
                        {explanation !== "—" && <span>{explanation}</span>}
                      </div>
                    );
                  },
                },
              ]}
            />
          </section>
        </div>
      )}
    </EvalCaseDetailTabs>
  );
}
