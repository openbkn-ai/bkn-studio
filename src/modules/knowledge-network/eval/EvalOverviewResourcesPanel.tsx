/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EllipsisOutlined, QuestionCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Dropdown, Empty, Input, Select, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { KnowledgeResourceIcon } from "../components/shared/KnowledgeResourceIcon";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { EvalResourceResultsDrawer } from "./EvalResourceResultsDrawer";
import {
  buildResourceResultRows,
  filterResourceResults,
  resourceCaseSummary,
  type OverviewResource,
  type ResourceResultFilter,
  type ResourceResultRow,
} from "./eval-overview-resources";
import type { EvalOverview, M0Run } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalOverviewResourcesPanel.module.css";

type Props = {
  networkId: string;
  overview: EvalOverview;
  canRun: boolean;
  problemFocus?: number;
  onRefresh: () => void;
  onResource: (resource: OverviewResource) => void;
  onCases: (resource: OverviewResource) => void;
  onCreateCase: (resource: OverviewResource) => void;
  onRepair: (resource: ResourceResultRow) => void;
  onInspect: (run: M0Run, caseRunId: string) => void;
  onRunCreated: (run: M0Run) => void;
};

type ResourceAttentionFilter = Exclude<ResourceResultFilter, "passed" | "all">;

export function EvalOverviewResourcesPanel({
  networkId,
  overview,
  canRun,
  problemFocus,
  onRefresh,
  onResource,
  onCases,
  onCreateCase,
  onRepair,
  onInspect,
  onRunCreated,
}: Props) {
  const { t, i18n } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.resourceOverview.${key}`);
  const [filter, setFilter] = useState<ResourceAttentionFilter>("problem");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  useEffect(() => {
    setFilter("problem");
    setKind("all");
    setQuery("");
    setPage(1);
  }, [problemFocus]);
  const rows = useMemo(
    () =>
      buildResourceResultRows(overview).filter(
        (row) => row.group !== "passed" && row.group !== "excluded",
      ),
    [overview],
  );
  const visible = useMemo(
    () => filterResourceResults(rows, filter, kind, query),
    [rows, filter, kind, query],
  );
  const resource = rows.find((row) => `${row.kind}:${row.id}` === selected);
  const kindLabel = (value: string) =>
    t(`knowledgeNetwork.eval.resourceOverview.kinds.${value}`, { defaultValue: value });
  const open = (row: ResourceResultRow) => setSelected(`${row.kind}:${row.id}`);
  const hasResults = (row: ResourceResultRow) =>
    row.evaluated_cases > 0 ||
    row.cases.some((entry) => entry.latest_case_run_id && entry.latest_run_id);
  const inspect = (row: ResourceResultRow) => {
    if (hasResults(row)) open(row);
    else if (row.case_count > 0) onCases(row);
    else onResource(row);
  };
  return (
    <section id="eval-resource-results" className={styles.panel} aria-label={text("title")}>
      <div className={styles.heading}>
        <Typography.Text strong>{text("title")}</Typography.Text>
        <Tooltip title={text("statusHelp")}>
          <QuestionCircleOutlined aria-label={text("statusHelp")} />
        </Tooltip>
      </div>
      <div className={styles.filterBar}>
        <div className={styles.filters} role="group" aria-label={text("resultFilter")}>
          {(["problem", "review", "pending"] as const).map((value) => (
            <Button
              key={value}
              aria-pressed={value === filter}
              className={value === filter ? styles.selectedFilter : undefined}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {text(value)}{" "}
              <span className={value === "problem" ? styles.failureCount : undefined}>
                {rows.filter((row) => row.group === value).length}
              </span>
            </Button>
          ))}
        </div>
        <div className={styles.toolbar}>
          <Input.Search
            className={styles.search}
            value={query}
            allowClear
            aria-label={text("search")}
            placeholder={text("search")}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <label className={styles.kindFilter}>
            <span>{text("kind")}</span>
            <Select
              value={kind}
              aria-label={text("kind")}
              onChange={(value) => {
                setKind(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: text("allKinds") },
                ...Array.from(
                  new Set([
                    ...(overview.resource_details ?? [])
                      .filter((row) => row.in_scope)
                      .map((row) => row.kind),
                    "scenario",
                  ]),
                ).map((value) => ({
                  value,
                  label: kindLabel(value),
                })),
              ]}
            />
          </label>
          <Tooltip title={text("refresh")}>
            <Button
              className={styles.refresh}
              aria-label={text("refresh")}
              icon={<ReloadOutlined />}
              onClick={onRefresh}
            />
          </Tooltip>
        </div>
      </div>
      <Table<ResourceResultRow>
        rowKey={(row) => `${row.kind}:${row.id}`}
        scroll={{ x: 1050 }}
        dataSource={visible}
        pagination={{ pageSize: 10, current: page, onChange: setPage }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={text(
                !rows.length
                  ? "noPendingResults"
                  : query || kind !== "all"
                    ? "empty"
                    : "categoryEmpty",
              )}
            />
          ),
        }}
        columns={[
          {
            title: text("resource"),
            width: 190,
            fixed: "left",
            render: (_, row) => (
              <Button
                type="link"
                className={styles.resourceLink}
                title={row.name}
                onClick={() => inspect(row)}
              >
                <KnowledgeResourceIcon kind={row.kind} />
                <span>{row.name}</span>
              </Button>
            ),
          },
          {
            title: text("actions"),
            key: "actions",
            width: 64,
            fixed: "left",
            align: "center",
            render: (_, row) => (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    ...(canRun && row.group === "problem" && row.failures.length
                      ? [{ key: "repair", label: text("aiRepair"), onClick: () => onRepair(row) }]
                      : []),
                    ...(row.case_count === 0
                      ? canRun
                        ? [
                            {
                              key: "create",
                              label: text("createCase"),
                              onClick: () => onCreateCase(row),
                            },
                          ]
                        : []
                      : [
                          {
                            key: "results",
                            label: text(
                              hasResults(row)
                                ? row.group === "problem"
                                  ? "viewProblems"
                                  : "viewResult"
                                : "viewConfiguredCases",
                            ),
                            onClick: () => (hasResults(row) ? open(row) : onCases(row)),
                          },
                        ]),
                    ...(row.kind !== "scenario" || hasResults(row)
                      ? [
                          {
                            key: "target",
                            label: text(row.kind === "scenario" ? "viewCases" : "goResource"),
                            onClick: () =>
                              row.kind === "scenario" ? onCases(row) : onResource(row),
                          },
                        ]
                      : []),
                  ],
                }}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<EllipsisOutlined />}
                  aria-label={`${row.name} ${text("actions")}`}
                />
              </Dropdown>
            ),
          },
          { title: text("kind"), width: 100, render: (_, row) => kindLabel(row.kind) },
          {
            title: text("status"),
            width: 120,
            render: (_, row) => (
              <Tag
                color={
                  row.group === "problem"
                    ? "error"
                    : row.group === "review"
                      ? "warning"
                      : row.group === "passed"
                        ? "success"
                        : undefined
                }
              >
                {text(row.case_count === 0 ? "noCasesConfigured" : row.group)}
              </Tag>
            ),
          },
          {
            title: text("failed"),
            width: 80,
            render: (_, row) =>
              row.problem_cases ? (
                <Button
                  type="link"
                  className={styles.failureCount}
                  aria-label={t("knowledgeNetwork.eval.resourceOverview.viewFailed", {
                    name: row.name,
                    count: row.problem_cases,
                  })}
                  onClick={() => open(row)}
                >
                  {row.problem_cases}
                </Button>
              ) : hasResults(row) ? (
                0
              ) : (
                "—"
              ),
          },
          {
            title: text("summary"),
            ellipsis: true,
            render: (_, row) => {
              const entries = row.group === "problem" ? row.failures : row.reviews;
              const summary =
                entries.map(resourceCaseSummary).join("；") ||
                (row.case_count === 0 ? row.uncovered_reason : undefined) ||
                text(
                  row.group === "passed"
                    ? "allPassed"
                    : row.case_count === 0
                      ? "uncoveredHelp"
                      : row.group === "excluded"
                        ? "excludedHelp"
                        : "pendingHelp",
                );
              return <span title={summary}>{summary}</span>;
            },
          },
          {
            title: text("time"),
            width: 160,
            render: (_, row) =>
              row.latest_result_at
                ? new Date(row.latest_result_at).toLocaleString(i18n.language)
                : "—",
          },
        ]}
      />
      {resource && (
        <EvalResourceResultsDrawer
          key={`${networkId}:${selected}`}
          networkId={networkId}
          resource={resource}
          canRun={canRun}
          onClose={() => setSelected(undefined)}
          onRepair={(cases) => {
            setSelected(undefined);
            onRepair({ ...resource, failures: cases });
          }}
          onResource={() => {
            setSelected(undefined);
            onResource(resource);
          }}
          onCases={() => {
            setSelected(undefined);
            onCases(resource);
          }}
          onInspect={(run, caseRunId) => {
            setSelected(undefined);
            onInspect(run, caseRunId);
          }}
          onRunCreated={(run) => {
            setSelected(undefined);
            onRunCreated(run);
          }}
        />
      )}
    </section>
  );
}
