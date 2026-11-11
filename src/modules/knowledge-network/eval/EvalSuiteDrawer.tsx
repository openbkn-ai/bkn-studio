/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalTerm } from "./eval-terminology";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Input, Select, Space, Tooltip, Typography } from "antd";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";

import {
  CASE_LIST_BATCH_SIZE,
  createEvalSuite,
  getEvalSuite,
  listEvalCases,
  listEvalCaseResourceSummary,
  type EvalCaseResourceSummaryPage,
  replaceEvalSuite,
  type EvalCaseSummary,
  type EvalSuiteVersion,
} from "./m0-run.service";
import { EvalCaseResourceSidebar, type EvalCaseResourceFilter } from "./EvalCaseResourceSidebar";
import { REGRESSION_SUITE_TAG } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";
import { useEvalFeedback } from "./useEvalFeedback";
import styles from "./EvalSuiteDrawer.module.css";

const casePageSize = 10;
const casePagesPerBatch = CASE_LIST_BATCH_SIZE / casePageSize;

function unavailableMember(caseId: string): EvalCaseSummary {
  return {
    id: caseId,
    title: workspaceUi("theCaseWasDeletedOrIsNotAccessibleTo"),
    enabled: false,
    created_at: "",
  };
}

function suiteMemberCases(suite?: EvalSuiteVersion): Record<string, EvalCaseSummary> {
  if (!suite) return {};
  const summaries = new Map(
    (suite.member_summaries ?? []).map((summary) => [summary.case_id, summary]),
  );
  return Object.fromEntries(
    suite.members.map((caseId) => {
      const summary = summaries.get(caseId);
      return [
        caseId,
        summary
          ? {
              id: summary.case_id,
              title: summary.title,
              enabled: true,
              created_at: "",
            }
          : unavailableMember(caseId),
      ];
    }),
  );
}

const resourceTypeLabels: Record<string, string> = {
  get objectType() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.objectType");
  },
  get object_type() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.objectType");
  },
  get relationType() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.relationType");
  },
  get relation_type() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.relationType");
  },
  get objectProperty() {
    return workspaceUi("objectProperties");
  },
  get metric() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.metric");
  },
  get object_metric() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.metric");
  },
  get action() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.action");
  },
  get action_type() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.action");
  },
  get function() {
    return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.function");
  },
  api: "API",
  mcp: "MCP",
  skill: "SKILLS",
};

function caseTargetLabel(item: EvalCaseSummary): string {
  if (item.execution_spec?.target_kind === "business_scenario")
    return workspaceUi("knowledgeNetwork.eval.resourceOverview.kinds.scenario");
  const targets = [item.execution_spec?.target, ...(item.execution_spec?.related_targets ?? [])];
  const names = targets
    .map((target) => target?.name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)].join("、") || workspaceUi("noEvaluationTargetSpecified");
}

function caseResourceTypeLabel(item: EvalCaseSummary): string {
  if (item.execution_spec?.target_kind === "business_scenario")
    return workspaceUi("knowledgeNetwork.eval.resourceOverview.kinds.scenario");
  const targets = [item.execution_spec?.target, ...(item.execution_spec?.related_targets ?? [])];
  const types = targets
    .map((target) => target?.capability_type)
    .filter((type): type is string => Boolean(type))
    .map((type) => resourceTypeLabels[type] ?? type);
  return [...new Set(types)].join("、") || "—";
}

type Props = {
  networkId: string;
  open: boolean;
  suite?: EvalSuiteVersion;
  onClose: () => void;
  onSaved: (suite: EvalSuiteVersion) => void;
};

function suiteError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409)
      return workspaceUi("thisTestSuiteWasModifiedBySomeoneElseRefresh");
    if (error.response?.status === 400)
      return workspaceUi("aTestSuiteCanContainOnlyEnabledFullyConfigured");
  }
  return workspaceUi("cannotSaveTheTestSuiteCheckPermissionsAndService");
}

export function EvalSuiteDrawer({ networkId, open, suite, onClose, onSaved }: Props) {
  const { t } = useEvalTranslation();
  const { message } = useEvalFeedback();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [memberCases, setMemberCases] = useState<Record<string, EvalCaseSummary>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [caseSelectorOpen, setCaseSelectorOpen] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<string[]>([]);
  const [candidateCases, setCandidateCases] = useState<Record<string, EvalCaseSummary>>({});
  const [caseOptions, setCaseOptions] = useState<EvalCaseSummary[]>([]);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseTotal, setCaseTotal] = useState(0);
  const [caseNextCursor, setCaseNextCursor] = useState<string | null>(null);
  const [caseCursorHistory, setCaseCursorHistory] = useState<string[]>([""]);
  const [caseBatchIndex, setCaseBatchIndex] = useState(0);
  const [caseLocalPage, setCaseLocalPage] = useState(1);
  const [loadingCases, setLoadingCases] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resourceFilter, setResourceFilter] = useState<EvalCaseResourceFilter>({
    type: "all",
    name: "",
  });
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceSummary, setResourceSummary] = useState<EvalCaseResourceSummaryPage | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState(false);
  const [resourceRetry, setResourceRetry] = useState(0);
  useEffect(() => {
    if (!open || !caseSelectorOpen) return;
    let active = true;
    const controller = new AbortController();
    setResourceLoading(true);
    setResourceError(false);
    void listEvalCaseResourceSummary(
      networkId,
      resourceFilter.type === "all" ? undefined : resourceFilter.type,
      resourcePage,
      10,
      controller.signal,
      "enabled",
    )
      .then((summary) => {
        if (active) {
          const last = Math.max(1, Math.ceil(summary.total / 10));
          if (resourcePage > last) setResourcePage(last);
          else setResourceSummary(summary);
        }
      })
      .catch(() => {
        if (active) setResourceError(true);
      })
      .finally(() => {
        if (active) setResourceLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [networkId, open, caseSelectorOpen, resourceFilter.type, resourcePage, resourceRetry]);

  useEffect(() => {
    if (!open) return;
    setName(suite?.name ?? "");
    setDescription(suite?.description ?? "");
    setTags(suite?.tags ?? []);
    setMembers(suite?.members ?? []);
    setMemberCases(suiteMemberCases(suite));
    setMemberQuery("");
    setCaseSelectorOpen(false);
    setPendingMembers([]);
    setCandidateCases({});
    setCaseQuery("");
    setCaseCursorHistory([""]);
    setCaseBatchIndex(0);
    setCaseLocalPage(1);
  }, [open, suite]);

  useEffect(() => {
    if (!open || !suite || (suite.member_summaries?.length ?? 0) >= suite.members.length) {
      setLoadingMembers(false);
      return;
    }
    let active = true;
    setLoadingMembers(true);
    void getEvalSuite(networkId, suite.suite_id, suite.version)
      .then((detail) => {
        if (active) setMemberCases(suiteMemberCases(detail));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, open, suite]);

  useEffect(() => {
    if (!open || !caseSelectorOpen) return;
    let active = true;
    setLoadingCases(true);
    setCaseOptions([]);
    setCaseTotal(0);
    const timer = window.setTimeout(
      () => {
        void listEvalCases(
          networkId,
          caseQuery,
          caseCursorHistory[caseBatchIndex] || undefined,
          "enabled",
          {
            name: resourceFilter.name || undefined,
            type: resourceFilter.type === "all" ? undefined : resourceFilter.type,
          },
        )
          .then((page) => {
            if (active) {
              setCaseOptions(page.entries);
              setCandidateCases((current) => {
                const next = { ...current };
                for (const item of page.entries) {
                  next[item.id] = item;
                }
                return next;
              });
              setCaseTotal(page.total);
              setCaseNextCursor(page.next_cursor);
            }
          })
          .catch(() => {
            if (active) setCaseOptions([]);
          })
          .finally(() => {
            if (active) setLoadingCases(false);
          });
      },
      caseQuery ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    networkId,
    open,
    caseSelectorOpen,
    caseQuery,
    caseCursorHistory,
    caseBatchIndex,
    resourceFilter,
  ]);

  const visibleCases = useMemo(
    () => caseOptions.slice((caseLocalPage - 1) * casePageSize, caseLocalPage * casePageSize),
    [caseOptions, caseLocalPage],
  );
  const currentCasePage = caseBatchIndex * casePagesPerBatch + caseLocalPage;
  const memberSet = useMemo(() => new Set(members), [members]);
  const selectedCases = useMemo(() => {
    const query = memberQuery.trim().toLocaleLowerCase();
    return members
      .map((caseId) => memberCases[caseId] ?? unavailableMember(caseId))
      .filter(
        (item) =>
          !query ||
          item.title.toLocaleLowerCase().includes(query) ||
          item.id.toLocaleLowerCase().includes(query),
      );
  }, [memberCases, memberQuery, members]);

  const openCaseSelector = () => {
    setPendingMembers([]);
    setCandidateCases({});
    setCaseQuery("");
    setCaseCursorHistory([""]);
    setCaseBatchIndex(0);
    setCaseLocalPage(1);
    setResourceFilter({ type: "all", name: "" });
    setResourcePage(1);
    setResourceSummary(null);
    setCaseSelectorOpen(true);
  };

  const addPendingMembers = () => {
    if (!pendingMembers.length) return;
    setMembers((current) => [...current, ...pendingMembers.filter((id) => !current.includes(id))]);
    setMemberCases((current) => {
      const next = { ...current };
      for (const caseId of pendingMembers) {
        next[caseId] = candidateCases[caseId] ?? unavailableMember(caseId);
      }
      return next;
    });
    setCaseSelectorOpen(false);
  };

  const removeMember = (caseId: string) => {
    setMembers((current) => current.filter((id) => id !== caseId));
  };

  const changeCasePage = (page: number) => {
    const targetBatch = Math.floor((page - 1) / casePagesPerBatch);
    const targetLocalPage = ((page - 1) % casePagesPerBatch) + 1;
    if (targetBatch < caseCursorHistory.length) {
      setCaseBatchIndex(targetBatch);
      setCaseLocalPage(targetLocalPage);
      return;
    }
    if (targetBatch === caseCursorHistory.length && caseNextCursor) {
      setCaseCursorHistory((history) => [...history, caseNextCursor]);
      setCaseBatchIndex(targetBatch);
      setCaseLocalPage(targetLocalPage);
    }
  };

  const save = async () => {
    const nextName = name.trim();
    const nextDescription = description.trim();
    if (!nextName) {
      message.error(workspaceUi("enterATestSuiteName"));
      return;
    }
    if (!members.length) {
      message.error(workspaceUi("selectAtLeastOneCase"));
      return;
    }
    const nextTags = tags.map((tag) => tag.trim()).filter(Boolean);
    if (
      nextTags.length > 10 ||
      new Set(nextTags).size !== nextTags.length ||
      nextTags.some((tag) => Array.from(tag).length > 32)
    ) {
      message.error(workspaceUi("addUpToUniqueTagsEachNoLongerThan"));
      return;
    }
    setBusy(true);
    try {
      const target = suite
        ? await replaceEvalSuite(networkId, suite, nextName, nextDescription, nextTags, members)
        : await createEvalSuite(networkId, nextName, nextDescription, nextTags, members);
      message.success(suite ? workspaceUi("testSuiteUpdated") : workspaceUi("testSuiteCreated"));
      onSaved(target);
    } catch (error) {
      message.error(suiteError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={
        caseSelectorOpen
          ? workspaceUi("addCases")
          : suite
            ? workspaceUi("editTestSuite")
            : workspaceUi("createTestSuite")
      }
      open={open}
      width={caseSelectorOpen ? "min(1200px, 96vw)" : "min(960px, 96vw)"}
      onClose={() => (caseSelectorOpen ? setCaseSelectorOpen(false) : onClose())}
      styles={{ body: { display: "flex", padding: 20, overflow: "hidden" } }}
      footer={
        caseSelectorOpen ? (
          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setCaseSelectorOpen(false)}>
              {workspaceUi("knowledgeNetwork.eval.m0.cancel")}
            </Button>
            <Button type="primary" disabled={!pendingMembers.length} onClick={addPendingMembers}>
              {workspaceUi("add")} {pendingMembers.length}{" "}
              {workspaceUi("cases", { count: pendingMembers.length })}
            </Button>
          </Space>
        ) : (
          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>{workspaceUi("knowledgeNetwork.eval.m0.cancel")}</Button>
            <Button type="primary" loading={busy} onClick={() => void save()}>
              {workspaceUi("confirm")}
            </Button>
          </Space>
        )
      }
    >
      {caseSelectorOpen ? (
        <div className={styles.selectorWorkspace}>
          <EvalCaseResourceSidebar
            className={styles.selectorResources}
            countHelp={workspaceUi("enabledCasesAssociatedWithThisResourceIncludingCasesAlready")}
            filter={resourceFilter}
            summary={resourceSummary}
            loading={resourceLoading}
            error={resourceError}
            page={resourcePage}
            onChange={(filter) => {
              if (filter.type !== resourceFilter.type) setResourcePage(1);
              setResourceFilter(filter);
              setCaseCursorHistory([""]);
              setCaseBatchIndex(0);
              setCaseLocalPage(1);
            }}
            onPageChange={setResourcePage}
            onRetry={() => setResourceRetry((value) => value + 1)}
          />
          <div className={styles.selectorBody}>
            <div className={styles.selectorToolbar}>
              <Input.Search
                className={styles.selectorSearch}
                aria-label={workspaceUi("searchCasesToAdd")}
                placeholder={workspaceUi("searchCasesEvaluationTargetsOrIDs")}
                allowClear
                value={caseQuery}
                onChange={(event) => {
                  setCaseQuery(event.target.value);
                  setCaseCursorHistory([""]);
                  setCaseBatchIndex(0);
                  setCaseLocalPage(1);
                }}
              />
              <Typography.Text type="secondary">
                {workspaceUi("toAdd")} {pendingMembers.length}{" "}
                {workspaceUi("cases", { count: pendingMembers.length })}
              </Typography.Text>
            </div>
            <div className={styles.selectorTable}>
              <Table<EvalCaseSummary>
                size="small"
                scroll={{ x: 700, y: "min(48vh, 460px)" }}
                rowKey="id"
                loading={loadingCases}
                dataSource={visibleCases}
                pagination={false}
                locale={{
                  emptyText: caseQuery
                    ? workspaceUi("noMatchingCasesAvailableToAdd")
                    : workspaceUi("noCasesAvailableToAdd"),
                }}
                rowSelection={{
                  selectedRowKeys: [...members, ...pendingMembers],
                  preserveSelectedRowKeys: true,
                  getCheckboxProps: (item) => ({
                    disabled: loadingCases || memberSet.has(item.id),
                    name: memberSet.has(item.id)
                      ? workspaceUi("caseAlreadyAdded", { value0: item.title })
                      : workspaceUi("selectCase", { value0: item.title }),
                    "aria-label": memberSet.has(item.id)
                      ? workspaceUi("caseAlreadyAdded", { value0: item.title })
                      : workspaceUi("selectCase", { value0: item.title }),
                  }),
                  onChange: (keys) =>
                    setPendingMembers(keys.map(String).filter((id) => !memberSet.has(id))),
                }}
                columns={[
                  {
                    title: evalTerm("caseName"),
                    dataIndex: "title",
                    ellipsis: true,
                  },
                  {
                    title: evalTerm("assessmentTarget"),
                    width: 220,
                    ellipsis: true,
                    render: (_: unknown, item) => caseTargetLabel(item),
                  },
                  {
                    title: workspaceUi("knowledgeNetwork.eval.filterUi.resourceType"),
                    width: 120,
                    render: (_: unknown, item) => caseResourceTypeLabel(item),
                  },
                  {
                    title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.enabled"),
                    width: 90,
                    render: (_: unknown, item) =>
                      memberSet.has(item.id) ? workspaceUi("added") : workspaceUi("availableToAdd"),
                  },
                ]}
              />
            </div>
            {caseTotal > casePageSize && (
              <TablePaginationBar
                aria-label={workspaceUi("availableCasePagination")}
                current={currentCasePage}
                pageSize={casePageSize}
                total={caseTotal}
                showLessItems
                showSizeChanger={false}
                onChange={changeCasePage}
              />
            )}
          </div>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.metadata}>
            <label className={styles.field}>
              <Typography.Text strong>
                {workspaceUi("knowledgeNetwork.eval.materialsUi.fields.suite_name")}
              </Typography.Text>
              <Input
                aria-label={workspaceUi("knowledgeNetwork.eval.materialsUi.fields.suite_name")}
                placeholder={workspaceUi("forExampleSupplyChainCoreRegressionTests")}
                value={name}
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className={`${styles.field} ${styles.tagsField}`}>
              <div className={styles.fieldLabel}>
                <Typography.Text strong>
                  {workspaceUi("knowledgeNetwork.eval.templateUi.columns.dimension")}
                </Typography.Text>
                <Tooltip
                  title={
                    <>
                      <div>{t("knowledgeNetwork.eval.suiteUi.tagLimit")}</div>
                      <div>{t("knowledgeNetwork.eval.suiteUi.regressionHint")}</div>
                    </>
                  }
                >
                  <button
                    type="button"
                    className={styles.tagHelp}
                    aria-label={t("knowledgeNetwork.eval.suiteUi.tagHelp")}
                  >
                    <InfoCircleOutlined />
                  </button>
                </Tooltip>
              </div>
              <Select
                aria-label={workspaceUi("knowledgeNetwork.eval.templateUi.columns.dimension")}
                mode="tags"
                options={[
                  {
                    value: REGRESSION_SUITE_TAG,
                    label: t("knowledgeNetwork.eval.suiteUi.regressionTag"),
                  },
                ]}
                placeholder={t("knowledgeNetwork.eval.suiteUi.tagPlaceholder")}
                suffixIcon={null}
                maxTagCount="responsive"
                maxTagTextLength={12}
                value={tags}
                tokenSeparators={[",", "，"]}
                className={styles.tags}
                onChange={setTags}
              />
            </div>
            <label className={styles.descriptionField}>
              <Typography.Text strong>{workspaceUi("description")}</Typography.Text>
              <div className={styles.descriptionControl}>
                <Input.TextArea
                  aria-label={workspaceUi("testSuiteDescription")}
                  placeholder={workspaceUi("describeTheScenariosProcessesOrRisksThisTestSuite")}
                  value={description}
                  maxLength={1000}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <Typography.Text
                  type="secondary"
                  className={styles.descriptionCount}
                  aria-label={t("knowledgeNetwork.eval.suiteUi.descriptionCount")}
                >
                  {description.length} / 1000
                </Typography.Text>
              </div>
            </label>
          </div>
          <section
            className={styles.membersSection}
            aria-label={t("knowledgeNetwork.eval.suiteUi.selectedMembersLabel")}
          >
            <div className={styles.caseToolbar}>
              <Typography.Title level={5} className={styles.selectionHeading}>
                {t("knowledgeNetwork.eval.suiteUi.selectedMembers", { count: members.length })}
              </Typography.Title>
              <div className={styles.selectedActions}>
                <Input.Search
                  className={styles.search}
                  aria-label={workspaceUi("searchSelectedCases")}
                  placeholder={workspaceUi("searchSelectedCasesOrCaseIDs")}
                  allowClear
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={openCaseSelector}>
                  {workspaceUi("addCases")}
                </Button>
              </div>
            </div>
            <div className={styles.tableArea}>
              <Table<EvalCaseSummary>
                size="small"
                sticky
                scroll={{ x: 560 }}
                rowKey="id"
                loading={loadingMembers}
                dataSource={selectedCases}
                pagination={{
                  pageSize: casePageSize,
                  showSizeChanger: false,
                  hideOnSinglePage: true,
                }}
                locale={{
                  emptyText: memberQuery
                    ? workspaceUi("noMatchingSelectedCases")
                    : workspaceUi("thisTestSuiteHasNoCasesYetAddCases"),
                }}
                columns={[
                  {
                    title: evalTerm("caseName"),
                    dataIndex: "title",
                    ellipsis: true,
                  },
                  {
                    title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.actions"),
                    width: 104,
                    render: (_: unknown, item) => (
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={workspaceUi("removeCase", { value0: item.title })}
                        onClick={() => removeMember(item.id)}
                      >
                        {workspaceUi("knowledgeNetwork.eval.caseEditor.remove")}
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
