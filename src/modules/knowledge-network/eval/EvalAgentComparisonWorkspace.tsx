/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { EvalAgentComparisonResult } from "./EvalAgentComparisonResult";
import type { ComparisonInspect } from "./EvalAgentCaseComparison";
import {
  compareAgentRuns,
  MAX_AGENT_COMPARISON_RUNS,
  type AgentComparison,
} from "./agent-comparison.service";
import {
  listEvalSuites,
  listEvalSuiteVersions,
  searchM0Runs,
  type EvalSuiteVersion,
  type M0Run,
} from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalAgentComparisonWorkspace.module.css";

type Props = {
  networkId: string;
  onBack: () => void;
  onInspect: ComparisonInspect;
};
const pageSize = 10;
const prefix = "knowledgeNetwork.eval.agentCompare.";

export function EvalAgentComparisonWorkspace({ networkId, onBack, onInspect }: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`${prefix}${key}`);
  const [suites, setSuites] = useState<EvalSuiteVersion[]>([]);
  const [suite, setSuite] = useState<EvalSuiteVersion>();
  const [suiteQuery, setSuiteQuery] = useState("");
  const [suiteSearch, setSuiteSearch] = useState("");
  const [suitePage, setSuitePage] = useState(1);
  const [suiteTotal, setSuiteTotal] = useState(0);
  const [suiteLoading, setSuiteLoading] = useState(false);
  const [versions, setVersions] = useState<EvalSuiteVersion[]>([]);
  const [version, setVersion] = useState<number>();
  const [versionLoading, setVersionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<[string, string]>(["", ""]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState<M0Run[]>([]);
  const [selected, setSelected] = useState<Record<string, M0Run>>({});
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<AgentComparison>();
  const comparisonAbort = useRef<AbortController | null>(null);
  const selectedRuns = Object.values(selected);
  const agentName = (run: M0Run) => run.external_agent?.name || text("unknownAgent");
  const modelName = (run: M0Run) => run.external_agent?.model || text("unknownModel");
  const time = (run: M0Run) => (run.created_at ? new Date(run.created_at).toLocaleString() : "—");
  const outcome = (value: string) => t(`${prefix}outcomes.${value}`);
  const eligible = (run: M0Run) =>
    run.execution_status === "completed" &&
    Boolean(run.result_revision) &&
    run.runner_type === "external_agent" &&
    Boolean(run.external_agent?.name) &&
    run.scope?.kind === "suite" &&
    run.scope.suite_id === suite?.suite_id &&
    run.scope.version === version;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSuiteSearch(suiteQuery.trim());
      setSuitePage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [suiteQuery]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    setSuiteLoading(true);
    void listEvalSuites(networkId, suitePage, { q: suiteSearch || undefined })
      .then((result) => {
        if (!active) return;
        setSuites((current) =>
          suitePage === 1
            ? result.entries
            : [
                ...new Map(
                  [...current, ...result.entries].map((item) => [item.suite_id, item]),
                ).values(),
              ],
        );
        setSuiteTotal(result.total);
      })
      .catch(() => {
        if (active) setError(t(`${prefix}loadFailed`));
      })
      .finally(() => {
        if (active) setSuiteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, suitePage, suiteSearch, t]);
  useEffect(() => {
    if (!suite) return;
    let active = true;
    setVersionLoading(true);
    setError("");
    void listEvalSuiteVersions(networkId, suite.suite_id)
      .then((items) => {
        if (!active) return;
        const published = items
          .filter((item) => item.status === "published")
          .sort((a, b) => b.version - a.version);
        setVersions(published);
        setVersion(published[0]?.version);
      })
      .catch(() => {
        if (active) setError(t(`${prefix}loadFailed`));
      })
      .finally(() => {
        if (active) setVersionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, suite, t]);
  useEffect(() => {
    if (!suite || !version) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    void searchM0Runs(
      networkId,
      {
        page,
        limit: pageSize,
        suite_id: suite.suite_id,
        suite_version: version,
        runner_type: "external_agent",
        status: "completed",
        comparable: true,
        q: search || undefined,
        from: dates[0] ? dayjs(dates[0]).startOf("day").toISOString() : undefined,
        to: dates[1] ? dayjs(dates[1]).add(1, "day").startOf("day").toISOString() : undefined,
      },
      controller.signal,
    )
      .then((result) => {
        if (active) {
          setEntries(result.entries);
          setTotal(result.total);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setError(t(`${prefix}loadFailed`));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [networkId, suite, version, page, search, dates, refresh, t]);
  useEffect(() => () => comparisonAbort.current?.abort(), []);

  const generate = async () => {
    if (!suite || !version || selectedRuns.length < 2) return;
    comparisonAbort.current?.abort();
    const controller = new AbortController();
    comparisonAbort.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await compareAgentRuns(
        networkId,
        suite.suite_id,
        version,
        selectedRuns,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setComparison(result);
      }
    } catch {
      if (!controller.signal.aborted) setError(text("compareFailed"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section className={styles.workspace} aria-label={text("title")}>
      <div className={styles.header}>
        <Button type="text" icon={<ArrowLeftOutlined aria-hidden />} onClick={onBack}>
          {text("back")}
        </Button>
        <Typography.Title level={4}>{text("title")}</Typography.Title>
        {comparison && (
          <>
            <Tag>
              {suite?.name} · v{comparison.suite_version}
            </Tag>
            <Button onClick={() => setComparison(undefined)}>{text("reselect")}</Button>
          </>
        )}
      </div>
      <Alert className={styles.notice} type="info" showIcon message={text("declaration")} />
      {error && <Alert className={styles.notice} type="error" showIcon message={error} />}
      {!comparison ? (
        <div className={styles.surface}>
          <div className={styles.filters}>
            <label>
              <span>{text("suite")}</span>
              <Select
                className={styles.suiteSelect}
                aria-label={text("suite")}
                showSearch
                filterOption={false}
                onSearch={setSuiteQuery}
                value={suite?.suite_id}
                placeholder={text("chooseSuite")}
                loading={suiteLoading}
                disabled={busy}
                options={[
                  ...new Map(
                    [...(suite ? [suite] : []), ...suites].map((item) => [item.suite_id, item]),
                  ).values(),
                ].map((item) => ({ value: item.suite_id, label: item.name }))}
                onChange={(id) => {
                  setSuite(suites.find((item) => item.suite_id === id));
                  setVersion(undefined);
                  setVersions([]);
                  setSelected({});
                  setEntries([]);
                  setTotal(0);
                  setPage(1);
                }}
                popupRender={(menu) => (
                  <>
                    {menu}
                    {suites.length < suiteTotal && (
                      <div className={styles.loadMore}>
                        <Button
                          type="text"
                          loading={suiteLoading}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setSuitePage((value) => value + 1)}
                        >
                          {text("loadMore")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              />
            </label>
            <label>
              <span>{text("version")}</span>
              <Select
                className={styles.versionSelect}
                aria-label={text("version")}
                value={version}
                loading={versionLoading}
                disabled={!suite || busy || versionLoading}
                options={versions.map((item) => ({
                  value: item.version,
                  label: `v${item.version} · ${item.members.length} ${text("casesUnit")}`,
                }))}
                onChange={(value) => {
                  setVersion(value);
                  setSelected({});
                  setEntries([]);
                  setTotal(0);
                  setPage(1);
                }}
              />
            </label>
          </div>
          <div className={styles.sectionHeader}>
            <Space wrap>
              <strong>{text("selectRuns")}</strong>
              <Typography.Text type="secondary">
                {t(`${prefix}selectionCount`, {
                  count: selectedRuns.length,
                  max: MAX_AGENT_COMPARISON_RUNS,
                })}
              </Typography.Text>
            </Space>
            <Button
              type="primary"
              disabled={selectedRuns.length < 2 || !version || loading}
              loading={busy}
              onClick={() => void generate()}
            >
              {text("compare")}
            </Button>
          </div>
          <div className={styles.filters}>
            <Input.Search
              className={styles.search}
              aria-label={text("search")}
              placeholder={text("search")}
              value={query}
              disabled={!version || busy}
              onChange={(event) => setQuery(event.target.value)}
              onSearch={(value) => {
                setSearch(value.trim());
                setPage(1);
              }}
            />
            <label>
              <span>{text("date")}</span>
              <DatePicker.RangePicker
                allowEmpty={[true, true]}
                className={styles.dateRange}
                aria-label={text("date")}
                disabled={!version || busy}
                value={dates[0] && dates[1] ? [dayjs(dates[0]), dayjs(dates[1])] : null}
                onChange={(_values, strings) => {
                  setDates(strings);
                  setPage(1);
                }}
              />
            </label>
            <Tooltip title={text("refresh")}>
              <Button
                aria-label={text("refresh")}
                icon={<ReloadOutlined />}
                loading={loading}
                disabled={!version || busy}
                onClick={() => setRefresh((value) => value + 1)}
              />
            </Tooltip>
          </div>
          {!!selectedRuns.length && (
            <div className={styles.selected}>
              {selectedRuns.map((run) => (
                <Tag
                  key={run.id}
                  closable={!busy}
                  onClose={() =>
                    setSelected((current) => {
                      const next = { ...current };
                      delete next[run.id];
                      return next;
                    })
                  }
                >
                  <span
                    className={styles.selectedLabel}
                    title={`${agentName(run)} · ${modelName(run)} · ${time(run)}`}
                  >
                    {agentName(run)} · {modelName(run)} · {time(run)}
                  </span>
                </Tag>
              ))}
            </div>
          )}
          <Table<M0Run>
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={entries}
            pagination={false}
            scroll={{ x: 1080 }}
            locale={{
              emptyText: <Empty description={version ? text("noRuns") : text("chooseSuite")} />,
            }}
            rowSelection={{
              selectedRowKeys: Object.keys(selected),
              preserveSelectedRowKeys: true,
              hideSelectAll: true,
              getCheckboxProps: (run) => ({
                disabled:
                  busy ||
                  !eligible(run) ||
                  (!selected[run.id] && selectedRuns.length >= MAX_AGENT_COMPARISON_RUNS),
              }),
              onChange: (keys) =>
                setSelected((current) =>
                  Object.fromEntries(
                    keys.slice(0, MAX_AGENT_COMPARISON_RUNS).flatMap((key) => {
                      const id = String(key);
                      const run = current[id] ?? entries.find((item) => item.id === id);
                      return run && eligible(run) ? [[id, run]] : [];
                    }),
                  ),
                ),
            }}
            columns={[
              {
                title: text("agent"),
                width: 180,
                render: (_: unknown, run: M0Run) => (
                  <div className={styles.meta}>
                    <strong title={agentName(run)}>{agentName(run)}</strong>
                    <span className={styles.secondary}>{text("declared")}</span>
                  </div>
                ),
              },
              {
                title: text("model"),
                width: 180,
                render: (_: unknown, run: M0Run) => (
                  <div className={styles.meta}>
                    <span title={modelName(run)}>{modelName(run)}</span>
                    <span className={styles.secondary} title={run.external_agent?.client_version}>
                      {run.external_agent?.client_version || text("unknownClient")}
                    </span>
                  </div>
                ),
              },
              { title: text("time"), width: 180, render: (_: unknown, run: M0Run) => time(run) },
              {
                title: text("resultVersion"),
                width: 100,
                render: (_: unknown, run: M0Run) => `v${run.result_revision}`,
              },
              {
                title: text("outcome"),
                width: 120,
                render: (_: unknown, run: M0Run) => outcome(run.quality_outcome ?? "inconclusive"),
              },
              {
                title: text("passRate"),
                width: 100,
                render: (_: unknown, run: M0Run) =>
                  run.case_counts?.total
                    ? `${Math.round((run.case_counts.passed / run.case_counts.total) * 1000) / 10}%`
                    : "—",
              },
              {
                title: text("total"),
                width: 80,
                render: (_: unknown, run: M0Run) =>
                  run.case_counts?.total ?? run.progress.planned_cases,
              },
            ]}
          />
          {total > 0 && (
            <div className={styles.pagination}>
              <TablePaginationBar
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger={false}
                showTotal={(count) => t(`${prefix}totalRuns`, { count })}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      ) : (
        <EvalAgentComparisonResult
          networkId={networkId}
          comparison={comparison}
          onInspect={onInspect}
        />
      )}
    </section>
  );
}
