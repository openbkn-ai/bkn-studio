/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";
import { evalOutcomeLabel } from "./eval-terminology";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { EvalMultiRunPanel } from "./EvalMultiRunPanel";
import styles from "./EvalRunComparisonDrawer.module.css";

import {
  compareEvalRuns,
  getEvalRunResultRevisionPage,
  getM0Run,
  searchM0Runs,
  type EvalRunComparison,
  type EvalRunResultRevision,
  type M0Run,
} from "./m0-run.service";

type Props = {
  networkId: string;
  open: boolean;
  candidate: M0Run | undefined;
  runs: M0Run[];
  preferredBaselineId?: string;
  onClose: () => void;
  onInspect?: (run: M0Run, caseRunId: string, tab: "result" | "evidence") => void;
};

type PanelProps = Omit<Props, "open" | "onClose"> & {
  active?: boolean;
};

const labels: Record<EvalRunComparison["changes"][number]["kind"], string> = {
  get improved() {
    return workspaceUi("improved");
  },
  get regressed() {
    return workspaceUi("regressed");
  },
  get unchanged() {
    return workspaceUi("unchanged");
  },
  get changed() {
    return workspaceUi("resultChanged");
  },
  get case_version_changed() {
    return workspaceUi("caseDefinitionChanged");
  },
  get added() {
    return workspaceUi("addCases");
  },
  get removed() {
    return workspaceUi("removedCases");
  },
};

const sameRunScope = (left: M0Run, right?: M0Run) => {
  // Older persisted Runs did not expose their scope in the list projection.
  // Keep those selectable; only reject a baseline when both scopes are known
  // and demonstrably different.
  if (!right?.scope || !left.scope) return true;
  if (left.scope.kind !== right.scope.kind) return false;
  if (left.scope.kind === "suite") return left.scope.suite_id === right.scope.suite_id;
  if (left.scope.kind !== "cases") return false;
  const refs = (run: M0Run) =>
    (run.scope && "case_ids" in run.scope ? run.scope.case_ids : [])?.slice().sort().join("|") ??
    "";
  const leftRefs = refs(left);
  const rightRefs = refs(right);
  return !leftRefs || !rightRefs || leftRefs === rightRefs;
};

const outcome = evalOutcomeLabel;

export function EvalRunComparisonPanel({
  networkId,
  active = true,
  candidate,
  runs,
  preferredBaselineId,
  onInspect,
}: PanelProps) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.comparisonUi.${key}`);
  const [inspection, setInspection] = useState<{ run: M0Run; caseRunId: string }>();
  useEffect(() => {
    setInspection(undefined);
  }, [networkId, candidate?.id, active]);
  const [preferredBaseline, setPreferredBaseline] = useState<M0Run>();
  const [historyRuns, setHistoryRuns] = useState<M0Run[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const suiteId = candidate?.scope?.kind === "suite" ? candidate.scope.suite_id : undefined;
  useEffect(() => {
    setHistoryRuns([]);
    setHistoryPage(1);
    setHistoryTotal(0);
    setHistoryError("");
  }, [networkId, candidate?.id]);
  useEffect(() => {
    if (!active || !suiteId) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    void searchM0Runs(
      networkId,
      { suite_id: suiteId, status: "completed", comparable: true, page: historyPage, limit: 20 },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setHistoryRuns((current) =>
          historyPage === 1
            ? result.entries
            : [...new Map([...current, ...result.entries].map((run) => [run.id, run])).values()],
        );
        setHistoryTotal(result.total);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistoryError(workspaceUi("cannotLoadHistoricalRunsTryAgain"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [active, networkId, candidate?.id, suiteId, historyPage, historyRefresh]);
  const baselines = useMemo(
    () =>
      [
        ...new Map(
          [
            ...runs,
            ...historyRuns,
            ...(preferredBaseline && !runs.some((run) => run.id === preferredBaseline.id)
              ? [preferredBaseline]
              : []),
          ].map((run) => [run.id, run]),
        ).values(),
      ].filter(
        (run) =>
          run.id !== candidate?.id &&
          run.execution_status === "completed" &&
          run.result_revision &&
          sameRunScope(run, candidate),
      ),
    [runs, historyRuns, candidate, preferredBaseline],
  );
  const [baselineId, setBaselineId] = useState<string>();
  const baseline = baselines.find((run) => run.id === baselineId);
  const [comparison, setComparison] = useState<EvalRunComparison>();
  const [loading, setLoading] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [baselineRevisions, setBaselineRevisions] = useState<EvalRunResultRevision[]>([]);
  const [candidateRevisions, setCandidateRevisions] = useState<EvalRunResultRevision[]>([]);
  const [baselineNextBefore, setBaselineNextBefore] = useState<number>();
  const [candidateNextBefore, setCandidateNextBefore] = useState<number>();
  const [baselineRevision, setBaselineRevision] = useState<number>();
  const [candidateRevision, setCandidateRevision] = useState<number>();
  const [revisionRunIds, setRevisionRunIds] = useState<{ baseline: string; candidate: string }>();
  const revisionGeneration = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreferredBaseline(undefined);
    setError("");
    if (!active || !preferredBaselineId || runs.some((run) => run.id === preferredBaselineId))
      return;
    let mounted = true;
    void getM0Run(networkId, preferredBaselineId)
      .then((run) => {
        if (!mounted) return;
        if (sameRunScope(run, candidate)) setPreferredBaseline(run);
        else setError(workspaceUi("theOriginalAndCurrentRunsHaveDifferentTestScopes"));
      })
      .catch(() => {
        if (mounted) setError(workspaceUi("theOriginalFailedRunIsNoLongerAvailableSelect"));
      });
    return () => {
      mounted = false;
    };
  }, [active, networkId, preferredBaselineId, runs, candidate]);

  useEffect(() => {
    if (!active) return;
    setBaselineId(
      (current) =>
        baselines.find((run) => run.id === preferredBaselineId)?.id ??
        (baselines.some((run) => run.id === current) ? current : baselines[0]?.id),
    );
  }, [active, candidate?.id, baselines, preferredBaselineId]);

  useEffect(() => {
    if (!active || !candidate || !baselineId) return;
    if (!baseline) return;
    let mounted = true;
    const generation = ++revisionGeneration.current;
    setRevisionsLoading(true);
    setError("");
    setComparison(undefined);
    setRevisionRunIds(undefined);
    setBaselineRevision(undefined);
    setCandidateRevision(undefined);
    setBaselineNextBefore(undefined);
    setCandidateNextBefore(undefined);
    void Promise.all([
      getEvalRunResultRevisionPage(networkId, baseline.id),
      getEvalRunResultRevisionPage(networkId, candidate.id),
    ])
      .then(([before, after]) => {
        if (!mounted || revisionGeneration.current !== generation) return;
        if (!before.entries.length || !after.entries.length)
          throw new Error("missing result revision");
        setBaselineRevisions(before.entries);
        setCandidateRevisions(after.entries);
        setBaselineNextBefore(before.next_before);
        setCandidateNextBefore(after.next_before);
        setBaselineRevision(baseline.result_revision ?? before.entries[0].revision);
        setCandidateRevision(candidate.result_revision ?? after.entries[0].revision);
        setRevisionRunIds({ baseline: baseline.id, candidate: candidate.id });
      })
      .catch(() => {
        if (mounted && revisionGeneration.current === generation)
          setError(workspaceUi("cannotLoadResultRevisionsRefreshRunRecordsAndTry"));
      })
      .finally(() => {
        if (mounted && revisionGeneration.current === generation) setRevisionsLoading(false);
      });
    return () => {
      mounted = false;
      revisionGeneration.current = generation + 1;
    };
  }, [active, networkId, candidate, baselineId, baseline]);

  const loadOlderRevisions = async (side: "baseline" | "candidate") => {
    const runId = side === "baseline" ? baselineId : candidate?.id;
    const before = side === "baseline" ? baselineNextBefore : candidateNextBefore;
    if (!runId || !before || revisionsLoading) return;
    const generation = revisionGeneration.current;
    setRevisionsLoading(true);
    setError("");
    try {
      const page = await getEvalRunResultRevisionPage(networkId, runId, before);
      if (revisionGeneration.current !== generation) return;
      if (side === "baseline") {
        setBaselineRevisions((current) => [...current, ...page.entries]);
        setBaselineNextBefore(page.next_before);
      } else {
        setCandidateRevisions((current) => [...current, ...page.entries]);
        setCandidateNextBefore(page.next_before);
      }
    } catch {
      if (revisionGeneration.current === generation)
        setError(workspaceUi("cannotLoadEarlierResultRevisionsTryAgain"));
    } finally {
      if (revisionGeneration.current === generation) setRevisionsLoading(false);
    }
  };

  useEffect(() => {
    if (
      !active ||
      !candidate ||
      !baselineId ||
      !baselineRevision ||
      !candidateRevision ||
      revisionRunIds?.baseline !== baselineId ||
      revisionRunIds.candidate !== candidate.id
    )
      return;
    if (!baseline) return;
    let mounted = true;
    setLoading(true);
    setError("");
    setComparison(undefined);
    void compareEvalRuns(networkId, baseline, candidate, baselineRevision, candidateRevision)
      .then((result) => {
        if (mounted) setComparison(result);
      })
      .catch(() => {
        if (mounted) setError(workspaceUi("cannotCompareTheseRunsEnsureBothAreCompleteAnd"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [
    active,
    networkId,
    candidate,
    baselineId,
    baseline,
    baselineRevision,
    candidateRevision,
    revisionRunIds,
  ]);

  const caseName = (change: EvalRunComparison["changes"][number]) =>
    change.case_title ||
    change.candidate_case_title ||
    change.baseline_case_title ||
    text("untitled");
  const inspect = (
    change: EvalRunComparison["changes"][number],
    side: "baseline" | "candidate",
  ) => {
    if (!comparison) return;
    const member = change[side];
    const runId = side === "baseline" ? comparison.baseline_run_id : comparison.candidate_run_id;
    const source =
      side === "baseline"
        ? baselines.find((run) => run.id === runId)
        : candidate?.id === runId
          ? candidate
          : undefined;
    if (!member || !source) return;
    const revision =
      side === "baseline"
        ? comparison.baseline_result_revision
        : comparison.candidate_result_revision;
    const boundRun = { ...source, result_revision: revision };
    if (onInspect) onInspect(boundRun, member.case_run_id, "result");
    else setInspection({ run: boundRun, caseRunId: member.case_run_id });
  };
  const resultCell = (
    change: EvalRunComparison["changes"][number],
    side: "baseline" | "candidate",
  ) => {
    const member = change[side];
    return member ? (
      <Button
        type="link"
        autoInsertSpace={false}
        className={styles.resultLink}
        aria-label={`${text(side === "baseline" ? "viewBaseline" : "viewCandidate")} · ${caseName(change)}`}
        title={text(side === "baseline" ? "viewBaseline" : "viewCandidate")}
        onClick={() => inspect(change, side)}
      >
        {member.quality_outcome ? outcome(member.quality_outcome) : text("noOutcome")}
      </Button>
    ) : (
      <Typography.Text type="secondary">{text("absent")}</Typography.Text>
    );
  };
  if (inspection)
    return (
      <div className={styles.inspection}>
        <Button onClick={() => setInspection(undefined)}>{text("back")}</Button>
        <EvalMultiRunPanel
          networkId={networkId}
          runId={inspection.run.id}
          preferredCaseRunId={inspection.caseRunId}
          comparedResultRevision={inspection.run.result_revision ?? undefined}
        />
      </div>
    );

  return (
    <div className={styles.panel} data-testid="eval-run-comparison-panel">
      {!candidate || candidate.execution_status !== "completed" || !candidate.result_revision ? (
        <Empty description={workspaceUi("thisRunHasNoComparableResultsYet")} />
      ) : !baselines.length && historyLoading ? (
        <Spin />
      ) : !baselines.length && historyError ? (
        <Alert
          type="error"
          showIcon
          message={historyError}
          action={
            <Button onClick={() => setHistoryRefresh((value) => value + 1)}>
              {workspaceUi("retryLoading")}
            </Button>
          }
        />
      ) : !baselines.length && error ? (
        <Alert type="error" showIcon message={error} />
      ) : !baselines.length && preferredBaselineId && !error ? (
        <Spin />
      ) : !baselines.length ? (
        <Empty description={workspaceUi("noCompletedRunInTheSameTestScopeIs")}>
          {historyRuns.length < historyTotal && (
            <Button onClick={() => setHistoryPage((value) => value + 1)}>
              {workspaceUi("loadMoreHistoricalRuns")}
            </Button>
          )}
        </Empty>
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space wrap>
            <Typography.Text>{workspaceUi("baselineRun")}</Typography.Text>
            <Select
              aria-label={workspaceUi("selectABaselineRun")}
              value={baselineId}
              onChange={setBaselineId}
              style={{ width: 330 }}
              loading={historyLoading}
              options={baselines.map((run, index) => ({
                value: run.id,
                label: workspaceUi("versionLabel", {
                  value0:
                    run.external_agent?.name || workspaceUi("runNumber", { number: index + 1 }),
                  value1:
                    run.scope?.kind === "suite"
                      ? workspaceUi("suiteVersionPrefix", { version: run.scope.version })
                      : "",
                  value2: run.created_at
                    ? new Date(run.created_at).toLocaleString()
                    : workspaceUi("timeNotRecorded"),
                }),
              }))}
            />
          </Space>
          {historyError && <Alert type="error" showIcon message={historyError} />}
          {(historyRuns.length < historyTotal || historyError) && (
            <Button
              loading={historyLoading}
              onClick={() =>
                historyError
                  ? setHistoryRefresh((value) => value + 1)
                  : setHistoryPage((value) => value + 1)
              }
            >
              {workspaceUi("loadMoreHistoricalRuns")}
            </Button>
          )}
          <Typography.Text type="secondary">
            {suiteId
              ? workspaceUi("historicalRunsOfTheSameTestSuiteCanBe", {
                  value0: candidate.scope?.kind === "suite" ? candidate.scope.version : "—",
                  value1: baseline?.scope?.kind === "suite" ? baseline.scope.version : "—",
                })
              : workspaceUi("compareHistoricalRunsOfTheSameCases")}
          </Typography.Text>
          <Space wrap>
            <Typography.Text>{workspaceUi("baselineResultRevision")}</Typography.Text>
            <Select
              aria-label={workspaceUi("selectTheBaselineResultRevision")}
              value={baselineRevision}
              onChange={setBaselineRevision}
              loading={revisionsLoading}
              style={{ width: 120 }}
              options={baselineRevisions.map((item) => ({
                value: item.revision,
                label: workspaceUi("v", {
                  value0: item.revision,
                  value1: item.current ? workspaceUi("currentRevisionSuffix") : "",
                }),
              }))}
            />
            <Typography.Text>{workspaceUi("currentRunResultRevision")}</Typography.Text>
            <Select
              aria-label={workspaceUi("selectTheCurrentRunResultRevision")}
              value={candidateRevision}
              onChange={setCandidateRevision}
              loading={revisionsLoading}
              style={{ width: 120 }}
              options={candidateRevisions.map((item) => ({
                value: item.revision,
                label: workspaceUi("v", {
                  value0: item.revision,
                  value1: item.current ? workspaceUi("currentRevisionSuffix") : "",
                }),
              }))}
            />
          </Space>
          {(baselineNextBefore || candidateNextBefore) && (
            <Space wrap>
              {baselineNextBefore && (
                <Button
                  disabled={revisionsLoading}
                  onClick={() => void loadOlderRevisions("baseline")}
                >
                  {workspaceUi("loadEarlierBaselineRevisions")}
                </Button>
              )}
              {candidateNextBefore && (
                <Button
                  disabled={revisionsLoading}
                  onClick={() => void loadOlderRevisions("candidate")}
                >
                  {workspaceUi("loadEarlierCurrentRevisions")}
                </Button>
              )}
            </Space>
          )}
          <Typography.Text type="secondary">
            {workspaceUi("comparingTheCurrentlySelectedRunsDifferencesDoNotAutomatically")}
          </Typography.Text>
          {(loading || revisionsLoading) && <Spin />}
          {error && <Alert type="error" showIcon message={error} />}
          {comparison && (
            <>
              {!comparison.target_snapshot_compatible && (
                <Alert
                  type="warning"
                  showIcon
                  message={workspaceUi("theRunsUseDifferentTargetSnapshotsAResultChange")}
                />
              )}
              {!comparison.data_baseline_verified && (
                <Alert
                  type="warning"
                  showIcon
                  message={workspaceUi("theCurrentDataBaselineHasNoVerifiableImmutableRevision")}
                />
              )}
              <Descriptions className={styles.summary} bordered size="small" column={2}>
                <Descriptions.Item label={workspaceUi("baselineResultRevision")}>
                  v{comparison.baseline_result_revision}
                </Descriptions.Item>
                <Descriptions.Item label={workspaceUi("currentResultRevision")}>
                  v{comparison.candidate_result_revision}
                </Descriptions.Item>
                <Descriptions.Item label={workspaceUi("improved")}>
                  {comparison.changes.filter((item) => item.kind === "improved").length}
                </Descriptions.Item>
                <Descriptions.Item label={workspaceUi("regressed")}>
                  {comparison.changes.filter((item) => item.kind === "regressed").length}
                </Descriptions.Item>
              </Descriptions>
              <Table
                rowKey="case_id"
                scroll={{ x: 680 }}
                size="small"
                dataSource={comparison.changes}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                columns={[
                  {
                    title: text("caseName"),
                    width: "46%",
                    render: (_, item) => {
                      const hint = (
                        <div>
                          <div>{caseName(item)}</div>
                          {item.baseline_case_title &&
                            item.candidate_case_title &&
                            item.baseline_case_title !== item.candidate_case_title && (
                              <>
                                <div>
                                  {text("baselineName")}：{item.baseline_case_title}
                                </div>
                                <div>
                                  {text("candidateName")}：{item.candidate_case_title}
                                </div>
                              </>
                            )}
                        </div>
                      );
                      return (
                        <Tooltip title={hint}>
                          <Button
                            type="link"
                            className={styles.caseName}
                            onClick={() => inspect(item, item.candidate ? "candidate" : "baseline")}
                          >
                            {caseName(item)}
                          </Button>
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: text("baselineOutcome"),
                    width: "18%",
                    render: (_, item) => resultCell(item, "baseline"),
                  },
                  {
                    title: text("candidateOutcome"),
                    width: "18%",
                    render: (_, item) => resultCell(item, "candidate"),
                  },
                  {
                    title: workspaceUi("change"),
                    width: "18%",
                    render: (_, item) => (
                      <Tag
                        color={
                          item.kind === "improved"
                            ? "success"
                            : item.kind === "regressed"
                              ? "error"
                              : undefined
                        }
                      >
                        {labels[item.kind]}
                      </Tag>
                    ),
                  },
                ]}
              />
            </>
          )}
        </Space>
      )}
    </div>
  );
}

export function EvalRunComparisonDrawer({
  networkId,
  open,
  candidate,
  runs,
  preferredBaselineId,
  onClose,
  onInspect,
}: Props) {
  return (
    <Drawer
      title={workspaceUi("knowledgeNetwork.eval.runPage.comparison")}
      open={open}
      onClose={onClose}
      width="min(840px, 96vw)"
      destroyOnHidden
    >
      <EvalRunComparisonPanel
        networkId={networkId}
        active={open}
        candidate={candidate}
        runs={runs}
        preferredBaselineId={preferredBaselineId}
        onInspect={onInspect}
      />
    </Drawer>
  );
}
