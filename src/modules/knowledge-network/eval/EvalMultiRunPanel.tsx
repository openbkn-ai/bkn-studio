/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel } from "./eval-readable-references";
import { evalOutcomeLabel, evalExecutionStatusLabel } from "./eval-terminology";

import {
  Alert,
  Button,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";

import { EvalCaseResult } from "./EvalCaseResult";
import { EvalTraceEvidence } from "./EvalTraceEvidence";
import styles from "./EvalMultiRunPanel.module.css";
import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";

import {
  cancelM0Run,
  getM0Run,
  getRunCaseDetail,
  listRunCases,
  type M0CaseDetail,
  type M0CaseRun,
  type M0Run,
  type M1CaseRunPage,
  type RunCaseCounts,
} from "./m0-run.service";

type Props = {
  networkId: string;
  runId: string;
  preferredCaseRunId?: string;
  comparedResultRevision?: number;
  initialAssessmentScope?: "runtime" | "declaration";
  initialOutcome?: NonNullable<M0Run["quality_outcome"]> | "all";
  initialDetailTab?: "result" | "evidence";
  caseCounts?: RunCaseCounts;
  onRerun?: (detail: M0CaseDetail) => void;
  onViewCase?: (detail: M0CaseDetail) => void;
  onSettled?: () => void;
  onRepair?: (run: M0Run, detail: M0CaseDetail) => void | Promise<void>;
  onRunLoaded?: (run: M0Run) => void;
  onSelectionChange?: (caseRunId: string, tab: "result" | "evidence") => void;
  onOutcomeChange?: (outcome: NonNullable<M0Run["quality_outcome"]> | "all") => void;
};

const finished = (run: M0Run) =>
  run.execution_status === "completed" ||
  run.execution_status === "failed" ||
  run.execution_status === "cancelled";

const outcomeLabel = evalOutcomeLabel;

const assessmentLabel = (scope?: M0Run["assessment_scope"] | M0CaseRun["assessment_scope"]) =>
  scope === "declaration"
    ? workspaceUi("declarationPreflight")
    : scope === "mixed"
      ? workspaceUi("mixedEvaluation")
      : workspaceUi("realExecution");

const assessedOutcomeLabel = (
  outcome: M0Run["quality_outcome"],
  scope?: M0Run["assessment_scope"] | M0CaseRun["assessment_scope"],
) =>
  outcome === "pass" && scope === "declaration"
    ? workspaceUi("knowledgeNetwork.eval.resultUi.declarationPassed")
    : outcomeLabel(outcome);

const outcomeColor = (outcome: M0Run["quality_outcome"]) =>
  outcome === "pass" ? "success" : outcome === "fail" ? "error" : outcome ? "warning" : undefined;

const statusLabel = evalExecutionStatusLabel;

export function EvalMultiRunPanel({
  networkId,
  runId,
  preferredCaseRunId,
  comparedResultRevision,
  initialOutcome = "all",
  initialAssessmentScope,
  initialDetailTab = "result",
  caseCounts,
  onRerun,
  onViewCase,
  onSettled,
  onRepair,
  onRunLoaded,
  onSelectionChange,
  onOutcomeChange,
}: Props) {
  const { t } = useEvalTranslation();
  const [run, setRun] = useState<M0Run>();
  const [page, setPage] = useState<M1CaseRunPage>();
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<M0CaseDetail>();
  const [selectedCaseRunId, setSelectedCaseRunId] = useState<string>();
  const [detailRevision, setDetailRevision] = useState(0);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [polls, setPolls] = useState(0);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [externalReplayOpen, setExternalReplayOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorCollapsed, setSelectorCollapsed] = useState(false);
  const preferredSelection = useRef(preferredCaseRunId);
  preferredSelection.current = preferredCaseRunId;
  const callbacks = useRef({ onRunLoaded, onSelectionChange });
  callbacks.current = { onRunLoaded, onSelectionChange };
  useEffect(() => {
    setOutcome(initialOutcome);
  }, [initialOutcome]);
  useEffect(() => {
    if (preferredCaseRunId) setSelectedCaseRunId(preferredCaseRunId);
  }, [preferredCaseRunId]);
  useEffect(() => {
    if (run) callbacks.current.onRunLoaded?.(run);
  }, [run]);
  useEffect(() => {
    if (detail && detail.id === selectedCaseRunId && !detailLoading)
      callbacks.current.onSelectionChange?.(detail.id, technicalOpen ? "evidence" : "result");
  }, [detail, selectedCaseRunId, detailLoading, technicalOpen]);
  const selectorId = useId();
  const detailScroll = useRef<HTMLDivElement>(null);
  const caseScroll = useRef<HTMLDivElement>(null);
  const settled = useRef<string | undefined>(undefined);
  const listRequest = useRef(0);
  const listController = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const request = ++listRequest.current;
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    setLoading(true);
    setError("");
    try {
      const [nextRun, nextPage] = await Promise.all([
        getM0Run(networkId, runId, controller.signal),
        listRunCases(
          networkId,
          runId,
          cursor,
          outcome === "all" ? undefined : outcome,
          controller.signal,
          search || undefined,
          ...(initialAssessmentScope ? ([initialAssessmentScope] as const) : ([] as const)),
        ),
      ]);
      if (listRequest.current !== request) return;
      setRun(nextRun);
      setPage(nextPage);
      const initialCaseRunId =
        (!cursor && !search ? preferredSelection.current : undefined) || nextPage.entries[0]?.id;
      setSelectedCaseRunId((current) =>
        nextPage.entries.some((entry) => entry.id === current) ||
        (!cursor &&
          !search &&
          Boolean(preferredSelection.current) &&
          current === preferredSelection.current)
          ? current
          : initialCaseRunId,
      );
    } catch {
      if (listRequest.current === request)
        setError(workspaceUi("cannotLoadRunResultsRefreshAndTryAgain"));
    } finally {
      if (listRequest.current === request) setLoading(false);
    }
  }, [networkId, runId, cursor, outcome, search, initialAssessmentScope]);

  useEffect(() => {
    setSearchText("");
    setSearch("");
    setRun(undefined);
    setPage(undefined);
    setCursor(undefined);
    setHistory([]);
    setDetail(undefined);
    setSelectedCaseRunId(preferredSelection.current);
    setDetailError("");
    setTechnicalOpen(false);
    setPolls(0);
    setExternalReplayOpen(false);
    settled.current = undefined;
  }, [runId]);

  useEffect(() => {
    setTechnicalOpen(selectedCaseRunId === preferredCaseRunId && initialDetailTab === "evidence");
  }, [selectedCaseRunId, preferredCaseRunId, initialDetailTab]);

  useEffect(() => {
    void refresh();
    return () => {
      listRequest.current += 1;
      listController.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!run || finished(run) || polls >= 20 || error) return;
    const timer = window.setTimeout(
      () => {
        setPolls((value) => value + 1);
        void refresh();
      },
      Math.min(1000 * 2 ** Math.min(polls, 3), 8000),
    );
    return () => window.clearTimeout(timer);
  }, [run, polls, error, refresh]);

  const selectedRow = page?.entries.find((entry) => entry.id === selectedCaseRunId);
  const selectedStatus = selectedRow?.execution_status;
  const selectedOutcome = selectedRow?.quality_outcome;
  const resultRevision = run?.result_revision;
  useEffect(() => {
    if (!selectedCaseRunId) {
      setDetailLoading(false);
      setDetailError("");
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    setDetail((current) => (current?.id === selectedCaseRunId ? current : undefined));
    void getRunCaseDetail(networkId, runId, selectedCaseRunId, undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDetail(value);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setDetailError(
            axios.isAxiosError(cause) && cause.response?.status === 409
              ? workspaceUi("aResourceOrCaseReferencedByThisHistoricalRun")
              : workspaceUi("cannotLoadCaseResultsTryAgain"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [
    networkId,
    runId,
    selectedCaseRunId,
    selectedStatus,
    selectedOutcome,
    resultRevision,
    detailRevision,
  ]);

  useEffect(() => {
    if (!run) return;
    if (!finished(run)) {
      settled.current = runId;
      return;
    }
    if (settled.current === runId) {
      settled.current = undefined;
      onSettled?.();
    }
  }, [run, runId, onSettled]);

  useEffect(() => {
    if (caseScroll.current) caseScroll.current.scrollTop = 0;
  }, [cursor, outcome]);

  const selectCase = (caseRunId: string) => {
    setSelectedCaseRunId(caseRunId);
    setSelectorOpen(false);
  };

  useEffect(() => {
    if (detailScroll.current) detailScroll.current.scrollTop = 0;
  }, [selectedCaseRunId]);

  const cancel = async () => {
    try {
      setRun(await cancelM0Run(networkId, runId));
      await refresh();
    } catch {
      setError(workspaceUi("cannotCancelTheRunRefreshItsStatusAndTry"));
    }
  };

  const counts = run?.case_counts ?? caseCounts;
  const totalCases = counts?.total ?? run?.progress.planned_cases ?? page?.total ?? 0;

  return (
    <div className={styles.panel} data-testid="eval-multi-run-panel">
      {comparedResultRevision &&
        run?.result_revision &&
        comparedResultRevision !== run.result_revision && (
          <Alert
            type="warning"
            showIcon
            message={t("knowledgeNetwork.eval.agentCompare.revisionChanged", {
              compared: comparedResultRevision,
              current: run.result_revision,
            })}
          />
        )}
      {run?.assessment_scope === "declaration" && (
        <Alert
          type="info"
          showIcon
          message={workspaceUi("thisResultVerifiesDeclarationsOnlyItDoesNotEstablish")}
        />
      )}
      {run?.assessment_scope === "mixed" && (
        <Alert
          type="info"
          showIcon
          message={workspaceUi("thisRunContainsBothRealExecutionAndDeclarationPreflight")}
        />
      )}
      <section className={styles.section} aria-labelledby="run-summary-title">
        <div className={`${styles.sectionHeader} ${styles.summaryHeader}`}>
          <Typography.Title id="run-summary-title" level={5} className={styles.sectionTitle}>
            {workspaceUi("runSummary")}
          </Typography.Title>
          {run && (
            <dl className={styles.summaryMeta}>
              <div>
                <dt>{workspaceUi("knowledgeNetwork.eval.m0.status")}</dt>
                <dd>{statusLabel(run.execution_status)}</dd>
              </div>
              <div>
                <dt>{workspaceUi("knowledgeNetwork.eval.overviewSummary.results")}</dt>
                <dd>
                  <Tag color={outcomeColor(run.quality_outcome)}>
                    {assessedOutcomeLabel(run.quality_outcome, run.assessment_scope)}
                  </Tag>
                </dd>
              </div>
              <div>
                <dt>{workspaceUi("knowledgeNetwork.eval.m0.progress")}</dt>
                <dd>
                  {run.progress.completed_cases} / {run.progress.planned_cases}
                </dd>
              </div>
            </dl>
          )}
          {run && counts && (
            <ul className={styles.summaryCounts} aria-label={workspaceUi("caseStatistics")}>
              {counts.runtime && counts.runtime.total > 0 && (
                <li>
                  {workspaceUi("passedRealExecution")}{" "}
                  <strong>
                    {counts.runtime.passed} / {counts.runtime.total}
                  </strong>
                </li>
              )}
              {counts.declaration && counts.declaration.total > 0 && (
                <li>
                  {workspaceUi("knowledgeNetwork.eval.resultUi.declarationPassed")}{" "}
                  <strong>
                    {counts.declaration.passed} / {counts.declaration.total}
                  </strong>
                </li>
              )}
              {!counts.runtime && !counts.declaration && (
                <li>
                  {workspaceUi("knowledgeNetwork.eval.terms.passed")}{" "}
                  <strong>
                    {counts.passed} / {counts.total}
                  </strong>
                </li>
              )}
              <li>
                {evalOutcomeLabel("fail")} <strong>{counts.failed}</strong>
              </li>
              <li>
                {workspaceUi("knowledgeNetwork.eval.terms.inconclusive")}{" "}
                <strong>{counts.inconclusive}</strong>
              </li>
              {counts.review_required > 0 && (
                <li>
                  {workspaceUi("cannotJudgeAutomatically")}{" "}
                  <strong>{counts.review_required}</strong>
                </li>
              )}
              {counts.execution_failed > 0 && (
                <li>
                  {evalExecutionStatusLabel("failed")} <strong>{counts.execution_failed}</strong>
                </li>
              )}
              {counts.cancelled > 0 && (
                <li>
                  {workspaceUi("knowledgeNetwork.eval.terms.cancelled")}{" "}
                  <strong>{counts.cancelled}</strong>
                </li>
              )}
              {counts.pending > 0 && (
                <li>
                  {workspaceUi("incomplete")} <strong>{counts.pending}</strong>
                </li>
              )}
            </ul>
          )}
          <Space className={styles.sectionActions} wrap>
            <Button
              aria-label={workspaceUi("knowledgeNetwork.eval.m0.refresh")}
              title={workspaceUi("knowledgeNetwork.eval.m0.refresh")}
              icon={<ReloadOutlined aria-hidden />}
              onClick={() => {
                setPolls(0);
                setDetailRevision((value) => value + 1);
                void refresh();
              }}
              loading={loading}
            />
            {run && !finished(run) && (
              <Popconfirm
                title={workspaceUi("cancelThisRun")}
                okText={workspaceUi("knowledgeNetwork.eval.m0.cancelRun")}
                cancelText={workspaceUi("knowledgeNetwork.eval.runPage.backComparison")}
                onConfirm={() => void cancel()}
              >
                <Button danger>{workspaceUi("knowledgeNetwork.eval.m0.cancelRun")}</Button>
              </Popconfirm>
            )}
          </Space>
        </div>
        {(error || detailError) && <Alert type="error" showIcon message={error || detailError} />}
        {!run && loading && <Spin />}
        {polls >= 20 && run && !finished(run) && (
          <Alert
            type="info"
            showIcon
            message={workspaceUi("automaticRefreshIsPausedUseRefreshResultsToContinue")}
          />
        )}
      </section>
      <div
        className={`${styles.workspace} ${selectorOpen ? styles.selectorOpen : ""} ${selectorCollapsed ? styles.selectorCollapsed : ""}`}
      >
        <Button
          className={styles.desktopSelectorToggle}
          type="text"
          icon={selectorCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={t(
            `knowledgeNetwork.eval.resultUi.${selectorCollapsed ? "expandCases" : "collapseCases"}`,
          )}
          aria-expanded={!selectorCollapsed}
          aria-controls={selectorId}
          onClick={() => setSelectorCollapsed((value) => !value)}
        />
        <Button
          className={styles.caseSelectorToggle}
          aria-expanded={selectorOpen}
          aria-controls={selectorId}
          onClick={() => setSelectorOpen((value) => !value)}
        >
          {t("knowledgeNetwork.eval.resultUi.chooseCase")} ({totalCases})
        </Button>
        <section
          id={selectorId}
          className={styles.caseSelector}
          aria-label={t("knowledgeNetwork.eval.resultUi.caseList")}
          data-testid="case-selection-pane"
        >
          <div className={styles.caseSelectorHeader}>
            <div className={styles.caseResultFilter}>
              {initialAssessmentScope && <Tag>{assessmentLabel(initialAssessmentScope)}</Tag>}
              <Select
                aria-label={workspaceUi("filterCaseEvaluationResults")}
                value={outcome}
                onChange={(value) => {
                  listRequest.current += 1;
                  setOutcome(value);
                  onOutcomeChange?.(value);
                  setCursor(undefined);
                  setHistory([]);
                  setPage(undefined);
                  setSelectedCaseRunId(undefined);
                  setDetail(undefined);
                }}
                options={[
                  {
                    value: "all",
                    label: workspaceUi("knowledgeNetwork.eval.caseNavigation.allResults"),
                  },
                  ...(["pass", "fail", "inconclusive", "review_required"] as const).map(
                    (value) => ({
                      value,
                      label: outcomeLabel(value),
                    }),
                  ),
                ]}
              />
            </div>
          </div>
          <div className={styles.caseTools}>
            <Input.Search
              value={searchText}
              aria-label={t("knowledgeNetwork.eval.resultUi.caseSearch")}
              placeholder={t("knowledgeNetwork.eval.resultUi.caseSearchPlaceholder")}
              allowClear
              maxLength={200}
              onChange={(event) => setSearchText(event.target.value)}
              onSearch={(value) => {
                const next = value.trim();
                setSearchText(next);
                if (next === search) return;
                listRequest.current += 1;
                listController.current?.abort();
                setSearch(next);
                setCursor(undefined);
                setHistory([]);
                setPage(undefined);
                setSelectedCaseRunId(undefined);
                setDetail(undefined);
              }}
            />
          </div>
          <div
            className={styles.caseChoices}
            ref={caseScroll}
            data-testid="case-selection-list"
            aria-busy={loading}
          >
            {loading && <Spin size="small" />}
            <ul
              className={styles.caseChoiceList}
              aria-label={t("knowledgeNetwork.eval.resultUi.caseList")}
            >
              {(page?.entries ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={loading}
                    className={`${styles.caseChoice} ${selectedCaseRunId === item.id ? styles.caseChoiceSelected : ""}`}
                    aria-label={item.case_title || evalReferenceLabel("unnamedCase")}
                    aria-pressed={selectedCaseRunId === item.id}
                    onClick={() => selectCase(item.id)}
                  >
                    <span
                      className={styles.caseChoiceTitle}
                      title={item.case_title || evalReferenceLabel("unnamedCase")}
                    >
                      {item.case_title || evalReferenceLabel("unnamedCase")}
                    </span>
                    <span className={styles.caseChoiceMeta}>
                      <Tag color={outcomeColor(item.quality_outcome)}>
                        {assessedOutcomeLabel(item.quality_outcome, item.assessment_scope)}
                      </Tag>
                      <span>{statusLabel(item.execution_status)}</span>
                      <span title={t("knowledgeNetwork.eval.resultUi.durationHint")}>
                        {item.duration_ms == null ? "—" : `${item.duration_ms} ms`}
                      </span>
                    </span>
                    {item.assessment_scope === "declaration" && (
                      <span className={styles.caseChoiceScope}>
                        {assessmentLabel(item.assessment_scope)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!loading && !page?.entries.length && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  search
                    ? t("knowledgeNetwork.eval.resultUi.noMatchingCases")
                    : workspaceUi("noCaseResultsYet")
                }
              />
            )}
          </div>
          {((page?.total ?? 0) > 20 || history.length > 0 || Boolean(page?.next_cursor)) && (
            <div className={styles.caseChoicePagination}>
              <TablePaginationBar
                simple={{ readOnly: true }}
                disabled={loading}
                current={history.length + 1}
                pageSize={20}
                total={page?.total ?? 0}
                showSizeChanger={false}
                showTotal={(total) => workspaceUi("casesInTotal", { value0: total })}
                onChange={(target) => {
                  if (target === history.length && history.length) {
                    const previous = [...history];
                    setCursor(previous.pop());
                    setHistory(previous);
                    setDetail(undefined);
                  } else if (target === history.length + 2 && page?.next_cursor) {
                    setHistory((current) => [...current, cursor]);
                    setCursor(page.next_cursor);
                    setDetail(undefined);
                  }
                }}
              />
            </div>
          )}
        </section>
        <div
          className={styles.detailPane}
          ref={detailScroll}
          data-testid="case-detail-pane"
          aria-busy={detailLoading}
        >
          {!detail && !detailLoading && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("knowledgeNetwork.eval.resultUi.selectCaseHint")}
            />
          )}
          {detailLoading && <Spin size="small" aria-label={workspaceUi("loadingCaseDetails")} />}
          {detail && (
            <section className={styles.section} aria-labelledby="case-detail-title">
              <Typography.Title
                id="case-detail-title"
                level={5}
                className={styles.detailTitle}
                title={detail.case_title || evalReferenceLabel("unnamedCase")}
              >
                {workspaceUi("caseDetails")}{" "}
                {detail.case_title || evalReferenceLabel("unnamedCase")}
              </Typography.Title>
              <EvalCaseResult
                networkId={networkId}
                runId={runId}
                resultRevision={comparedResultRevision}
                detail={detail}
                run={run}
                onRepair={onRepair && run ? () => onRepair(run, detail) : undefined}
                onEvidence={() => setTechnicalOpen(true)}
                initialTab={technicalOpen ? "execution" : "result"}
                onExecutionActive={(active) => {
                  setTechnicalOpen(active);
                  if (detailScroll.current) detailScroll.current.scrollTop = 0;
                }}
                actions={
                  (onViewCase || onRerun || run?.runner_type === "external_agent") && (
                    <Space wrap>
                      {onViewCase && (
                        <Button onClick={() => onViewCase(detail)}>
                          {t("knowledgeNetwork.eval.resultUi.viewCurrentCase")}
                        </Button>
                      )}
                      {run?.runner_type === "external_agent" ? (
                        <Button onClick={() => setExternalReplayOpen((value) => !value)}>
                          {t("knowledgeNetwork.eval.resultUi.externalReplay")}
                        </Button>
                      ) : (
                        onRerun && (
                          <Button disabled={!run || !finished(run)} onClick={() => onRerun(detail)}>
                            {workspaceUi("rerun")}
                          </Button>
                        )
                      )}
                    </Space>
                  )
                }
                notice={
                  externalReplayOpen &&
                  run?.runner_type === "external_agent" && (
                    <section
                      className={styles.externalReplay}
                      aria-label={t("knowledgeNetwork.eval.resultUi.externalReplay")}
                    >
                      <Alert
                        type="info"
                        showIcon
                        message={t("knowledgeNetwork.eval.resultUi.externalReplayHelp")}
                      />
                      {run.scope?.suite_id && run.scope.version ? (
                        <Typography.Paragraph copyable className={styles.replayInstruction}>
                          {t("knowledgeNetwork.eval.externalUi.instruction", {
                            knId: networkId,
                            suiteId: run.scope.suite_id,
                            version: run.scope.version,
                          })}
                        </Typography.Paragraph>
                      ) : (
                        <Typography.Paragraph>
                          {t("knowledgeNetwork.eval.resultUi.externalReplayMissing")}
                        </Typography.Paragraph>
                      )}
                    </section>
                  )
                }
                technicalDetails={
                  <EvalTraceEvidence
                    key={`${detail.id}:${detail.result_revision ?? ""}`}
                    detail={detail}
                    active={technicalOpen}
                  />
                }
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
