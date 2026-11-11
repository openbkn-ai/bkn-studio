/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalOutcomeLabel } from "./eval-terminology";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { ArrowLeftOutlined, EllipsisOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Popover,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { useEvalFeedback } from "./useEvalFeedback";
import { EvalSuiteDrawer } from "./EvalSuiteDrawer";
import { EvalSuiteCaseDetailDrawer } from "./EvalSuiteCaseDetailDrawer";
import {
  createM1Run,
  deleteEvalSuite,
  getEvalSuite,
  getM1RunCapabilities,
  listEvalSuites,
  listEvalSuiteVersions,
  searchM0Runs,
  previewM1RunSelection,
  type EvalSuiteVersion,
  type M0Run,
} from "./m0-run.service";
import styles from "./EvalWorkspaceScene.module.css";
import { REGRESSION_SUITE_TAG } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";
import { definitionText } from "./eval-definition-view";

type Props = {
  networkId: string;
  canManage: boolean;
  externalAvailable?: boolean;
  onCountChange: (count: number) => void;
  onRunCreated: (run: M0Run) => void;
};

const pageSize = 20;

const outcomeText = evalOutcomeLabel;

export function EvalSuitePanel({
  networkId,
  canManage,
  externalAvailable = true,
  onCountChange,
  onRunCreated,
}: Props) {
  const { t } = useEvalTranslation();
  const { message, modal } = useEvalFeedback();
  const loadRequest = useRef(0);
  const [entries, setEntries] = useState<EvalSuiteVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<EvalSuiteVersion>();
  const [suiteVersions, setSuiteVersions] = useState<EvalSuiteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [detailSuite, setDetailSuite] = useState<EvalSuiteVersion>();
  const [versionReload, setVersionReload] = useState(0);
  const [detailReload, setDetailReload] = useState(0);
  const [detailError, setDetailError] = useState(false);
  const [detailRun, setDetailRun] = useState<M0Run>();
  const [detailRunLoading, setDetailRunLoading] = useState(false);
  const [detailRunError, setDetailRunError] = useState(false);
  const detailSuiteId = detailSuite?.suite_id;
  const detailVersion = detailSuite?.version;
  const versionChoices = [
    ...new Map(
      [...suiteVersions, ...(detailSuite ? [detailSuite] : [])].map((suite) => [
        suite.version,
        suite,
      ]),
    ).values(),
  ].sort((a, b) => b.version - a.version);
  const latestVersion = suiteVersions.length ? versionChoices[0]?.version : undefined;
  const suiteText = (key: string) => t(`knowledgeNetwork.eval.suiteUi.${key}`);
  const [detailCaseId, setDetailCaseId] = useState<string>();
  const detailCaseIndex = detailSuite?.members.indexOf(detailCaseId ?? "") ?? -1;
  const closeDetails = () => {
    setDetailCaseId(undefined);
    setDetailSuite(undefined);
  };
  const [caseTitles, setCaseTitles] = useState<Record<string, string>>({});
  const [caseTitlesLoading, setCaseTitlesLoading] = useState(false);
  const [runningSuiteId, setRunningSuiteId] = useState<string>();
  const [externalSuite, setExternalSuite] = useState<EvalSuiteVersion>();
  const externalInstruction = externalSuite
    ? t("knowledgeNetwork.eval.externalUi.instruction", {
        knId: networkId,
        suiteId: externalSuite.suite_id,
        version: externalSuite.version,
      })
    : "";

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const suitePage = await listEvalSuites(networkId, page, {
        q: search || undefined,
        tag: tagFilter || undefined,
      });
      if (request !== loadRequest.current) return;
      setEntries(suitePage.entries);
      setTotal(suitePage.total);
      setAvailableTags(suitePage.available_tags ?? []);
      onCountChange(suitePage.total_all ?? suitePage.total);
    } catch {
      if (request === loadRequest.current)
        setError(workspaceUi("cannotLoadTestSuitesTryAgainLater"));
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [networkId, onCountChange, page, search, tagFilter]);

  useEffect(() => {
    if (query.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    void load();
    return () => {
      loadRequest.current += 1;
    };
  }, [load, revision]);

  useEffect(() => {
    setSuiteVersions([]);
    setVersionsError("");
    setVersionsLoading(Boolean(detailSuiteId));
    if (!detailSuiteId) return;
    let active = true;
    void listEvalSuiteVersions(networkId, detailSuiteId)
      .then((versions) => {
        if (active) setSuiteVersions(versions);
      })
      .catch(() => {
        if (active) setVersionsError(t("knowledgeNetwork.eval.suiteUi.versionsError"));
      })
      .finally(() => {
        if (active) setVersionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, detailSuiteId, versionReload, t]);

  useEffect(() => {
    setDetailCaseId(undefined);
    setCaseTitles({});
    setDetailError(false);
    setCaseTitlesLoading(Boolean(detailSuiteId));
    setDetailRun(undefined);
    setDetailRunError(false);
    setDetailRunLoading(Boolean(detailSuiteId));
    if (!detailSuiteId || detailVersion === undefined) return;
    let active = true;
    void getEvalSuite(networkId, detailSuiteId, detailVersion)
      .then((suite) => {
        if (!active) return;
        setDetailSuite(suite);
        setCaseTitles(
          Object.fromEntries(
            (suite.member_summaries ?? []).map((item) => [item.case_id, item.title]),
          ),
        );
      })
      .catch(() => {
        if (active) setDetailError(true);
      })
      .finally(() => {
        if (active) setCaseTitlesLoading(false);
      });
    // The recent list may not contain an older version's runs. Read exactly the selected version.
    void searchM0Runs(networkId, {
      suite_id: detailSuiteId,
      suite_version: detailVersion,
      page: 1,
      limit: 1,
    })
      .then((page) => {
        if (active) setDetailRun(page.entries[0]);
      })
      .catch(() => {
        if (active) setDetailRunError(true);
      })
      .finally(() => {
        if (active) setDetailRunLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, detailSuiteId, detailVersion, detailReload]);

  const tagOptions = useMemo(
    () => [
      { value: "", label: t("knowledgeNetwork.eval.suiteUi.allTags") },
      ...[
        ...new Set([REGRESSION_SUITE_TAG, ...availableTags, ...(tagFilter ? [tagFilter] : [])]),
      ].map((tag) => ({
        value: tag,
        label:
          tag === REGRESSION_SUITE_TAG ? t("knowledgeNetwork.eval.suiteUi.regressionTag") : tag,
      })),
    ],
    [availableTags, tagFilter, t],
  );

  const runSuite = async (suite: EvalSuiteVersion) => {
    if (suite.status !== "published" || !suite.members.length) return;
    const scope = { kind: "suite" as const, suite_id: suite.suite_id, version: suite.version };
    setRunningSuiteId(suite.suite_id);
    try {
      if (!(await getM1RunCapabilities(networkId))) {
        message.error(workspaceUi("theExecutionServiceIsNotReadyTestSuitesCannot"));
        return;
      }
      const preview = await previewM1RunSelection(networkId, scope);
      if (preview.case_count < 1) {
        message.error(workspaceUi("thisTestSuiteHasNoRunnableEnabledCasesCheck"));
        return;
      }
      modal.confirm({
        title: workspaceUi("runTestSuite", { value0: suite.name }),
        content: workspaceUi("thisRunWillExecuteEnabledCasesInTheTest", {
          value0: preview.case_count,
        }),
        okText: workspaceUi("run"),
        cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
        onOk: async () => {
          const run = await createM1Run(networkId, scope, crypto.randomUUID());
          message.success(workspaceUi("testSuiteRunSubmitted"));
          onRunCreated(run);
        },
      });
    } catch {
      message.error(workspaceUi("thisTestSuiteDoesNotMeetExecutionRequirementsCheck"));
    } finally {
      setRunningSuiteId(undefined);
    }
  };

  const removeSuite = (suite: EvalSuiteVersion) => {
    modal.confirm({
      title: workspaceUi("deleteTestSuite", { value0: suite.name }),
      content: workspaceUi("deletionCannotBeUndone"),
      okText: workspaceUi("knowledgeNetwork.eval.caseBatch.delete"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteEvalSuite(networkId, suite.suite_id);
        message.success(workspaceUi("testSuiteDeleted"));
        setRevision((value) => value + 1);
      },
    });
  };

  return (
    <section className={styles.suitePanel} aria-label={workspaceUi("testSuiteList")}>
      <div className={styles.suiteToolbar}>
        <div className={styles.listToolbarControls}>
          <Input.Search
            aria-label={workspaceUi("searchTestSuites")}
            placeholder={workspaceUi("searchTestSuiteNamesDescriptionsOrIDs")}
            allowClear
            maxLength={128}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onSearch={(value) => {
              setSearch(value.trim());
              setPage(1);
            }}
          />
          <label className={styles.runFilterField}>
            <Tooltip title={t("knowledgeNetwork.eval.suiteUi.regressionHint")}>
              <span>{t("knowledgeNetwork.eval.suiteUi.tagLabel")}</span>
            </Tooltip>
            <Select
              aria-label={t("knowledgeNetwork.eval.suiteUi.tagFilter")}
              value={tagFilter}
              options={tagOptions}
              onChange={(value) => {
                setTagFilter(value);
                setPage(1);
              }}
            />
          </label>
          {(query || tagFilter) && (
            <Button
              type="link"
              onClick={() => {
                setQuery("");
                setSearch("");
                setTagFilter("");
                setPage(1);
              }}
            >
              {t("knowledgeNetwork.eval.suiteUi.clearFilters")}
            </Button>
          )}
          <Button
            type="primary"
            disabled={!canManage}
            onClick={() => {
              setEditingSuite(undefined);
              setEditorOpen(true);
            }}
          >
            {workspaceUi("create")}
          </Button>
        </div>
      </div>
      {error && (
        <Alert
          showIcon
          type="error"
          message={error}
          action={
            <Button onClick={() => void load()}>
              {workspaceUi("knowledgeNetwork.eval.suiteCaseUi.retry")}
            </Button>
          }
        />
      )}
      <Table<EvalSuiteVersion>
        className={styles.suiteTable}
        scroll={{ x: 1180 }}
        rowKey="suite_id"
        size="small"
        tableLayout="fixed"
        loading={loading}
        dataSource={entries}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={t(
                `knowledgeNetwork.eval.suiteUi.${query || tagFilter ? "emptyFiltered" : "empty"}`,
              )}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        columns={[
          {
            title: workspaceUi("knowledgeNetwork.eval.materialsUi.fields.suite_name"),
            dataIndex: "name",
            width: "18%",
            render: (name: string, suite) => (
              <button
                type="button"
                className={styles.suiteNameButton}
                onClick={() => {
                  setDetailSuite(suite);
                }}
              >
                <strong>{name}</strong>
              </button>
            ),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.actions"),
            width: "6%",
            align: "center",
            render: (_: unknown, suite) => (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    {
                      key: "detail",
                      label: workspaceUi("knowledgeNetwork.eval.templateUi.details"),
                      onClick: () => setDetailSuite(suite),
                    },
                    {
                      key: "run",
                      label: externalAvailable
                        ? workspaceUi("run")
                        : workspaceUi("externalEvaluationIsNotEnabled"),
                      disabled:
                        !externalAvailable ||
                        suite.status !== "published" ||
                        !suite.members.length ||
                        runningSuiteId === suite.suite_id,
                      onClick: () => {
                        void (async () => {
                          setRunningSuiteId(suite.suite_id);
                          try {
                            const result = await previewM1RunSelection(
                              networkId,
                              { kind: "suite", suite_id: suite.suite_id, version: suite.version },
                              "external",
                            );
                            if (!result.eligible) {
                              message.error(
                                result.reasons?.join("；") ||
                                  workspaceUi(
                                    "externalEvaluationSupportsOnlyAuthorizedReadOnlyFunctionCases",
                                  ),
                              );
                              return;
                            }
                            setExternalSuite(suite);
                          } catch {
                            message.error(
                              workspaceUi(
                                "cannotCheckExternalEvaluationRequirementsCheckCaseStatesAnd",
                              ),
                            );
                          } finally {
                            setRunningSuiteId(undefined);
                          }
                        })();
                      },
                    },
                    {
                      key: "capability-check",
                      label: t("knowledgeNetwork.eval.externalUi.capabilityCheck"),
                      disabled:
                        suite.status !== "published" ||
                        !suite.members.length ||
                        runningSuiteId === suite.suite_id,
                      onClick: () => void runSuite(suite),
                    },
                    {
                      key: "edit",
                      label: workspaceUi("edit"),
                      disabled: !canManage,
                      onClick: () => {
                        setEditingSuite(suite);
                        setEditorOpen(true);
                      },
                    },
                    {
                      key: "delete",
                      label: workspaceUi("knowledgeNetwork.eval.caseBatch.delete"),
                      danger: true,
                      disabled: !canManage,
                      onClick: () => removeSuite(suite),
                    },
                  ],
                }}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<EllipsisOutlined />}
                  aria-label={workspaceUi("testSuiteActions", { value0: suite.name })}
                />
              </Dropdown>
            ),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.dimension"),
            dataIndex: "tags",
            width: "16%",
            render: (tags: string[]) =>
              tags.length ? (
                <div className={styles.suiteTags}>
                  {tags.slice(0, 2).map((tag) => (
                    <Tooltip key={tag} title={tag}>
                      <Tag className={styles.suiteTag}>{tag}</Tag>
                    </Tooltip>
                  ))}
                  {tags.length > 2 && (
                    <Popover
                      title={t("knowledgeNetwork.eval.suiteUi.tagList")}
                      trigger={["hover", "click"]}
                      content={
                        <div className={styles.suiteTagPopover}>
                          {tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </div>
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        className={styles.suiteTagsMore}
                        aria-label={t("knowledgeNetwork.eval.suiteUi.moreTags", {
                          count: tags.length,
                        })}
                      >
                        +{tags.length - 2}
                      </Button>
                    </Popover>
                  )}
                </div>
              ) : (
                "—"
              ),
          },
          {
            title: workspaceUi("description"),
            dataIndex: "description",
            width: "15%",
            render: (description: string) =>
              description ? (
                <Typography.Text ellipsis={{ tooltip: description }}>{description}</Typography.Text>
              ) : (
                "—"
              ),
          },
          {
            title: workspaceUi("currentVersion"),
            dataIndex: "version",
            width: "7%",
            render: (version: number) => <Tag color="blue">v{version}</Tag>,
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.agentCompare.total"),
            dataIndex: "members",
            width: "7%",
            render: (members: string[]) =>
              workspaceUi("caseCountLabel", { value0: members.length }),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.enabled"),
            dataIndex: "status",
            width: "8%",
            render: (status: EvalSuiteVersion["status"]) =>
              status === "published" ? (
                <Tag color="success">{workspaceUi("published")}</Tag>
              ) : (
                <Tag>{workspaceUi("knowledgeNetwork.eval.ruleApplication.incomplete")}</Tag>
              ),
          },
          {
            title: workspaceUi("recentRuns"),
            width: "15%",
            render: (_: unknown, suite) => {
              const run = suite.latest_run;
              return run?.created_at ? new Date(run.created_at).toLocaleString() : "—";
            },
          },
          {
            title: workspaceUi("latestResult"),
            width: "8%",
            render: (_: unknown, suite) => outcomeText(suite.latest_run?.quality_outcome ?? null),
          },
        ]}
      />
      <div className={styles.suitePagination}>
        {total > pageSize ? (
          <TablePaginationBar
            aria-label={workspaceUi("testSuitePagination")}
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            showTotal={(count) => workspaceUi("itemsInTotal", { value0: count })}
            onChange={setPage}
          />
        ) : (
          <span>
            {workspaceUi("total")} {total} {workspaceUi("resources", { count: total })}
          </span>
        )}
      </div>
      <EvalSuiteDrawer
        networkId={networkId}
        open={editorOpen}
        suite={editingSuite}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          setRevision((value) => value + 1);
        }}
      />
      <Drawer
        title={
          detailCaseId ? (
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined aria-hidden />}
                aria-label={t("knowledgeNetwork.eval.suiteCaseUi.back")}
                onClick={() => setDetailCaseId(undefined)}
              >
                {t("knowledgeNetwork.eval.suiteCaseUi.back")}
              </Button>
              <span>{t("knowledgeNetwork.eval.suiteCaseUi.title")}</span>
            </Space>
          ) : (
            suiteText("detailTitle")
          )
        }
        extra={
          detailCaseId && detailSuite ? (
            <Space size="small" wrap>
              <span aria-live="polite">
                {detailCaseIndex + 1} / {detailSuite.members.length}
              </span>
              <Button
                disabled={detailCaseIndex <= 0}
                onClick={() => setDetailCaseId(detailSuite.members[detailCaseIndex - 1])}
              >
                {t("knowledgeNetwork.eval.suiteCaseUi.previous")}
              </Button>
              <Button
                disabled={detailCaseIndex < 0 || detailCaseIndex >= detailSuite.members.length - 1}
                onClick={() => setDetailCaseId(detailSuite.members[detailCaseIndex + 1])}
              >
                {t("knowledgeNetwork.eval.suiteCaseUi.next")}
              </Button>
            </Space>
          ) : null
        }
        open={Boolean(detailSuite)}
        width="min(840px, 96vw)"
        styles={{
          body: { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" },
        }}
        onClose={closeDetails}
      >
        {detailSuite && (
          <div
            className={styles.suiteDetailPane}
            style={{ display: detailCaseId ? "none" : undefined }}
          >
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Alert type="info" showIcon message={definitionText("membershipVersion")} />
              {versionsError && (
                <Alert
                  type="error"
                  showIcon
                  message={versionsError}
                  action={
                    <Button onClick={() => setVersionReload((value) => value + 1)}>
                      {suiteText("retryVersions")}
                    </Button>
                  }
                />
              )}
              {detailError && (
                <Alert
                  type="error"
                  showIcon
                  message={suiteText("detailError")}
                  action={
                    <Button onClick={() => setDetailReload((value) => value + 1)}>
                      {suiteText("retryDetails")}
                    </Button>
                  }
                />
              )}
              {detailRunError && (
                <Alert
                  type="warning"
                  showIcon
                  message={suiteText("versionRunError")}
                  action={
                    <Button onClick={() => setDetailReload((value) => value + 1)}>
                      {suiteText("retryDetails")}
                    </Button>
                  }
                />
              )}
              <Descriptions
                className={styles.detailDescriptions}
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "name",
                    label: workspaceUi("knowledgeNetwork.eval.materialsUi.fields.suite_name"),
                    children: detailSuite.name,
                  },
                  {
                    key: "description",
                    label: workspaceUi("description"),
                    children: detailSuite.description || "—",
                  },
                  {
                    key: "version",
                    label: workspaceUi("version"),
                    children: (
                      <Select
                        aria-label={suiteText("versionSelector")}
                        style={{ width: 180, maxWidth: "100%" }}
                        value={detailSuite.version}
                        loading={versionsLoading}
                        options={versionChoices.map((suite) => ({
                          value: suite.version,
                          label: `v${suite.version}${suite.version === latestVersion ? `（${suiteText("latestVersion")}）` : ""}`,
                        }))}
                        onChange={(version) => {
                          const next = versionChoices.find((suite) => suite.version === version);
                          if (!next) return;
                          setDetailCaseId(undefined);
                          setCaseTitles({});
                          setDetailSuite(next);
                        }}
                      />
                    ),
                  },
                  {
                    key: "tags",
                    label: workspaceUi("knowledgeNetwork.eval.templateUi.columns.dimension"),
                    children: detailSuite.tags.length ? (
                      <Space size={[4, 4]} wrap>
                        {detailSuite.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    key: "status",
                    label: workspaceUi("knowledgeNetwork.eval.templateUi.columns.enabled"),
                    children:
                      detailSuite.status === "published" ? (
                        <Tag color="success">{workspaceUi("published")}</Tag>
                      ) : (
                        <Tag>{workspaceUi("knowledgeNetwork.eval.ruleApplication.incomplete")}</Tag>
                      ),
                  },
                  {
                    key: "recentRun",
                    label: workspaceUi("recentRuns"),
                    children: detailRunLoading
                      ? suiteText("versionRunLoading")
                      : detailRunError
                        ? suiteText("readFailed")
                        : detailRun?.created_at
                          ? new Date(detailRun.created_at).toLocaleString()
                          : "—",
                  },
                  {
                    key: "recentOutcome",
                    label: workspaceUi("latestResult"),
                    children: detailRunLoading
                      ? suiteText("versionRunLoading")
                      : detailRunError
                        ? suiteText("readFailed")
                        : outcomeText(detailRun?.quality_outcome ?? null),
                  },
                ]}
              />
              <Table<{ id: string; title: string }>
                key={`${detailSuite.suite_id}:${detailSuite.version}`}
                scroll={{ x: 680 }}
                size="small"
                rowKey="id"
                loading={caseTitlesLoading}
                pagination={{ pageSize: 10 }}
                dataSource={(detailError ? [] : detailSuite.members).map((id) => ({
                  id,
                  title: caseTitles[id] ?? workspaceUi("theCaseWasDeletedOrIsNotAccessibleTo"),
                }))}
                locale={{
                  emptyText: detailError
                    ? suiteText("readFailed")
                    : workspaceUi("thisTestSuiteHasNoCasesYet"),
                }}
                columns={[
                  {
                    title: workspaceUi("includedCases", { value0: detailSuite.members.length }),
                    dataIndex: "title",
                    render: (title: string, member: { id: string }) => (
                      <Button
                        type="link"
                        className={styles.overviewResourceLink}
                        title={title}
                        onClick={() => setDetailCaseId(member.id)}
                      >
                        {title}
                      </Button>
                    ),
                  },
                ]}
              />
            </Space>
          </div>
        )}
        {detailSuite && detailCaseId && (
          <div key={detailCaseId} className={styles.suiteDetailPane}>
            <EvalSuiteCaseDetailDrawer
              embedded
              networkId={networkId}
              suiteId={detailSuite.suite_id}
              suiteVersion={detailSuite.version}
              caseId={detailCaseId}
              onClose={() => setDetailCaseId(undefined)}
            />
          </div>
        )}
      </Drawer>
      <Drawer
        title={t("knowledgeNetwork.eval.externalUi.title")}
        open={Boolean(externalSuite)}
        width="min(640px, 92vw)"
        destroyOnHidden
        onClose={() => setExternalSuite(undefined)}
        footer={
          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setExternalSuite(undefined)}>
              {t("knowledgeNetwork.eval.externalUi.close")}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert type="info" showIcon message={t("knowledgeNetwork.eval.externalUi.manualHint")} />
          <Descriptions
            className={styles.detailDescriptions}
            bordered
            size="small"
            column={1}
            items={[
              {
                key: "suite",
                label: t("knowledgeNetwork.eval.externalUi.suite"),
                children: externalSuite?.name,
              },
              {
                key: "version",
                label: t("knowledgeNetwork.eval.externalUi.version"),
                children: `v${externalSuite?.version ?? ""} · ${externalSuite?.members.length ?? 0} Case`,
              },
            ]}
          />
          <Typography.Title level={5}>
            {t("knowledgeNetwork.eval.externalUi.copyInstruction")}
          </Typography.Title>
          <Typography.Paragraph
            copyable={{ text: externalInstruction }}
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {externalInstruction}
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            {t("knowledgeNetwork.eval.externalUi.connectionHint")}
          </Typography.Text>
          <Typography.Paragraph
            copyable
          >{`${window.location.origin}/api/agent-retrieval/v1/mcp/`}</Typography.Paragraph>
        </Space>
      </Drawer>
    </section>
  );
}
