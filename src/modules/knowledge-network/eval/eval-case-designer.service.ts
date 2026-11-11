/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import "./locales";
import { REGRESSION_SUITE_TAG } from "./types";

import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import {
  EVAL_ASSISTANT_AGENT_ID,
  newClientRequestId,
  startExecution,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import type { EvalExecutionFacts, EvalTemplateResource } from "./m0-run.service";
import type { EvalTemplateRule } from "./types";
import {
  readableEvalText,
  repairReadableReferences,
  evalReferenceLabel,
  type EvalReadableReference,
} from "./eval-readable-references";
import type { EvalRepairContext, EvalRepairProposal } from "./eval-repair.service";

const assistantText = (key: string, values?: Record<string, unknown>): string =>
  i18n.t(`knowledgeNetwork.eval.foundation.assistant.${key}`, {
    ...values,
    interpolation: { escapeValue: false },
  });

export type EvalCaseDesignSuggestion = {
  resource_key: string;
  rule_id: string;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type EvalCaseDesignProposal = {
  kind: "eval_case_recommendation";
  summary: string;
  suggestions: EvalCaseDesignSuggestion[];
};

type RunEvalAssistantBaseParams = {
  base: string;
  tokenProvider: AgentTokenProvider;
  knId: string;
  goal: string;
  resources: EvalTemplateResource[];
  rules: EvalTemplateRule[];
  threadId?: string;
  signal?: AbortSignal;
  onText?: (text: string) => void;
};

export type EvalAssistantWorkspaceContext = {
  repairContext?: EvalRepairContext;
  repairPlan?: EvalRepairProposal;
  repairInstructions?: string[];
  repairExecution?: {
    status: string;
    runId?: string;
    executionStatus?: string;
    qualityOutcome?: string | null;
  };
  selectedRunId?: string;
  runDetails?: {
    id: string;
    executionStatus?: string;
    qualityOutcome?: string | null;
    resultRevision?: number | null;
    complete: boolean;
    totalCases: number;
    cases: Array<{
      id: string;
      title?: string;
      outcome?: string | null;
      querySummary?: unknown;
      facts?: EvalExecutionFacts;
      evidenceStatus?: string;
      failureClass?: string;
      actual?: unknown;
      findings?: unknown;
    }>;
  };
  evidenceReadError?: string;
  resourceContextAvailable?: boolean;
  activeSection: string;
  caseCount?: number;
  ruleCount?: number;
  runCount?: number;
  selectedCaseCount?: number;
  suiteCount?: number;
  overview?: {
    generatedAt: string;
    resources: {
      total: number;
      inScope: number;
      excluded: number;
      covered: number;
      evaluated: number;
      passed: number;
      problems: number;
      uncovered: number;
      unresolvedBindings: number;
    };
    rulePoints: {
      enabledRules: number;
      applicable: number;
      covered: number;
      missing: number;
      notReady: number;
    };
    cases: {
      total: number;
      excluded: number;
      enabled: number;
      runnable: number;
      evaluated: number;
      passed: number;
      failed: number;
      inconclusive: number;
      reviewRequired: number;
      executionFailed: number;
      inProgress: number;
      cancelled: number;
      notRun: number;
    };
    coverage: {
      resourcePercent: number;
      rulePercent: number;
      executionPercent: number;
      passPercent: number;
    };
  };
  recentRuns?: {
    total: number;
    entries: Array<{
      id: string;
      suiteName?: string;
      executionStatus: string;
      qualityOutcome?: string;
      plannedCases: number;
      completedCases: number;
      createdAt?: string;
    }>;
  };
};

export type EvalAssistantAction = {
  type:
    "overview" | "plan" | "case_library" | "suites" | "runs" | "create_case" | "run_selected_cases";
};

type RunEvalAssistantParams = RunEvalAssistantBaseParams & {
  workspace: EvalAssistantWorkspaceContext;
};

export type EvalAssistantResult = {
  answer: string;
  actions?: EvalAssistantAction[];
  proposal?: EvalCaseDesignProposal;
  threadId?: string;
  repair?: unknown;
};

const assistantActionTypes = new Set<EvalAssistantAction["type"]>([
  "overview",
  "plan",
  "case_library",
  "suites",
  "runs",
  "create_case",
  "run_selected_cases",
]);

const resourceKey = (resource: EvalTemplateResource) => `${resource.kind}:${resource.id}`;

const compatible = (resource: EvalTemplateResource, rule: EvalTemplateRule) =>
  rule.kind === resource.kind || (rule.kind === "objectProperty" && resource.kind === "objectType");

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function jsonValue(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = (fenced ?? value).trim();
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error(assistantText("unparseable"));
    return JSON.parse(source.slice(start, end + 1));
  }
}

export function parseEvalCaseDesignProposal(
  value: unknown,
  resources: EvalTemplateResource[],
  rules: EvalTemplateRule[],
): EvalCaseDesignProposal {
  const proposal = typeof value === "string" ? record(jsonValue(value)) : record(value);
  if (
    proposal?.kind !== "eval_case_recommendation" ||
    typeof proposal.summary !== "string" ||
    !Array.isArray(proposal.suggestions) ||
    proposal.suggestions.length > 500
  ) {
    throw new Error(assistantText("invalidProposal"));
  }
  const resourceMap = new Map(resources.map((item) => [resourceKey(item), item]));
  const ruleMap = new Map(rules.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const suggestions: EvalCaseDesignSuggestion[] = [];
  for (const raw of proposal.suggestions) {
    const item = record(raw);
    const key = typeof item?.resource_key === "string" ? item.resource_key : "";
    const ruleId = typeof item?.rule_id === "string" ? item.rule_id : "";
    const reason = typeof item?.reason === "string" ? item.reason.trim() : "";
    const confidence = item?.confidence;
    const resource = resourceMap.get(key);
    const rule = ruleMap.get(ruleId);
    const pair = `${key}:${ruleId}`;
    if (
      !resource ||
      !rule ||
      !compatible(resource, rule) ||
      !reason ||
      !["high", "medium", "low"].includes(String(confidence)) ||
      seen.has(pair)
    ) {
      continue;
    }
    seen.add(pair);
    suggestions.push({
      resource_key: key,
      rule_id: ruleId,
      reason,
      confidence: confidence as EvalCaseDesignSuggestion["confidence"],
    });
  }
  if (suggestions.length === 0) throw new Error(assistantText("noScenarios"));
  return { kind: "eval_case_recommendation", summary: proposal.summary.trim(), suggestions };
}

function assistantPrompt(params: RunEvalAssistantParams) {
  if (params.workspace.repairContext) {
    return [
      assistantText("prompts.responseLanguage"),
      assistantText("prompts.repairIntro"),
      assistantText("prompts.repairUntrustedData"),
      assistantText("prompts.repairDiscussion"),
      assistantText("prompts.repairAnalysisOnly"),
      assistantText("prompts.repairSubmitted"),
      assistantText("prompts.repairVisibleReferences"),
      assistantText("prompts.repairConfirmation"),
      assistantText("prompts.repairPropertyType"),
      assistantText("prompts.repairBoundaries"),
      assistantText("prompts.repairFieldConstraints"),
      assistantText("prompts.repairJson"),
      assistantText("prompts.repairContext", {
        value: JSON.stringify(params.workspace.repairContext),
      }),
      assistantText("prompts.previousPlan", {
        value: JSON.stringify(params.workspace.repairPlan ?? null),
      }),
      assistantText("prompts.instructions", {
        value: JSON.stringify(params.workspace.repairInstructions ?? []),
      }),
      assistantText("prompts.repairExecution", {
        value: JSON.stringify(params.workspace.repairExecution ?? null),
      }),
      assistantText("prompts.request", { value: params.goal }),
    ].join("\n");
  }
  const candidates = params.resources.map((resource) => ({
    resource_key: resourceKey(resource),
    name: resource.name,
    kind: resource.kind,
    compatible_rule_ids: params.rules
      .filter((rule) => compatible(resource, rule))
      .map((rule) => rule.id),
  }));
  const ruleCatalog = params.rules.map((rule) => ({
    id: rule.id,
    name: rule.title,
    resource_kind: rule.kind,
    check: rule.description,
    required: rule.preset === "required",
  }));
  return [
    assistantText("prompts.responseLanguage"),
    assistantText("prompts.intro"),
    assistantText("prompts.terminology"),
    assistantText("prompts.navigation"),
    assistantText("prompts.runNavigation"),
    assistantText("prompts.regression", { regressionTag: REGRESSION_SUITE_TAG }),
    assistantText("prompts.unavailableContext"),
    assistantText("prompts.statistics"),
    assistantText("prompts.visibleReferences"),
    assistantText("prompts.readOnlyClaims"),
    assistantText("prompts.ordinaryAnswer"),
    assistantText("prompts.actionIntent"),
    assistantText("prompts.actionJson"),
    assistantText("prompts.generationIntent"),
    assistantText("prompts.scenarioSkeleton"),
    assistantText("prompts.scenarioCount"),
    assistantText("prompts.generationJson"),
    assistantText("prompts.workspace", { value: JSON.stringify(params.workspace) }),
    assistantText("prompts.executionFacts"),
    assistantText("prompts.resources", { value: JSON.stringify(candidates) }),
    assistantText("prompts.rules", { value: JSON.stringify(ruleCatalog) }),
    assistantText("prompts.request", { value: params.goal.trim() }),
  ].join("\n");
}

function optionalProposal(
  structured: unknown,
  answer: string,
  resources: EvalTemplateResource[],
  rules: EvalTemplateRule[],
) {
  const structuredRecord = record(structured);
  const candidates = [
    structuredRecord?.proposal,
    structured,
    answer.includes('"eval_case_recommendation"') ? answer : undefined,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    try {
      return parseEvalCaseDesignProposal(candidate, resources, rules);
    } catch {
      // Agent events can contain unrelated structured metadata. Keep looking for a valid proposal.
    }
  }
  return undefined;
}

export function parseEvalAssistantActions(value: unknown): {
  summary: string;
  actions: EvalAssistantAction[];
} {
  const result = typeof value === "string" ? record(jsonValue(value)) : record(value);
  if (
    result?.kind !== "eval_assistant_actions" ||
    typeof result.summary !== "string" ||
    !Array.isArray(result.actions) ||
    result.actions.length > 10
  ) {
    throw new Error(assistantText("invalidActions"));
  }
  const seen = new Set<EvalAssistantAction["type"]>();
  const actions: EvalAssistantAction[] = [];
  for (const raw of result.actions) {
    const type = record(raw)?.type;
    if (
      typeof type !== "string" ||
      !assistantActionTypes.has(type as EvalAssistantAction["type"])
    ) {
      continue;
    }
    const allowedType = type as EvalAssistantAction["type"];
    if (seen.has(allowedType)) continue;
    seen.add(allowedType);
    actions.push({ type: allowedType });
  }
  if (!actions.length) throw new Error(assistantText("noActions"));
  return { summary: result.summary.trim(), actions };
}

function optionalActions(structured: unknown, answer: string) {
  const structuredRecord = record(structured);
  const nested = record(structuredRecord?.proposal);
  const candidates = [
    nested?.kind === "eval_assistant_actions" ? nested : undefined,
    structuredRecord?.actions && structuredRecord.kind ? structuredRecord : undefined,
    answer.includes('"eval_assistant_actions"') ? answer : undefined,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    try {
      return parseEvalAssistantActions(candidate);
    } catch {
      // Continue to the answer text when event metadata was not the requested action payload.
    }
  }
  return undefined;
}

function requestedScenarioCount(goal: string) {
  const matched = goal.match(/(?:生成|提炼|设计|梳理)?\s*(\d{1,2})\s*条[^。；\n]*(?:场景|用例)/);
  const english = goal.match(
    /\b(\d{1,2})\s+(?:[a-z-]+\s+){0,5}(?:scenarios?|(?:test\s+)?cases?)\b/i,
  );
  const count = Number(matched?.[1] ?? english?.[1]);
  return Number.isInteger(count) && count > 0 && count <= 50 ? count : undefined;
}

function mergeExactSuggestions(
  requested: number,
  proposals: Array<EvalCaseDesignProposal | undefined>,
  resources: EvalTemplateResource[],
  rules: EvalTemplateRule[],
) {
  const suggestions: EvalCaseDesignSuggestion[] = [];
  const seen = new Set<string>();
  for (const proposal of proposals) {
    for (const suggestion of proposal?.suggestions ?? []) {
      const identity = `${suggestion.resource_key}:${suggestion.rule_id}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      suggestions.push(suggestion);
      if (suggestions.length === requested) break;
    }
    if (suggestions.length === requested) break;
  }
  // A model retry can still repeat a valid pair. Complete only with real,
  // allowlisted resource-rule pairs; never invent samples or expected values.
  if (suggestions.length < requested) {
    for (const resource of resources) {
      for (const rule of rules) {
        if (!compatible(resource, rule)) continue;
        const identity = `${resourceKey(resource)}:${rule.id}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        suggestions.push({
          resource_key: resourceKey(resource),
          rule_id: rule.id,
          reason: assistantText("skeletonReason", { resource: resource.name, rule: rule.title }),
          confidence: "medium",
        });
        if (suggestions.length === requested) break;
      }
      if (suggestions.length === requested) break;
    }
  }
  if (suggestions.length !== requested) return undefined;
  return {
    kind: "eval_case_recommendation" as const,
    summary: assistantText("skeletonSummary", { count: requested }),
    suggestions,
  };
}

/**
 * Answers for the whole Eval workspace. A case proposal is returned only when the request really
 * asks for generation; other turns remain ordinary assistant answers.
 */
function assistantReadableReferences(params: RunEvalAssistantParams): EvalReadableReference[] {
  const recent = params.workspace.recentRuns?.entries ?? [];
  return [
    ...params.resources.flatMap((resource) => [
      { id: resource.id, label: resource.name || evalReferenceLabel("unnamedResource") },
      { id: resourceKey(resource), label: resource.name || evalReferenceLabel("unnamedResource") },
    ]),
    ...params.rules.map((rule) => ({
      id: rule.id,
      label: rule.title || evalReferenceLabel("unnamedRule"),
    })),
    ...recent.map((run) => ({
      id: run.id,
      label: evalReferenceLabel("run", {
        name: run.suiteName || evalReferenceLabel("unnamedRun"),
        time: run.createdAt ? new Date(run.createdAt).toLocaleString() : "—",
      }),
    })),
    ...(params.workspace.runDetails
      ? [
          ...(!recent.some((run) => run.id === params.workspace.runDetails?.id)
            ? [{ id: params.workspace.runDetails.id, label: evalReferenceLabel("currentRun") }]
            : []),
          ...params.workspace.runDetails.cases.map((entry) => ({
            id: entry.id,
            label: evalReferenceLabel("caseExecution", {
              name: entry.title || evalReferenceLabel("unnamedCase"),
            }),
          })),
        ]
      : []),
    ...(params.workspace.repairContext
      ? repairReadableReferences(
          params.workspace.repairContext,
          params.workspace.repairExecution?.runId,
        )
      : []),
  ];
}

export async function runEvalAssistant(
  params: RunEvalAssistantParams,
): Promise<EvalAssistantResult> {
  const readable = (value: string) => readableEvalText(value, assistantReadableReferences(params));
  let answer = "";
  let structured: unknown;
  let threadId = params.threadId;
  const terminal = await startExecution({
    base: params.base,
    tokenProvider: params.tokenProvider,
    agentId: EVAL_ASSISTANT_AGENT_ID,
    knId: params.knId,
    // Planning shares the existing evidence-analysis mode, which physically
    // removes all Agent tools/skills. Only the confirmed UI action may write.
    ...(params.workspace.repairContext ? { context: { purpose: "eval_root_cause" } } : {}),
    clientRequestId: newClientRequestId(),
    message: assistantPrompt(params),
    threadId: params.threadId,
    signal: params.signal,
    onEvent: (event) => {
      if (event.type === "meta" && event.threadId) threadId = event.threadId;
      if (event.type === "token") params.onText?.(event.content);
      if (event.type === "result") {
        answer = event.answer;
        structured = event.content;
      }
    },
  });
  if (terminal?.status !== "succeeded") {
    throw new Error(terminal?.detail || assistantText("incomplete"));
  }
  if (params.workspace.repairContext) {
    let candidate = record(record(structured)?.repair ?? structured);
    if (candidate?.kind !== "eval_repair_plan") {
      try {
        candidate = record(jsonValue(answer));
      } catch {
        candidate = undefined;
      }
    }
    return {
      answer: readable(
        typeof candidate?.answer === "string"
          ? candidate.answer
          : typeof candidate?.summary === "string"
            ? candidate.summary
            : answer,
      ),
      ...(candidate?.kind === "eval_repair_plan" ? { repair: candidate } : {}),
      threadId,
    };
  }
  let proposal = optionalProposal(structured, answer, params.resources, params.rules);
  const exactCount = requestedScenarioCount(params.goal);
  if (exactCount && proposal && proposal.suggestions.length !== exactCount) {
    let retryAnswer = "";
    let retryStructured: unknown;
    const retry = await startExecution({
      base: params.base,
      tokenProvider: params.tokenProvider,
      agentId: EVAL_ASSISTANT_AGENT_ID,
      knId: params.knId,
      clientRequestId: newClientRequestId(),
      message: assistantPrompt({
        ...params,
        goal: assistantText("prompts.retryCount", {
          count: exactCount,
          previous: proposal.suggestions.length,
        }),
      }),
      threadId,
      signal: params.signal,
      onEvent: (event) => {
        if (event.type === "meta" && event.threadId) threadId = event.threadId;
        if (event.type === "result") {
          retryAnswer = event.answer;
          retryStructured = event.content;
        }
      },
    });
    if (retry?.status === "succeeded") {
      const retried = optionalProposal(
        retryStructured,
        retryAnswer,
        params.resources,
        params.rules,
      );
      proposal = mergeExactSuggestions(
        exactCount,
        [proposal, retried],
        params.resources,
        params.rules,
      );
      if (proposal) answer = proposal.summary;
    }
  }
  const actionPlan = proposal ? undefined : optionalActions(structured, answer);
  return {
    answer: readable(
      actionPlan?.summary || (proposal ? answer : answer.trim() || assistantText("fallback")),
    ),
    ...(actionPlan ? { actions: actionPlan.actions } : {}),
    ...(proposal
      ? {
          proposal: {
            ...proposal,
            summary: readable(proposal.summary),
            suggestions: proposal.suggestions.map((item) => ({
              ...item,
              reason: readable(item.reason),
            })),
          },
        }
      : {}),
    threadId,
  };
}
