/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Empty, Select, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { KnowledgeResourceIcon } from "../components/shared/KnowledgeResourceIcon";
import { EvalCaseResult } from "./EvalCaseResult";
import { EvalResourceEvidence } from "./EvalResourceEvidence";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { useEvalFeedback } from "./useEvalFeedback";
import { useEvalTranslation } from "./useEvalTranslation";
import {
  createM1Run,
  getM0Run,
  getM1RunCapabilities,
  getRunCaseDetail,
  previewM1RunSelection,
  type M0CaseDetail,
  type M0Run,
} from "./m0-run.service";
import {
  resourceCaseNeedsReview,
  resourceCaseSummary,
  type OverviewResourceCase,
  type ResourceResultRow,
} from "./eval-overview-resources";
import styles from "./EvalOverviewResourcesPanel.module.css";

type Props = {
  networkId: string;
  resource: ResourceResultRow;
  canRun: boolean;
  onClose: () => void;
  onResource: () => void;
  onCases: () => void;
  onRepair: (cases: OverviewResourceCase[]) => void;
  onInspect: (run: M0Run, caseRunId: string) => void;
  onRunCreated: (run: M0Run) => void;
};

export function EvalResourceResultsDrawer({
  networkId,
  resource,
  canRun,
  onClose,
  onResource,
  onCases,
  onRepair,
  onInspect,
  onRunCreated,
}: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string, values?: Record<string, unknown>) =>
    t(`knowledgeNetwork.eval.resourceOverview.${key}`, values);
  const { modal, message } = useEvalFeedback();
  const alive = useRef(true);
  const confirmation = useRef<ReturnType<typeof modal.confirm> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      confirmation.current?.destroy();
    };
  }, []);
  const [filter, setFilter] = useState(
    resource.failures.length ? "problem" : resource.reviews.length ? "review" : "all",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    resource.failures
      .filter((c) => c.runnable)
      .slice(0, 50)
      .map((c) => c.id),
  );
  const [selected, setSelected] = useState<OverviewResourceCase>();
  const [result, setResult] = useState<{ detail: M0CaseDetail; run: M0Run }>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [running, setRunning] = useState(false);
  const [initialTab, setInitialTab] = useState<"result" | "execution">("result");
  const repairCases = resource.failures.filter(
    (entry) => selectedIds.includes(entry.id) && entry.enabled && !entry.excluded,
  );
  useEffect(() => {
    if (!selected?.latest_run_id || !selected.latest_case_run_id) return;
    const controller = new AbortController();
    setResult(undefined);
    setLoading(true);
    setFailed(false);
    void Promise.all([
      getRunCaseDetail(
        networkId,
        selected.latest_run_id,
        selected.latest_case_run_id,
        selected.latest_result_revision,
        controller.signal,
      ),
      getM0Run(networkId, selected.latest_run_id, controller.signal),
    ])
      .then(([detail, run]) => {
        if (controller.signal.aborted) return;
        if (
          detail.case_id !== selected.id ||
          detail.id !== selected.latest_case_run_id ||
          (selected.latest_result_revision &&
            detail.result_revision !== selected.latest_result_revision)
        )
          throw new Error("Mismatched resource result");
        setResult({ detail, run });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [networkId, selected, retry]);
  const rerun = async () => {
    const ids = [...new Set(selectedIds)].filter((id) =>
      resource.cases.some((c) => c.id === id && c.runnable),
    );
    if (!ids.length || ids.length > 50 || running) return;
    setRunning(true);
    try {
      if (!(await getM1RunCapabilities(networkId))) throw new Error("Unavailable execution");
      const scope = { kind: "cases" as const, case_ids: ids };
      const preview = await previewM1RunSelection(networkId, scope);
      if (preview.case_count !== ids.length) throw new Error("Changed selection");
      if (!alive.current) return;
      confirmation.current = modal.confirm({
        title: text("rerunTitle", { name: resource.name }),
        content: text("rerunHelp", { count: ids.length }),
        okText: text("rerun"),
        cancelText: text("cancel"),
        onOk: async () => {
          if (!alive.current) return;
          try {
            const run = await createM1Run(networkId, scope, crypto.randomUUID());
            if (alive.current) onRunCreated(run);
          } catch (cause) {
            message.error(text("rerunFailed"));
            throw cause;
          }
        },
      });
    } catch {
      if (alive.current) message.error(text("rerunFailed"));
    } finally {
      if (alive.current) setRunning(false);
    }
  };
  const cases = resource.cases.filter(
    (c) =>
      filter === "all" ||
      (filter === "problem" ? c.status === "failed" : resourceCaseNeedsReview(c)),
  );
  const status = (entry: OverviewResourceCase) => {
    const key =
      entry.status === "failed"
        ? "problem"
        : resourceCaseNeedsReview(entry)
          ? "review"
          : entry.status === "passed"
            ? "passed"
            : "pending";
    return (
      <Tag
        color={
          key === "problem"
            ? "error"
            : key === "review"
              ? "warning"
              : key === "passed"
                ? "success"
                : undefined
        }
      >
        {text(key)}
      </Tag>
    );
  };
  return (
    <Drawer
      open
      width="min(1100px, 96vw)"
      title={text(resource.kind === "scenario" ? "scenarioDrawerTitle" : "drawerTitle", {
        name: resource.name,
      })}
      onClose={onClose}
      extra={
        selected ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined aria-hidden />}
            onClick={() => {
              setSelected(undefined);
              setResult(undefined);
            }}
          >
            {text("backProblems")}
          </Button>
        ) : undefined
      }
      className={styles.drawer}
      footer={
        <div className={styles.drawerFooter}>
          {canRun && resource.failures.length > 0 && (
            <Button disabled={!repairCases.length || running} onClick={() => onRepair(repairCases)}>
              {text("aiRepair")}
            </Button>
          )}
          <Button onClick={resource.kind === "scenario" ? onCases : onResource}>
            {text(resource.kind === "scenario" ? "viewCases" : "goResource")}
          </Button>
          {canRun && (
            <Button
              type="primary"
              loading={running}
              disabled={!selectedIds.length}
              onClick={() => void rerun()}
            >
              {text("rerunSelected", { count: selectedIds.length })}
            </Button>
          )}
        </div>
      }
    >
      {selected ? (
        <>
          <Typography.Title level={5}>{resourceCaseSummary(selected)}</Typography.Title>
          {loading && <Spin aria-label={text("loadingResult")} />}
          {failed && (
            <Alert
              type="error"
              showIcon
              message={text("detailFailed")}
              action={<Button onClick={() => setRetry((n) => n + 1)}>{text("retry")}</Button>}
            />
          )}
          {result && (
            <EvalCaseResult
              key={`${result.detail.id}:${initialTab}`}
              networkId={networkId}
              runId={result.run.id}
              detail={result.detail}
              run={result.run}
              onRepair={() => onRepair([selected])}
              resultRevision={selected.latest_result_revision}
              initialTab={initialTab}
              onEvidence={() => setInitialTab("execution")}
              technicalDetails={<EvalResourceEvidence detail={result.detail} />}
              actions={
                <Button onClick={() => onInspect(result.run, result.detail.id)}>
                  {text("openRun")}
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <div className={styles.resourceHeading}>
            <KnowledgeResourceIcon kind={resource.kind} />
            <Typography.Text strong title={resource.name}>
              {resource.name}
            </Typography.Text>
          </div>
          <Alert
            className={styles.notice}
            type={resource.group === "problem" ? "warning" : "info"}
            showIcon
            message={text("resourceSummary", {
              failed: resource.problem_cases,
              review: resource.review_cases ?? resource.reviews.length,
              total: resource.case_count,
            })}
            description={text(
              resource.kind === "scenario" ? "scenarioResultsHelp" : "currentResultsHelp",
            )}
          />
          <div className={styles.drawerToolbar}>
            <Typography.Text strong>{text("caseResults")}</Typography.Text>
            <Select
              aria-label={text("caseFilter")}
              value={filter}
              onChange={setFilter}
              options={["problem", "review", "all"].map((value) => ({ value, label: text(value) }))}
            />
          </div>
          <Table<OverviewResourceCase>
            rowKey="id"
            dataSource={cases}
            scroll={{ x: 780 }}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text("noCases")}>
                  <Button onClick={onCases}>{text("viewCases")}</Button>
                </Empty>
              ),
            }}
            rowSelection={
              canRun
                ? {
                    selectedRowKeys: selectedIds,
                    preserveSelectedRowKeys: true,
                    onChange: (ids) => setSelectedIds([...new Set(ids.map(String))].slice(0, 50)),
                    getCheckboxProps: (entry) => ({
                      disabled:
                        !entry.runnable ||
                        (!selectedIds.includes(entry.id) && selectedIds.length >= 50),
                    }),
                  }
                : undefined
            }
            columns={[
              {
                title: text("ruleAndTarget"),
                ellipsis: true,
                render: (_, c) => (
                  <span title={c.title}>
                    {resource.kind === "scenario" ? c.title : resourceCaseSummary(c)}
                  </span>
                ),
              },
              { title: text("status"), width: 130, render: (_, c) => status(c) },
              {
                title: text("time"),
                width: 165,
                render: (_, c) =>
                  c.latest_result_at ? new Date(c.latest_result_at).toLocaleString() : "—",
              },
              {
                title: text("actions"),
                width: 150,
                render: (_, c) => (
                  <Button
                    type="link"
                    disabled={!c.latest_case_run_id || !c.latest_run_id}
                    onClick={() => {
                      setInitialTab("result");
                      setSelected(c);
                    }}
                  >
                    {text("viewResult")}
                  </Button>
                ),
              },
            ]}
          />
          <Typography.Paragraph type="secondary" className={styles.note}>
            {text("selectionHelp")}
          </Typography.Paragraph>
        </>
      )}
    </Drawer>
  );
}
