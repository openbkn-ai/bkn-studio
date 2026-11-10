/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalTerm } from "./eval-terminology";

import { CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Space, Tag } from "antd";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  AiConversationPanel,
  type AiConversationMessage,
} from "@/modules/knowledge-network/components/shared/AiConversationPanel";
import { AiPromptComposer } from "@/modules/knowledge-network/components/shared/AiPromptComposer";
import {
  EvalRepairPanel,
  type EvalRepairController,
  type EvalRepairConversationView,
} from "./EvalRepairPanel";
import type { EvalRepairRequest } from "./eval-repair.service";

import {
  runEvalAssistant,
  type EvalAssistantAction,
  type EvalAssistantWorkspaceContext,
  type EvalCaseDesignProposal,
} from "./eval-case-designer.service";
import styles from "./EvalAiGenerationDrawer.module.css";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import {
  listEvalCaseResourcesPage,
  type EvalCaseResource,
  getEvalOverview,
  getM0Run,
  listRunCases,
  getRunCaseDetail,
  getEvalTemplateConfig,
  listEvalSuites,
  searchM0Runs,
  type EvalOverview,
} from "./m0-run.service";
import type { EvalTab, EvalTemplateRule } from "./types";
import { previewRuleApplication, type RuleApplicationSeed } from "./rule-application.service";
import { useEvalTranslation } from "./useEvalTranslation";
import { workspaceUi } from "./workspace-ui-text";

type RecommendationItem = {
  resource_id: string;
  resource_name: string;
  resource_kind: string;
  target_id?: string;
  target_name?: string;
  rule_id: string;
  rule_title: string;
  pending_count: number;
  status: "ready" | "blocked" | "unverified";
  configuration: string;
  execution: string;
  reason?: string;
};
type RecommendationPreview = {
  items: RecommendationItem[];
  total: number;
  ready: number;
  blocked: number;
  confirmed_total: number;
  pending_total: number;
};
type Props = {
  networkId: string;
  open: boolean;
  onClose: () => void;
  onAdopted: () => void;
  activeTab?: EvalTab;
  onNavigate?: (tab: EvalTab, caseSection?: "library" | "suites") => void;
  onCreateCase?: () => void;
  onRunSelectedCases?: () => void;
  workspace?: Omit<EvalAssistantWorkspaceContext, "activeSection">;
  canManageCases?: boolean;
  onApplyRules?: (seed: RuleApplicationSeed) => void;
  repairRequest?: EvalRepairRequest;
  onClearRepair?: () => void;
  onRepairUpdated?: () => void;
  onRepairRun?: (run: import("./m0-run.service").M0Run) => void;
};

const tabLabels: Record<EvalTab, string> = {
  get overview() {
    return workspaceUi("overview");
  },
  get plan() {
    return workspaceUi("templateManagement");
  },
  get cases() {
    return workspaceUi("testSuiteManagement");
  },
  get runs() {
    return workspaceUi("runsAndDiagnostics");
  },
};

const tabExamples: Record<EvalTab, string[]> = {
  get overview() {
    return [
      workspaceUi("viewCurrentResourceCoverage"),
      workspaceUi("viewCasesAndRuns"),
      workspaceUi("whichResourcesHaveNoCoverage"),
    ];
  },
  get plan() {
    return [
      workspaceUi("checkWhetherTheCurrentRulesProvideCompleteCoverage"),
      workspaceUi("explainRequiredAndOptionalRules"),
      workspaceUi("suggestRulesForMissingScenarios"),
    ];
  },
  get cases() {
    return [
      workspaceUi("howDoICreateACase"),
      workspaceUi("howDoICreateATestSuiteFromThe"),
      workspaceUi("whichCasesCanRunNow"),
    ];
  },
  get runs() {
    return [
      workspaceUi("viewRecentRunRecords"),
      workspaceUi("analyzeFailedOrInconclusiveCases"),
      workspaceUi("howDoIConfigureARunPlan"),
    ];
  },
};

const assistantDestinations: Array<{
  key: string;
  label: string;
  tab: EvalTab;
  caseSection?: "library" | "suites";
}> = [
  {
    key: "overview",
    get label() {
      return workspaceUi("overview");
    },
    tab: "overview",
  },
  {
    key: "plan",
    get label() {
      return workspaceUi("templateManagement");
    },
    tab: "plan",
  },
  {
    key: "cases",
    get label() {
      return workspaceUi("testSuiteManagement");
    },
    tab: "cases",
  },
  {
    key: "runs",
    get label() {
      return workspaceUi("runsAndDiagnostics");
    },
    tab: "runs",
  },
];

const assistantActionLabels: Record<EvalAssistantAction["type"], string> = {
  get overview() {
    return workspaceUi("openOverview");
  },
  get plan() {
    return workspaceUi("openTemplateManagement");
  },
  get case_library() {
    return workspaceUi("openCaseLibrary");
  },
  get suites() {
    return workspaceUi("openTestSuites");
  },
  get runs() {
    return workspaceUi("openRunsAndDiagnostics");
  },

  get create_case() {
    return workspaceUi("knowledgeNetwork.eval.resourceOverview.createCase");
  },
  get run_selected_cases() {
    return workspaceUi("runSelectedCases");
  },
};

function assistantOverviewSnapshot(
  overview: EvalOverview,
): NonNullable<EvalAssistantWorkspaceContext["overview"]> {
  return {
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
  };
}

const catalogErrorMessage = (cause: unknown) => {
  if (axios.isAxiosError(cause)) {
    switch (cause.response?.status) {
      case 401:
        return workspaceUi("yourSessionHasExpiredSignInAgainAndRefresh");
      case 403:
        return workspaceUi("thisAccountCannotReadTheResourcesOrRules");
      case 404:
      case 503:
        return workspaceUi("theEvaluationContextServiceIsUnavailableUseRefreshIn");
      case 424:
        return workspaceUi("couldNotLoadResourcesOrRulesUseRefreshIn");
    }
  }
  return workspaceUi("cannotLoadResourcesAndRulesYetUseRefreshIn");
};

const planItemKey = (item: RecommendationItem) =>
  `${item.resource_kind}:${item.resource_id}:${item.target_id ?? ""}:${item.rule_id}`;

const newMessage = (
  role: AiConversationMessage["role"],
  content: string,
  tone?: AiConversationMessage["tone"],
): AiConversationMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  ...(tone ? { tone } : {}),
});

export function EvalAssistantDrawer({
  networkId,
  open,
  onClose,
  onAdopted,
  activeTab = "cases",
  onNavigate,
  onCreateCase,
  onRunSelectedCases,
  workspace,
  canManageCases = true,
  onApplyRules,
  repairRequest,
  onClearRepair,
  onRepairUpdated,
  onRepairRun,
}: Props) {
  const { t } = useEvalTranslation();
  const { runtimeConfig } = useAppServices();
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const catalogRequest = useRef(0);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState("");
  const [scan, setScan] = useState<{ resources: EvalCaseResource[]; total: number }>();
  const [rules, setRules] = useState<EvalTemplateRule[]>([]);
  const [conversation, setConversation] = useState<AiConversationMessage[]>([]);
  const [promptRequest, setPromptRequest] = useState<{ revision: number; value: string }>();
  const [proposal, setProposal] = useState<EvalCaseDesignProposal>();
  const [assistantActions, setAssistantActions] = useState<EvalAssistantAction[]>([]);
  const [preview, setPreview] = useState<RecommendationPreview>();
  const [selectedPreviewKeys, setSelectedPreviewKeys] = useState<string[]>([]);
  const aiAbortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);
  const repairController = useRef<EvalRepairController | null>(null);
  const [repairView, setRepairView] = useState<EvalRepairConversationView & { id: string }>();
  const onRepairViewChange = useCallback(
    (view: EvalRepairConversationView) => {
      if (repairRequest) setRepairView({ ...view, id: repairRequest.id });
    },
    [repairRequest],
  );
  const activeRepairView = repairView?.id === repairRequest?.id ? repairView : undefined;

  const enabledRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const examples = tabExamples[activeTab];
  const activeSection = tabLabels[activeTab];
  const assistantWorkspace = useMemo<EvalAssistantWorkspaceContext>(
    () => ({
      ...workspace,
      activeSection,
      ruleCount: scan ? enabledRules.length : workspace?.ruleCount,
      resourceContextAvailable: Boolean(scan) && !catalogError,
    }),
    [activeSection, enabledRules.length, workspace, scan, catalogError],
  );
  const recommendationReasons = useMemo(
    () =>
      new Map(
        (proposal?.suggestions ?? []).map((item) => [
          `${item.resource_key}:${item.rule_id}`,
          item.reason,
        ]),
      ),
    [proposal],
  );
  const locked = repairRequest ? Boolean(activeRepairView?.locked) : aiGenerating;

  const appendReply = (content: string, tone?: "error") =>
    setConversation((current) => [...current, newMessage("assistant", content, tone)]);

  const clearProposal = () => {
    setAssistantActions([]);
    setProposal(undefined);
    setPreview(undefined);
    setSelectedPreviewKeys([]);
  };

  const startNewConversation = () => {
    onClearRepair?.();
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    threadIdRef.current = undefined;
    setAiGenerating(false);
    setConversation([]);
    setPromptRequest(undefined);
    setError("");
    clearProposal();
  };

  useEffect(() => {
    if (!repairRequest) return;
    setCatalogLoading(false);
    aiAbortRef.current?.abort();
    threadIdRef.current = undefined;
    setAiGenerating(false);
    setConversation([]);
    setError("");
    setPromptRequest(undefined);
    clearProposal();
  }, [repairRequest]);

  const loadCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError("");
    setScan(undefined);
    setRules([]);
    try {
      const [resourceScan, config] = await Promise.all([
        (async () => {
          const first = await listEvalCaseResourcesPage(networkId, "", "", 1, 100, true);
          const second =
            first.total > 100
              ? await listEvalCaseResourcesPage(networkId, "", "", 2, 100, true)
              : undefined;
          if (first.read_issues?.length || second?.read_issues?.length)
            throw new Error(workspaceUi("someResourcesHaveNotLoadedRefreshAndTryAgain"));
          return { resources: [...first.entries, ...(second?.entries ?? [])], total: first.total };
        })(),
        getEvalTemplateConfig(networkId),
      ]);
      if (catalogRequest.current !== request) return;
      setScan(resourceScan);
      setRules(config.rules);
      return { resourceScan, config };
    } catch (cause) {
      if (catalogRequest.current === request) setCatalogError(catalogErrorMessage(cause));
    } finally {
      if (catalogRequest.current === request) setCatalogLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    if (!open || repairRequest) return;
    void loadCatalog();
    return () => {
      catalogRequest.current += 1;
    };
  }, [open, loadCatalog, repairRequest]);

  useEffect(() => {
    if (open) return;
    setCatalogLoading(false);
    setCatalogError("");
    setScan(undefined);
    setRules([]);
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    threadIdRef.current = undefined;
    setAiGenerating(false);
    setConversation([]);
    setPromptRequest(undefined);
    setAssistantActions([]);
    setProposal(undefined);
    setPreview(undefined);
    setSelectedPreviewKeys([]);
    setError("");
  }, [open]);

  const refreshCatalog = () => {
    void loadCatalog().then((loaded) => {
      if (!loaded) return;
      startNewConversation();
      appendReply(
        workspaceUi("refreshedResourcesAndRulesResourcesAndEnabledRulesLoaded", {
          value0: loaded.resourceScan.resources.length,
          value1: loaded.config.rules.filter((rule) => rule.enabled).length,
        }),
      );
    });
  };

  const loadAssistantWorkspace = async (
    goal: string,
    signal: AbortSignal,
  ): Promise<EvalAssistantWorkspaceContext> => {
    const [overviewResult, suitesResult, runsResult] = await Promise.allSettled([
      getEvalOverview(networkId),
      listEvalSuites(networkId, 1),
      searchM0Runs(networkId, { page: 1, limit: 5 }),
    ]);
    const current: EvalAssistantWorkspaceContext = { ...assistantWorkspace };
    if (overviewResult.status === "fulfilled") {
      current.overview = assistantOverviewSnapshot(overviewResult.value);
      current.caseCount = overviewResult.value.cases.total;
    }
    if (suitesResult.status === "fulfilled") current.suiteCount = suitesResult.value.total;
    if (runsResult.status === "fulfilled") {
      current.runCount = runsResult.value.total;
      current.recentRuns = {
        total: runsResult.value.total,
        entries: runsResult.value.entries.map((run) => ({
          id: run.id,
          ...(run.suite_name ? { suiteName: run.suite_name } : {}),
          executionStatus: run.execution_status,
          ...(run.quality_outcome ? { qualityOutcome: run.quality_outcome } : {}),
          plannedCases: run.progress.planned_cases,
          completedCases: run.progress.completed_cases,
          ...(run.created_at ? { createdAt: run.created_at } : {}),
        })),
      };
    }
    const quoted = [...goal.matchAll(/[“「"]([^”」"]+)[”」"]/g)].map((match) => match[1]);
    const requestedId = goal.match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    )?.[0];
    if (
      requestedId ||
      /(?:采样|全量|证据|运行.*(?:详情|明细|结果)|分析.*运行)|\b(?:sampl(?:e|es|ed|ing)|full(?:[-\s]+(?:scan|dataset|coverage))?|evidence|run.*(?:details?|results?)|analy[sz](?:e|ing).*\bruns?\b)\b/i.test(
        goal,
      )
    ) {
      try {
        let candidates = runsResult.status === "fulfilled" ? runsResult.value.entries : [];
        const phrase = quoted.find((text) => text.length > 3);
        if (phrase)
          candidates = (await searchM0Runs(networkId, { page: 1, limit: 5, q: phrase }, signal))
            .entries;
        const id =
          requestedId ??
          (phrase ? undefined : current.selectedRunId) ??
          candidates.find((run) => run.execution_status === "completed")?.id;
        if (id) {
          const run = await getM0Run(networkId, id, signal);
          const cases = await listRunCases(networkId, id, undefined, undefined, signal);
          const members = [...cases.entries];
          let next = cases.next_cursor;
          const visited = new Set<string>();
          // Read pages only for this explicit evidence question. A single Run
          // is bounded to 50 summaries; raw Trace has a separate API and is not loaded.
          while (next && members.length < 50 && !visited.has(next)) {
            visited.add(next);
            const page = await listRunCases(networkId, id, next, undefined, signal);
            members.push(...page.entries);
            next = page.next_cursor;
          }
          const entries = [...new Map(members.map((item) => [item.id, item])).values()].slice(
            0,
            50,
          );
          const details: Array<Awaited<ReturnType<typeof getRunCaseDetail>> | undefined> =
            Array.from({ length: entries.length }, () => undefined);
          let index = 0;
          await Promise.all(
            Array.from({ length: Math.min(3, entries.length) }, async () => {
              while (index < entries.length) {
                const itemIndex = index++;
                try {
                  details[itemIndex] = await getRunCaseDetail(
                    networkId,
                    id,
                    entries[itemIndex].id,
                    run.result_revision ?? undefined,
                    signal,
                  );
                } catch (cause) {
                  if (signal.aborted) throw cause;
                }
              }
            }),
          );
          const loaded = details.flatMap((item) => (item ? [item] : []));
          current.runDetails = {
            id,
            executionStatus: run.execution_status,
            qualityOutcome: run.quality_outcome,
            resultRevision: run.result_revision,
            totalCases: Math.max(cases.total, run.progress?.planned_cases ?? 0),
            complete: loaded.length === Math.max(cases.total, run.progress?.planned_cases ?? 0),
            cases: loaded.map((item, itemIndex) => ({
              id: item.id,
              title: item.case_title,
              outcome: item.quality_outcome,
              querySummary: item.observation?.query_summary,
              facts: item.observation?.facts,
              evidenceStatus: item.observation?.evidence_status,
              failureClass: item.observation?.failure_class,
              actual:
                itemIndex >= 5
                  ? undefined
                  : JSON.stringify(item.observation?.normalized_output ?? {}).length <= 8192
                    ? item.observation?.normalized_output
                    : { omitted: workspaceUi("theResponseIsLargeOpenTheCaseResultTo") },
              findings: itemIndex < 5 ? item.findings.slice(0, 5) : undefined,
            })),
          };
          if (loaded.length !== Math.min(cases.total, 50))
            current.evidenceReadError = workspaceUi("someCaseDetailsCouldNotBeLoadedDoNot");
        }
      } catch {
        current.evidenceReadError = workspaceUi("couldNotLoadDetailsAndEvidenceForTheSpecified");
      }
    }
    return current;
  };

  const submitPrompt = async (submittedPrompt: string) => {
    const prompt = submittedPrompt.trim();
    if (!prompt || locked) return;
    setPromptRequest(undefined);
    setConversation((current) => [...current, newMessage("user", prompt)]);
    setError("");
    clearProposal();
    setAiGenerating(true);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const currentWorkspace = await loadAssistantWorkspace(prompt, controller.signal);
      if (controller.signal.aborted) return;
      const result = await runEvalAssistant({
        base: typeof window === "undefined" ? "" : window.location.origin,
        tokenProvider: {
          getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
          refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
        },
        knId: networkId,
        goal: prompt,
        resources: scan?.resources ?? [],
        rules: enabledRules,
        workspace: currentWorkspace,
        ...(threadIdRef.current ? { threadId: threadIdRef.current } : {}),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      threadIdRef.current = result.threadId;
      if (!result.proposal) {
        setAssistantActions(result.actions ?? []);
        appendReply(result.answer);
        return;
      }
      if (!scan) {
        appendReply(workspaceUi("noResourcesAvailableForCaseGenerationHaveBeenLoaded"), "error");
        return;
      }
      const targets = result.proposal.suggestions.map((item) => ({
        resource_key: item.resource_key,
        rule_id: item.rule_id,
      }));
      if (!onApplyRules || !canManageCases) {
        appendReply(result.answer);
        return;
      }
      const resourceKeys = new Set(targets.map((target) => target.resource_key));
      const request = {
        resources: scan.resources
          .filter((resource) => resourceKeys.has(`${resource.kind}:${resource.id}`))
          .map(({ kind, id }) => ({ kind, id })),
        rule_ids: [...new Set(targets.map((target) => target.rule_id))],
        targets,
        page: 1,
        limit: 100,
      };
      const first = await previewRuleApplication(networkId, request);
      const rows = [...first.entries];
      // Bound the visible proposal explicitly, while keeping selection across local pages.
      for (let page = 2; rows.length < Math.min(first.total, 200); page += 1) {
        const next = await previewRuleApplication(networkId, { ...request, page });
        if (controller.signal.aborted) return;
        if (!next.entries.length) break;
        rows.push(...next.entries);
      }
      const items: RecommendationItem[] = rows.map((row) => ({
        resource_id: row.resource.id,
        resource_name: row.resource_name,
        resource_kind: row.resource.kind,
        target_id: row.target_id,
        target_name: row.target_name,
        rule_id: row.rule_id,
        rule_title: row.rule_title,
        pending_count: row.existing_case_id ? 1 : 0,
        configuration: row.configuration,
        execution: row.execution,
        status:
          row.match !== "applicable" ? "unverified" : row.ready_for_save ? "ready" : "blocked",
        reason:
          row.match !== "applicable"
            ? row.match_reason
            : row.save_error || row.missing.join("；") || row.execution_reason,
      }));
      const nextPreview: RecommendationPreview = {
        items,
        total: first.total,
        ready: items.filter((item) => item.status === "ready").length,
        blocked: items.filter((item) => item.status === "blocked").length,
        confirmed_total: 0,
        pending_total: items.filter((item) => item.pending_count > 0).length,
      };
      setProposal(result.proposal);
      setPreview(nextPreview);
      setSelectedPreviewKeys(
        nextPreview.items.filter((item) => item.status !== "unverified").map(planItemKey),
      );
      appendReply(
        workspaceUi("recommendationPreflightSummary", {
          value0: result.proposal.summary || result.answer,
          value1: first.total,
          value2: items.length,
          value3:
            items.length < first.total
              ? workspaceUi("narrowRecommendationScope")
              : workspaceUi("configurableRecommendationsHint"),
        }),
      );
    } catch (cause) {
      if (controller.signal.aborted) {
        appendReply(workspaceUi("generationStopped"), "error");
      } else {
        const detail =
          cause instanceof Error ? cause.message : workspaceUi("aIGenerationFailedTryAgainLater");
        setError(detail);
        appendReply(detail, "error");
      }
    } finally {
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
      setAiGenerating(false);
    }
  };

  const performAssistantAction = (action: EvalAssistantAction) => {
    if (action.type === "create_case") {
      onCreateCase?.();
      return;
    }
    if (action.type === "run_selected_cases") {
      onRunSelectedCases?.();
      return;
    }
    const destinations: Record<
      Exclude<EvalAssistantAction["type"], "create_case" | "run_selected_cases">,
      { tab: EvalTab; caseSection?: "library" | "suites" }
    > = {
      overview: { tab: "overview" },
      plan: { tab: "plan" },
      case_library: { tab: "cases", caseSection: "library" },
      suites: { tab: "cases", caseSection: "suites" },
      runs: { tab: "runs" },
    };
    const destination = destinations[action.type];
    onNavigate?.(destination.tab, destination.caseSection);
  };

  if (!open) return null;

  return (
    <AiConversationPanel
      as="aside"
      className={styles.assistantPanel}
      ariaLabel={workspaceUi("qualityEvaluationAIAssistant")}
      composer={
        <AiPromptComposer
          checking={repairRequest ? Boolean(activeRepairView?.locked) : catalogLoading}
          generating={repairRequest ? (activeRepairView?.thinking ?? true) : aiGenerating}
          inputLabel={workspaceUi("askTheQualityEvaluationAIAssistant")}
          model={{
            ariaLabel: workspaceUi("responseModel"),
            defaultLabel: workspaceUi("platformDefaultModel"),
            loading: false,
            locked: false,
            onChange: () => undefined,
            options: [],
            unavailable: false,
            unavailableLabel: workspaceUi("theModelListIsCurrentlyUnavailable"),
          }}
          onStop={() =>
            repairRequest ? repairController.current?.stop() : aiAbortRef.current?.abort()
          }
          onSubmit={(prompt) =>
            repairRequest ? repairController.current?.submit(prompt) : void submitPrompt(prompt)
          }
          placeholder={
            repairRequest
              ? t("knowledgeNetwork.eval.repair.inputPlaceholder")
              : workspaceUi("askAboutResourceCoverageEvaluationRulesCasesTestSuites")
          }
          promptRequest={promptRequest}
          sendLabel={workspaceUi("send")}
          stopLabel={workspaceUi("stopGenerating")}
        />
      }
      contentTestId="eval-ai-scroll-content"
      description={
        repairRequest ? (
          t("knowledgeNetwork.eval.repair.description")
        ) : (
          <>{workspaceUi("askAboutAndUseTheEntireQualityEvaluationModule")}</>
        )
      }
      examples={repairRequest ? [] : examples}
      examplesLabel={workspaceUi("examples")}
      generating={repairRequest ? (activeRepairView?.thinking ?? true) : aiGenerating}
      generatingText={
        repairRequest
          ? t("knowledgeNetwork.eval.repair.analyzing")
          : workspaceUi("analyzingTheCurrentQualityEvaluationContext")
      }
      headerActions={
        <>
          {conversation.length || repairRequest ? (
            <Button disabled={locked} onClick={startNewConversation} size="small" type="text">
              {workspaceUi("newConversation")}
            </Button>
          ) : null}
          <Button
            aria-label={workspaceUi("refreshQualityEvaluationContext")}
            disabled={locked || Boolean(repairRequest)}
            icon={<ReloadOutlined />}
            loading={catalogLoading}
            onClick={refreshCatalog}
            type="text"
          />
          <Button
            aria-label={workspaceUi("closeTheQualityEvaluationAIAssistant")}
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        </>
      }
      messages={repairRequest ? (activeRepairView?.messages ?? []) : conversation}
      notice={
        !repairRequest && (error || catalogError) ? (
          <Alert showIcon type="error" message={error || catalogError} />
        ) : null
      }
      onExample={(example) =>
        setPromptRequest((current) => ({
          revision: (current?.revision ?? 0) + 1,
          value: example,
        }))
      }
      subtitle={
        repairRequest
          ? t("knowledgeNetwork.eval.repair.target", { name: repairRequest.target.name })
          : catalogLoading
            ? workspaceUi("loadingTheCurrentKnowledgeNetwork", { value0: tabLabels[activeTab] })
            : catalogError
              ? workspaceUi("couldNotLoadEvaluationContext", { value0: tabLabels[activeTab] })
              : scan
                ? workspaceUi("resourcesEnabledRules", {
                    value0: tabLabels[activeTab],
                    value1: scan.resources.length,
                    value2: scan.total,
                    value3: enabledRules.length,
                  })
                : workspaceUi("evaluationContextNotLoaded", { value0: tabLabels[activeTab] })
      }
      title={workspaceUi("qualityEvaluationAIAssistant")}
    >
      {repairRequest ? (
        <EvalRepairPanel
          key={repairRequest.id}
          networkId={networkId}
          request={repairRequest}
          controllerRef={repairController}
          onViewChange={onRepairViewChange}
          onUpdated={onRepairUpdated ?? onAdopted}
          onInspectRun={(run) => onRepairRun?.(run)}
        />
      ) : null}
      {!repairRequest && conversation.length === 0 ? (
        <nav
          className={styles.assistantNavigation}
          aria-label={workspaceUi("qualityEvaluationShortcuts")}
        >
          <span>{workspaceUi("quickAccess")}</span>
          {assistantDestinations.map((destination) => (
            <Button
              key={destination.key}
              className={styles.assistantNavigationItem}
              aria-current={destination.tab === activeTab ? "page" : undefined}
              onClick={() => onNavigate?.(destination.tab, destination.caseSection)}
              size="small"
              type="text"
            >
              {destination.label}
            </Button>
          ))}
        </nav>
      ) : null}
      {!repairRequest && assistantActions.length ? (
        <section
          className={styles.assistantActions}
          aria-label={workspaceUi("aISuggestedNextActions")}
        >
          <div>
            <strong>{workspaceUi("suggestedActions")}</strong>
            <span>{workspaceUi("actionsRunAfterYourConfirmationAndFollowCurrentPermissions")}</span>
          </div>
          <Space wrap size={8}>
            {assistantActions.map((action) => (
              <Button
                disabled={
                  (action.type === "create_case" && !canManageCases) ||
                  (action.type === "run_selected_cases" && !workspace?.selectedCaseCount)
                }
                key={action.type}
                onClick={() => performAssistantAction(action)}
                size="small"
                type={action.type === "create_case" ? "primary" : "default"}
              >
                {assistantActionLabels[action.type]}
                {action.type === "run_selected_cases" && workspace?.selectedCaseCount
                  ? `（${workspace.selectedCaseCount}）`
                  : ""}
              </Button>
            ))}
          </Space>
        </section>
      ) : null}
      {!repairRequest && preview ? (
        <section
          className={styles.proposal}
          aria-label={workspaceUi("aIRecommendedCandidateCases")}
        >
          <div className={styles.proposalHeader}>
            <div>
              <strong>{workspaceUi("candidateCases")}</strong>
              <span>{workspaceUi("selectTheCheckScenariosToGenerateOrContinueThe")}</span>
            </div>
            <Space wrap size={6}>
              {proposal ? (
                <Tag>
                  {workspaceUi("aIRecommendations")} {proposal.suggestions.length}{" "}
                  {workspaceUi("cases", { count: proposal.suggestions.length })}
                </Tag>
              ) : null}
              <Tag color="success">
                {workspaceUi("readyToSave")} {preview.ready}{" "}
                {workspaceUi("cases", { count: preview.ready })}
              </Tag>
              <Tag>
                {workspaceUi("showing")} {preview.items.length} / {preview.total}{" "}
                {workspaceUi("checks", { count: preview.total })}
              </Tag>
              <Tag>
                {workspaceUi("casesAvailable")} {preview.confirmed_total + preview.pending_total}{" "}
                {workspaceUi("cases", { count: preview.confirmed_total + preview.pending_total })}
              </Tag>
              {preview.blocked ? (
                <Tag color="warning">
                  {workspaceUi("needsInformation")} {preview.blocked}{" "}
                  {workspaceUi("cases", { count: preview.blocked })}
                </Tag>
              ) : null}
            </Space>
          </div>
          <Table<RecommendationItem>
            scroll={{ x: 960 }}
            columns={[
              {
                title: evalTerm("checkTarget"),
                width: 220,
                ellipsis: true,
                render: (_, item) => item.target_name || item.resource_name,
              },
              {
                title: evalTerm("relatedRule"),
                dataIndex: "rule_title",
                width: 220,
                ellipsis: true,
              },
              {
                title: workspaceUi("recommendationReason"),
                ellipsis: true,
                render: (_, item) =>
                  recommendationReasons.get(
                    `${item.resource_kind}:${item.resource_id}:${item.rule_id}`,
                  ) ||
                  item.reason ||
                  workspaceUi("ruleApplicabilityMatched"),
              },
              {
                title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.enabled"),
                dataIndex: "status",
                width: 128,
                render: (_, item) => (
                  <Space direction="vertical" size={0}>
                    <Tag color={item.configuration === "complete" ? "success" : "warning"}>
                      {item.configuration === "complete"
                        ? workspaceUi("knowledgeNetwork.eval.ruleApplication.complete")
                        : workspaceUi("configurationNeeded")}
                    </Tag>
                    <Tag color={item.status === "ready" ? "success" : "warning"}>
                      {item.status === "ready"
                        ? workspaceUi("readyToSave")
                        : item.execution === "unsupported"
                          ? workspaceUi("executionNotSupportedYet")
                          : workspaceUi("awaitingConfigurationOrPreflight")}
                    </Tag>
                    {item.reason && <span>{item.reason}</span>}
                  </Space>
                ),
              },
              {
                title: workspaceUi("knowledgeNetwork.eval.templateUi.columns.actions"),
                width: 112,
                render: (_, item) =>
                  item.status === "blocked" ? (
                    <Button
                      onClick={() =>
                        onApplyRules?.({
                          ruleIds: [item.rule_id],
                          resources: [{ kind: item.resource_kind, id: item.resource_id }],
                          targets: [
                            {
                              resource_key: `${item.resource_kind}:${item.resource_id}`,
                              rule_id: item.rule_id,
                              ...(item.target_id ? { target_id: item.target_id } : {}),
                            },
                          ],
                        })
                      }
                      size="small"
                      type="link"
                    >
                      {workspaceUi("create")}
                    </Button>
                  ) : null,
              },
            ]}
            dataSource={preview.items}
            pagination={{ pageSize: 6, showSizeChanger: false }}
            rowKey={planItemKey}
            rowSelection={{
              selectedRowKeys: selectedPreviewKeys,
              preserveSelectedRowKeys: true,
              getCheckboxProps: (item) => ({
                disabled: item.status === "unverified",
              }),
              onChange: (keys) => setSelectedPreviewKeys(keys.map(String)),
            }}
            size="small"
          />
          <div className={styles.proposalActions}>
            <span>
              {workspaceUi("selected")} {selectedPreviewKeys.length}{" "}
              {workspaceUi("cases", { count: selectedPreviewKeys.length })}
            </span>
            {onApplyRules && (
              <Button
                disabled={!canManageCases || locked || !selectedPreviewKeys.length}
                onClick={() => {
                  const items = preview.items.filter((item) =>
                    selectedPreviewKeys.includes(planItemKey(item)),
                  );
                  const resources = new Map(
                    items.map((item) => [
                      `${item.resource_kind}:${item.resource_id}`,
                      { kind: item.resource_kind, id: item.resource_id },
                    ]),
                  );
                  onApplyRules({
                    ruleIds: [...new Set(items.map((item) => item.rule_id))],
                    resources: [...resources.values()],
                    targets: items.map((item) => ({
                      resource_key: `${item.resource_kind}:${item.resource_id}`,
                      rule_id: item.rule_id,
                      ...(item.target_id ? { target_id: item.target_id } : {}),
                    })),
                  });
                }}
              >
                {t("knowledgeNetwork.eval.ruleApplication.batchApply")}
              </Button>
            )}
          </div>
        </section>
      ) : null}
    </AiConversationPanel>
  );
}
