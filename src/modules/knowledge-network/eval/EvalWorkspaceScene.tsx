/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel, readableEvalText } from "./eval-readable-references";
import {
  readRunDetail,
  writeRunDetail,
  readRunListFilters,
  writeRunListFilters,
  type RunDetailLocation,
  type RunListFilters,
} from "./eval-run-navigation";
import { evalTerm } from "./eval-terminology";
import {
  caseResultFilters,
  defaultCaseFilters,
  readCaseFilters,
  writeCaseFilters,
  type EvalCaseFilters,
  type CaseResultFilter,
} from "./eval-case-navigation";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  DownOutlined,
  EllipsisOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { EvalCaseResourceSidebar } from "./EvalCaseResourceSidebar";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";
import { useEvalFeedback } from "./useEvalFeedback";
import {
  applyEvalCaseBatch,
  type CaseBatchAction,
  type CaseBatchResult,
} from "./case-batch.service";
import { EvalMultiRunPanel } from "./EvalMultiRunPanel";
import { EvalAgentComparisonWorkspace } from "./EvalAgentComparisonWorkspace";
import { EvalRunComparisonPanel } from "./EvalRunComparisonDrawer";
import { EvalCaseEditorDrawer } from "./EvalCaseEditorDrawer";
import { EvalSuiteCaseDetailDrawer } from "./EvalSuiteCaseDetailDrawer";
import { EvalRuleApplicationDrawer } from "./EvalRuleApplicationDrawer";
import type { RuleApplicationSeed } from "./rule-application.service";
import { EvalSuitePanel } from "./EvalSuitePanel";
import { EvalTemplatePanel } from "./EvalTemplatePanel";
import { EvalAssistantDrawer } from "./EvalTemplateGenerationDrawer";
import { EvalAssistantResizeHandle } from "./EvalAssistantResizeHandle";
import { EvalOverviewExecutionSummary } from "./EvalOverviewExecutionSummary";
import { EvalOverviewResourcesPanel } from "./EvalOverviewResourcesPanel";
import { buildRunRepairRequest, type EvalRepairRequest } from "./eval-repair.service";
import { EvalOverviewScopeDrawer } from "./EvalOverviewScopeDrawer";
import { EvalRunPlansPanel } from "./EvalRunPlansPanel";
import { caseCanConfigureObjectCheck, caseExecutionSetupLabel } from "./eval-case-execution";
import {
  CASE_LIST_BATCH_SIZE,
  getEvalOverview,
  getEvalTemplateConfig,
  getEvalCapabilities,
  getEvalRunPlanCount,
  listEvalCases,
  listEvalCaseResourceSummary,
  listEvalSuites,
  listM0Runs,
  searchM0Runs,
  getM1RunCapabilities,
  previewM1RunSelection,
  createM1Run,
  setEvalCaseEnabled,
  removeEvalCase,
  type EvalCasePage,
  type EvalCaseResource,
  type EvalCaseResourceSummaryPage,
  type EvalCaseSummary,
  type EvalCaseLatestResult,
  type EvalTemplateConfig,
  type EvalOverview,
  type M0Run,
  type M0RunSearchPage,
  type M0CaseDetail,
} from "./m0-run.service";
import type { EvalTab } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";
import styles from "./EvalWorkspaceScene.module.css";

type Props = {
  networkId: string;
  activeTab: EvalTab;
  onTabChange: (tab: EvalTab, filters?: Partial<EvalCaseFilters>) => void;
};

const unscopedCaseLabel = () => workspaceUi("noSingleResourceSpecified");
const caseTablePageSize = 10;

type ResourceTypeFilter =
  | "all"
  | "objectType"
  | "relationType"
  | "action"
  | "metric"
  | "function"
  | "api"
  | "mcp"
  | "skill"
  | "scenario";
type OverviewResourceFilter =
  "all" | "in_scope" | "excluded" | "covered" | "evaluated" | "passed" | "problem";
type OverviewResourceDetail = NonNullable<EvalOverview["resource_details"]>[number];

const overviewResourcePath = (networkId: string, resource: OverviewResourceDetail) => {
  const workspace = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;
  const id = encodeURIComponent(resource.id);
  const capabilityID = encodeURIComponent(resource.capability_id ?? resource.id);
  const boxID = resource.box_id ? encodeURIComponent(resource.box_id) : "";

  switch (caseResourceCanonicalKind(resource.kind)) {
    case "objectType":
      return `${workspace}/object-types/${id}/detail`;
    case "relationType":
      return `${workspace}/relation-types/${id}/detail`;
    case "action":
      return `${workspace}/action-types/${id}/detail`;
    case "metric":
      return `${workspace}/metrics/${id}/detail`;
    case "function":
      return boxID
        ? `/execution-factory/toolboxes/${boxID}/tools?toolId=${capabilityID}`
        : `${workspace}/functions`;
    case "api":
      return boxID
        ? `/execution-factory/toolboxes/${boxID}/tools/${capabilityID}/edit`
        : `${workspace}/apis`;
    case "mcp":
      return boxID ? `/execution-factory/mcp/${boxID}` : `${workspace}/mcp`;
    case "skill":
      return `/execution-factory/skills/${capabilityID}`;
    default:
      return workspace;
  }
};

const caseTargets = (entry: EvalCaseSummary) =>
  [entry.execution_spec?.target, ...(entry.execution_spec?.related_targets ?? [])].filter(
    (target): target is NonNullable<typeof target> => Boolean(target?.name),
  );

const caseResourceSummary = (entry: EvalCaseSummary) => {
  if (entry.execution_spec?.target_kind === "business_scenario") return "—";
  const names = caseTargets(entry).map((target) => target.name!);
  if (names.length) return names.join("、");
  return unscopedCaseLabel();
};

const caseSourceLabel = (entry: EvalCaseSummary) => {
  if (entry.source_type === "imported_sample") {
    return entry.source_case_id
      ? workspaceUi("sampleImport", { value0: entry.source_case_id })
      : workspaceUi("knowledgeNetwork.eval.definitionUi.imported_sample");
  }
  if (entry.source_type === "manual")
    return workspaceUi("knowledgeNetwork.eval.definitionUi.manual");
  if (entry.source_type === "template")
    return workspaceUi("knowledgeNetwork.eval.definitionUi.template");
  return workspaceUi("knowledgeNetwork.eval.definitionUi.unknownSource");
};

const caseTemplateRuleLabel = (entry: EvalCaseSummary, rules?: EvalTemplateConfig["rules"]) => {
  const currentTitle = rules?.find((rule) => rule.id === entry.template_rule_id)?.title;
  const title =
    entry.template_rule_title ||
    (currentTitle ? workspaceUi("currentName", { value0: currentTitle }) : entry.template_rule_id);
  if (!title) return "—";
  return entry.source_type === "manual"
    ? workspaceUi("referenceAtCreation", { value0: title })
    : title;
};

const caseResourceTypeLabels: Record<string, string> = {
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
const caseResourceTypeLabel = (kind?: string) =>
  caseResourceTypeLabels[kind ?? ""] ??
  kind ??
  workspaceUi("knowledgeNetwork.eval.ruleApplication.resource");
const caseResourceTypeSummary = (entry: EvalCaseSummary) => {
  if (entry.execution_spec?.target_kind === "business_scenario") return "—";
  const kinds = [entry.execution_spec?.target, ...(entry.execution_spec?.related_targets ?? [])]
    .map((target) => target?.capability_type)
    .filter((kind): kind is string => Boolean(kind));
  const labels = [...new Set(kinds.map(caseResourceTypeLabel))];
  if (labels.length) return labels.join("、");
  return "—";
};
const caseIsRunnable = (entry: EvalCaseSummary) =>
  entry.enabled && entry.execution_setup === "ready_for_preflight";
const caseResourceCanonicalKind = (kind?: string) =>
  ({
    object_type: "objectType",
    relation_type: "relationType",
    action_type: "action",
    object_metric: "metric",
    mcp_tool: "mcp",
  })[kind ?? ""] ?? kind;

const runDateBoundary = (value: string, nextDay = false) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
};

export function EvalWorkspaceScene({ networkId, activeTab, onTabChange }: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { message, modal } = useEvalFeedback();
  const { t } = useEvalTranslation();
  const overviewResourceFilterLabels: Record<OverviewResourceFilter, string> = {
    all: workspaceUi("knowledgeNetwork.eval.resourceOverview.all"),
    in_scope: workspaceUi("knowledgeNetwork.eval.caseNavigation.participating"),
    excluded: workspaceUi("knowledgeNetwork.eval.ruleApplication.excluded"),
    covered: workspaceUi("casesAvailable"),
    evaluated: workspaceUi("completeResultsAvailable"),
    passed: workspaceUi("knowledgeNetwork.eval.agentCompare.differenceOptions.all_pass"),
    problem: workspaceUi("knowledgeNetwork.eval.resourceOverview.problem"),
  };

  const overviewResourceStatusMeta: Record<
    OverviewResourceDetail["status"],
    { label: string; color?: string }
  > = {
    excluded: { label: workspaceUi("knowledgeNetwork.eval.ruleApplication.excluded") },
    uncovered: { label: workspaceUi("noCases") },
    not_run: { label: workspaceUi("notYetRun") },
    in_progress: { label: evalTerm("running"), color: "processing" },
    partially_evaluated: { label: workspaceUi("partialResults"), color: "warning" },
    passed: {
      label: workspaceUi("knowledgeNetwork.eval.agentCompare.differenceOptions.all_pass"),
      color: "success",
    },
    problem: {
      label: workspaceUi("knowledgeNetwork.eval.resourceOverview.problem"),
      color: "error",
    },
    review: {
      label: workspaceUi("knowledgeNetwork.eval.resourceOverview.review"),
      color: "warning",
    },
  };

  const caseResultFilterLabels: Record<CaseResultFilter, string> = {
    all: workspaceUi("knowledgeNetwork.eval.caseNavigation.allCases"),
    evaluated: workspaceUi("evaluationResultsAvailable"),
    no_result: workspaceUi("knowledgeNetwork.eval.overviewSummary.noResult"),
    declaration: workspaceUi("declarationChecksOnly"),
    passed: evalTerm("passed"),
    failed: evalTerm("notPassed"),
    inconclusive: evalTerm("inconclusive"),
    review_required: evalTerm("humanJudgment"),
    declaration_passed: workspaceUi("knowledgeNetwork.eval.resultUi.declarationPassed"),
    declaration_problem: workspaceUi("declarationCheckError"),
    execution_failed: evalTerm("executionFailed"),
    in_progress: evalTerm("running"),
    cancelled: evalTerm("cancelled"),
    not_run: workspaceUi("notYetRun"),
  };

  const caseResultStatusMeta: Record<
    EvalCaseLatestResult["status"],
    { label: string; color?: string }
  > = {
    not_run: { label: workspaceUi("notYetRun") },
    in_progress: { label: evalTerm("running"), color: "processing" },
    cancelled: { label: evalTerm("cancelled") },
    execution_failed: { label: evalTerm("executionFailed"), color: "error" },
    passed: { label: evalTerm("passed"), color: "success" },
    failed: { label: evalTerm("notPassed"), color: "error" },
    inconclusive: { label: evalTerm("inconclusive"), color: "warning" },
    review_required: { label: evalTerm("humanJudgment"), color: "warning" },
    declaration_passed: {
      label: workspaceUi("knowledgeNetwork.eval.resultUi.declarationPassed"),
      color: "success",
    },
    declaration_problem: { label: workspaceUi("declarationCheckError"), color: "warning" },
  };
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceTab = activeTab;
  const linkedRunDetail = useMemo(() => readRunDetail(location.search), [location.search]);
  const linkedRunDetailKey = JSON.stringify(linkedRunDetail);
  const linkedRunFilters = useMemo(() => readRunListFilters(location.search), [location.search]);
  const linkedRunFiltersKey = JSON.stringify(linkedRunFilters);
  useEffect(() => {
    if (workspaceTab === "overview")
      setOverviewView(
        new URLSearchParams(location.search).get("overview_view") === "execution"
          ? "execution"
          : "resources",
      );
  }, [workspaceTab, location.search]);
  const runStatusLabel = (status: M0Run["execution_status"]) =>
    t(`knowledgeNetwork.eval.m0.statusValue.${status}`);
  const outcomeLabel = (outcome: NonNullable<M0Run["quality_outcome"]>) =>
    t(`knowledgeNetwork.eval.m0.outcomeValue.${outcome}`);
  const [runs, setRuns] = useState<M0Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [overview, setOverview] = useState<EvalOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [overviewScopeOpen, setOverviewScopeOpen] = useState(false);
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [overviewView, setOverviewView] = useState<"resources" | "execution">(
    new URLSearchParams(location.search).get("overview_view") === "execution"
      ? "execution"
      : "resources",
  );
  const [overviewResourceDetail, setOverviewResourceDetail] = useState<{
    kind: string;
    filter: OverviewResourceFilter;
  }>();
  const [overviewResourceProblemFocus, setOverviewResourceProblemFocus] = useState(0);
  const [runList, setRunList] = useState<M0RunSearchPage | null>(null);
  const [runListLoading, setRunListLoading] = useState(true);
  const [runListError, setRunListError] = useState("");
  const [runSearch, setRunSearch] = useState(linkedRunFilters.search);
  const [runStatusFilter, setRunStatusFilter] = useState<M0Run["execution_status"] | "all">(
    linkedRunFilters.status,
  );
  const [runOutcomeFilter, setRunOutcomeFilter] = useState<
    NonNullable<M0Run["quality_outcome"]> | "all"
  >(linkedRunFilters.outcome);
  const [runDateFrom, setRunDateFrom] = useState(linkedRunFilters.from);
  const [runDateTo, setRunDateTo] = useState(linkedRunFilters.to);
  const [runListPage, setRunListPage] = useState(linkedRunFilters.page);
  const [runListRevision, setRunListRevision] = useState(0);
  const [recentRunsRevision, setRecentRunsRevision] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null | undefined>(
    linkedRunDetail.runId,
  );
  const [runDetailOpen, setRunDetailOpen] = useState(Boolean(linkedRunDetail.runId));
  const [selectedCaseOutcome, setSelectedCaseOutcome] = useState<
    NonNullable<M0Run["quality_outcome"]> | "all"
  >(linkedRunDetail.outcome ?? "all");
  const [linkedCaseRunId, setLinkedCaseRunId] = useState<string | undefined>(
    linkedRunDetail.caseRunId,
  );
  const [linkedDetailTab, setLinkedDetailTab] = useState<"result" | "evidence">(
    linkedRunDetail.tab ?? "result",
  );
  const [inspectedRun, setInspectedRun] = useState<M0Run>();
  const [runningCaseId, setRunningCaseId] = useState<string>();
  const [selectedCases, setSelectedCases] = useState<Record<string, EvalCaseSummary>>({});
  const [batchRunLoading, setBatchRunLoading] = useState(false);
  const [batchCaseAction, setBatchCaseAction] = useState<CaseBatchAction>();
  const [batchCaseResult, setBatchCaseResult] = useState<{
    action: CaseBatchAction;
    entries: CaseBatchResult[];
  }>();
  const batchCaseContext = useRef({ revision: 0, busy: false });
  useEffect(() => {
    const context = batchCaseContext.current;
    context.revision++;
    context.busy = false;
    setSelectedCases({});
    setBatchCaseAction(undefined);
    setBatchCaseResult(undefined);
    return () => {
      context.revision++;
    };
  }, [networkId]);
  const [runComparisonOpen, setRunComparisonOpen] = useState(Boolean(linkedRunDetail.comparison));
  const [agentComparisonOpen, setAgentComparisonOpen] = useState(false);
  const [retestComparison, setRetestComparison] = useState<{
    candidateId: string;
    baselineId: string;
  }>();
  const linkedCaseFilters = useMemo(() => readCaseFilters(location.search), [location.search]);
  const linkedCaseFilterKey = JSON.stringify(linkedCaseFilters);
  const [caseSearch, setCaseSearch] = useState(linkedCaseFilters.search);
  const [caseResultFilter, setCaseResultFilter] = useState<CaseResultFilter>(
    linkedCaseFilters.result,
  );
  const [caseParticipation, setCaseParticipation] = useState<EvalCaseFilters["participation"]>(
    linkedCaseFilters.participation,
  );
  const [caseStateFilter, setCaseStateFilter] = useState<"all" | "disabled" | "enabled">(
    linkedCaseFilters.status,
  );
  const [externalAgentAvailable, setExternalAgentAvailable] = useState(false);
  const [canManageCases, setCanManageCases] = useState(false);
  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [caseEditorOpen, setCaseEditorOpen] = useState(false);
  const [caseInitialResource, setCaseInitialResource] = useState<EvalCaseResource>();
  const [ruleApplication, setRuleApplication] = useState<RuleApplicationSeed>();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [repairRequest, setRepairRequest] = useState<EvalRepairRequest>();
  const repairNavigation = useRef(0);
  useEffect(
    () => () => {
      repairNavigation.current += 1;
    },
    [networkId],
  );
  const repairSource = useRef("");
  repairSource.current = `${networkId}:${selectedRunId}:${linkedCaseRunId ?? ""}:${workspaceTab}:${runDetailOpen}`;
  const openRunRepair = async (run: M0Run, detail: M0CaseDetail) => {
    const requestId = ++repairNavigation.current;
    const source = repairSource.current;
    const currentOverview = await getEvalOverview(networkId);
    if (requestId !== repairNavigation.current || source !== repairSource.current) return;
    const request = buildRunRepairRequest(networkId, run, detail, currentOverview, canManageCases);
    setRepairRequest(request);
    setRunComparisonOpen(false);
    setAssistantOpen(true);
  };

  useEffect(() => {
    setRepairRequest(undefined);
  }, [networkId]);
  const [assistantRuns, setAssistantRuns] = useState<M0RunSearchPage | null>(null);
  const [caseWorkspaceTab, setCaseWorkspaceTab] = useState<"library" | "suites">(
    linkedCaseFilters.view,
  );
  const [runWorkspaceTab, setRunWorkspaceTab] = useState<"records" | "plans">("records");
  const [suiteCount, setSuiteCount] = useState<number | null>(null);
  const [runPlansCapability, setRunPlansCapability] = useState<{
    networkId: string;
    status: "loading" | "available" | "unavailable" | "failed";
  }>({ networkId, status: "loading" });
  const runPlanCapabilityStatus =
    runPlansCapability.networkId === networkId ? runPlansCapability.status : "loading";
  const runPlansAvailable = runPlanCapabilityStatus === "available";
  const [runPlanSummary, setRunPlanSummary] = useState<{
    networkId: string;
    status: "loading" | "ready" | "failed" | "unavailable";
    count?: number;
  }>({ networkId, status: "loading" });
  const [runPlanCountRetry, setRunPlanCountRetry] = useState(0);
  const [runPlansCapabilityRetry, setRunPlansCapabilityRetry] = useState(0);
  const runPlanCountRequest = useRef(0);
  const onRunPlanCountChange = useCallback(
    (count: number | undefined) => {
      runPlanCountRequest.current += 1;
      setRunPlanSummary({ networkId, status: count === undefined ? "failed" : "ready", count });
    },
    [networkId],
  );
  useEffect(() => {
    const request = ++runPlanCountRequest.current;
    if (workspaceTab !== "runs") return;
    if (runPlanCapabilityStatus !== "available") {
      setRunPlanSummary({
        networkId,
        status:
          runPlanCapabilityStatus === "loading"
            ? "loading"
            : runPlanCapabilityStatus === "failed"
              ? "failed"
              : "unavailable",
      });
      return;
    }
    const controller = new AbortController();
    setRunPlanSummary({ networkId, status: "loading" });
    void getEvalRunPlanCount(networkId, controller.signal)
      .then((count) => {
        if (request === runPlanCountRequest.current)
          setRunPlanSummary({ networkId, status: "ready", count });
      })
      .catch(() => {
        if (request === runPlanCountRequest.current && !controller.signal.aborted)
          setRunPlanSummary({ networkId, status: "failed" });
      });
    return () => {
      runPlanCountRequest.current += 1;
      controller.abort();
    };
  }, [networkId, workspaceTab, runPlanCapabilityStatus, runPlanCountRetry]);
  const runPlanCountStatus =
    runPlanSummary.networkId === networkId ? runPlanSummary.status : "loading";
  const runPlanCountLabel =
    runPlanCountStatus === "ready"
      ? runPlanSummary.count
      : t(`knowledgeNetwork.eval.runPlansUi.count_${runPlanCountStatus}`);
  const [canManageRunPlans, setCanManageRunPlans] = useState(false);
  const [automaticRunPlans, setAutomaticRunPlans] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string>();
  const [editingCaseSourceType, setEditingCaseSourceType] = useState<string>();
  const [editingCaseEnabled, setEditingCaseEnabled] = useState(true);
  const [caseListRevision, setCaseListRevision] = useState(0);
  const [casePage, setCasePage] = useState<EvalCasePage | null>(null);
  const [caseResources, setCaseResources] = useState<EvalCaseResourceSummaryPage | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState(false);
  const [resourceRetry, setResourceRetry] = useState(0);
  const [allCaseCount, setAllCaseCount] = useState<number | null>(null);
  const [caseCursor, setCaseCursor] = useState<string>();
  const [caseCursorHistory, setCaseCursorHistory] = useState<(string | undefined)[]>([]);
  const [caseLocalPage, setCaseLocalPage] = useState(1);
  const [caseNavigating, setCaseNavigating] = useState(false);
  const caseNavigationRequest = useRef(0);
  const [resourcePage, setResourcePage] = useState(1);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseError, setCaseError] = useState("");
  const [selectedCase, setSelectedCase] = useState<EvalCaseSummary>();
  const [resourceSearch, setResourceSearch] = useState(linkedCaseFilters.resource);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceTypeFilter>(
    linkedCaseFilters.resourceType,
  );
  const resourceTypeForPaging = useRef(resourceTypeFilter);
  const [caseDetailOpen, setCaseDetailOpen] = useState(false);
  const [template, setTemplate] = useState<EvalTemplateConfig | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");
  const caseLibraryActive = workspaceTab === "cases" && caseWorkspaceTab === "library";
  const recentRunsActive = workspaceTab === "overview";
  const caseQuery = caseSearch.trim();
  const resourceFilter = useMemo(
    () => ({
      name: resourceSearch.trim() || undefined,
      type: resourceTypeFilter === "all" ? undefined : resourceTypeFilter,
    }),
    [resourceSearch, resourceTypeFilter],
  );
  const hasResourceFilter = Boolean(resourceFilter.name || resourceFilter.type);

  const openCaseEditor = (caseId?: string, sourceType?: string, enabled = true) => {
    setCaseInitialResource(undefined);
    setEditingCaseId(caseId);
    setEditingCaseSourceType(sourceType);
    setEditingCaseEnabled(enabled);
    setCaseEditorOpen(true);
  };

  const editCase = (entry: EvalCaseSummary) => {
    openCaseEditor(entry.id, entry.source_type, entry.enabled);
  };

  const confirmCaseRemoval = (entry: EvalCaseSummary) => {
    modal.confirm({
      title: workspaceUi("delete", { value0: entry.title }),
      content: workspaceUi("theCaseWillBeRemovedFromThisListExisting"),
      okText: workspaceUi("knowledgeNetwork.eval.caseBatch.delete"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeEvalCase(networkId, entry.id, "delete");
          message.success(workspaceUi("caseDeleted"));
          setCaseListRevision((revision) => revision + 1);
        } catch (cause) {
          message.error(
            axios.isAxiosError(cause) && cause.response?.status === 409
              ? workspaceUi("thisCaseIsProtectedOrItsStateHasChanged")
              : workspaceUi("operationFailedCheckPermissionsOrRefreshAndTryAgain"),
          );
        }
      },
    });
  };

  const changeCaseEnabled = (entry: EvalCaseSummary) => {
    const enabled = !entry.enabled;
    const action = async () => {
      try {
        await setEvalCaseEnabled(networkId, entry.id, enabled);
        message.success(enabled ? workspaceUi("caseEnabled") : workspaceUi("caseDisabled"));
        setCaseListRevision((revision) => revision + 1);
      } catch {
        message.error(
          enabled
            ? workspaceUi("cannotEnableTheCaseCheckItsConfigurationOrRefresh")
            : workspaceUi("cannotDisableTheCaseRefreshAndTryAgain"),
        );
      }
    };
    if (!enabled) {
      modal.confirm({
        title: workspaceUi("disable", { value0: entry.title }),
        content: workspaceUi("newRunsAndTestSuitesWillNoLongerBe"),
        okText: workspaceUi("knowledgeNetwork.eval.templateUi.disabled"),
        cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
        onOk: action,
      });
    } else {
      void action();
    }
  };

  const runCaseBatchAction = async (action: CaseBatchAction, entries: EvalCaseSummary[]) => {
    if (!canManageCases || batchCaseContext.current.busy || !entries.length) return;
    batchCaseContext.current.busy = true;
    const serial = ++batchCaseContext.current.revision;
    setBatchCaseAction(action);
    setBatchCaseResult(undefined);
    try {
      const results = await applyEvalCaseBatch(networkId, entries, action);
      if (serial !== batchCaseContext.current.revision) return;
      setBatchCaseResult({ action, entries: results });
      const succeeded = new Set(results.filter((item) => item.success).map((item) => item.id));
      setSelectedCases((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !succeeded.has(id))),
      );
      if (succeeded.size) setCaseListRevision((revision) => revision + 1);
    } catch {
      if (serial === batchCaseContext.current.revision)
        setBatchCaseResult({
          action,
          entries: entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            success: false,
            error: "unavailable",
          })),
        });
    } finally {
      if (serial === batchCaseContext.current.revision) {
        batchCaseContext.current.busy = false;
        setBatchCaseAction(undefined);
      }
    }
  };
  const deleteSelectedCases = () => {
    const entries = Object.values(selectedCases);
    if (!canManageCases || !entries.length || batchCaseContext.current.busy) return;
    const serial = batchCaseContext.current.revision;
    modal.confirm({
      title: t("knowledgeNetwork.eval.caseBatch.deleteTitle", { count: entries.length }),
      content: t("knowledgeNetwork.eval.caseBatch.deleteDescription"),
      okText: t("knowledgeNetwork.eval.caseBatch.delete"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      okButtonProps: { danger: true },
      onOk: () =>
        serial === batchCaseContext.current.revision
          ? runCaseBatchAction("delete", entries)
          : undefined,
    });
  };
  const selectionIsRunnable =
    Object.keys(selectedCases).length > 0 && Object.values(selectedCases).every(caseIsRunnable);

  const runCaseDirectly = async (entry: EvalCaseSummary) => {
    if (!caseIsRunnable(entry)) {
      message.error(workspaceUi("thisCaseCannotCurrentlyRunRefreshAndTryAgain"));
      return;
    }
    const scope = {
      kind: "cases" as const,
      case_ids: [entry.id],
    };
    setRunningCaseId(entry.id);
    try {
      if (!(await getM1RunCapabilities(networkId))) {
        message.error(workspaceUi("theExecutionServiceIsNotReadyThisCaseCannot"));
        return;
      }
      const preview = await previewM1RunSelection(networkId, scope);
      if (preview.case_count !== 1) {
        message.error(workspaceUi("thisCaseHasChangedRefreshTheListAndTry"));
        return;
      }
    } catch {
      message.error(workspaceUi("thisCaseDoesNotMeetExecutionRequirementsCheckIts"));
      return;
    } finally {
      setRunningCaseId(undefined);
    }
    modal.confirm({
      title: workspaceUi("confirmRunNamedCase", { value0: entry.title }),
      content: workspaceUi("theCurrentCaseDefinitionWillBeExecutedAndIts"),
      okText: workspaceUi("run"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      onOk: async () => {
        setRunningCaseId(entry.id);
        try {
          const run = await createM1Run(networkId, scope, crypto.randomUUID());
          message.success(workspaceUi("runSubmitted"));
          showRun(run);
          void refreshRuns();
        } catch (error) {
          message.error(workspaceUi("runFailedCheckExecutionPermissionsOrRefreshAndTry"));
          throw error;
        } finally {
          setRunningCaseId(undefined);
        }
      },
    });
  };

  const runSelectedCases = async () => {
    const entries = Object.values(selectedCases);
    if (!entries.length) return;
    if (entries.some((entry) => !caseIsRunnable(entry))) {
      message.error(workspaceUi("theSelectedCasesHaveChangedRefreshTheListAnd"));
      return;
    }
    const scope = {
      kind: "cases" as const,
      case_ids: entries.map((entry) => entry.id),
    };
    setBatchRunLoading(true);
    try {
      if (!(await getM1RunCapabilities(networkId))) {
        message.error(workspaceUi("theExecutionServiceIsNotReadyTheSelectedCases"));
        return;
      }
      const preview = await previewM1RunSelection(networkId, scope);
      if (preview.case_count !== entries.length) {
        message.error(workspaceUi("someCasesHaveChangedRefreshTheListAndSelect"));
        return;
      }
    } catch {
      message.error(workspaceUi("someCasesDoNotMeetExecutionRequirementsCheckTheir"));
      return;
    } finally {
      setBatchRunLoading(false);
    }
    modal.confirm({
      title: workspaceUi("runTheseCases", { value0: entries.length }),
      content: workspaceUi("eachCaseWillUseItsCurrentConfigurationResultsAnd"),
      okText: workspaceUi("run"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      onOk: async () => {
        setBatchRunLoading(true);
        try {
          const run = await createM1Run(networkId, scope, crypto.randomUUID());
          message.success(workspaceUi("submittedARunForCases", { value0: entries.length }));
          setSelectedCases({});
          showRun(run);
          void refreshRuns();
        } catch (error) {
          message.error(workspaceUi("couldNotRunTheSelectedCasesCheckExecutionPermissions"));
          throw error;
        } finally {
          setBatchRunLoading(false);
        }
      },
    });
  };

  const rerunCase = async (entry: M0CaseDetail) => {
    if (selectedRun?.runner_type === "external_agent") {
      message.info(t("knowledgeNetwork.eval.resultUi.externalReplayHelp"));
      return;
    }
    if (!selectedRunId) return;
    const baselineId = selectedRunId;
    const scope = {
      kind: "cases" as const,
      case_ids: [entry.case_id],
    };
    try {
      if (!(await getM1RunCapabilities(networkId))) {
        message.error(workspaceUi("rerunServiceNotReady"));
        return;
      }
      const preview = await previewM1RunSelection(networkId, scope);
      if (preview.case_count !== 1) {
        message.error(workspaceUi("thisCaseHasChangedOpenItsCurrentDetailsBefore"));
        return;
      }
    } catch {
      message.error(workspaceUi("thisCaseDoesNotMeetExecutionRequirementsCheckIts"));
      return;
    }
    modal.confirm({
      title: workspaceUi("confirmRerunNamedCase", { value0: entry.case_title }),
      content: t("knowledgeNetwork.eval.resultUi.platformRerunHelp"),
      okText: workspaceUi("rerun"),
      cancelText: workspaceUi("knowledgeNetwork.eval.m0.cancel"),
      onOk: async () => {
        try {
          const run = await createM1Run(networkId, scope, crypto.randomUUID());
          setRetestComparison({ candidateId: run.id, baselineId });
          showRun(run);
          void refreshRuns();
        } catch (error) {
          message.error(workspaceUi("rerunFailedCheckExecutionPermissionsOrRefreshAndTry"));
          throw error;
        }
      },
    });
  };

  useEffect(() => {
    let active = true;
    setCanManageCases(false);
    setCanManageTemplates(false);
    setRunPlansCapability({ networkId, status: "loading" });
    setExternalAgentAvailable(false);
    setCanManageRunPlans(false);
    setAutomaticRunPlans(false);
    void getEvalCapabilities(networkId)
      .then((capabilities) => {
        if (active) {
          setCanManageCases(capabilities.case_management);
          setExternalAgentAvailable(capabilities.external_agent === true);
          setCanManageTemplates(Boolean(capabilities.template_management));
          setRunPlansCapability({
            networkId,
            status: capabilities.run_plans ? "available" : "unavailable",
          });
          setCanManageRunPlans(Boolean(capabilities.run_plan_management));
          setAutomaticRunPlans(capabilities.run_plan_automatic === true);
        }
      })
      .catch(() => {
        if (active) {
          setCanManageCases(false);
          setCanManageTemplates(false);
          setRunPlansCapability({ networkId, status: "failed" });
          setExternalAgentAvailable(false);
          setCanManageRunPlans(false);
          setAutomaticRunPlans(false);
        }
      });
    return () => {
      active = false;
    };
  }, [networkId, runPlansCapabilityRetry]);

  useEffect(() => {
    if (workspaceTab !== "overview" && !caseLibraryActive && !assistantOpen) return;
    let active = true;
    setSuiteCount(null);
    void listEvalSuites(networkId, 1)
      .then((page) => {
        if (active) setSuiteCount(page.total);
      })
      .catch(() => {
        if (active) setSuiteCount(null);
      });
    return () => {
      active = false;
    };
  }, [networkId, workspaceTab, caseLibraryActive, assistantOpen]);

  useEffect(() => {
    setCaseSearch("");
    setCaseStateFilter("all");
    setCaseCursor(undefined);
    setCaseCursorHistory([]);
    setCaseLocalPage(1);
    setAllCaseCount(null);
    setCaseResources(null);
    setResourcePage(1);
    setResourceError(false);
    setResourceSearch("");
    setResourceTypeFilter("all");
    setCaseDetailOpen(false);
    setCaseWorkspaceTab("library");
    setRunWorkspaceTab("records");
    setAgentComparisonOpen(false);
    setInspectedRun(undefined);
  }, [networkId]);

  useEffect(() => {
    const detail = JSON.parse(linkedRunDetailKey) as RunDetailLocation;
    setRunDetailOpen(Boolean(detail.runId));
    setSelectedRunId(detail.runId);
    setLinkedCaseRunId(detail.caseRunId);
    setLinkedDetailTab(detail.tab ?? "result");
    setSelectedCaseOutcome(detail.outcome ?? "all");
    setRunComparisonOpen(Boolean(detail.comparison));
  }, [networkId, linkedRunDetailKey]);
  useEffect(() => {
    const filters = JSON.parse(linkedRunFiltersKey) as RunListFilters;
    setRunSearch(filters.search);
    setRunStatusFilter(filters.status);
    setRunOutcomeFilter(filters.outcome);
    setRunDateFrom(filters.from);
    setRunDateTo(filters.to);
    setRunListPage(filters.page);
  }, [networkId, linkedRunFiltersKey]);

  const refreshRuns = useCallback(() => {
    setRunListRevision((value) => value + 1);
    setRecentRunsRevision((value) => value + 1);
  }, []);

  const currentRunFilters: RunListFilters = {
    search: runSearch,
    status: runStatusFilter,
    outcome: runOutcomeFilter,
    from: runDateFrom,
    to: runDateTo,
    page: runListPage,
  };
  const runDetailActive = workspaceTab === "runs" && runDetailOpen && Boolean(selectedRunId);
  const updateRunFilters = (patch: Partial<RunListFilters>) => {
    const filters = { ...currentRunFilters, ...patch };
    setRunSearch(filters.search);
    setRunStatusFilter(filters.status);
    setRunOutcomeFilter(filters.outcome);
    setRunDateFrom(filters.from);
    setRunDateTo(filters.to);
    setRunListPage(filters.page);
    const params = writeRunListFilters(new URLSearchParams(location.search), filters);
    params.set("tab", "runs");
    void navigate({ pathname: location.pathname, search: `?${params}` }, { replace: true });
  };
  const navigateRunDetail = (detail: RunDetailLocation, replace = false) => {
    setRunDetailOpen(Boolean(detail.runId));
    setSelectedRunId(detail.runId);
    setLinkedCaseRunId(detail.caseRunId);
    setLinkedDetailTab(detail.tab ?? "result");
    setSelectedCaseOutcome(detail.outcome ?? "all");
    setRunComparisonOpen(Boolean(detail.comparison));
    setRunWorkspaceTab("records");
    const params = writeRunDetail(
      writeRunListFilters(new URLSearchParams(location.search), currentRunFilters),
      detail,
    );
    params.set("tab", "runs");
    void navigate(
      { pathname: location.pathname, search: `?${params}` },
      { replace, flushSync: true },
    );
  };
  const showRun = (run: M0Run, detail: Omit<RunDetailLocation, "runId"> = {}) => {
    setInspectedRun(run);
    navigateRunDetail({ runId: run.id, ...detail });
  };
  const closeRunDetail = () => {
    repairNavigation.current++;
    navigateRunDetail({});
  };
  const onRunLoaded = useCallback(
    (run: M0Run) =>
      setInspectedRun((previous) => ({
        ...run,
        case_counts:
          run.case_counts ?? (previous?.id === run.id ? previous.case_counts : undefined),
      })),
    [],
  );
  useEffect(() => {
    if (!runDetailActive || !selectedRunId) return;
    let active = true;
    void searchM0Runs(networkId, { q: selectedRunId, page: 1, limit: 1 })
      .then((page) => {
        const summary = page.entries.find((run) => run.id === selectedRunId);
        if (active && summary)
          setInspectedRun((previous) =>
            previous?.id === selectedRunId
              ? {
                  ...summary,
                  ...previous,
                  case_counts: summary.case_counts ?? previous.case_counts,
                }
              : summary,
          );
      })
      .catch(() => {
        /* Result detail remains available if its catalogue summary cannot be read. */
      });
    return () => {
      active = false;
    };
  }, [networkId, runDetailActive, selectedRunId, runListRevision]);

  useEffect(() => {
    if (!recentRunsActive) return;
    let active = true;
    setRunsLoading(true);
    setRunsError("");
    void listM0Runs(networkId, 5)
      .then((value) => {
        if (active) setRuns(value);
      })
      .catch(() => {
        if (active) setRunsError(workspaceUi("cannotLoadRunRecordsTryAgainLater"));
      })
      .finally(() => {
        if (active) setRunsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, recentRunsActive, recentRunsRevision]);

  useEffect(() => {
    let active = true;
    if (workspaceTab !== "overview" && !caseLibraryActive && !assistantOpen) return;
    setOverviewLoading(true);
    setOverviewError("");
    void getEvalOverview(networkId)
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        if (active) {
          setOverview(null);
          setOverviewError(workspaceUi("cannotLoadTheKnowledgeNetworkOverviewTryAgainLater"));
        }
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    networkId,
    workspaceTab,
    caseLibraryActive,
    caseListRevision,
    runListRevision,
    overviewRevision,
    assistantOpen,
  ]);

  useEffect(() => {
    if (!assistantOpen) {
      setAssistantRuns(null);
      return;
    }
    let active = true;
    void searchM0Runs(networkId, { page: 1, limit: 5 })
      .then((page) => {
        if (active) setAssistantRuns(page);
      })
      .catch(() => {
        if (active) setAssistantRuns(null);
      });
    return () => {
      active = false;
    };
  }, [assistantOpen, networkId, runListRevision, recentRunsRevision]);

  useEffect(() => {
    if (workspaceTab !== "runs" || runWorkspaceTab !== "records") return;
    let active = true;
    setRunListLoading(true);
    setRunListError("");
    if (runDateFrom && runDateTo && runDateFrom > runDateTo) {
      setRunList(null);
      setRunListError(workspaceUi("theEndDateCannotBeEarlierThanTheStart"));
      setRunListLoading(false);
      return;
    }
    const timer = window.setTimeout(
      () => {
        void searchM0Runs(networkId, {
          q: runSearch.trim() || undefined,
          status: runStatusFilter === "all" ? undefined : runStatusFilter,
          outcome: runOutcomeFilter === "all" ? undefined : runOutcomeFilter,
          from: runDateBoundary(runDateFrom),
          to: runDateBoundary(runDateTo, true),
          page: runListPage,
          limit: 20,
        })
          .then((page) => {
            if (active) setRunList(page);
          })
          .catch(() => {
            if (active) {
              setRunList(null);
              setRunListError(workspaceUi("cannotSearchRunRecordsTryAgainLater"));
            }
          })
          .finally(() => {
            if (active) setRunListLoading(false);
          });
      },
      runSearch.trim() ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    workspaceTab,
    runWorkspaceTab,
    networkId,
    runSearch,
    runStatusFilter,
    runOutcomeFilter,
    runDateFrom,
    runDateTo,
    runListPage,
    runListRevision,
  ]);

  useEffect(() => {
    if (!caseLibraryActive) return;
    let active = true;
    const controller = new AbortController();
    setResourceLoading(true);
    setResourceError(false);
    setCaseResources(null);
    void listEvalCaseResourceSummary(
      networkId,
      resourceTypeFilter === "all" ? undefined : resourceTypeFilter,
      resourcePage,
      10,
      controller.signal,
    )
      .then((summary) => {
        if (!active) return;
        setAllCaseCount(summary.case_total);
        const lastPage = Math.max(1, Math.ceil(summary.total / 10));
        if (resourcePage > lastPage) {
          setResourcePage(lastPage);
        } else {
          setCaseResources(summary);
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
  }, [
    networkId,
    caseLibraryActive,
    resourceTypeFilter,
    resourcePage,
    caseListRevision,
    resourceRetry,
  ]);

  useEffect(() => {
    let active = true;
    if (!caseLibraryActive) return;
    setCaseLoading(true);
    setCaseError("");
    const timer = window.setTimeout(
      () => {
        void listEvalCases(
          networkId,
          caseQuery,
          caseCursor,
          caseStateFilter === "all" ? undefined : caseStateFilter,
          ...(hasResourceFilter || caseResultFilter !== "all" || caseParticipation !== "all"
            ? [hasResourceFilter ? resourceFilter : undefined]
            : []),
          ...(caseResultFilter !== "all" || caseParticipation !== "all"
            ? [
                {
                  result: caseResultFilter === "all" ? undefined : caseResultFilter,
                  participation: caseParticipation === "all" ? undefined : caseParticipation,
                },
              ]
            : []),
        )
          .then((page) => {
            if (active) {
              setCasePage(page);
              if (
                !caseQuery &&
                caseStateFilter === "all" &&
                !hasResourceFilter &&
                caseResultFilter === "all" &&
                caseParticipation === "all"
              ) {
                setAllCaseCount(page.total);
              }
            }
          })
          .catch(() => {
            if (active) {
              setCasePage(null);
              setCaseError(workspaceUi("cannotLoadTheCaseListTryAgainLater"));
            }
          })
          .finally(() => {
            if (active) setCaseLoading(false);
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
    caseLibraryActive,
    caseQuery,
    caseCursor,
    caseStateFilter,
    caseResultFilter,
    caseParticipation,
    resourceFilter,
    hasResourceFilter,
    caseListRevision,
  ]);

  useEffect(() => {
    let active = true;
    if (workspaceTab !== "plan" && !caseLibraryActive) return;
    setTemplate(null);
    setTemplateError("");
    setTemplateLoading(true);
    void getEvalTemplateConfig(networkId)
      .then((config) => {
        if (active) setTemplate(config);
      })
      .catch(() => {
        if (active) setTemplateError(workspaceUi("cannotLoadEvaluationRulesTryAgainLater"));
      })
      .finally(() => {
        if (active) setTemplateLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, workspaceTab, caseLibraryActive]);

  const visibleCases = casePage?.entries ?? [];
  const caseBatchPages = Math.max(1, Math.ceil(visibleCases.length / caseTablePageSize));
  const effectiveCaseLocalPage = Math.min(caseLocalPage, caseBatchPages);
  const pagedCases = visibleCases.slice(
    (effectiveCaseLocalPage - 1) * caseTablePageSize,
    effectiveCaseLocalPage * caseTablePageSize,
  );
  const caseGlobalPage =
    caseCursorHistory.length * (CASE_LIST_BATCH_SIZE / caseTablePageSize) + effectiveCaseLocalPage;
  const caseTotalPages = Math.ceil((casePage?.total ?? 0) / caseTablePageSize);
  const navigateToCasePage = async (page: number) => {
    if (!casePage || page < 1 || page > caseTotalPages) return;
    const pagesPerBatch = CASE_LIST_BATCH_SIZE / caseTablePageSize;
    const targetBatch = Math.floor((page - 1) / pagesPerBatch);
    const targetLocalPage = ((page - 1) % pagesPerBatch) + 1;
    const currentBatch = caseCursorHistory.length;
    if (targetBatch === currentBatch) {
      setCaseLocalPage(targetLocalPage);
      return;
    }
    if (targetBatch < currentBatch) {
      setCaseCursor(caseCursorHistory[targetBatch]);
      setCaseCursorHistory(caseCursorHistory.slice(0, targetBatch));
      setCaseLocalPage(targetLocalPage);
      return;
    }
    const request = ++caseNavigationRequest.current;
    setCaseNavigating(true);
    try {
      let cursor = caseCursor;
      let batch = casePage;
      const history = [...caseCursorHistory];
      for (let index = currentBatch; index < targetBatch; index += 1) {
        if (!batch.next_cursor) return;
        history.push(cursor);
        cursor = batch.next_cursor;
        batch = await listEvalCases(
          networkId,
          caseQuery,
          cursor,
          caseStateFilter === "all" ? undefined : caseStateFilter,
          ...(hasResourceFilter || caseResultFilter !== "all" || caseParticipation !== "all"
            ? [hasResourceFilter ? resourceFilter : undefined]
            : []),
          ...(caseResultFilter !== "all" || caseParticipation !== "all"
            ? [
                {
                  result: caseResultFilter === "all" ? undefined : caseResultFilter,
                  participation: caseParticipation === "all" ? undefined : caseParticipation,
                },
              ]
            : []),
        );
        if (request !== caseNavigationRequest.current) return;
      }
      setCaseCursorHistory(history);
      setCaseCursor(cursor);
      setCaseLocalPage(targetLocalPage);
    } catch {
      if (request === caseNavigationRequest.current) {
        setCaseError(workspaceUi("cannotNavigateToTheSelectedPageTryAgain"));
      }
    } finally {
      if (request === caseNavigationRequest.current) setCaseNavigating(false);
    }
  };
  const resourcePageSize = 10;
  const runName = (run: M0Run) =>
    run.scope?.kind === "cases"
      ? workspaceUi("selectedCasesCases", { value0: run.progress.planned_cases })
      : run.suite_name ||
        (run.scope?.suite_id ? evalReferenceLabel("unnamedSuite") : workspaceUi("testSuiteRun"));
  const cachedRun =
    runList?.entries.find((item) => item.id === selectedRunId) ??
    runs.find((item) => item.id === selectedRunId);
  const selectedRun =
    inspectedRun && inspectedRun.id === selectedRunId
      ? {
          ...cachedRun,
          ...inspectedRun,
          case_counts: inspectedRun.case_counts ?? cachedRun?.case_counts,
        }
      : cachedRun;
  const runTime = (run: M0Run) => {
    const raw = run.created_at ?? run.started_at ?? run.finished_at;
    if (!raw) return workspaceUi("timeNotRecorded");
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return workspaceUi("timeNotRecorded");
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const overviewResourceRows = useMemo(() => {
    if (!overviewResourceDetail) return [];
    const rows = (overview?.resource_details ?? []).filter(
      (resource) => resource.kind === overviewResourceDetail.kind,
    );
    switch (overviewResourceDetail.filter) {
      case "in_scope":
        return rows.filter((resource) => resource.in_scope);
      case "excluded":
        return rows.filter((resource) => !resource.in_scope);
      case "covered":
        return rows.filter((resource) => resource.in_scope && resource.case_count > 0);
      case "evaluated":
        return rows.filter(
          (resource) => resource.case_count > 0 && resource.evaluated_cases === resource.case_count,
        );
      case "passed":
        return rows.filter((resource) => resource.status === "passed");
      case "problem":
        return rows.filter((resource) => resource.status === "problem");
      default:
        return rows;
    }
  }, [overview?.resource_details, overviewResourceDetail]);

  const applyCaseFilters = useCallback((filters: EvalCaseFilters) => {
    caseNavigationRequest.current += 1;
    setCaseNavigating(false);
    setCaseWorkspaceTab(filters.view);
    setCaseSearch(filters.search);
    setCaseStateFilter(filters.status);
    setCaseResultFilter(filters.result);
    setCaseParticipation(filters.participation);
    setResourceSearch(filters.resource);
    // Resource paging is independent of the selected resource and Case filters.
    if (resourceTypeForPaging.current !== filters.resourceType) setResourcePage(1);
    resourceTypeForPaging.current = filters.resourceType;
    setResourceTypeFilter(filters.resourceType);
    setCaseCursor(undefined);
    setCaseCursorHistory([]);
    setCaseLocalPage(1);
    setSelectedCases({});
  }, []);
  useEffect(() => {
    applyCaseFilters(JSON.parse(linkedCaseFilterKey) as EvalCaseFilters);
  }, [networkId, linkedCaseFilterKey, applyCaseFilters]);
  const currentCaseFilters: EvalCaseFilters = {
    view: caseWorkspaceTab,
    search: caseSearch,
    status: caseStateFilter,
    result: caseResultFilter,
    participation: caseParticipation,
    resource: resourceSearch,
    resourceType: resourceTypeFilter,
  };
  const updateCaseFilters = (patch: Partial<EvalCaseFilters>, replace = false) => {
    const filters = { ...currentCaseFilters, ...patch };
    applyCaseFilters(filters);
    const params = writeCaseFilters(
      writeRunDetail(new URLSearchParams(location.search), {}),
      filters,
    );
    params.set("tab", "cases");
    void navigate({ pathname: location.pathname, search: `?${params}` }, { replace });
  };
  const openCaseLibrary = (patch: Partial<EvalCaseFilters> = {}) => {
    const filters = { ...defaultCaseFilters, ...patch };
    applyCaseFilters(filters);
    onTabChange("cases", filters);
  };
  const openOverviewCases = (result: CaseResultFilter) =>
    openCaseLibrary({ result, participation: "participating", status: "enabled" });

  const openOverviewResourceDetail = (kind: string, filter: OverviewResourceFilter) => {
    setOverviewResourceDetail({ kind, filter });
  };

  const openOverviewResourceCases = (resource: OverviewResourceDetail) => {
    const canonicalKind = caseResourceCanonicalKind(resource.kind);
    const supportedKinds: ResourceTypeFilter[] = [
      "objectType",
      "relationType",
      "action",
      "metric",
      "function",
      "api",
      "mcp",
      "skill",
    ];
    setOverviewResourceDetail(undefined);
    openCaseLibrary({
      resourceType: supportedKinds.includes(canonicalKind as ResourceTypeFilter)
        ? (canonicalKind as ResourceTypeFilter)
        : "all",
      resource: resource.kind === "scenario" ? "" : resource.name,
      search: resource.kind === "scenario" ? resource.id : "",
    });
  };

  const openOverviewResourceRun = (resource: OverviewResourceDetail) => {
    if (!resource.latest_run_id) return;
    const qualityOutcome = resource.latest_quality_outcome;
    setOverviewResourceDetail(undefined);
    navigateRunDetail({
      runId: resource.latest_run_id,
      outcome:
        qualityOutcome === "pass" ||
        qualityOutcome === "fail" ||
        qualityOutcome === "inconclusive" ||
        qualityOutcome === "review_required"
          ? qualityOutcome
          : "all",
    });
  };

  const overviewCountLink = (
    kind: string,
    filter: OverviewResourceFilter,
    count: number,
    content: string | number = count,
  ) =>
    count > 0 ? (
      <Button
        type="link"
        className={styles.overviewCountLink}
        onClick={() => openOverviewResourceDetail(kind, filter)}
      >
        {content}
      </Button>
    ) : (
      content
    );

  const openRun = (run: M0Run, outcome: "all" | "pass" | "fail" | "inconclusive" = "all") => {
    showRun(run, { outcome });
  };

  // Overview and run history share both the presentation and assessment rules.
  const runColumns: ColumnsType<M0Run> = [
    {
      title: workspaceUi("knowledgeNetwork.eval.externalUi.suite"),
      width: 180,
      render: (_: unknown, run: M0Run) => (
        <Button
          type="link"
          className={styles.caseListLink}
          onClick={(event) => {
            event.stopPropagation();
            openRun(run);
          }}
        >
          <strong>{runName(run)}</strong>
          {run.external_agent && (
            <span>
              {run.external_agent.name}
              {run.external_agent.model ? ` · ${run.external_agent.model}` : ""}
            </span>
          )}
          {run.trigger_type === "scheduled" && (
            <span>{workspaceUi("runPlanAutomaticTrigger")}</span>
          )}
          {run.trigger_type === "plan_manual" && <span>{workspaceUi("runPlanRunNow")}</span>}
        </Button>
      ),
    },
    {
      title: workspaceUi("knowledgeNetwork.eval.materialsUi.fields.created_at"),
      width: 150,
      render: (_: unknown, run: M0Run) => <span className={styles.runTime}>{runTime(run)}</span>,
    },
    {
      title: workspaceUi("knowledgeNetwork.eval.m0.status"),
      width: 90,
      render: (_: unknown, run: M0Run) => <Tag>{runStatusLabel(run.execution_status)}</Tag>,
    },
    {
      title: workspaceUi("knowledgeNetwork.eval.overviewSummary.results"),
      width: 90,
      render: (_: unknown, run: M0Run) =>
        run.execution_status === "completed" && run.quality_outcome
          ? run.assessment_scope === "declaration" && run.quality_outcome === "pass"
            ? workspaceUi("knowledgeNetwork.eval.resultUi.declarationPassed")
            : outcomeLabel(run.quality_outcome)
          : "—",
    },
    {
      title: workspaceUi("totalCases"),
      width: 85,
      render: (_: unknown, run: M0Run) => (
        <Tooltip
          title={
            run.case_counts
              ? workspaceUi("incompleteExecutionErrorsCanceledManualJudgmentRequired", {
                  value0: run.case_counts.pending,
                  value1: run.case_counts.execution_failed,
                  value2: run.case_counts.cancelled,
                  value3: run.case_counts.review_required,
                })
              : undefined
          }
        >
          <span>{run.case_counts?.total ?? "—"}</span>
        </Tooltip>
      ),
    },
    {
      title: (
        <Tooltip title={workspaceUi("casesPassingRealExecutionAllCasesWithRealExecution")}>
          {workspaceUi("executionPassRate")}
        </Tooltip>
      ),
      width: 85,
      render: (_: unknown, run: M0Run) =>
        run.case_counts?.runtime?.total
          ? `${Math.round((run.case_counts.runtime.passed / run.case_counts.runtime.total) * 1000) / 10}%`
          : run.assessment_scope === "declaration"
            ? workspaceUi("knowledgeNetwork.eval.ruleApplication.not_applicable")
            : run.case_counts?.total
              ? `${Math.round((run.case_counts.passed / run.case_counts.total) * 1000) / 10}%`
              : "—",
    },
    ...(
      [
        ["pass", evalTerm("passed"), "passed"],
        ["fail", evalTerm("notPassed"), "failed"],
        ["inconclusive", evalTerm("inconclusive"), "inconclusive"],
      ] as const
    ).map(([outcome, label, field]) => ({
      title: label,
      width: outcome === "inconclusive" ? 100 : 70,
      render: (_: unknown, run: M0Run) => {
        const count =
          run.case_counts?.runtime?.[field] ??
          (run.case_counts?.runtime ? 0 : run.case_counts?.[field]);
        return count ? (
          <Button
            type="link"
            className={styles.runCountLink}
            aria-label={workspaceUi("viewCases", { value0: label, value1: count })}
            onClick={(event) => {
              event.stopPropagation();
              openRun(run, outcome);
            }}
          >
            {count}
          </Button>
        ) : (
          <span>{count ?? "—"}</span>
        );
      },
    })),
  ];

  return (
    <div
      className={`${styles.root} ${assistantOpen ? styles.rootWithAssistant : ""} ${activeTab === "plan" ? styles.templateRoot : ""} ${activeTab === "cases" || runDetailActive ? styles.caseRoot : ""}`}
      data-testid="eval-real-workspace"
      ref={workspaceRef}
    >
      <div
        className={`${styles.body} ${activeTab === "plan" ? styles.templateBody : ""} ${activeTab === "cases" || runDetailActive ? styles.caseBody : ""}`}
      >
        <Tabs
          className={`${styles.tabs} ${activeTab === "plan" ? styles.templateTabs : ""} ${activeTab === "cases" || runDetailActive ? styles.caseTabs : ""}`}
          activeKey={workspaceTab}
          onChange={(key) => onTabChange(key as EvalTab)}
          tabBarExtraContent={
            <Button
              icon={<RobotOutlined aria-hidden />}
              onClick={() => setAssistantOpen((value) => !value)}
              aria-pressed={assistantOpen}
            >
              {t("knowledgeNetwork.eval.runPage.assistant")}
            </Button>
          }
          items={[
            {
              key: "overview",
              label: workspaceUi("overview"),
              children: (
                <div className={styles.overview}>
                  {overviewError ? (
                    <Alert showIcon type="error" message={overviewError} />
                  ) : overviewLoading || !overview ? (
                    <div className={styles.overviewLoading}>
                      <Spin />
                    </div>
                  ) : (
                    <Tabs
                      className={styles.overviewTabs}
                      activeKey={overviewView}
                      onChange={(key) => {
                        setOverviewView(key as "resources" | "execution");
                        const params = new URLSearchParams(location.search);
                        if (key === "execution") params.set("overview_view", "execution");
                        else params.delete("overview_view");
                        void navigate(
                          {
                            pathname: location.pathname,
                            search: params.toString() ? `?${params}` : "",
                          },
                          { replace: true },
                        );
                      }}
                      tabBarExtraContent={
                        overviewView === "resources" ? (
                          <Tooltip title={workspaceUi("configureEvaluationScope")}>
                            <Button
                              type="text"
                              aria-label={workspaceUi("configureEvaluationScope")}
                              icon={<SettingOutlined />}
                              onClick={() => setOverviewScopeOpen(true)}
                            />
                          </Tooltip>
                        ) : null
                      }
                      items={[
                        {
                          key: "resources",
                          label: workspaceUi("resourceCoverage"),
                          children: (
                            <div className={styles.overviewPane}>
                              {Boolean(overview.read_issues?.length) && (
                                <Alert
                                  type="warning"
                                  showIcon
                                  message={workspaceUi(
                                    "someResourcesCannotCurrentlyBeReadCountsAndCoverage",
                                  )}
                                  description={overview.read_issues
                                    ?.map((issue) => {
                                      const name =
                                        overview.resource_details?.find(
                                          (resource) =>
                                            resource.kind === issue.kind &&
                                            resource.id === issue.id,
                                        )?.name ||
                                        t(
                                          `knowledgeNetwork.eval.resourceOverview.kinds.${issue.kind}`,
                                          { defaultValue: evalReferenceLabel("unnamedResource") },
                                        );
                                      return `${name}：${readableEvalText(issue.reason, issue.id ? [{ id: issue.id, label: name }] : [])}`;
                                    })
                                    .join("；")}
                                />
                              )}
                              <section
                                className={styles.overviewMetrics}
                                aria-label={workspaceUi(
                                  "knowledgeNetworkResourceCoverageStatistics",
                                )}
                              >
                                <button onClick={() => openCaseLibrary()}>
                                  <Tooltip
                                    title={
                                      overview.resource_scope ??
                                      workspaceUi(
                                        "resourcesVisibleToThisAccountOnlyPublishedObjectMetrics",
                                      )
                                    }
                                  >
                                    <span>
                                      {workspaceUi("totalResources")} <QuestionCircleOutlined />
                                    </span>
                                  </Tooltip>
                                  <strong>{overview.resources.total}</strong>
                                  <small>
                                    {workspaceUi("included")} {overview.resources.in_scope}{" "}
                                    {workspaceUi("resourcesExcluded", {
                                      count: overview.resources.in_scope,
                                    })}{" "}
                                    {overview.resources.excluded}{" "}
                                    {workspaceUi("resources", {
                                      count: overview.resources.excluded,
                                    })}
                                  </small>
                                </button>
                                <button
                                  onClick={() => {
                                    setOverviewResourceProblemFocus((n) => n + 1);
                                    document
                                      .getElementById("eval-resource-results")
                                      ?.scrollIntoView({ block: "start", behavior: "smooth" });
                                  }}
                                >
                                  <span>
                                    {t("knowledgeNetwork.eval.resourceOverview.problemMetric")}
                                  </span>
                                  <strong>{overview.resources.problems}</strong>
                                  <small>
                                    {t("knowledgeNetwork.eval.resourceOverview.problemMetricHelp")}
                                  </small>
                                </button>
                                <button onClick={() => openCaseLibrary()}>
                                  <span>{workspaceUi("resourceCoverage")}</span>
                                  <strong>{overview.coverage.resource_percent}%</strong>
                                  <small>
                                    {overview.resources.covered} / {overview.resources.in_scope}{" "}
                                    {workspaceUi("includedResources", {
                                      count: overview.resources.in_scope,
                                    })}
                                  </small>
                                </button>
                                <button onClick={() => onTabChange("plan")}>
                                  <span>{workspaceUi("ruleCheckCoverage")}</span>
                                  <strong>{overview.coverage.rule_percent}%</strong>
                                  <small>
                                    {overview.rule_points.covered} /{" "}
                                    {overview.rule_points.applicable}{" "}
                                    {workspaceUi("applicableChecks", {
                                      count: overview.rule_points.applicable,
                                    })}
                                  </small>
                                </button>
                              </section>

                              <EvalOverviewResourcesPanel
                                key={networkId}
                                networkId={networkId}
                                overview={overview}
                                canRun={canManageCases}
                                problemFocus={overviewResourceProblemFocus}
                                onRefresh={() => setOverviewRevision((n) => n + 1)}
                                onResource={(resource) => {
                                  void navigate(overviewResourcePath(networkId, resource), {
                                    state: buildReturnToState(location),
                                  });
                                }}
                                onCases={openOverviewResourceCases}
                                onRepair={(row) => {
                                  setRepairRequest({
                                    networkId,
                                    id: crypto.randomUUID(),
                                    target: { kind: row.kind, id: row.id, name: row.name },
                                    cases: row.failures,
                                    ...(!canManageCases
                                      ? {
                                          analysisOnly: true,
                                          analysisOnlyReason: "permission" as const,
                                        }
                                      : row.failures.some((entry) => entry.status !== "failed")
                                        ? {
                                            analysisOnly: true,
                                            analysisOnlyReason: "outcome" as const,
                                          }
                                        : {}),
                                  });
                                  setAssistantOpen(true);
                                }}
                                onCreateCase={(resource) => {
                                  openOverviewResourceCases(resource);
                                  openCaseEditor();
                                  setCaseInitialResource({
                                    id: resource.id,
                                    name: resource.name,
                                    kind: resource.kind,
                                    box_id: resource.box_id,
                                    capability_id: resource.capability_id,
                                  });
                                }}
                                onInspect={(run, caseRunId) => {
                                  showRun(run, { caseRunId });
                                }}
                                onRunCreated={(run) => {
                                  showRun(run);
                                  void refreshRuns();
                                  setOverviewRevision((n) => n + 1);
                                }}
                              />
                              <section className={styles.overviewDetailGrid}>
                                <Card title={workspaceUi("resourceEvaluationCoverage")}>
                                  <Table<EvalOverview["by_resource_type"][number]>
                                    className={styles.overviewCoverageTable}
                                    rowKey="kind"
                                    scroll={{ x: 960 }}
                                    dataSource={overview.by_resource_type.filter(
                                      (row) => !overview.scope.excluded_kinds.includes(row.kind),
                                    )}
                                    pagination={false}
                                    columns={[
                                      {
                                        title: workspaceUi(
                                          "knowledgeNetwork.eval.filterUi.resourceType",
                                        ),
                                        dataIndex: "kind",
                                        width: "14%",
                                        render: (kind: string, row) =>
                                          overviewCountLink(
                                            kind,
                                            "all",
                                            row.resources,
                                            caseResourceTypeLabel(kind),
                                          ),
                                      },
                                      {
                                        title: workspaceUi("resourceCount"),
                                        dataIndex: "resources",
                                        width: "10%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          overviewCountLink(row.kind, "all", count),
                                      },
                                      {
                                        title: workspaceUi(
                                          "knowledgeNetwork.eval.caseNavigation.participating",
                                        ),
                                        dataIndex: "in_scope_resources",
                                        width: "12%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          overviewCountLink(row.kind, "in_scope", count),
                                      },
                                      {
                                        title: workspaceUi(
                                          "knowledgeNetwork.eval.ruleApplication.excluded",
                                        ),
                                        dataIndex: "excluded_resources",
                                        width: "14%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          overviewCountLink(row.kind, "excluded", count),
                                      },
                                      {
                                        title: workspaceUi("caseCoverage"),
                                        width: "15%",
                                        align: "right",
                                        render: (_: unknown, row) =>
                                          overviewCountLink(
                                            row.kind,
                                            "covered",
                                            row.covered_resources,
                                            `${row.covered_resources}（${row.coverage_percent}%）`,
                                          ),
                                      },
                                      {
                                        title: workspaceUi("withResults"),
                                        dataIndex: "evaluated_resources",
                                        width: "12%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          overviewCountLink(row.kind, "evaluated", count),
                                      },
                                      {
                                        title: workspaceUi(
                                          "knowledgeNetwork.eval.agentCompare.differenceOptions.all_pass",
                                        ),
                                        dataIndex: "passed_resources",
                                        width: "12%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          overviewCountLink(row.kind, "passed", count),
                                      },
                                      {
                                        title: workspaceUi(
                                          "knowledgeNetwork.eval.resourceOverview.problem",
                                        ),
                                        dataIndex: "problem_resources",
                                        width: "11%",
                                        align: "right",
                                        render: (count: number, row) =>
                                          count ? (
                                            <Button
                                              type="link"
                                              className={styles.overviewCountLink}
                                              onClick={() =>
                                                openOverviewResourceDetail(row.kind, "problem")
                                              }
                                            >
                                              <Tag color="error">{count}</Tag>
                                            </Button>
                                          ) : (
                                            "—"
                                          ),
                                      },
                                    ]}
                                  />
                                </Card>
                              </section>
                            </div>
                          ),
                        },
                        {
                          key: "execution",
                          label: workspaceUi("casesAndRuns"),
                          children: (
                            <div className={styles.overviewPane}>
                              <section
                                className={styles.overviewMetrics}
                                aria-label={workspaceUi("caseAndRunStatistics")}
                              >
                                <button onClick={() => openCaseLibrary()}>
                                  <span>{workspaceUi("totalCases")}</span>
                                  <strong>{overview.cases.total}</strong>
                                  <small>
                                    {overview.cases.enabled}{" "}
                                    {workspaceUi("casesInEvaluationScope", {
                                      count: overview.cases.enabled,
                                    })}
                                  </small>
                                </button>
                                <button
                                  onClick={() => {
                                    openCaseLibrary({
                                      status: "enabled",
                                      participation: "participating",
                                    });
                                  }}
                                >
                                  <span>{workspaceUi("enabledCases")}</span>
                                  <strong>{overview.cases.enabled}</strong>
                                  <small>{workspaceUi("casesAvailableForFutureRuns")}</small>
                                </button>
                                <button
                                  onClick={() => {
                                    openCaseLibrary({ view: "suites" });
                                  }}
                                >
                                  <span>
                                    {workspaceUi("knowledgeNetwork.eval.externalUi.suite")}
                                  </span>
                                  <strong>{suiteCount ?? "—"}</strong>
                                  <small>{workspaceUi("testSuitesInThisKnowledgeNetwork")}</small>
                                </button>
                                <button onClick={() => openOverviewCases("evaluated")}>
                                  <span>{workspaceUi("executionCoverage")}</span>
                                  <strong>{overview.coverage.execution_percent}%</strong>
                                  <small>
                                    {overview.cases.evaluated} / {overview.cases.enabled}{" "}
                                    {workspaceUi("enabledCasesSuffix", {
                                      count: overview.cases.enabled,
                                    })}
                                  </small>
                                </button>
                              </section>

                              <EvalOverviewExecutionSummary
                                cases={overview.cases}
                                onCaseFilter={openOverviewCases}
                                onScope={() => setOverviewScopeOpen(true)}
                              />

                              <Card
                                data-testid="eval-recent-runs"
                                title={workspaceUi("recentRuns")}
                                extra={
                                  <Button
                                    type="link"
                                    onClick={() => {
                                      setRunWorkspaceTab("records");
                                      onTabChange("runs");
                                    }}
                                  >
                                    {workspaceUi("viewAll")}
                                  </Button>
                                }
                              >
                                {runsError ? (
                                  <Alert showIcon type="error" message={runsError} />
                                ) : runsLoading ? (
                                  <Spin />
                                ) : runs.length ? (
                                  <Table<M0Run>
                                    className={styles.runTable}
                                    rowKey="id"
                                    size="small"
                                    dataSource={runs.slice(0, 5)}
                                    pagination={false}
                                    scroll={{ x: 1000 }}
                                    onRow={(run) => ({ onClick: () => openRun(run) })}
                                    columns={runColumns}
                                  />
                                ) : (
                                  <Empty description={workspaceUi("notYetRun")} />
                                )}
                              </Card>
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
            {
              key: "plan",
              label: workspaceUi("templateManagement"),
              children: templateError ? (
                <Alert showIcon type="error" message={templateError} />
              ) : templateLoading ? (
                <Spin />
              ) : template ? (
                <EvalTemplatePanel
                  networkId={networkId}
                  config={template}
                  canManage={canManageTemplates}
                  onChanged={setTemplate}
                  onApply={setRuleApplication}
                />
              ) : (
                <Empty description={workspaceUi("noEvaluationRules")} />
              ),
            },
            {
              key: "cases",
              label: workspaceUi("testSuiteManagement"),
              children: (
                <div className={styles.caseManager} data-testid="eval-case-manager">
                  <Tabs
                    className={styles.caseWorkspaceTabs}
                    activeKey={caseWorkspaceTab}
                    onChange={(key) => {
                      setCaseWorkspaceTab(key as "library" | "suites");
                      onTabChange("cases", { view: key as "library" | "suites" });
                    }}
                    items={[
                      {
                        key: "library",
                        label: (
                          <span className={styles.runTabLabel}>
                            <span>
                              {workspaceUi("caseLibrary", { value0: allCaseCount ?? "—" })}
                            </span>
                            <Tooltip
                              title={t("knowledgeNetwork.eval.suiteUi.libraryHelpText")}
                              trigger={["hover", "focus"]}
                            >
                              <QuestionCircleOutlined
                                className={styles.runTabHelp}
                                aria-label={t("knowledgeNetwork.eval.suiteUi.libraryHelp")}
                                tabIndex={0}
                                onClick={(event) => event.stopPropagation()}
                              />
                            </Tooltip>
                          </span>
                        ),
                      },
                      {
                        key: "suites",
                        label: (
                          <span className={styles.runTabLabel}>
                            <span>{workspaceUi("testSuites", { value0: suiteCount ?? "—" })}</span>
                            <Tooltip
                              title={t("knowledgeNetwork.eval.suiteUi.suiteHelpText")}
                              trigger={["hover", "focus"]}
                            >
                              <QuestionCircleOutlined
                                className={styles.runTabHelp}
                                aria-label={t("knowledgeNetwork.eval.suiteUi.suiteHelp")}
                                tabIndex={0}
                                onClick={(event) => event.stopPropagation()}
                              />
                            </Tooltip>
                          </span>
                        ),
                      },
                    ]}
                  />
                  {caseWorkspaceTab === "library" ? (
                    <div className={styles.caseWorkbench}>
                      <EvalCaseResourceSidebar
                        filter={{ type: resourceTypeFilter, name: resourceSearch }}
                        summary={caseResources}
                        loading={resourceLoading}
                        error={resourceError}
                        page={resourcePage}
                        pageSize={resourcePageSize}
                        onChange={({ type, name }) => {
                          updateCaseFilters({ resourceType: type, resource: name });
                        }}
                        onPageChange={setResourcePage}
                        onRetry={() => setResourceRetry((value) => value + 1)}
                      />
                      <section className={styles.caseList} aria-label={workspaceUi("caseList")}>
                        <div
                          className={styles.caseManagerToolbar}
                          role="region"
                          aria-label={t("knowledgeNetwork.eval.caseNavigation.toolbar")}
                        >
                          <div className={styles.caseFilterControls}>
                            <Input.Search
                              aria-label={workspaceUi("searchCasesOrResources")}
                              placeholder={workspaceUi("searchCasesResourceNamesOrIDs")}
                              allowClear
                              value={caseSearch}
                              onChange={(event) => {
                                updateCaseFilters({ search: event.target.value }, true);
                              }}
                            />
                            <label className={styles.runFilterField}>
                              <span>{t("knowledgeNetwork.eval.filterUi.caseStatus")}</span>
                              <Select
                                aria-label={workspaceUi(
                                  "knowledgeNetwork.eval.filterUi.caseStatus",
                                )}
                                value={caseStateFilter}
                                onChange={(value) => {
                                  updateCaseFilters({ status: value });
                                }}
                                options={[
                                  {
                                    value: "all",
                                    label: workspaceUi(
                                      "knowledgeNetwork.eval.templateUi.filters.allStates",
                                    ),
                                  },
                                  { value: "disabled", label: evalTerm("inactive") },
                                  { value: "enabled", label: evalTerm("enabled") },
                                ]}
                              />
                            </label>
                            <label
                              className={`${styles.runFilterField} ${styles.caseFilterResult}`}
                            >
                              <span>{t("knowledgeNetwork.eval.caseNavigation.latestResult")}</span>
                              <Select
                                aria-label={t("knowledgeNetwork.eval.caseNavigation.latestResult")}
                                value={caseResultFilter}
                                onChange={(result: CaseResultFilter) =>
                                  updateCaseFilters({ result })
                                }
                                options={caseResultFilters.map((value) => ({
                                  value,
                                  label:
                                    value === "all"
                                      ? t("knowledgeNetwork.eval.caseNavigation.allResults")
                                      : caseResultFilterLabels[value],
                                }))}
                              />
                            </label>
                            <label className={`${styles.runFilterField} ${styles.caseFilterScope}`}>
                              <span>{t("knowledgeNetwork.eval.caseNavigation.scope")}</span>
                              <Select
                                aria-label={t("knowledgeNetwork.eval.caseNavigation.scope")}
                                value={caseParticipation}
                                onChange={(participation: EvalCaseFilters["participation"]) =>
                                  updateCaseFilters({ participation })
                                }
                                options={[
                                  {
                                    value: "all",
                                    label: t("knowledgeNetwork.eval.caseNavigation.allCases"),
                                  },
                                  {
                                    value: "participating",
                                    label: t("knowledgeNetwork.eval.caseNavigation.participating"),
                                  },
                                  {
                                    value: "excluded",
                                    label: t("knowledgeNetwork.eval.caseNavigation.excluded"),
                                  },
                                ]}
                              />
                            </label>
                            {(caseSearch ||
                              caseStateFilter !== "all" ||
                              caseResultFilter !== "all" ||
                              caseParticipation !== "all" ||
                              hasResourceFilter) && (
                              <Button
                                type="link"
                                onClick={() =>
                                  updateCaseFilters({
                                    ...defaultCaseFilters,
                                    view: caseWorkspaceTab,
                                  })
                                }
                              >
                                {t("knowledgeNetwork.eval.caseNavigation.clearFilters")}
                              </Button>
                            )}
                          </div>
                          <div className={styles.caseManagerControls}>
                            <Dropdown
                              trigger={["click"]}
                              disabled={!canManageCases}
                              menu={{
                                items: [
                                  {
                                    key: "manual",
                                    label: t("knowledgeNetwork.eval.caseCreation.manual"),
                                    onClick: () => openCaseEditor(),
                                  },
                                  {
                                    key: "template",
                                    label: t("knowledgeNetwork.eval.caseCreation.template"),
                                    disabled:
                                      templateLoading ||
                                      !template?.rules.some((rule) => rule.enabled),
                                    title:
                                      templateError ||
                                      (templateLoading
                                        ? t("knowledgeNetwork.eval.caseCreation.loading")
                                        : !template?.rules.some((rule) => rule.enabled)
                                          ? t("knowledgeNetwork.eval.caseCreation.noRules")
                                          : undefined),
                                    onClick: () => setRuleApplication({ ruleIds: [] }),
                                  },
                                ],
                              }}
                            >
                              <Button
                                type="primary"
                                disabled={!canManageCases}
                                title={
                                  canManageCases
                                    ? workspaceUi(
                                        "knowledgeNetwork.eval.resourceOverview.createCase",
                                      )
                                    : workspaceUi("caseManagementIsNotAvailableForThisAccountOr")
                                }
                              >
                                <Space size={6}>
                                  {workspaceUi("create")}
                                  <DownOutlined aria-hidden />
                                </Space>
                              </Button>
                            </Dropdown>
                          </div>
                        </div>
                        {Object.keys(selectedCases).length > 0 && (
                          <section
                            className={styles.caseBatchToolbar}
                            aria-label={t("knowledgeNetwork.eval.caseBatch.toolbar")}
                          >
                            <div className={styles.caseBatchSelection}>
                              <span role="status">
                                {t("knowledgeNetwork.eval.caseBatch.selected", {
                                  count: Object.keys(selectedCases).length,
                                })}
                              </span>
                              <Button
                                type="link"
                                disabled={Boolean(batchCaseAction) || batchRunLoading}
                                onClick={() => setSelectedCases({})}
                              >
                                {t("knowledgeNetwork.eval.caseBatch.clearSelection")}
                              </Button>
                            </div>
                            <Space wrap className={styles.caseBatchActions}>
                              {canManageCases && (
                                <>
                                  <Button
                                    aria-label={t("knowledgeNetwork.eval.caseBatch.enable")}
                                    disabled={
                                      !Object.keys(selectedCases).length ||
                                      Boolean(batchCaseAction) ||
                                      batchRunLoading
                                    }
                                    loading={batchCaseAction === "enable"}
                                    onClick={() =>
                                      void runCaseBatchAction(
                                        "enable",
                                        Object.values(selectedCases),
                                      )
                                    }
                                  >
                                    {t("knowledgeNetwork.eval.caseBatch.enable")}
                                  </Button>
                                  <Button
                                    danger
                                    aria-label={t("knowledgeNetwork.eval.caseBatch.delete")}
                                    disabled={
                                      !Object.keys(selectedCases).length ||
                                      Boolean(batchCaseAction) ||
                                      batchRunLoading
                                    }
                                    loading={batchCaseAction === "delete"}
                                    onClick={deleteSelectedCases}
                                  >
                                    {t("knowledgeNetwork.eval.caseBatch.delete")}
                                  </Button>
                                </>
                              )}
                              <Button
                                icon={<PlayCircleOutlined />}
                                aria-label={workspaceUi("runSelectionLabel", {
                                  value0: Object.keys(selectedCases).length
                                    ? `（${Object.keys(selectedCases).length}）`
                                    : "",
                                })}
                                disabled={!selectionIsRunnable || Boolean(batchCaseAction)}
                                title={
                                  Object.keys(selectedCases).length && !selectionIsRunnable
                                    ? t("knowledgeNetwork.eval.caseBatch.runHint")
                                    : undefined
                                }
                                loading={batchRunLoading}
                                onClick={() => void runSelectedCases()}
                              >
                                {workspaceUi("run")}
                                {Object.keys(selectedCases).length
                                  ? `（${Object.keys(selectedCases).length}）`
                                  : ""}
                              </Button>
                            </Space>
                          </section>
                        )}
                        {batchCaseResult && (
                          <Alert
                            showIcon
                            closable
                            onClose={() => setBatchCaseResult(undefined)}
                            type={
                              batchCaseResult.entries.every((entry) => entry.success)
                                ? "success"
                                : "warning"
                            }
                            message={t("knowledgeNetwork.eval.caseBatch.summary", {
                              action: t(
                                `knowledgeNetwork.eval.caseBatch.${batchCaseResult.action}`,
                              ),
                              success: batchCaseResult.entries.filter((entry) => entry.success)
                                .length,
                              failed: batchCaseResult.entries.filter((entry) => !entry.success)
                                .length,
                            })}
                            description={
                              batchCaseResult.entries.some((entry) => !entry.success) && (
                                <div className={styles.caseBatchFailures}>
                                  <div>{t("knowledgeNetwork.eval.caseBatch.retryHint")}</div>
                                  {batchCaseResult.entries
                                    .filter((entry) => !entry.success)
                                    .map((entry) => (
                                      <div key={entry.id}>
                                        <strong>{entry.title}</strong>：
                                        {t(`knowledgeNetwork.eval.caseBatch.errors.${entry.error}`)}
                                      </div>
                                    ))}
                                </div>
                              )
                            }
                          />
                        )}
                        {caseError && (
                          <Alert
                            showIcon
                            type="error"
                            message={caseError}
                            action={
                              <Button
                                size="small"
                                onClick={() => setCaseListRevision((revision) => revision + 1)}
                              >
                                {workspaceUi("knowledgeNetwork.eval.suiteCaseUi.retry")}
                              </Button>
                            }
                          />
                        )}
                        <Table<EvalCaseSummary>
                          className={styles.caseTable}
                          size="small"
                          rowKey="id"
                          loading={caseLoading || caseNavigating}
                          dataSource={pagedCases}
                          locale={{
                            emptyText: caseError
                              ? workspaceUi("couldNotLoadClickToRetry")
                              : workspaceUi("noData"),
                          }}
                          pagination={false}
                          scroll={{ x: 1222, y: "calc(100vh - 440px)" }}
                          rowSelection={{
                            selectedRowKeys: Object.keys(selectedCases),
                            preserveSelectedRowKeys: true,
                            columnWidth: 44,
                            getCheckboxProps: (row) => ({
                              disabled:
                                Boolean(batchCaseAction) ||
                                batchRunLoading ||
                                (!canManageCases && !caseIsRunnable(row)),
                              name: workspaceUi("selectCase", { value0: row.title }),
                              "aria-label": workspaceUi("selectCase", { value0: row.title }),
                              title:
                                canManageCases || caseIsRunnable(row)
                                  ? workspaceUi("selectCase", { value0: row.title })
                                  : !row.enabled
                                    ? workspaceUi("enableTheCaseFirst")
                                    : caseExecutionSetupLabel(row),
                            }),
                            onSelect: (row, selected) => {
                              setSelectedCases((current) => {
                                const next = { ...current };
                                if (selected) next[row.id] = row;
                                else delete next[row.id];
                                return next;
                              });
                            },
                            onSelectAll: (selected, _selectedRows, changedRows) => {
                              setSelectedCases((current) => {
                                const next = { ...current };
                                changedRows.forEach((row) => {
                                  if (selected) next[row.id] = row;
                                  else delete next[row.id];
                                });
                                return next;
                              });
                            },
                          }}
                          columns={[
                            {
                              title: evalTerm("caseName"),
                              width: 244,
                              render: (_, row) => (
                                <Button
                                  type="link"
                                  className={styles.caseListLink}
                                  onClick={() => {
                                    setSelectedCase(row);
                                    setCaseDetailOpen(true);
                                  }}
                                >
                                  <strong className={styles.caseTitleSingleLine} title={row.title}>
                                    {row.title}
                                  </strong>
                                  {!caseIsRunnable(row) && (
                                    <span className={styles.caseListMeta}>
                                      {!row.enabled
                                        ? workspaceUi("enableTheCaseFirst")
                                        : caseCanConfigureObjectCheck(row)
                                          ? workspaceUi("configureExecutionInTheActionsMenu")
                                          : caseExecutionSetupLabel(row)}
                                    </span>
                                  )}
                                </Button>
                              ),
                            },
                            {
                              title: workspaceUi(
                                "knowledgeNetwork.eval.templateUi.columns.actions",
                              ),
                              width: 56,
                              align: "center",
                              fixed: "left",
                              render: (_, row) => {
                                const runnable = caseIsRunnable(row);
                                return (
                                  <Dropdown
                                    disabled={Boolean(batchCaseAction)}
                                    trigger={["click"]}
                                    menu={{
                                      items: [
                                        {
                                          key: "run",
                                          label:
                                            runningCaseId === row.id
                                              ? workspaceUi("checking")
                                              : workspaceUi("run"),
                                          disabled: !runnable || runningCaseId === row.id,
                                          title: runnable
                                            ? workspaceUi("runCase", { value0: row.title })
                                            : !row.enabled
                                              ? workspaceUi("enableTheCaseFirst")
                                              : caseExecutionSetupLabel(row),
                                          onClick: () => {
                                            void runCaseDirectly(row);
                                          },
                                        },
                                        {
                                          key: "view",
                                          label: workspaceUi(
                                            "knowledgeNetwork.eval.templateUi.details",
                                          ),
                                          onClick: () => {
                                            setSelectedCase(row);
                                            setCaseDetailOpen(true);
                                          },
                                        },
                                        ...(canManageCases
                                          ? [
                                              {
                                                key: "edit",
                                                label: workspaceUi("edit"),
                                                onClick: () => void editCase(row),
                                              },
                                              {
                                                key: "enablement",
                                                label: row.enabled
                                                  ? workspaceUi(
                                                      "knowledgeNetwork.eval.templateUi.disabled",
                                                    )
                                                  : workspaceUi(
                                                      "knowledgeNetwork.eval.templateUi.enabled",
                                                    ),
                                                onClick: () => changeCaseEnabled(row),
                                              },
                                              {
                                                key: "delete",
                                                label: workspaceUi(
                                                  "knowledgeNetwork.eval.caseBatch.delete",
                                                ),
                                                danger: true,
                                                onClick: () => confirmCaseRemoval(row),
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
                                      aria-label={workspaceUi("caseActions")}
                                    />
                                  </Dropdown>
                                );
                              },
                            },
                            {
                              title: evalTerm("assessmentTarget"),
                              width: 166,
                              render: (_, row) => (
                                <span
                                  className={styles.caseCellEllipsis}
                                  title={caseResourceSummary(row)}
                                >
                                  {caseResourceSummary(row)}
                                </span>
                              ),
                            },
                            {
                              title: workspaceUi("knowledgeNetwork.eval.filterUi.resourceType"),
                              width: 112,
                              render: (_, row) => (
                                <span
                                  className={styles.caseCellEllipsis}
                                  title={caseResourceTypeSummary(row)}
                                >
                                  {caseResourceTypeSummary(row)}
                                </span>
                              ),
                            },
                            {
                              title: workspaceUi("knowledgeNetwork.eval.filterUi.caseStatus"),
                              width: 92,
                              render: (_, row) => {
                                return row.enabled ? (
                                  <Tag color="success">{evalTerm("enabled")}</Tag>
                                ) : (
                                  <Tag>{evalTerm("inactive")}</Tag>
                                );
                              },
                            },
                            {
                              title: evalTerm("relatedRule"),
                              width: 168,
                              render: (_, row) => (
                                <span
                                  className={styles.caseCellEllipsis}
                                  title={caseTemplateRuleLabel(row, template?.rules)}
                                >
                                  {caseTemplateRuleLabel(row, template?.rules)}
                                </span>
                              ),
                            },
                            {
                              title: workspaceUi("knowledgeNetwork.eval.definitionUi.creation"),
                              width: 142,
                              render: (_, row) => caseSourceLabel(row),
                            },
                            {
                              title: workspaceUi("latestResult"),
                              width: 128,
                              fixed: "right",
                              render: (_, row) => {
                                const result = row.latest_result;
                                const meta = caseResultStatusMeta[result?.status || "not_run"];
                                return result?.run_id ? (
                                  <Button
                                    type="link"
                                    className={styles.caseCellEllipsis}
                                    title={meta.label}
                                    onClick={() => {
                                      setSelectedCaseOutcome("all");
                                      navigateRunDetail({
                                        runId: result.run_id,
                                        caseRunId: result.case_run_id,
                                      });
                                    }}
                                  >
                                    {meta.label}
                                  </Button>
                                ) : (
                                  meta.label
                                );
                              },
                            },
                          ]}
                        />
                        <div className={styles.casePagination}>
                          {(casePage?.total ?? 0) > caseTablePageSize ? (
                            <TablePaginationBar
                              aria-label={workspaceUi("casePagination")}
                              current={caseGlobalPage}
                              pageSize={caseTablePageSize}
                              total={casePage?.total ?? 0}
                              showLessItems
                              showSizeChanger={false}
                              showTotal={(total) => workspaceUi("casesInTotal", { value0: total })}
                              disabled={caseLoading || caseNavigating}
                              onChange={(page) => void navigateToCasePage(page)}
                            />
                          ) : (
                            <Typography.Text type="secondary">
                              {caseLoading
                                ? workspaceUi("loading")
                                : workspaceUi("casesInTotal", { value0: casePage?.total ?? 0 })}
                            </Typography.Text>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <EvalSuitePanel
                      externalAvailable={externalAgentAvailable}
                      networkId={networkId}
                      canManage={canManageCases}
                      onCountChange={setSuiteCount}
                      onRunCreated={(run) => {
                        showRun(run);
                        void refreshRuns();
                      }}
                    />
                  )}
                  <EvalSuiteCaseDetailDrawer
                    networkId={networkId}
                    caseId={caseDetailOpen ? selectedCase?.id : undefined}
                    summary={selectedCase ?? undefined}
                    onClose={() => setCaseDetailOpen(false)}
                  />
                  <EvalCaseEditorDrawer
                    networkId={networkId}
                    open={caseEditorOpen}
                    caseId={editingCaseId}
                    sourceType={editingCaseSourceType}
                    initiallyEnabled={editingCaseEnabled}
                    initialResource={caseInitialResource}
                    onClose={() => setCaseEditorOpen(false)}
                    onChanged={() => setCaseListRevision((revision) => revision + 1)}
                  />
                </div>
              ),
            },
            {
              key: "runs",
              label: workspaceUi("runsAndDiagnostics"),
              children: (
                <div className={styles.runWorkspace} data-testid="eval-run-workspace">
                  <div hidden={runDetailActive} className={styles.runListPage}>
                    {!agentComparisonOpen && (
                      <Tabs
                        className={styles.runWorkspaceTabs}
                        activeKey={runWorkspaceTab}
                        onChange={(key) => setRunWorkspaceTab(key as "records" | "plans")}
                        items={[
                          {
                            key: "records",
                            label: (
                              <span className={styles.runTabLabel}>
                                <span>
                                  {workspaceUi("runRecords", { value0: runList?.total ?? "—" })}
                                </span>
                                <Tooltip
                                  title={workspaceUi(
                                    "viewTheExecutionProcessAndEvaluationResultsOfEach",
                                  )}
                                  trigger={["hover", "focus"]}
                                >
                                  <QuestionCircleOutlined
                                    className={styles.runTabHelp}
                                    aria-label={workspaceUi("aboutRunRecords")}
                                    tabIndex={0}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </Tooltip>
                              </span>
                            ),
                          },
                          {
                            key: "plans",
                            label: (
                              <span className={styles.runTabLabel}>
                                <span>
                                  {workspaceUi("runPlansWithCount", { value0: runPlanCountLabel })}
                                </span>
                                {runPlanCountStatus === "failed" && (
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ReloadOutlined />}
                                    aria-label={t("knowledgeNetwork.eval.runPlansUi.retryCount")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (runPlanCapabilityStatus === "failed")
                                        setRunPlansCapabilityRetry((value) => value + 1);
                                      else setRunPlanCountRetry((value) => value + 1);
                                    }}
                                  />
                                )}
                                <Tooltip
                                  title={workspaceUi(
                                    "automaticallyRunPublishedTestSuitesOnAScheduleA",
                                  )}
                                  trigger={["hover", "focus"]}
                                >
                                  <QuestionCircleOutlined
                                    className={styles.runTabHelp}
                                    aria-label={workspaceUi("aboutRunPlans")}
                                    tabIndex={0}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </Tooltip>
                              </span>
                            ),
                          },
                        ]}
                      />
                    )}
                    {agentComparisonOpen ? (
                      <EvalAgentComparisonWorkspace
                        key={networkId}
                        networkId={networkId}
                        onBack={() => setAgentComparisonOpen(false)}
                        onInspect={(run, caseRunId, tab) => {
                          showRun(run, {
                            caseRunId,
                            tab,
                            revision: run.result_revision ?? undefined,
                          });
                        }}
                      />
                    ) : runWorkspaceTab === "plans" ? (
                      <EvalRunPlansPanel
                        networkId={networkId}
                        available={runPlansAvailable}
                        canManage={canManageRunPlans}
                        automaticAvailable={automaticRunPlans}
                        onCountChange={onRunPlanCountChange}
                        onRunCreated={(run) => {
                          showRun(run);
                          void refreshRuns();
                        }}
                      />
                    ) : (
                      <section
                        className={styles.runRecordSection}
                        role="complementary"
                        aria-label={workspaceUi("knowledgeNetwork.eval.referencesUi.unnamedRun")}
                      >
                        <div className={styles.runColumns}>
                          <div className={styles.runHistory}>
                            <div className={styles.runFilters}>
                              <label
                                className={`${styles.runFilterField} ${styles.runFilterKeyword}`}
                              >
                                <Input.Search
                                  aria-label={workspaceUi("searchRuns")}
                                  placeholder={workspaceUi("searchTestSuitesOrRunIDs")}
                                  allowClear
                                  value={runSearch}
                                  onChange={(event) => {
                                    updateRunFilters({ search: event.target.value, page: 1 });
                                  }}
                                />
                              </label>
                              <label className={styles.runFilterField}>
                                <span>{workspaceUi("knowledgeNetwork.eval.m0.status")}</span>
                                <Select
                                  aria-label={workspaceUi("filterExecutionStatus")}
                                  value={runStatusFilter}
                                  onChange={(value) => {
                                    updateRunFilters({ status: value, page: 1 });
                                  }}
                                  options={[
                                    {
                                      value: "all",
                                      label: workspaceUi(
                                        "knowledgeNetwork.eval.templateUi.filters.allStates",
                                      ),
                                    },
                                    ...(
                                      [
                                        "queued",
                                        "running",
                                        "completed",
                                        "failed",
                                        "cancelled",
                                      ] as const
                                    ).map((value) => ({ value, label: runStatusLabel(value) })),
                                  ]}
                                />
                              </label>
                              <label className={styles.runFilterField}>
                                <span>
                                  {workspaceUi("knowledgeNetwork.eval.overviewSummary.results")}
                                </span>
                                <Select
                                  aria-label={workspaceUi("filterEvaluationResult")}
                                  value={runOutcomeFilter}
                                  onChange={(value) => {
                                    updateRunFilters({ outcome: value, page: 1 });
                                  }}
                                  options={[
                                    {
                                      value: "all",
                                      label: workspaceUi(
                                        "knowledgeNetwork.eval.caseNavigation.allResults",
                                      ),
                                    },
                                    ...(["pass", "fail", "inconclusive"] as const).map((value) => ({
                                      value,
                                      label: outcomeLabel(value),
                                    })),
                                  ]}
                                />
                              </label>
                              <div
                                className={`${styles.runFilterField} ${styles.runFilterDateRange}`}
                              >
                                <span>
                                  {workspaceUi("knowledgeNetwork.eval.agentCompare.date")}
                                </span>
                                <DatePicker.RangePicker
                                  aria-label={workspaceUi("runDateRange")}
                                  allowClear
                                  allowEmpty={[true, true]}
                                  format="YYYY-MM-DD"
                                  placeholder={[workspaceUi("startDate"), workspaceUi("endDate")]}
                                  value={
                                    runDateFrom || runDateTo
                                      ? [
                                          runDateFrom ? dayjs(runDateFrom) : null,
                                          runDateTo ? dayjs(runDateTo) : null,
                                        ]
                                      : null
                                  }
                                  onChange={(_dates, dateStrings) => {
                                    updateRunFilters({
                                      from: dateStrings[0],
                                      to: dateStrings[1],
                                      page: 1,
                                    });
                                  }}
                                />
                              </div>
                              <Space className={styles.runFilterActions}>
                                {(runSearch ||
                                  runStatusFilter !== "all" ||
                                  runOutcomeFilter !== "all" ||
                                  runDateFrom ||
                                  runDateTo) && (
                                  <Button
                                    className={styles.runFilterClear}
                                    type="link"
                                    onClick={() => {
                                      updateRunFilters({
                                        search: "",
                                        status: "all",
                                        outcome: "all",
                                        from: "",
                                        to: "",
                                        page: 1,
                                      });
                                    }}
                                  >
                                    {workspaceUi("knowledgeNetwork.eval.suiteUi.clearFilters")}
                                  </Button>
                                )}
                                <Button onClick={() => setAgentComparisonOpen(true)}>
                                  {workspaceUi("knowledgeNetwork.eval.agentCompare.title")}
                                </Button>
                                <Button
                                  aria-label={workspaceUi("refreshRunRecords")}
                                  title={workspaceUi("refreshRunRecords")}
                                  icon={<ReloadOutlined aria-hidden />}
                                  onClick={() => {
                                    void refreshRuns();
                                  }}
                                  loading={runListLoading}
                                />
                              </Space>
                            </div>
                            {runListError && <Alert showIcon type="error" message={runListError} />}
                            <Table<M0Run>
                              className={styles.runTable}
                              rowKey="id"
                              size="small"
                              loading={runListLoading}
                              dataSource={runList?.entries ?? []}
                              scroll={{ x: 1000 }}
                              locale={{ emptyText: workspaceUi("noMatchingRuns") }}
                              rowClassName={(run) =>
                                runDetailOpen && selectedRunId === run.id
                                  ? styles.runHistoryItemActive
                                  : ""
                              }
                              onRow={(run) => ({
                                onClick: () => openRun(run),
                              })}
                              pagination={false}
                              columns={runColumns}
                            />
                            {runList && runList.total > 0 && (
                              <div className={styles.runPagination}>
                                <TablePaginationBar
                                  current={runListPage}
                                  pageSize={20}
                                  total={runList.total}
                                  showLessItems
                                  showSizeChanger={false}
                                  showTotal={(total) =>
                                    workspaceUi("casesInTotal", { value0: total })
                                  }
                                  onChange={(page) => updateRunFilters({ page })}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                  {runDetailActive && (
                    <section
                      className={styles.runDetailPage}
                      aria-label={t("knowledgeNetwork.eval.runPage.title")}
                    >
                      <header className={styles.runDetailHeader}>
                        <Button
                          type="text"
                          icon={<ArrowLeftOutlined aria-hidden />}
                          onClick={closeRunDetail}
                        >
                          {t(
                            `knowledgeNetwork.eval.runPage.${agentComparisonOpen ? "backComparison" : "back"}`,
                          )}
                        </Button>
                        <div className={styles.runDetailHeading}>
                          <Typography.Title level={5}>
                            {t(
                              `knowledgeNetwork.eval.runPage.${runComparisonOpen ? "comparison" : "title"}`,
                            )}
                          </Typography.Title>
                          {selectedRun && (
                            <span title={runName(selectedRun)}>{runName(selectedRun)}</span>
                          )}
                        </div>
                        <Space wrap>
                          <Button
                            disabled={
                              !runComparisonOpen &&
                              (selectedRun?.execution_status !== "completed" ||
                                !selectedRun.result_revision)
                            }
                            onClick={() =>
                              navigateRunDetail({
                                runId: selectedRunId!,
                                caseRunId: linkedCaseRunId,
                                tab: linkedDetailTab,
                                outcome: selectedCaseOutcome,
                                revision: linkedRunDetail.revision,
                                comparison: !runComparisonOpen,
                              })
                            }
                          >
                            {t(
                              `knowledgeNetwork.eval.runPage.${runComparisonOpen ? "backDetail" : "history"}`,
                            )}
                          </Button>
                        </Space>
                      </header>
                      {runComparisonOpen && (
                        <div className={styles.runComparisonPage}>
                          <EvalRunComparisonPanel
                            networkId={networkId}
                            candidate={selectedRun}
                            runs={runList?.entries ?? runs}
                            preferredBaselineId={
                              retestComparison && retestComparison.candidateId === selectedRunId
                                ? retestComparison.baselineId
                                : undefined
                            }
                            onInspect={(run, caseRunId, tab) =>
                              showRun(run, {
                                caseRunId,
                                tab,
                                revision: run.result_revision ?? undefined,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className={styles.runAnalysis} hidden={runComparisonOpen}>
                        <EvalMultiRunPanel
                          key={selectedRunId}
                          networkId={networkId}
                          runId={selectedRunId!}
                          comparedResultRevision={linkedRunDetail.revision}
                          preferredCaseRunId={linkedCaseRunId}
                          initialDetailTab={linkedDetailTab}
                          initialOutcome={selectedCaseOutcome}
                          initialAssessmentScope={
                            selectedCaseOutcome !== "all" && selectedRun?.case_counts?.runtime
                              ? "runtime"
                              : undefined
                          }
                          caseCounts={selectedRun?.case_counts}
                          onRunLoaded={onRunLoaded}
                          onOutcomeChange={(outcome) =>
                            navigateRunDetail({ runId: selectedRunId!, outcome }, true)
                          }
                          onSelectionChange={(caseRunId, tab) => {
                            if (caseRunId === linkedCaseRunId && tab === linkedDetailTab) return;
                            navigateRunDetail(
                              {
                                runId: selectedRunId!,
                                caseRunId,
                                tab,
                                outcome: selectedCaseOutcome,
                                revision: linkedRunDetail.revision,
                                comparison: runComparisonOpen,
                              },
                              true,
                            );
                          }}
                          onRerun={(detail) => void rerunCase(detail)}
                          onRepair={openRunRepair}
                          onViewCase={(detail) => {
                            setRunDetailOpen(false);
                            setCaseDetailOpen(false);
                            openCaseLibrary({ search: detail.case_id });
                          }}
                          onSettled={refreshRuns}
                        />
                      </div>
                    </section>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
      {ruleApplication && template && canManageCases && (
        <EvalRuleApplicationDrawer
          key={networkId}
          networkId={networkId}
          rules={template.rules}
          seed={ruleApplication}
          title={
            caseLibraryActive ? t("knowledgeNetwork.eval.caseCreation.templateTitle") : undefined
          }
          onClose={() => setRuleApplication(undefined)}
          onSaved={() => {
            if (caseLibraryActive) updateCaseFilters({ ...defaultCaseFilters }, true);
            setCaseListRevision((revision) => revision + 1);
          }}
          onOpenCase={(id) => {
            setRuleApplication(undefined);
            setEditingCaseId(id);
            setEditingCaseSourceType("template");
            setCaseEditorOpen(true);
            openCaseLibrary({ search: id });
          }}
        />
      )}
      {assistantOpen && <EvalAssistantResizeHandle containerRef={workspaceRef} />}
      {assistantOpen ? (
        <EvalAssistantDrawer
          repairRequest={repairRequest}
          onClearRepair={() => setRepairRequest(undefined)}
          onRepairUpdated={() => {
            setOverviewRevision((n) => n + 1);
            void refreshRuns();
          }}
          onRepairRun={(run) => {
            showRun(run);
          }}
          activeTab={workspaceTab}
          canManageCases={canManageCases}
          onApplyRules={(seed) => {
            setAssistantOpen(false);
            setRuleApplication(seed);
          }}
          networkId={networkId}
          open
          onNavigate={(tab, caseSection) => {
            if (tab === "cases") {
              openCaseLibrary({ view: caseSection || "library" });
              return;
            }
            if (tab === "runs") {
              setRunWorkspaceTab("records");
              if (runDetailActive) {
                closeRunDetail();
                return;
              }
            }
            onTabChange(tab);
          }}
          onClose={() => {
            setAssistantOpen(false);
            setRepairRequest(undefined);
          }}
          onAdopted={() => setCaseListRevision((revision) => revision + 1)}
          onCreateCase={() => {
            setAssistantOpen(false);
            openCaseLibrary();
            openCaseEditor();
          }}
          onRunSelectedCases={() => {
            setAssistantOpen(false);
            void runSelectedCases();
          }}
          workspace={{
            selectedRunId: selectedRunId ?? undefined,
            caseCount: overview?.cases.total ?? allCaseCount ?? undefined,
            ruleCount: template?.rules.filter((rule) => rule.enabled).length,
            runCount: assistantRuns?.total ?? runList?.total,
            selectedCaseCount: Object.keys(selectedCases).length,
            suiteCount: suiteCount ?? undefined,
            ...(overview
              ? {
                  overview: {
                    generatedAt: overview.generated_at,
                    resources: {
                      total: overview.resources.total,
                      inScope: overview.resources.in_scope,
                      excluded: overview.resources.excluded,
                      covered: overview.resources.covered,
                      evaluated: overview.resources.evaluated,
                      passed: overview.resources.passed,
                      problems: overview.resources.problems,
                      uncovered: overview.resources.uncovered,
                      unresolvedBindings: overview.resources.unresolved_bindings,
                    },
                    rulePoints: {
                      enabledRules: overview.rule_points.enabled_rules,
                      applicable: overview.rule_points.applicable,
                      covered: overview.rule_points.covered,
                      missing: overview.rule_points.missing,
                      notReady: overview.rule_points.not_ready,
                    },
                    cases: {
                      total: overview.cases.total,
                      excluded: overview.cases.excluded,
                      enabled: overview.cases.enabled,
                      runnable: overview.cases.runnable,
                      evaluated: overview.cases.evaluated,
                      passed: overview.cases.passed,
                      failed: overview.cases.failed,
                      inconclusive: overview.cases.inconclusive,
                      reviewRequired: overview.cases.review_required,
                      executionFailed: overview.cases.execution_failed,
                      inProgress: overview.cases.in_progress,
                      cancelled: overview.cases.cancelled,
                      notRun: overview.cases.not_run,
                    },
                    coverage: {
                      resourcePercent: overview.coverage.resource_percent,
                      rulePercent: overview.coverage.rule_percent,
                      executionPercent: overview.coverage.execution_percent,
                      passPercent: overview.coverage.pass_percent,
                    },
                  },
                }
              : {}),
            ...(assistantRuns
              ? {
                  recentRuns: {
                    total: assistantRuns.total,
                    entries: assistantRuns.entries.map((run) => ({
                      id: run.id,
                      ...(run.suite_name ? { suiteName: run.suite_name } : {}),
                      executionStatus: run.execution_status,
                      ...(run.quality_outcome ? { qualityOutcome: run.quality_outcome } : {}),
                      plannedCases: run.progress.planned_cases,
                      completedCases: run.progress.completed_cases,
                      ...(run.created_at ? { createdAt: run.created_at } : {}),
                    })),
                  },
                }
              : {}),
          }}
        />
      ) : null}
      <Drawer
        title={
          overviewResourceDetail
            ? workspaceUi("evaluationDetails", {
                value0: caseResourceTypeLabel(overviewResourceDetail.kind),
              })
            : workspaceUi("resourceEvaluationDetails")
        }
        width="min(1200px, 96vw)"
        open={Boolean(overviewResourceDetail)}
        onClose={() => setOverviewResourceDetail(undefined)}
      >
        {overviewResourceDetail ? (
          <div className={styles.overviewResourceDetail}>
            <div className={styles.overviewResourceDetailToolbar}>
              <Typography.Text>
                {workspaceUi("total")} {overviewResourceRows.length}{" "}
                {workspaceUi("resourceCountSuffix", { count: overviewResourceRows.length })}
              </Typography.Text>
              <Select<OverviewResourceFilter>
                value={overviewResourceDetail.filter}
                options={Object.entries(overviewResourceFilterLabels).map(([value, label]) => ({
                  value: value as OverviewResourceFilter,
                  label,
                }))}
                onChange={(filter) =>
                  setOverviewResourceDetail({ kind: overviewResourceDetail.kind, filter })
                }
              />
            </div>
            <Table<OverviewResourceDetail>
              rowKey={(resource) => `${resource.kind}:${resource.id}`}
              scroll={{ x: 1040 }}
              dataSource={overviewResourceRows}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: workspaceUi("noResourcesMatchTheCurrentFilters") }}
              columns={[
                {
                  title: workspaceUi("knowledgeNetwork.eval.ruleApplication.resource"),
                  dataIndex: "name",
                  render: (name: string, resource) => (
                    <div className={styles.overviewResourceName}>
                      <Button
                        type="link"
                        className={styles.overviewResourceLink}
                        title={workspaceUi("openDetails", {
                          value0: name || evalReferenceLabel("unnamedResource"),
                        })}
                        onClick={() => {
                          void navigate(overviewResourcePath(networkId, resource), {
                            state: buildReturnToState(location),
                          });
                        }}
                      >
                        {name || evalReferenceLabel("unnamedResource")}
                      </Button>
                    </div>
                  ),
                },
                {
                  title: evalTerm("assessmentScope"),
                  dataIndex: "in_scope",
                  width: 110,
                  render: (inScope: boolean) =>
                    inScope ? (
                      <Tag color="blue">
                        {workspaceUi("knowledgeNetwork.eval.caseNavigation.participating")}
                      </Tag>
                    ) : (
                      <Tag>{workspaceUi("knowledgeNetwork.eval.ruleApplication.excluded")}</Tag>
                    ),
                },
                {
                  title: workspaceUi("casesAndResults"),
                  width: 210,
                  render: (_: unknown, resource) => (
                    <div className={styles.overviewResourceCounts}>
                      <span>
                        {resource.case_count}{" "}
                        {workspaceUi("knowledgeNetwork.eval.agentCompare.casesUnit", {
                          count: resource.case_count,
                        })}
                      </span>
                      {resource.case_count > 0 ? (
                        <small>
                          {resource.evaluated_cases}{" "}
                          {workspaceUi("casesWithResults", { count: resource.evaluated_cases })}
                          {resource.problem_cases > 0
                            ? workspaceUi("casesWithIssues", { value0: resource.problem_cases })
                            : ""}
                        </small>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: workspaceUi("currentStatus"),
                  dataIndex: "status",
                  width: 120,
                  render: (status: OverviewResourceDetail["status"]) => {
                    const meta = overviewResourceStatusMeta[status];
                    return meta.color ? <Tag color={meta.color}>{meta.label}</Tag> : meta.label;
                  },
                },
                {
                  title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.actions"),
                  className: styles.overviewResourceActions,
                  width: 280,
                  render: (_: unknown, resource) => (
                    <Space size={12}>
                      {resource.in_scope && canManageCases && template && (
                        <Button
                          type="link"
                          onClick={() => {
                            setOverviewResourceDetail(undefined);
                            setRuleApplication({
                              resources: [{ kind: resource.kind, id: resource.id }],
                              ruleIds: template.rules
                                .filter(
                                  (rule) =>
                                    rule.enabled &&
                                    (rule.kind === resource.kind ||
                                      (resource.kind === "objectType" &&
                                        rule.kind === "objectProperty")),
                                )
                                .map((rule) => rule.id),
                            });
                          }}
                        >
                          {t("knowledgeNetwork.eval.ruleApplication.batchApply")}
                        </Button>
                      )}
                      {resource.in_scope ? (
                        <Button type="link" onClick={() => openOverviewResourceCases(resource)}>
                          {resource.case_count > 0
                            ? workspaceUi(
                                "knowledgeNetwork.eval.resourceOverview.viewConfiguredCases",
                              )
                            : workspaceUi("knowledgeNetwork.eval.resourceOverview.viewCases")}
                        </Button>
                      ) : (
                        <Button
                          type="link"
                          onClick={() => {
                            setOverviewResourceDetail(undefined);
                            setOverviewScopeOpen(true);
                          }}
                        >
                          {workspaceUi("adjustScope")}
                        </Button>
                      )}
                      {resource.latest_run_id ? (
                        <Button type="link" onClick={() => openOverviewResourceRun(resource)}>
                          {workspaceUi("knowledgeNetwork.eval.resourceOverview.viewResult")}
                        </Button>
                      ) : null}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>
      <EvalOverviewScopeDrawer
        networkId={networkId}
        open={overviewScopeOpen}
        canManage={canManageCases}
        onClose={() => setOverviewScopeOpen(false)}
        onSaved={(scope) => {
          setOverview((current) => (current ? { ...current, scope } : current));
          setOverviewRevision((revision) => revision + 1);
        }}
      />
    </div>
  );
}
