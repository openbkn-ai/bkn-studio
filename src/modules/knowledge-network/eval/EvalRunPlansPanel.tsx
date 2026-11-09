/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";
import { definitionText } from "./eval-definition-view";
import { evalTerm } from "./eval-terminology";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { EllipsisOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildAuthorizationRequestURL } from "@/framework/auth/oauth";
import { authorizeInOAuthPopup, reserveOAuthPopup } from "@/framework/auth/oauth-popup";
import { getAppCallbackPath } from "@/app/router/app-paths";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { useEvalFeedback } from "./useEvalFeedback";
import {
  beginEvalRunPlanAuthorization,
  completeEvalRunPlanAuthorization,
  createEvalRunPlan,
  deleteEvalRunPlan,
  listEvalRunPlans,
  listEvalSuiteVersions,
  previewM1RunSelection,
  type M1RunPreview,
  listEvalSuites,
  runEvalRunPlanNow,
  setEvalRunPlanEnabled,
  updateEvalRunPlan,
  type EvalRunPlan,
  type EvalRunPlanMutation,
  type EvalSuiteVersion,
  type M0Run,
} from "./m0-run.service";
import styles from "./EvalWorkspaceScene.module.css";

type Props = {
  networkId: string;
  available: boolean;
  canManage: boolean;
  automaticAvailable?: boolean;
  onCountChange: (count: number | undefined) => void;
  onRunCreated: (run: M0Run) => void;
};

type PlanFormValues = {
  name: string;
  suite_id: string;
  version_policy: "fixed" | "latest";
  suite_version?: number;
  schedule_kind: "daily" | "weekly" | "monthly";
  weekday?: number;
  day_of_month?: number;
  time_of_day: string;
  timezone: string;
  enabled: boolean;
};

const pageSize = 20;
const weekdayOptions = () => [
  {
    get label() {
      return workspaceUi("monday");
    },
    value: 1,
  },
  {
    get label() {
      return workspaceUi("tuesday");
    },
    value: 2,
  },
  {
    get label() {
      return workspaceUi("wednesday");
    },
    value: 3,
  },
  {
    get label() {
      return workspaceUi("thursday");
    },
    value: 4,
  },
  {
    get label() {
      return workspaceUi("friday");
    },
    value: 5,
  },
  {
    get label() {
      return workspaceUi("saturday");
    },
    value: 6,
  },
  {
    get label() {
      return workspaceUi("sunday");
    },
    value: 7,
  },
];

const monthDayOptions = () =>
  Array.from({ length: 31 }, (_, index) => ({
    label: workspaceUi("day", { value0: index + 1 }),
    value: index + 1,
  }));

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
const timezoneOptions = [
  ...new Set([
    defaultTimezone,
    "UTC",
    "Asia/Shanghai",
    ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []),
  ]),
]
  .sort()
  .map((value) => ({
    label: value,
    value,
  }));

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "—");

const scheduleText = (plan: EvalRunPlan) => {
  const time = `${plan.schedule.time_of_day}（${plan.schedule.timezone}）`;
  if (plan.schedule.kind === "weekly") {
    const weekday = weekdayOptions().find((item) => item.value === plan.schedule.weekday)?.label;
    return workspaceUi("everyAt", { value0: weekday ?? workspaceUi("weekLabel"), value1: time });
  }
  if (plan.schedule.kind === "monthly")
    return workspaceUi("everyMonthOnDayAt", {
      value0: plan.schedule.day_of_month ?? "—",
      value1: time,
    });
  return workspaceUi("everyDayAt", { value0: time });
};

const lastStatusText = (status?: EvalRunPlan["last_status"]) => {
  if (status === "submitted") return workspaceUi("submitted");
  if (status === "skipped") return workspaceUi("skipped");
  if (status === "failed") return evalTerm("executionFailed");
  if (status === "completed") return evalTerm("completed");
  if (status === "queued") return evalTerm("queued");
  if (status === "running") return evalTerm("running");
  if (status === "cancelled") return evalTerm("cancelled");
  return workspaceUi("notYetExecuted");
};

export function EvalRunPlansPanel({
  networkId,
  available,
  canManage,
  automaticAvailable = false,
  onCountChange,
  onRunCreated,
}: Props) {
  const { t } = useEvalTranslation();
  const { message, modal } = useEvalFeedback();
  const [form] = Form.useForm<PlanFormValues>();
  const scheduleKind = Form.useWatch("schedule_kind", form);
  const versionPolicy = Form.useWatch("version_policy", form);
  const suiteId = Form.useWatch("suite_id", form);
  const [plans, setPlans] = useState<EvalRunPlan[]>([]);
  const [publishedSuites, setPublishedSuites] = useState<EvalSuiteVersion[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [optionsError, setOptionsError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "enabled" | "paused">("all");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "daily" | "weekly" | "monthly">(
    "all",
  );
  const [versionFilter, setVersionFilter] = useState<"all" | "fixed" | "latest">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionPlanId, setActionPlanId] = useState<string>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EvalRunPlan>();
  const loadRequest = useRef(0);

  useEffect(() => {
    if (query.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    if (!available) {
      setPlans([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const planPage = await listEvalRunPlans(networkId, page, {
        q: search || undefined,
        state: stateFilter === "all" ? undefined : stateFilter,
        schedule_kind: scheduleFilter === "all" ? undefined : scheduleFilter,
        version_policy: versionFilter === "all" ? undefined : versionFilter,
      });
      if (request !== loadRequest.current) return;
      setPlans(planPage.entries);
      setTotal(planPage.total);
      onCountChange(planPage.total_all ?? planPage.total);
    } catch {
      if (request === loadRequest.current) {
        setError(workspaceUi("cannotLoadRunPlansTryAgainLater"));
        onCountChange(undefined);
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [
    available,
    networkId,
    onCountChange,
    page,
    search,
    stateFilter,
    scheduleFilter,
    versionFilter,
  ]);

  useEffect(() => {
    void load();
    return () => {
      loadRequest.current += 1;
    };
  }, [load, revision]);

  useEffect(() => {
    if (!drawerOpen || !available) return;
    let active = true;
    setOptionsLoading(true);
    setOptionsLoaded(false);
    setPublishedSuites([]);
    setOptionsError("");
    void (async () => {
      const versions: EvalSuiteVersion[] = [];
      const visited = new Set<string>();
      for (let page = 1; ; page += 1) {
        const suitePage = await listEvalSuites(networkId, page);
        if (!active) return;
        const suites = suitePage.entries.filter((suite) => {
          if (visited.has(suite.suite_id)) return false;
          visited.add(suite.suite_id);
          return true;
        });
        for (let offset = 0; offset < suites.length; offset += 4) {
          const batch = await Promise.all(
            suites
              .slice(offset, offset + 4)
              .map((suite) => listEvalSuiteVersions(networkId, suite.suite_id)),
          );
          if (!active) return;
          versions.push(...batch.flat());
        }
        if (suitePage.page !== page || suitePage.limit < 1)
          throw new Error("Invalid Suite pagination");
        if (page * suitePage.limit >= suitePage.total) break;
        if (suitePage.entries.length === 0) throw new Error("Incomplete Suite page");
      }
      if (active) {
        setPublishedSuites(
          versions.filter((suite) => suite.status === "published" && suite.members.length > 0),
        );
        setOptionsLoaded(true);
      }
    })()
      .catch(() => {
        if (active) setOptionsError(workspaceUi("cannotLoadPublishedTestSuitesTryAgain"));
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [available, drawerOpen, networkId, optionsRevision]);

  const selectedVersion = Form.useWatch("suite_version", form);
  const autoEnabled = Form.useWatch("enabled", form);
  const [eligibility, setEligibility] = useState<M1RunPreview>();
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState("");
  useEffect(() => {
    setEligibility(undefined);
    setEligibilityError("");
    if (!drawerOpen || !optionsLoaded || !suiteId || !automaticAvailable || !autoEnabled) {
      setEligibilityLoading(false);
      return;
    }
    const version =
      versionPolicy === "fixed"
        ? selectedVersion
        : Math.max(
            0,
            ...publishedSuites
              .filter((item) => item.suite_id === suiteId)
              .map((item) => item.version),
          );
    if (!version) {
      setEligibilityLoading(false);
      return;
    }
    let active = true;
    setEligibilityLoading(true);
    void previewM1RunSelection(
      networkId,
      { kind: "suite", suite_id: suiteId, version },
      "scheduled",
    )
      .then((result) => {
        if (active) setEligibility(result);
      })
      .catch(() => {
        if (active)
          setEligibilityError(
            workspaceUi("cannotCheckScheduledExecutionRequirementsRefreshAndTryAgain"),
          );
      })
      .finally(() => {
        if (active) setEligibilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    drawerOpen,
    optionsLoaded,
    suiteId,
    automaticAvailable,
    autoEnabled,
    selectedVersion,
    versionPolicy,
    publishedSuites,
    networkId,
  ]);

  const suiteOptions = useMemo(() => {
    const bySuite = new Map<string, EvalSuiteVersion>();
    publishedSuites.forEach((suite) => {
      const current = bySuite.get(suite.suite_id);
      if (!current || suite.version > current.version) bySuite.set(suite.suite_id, suite);
    });
    return [...bySuite.values()].map((suite) => ({ label: suite.name, value: suite.suite_id }));
  }, [publishedSuites]);

  const versionOptions = useMemo(
    () =>
      publishedSuites
        .filter((suite) => suite.suite_id === suiteId)
        .sort((left, right) => right.version - left.version)
        .map((suite) => ({ label: `v${suite.version}`, value: suite.version })),
    [publishedSuites, suiteId],
  );

  const openCreate = () => {
    setOptionsLoaded(false);
    setOptionsError("");
    setPublishedSuites([]);
    setEditingPlan(undefined);
    form.setFieldsValue({
      name: "",
      suite_id: undefined,
      version_policy: "latest",
      suite_version: undefined,
      schedule_kind: "daily",
      weekday: undefined,
      day_of_month: undefined,
      time_of_day: "09:00",
      timezone: defaultTimezone,
      enabled: automaticAvailable,
    });
    setDrawerOpen(true);
  };

  const openEdit = (plan: EvalRunPlan) => {
    setOptionsLoaded(false);
    setOptionsError("");
    setPublishedSuites([]);
    setEditingPlan(plan);
    form.setFieldsValue({
      name: plan.name,
      suite_id: plan.suite_id,
      version_policy: plan.version_policy,
      suite_version: plan.suite_version,
      schedule_kind: plan.schedule.kind,
      weekday: plan.schedule.weekday,
      day_of_month: plan.schedule.day_of_month,
      time_of_day: plan.schedule.time_of_day,
      timezone: plan.schedule.timezone,
      enabled: automaticAvailable && plan.enabled,
    });
    setDrawerOpen(true);
  };

  const authorizePlan = async (plan: EvalRunPlan, popup?: Window) => {
    const response = await authorizeInOAuthPopup(async () => {
      const start = await beginEvalRunPlanAuthorization(
        networkId,
        plan.id,
        `${window.location.origin}${getAppCallbackPath()}`,
      );
      return {
        state: start.state,
        url: buildAuthorizationRequestURL(start.code_challenge, start.state),
      };
    }, popup);
    await completeEvalRunPlanAuthorization(networkId, plan.id, response);
  };

  const save = async () => {
    if (!optionsLoaded || optionsLoading || optionsError || !publishedSuites.length) return;
    const values = await form.validateFields();
    if (automaticAvailable && values.enabled && (eligibilityLoading || !eligibility?.eligible))
      return;
    const mutation: EvalRunPlanMutation = {
      name: values.name.trim(),
      suite_id: values.suite_id,
      version_policy: values.version_policy,
      suite_version: values.version_policy === "fixed" ? values.suite_version : undefined,
      schedule: {
        kind: values.schedule_kind,
        time_of_day: values.time_of_day,
        weekday: values.schedule_kind === "weekly" ? values.weekday : undefined,
        day_of_month: values.schedule_kind === "monthly" ? values.day_of_month : undefined,
        timezone: values.timezone,
      },
      overlap_policy: "skip",
      enabled: false,
      revision: editingPlan?.revision,
    };
    let popup: Window | undefined;
    setSaving(true);
    try {
      if (automaticAvailable && values.enabled) popup = reserveOAuthPopup();
      const saved = editingPlan
        ? await updateEvalRunPlan(networkId, editingPlan.id, mutation)
        : await createEvalRunPlan(networkId, mutation);
      // Keep the saved paused plan after cancellation; retries must not create
      // duplicate plans or silently share the browser login credential.
      setEditingPlan(saved);
      if (automaticAvailable && values.enabled) {
        await authorizePlan(saved, popup);
        await setEvalRunPlanEnabled(networkId, saved, true);
      }
      message.success(editingPlan ? workspaceUi("runPlanUpdated") : workspaceUi("runPlanCreated"));
      setDrawerOpen(false);
      setRevision((value) => value + 1);
    } catch {
      message.error(workspaceUi("thePlanIsNotEnabledSavedPausedPlansAre"));
      setRevision((value) => value + 1);
    } finally {
      popup?.close();
      setSaving(false);
    }
  };

  const togglePlan = async (plan: EvalRunPlan) => {
    setActionPlanId(plan.id);
    try {
      if (!plan.enabled) await authorizePlan(plan);
      await setEvalRunPlanEnabled(networkId, plan, !plan.enabled);
      message.success(
        plan.enabled ? workspaceUi("runPlanDisabled") : workspaceUi("runPlanEnabled"),
      );
      setRevision((value) => value + 1);
    } catch {
      message.error(workspaceUi("thePlanStateWasNotUpdatedEnsureItsCreator"));
    } finally {
      setActionPlanId(undefined);
    }
  };

  const runNow = async (plan: EvalRunPlan) => {
    setActionPlanId(plan.id);
    try {
      const run = await runEvalRunPlanNow(networkId, plan.id);
      message.success(workspaceUi("runSubmitted"));
      onRunCreated(run);
      setRevision((value) => value + 1);
    } catch {
      message.error(workspaceUi("cannotStartTheRunCheckExecutionPermissionsAndThe"));
    } finally {
      setActionPlanId(undefined);
    }
  };

  const removePlan = (plan: EvalRunPlan) => {
    modal.confirm({
      title: workspaceUi("deleteRunPlan", { value0: plan.name }),
      content: workspaceUi("aDeletedPlanCannotBeRestoredExistingRunRecords"),
      okText: workspaceUi("knowledgeNetwork.eval.caseBatch.delete"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteEvalRunPlan(networkId, plan);
        message.success(workspaceUi("runPlanDeleted"));
        if (plans.length === 1 && page > 1) setPage((value) => value - 1);
        else setRevision((value) => value + 1);
      },
    });
  };

  const createAction = (
    <Button type="primary" disabled={!available || !canManage} onClick={openCreate}>
      {workspaceUi("create")}
    </Button>
  );
  const filters = (
    <div className={styles.runPlanFilters}>
      <label className={`${styles.runFilterField} ${styles.runFilterKeyword}`}>
        <Input.Search
          aria-label={workspaceUi("searchRunPlans")}
          placeholder={workspaceUi("searchPlanNamesTestSuitesOrIDs")}
          allowClear
          maxLength={128}
          disabled={!available}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={(value) => {
            setSearch(value.trim());
            setPage(1);
          }}
        />
      </label>
      <label className={styles.runFilterField}>
        <span>{workspaceUi("planState")}</span>
        <Select
          aria-label={workspaceUi("filterPlanState")}
          disabled={!available}
          value={stateFilter}
          onChange={(value) => {
            setStateFilter(value);
            setPage(1);
          }}
          options={[
            {
              value: "all",
              label: workspaceUi("knowledgeNetwork.eval.templateUi.filters.allStates"),
            },
            {
              value: "enabled",
              label: automaticAvailable
                ? evalTerm("enabled")
                : t("knowledgeNetwork.eval.runPlansUi.automaticBlocked"),
            },
            { value: "paused", label: evalTerm("inactive") },
          ]}
        />
      </label>
      <label className={styles.runFilterField}>
        <span>{workspaceUi("schedule")}</span>
        <Select
          aria-label={workspaceUi("filterSchedule")}
          disabled={!available}
          value={scheduleFilter}
          onChange={(value) => {
            setScheduleFilter(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: workspaceUi("allSchedules") },
            { value: "daily", label: workspaceUi("daily") },
            { value: "weekly", label: workspaceUi("weekly") },
            { value: "monthly", label: workspaceUi("monthly") },
          ]}
        />
      </label>
      <label className={styles.runFilterField}>
        <span>{workspaceUi("versionPolicy")}</span>
        <Select
          aria-label={workspaceUi("filterVersionPolicy")}
          disabled={!available}
          value={versionFilter}
          onChange={(value) => {
            setVersionFilter(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: workspaceUi("allVersionPolicies") },
            { value: "latest", label: workspaceUi("latestPublishedVersion") },
            { value: "fixed", label: workspaceUi("fixedPublishedVersion") },
          ]}
        />
      </label>
      <Space className={styles.runFilterActions}>
        {(query ||
          stateFilter !== "all" ||
          scheduleFilter !== "all" ||
          versionFilter !== "all") && (
          <Button
            type="link"
            className={styles.runFilterClear}
            onClick={() => {
              setQuery("");
              setSearch("");
              setStateFilter("all");
              setScheduleFilter("all");
              setVersionFilter("all");
              setPage(1);
            }}
          >
            {workspaceUi("knowledgeNetwork.eval.suiteUi.clearFilters")}
          </Button>
        )}
        <Button
          aria-label={workspaceUi("refreshRunPlans")}
          title={workspaceUi("refreshRunPlans")}
          icon={<ReloadOutlined aria-hidden />}
          disabled={!available}
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        />
        {createAction}
      </Space>
    </div>
  );

  if (!available) {
    return (
      <section className={styles.runPlanSection} aria-label={workspaceUi("runPlans")}>
        {filters}
        <Alert
          className={styles.runPlanUnavailable}
          type="info"
          showIcon
          message={workspaceUi("theRunPlanServiceIsNotEnabled")}
          description={workspaceUi("askAnAdministratorToConfigureTheRunPlanService")}
        />
      </section>
    );
  }

  return (
    <section className={styles.runPlanSection} aria-label={workspaceUi("runPlans")}>
      {filters}
      {!automaticAvailable && (
        <Alert
          showIcon
          type="info"
          message={t("knowledgeNetwork.eval.access.delegationUnavailable")}
        />
      )}
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
      <Table<EvalRunPlan>
        className={styles.runPlanTable}
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={plans}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={
                search ||
                stateFilter !== "all" ||
                scheduleFilter !== "all" ||
                versionFilter !== "all"
                  ? workspaceUi("noMatchingRunPlans")
                  : workspaceUi("noRunPlans")
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        columns={[
          {
            title: workspaceUi("planName"),
            dataIndex: "name",
            width: 210,
            ellipsis: true,
            render: (name: string, plan) => (
              <button
                type="button"
                className={styles.suiteNameButton}
                title={name}
                onClick={() => openEdit(plan)}
              >
                <strong>{name}</strong>
              </button>
            ),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.actions"),
            width: 64,
            align: "center",
            render: (_: unknown, plan) => (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    {
                      key: "run",
                      label: workspaceUi("run"),
                      icon: <PlayCircleOutlined />,
                      disabled: actionPlanId === plan.id,
                      onClick: () => void runNow(plan),
                    },
                    {
                      key: "edit",
                      label: workspaceUi("edit"),
                      disabled: !canManage,
                      onClick: () => openEdit(plan),
                    },
                    {
                      key: "state",
                      label: plan.enabled
                        ? workspaceUi("knowledgeNetwork.eval.templateUi.disabled")
                        : workspaceUi("knowledgeNetwork.eval.templateUi.enabled"),
                      disabled:
                        !canManage ||
                        actionPlanId === plan.id ||
                        (!automaticAvailable && !plan.enabled),
                      onClick: () => void togglePlan(plan),
                    },
                    {
                      key: "delete",
                      label: workspaceUi("knowledgeNetwork.eval.caseBatch.delete"),
                      danger: true,
                      disabled: !canManage || plan.enabled,
                      onClick: () => removePlan(plan),
                    },
                  ],
                }}
              >
                <Button
                  type="text"
                  size="small"
                  loading={actionPlanId === plan.id}
                  icon={<EllipsisOutlined />}
                  aria-label={workspaceUi("runPlanActions", { value0: plan.name })}
                />
              </Dropdown>
            ),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.externalUi.suite"),
            dataIndex: "suite_name",
            width: 160,
            ellipsis: true,
          },
          {
            title: workspaceUi("version"),
            width: 148,
            ellipsis: true,
            render: (_: unknown, plan) =>
              plan.version_policy === "latest"
                ? workspaceUi("useTheLatestPublishedVersionEachTime")
                : workspaceUi("fixedV", { value0: plan.suite_version }),
          },
          {
            title: workspaceUi("schedule"),
            width: 256,
            ellipsis: true,
            render: (_: unknown, plan) => scheduleText(plan),
          },
          {
            title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.enabled"),
            width: 128,
            render: (_: unknown, plan) =>
              plan.enabled && !automaticAvailable ? (
                <Tooltip title={t("knowledgeNetwork.eval.access.delegationUnavailable")}>
                  <Tag color="warning">
                    {t("knowledgeNetwork.eval.runPlansUi.automaticBlocked")}
                  </Tag>
                </Tooltip>
              ) : plan.enabled ? (
                <Tag color="success">{evalTerm("enabled")}</Tag>
              ) : (
                <Tag>{evalTerm("inactive")}</Tag>
              ),
          },
          {
            title: workspaceUi("nextRun"),
            width: 184,
            ellipsis: true,
            render: (_: unknown, plan) =>
              plan.enabled && automaticAvailable ? formatDateTime(plan.next_run_at) : "—",
          },
          {
            title: workspaceUi("lastTrigger"),
            width: 184,
            ellipsis: true,
            render: (_: unknown, plan) => (
              <Space direction="vertical" size={0}>
                <span>{lastStatusText(plan.last_status)}</span>
                {plan.last_error_message && (
                  <Tooltip title={plan.last_error_code}>
                    <small style={{ color: "var(--ant-color-error)" }}>
                      {plan.last_error_message}
                    </small>
                  </Tooltip>
                )}
                <small
                  className={styles.runPlanSecondary}
                  title={formatDateTime(plan.last_triggered_at)}
                >
                  {formatDateTime(plan.last_triggered_at)}
                </small>
              </Space>
            ),
          },
        ]}
        scroll={{ x: 1296 }}
      />
      <div className={styles.suitePagination}>
        {total > pageSize ? (
          <TablePaginationBar
            aria-label={workspaceUi("runPlanPagination")}
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
      <Drawer
        className={styles.runPlanDrawer}
        title={editingPlan ? workspaceUi("editRunPlan") : workspaceUi("createRunPlan")}
        width={960}
        open={drawerOpen}
        destroyOnClose
        onClose={() => setDrawerOpen(false)}
        footer={
          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setDrawerOpen(false)}>
              {workspaceUi("knowledgeNetwork.eval.m0.cancel")}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={
                !optionsLoaded ||
                optionsLoading ||
                Boolean(optionsError) ||
                !suiteOptions.length ||
                (automaticAvailable &&
                  Boolean(autoEnabled) &&
                  Boolean(suiteId) &&
                  (eligibilityLoading || !eligibility?.eligible))
              }
              onClick={() => void save()}
            >
              {workspaceUi("confirm")}
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph className={styles.runPlanFormHint} type="secondary">
          {automaticAvailable
            ? workspaceUi("automaticRunsUseThePlanCreatorSCurrentPermissions")
            : t("knowledgeNetwork.eval.access.delegationUnavailable")}
        </Typography.Paragraph>
        {optionsError && (
          <Alert
            type="error"
            showIcon
            message={optionsError}
            action={
              <Button onClick={() => setOptionsRevision((value) => value + 1)}>
                {workspaceUi("knowledgeNetwork.eval.suiteCaseUi.retry")}
              </Button>
            }
          />
        )}
        {optionsLoaded && !optionsLoading && !optionsError && !publishedSuites.length && (
          <Alert
            showIcon
            type="warning"
            message={workspaceUi("noPublishedTestSuiteContainsCasesPublishATest")}
          />
        )}
        {eligibilityLoading && (
          <Alert type="info" message={workspaceUi("checkingScheduledExecutionRequirements")} />
        )}
        {eligibilityError && <Alert type="error" message={eligibilityError} />}
        {eligibility && (
          <Alert
            type={eligibility.eligible ? "info" : "warning"}
            message={
              eligibility.eligible
                ? workspaceUi("automaticExecutionPreflightPassedRunsWillUseThePlan")
                : eligibility.reasons.join("；")
            }
          />
        )}
        <Form<PlanFormValues> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label={workspaceUi("planName")}
            rules={[
              { required: true, whitespace: true, message: workspaceUi("enterAPlanName") },
              {
                validator: (_, value: string) =>
                  Array.from(value ?? "").length <= 128
                    ? Promise.resolve()
                    : Promise.reject(new Error(workspaceUi("planNamesCanContainUpToCharacters"))),
              },
            ]}
          >
            <Input placeholder={workspaceUi("forExampleDailyStandardLeadTimeRegression")} />
          </Form.Item>
          <Form.Item
            name="suite_id"
            label={workspaceUi("knowledgeNetwork.eval.externalUi.suite")}
            rules={[{ required: true, message: workspaceUi("selectATestSuite") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={optionsLoading}
              placeholder={workspaceUi("selectAPublishedTestSuite")}
              options={suiteOptions}
              onChange={() => form.setFieldValue("suite_version", undefined)}
            />
          </Form.Item>
          <div className={styles.runPlanFormGrid}>
            <Form.Item
              name="version_policy"
              label={workspaceUi("versionPolicy")}
              extra={definitionText("membershipVersion")}
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: workspaceUi("useTheLatestPublishedVersionForEachRun"), value: "latest" },
                  { label: workspaceUi("fixedPublishedVersion"), value: "fixed" },
                ]}
              />
            </Form.Item>
            {versionPolicy === "fixed" && (
              <Form.Item
                name="suite_version"
                label={workspaceUi("knowledgeNetwork.eval.externalUi.version")}
                rules={[{ required: true, message: workspaceUi("selectAPublishedVersion") }]}
              >
                <Select placeholder={workspaceUi("selectAVersion")} options={versionOptions} />
              </Form.Item>
            )}
          </div>
          <div className={styles.runPlanFormGrid}>
            <Form.Item
              name="schedule_kind"
              label={workspaceUi("schedule")}
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: workspaceUi("daily"), value: "daily" },
                  { label: workspaceUi("weekly"), value: "weekly" },
                  { label: workspaceUi("monthly"), value: "monthly" },
                ]}
              />
            </Form.Item>
            {scheduleKind === "weekly" && (
              <Form.Item
                name="weekday"
                label={workspaceUi("weekday")}
                rules={[{ required: true, message: workspaceUi("selectAWeekday") }]}
              >
                <Select options={weekdayOptions()} />
              </Form.Item>
            )}
            {scheduleKind === "monthly" && (
              <Form.Item
                name="day_of_month"
                label={workspaceUi("dayOfMonth")}
                rules={[{ required: true, message: workspaceUi("selectADayOfMonth") }]}
                extra={workspaceUi("ifTheMonthDoesNotContainTheSelectedDay")}
              >
                <Select placeholder={workspaceUi("selectADate")} options={monthDayOptions()} />
              </Form.Item>
            )}
          </div>
          <div className={styles.runPlanFormGrid}>
            <Form.Item
              name="time_of_day"
              label={workspaceUi("executionTime")}
              rules={[{ required: true, message: workspaceUi("selectAnExecutionTime") }]}
            >
              <Input type="time" />
            </Form.Item>
            <Form.Item name="timezone" label={workspaceUi("timeZone")} rules={[{ required: true }]}>
              <Select showSearch options={timezoneOptions} />
            </Form.Item>
          </div>
          <Form.Item name="enabled" label={workspaceUi("stateAfterSaving")} valuePropName="checked">
            <Switch
              disabled={!automaticAvailable}
              checkedChildren={workspaceUi("knowledgeNetwork.eval.templateUi.enabled")}
              unCheckedChildren={workspaceUi("knowledgeNetwork.eval.templateUi.disabled")}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </section>
  );
}
