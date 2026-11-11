/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { evalScalarText } from "./eval-scalar-text";

import { ruleCheckAllowsAll, type EvalRuleCheck } from "./rule-check-model";

import { evalReferenceLabel } from "./eval-readable-references";
import { evalTerm, evalOutcomeLabel } from "./eval-terminology";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import axios from "axios";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useEvalFeedback } from "./useEvalFeedback";
import {
  createEvalCase,
  getEvalCaseDraft,
  getM1RunCapabilities,
  listEvalCaseResources,
  listEvalCaseResourcesPage,
  listEvalCallableFunctions,
  removeEvalCase,
  replaceEvalCase,
  trialEvalCase,
  type EvalCaseDefinition,
  type EvalCaseDraft,
  type EvalCaseTrialResult,
  type EvalCaseResource,
  type EvalCallableFunction,
} from "./m0-run.service";
import { EvalRelationCheckResult } from "./EvalRelationCheckResult";
import { EvalRelationCaseFields } from "./EvalRelationCaseFields";
import { EvalResourceCaseFields } from "./EvalResourceCaseFields";
import { resourceCaseKinds } from "./rule-check-model";
import { EvalObjectCaseFields } from "./EvalObjectCaseFields";
import { EvalCaseArguments } from "./EvalCaseArguments";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import {
  getCaseFormOptions,
  getCaseTargetSchema,
  type CaseTargetSchema,
  type CaseFormOptions,
} from "./case-form.service";
import {
  augmentCaseOutputSchema,
  compileCriteria,
  readCriteria,
  validateCaseArguments,
  newCriterion,
  resourceCheckPurpose,
  type CaseCriterion,
} from "./case-form-model";
import { useEvalTranslation } from "./useEvalTranslation";
import {
  parsePrecisionPreservingJSON,
  formatPrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import styles from "./EvalCaseEditorDrawer.module.css";
type Props = {
  networkId: string;
  open: boolean;
  caseId?: string;
  sourceType?: string;
  initiallyEnabled?: boolean;
  initialResource?: EvalCaseResource;
  onClose: () => void;
  onChanged: () => void;
};
type CaseForm = {
  caseType?: "functional" | "scenario" | "security";
  resourceKey?: string;
  checkMode?: "sample" | "all";
  checkLimit?: number;
  title: string;
  question: string;
  answer: string;
  sourceKind: EvalCaseDefinition["expected_source"]["kind"];
  evidenceRef: string;
  diagnosticNote: string;
  callableFunction?: string;
  argumentsJson?: string;
  expectedPath?: string;
  criteria?: CaseCriterion[];
};
type CheckPurpose = "availability" | "business" | "observe";
const purposeCriteria = (purpose: CheckPurpose): CaseCriterion[] => [
  {
    ...newCriterion(),
    ...(purpose === "availability" ? { id: "availability" } : {}),
    type:
      purpose === "availability"
        ? "json_schema"
        : purpose === "observe"
          ? "observation_only"
          : "equals",
    path: purpose === "availability" ? "$" : "$.result",
    valueType: "json",
    value:
      purpose === "availability"
        ? JSON.stringify({
            type: "object",
            required: ["available"],
            properties: { available: { const: true } },
          })
        : "",
  },
];
const initialValues: Partial<CaseForm> = {
  caseType: "functional",
  sourceKind: "business_expert",
  argumentsJson: "{}",
};
const functionKey = (item: EvalCallableFunction) =>
  JSON.stringify([item.resource_id, item.name, item.operation]);
const stringField = (value: unknown): string => (typeof value === "string" ? value : "");
const caseCategoryForResource = (kind?: string): EvalCaseDefinition["category"] =>
  kind === "relationType"
    ? "relation"
    : kind === "metric"
      ? "calculation"
      : kind === "action"
        ? "action"
        : "fact";
const parseObject = (value: string, requireFields = true): Record<string, unknown> => {
  const parsed: unknown = parsePrecisionPreservingJSON(value);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (requireFields && !Object.keys(parsed).length)
  ) {
    throw new Error(
      requireFields ? caseUiText("enterANonEmptyJsonObject") : caseUiText("enterAJsonObject"),
    );
  }
  return parsed as Record<string, unknown>;
};
const expectedPathExists = (expected: Record<string, unknown>, path: string): boolean => {
  if (path === "$") return true;
  if (
    !path.startsWith("$.") ||
    path.length > 256 ||
    path
      .slice(2)
      .split(".")
      .some(
        (segment) =>
          !segment || segment.includes("[") || segment.includes("]") || segment.includes("*"),
      )
  )
    return false;
  let value: unknown = expected;
  for (const segment of path.slice(2).split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !(segment in value))
      return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return true;
};
const errorMessage = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 409)
    return caseUiText("thisCaseWasChangedBySomeoneElseClose");
  if (axios.isAxiosError(error) && error.response?.status === 403)
    return caseUiText("yourAccountDoesNotHavePermissionToManage");
  if (
    axios.isAxiosError<{
      code?: string;
      message?: string;
    }>(error) &&
    error.response?.status === 400
  ) {
    if (
      error.response.data.code === "EVAL_CASE_INCOMPLETE" &&
      typeof error.response.data.message === "string"
    )
      return error.response.data.message;
    return caseUiText("theCaseConfigurationOrEvaluationTargetHasChanged");
  }
  if (axios.isAxiosError(error) && error.response?.status === 424)
    return caseUiText("theEvaluationTargetCannotBeVerifiedRightNow");
  return caseUiText("theOperationFailedCheckTheInputAndService");
};
const trialErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 401:
        return caseUiText("yourSessionHasExpiredSignInAgainBefore");
      case 403:
        return caseUiText("yourAccountDoesNotHavePermissionToRun");
      case 409:
        return caseUiText("executionBindingChanged");
      case 424:
        return caseUiText("theFunctionResourceCannotBeVerifiedRightNow");
      case 503:
        return caseUiText("executionDependenciesUnavailable");
    }
  }
  return caseUiText("trialFailedCheckInputAndServices");
};
const assertionReasons = (): Record<string, string> => ({
  "observed value differs from independent expectation": caseUiText(
    "theActualValueDiffersFromTheIndependentExpectation",
  ),
  "observed field is missing": caseUiText("theActualResultIsMissingTheFieldBeing"),
  "complete evidence is unavailable": caseUiText(
    "knowledgeNetwork.eval.m0.findingCategory.EVIDENCE",
  ),
  "resource use cannot be verified without complete evidence": caseUiText(
    "incompleteEvidencePreventsVerificationOfTheFunctionCall",
  ),
  "reviewed Function call is absent from complete evidence": caseUiText(
    "noAuthorizedFunctionCallWasFoundInThe",
  ),
  "target execution did not complete": caseUiText("theFunctionCallDidNotComplete"),
});
const trialErrorClasses = (): Record<string, string> => ({
  PERMISSION: caseUiText("noPermissionToCallTheTargetFunctionOr"),
  EVALUATION_CONTRACT: caseUiText("theActualOutputDoesNotMatchTheCase"),
  EVIDENCE: caseUiText("executionEvidenceIsMissing"),
  ENVIRONMENT: caseUiText("theTargetResourceOrADependentServiceCall"),
});
const toForm = (draft: EvalCaseDraft, imported: boolean): CaseForm => ({
  caseType: ["functional", "scenario", "security"].includes(
    stringField(draft.definition.diagnostic_spec.case_type),
  )
    ? (draft.definition.diagnostic_spec.case_type as CaseForm["caseType"])
    : draft.definition.execution_spec.target_kind === "business_scenario"
      ? "scenario"
      : "functional",
  checkMode:
    (
      draft.definition.input_spec.check_scope as {
        mode?: "sample" | "all";
      }
    )?.mode ?? "sample",
  checkLimit:
    (
      draft.definition.input_spec.check_scope as {
        limit?: number;
      }
    )?.limit ?? 100,
  title: draft.definition.title,
  criteria: readCriteria(draft.definition),
  question: stringField(draft.definition.input_spec.question),
  answer:
    imported ||
    ["direct_capability", "object_data_check", "resource_query"].includes(
      String(draft.definition.execution_spec.runner),
    )
      ? formatPrecisionSafeJSON(transformPrecisionSafeJSONRequest(draft.definition.expected_spec))
      : stringField(draft.definition.expected_spec.answer),
  sourceKind: draft.definition.expected_source.kind,
  evidenceRef: draft.definition.expected_source.evidence_refs.join("\n"),
  diagnosticNote: stringField(draft.definition.diagnostic_spec.note),
  callableFunction:
    draft.definition.execution_spec.runner === "direct_capability"
      ? functionKey({
          resource_id: stringField(
            (draft.definition.execution_spec.target as Record<string, unknown> | undefined)
              ?.resource_id,
          ),
          name: stringField(
            (draft.definition.execution_spec.target as Record<string, unknown> | undefined)?.name,
          ),
          operation: stringField(
            (draft.definition.execution_spec.target as Record<string, unknown> | undefined)
              ?.operation,
          ),
        })
      : undefined,
  argumentsJson: transformPrecisionSafeJSONRequest(draft.definition.input_spec.arguments ?? {}),
  expectedPath: stringField(
    draft.definition.assertions.find((item) => item.type === "equals")?.path,
  ),
});
const caseTypeArguments = (
  values: CaseForm,
  resource?: EvalCaseResource,
): Record<string, unknown> | undefined =>
  values.caseType !== "scenario" && resource && ["function", "api", "mcp"].includes(resource.kind)
    ? parseObject(values.argumentsJson ?? "{}", false)
    : undefined;
const fromForm = (
  values: CaseForm,
  networkId: string,
  callableFunction?: EvalCallableFunction,
  draft?: EvalCaseDraft,
  imported = false,
  selectedResource?: EvalCaseResource,
  relatedResources: EvalCaseResource[] = [],
  runner?: string,
  preparedObject?: EvalCaseDefinition,
  executionResource?: EvalCaseResource,
): EvalCaseDefinition => {
  const executionMode =
    runner === "direct_capability" ? "direct" : runner === "resource_query" ? "resource" : "manual";
  const question =
    (values.question ?? "").trim() ||
    ((!values.caseType || values.caseType === "functional") &&
    ["direct_capability", "resource_query", "object_data_check"].includes(
      runner ?? evalScalarText(draft?.definition.execution_spec.runner ?? ""),
    )
      ? values.title.trim()
      : "");
  if (
    preparedObject?.diagnostic_spec.resource_case_form &&
    !preparedObject.execution_spec.relation_rule
  ) {
    const definition = structuredClone(preparedObject);
    definition.title = values.title.trim();
    definition.diagnostic_spec = {
      ...definition.diagnostic_spec,
      note: values.diagnosticNote?.trim() ?? "",
      case_type: values.caseType ?? "functional",
    };
    if (
      values.caseType === "security" &&
      values.question?.trim() &&
      !definition.diagnostic_spec.definition_only
    )
      definition.input_spec = { ...definition.input_spec, question: values.question.trim() };
    return definition;
  }
  const preparedRelation = preparedObject?.execution_spec.relation_rule;
  if (preparedRelation || draft?.definition.execution_spec.relation_rule) {
    const definition = structuredClone(preparedObject ?? draft!.definition);
    definition.title = values.title.trim();
    definition.diagnostic_spec = {
      ...definition.diagnostic_spec,
      note: values.diagnosticNote?.trim() ?? "",
      case_type: values.caseType ?? "functional",
    };
    if (values.caseType === "security" && values.question?.trim())
      definition.input_spec = { ...definition.input_spec, question: values.question.trim() };
    return definition;
  }
  if (draft?.definition.execution_spec.runner === "object_data_check" || preparedObject) {
    const definition = structuredClone(preparedObject ?? draft!.definition);
    const scope =
      values.checkMode === "all"
        ? { mode: "all" }
        : { mode: "sample", limit: values.checkLimit ?? 100 };
    definition.title = values.title.trim();
    definition.input_spec = {
      ...definition.input_spec,
      question: preparedObject
        ? definition.input_spec.question
        : question || definition.input_spec.question,
      check_scope: scope,
    };
    definition.diagnostic_spec = {
      ...definition.diagnostic_spec,
      note: values.diagnosticNote?.trim() ?? "",
      check_scope: scope,
      case_type: values.caseType ?? "functional",
    };
    if (values.caseType === "security" && values.question?.trim())
      definition.input_spec = { ...definition.input_spec, question: values.question.trim() };
    return definition;
  }
  if (
    draft?.definition.execution_spec.runner === "resource_query" &&
    draft.definition.diagnostic_spec.rule_snapshot
  ) {
    const definition = structuredClone(draft.definition);
    definition.title = values.title.trim();
    definition.input_spec = {
      ...definition.input_spec,
      question,
      arguments: parseObject(values.argumentsJson ?? "{}", false),
    };
    definition.diagnostic_spec = {
      ...definition.diagnostic_spec,
      note: values.diagnosticNote?.trim() ?? "",
      case_type: values.caseType ?? "functional",
    };
    if (values.caseType === "security" && values.question?.trim())
      definition.input_spec = { ...definition.input_spec, question: values.question.trim() };
    return definition;
  }
  const persistedTarget = draft?.definition.execution_spec.target as
    Record<string, unknown> | undefined;
  const queryResource =
    selectedResource ??
    (persistedTarget?.resource_id && persistedTarget?.resource_kind
      ? {
          id: evalScalarText(persistedTarget.resource_id),
          kind: evalScalarText(persistedTarget.resource_kind),
          name: evalScalarText(persistedTarget.name ?? ""),
        }
      : undefined);
  const resourceExecution = executionMode === "resource" && queryResource;
  const scopeType =
    values.caseType === "scenario" || (values.caseType === "security" && !selectedResource)
      ? "business_scenario"
      : "resource";
  const compiled = values.criteria ? compileCriteria(values.criteria, true) : undefined;
  return {
    title: values.title.trim(),
    category: draft?.definition.category ?? caseCategoryForResource(selectedResource?.kind),
    risk_level: draft?.definition.risk_level ?? "medium",
    input_spec:
      executionMode === "direct" || resourceExecution
        ? {
            question,
            arguments: parseObject(values.argumentsJson ?? "", false),
          }
        : imported
          ? { ...draft?.definition.input_spec, question }
          : {
              ...draft?.definition.input_spec,
              ...(values.criteria
                ? { arguments: caseTypeArguments(values, selectedResource) }
                : {}),
              question,
            },
    execution_spec: resourceExecution
      ? {
          runner: "resource_query",
          target_kind: "resource",
          target: {
            kn_id: networkId,
            resource_kind: queryResource.kind,
            capability_type: queryResource.kind,
            resource_id: queryResource.id,
            name: queryResource.name,
          },
        }
      : executionMode === "direct" && callableFunction
        ? {
            runner: "direct_capability",
            target_kind: scopeType,
            max_planned_attempts: 1,
            timeout_seconds: 30,
            target: {
              kn_id: networkId,
              capability_type: "function",
              metadata_type: "function",
              name: callableFunction.name,
              operation: callableFunction.operation,
              ...(selectedResource?.id ||
              executionResource?.id ||
              callableFunction.resource_id ||
              (
                draft?.definition.execution_spec.target as
                  | {
                      resource_id?: string;
                    }
                  | undefined
              )?.resource_id
                ? {
                    resource_id:
                      selectedResource?.id ||
                      executionResource?.id ||
                      callableFunction.resource_id ||
                      (
                        draft?.definition.execution_spec.target as
                          | {
                              resource_id?: string;
                            }
                          | undefined
                      )?.resource_id,
                  }
                : {}),
            },
            allowed_capabilities: [callableFunction.name],
            forbidden_capabilities: ["execute_action"],
          }
        : imported
          ? (draft?.definition.execution_spec ?? { runner: "unbound", runnable: false })
          : {
              runner: "unbound",
              runnable: false,
              target_kind: scopeType,
              ...(scopeType === "business_scenario"
                ? {
                    related_targets: relatedResources.map((resource) => ({
                      kn_id: networkId,
                      capability_type: resource.kind,
                      resource_id: resource.id,
                      name: resource.name,
                    })),
                  }
                : selectedResource
                  ? {
                      target: {
                        kn_id: networkId,
                        capability_type: selectedResource.kind,
                        resource_id: selectedResource.id,
                        name: selectedResource.name,
                      },
                    }
                  : draft?.definition.execution_spec?.target
                    ? { target: draft.definition.execution_spec.target }
                    : {}),
            },
    assertions: compiled?.assertions
      ? [
          ...compiled.assertions,
          ...(resourceExecution
            ? [
                {
                  id: "resource-used",
                  type: "resource_used",
                  resource: queryResource.name,
                  required: true,
                },
                { id: "evidence", type: "evidence_complete", required: true },
              ]
            : executionMode === "direct" && callableFunction
              ? [
                  {
                    id: "function-used",
                    type: "resource_used",
                    resource: callableFunction.name,
                    required: true,
                  },
                  { id: "evidence", type: "evidence_complete", required: true },
                ]
              : (draft?.definition.assertions.filter((a) =>
                  ["resource_used", "evidence_complete"].includes(String(a.type)),
                ) ?? [])),
        ]
      : executionMode === "direct" && callableFunction
        ? [
            {
              id: "expected-value",
              type: "equals",
              source: "normalized_output",
              path: values.expectedPath?.trim(),
              on_missing: "fail",
              required: true,
            },
            {
              id: "function-used",
              type: "resource_used",
              resource: callableFunction.name,
              required: true,
            },
            { id: "evidence", type: "evidence_complete", required: true },
          ]
        : imported
          ? (draft?.definition.assertions ?? [])
          : [{ id: "business-answer", type: "manual_review", required: true, severity: "error" }],
    expected_spec:
      compiled?.expected_spec ??
      (executionMode === "direct" || resourceExecution || imported
        ? parseObject(values.answer)
        : { answer: (values.answer ?? "").trim() }),
    expected_source: {
      kind:
        compiled &&
        !values.criteria?.some((c) =>
          ["equals", "numeric_range", "approx", "contains", "regex"].includes(c.type),
        )
          ? "declared_contract"
          : (values.sourceKind ?? "business_expert"),
      evidence_refs: (compiled &&
      !values.criteria?.some((c) =>
        ["equals", "numeric_range", "approx", "contains", "regex"].includes(c.type),
      )
        ? ""
        : (values.evidenceRef ?? "")
      )
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    },
    diagnostic_spec: {
      ...draft?.definition.diagnostic_spec,
      case_type: values.caseType,
      ...(values.criteria ? { form_version: 2 } : {}),
      ...(scopeType === "business_scenario" && !imported
        ? { resource_id: undefined, resource_kind: undefined, target_id: undefined }
        : {}),
      note: (values.diagnosticNote ?? "").trim(),
      owner_hint: "manual",
      ...(scopeType === "resource" && selectedResource
        ? { resource_id: selectedResource.id, resource_kind: selectedResource.kind }
        : {}),
    },
  };
};
export function EvalCaseEditorDrawer({
  networkId,
  open,
  caseId,
  sourceType,
  initialResource,
  onClose,
  onChanged,
}: Props) {
  const formId = useId();
  const { message, modal } = useEvalFeedback();
  const { t } = useEvalTranslation();
  const assertionNames: Record<string, string> = {
    "expected-value": caseUiText("expectedResultComparison"),
    "function-used": caseUiText("functionCall"),
    evidence: evalTerm("evidence"),
  };
  const label = (key: string) => t(`knowledgeNetwork.eval.caseEditor.${key}`);
  const imported = sourceType === "imported_sample" || sourceType === "template";
  const [form] = Form.useForm<CaseForm>();
  const [draft, setDraft] = useState<EvalCaseDraft>();
  const [preparedObject, setPreparedObject] = useState<EvalCaseDefinition>();
  const [definitionOnlyMode, setDefinitionOnlyMode] = useState(false);
  const objectAutoTitle = useRef("");
  const isObjectDefinition =
    draft?.definition.execution_spec.runner === "object_data_check" ||
    preparedObject?.execution_spec.runner === "object_data_check";
  const isRelationDefinition = !!(
    preparedObject?.execution_spec.relation_rule ?? draft?.definition.execution_spec.relation_rule
  );
  const isFixedResourceDefinition =
    draft?.definition.execution_spec.runner === "resource_query" &&
    !!draft.definition.diagnostic_spec.rule_snapshot;
  const hasFixedStandard = isObjectDefinition || isFixedResourceDefinition || isRelationDefinition;
  const checkMode = Form.useWatch("checkMode", form) ?? "sample";
  const [busy, setBusy] = useState(false);
  const [enableOnSave, setEnableOnSave] = useState(false);
  const [formOptions, setFormOptions] = useState<CaseFormOptions>();
  const [targetSchema, setTargetSchema] = useState<CaseTargetSchema>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const [schemaRetry, setSchemaRetry] = useState(0);
  const [trialView, setTrialView] = useState(false);
  const [trialStale, setTrialStale] = useState(false);
  const [observedContext, setObservedContext] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trialResult, setTrialResult] = useState<EvalCaseTrialResult>();
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [callableFunctions, setCallableFunctions] = useState<EvalCallableFunction[]>([]);
  const [callableFunctionsError, setCallableFunctionsError] = useState(false);
  const [resourceKind, setResourceKind] = useState("objectType");
  const [resourceQuery, setResourceQuery] = useState("");
  const [resources, setResources] = useState<EvalCaseResource[]>([]);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);
  const [resourceReadWarnings, setResourceReadWarnings] = useState<string[]>([]);
  const [selectedResource, setSelectedResource] = useState<EvalCaseResource>();
  const [executionResource, setExecutionResource] = useState<EvalCaseResource>();
  const [executionLookupBusy, setExecutionLookupBusy] = useState(false);
  const [executionLookupError, setExecutionLookupError] = useState("");
  const [relatedResources, setRelatedResources] = useState<EvalCaseResource[]>([]);
  const caseType = Form.useWatch<CaseForm["caseType"]>("caseType", form) ?? "functional";
  const definitionOnly =
    definitionOnlyMode || !!(preparedObject ?? draft?.definition)?.diagnostic_spec.definition_only;
  const objectCreation =
    ((!caseId && !draft) || !!draft?.definition.diagnostic_spec.definition_only) &&
    selectedResource?.kind === "objectType" &&
    caseType !== "scenario";
  const relationEditor =
    selectedResource?.kind === "relationType" &&
    caseType !== "scenario" &&
    (!imported || isRelationDefinition);
  const resourceEditor =
    (targetSchema.rule_based === true ||
      (schemaError && formOptions?.version === 2) ||
      !!draft?.definition.diagnostic_spec.definition_only) &&
    (!draft || !!draft.definition.diagnostic_spec.resource_case_form) &&
    !!selectedResource &&
    resourceCaseKinds.includes(selectedResource.kind) &&
    caseType !== "scenario" &&
    (!imported || !!draft?.definition.diagnostic_spec.resource_case_form);
  const resourceContract = useMemo<CaseTargetSchema>(
    () =>
      schemaError
        ? {
            ...targetSchema,
            available: false,
            reason: t("knowledgeNetwork.eval.definitionOnly.contractUnavailable"),
          }
        : targetSchema,
    [targetSchema, schemaError, t],
  );
  const standaloneExecution = !imported && !selectedResource && caseType !== "functional";
  const resolvedRunner = preparedObject
    ? String(preparedObject.execution_spec.runner)
    : (targetSchema.runner ?? stringField(draft?.definition.execution_spec.runner));
  const executionMode =
    relationEditor || isRelationDefinition
      ? "relation"
      : resolvedRunner === "direct_capability"
        ? "direct"
        : resolvedRunner === "resource_query"
          ? "resource"
          : "manual";
  const currentArguments = Form.useWatch("argumentsJson", form);
  const currentFunction = Form.useWatch("callableFunction", form);
  const currentCheckLimit = Form.useWatch("checkLimit", form);
  const fieldContext = JSON.stringify([
    networkId,
    caseId,
    selectedResource?.kind,
    selectedResource?.id,
    caseType,
    resolvedRunner,
    currentFunction,
    currentArguments,
    checkMode,
    currentCheckLimit,
  ]);
  const outputSchema = useMemo(
    () =>
      observedContext === fieldContext && trialResult?.actual !== undefined
        ? augmentCaseOutputSchema(targetSchema.output, trialResult.actual)
        : targetSchema.output,
    [observedContext, fieldContext, trialResult, targetSchema.output],
  );
  const sourceKind = Form.useWatch("sourceKind", form);
  const descriptionOptional =
    caseType === "functional" &&
    !imported &&
    (["direct", "resource", "relation"].includes(executionMode) || isObjectDefinition);
  const criteria = Form.useWatch<CaseCriterion[] | undefined>("criteria", form);
  const criteriaMode =
    formOptions?.version === 2 &&
    !isObjectDefinition &&
    !relationEditor &&
    !resourceEditor &&
    !isRelationDefinition &&
    !objectCreation &&
    !draft?.definition.diagnostic_spec.rule_snapshot &&
    (!draft || !!readCriteria(draft.definition));
  const fixedAvailability =
    criteriaMode &&
    executionMode === "resource" &&
    resourceCheckPurpose(criteria ?? []) === "availability";
  const needsReference =
    !hasFixedStandard &&
    !relationEditor &&
    !resourceEditor &&
    !objectCreation &&
    (!criteriaMode ||
      (criteria ?? []).some((c) =>
        ["equals", "numeric_range", "approx", "contains", "regex"].includes(c.type),
      ));
  const bindDefinitionOnlyMode = useCallback((value: boolean) => {
    setDefinitionOnlyMode(value);
    if (value) setEnableOnSave(false);
  }, []);
  const bindObjectDefinition = useCallback(
    (definition?: EvalCaseDefinition) => {
      setPreparedObject(definition);
      if (definition?.diagnostic_spec.definition_only) setEnableOnSave(false);
      setTrialStale(true);
      if (!definition) return;
      const scope = definition.input_spec.check_scope as
        { mode?: string; limit?: number } | undefined;
      form.setFieldsValue({
        checkMode: scope?.mode === "all" ? "all" : "sample",
        checkLimit: scope?.limit ?? 100,
        answer: transformPrecisionSafeJSONRequest(definition.expected_spec),
      });
      const title = String(form.getFieldValue("title") ?? "").trim();
      if (!title || title === objectAutoTitle.current)
        form.setFieldValue("title", definition.title);
      objectAutoTitle.current = definition.title;
    },
    [form],
  );
  const queryResourceKind =
    selectedResource?.kind ??
    (
      draft?.definition.execution_spec.target as
        | {
            resource_kind?: string;
          }
        | undefined
    )?.resource_kind;
  const canQueryResource =
    ["relationType", "metric", "api", "mcp", "skill", "action"].includes(queryResourceKind ?? "") &&
    caseType !== "scenario";
  const isActionCase =
    selectedResource?.kind === "action" || draft?.definition.category === "action";
  const resourceOptions =
    selectedResource &&
    selectedResource.kind === resourceKind &&
    !resources.some((item) => item.id === selectedResource.id)
      ? [selectedResource, ...resources]
      : resources;
  const selectableFunctions = useMemo(() => {
    const target = draft?.definition.execution_spec.target as
      { name?: string; resource_id?: string; operation?: string } | undefined;
    const selectedId =
      selectedResource?.kind === "function" ? selectedResource.id : target?.resource_id;
    const selectedName =
      selectedResource?.kind === "function" ? selectedResource.name : target?.name;
    const entries =
      !imported && selectedResource?.kind === "function"
        ? callableFunctions.filter((item) =>
            item.resource_id ? item.resource_id === selectedId : item.name === selectedName,
          )
        : draft?.definition.execution_spec.runner === "direct_capability"
          ? callableFunctions.filter((item) =>
              selectedId && item.resource_id
                ? item.resource_id === selectedId
                : item.name === selectedName,
            )
          : standaloneExecution
            ? callableFunctions
            : [];
    return entries.map((item) => ({
      ...item,
      resource_id: item.resource_id || selectedId || "",
      ...(target?.operation &&
      (target.resource_id
        ? (item.resource_id || selectedId) === target.resource_id
        : item.name === target.name)
        ? { operation: target.operation }
        : {}),
    }));
  }, [callableFunctions, imported, selectedResource, draft, standaloneExecution]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setFormOptions(undefined);
    getCaseFormOptions(networkId)
      .then((options) => {
        if (active) setFormOptions(options);
      })
      .catch(() => {
        if (active) setFormOptions({ version: 1, predicates: [] });
      });
    return () => {
      active = false;
    };
  }, [networkId, open]);
  useEffect(() => {
    let active = true;
    setExecutionLookupError("");
    setExecutionLookupBusy(false);
    if (draft) return;
    setExecutionResource(undefined);
    if (!open || !standaloneExecution || !currentFunction) return;
    const selected = callableFunctions.find((item) => functionKey(item) === currentFunction);
    if (!selected) return;
    setExecutionLookupBusy(true);
    void listEvalCaseResourcesPage(networkId, "function", selected.name, 1, 30, true)
      .then((page) => {
        if (!active) return;
        const matches = page.entries.filter((item) =>
          selected.resource_id ? item.id === selected.resource_id : item.name === selected.name,
        );
        if (matches.length !== 1)
          setExecutionLookupError(
            matches.length
              ? caseUiText("multipleExecutionEntriesHaveTheSameNameResolve")
              : caseUiText("thisExecutionEntryWasNotFoundInThe"),
          );
        else setExecutionResource(matches[0]);
      })
      .catch(() => {
        if (active) setExecutionLookupError(caseUiText("failedToLoadTheExecutionEntrySelectIt"));
      })
      .finally(() => {
        if (active) setExecutionLookupBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, standaloneExecution, currentFunction, callableFunctions, networkId, draft]);
  useEffect(() => {
    if (!open || !criteriaMode) return;
    if (!form.getFieldValue("criteria"))
      form.setFieldValue("criteria", draft ? readCriteria(draft.definition) : [newCriterion()]);
  }, [criteriaMode, draft, form, open]);
  useEffect(() => {
    let active = true;
    setTargetSchema({});
    const persisted = draft?.definition.execution_spec.target as
      | {
          resource_id?: string;
          resource_kind?: string;
          capability_type?: string;
          name?: string;
        }
      | undefined;
    const target =
      selectedResource ??
      executionResource ??
      (persisted?.resource_id && (persisted.resource_kind ?? persisted.capability_type)
        ? {
            id: persisted.resource_id,
            kind: (persisted.resource_kind ?? persisted.capability_type)!,
            name: persisted.name ?? "",
          }
        : undefined);
    setSchemaError(false);
    setSchemaLoading(false);
    if (open && target && target.kind !== "objectType") {
      setSchemaLoading(true);
      getCaseTargetSchema(target, networkId)
        .then((schema) => {
          if (active) {
            setTargetSchema(schema);
            if (schema.system_arguments) {
              try {
                const current = parseObject(
                  stringField(form.getFieldValue("argumentsJson")) || "{}",
                  false,
                );
                form.setFieldValue(
                  "argumentsJson",
                  transformPrecisionSafeJSONRequest({ ...current, ...schema.system_arguments }),
                );
              } catch {
                /* Keep invalid user JSON intact for correction. */
              }
            }
            if (
              schema.available &&
              !caseId &&
              !draft &&
              ["relationType", "metric", "api", "mcp", "skill", "action"].includes(target.kind)
            ) {
              const current = form.getFieldValue("criteria") as CaseCriterion[] | undefined;
              if (
                !current?.length ||
                (current.length === 1 &&
                  current[0].type === "equals" &&
                  current[0].value === "" &&
                  !current[0].valueProvided)
              )
                form.setFieldValue("criteria", purposeCriteria("availability"));
            }
          }
        })
        .catch(() => {
          if (active) {
            setTargetSchema({});
            setSchemaError(true);
          }
        })
        .finally(() => {
          if (active) setSchemaLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [open, selectedResource, executionResource, draft, networkId, caseId, form, schemaRetry]);
  useEffect(() => {
    if (!open || imported || caseType === "scenario") return;
    let active = true;
    setResourcesLoading(true);
    setResourcesError(false);
    setResourceReadWarnings([]);
    const timer = window.setTimeout(
      () => {
        void listEvalCaseResources(networkId, resourceKind, resourceQuery.trim())
          .then((page) => {
            if (!active) return;
            setResources(page.entries);
            setResourceTotal(page.total);
            setResourceReadWarnings([
              ...new Set((page.read_issues ?? []).map((issue) => issue.reason)),
            ]);
          })
          .catch(() => {
            if (!active) return;
            setResources([]);
            setResourcesError(true);
          })
          .finally(() => {
            if (active) setResourcesLoading(false);
          });
      },
      resourceQuery.trim() ? 300 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [networkId, open, imported, caseType, resourceKind, resourceQuery]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setCallableFunctions([]);
    setCallableFunctionsError(false);
    void listEvalCallableFunctions(networkId)
      .then((items) => {
        if (active) setCallableFunctions(items);
      })
      .catch(() => {
        if (active) setCallableFunctionsError(true);
      });
    return () => {
      active = false;
    };
  }, [networkId, open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setTrialAvailable(false);
    void getM1RunCapabilities(networkId).then((available) => {
      if (active) setTrialAvailable(available);
    });
    return () => {
      active = false;
    };
  }, [networkId, open]);
  useEffect(() => {
    if (!open) return;
    setError("");
    setEnableOnSave(false);
    setTrialView(false);
    setTrialStale(false);
    setTrialResult(undefined);
    setObservedContext(undefined);
    setDraft(undefined);
    setPreparedObject(undefined);
    objectAutoTitle.current = "";
    setSelectedResource(!caseId ? initialResource : undefined);
    setRelatedResources([]);
    setExecutionResource(undefined);
    setExecutionLookupError("");
    setResourceKind(!caseId && initialResource ? initialResource.kind : "objectType");
    setResourceQuery("");
    form.resetFields();
    if (!caseId) {
      if (initialResource)
        form.setFieldValue("resourceKey", `${initialResource.kind}:${initialResource.id}`);
      return;
    }
    let active = true;
    setLoading(true);
    void getEvalCaseDraft(networkId, caseId)
      .then((result) => {
        if (!active) return;
        setDraft(result);
        setEnableOnSave(result.enabled);
        const target = result.definition.execution_spec.target as
          | {
              resource_id?: string;
              capability_type?: string;
              name?: string;
            }
          | undefined;
        const resource =
          (!imported ||
            result.definition.execution_spec.relation_rule ||
            result.definition.diagnostic_spec.resource_case_form) &&
          target?.resource_id &&
          target.capability_type &&
          target.name
            ? { id: target.resource_id, kind: target.capability_type, name: target.name }
            : undefined;
        const standalone =
          result.definition.execution_spec.target_kind === "business_scenario" ||
          result.definition.diagnostic_spec.case_type === "scenario";
        setSelectedResource(standalone ? undefined : resource);
        setExecutionResource(standalone ? resource : undefined);
        const related = result.definition.execution_spec.related_targets;
        setRelatedResources(
          Array.isArray(related)
            ? related
                .filter(
                  (
                    item: unknown,
                  ): item is {
                    resource_id: string;
                    capability_type: string;
                    name: string;
                  } =>
                    typeof item === "object" &&
                    item !== null &&
                    "resource_id" in item &&
                    typeof item.resource_id === "string" &&
                    "capability_type" in item &&
                    typeof item.capability_type === "string" &&
                    "name" in item &&
                    typeof item.name === "string",
                )
                .map((item) => ({
                  id: item.resource_id,
                  kind: item.capability_type,
                  name: item.name,
                }))
            : [],
        );
        if (resource) setResourceKind(resource.kind);
        form.setFieldsValue({
          ...toForm(result, imported),
          resourceKey: !standalone && resource ? `${resource.kind}:${resource.id}` : undefined,
        });
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, caseId, networkId, form, imported, initialResource]);
  const execute = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      message.success(success);
      onChanged();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      if (
        axios.isAxiosError<{
          code?: string;
          field?: string;
          message?: string;
        }>(cause) &&
        cause.response?.data.code === "EVAL_CASE_INCOMPLETE"
      ) {
        const data = cause.response.data;
        const fields: Record<string, keyof CaseForm> = {
          "input_spec.question": "question",
          "input_spec.arguments": "argumentsJson",
          execution_spec: "resourceKey",
          "execution_spec.target": executionMode === "direct" ? "callableFunction" : "resourceKey",
          expected_source: "evidenceRef",
          assertions: criteriaMode ? "criteria" : "answer",
          definition: "title",
        };
        const field = fields[data.field ?? ""];
        if (field && typeof data.message === "string")
          form.setFields([{ name: field, errors: [data.message] }]);
      }
    } finally {
      setBusy(false);
    }
  };
  const save = async (activate: boolean) => {
    if ((objectCreation || relationEditor || resourceEditor) && !preparedObject) {
      setError(caseUiText("selectACheckAndCompleteTheTargetInstance"));
      return;
    }
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (
      ["resource", "direct"].includes(executionMode ?? "") &&
      (schemaError || schemaLoading || targetSchema.available === false)
    ) {
      setError(
        targetSchema.reason ?? caseUiText("loadTheCurrentResourceSParameterContractBeforeSaving"),
      );
      return;
    }
    if (criteriaMode) {
      try {
        compileCriteria(values.criteria ?? []);
        if (executionMode === "direct")
          validateCaseArguments(values.argumentsJson ?? "{}", targetSchema.input);
        if (executionMode === "resource")
          validateCaseArguments(values.argumentsJson ?? "{}", targetSchema.input);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : label("invalidCriteria"));
        return;
      }
    }
    if (!imported && values.caseType === "functional" && !selectedResource) {
      setError(caseUiText("selectTheActualResourceThisCaseWillEvaluate"));
      return;
    }
    if (
      !definitionOnly &&
      !isObjectDefinition &&
      draft?.definition.execution_spec.runner !== "declaration_preflight" &&
      executionMode !== "direct" &&
      executionMode !== "resource" &&
      executionMode !== "relation"
    ) {
      setError(caseUiText("thisEvaluationTargetDoesNotSupportAutomaticExecution"));
      return;
    }
    const callableFunction = selectableFunctions.find(
      (item) => functionKey(item) === values.callableFunction,
    );
    if (definitionOnly && activate) {
      setError(t("knowledgeNetwork.eval.definitionOnly.enableBlocked"));
      return;
    }
    if (executionMode === "direct" && !callableFunction && !resourceEditor) {
      setError(caseUiText("executionBindingChanged"));
      return;
    }
    await execute(
      async () => {
        const result = draft
          ? await replaceEvalCase(
              networkId,
              {
                ...draft,
                definition: fromForm(
                  values,
                  networkId,
                  callableFunction,
                  draft,
                  imported,
                  selectedResource,
                  relatedResources,
                  resolvedRunner,
                  preparedObject,
                  executionResource,
                ),
              },
              activate,
            )
          : await createEvalCase(
              networkId,
              fromForm(
                values,
                networkId,
                callableFunction,
                undefined,
                false,
                selectedResource,
                relatedResources,
                resolvedRunner,
                preparedObject,
                executionResource,
              ),
              activate,
            );
        const definition = fromForm(
          values,
          networkId,
          callableFunction,
          draft,
          imported,
          selectedResource,
          relatedResources,
          resolvedRunner,
          preparedObject,
          executionResource,
        );
        setDraft({
          ...draft,
          ...result,
          enabled: activate,
          definition,
          created_by: draft?.created_by ?? "",
          updated_by: draft?.updated_by ?? "",
          created_at: draft?.created_at ?? "",
          updated_at: draft?.updated_at ?? "",
        });
      },
      activate ? caseUiText("caseSavedAndEnabled") : caseUiText("caseSaved"),
    );
  };
  const tryRun = async () => {
    const values = await form.validateFields().catch(() => null);
    if (
      !values ||
      ((relationEditor || resourceEditor) && !preparedObject) ||
      (!["direct", "resource", "relation"].includes(executionMode ?? "") && !isObjectDefinition)
    )
      return;
    if (
      ["resource", "direct"].includes(executionMode ?? "") &&
      (schemaError || schemaLoading || targetSchema.available === false)
    ) {
      setError(
        targetSchema.reason ?? caseUiText("loadTheCurrentResourceSParameterContractBeforeStarting"),
      );
      return;
    }
    if (criteriaMode) {
      try {
        compileCriteria(values.criteria ?? []);
        if (needsReference && !(values.evidenceRef ?? "").trim())
          throw Error(caseUiText("provideIndependentEvidenceForTheExpectedResultBefore"));
        if (executionMode === "direct")
          validateCaseArguments(values.argumentsJson ?? "{}", targetSchema.input);
        if (executionMode === "resource")
          validateCaseArguments(values.argumentsJson ?? "{}", targetSchema.input);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : label("invalidCriteria"));
        return;
      }
    }
    const callableFunction = selectableFunctions.find(
      (item) => functionKey(item) === values.callableFunction,
    );
    if (
      !callableFunction &&
      !resourceEditor &&
      !isObjectDefinition &&
      !["resource", "relation"].includes(executionMode)
    ) {
      setError(caseUiText("executionBindingChanged"));
      return;
    }
    setTrialBusy(true);
    setError("");
    setTrialResult(undefined);
    try {
      const definition = fromForm(
        values,
        networkId,
        callableFunction,
        draft,
        imported,
        selectedResource,
        relatedResources,
        resolvedRunner,
        preparedObject,
        executionResource,
      );
      const result = await trialEvalCase(networkId, definition);
      setTrialResult(result);
      setObservedContext(fieldContext);
      setTrialView(true);
      setTrialStale(false);
    } catch (cause) {
      setError(trialErrorMessage(cause));
    } finally {
      setTrialBusy(false);
    }
  };
  const changeContext = (apply: () => void) => {
    const currentArguments: unknown = form.getFieldValue("argumentsJson");
    const currentCriteria: unknown = form.getFieldValue("criteria");
    const currentEvidence: unknown = form.getFieldValue("evidenceRef");
    const currentAnswer: unknown = form.getFieldValue("answer");
    const hasInput =
      (typeof currentEvidence === "string" && currentEvidence.trim() !== "") ||
      (typeof currentAnswer === "string" && currentAnswer.trim() !== "") ||
      (typeof currentArguments === "string" && currentArguments.trim() !== "{}") ||
      (Array.isArray(currentCriteria) &&
        resourceCheckPurpose(currentCriteria as CaseCriterion[]) !== "availability" &&
        currentCriteria.some(
          (c: unknown) => !!c && typeof c === "object" && "value" in c && c.value !== "",
        ));
    const change = () => {
      setPreparedObject(undefined);
      form.setFieldsValue({
        callableFunction: undefined,
        argumentsJson: "{}",
        expectedPath: undefined,
        answer: "",
        evidenceRef: "",
        ...(criteriaMode ? { criteria: [newCriterion()] } : {}),
      });
      setTrialStale(true);
      apply();
    };
    if (hasInput)
      modal.confirm({
        title: label("contextChangeTitle"),
        content: label("contextChangeBody"),
        okText: label("continue"),
        cancelText: label("cancel"),
        onOk: change,
      });
    else change();
  };
  useEffect(() => {
    if ((!draft && standaloneExecution) || selectableFunctions.length !== 1) return;
    if (draft && form.getFieldValue("callableFunction") === functionKey(selectableFunctions[0]))
      return;
    form.setFieldsValue({
      callableFunction: functionKey(selectableFunctions[0]),
    });
  }, [criteriaMode, draft, form, selectableFunctions, selectedResource?.id, standaloneExecution]);
  const canEdit = !caseId || !!draft;
  const isManualDefinition =
    !draft ||
    (draft.definition.execution_spec.runner === "unbound" &&
      draft.definition.assertions.length === 1 &&
      draft.definition.assertions[0]?.type === "manual_review");
  const isDirectDefinition =
    draft?.definition.execution_spec.runner === "direct_capability" &&
    draft.definition.assertions.length === 3 &&
    draft.definition.assertions.some(
      (item) => item.id === "expected-value" && item.type === "equals",
    ) &&
    draft.definition.assertions.some(
      (item) => item.id === "function-used" && item.type === "resource_used",
    ) &&
    draft.definition.assertions.some(
      (item) => item.id === "evidence" && item.type === "evidence_complete",
    );
  const isApplicationDefinition =
    Boolean(draft?.definition.diagnostic_spec.rule_snapshot) &&
    draft?.definition.execution_spec.runner === "unbound" &&
    draft.definition.assertions.length === 2 &&
    draft.definition.assertions.some(
      (assertion) => assertion.id === "expected-output" && assertion.type === "equals",
    ) &&
    draft.definition.assertions.some(
      (assertion) =>
        assertion.id === "execution-evidence" && assertion.type === "evidence_complete",
    );
  const canEditDefinition =
    isManualDefinition ||
    isDirectDefinition ||
    isApplicationDefinition ||
    isObjectDefinition ||
    relationEditor ||
    resourceEditor ||
    isRelationDefinition ||
    (["direct_capability", "unbound", "resource_query"].includes(
      String(draft?.definition.execution_spec.runner),
    ) &&
      !!draft &&
      !!readCriteria(draft.definition));
  return (
    <Drawer
      className={styles.caseEditorDrawer}
      title={
        caseId || draft
          ? caseUiText("editCase")
          : caseUiText("knowledgeNetwork.eval.resourceOverview.createCase")
      }
      open={open}
      width="min(800px, 100vw)"
      onClose={onClose}
      forceRender
      footer={
        <div className={styles.drawerFooter}>
          <div className={styles.footerActions}>
            {trialView ? (
              <Button onClick={() => setTrialView(false)}>{label("backToEdit")}</Button>
            ) : trialResult ? (
              <Button onClick={() => setTrialView(true)}>{label("lastTrial")}</Button>
            ) : null}
            {!trialView &&
              !definitionOnly &&
              canEdit &&
              canEditDefinition &&
              (isObjectDefinition ||
                relationEditor ||
                isRelationDefinition ||
                (executionMode === "direct" && selectableFunctions.length > 0) ||
                (executionMode === "resource" && canQueryResource)) &&
              (!isActionCase ||
                (executionMode === "resource" && targetSchema.available === true)) && (
                <Button
                  loading={trialBusy}
                  disabled={
                    busy ||
                    schemaLoading ||
                    !trialAvailable ||
                    ((objectCreation || relationEditor || resourceEditor) && !preparedObject)
                  }
                  title={
                    trialAvailable
                      ? caseUiText("runOnceWithTheCurrentIdentityAndCheck")
                      : caseUiText("executionDependenciesUnavailableEnvironment")
                  }
                  onClick={() => void tryRun()}
                >
                  {caseUiText("testRun")}
                </Button>
              )}
            {draft ? (
              <Popconfirm
                title={caseUiText("deleteThisCase")}
                description={caseUiText("theCaseWillBeRemovedFromTheCurrent")}
                okText={caseUiText("knowledgeNetwork.eval.caseBatch.delete")}
                cancelText={caseUiText("knowledgeNetwork.eval.m0.cancel")}
                okButtonProps={{ danger: true }}
                onConfirm={() =>
                  void execute(async () => {
                    await removeEvalCase(networkId, draft.case_id, "delete");
                  }, caseUiText("caseDeleted"))
                }
              >
                <Button
                  aria-label={caseUiText("knowledgeNetwork.eval.caseBatch.delete")}
                  danger
                  disabled={busy}
                >
                  {caseUiText("knowledgeNetwork.eval.caseBatch.delete")}
                </Button>
              </Popconfirm>
            ) : null}
            {canEdit && canEditDefinition && (
              <Button onClick={onClose} disabled={busy}>
                {caseUiText("knowledgeNetwork.eval.m0.cancel")}
              </Button>
            )}
            {canEdit && canEditDefinition && (
              <Button
                aria-label={caseUiText("confirm")}
                type="primary"
                loading={busy}
                disabled={
                  trialBusy ||
                  (standaloneExecution &&
                    (executionLookupBusy ||
                      !!executionLookupError ||
                      !currentFunction ||
                      (!executionResource && !draft) ||
                      schemaLoading ||
                      schemaError)) ||
                  ((objectCreation || relationEditor || resourceEditor) && !preparedObject)
                }
                onClick={() => void save(enableOnSave)}
              >
                {caseUiText("confirm")}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <Spin />
      ) : (
        <>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
          {!trialView && !criteriaMode && !isObjectDefinition && imported ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message={caseUiText("checkTheImportedSampleInputCompleteExpectedJson")}
            />
          ) : null}
          {!canEditDefinition && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={caseUiText("thisCaseContainsConfigurationNotSupportedByThis")}
            />
          )}
          <Form
            form={form}
            name={`eval-case-${formId}`}
            layout="vertical"
            initialValues={initialValues}
            style={{ display: trialView ? "none" : undefined }}
            onValuesChange={() => {
              if (trialResult) setTrialStale(true);
            }}
            disabled={busy || !canEdit || !canEditDefinition}
          >
            <div className={styles.sectionTitle}>{caseUiText("basicInformation")}</div>
            <Form.Item
              name="caseType"
              getValueFromEvent={() => caseType}
              label={caseUiText("knowledgeNetwork.eval.definitionUi.caseType")}
              extra={
                !imported && caseType === "scenario"
                  ? caseUiText("noSingleEvaluationTargetIsRequiredSelectAn")
                  : !imported && caseType === "security"
                    ? caseUiText("describeTheSecurityBehaviorToVerifyForThe")
                    : undefined
              }
              rules={[{ required: true, message: caseUiText("selectACaseType") }]}
            >
              <Segmented
                name={`eval-case-type-${formId}`}
                disabled={isObjectDefinition && !!caseId}
                block
                options={[
                  {
                    value: "functional",
                    label: caseUiText("knowledgeNetwork.eval.definitionUi.functional"),
                  },
                  {
                    value: "scenario",
                    label: caseUiText("knowledgeNetwork.eval.definitionUi.scenario"),
                    disabled: false,
                  },
                  {
                    value: "security",
                    label: caseUiText("knowledgeNetwork.eval.definitionUi.security"),
                  },
                ]}
                onChange={(nextType) =>
                  changeContext(() => {
                    form.setFieldValue("caseType", nextType);
                    form.setFieldsValue({ callableFunction: undefined });
                    if (nextType === "scenario") {
                      setSelectedResource(undefined);
                      setRelatedResources([]);
                      form.setFieldValue("resourceKey", undefined);
                    }
                  })
                }
              />
            </Form.Item>
            <Form.Item
              name="title"
              label={evalTerm("caseName")}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                maxLength={255}
                placeholder={caseUiText("brieflyDescribeWhatYouWantToVerify")}
              />
            </Form.Item>
            {!imported && caseType !== "scenario" && (
              <>
                <div className={styles.sectionTitle}>{evalTerm("assessmentTarget")}</div>
                <div className={styles.resourceGrid}>
                  <Form.Item label={caseUiText("knowledgeNetwork.eval.filterUi.resourceType")}>
                    <Select
                      aria-label={caseUiText("knowledgeNetwork.eval.filterUi.resourceType")}
                      disabled={isObjectDefinition && !!caseId}
                      value={resourceKind}
                      options={[
                        {
                          value: "objectType",
                          label: caseUiText("knowledgeNetwork.eval.templateUi.kinds.objectType"),
                        },
                        {
                          value: "relationType",
                          label: caseUiText("knowledgeNetwork.eval.templateUi.kinds.relationType"),
                        },
                        {
                          value: "metric",
                          label: caseUiText("knowledgeNetwork.eval.templateUi.kinds.metric"),
                        },
                        {
                          value: "action",
                          label: caseUiText("knowledgeNetwork.eval.templateUi.kinds.action"),
                        },
                        {
                          value: "function",
                          label: caseUiText("knowledgeNetwork.eval.templateUi.kinds.function"),
                        },
                        { value: "api", label: "API" },
                        { value: "mcp", label: "MCP" },
                        { value: "skill", label: "SKILLS" },
                      ]}
                      onChange={(kind) =>
                        changeContext(() => {
                          setResourceKind(kind);
                          setResourceQuery("");
                          setSelectedResource(undefined);
                          form.setFieldsValue({
                            resourceKey: undefined,
                            callableFunction: undefined,
                          });
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name="resourceKey"
                    validateTrigger="onBlur"
                    getValueFromEvent={() =>
                      selectedResource
                        ? `${selectedResource.kind}:${selectedResource.id}`
                        : undefined
                    }
                    label={
                      caseType === "security"
                        ? caseUiText("evaluationTargetOptional")
                        : evalTerm("assessmentTarget")
                    }
                    rules={
                      caseType === "functional"
                        ? [{ required: true, message: caseUiText("selectAnEvaluationTarget") }]
                        : []
                    }
                    extra={
                      resourceTotal > 30
                        ? caseUiText("resourceSearchCount", { count: resourceTotal })
                        : undefined
                    }
                  >
                    <Select
                      aria-label={evalTerm("assessmentTarget")}
                      disabled={isObjectDefinition && !!caseId}
                      showSearch
                      allowClear={caseType === "security"}
                      filterOption
                      optionFilterProp="label"
                      loading={resourcesLoading}
                      placeholder={
                        caseType === "security"
                          ? caseUiText("optionalSelectAResourceForTheSecurityTest")
                          : caseUiText("selectOrSearchResources")
                      }
                      notFoundContent={
                        resourcesLoading
                          ? caseUiText("loadingResources")
                          : caseUiText("noResourcesFound")
                      }
                      onSearch={setResourceQuery}
                      options={resourceOptions.map((item) => ({
                        value: `${item.kind}:${item.id}`,
                        label: item.name,
                      }))}
                      onChange={(key) =>
                        changeContext(() => {
                          form.setFieldValue("resourceKey", key);
                          setSelectedResource(
                            resourceOptions.find((item) => `${item.kind}:${item.id}` === key),
                          );
                          form.setFieldsValue({
                            callableFunction: undefined,
                          });
                        })
                      }
                    />
                  </Form.Item>
                </div>
                {resourceReadWarnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={label("resourceListWarning")}
                    description={resourceReadWarnings.join("；")}
                  />
                )}
                {resourcesError && caseType === "functional" && (
                  <Alert
                    type="error"
                    showIcon
                    message={caseUiText("failedToLoadResourcesCloseAndReopenThis")}
                    style={{ marginBottom: 16 }}
                  />
                )}
              </>
            )}
            {standaloneExecution && (
              <Form.Item
                name="callableFunction"
                label={caseUiText("executionEntry")}
                validateTrigger="onBlur"
                getValueFromEvent={() => currentFunction}
                extra={caseUiText("selectACallableFunctionForTheScenario")}
                rules={[
                  { required: true, message: caseUiText("selectAnExecutionEntryForTheScenario") },
                ]}
              >
                <Select
                  aria-label={caseUiText("executionEntry")}
                  showSearch
                  optionFilterProp="label"
                  placeholder={caseUiText("selectAnEntryThatExecutesThisScenario")}
                  loading={executionLookupBusy}
                  options={selectableFunctions.map((item) => ({
                    value: functionKey(item),
                    label: item.name + (item.operation !== item.name ? ` · ${item.operation}` : ""),
                  }))}
                  onChange={(value) =>
                    changeContext(() => form.setFieldValue("callableFunction", value))
                  }
                />
              </Form.Item>
            )}
            {standaloneExecution && !callableFunctionsError && !callableFunctions.length && (
              <Alert type="warning" message={caseUiText("noScenarioExecutionEntriesAvailable")} />
            )}
            {standaloneExecution && executionLookupError && (
              <Alert type="error" message={executionLookupError} />
            )}
            <div className={styles.sectionTitle}>{evalTerm("testContent")}</div>
            {callableFunctionsError &&
              (selectedResource?.kind === "function" || standaloneExecution) && (
                <Alert
                  type="warning"
                  showIcon
                  message={caseUiText("functionCatalogueUnavailable")}
                  style={{ marginBottom: 16 }}
                />
              )}
            {resourceEditor && selectedResource && !schemaLoading && (
              <EvalResourceCaseFields
                key={`${networkId}:${selectedResource.kind}:${selectedResource.id}:${caseId ?? "new"}`}
                networkId={networkId}
                resource={selectedResource}
                contract={resourceContract}
                onDefinitionOnlyChange={bindDefinitionOnlyMode}
                outputSchema={outputSchema}
                onArgumentsChange={(value) => form.setFieldValue("argumentsJson", value)}
                initialDefinition={draft?.definition}
                ruleId={
                  caseId
                    ? evalScalarText(draft?.definition.diagnostic_spec.template_rule_id ?? "") ||
                      undefined
                    : undefined
                }
                onPrepared={bindObjectDefinition}
              />
            )}
            {relationEditor && selectedResource && targetSchema.relation && (
              <EvalRelationCaseFields
                key={`${networkId}:${selectedResource.id}:${caseId ?? "new"}`}
                networkId={networkId}
                resource={selectedResource}
                contract={targetSchema.relation}
                initialDefinition={draft?.definition}
                lockedCheck={
                  caseId
                    ? evalScalarText(draft?.definition.execution_spec.relation_rule ?? "") ||
                      undefined
                    : undefined
                }
                onPrepared={bindObjectDefinition}
              />
            )}
            {objectCreation && selectedResource && (
              <EvalObjectCaseFields
                key={`${networkId}:${selectedResource.id}`}
                networkId={networkId}
                resource={selectedResource}
                initialDefinition={draft?.definition}
                onDefinitionOnlyChange={bindDefinitionOnlyMode}
                onPrepared={bindObjectDefinition}
              />
            )}
            {!isObjectDefinition &&
              !objectCreation &&
              !resourceEditor &&
              draft?.definition.execution_spec.runner !== "declaration_preflight" &&
              selectableFunctions.length === 0 &&
              !canQueryResource &&
              selectedResource && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={caseUiText("thisEvaluationTargetDoesNotSupportAutomaticExecutionYet")}
                  description={
                    <>
                      <span>{caseUiText("selectAnotherEvaluationTargetOrConfigureAnObject")}</span>
                    </>
                  }
                />
              )}
            {(canQueryResource || executionMode === "direct") && schemaLoading && (
              <Spin size="small" />
            )}
            {!resourceEditor && (canQueryResource || executionMode === "direct") && schemaError && (
              <Alert
                type="error"
                showIcon
                message={caseUiText("failedToLoadTheParameterContractInputCompleteness")}
                action={
                  <Button size="small" onClick={() => setSchemaRetry((n) => n + 1)}>
                    {caseUiText("knowledgeNetwork.eval.suiteCaseUi.retry")}
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}
            {(canQueryResource || executionMode === "direct") &&
              targetSchema.available === false && (
                <Alert
                  type="warning"
                  showIcon
                  message={targetSchema.reason}
                  style={{ marginBottom: 16 }}
                />
              )}
            {executionMode === "resource" && !resourceEditor && (
              <>
                {targetSchema.help && (
                  <Alert
                    type="info"
                    showIcon
                    message={targetSchema.help}
                    style={{ marginBottom: 16 }}
                  />
                )}
                {criteriaMode && (
                  <Form.Item label={caseUiText("checkPurpose")}>
                    <Segmented
                      name={`eval-check-purpose-${formId}`}
                      value={resourceCheckPurpose(criteria ?? [])}
                      options={[
                        { value: "availability", label: caseUiText("callAvailability") },
                        { value: "business", label: caseUiText("customResultCriteria") },
                        { value: "observe", label: caseUiText("recordOutputOnly") },
                      ]}
                      onChange={(purpose) => {
                        if (purpose === resourceCheckPurpose(criteria ?? [])) return;
                        const apply = () => {
                          form.setFieldValue("criteria", purposeCriteria(purpose as CheckPurpose));
                          setTrialStale(true);
                        };
                        if (
                          resourceCheckPurpose(criteria ?? []) === "business" &&
                          (criteria ?? []).some((c) => c.value !== "" || c.valueProvided)
                        ) {
                          modal.confirm({
                            title: caseUiText("changeTheCheckPurpose"),
                            content: caseUiText("theCurrentEvaluationCriteriaWillBeResetCall"),
                            okText: caseUiText("confirmChange"),
                            cancelText: caseUiText("keepCurrentCriteria"),
                            onOk: apply,
                          });
                        } else apply();
                      }}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  name="argumentsJson"
                  label={caseUiText("callParameters")}
                  extra={caseUiText("parametersFollowTheActualContractTheTestDescription")}
                  rules={[
                    { required: true },
                    {
                      validator: (_, value: string) => {
                        try {
                          validateCaseArguments(value || "{}", targetSchema.input);
                          return Promise.resolve();
                        } catch (cause) {
                          return Promise.reject(
                            cause instanceof Error
                              ? cause
                              : new Error(caseUiText("checkTheParameters")),
                          );
                        }
                      },
                    },
                  ]}
                >
                  <EvalResourceArguments
                    networkId={networkId}
                    kind={queryResourceKind}
                    contract={targetSchema}
                  />
                </Form.Item>
              </>
            )}
            {executionMode === "direct" && !resourceEditor && (
              <>
                {!standaloneExecution && (
                  <Form.Item
                    name="callableFunction"
                    hidden={criteriaMode && selectableFunctions.length === 1}
                    label={caseUiText("targetFunction")}
                    rules={[{ required: true, message: caseUiText("selectACallableFunction") }]}
                  >
                    <Select
                      aria-label={caseUiText("targetFunction")}
                      placeholder={caseUiText("selectAnAuthorizedFunction")}
                      options={selectableFunctions.map((item) => ({
                        value: functionKey(item),
                        label: `${item.name} · ${item.operation}`,
                      }))}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  name="argumentsJson"
                  label={evalTerm("arguments")}
                  extra={caseUiText("parametersArePassedToTheSelectedFunctionUsing")}
                  rules={[
                    { required: true },
                    {
                      validator: (_: unknown, value: string) => {
                        try {
                          validateCaseArguments(value, targetSchema.input, true);
                          return Promise.resolve();
                        } catch (cause) {
                          return Promise.reject(
                            cause instanceof Error
                              ? cause
                              : new Error(caseUiText("enterAJsonObject")),
                          );
                        }
                      },
                    },
                  ]}
                >
                  <EvalCaseArguments
                    schema={targetSchema.input}
                    hiddenFields={Object.keys(targetSchema.system_arguments ?? {})}
                    systemArguments={targetSchema.system_arguments}
                  />
                </Form.Item>
              </>
            )}
            {criteriaMode &&
              executionMode !== "direct" &&
              executionMode !== "resource" &&
              caseType !== "scenario" &&
              selectedResource &&
              ["function", "api", "mcp"].includes(selectedResource.kind) && (
                <Form.Item
                  name="argumentsJson"
                  label={evalTerm("arguments")}
                  extra={label("unboundArguments")}
                  rules={[
                    {
                      validator: (_, value: string) => {
                        try {
                          validateCaseArguments(value ?? "{}", targetSchema.input, true);
                          return Promise.resolve();
                        } catch (cause) {
                          return Promise.reject(
                            cause instanceof Error
                              ? cause
                              : new Error(caseUiText("invalidParameterFormat")),
                          );
                        }
                      },
                    },
                  ]}
                >
                  <EvalCaseArguments schema={targetSchema.input} />
                </Form.Item>
              )}
            {isObjectDefinition && !objectCreation && !resourceEditor && (
              <div className={styles.criteriaValues}>
                <Form.Item label={caseUiText("knowledgeNetwork.eval.relationChecks.check")}>
                  <Input
                    readOnly
                    aria-label={caseUiText("savedCheck")}
                    value={evalScalarText(
                      draft?.definition.input_spec.template_rule_title ??
                        draft?.definition.diagnostic_spec.template_rule_title ??
                        caseUiText("objectDataCheck"),
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label={
                    evalScalarText(draft?.definition.input_spec.template_rule_id ?? "").startsWith(
                      "property-",
                    )
                      ? caseUiText("knowledgeNetwork.eval.relationChecks.property")
                      : caseUiText("knowledgeNetwork.eval.terms.checkTarget")
                  }
                >
                  <Input
                    readOnly
                    aria-label={caseUiText("savedCheckTarget")}
                    value={evalScalarText(
                      (draft?.definition.input_spec.target as Record<string, unknown> | undefined)
                        ?.evaluation_target_name ??
                        draft?.definition.diagnostic_spec.target_name ??
                        selectedResource?.name ??
                        caseUiText("currentEvaluationTarget"),
                    )}
                  />
                </Form.Item>
              </div>
            )}
            {isObjectDefinition && (
              <Space align="start" style={{ width: "100%" }}>
                <Form.Item name="checkMode" label={evalTerm("checkScope")}>
                  <Select
                    style={{ width: 160 }}
                    options={[
                      {
                        value: "sample",
                        label: caseUiText("knowledgeNetwork.eval.resultUi.sampleScope"),
                      },
                      ...((
                        (preparedObject ?? draft?.definition)?.input_spec.check
                          ? ruleCheckAllowsAll(
                              (preparedObject ?? draft?.definition)?.input_spec
                                .check as EvalRuleCheck,
                            )
                          : ["object-key-completeness", "object-key-uniqueness"].includes(
                              String(
                                (preparedObject ?? draft?.definition)?.input_spec.template_rule_id,
                              ),
                            )
                      )
                        ? [
                            {
                              value: "all",
                              label: caseUiText("knowledgeNetwork.eval.suiteCaseUi.allRows"),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Form.Item>
                {checkMode === "sample" && (
                  <Form.Item
                    name="checkLimit"
                    label={caseUiText("knowledgeNetwork.eval.ruleApplication.sampleRows")}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={1000} precision={0} />
                  </Form.Item>
                )}
              </Space>
            )}
            {caseType === "security" &&
              !definitionOnly &&
              (objectCreation || resourceEditor || relationEditor) && (
                <Form.Item
                  name="question"
                  label={caseUiText("securityAssumptionsAndVerificationGoals")}
                  extra={caseUiText("describeTheCurrentAccountInputAndExpectedSecurity")}
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: caseUiText("describeTheSecurityBehaviorToVerify"),
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={2}
                    maxLength={2000}
                    placeholder={caseUiText("forExampleReadThisFieldWithTheCurrent")}
                  />
                </Form.Item>
              )}
            {!objectCreation && !resourceEditor && !relationEditor && !isRelationDefinition && (
              <Form.Item
                name="question"
                label={
                  caseType === "scenario" && !imported
                    ? caseUiText("scenarioDescriptionAndTestInput")
                    : caseType === "security" && !imported
                      ? caseUiText("securityTestInput")
                      : descriptionOptional
                        ? label("functionalDescription")
                        : evalTerm("testInput")
                }
                extra={
                  caseType === "scenario"
                    ? label("scenarioInputHint")
                    : caseType === "security"
                      ? label("securityInputHint")
                      : descriptionOptional
                        ? label("functionalDescriptionHint")
                        : undefined
                }
                rules={descriptionOptional ? [] : [{ required: true, whitespace: true }]}
              >
                <Input.TextArea
                  rows={descriptionOptional ? 2 : 3}
                  maxLength={4000}
                  placeholder={
                    caseType === "scenario"
                      ? label("scenarioInputPlaceholder")
                      : caseType === "security"
                        ? label("securityInputPlaceholder")
                        : label("functionalDescriptionPlaceholder")
                  }
                />
              </Form.Item>
            )}
            {!definitionOnly &&
              !relationEditor &&
              !resourceEditor &&
              !isRelationDefinition &&
              (!objectCreation || preparedObject) && (
                <>
                  <div className={styles.sectionTitle}>{label("criteriaSection")}</div>
                  {fixedAvailability && (
                    <Typography.Paragraph>
                      {caseUiText("theQueryOrCallSucceededAndReturnedAn")}
                    </Typography.Paragraph>
                  )}
                  {criteriaMode &&
                    observedContext === fieldContext &&
                    trialResult?.actual !== undefined && (
                      <Typography.Paragraph type="secondary">
                        {caseUiText("resultFieldsIncludeThoseDiscoveredInThisTest")}
                      </Typography.Paragraph>
                    )}
                  {criteriaMode ? (
                    <Form.Item
                      hidden={fixedAvailability}
                      name="criteria"
                      label={label("criteriaLabel")}
                      extra={label("criteriaHelp")}
                      rules={[
                        {
                          validator: (_, value: CaseCriterion[]) => {
                            try {
                              compileCriteria(value ?? []);
                              return Promise.resolve();
                            } catch (cause) {
                              return Promise.reject(
                                cause instanceof Error
                                  ? cause
                                  : new Error(label("invalidCriteria")),
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <EvalCaseCriteria predicates={formOptions.predicates} schema={outputSchema} />
                    </Form.Item>
                  ) : (
                    <>
                      {hasFixedStandard && (
                        <Typography.Paragraph>
                          {label(
                            isFixedResourceDefinition ? "fixedResourceStandard" : "fixedStandard",
                          )}
                        </Typography.Paragraph>
                      )}
                      <Form.Item
                        name="answer"
                        hidden={hasFixedStandard || objectCreation}
                        label={
                          imported || executionMode === "direct"
                            ? caseUiText("knowledgeNetwork.eval.ruleApplication.expected")
                            : caseType === "scenario"
                              ? evalTerm("expected")
                              : caseType === "security"
                                ? evalTerm("expected")
                                : evalTerm("expected")
                        }
                        rules={[
                          { required: true, whitespace: true },
                          ...(imported || executionMode === "direct"
                            ? [
                                {
                                  validator: (_: unknown, value: string) => {
                                    try {
                                      parseObject(value);
                                      return Promise.resolve();
                                    } catch {
                                      return Promise.reject(
                                        new Error(caseUiText("enterANonEmptyJsonObject")),
                                      );
                                    }
                                  },
                                },
                              ]
                            : []),
                        ]}
                      >
                        <Input.TextArea
                          readOnly={
                            isObjectDefinition ||
                            draft?.definition.diagnostic_spec.expected_locked === true
                          }
                          rows={imported || executionMode === "direct" ? 8 : 3}
                          maxLength={imported || executionMode === "direct" ? 64000 : 4000}
                          placeholder={caseUiText("independentlyVerifiedCorrectResult")}
                        />
                      </Form.Item>
                      {executionMode === "direct" && !resourceEditor && (
                        <Form.Item
                          name="expectedPath"
                          label={caseUiText("comparisonFieldPath")}
                          dependencies={["answer"]}
                          extra={caseUiText("useToCompareTheCompleteResultOr")}
                          rules={[
                            { required: true },
                            {
                              validator: (_: unknown, value: string) => {
                                try {
                                  const answer: unknown = form.getFieldValue("answer");
                                  if (
                                    typeof answer === "string" &&
                                    expectedPathExists(parseObject(answer), value)
                                  )
                                    return Promise.resolve();
                                } catch {
                                  /* invalid expected JSON */
                                }
                                return Promise.reject(
                                  new Error(caseUiText("theFieldPathMustExistInTheExpected")),
                                );
                              },
                            },
                          ]}
                        >
                          <Input placeholder="$.leadtime_days" />
                        </Form.Item>
                      )}
                    </>
                  )}
                </>
              )}
            {needsReference && executionMode === "direct" && sourceKind === "declared_contract" && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={caseUiText("aDeclarationDescribesTheCheckRequirementsButDoes")}
              />
            )}
            {needsReference && (
              <>
                <Form.Item
                  name="sourceKind"
                  label={label("sourceLabel")}
                  extra={label("sourceHelp")}
                  rules={[
                    { required: true },
                    {
                      validator: (_: unknown, value: CaseForm["sourceKind"]) => {
                        if (
                          (executionMode === "direct" || (criteriaMode && needsReference)) &&
                          value === "declared_contract"
                        )
                          return Promise.reject(
                            new Error(
                              caseUiText("automaticExecutionRequiresAnIndependentSampleOrAn"),
                            ),
                          );
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Select
                    disabled={isObjectDefinition && !!caseId}
                    options={[
                      {
                        value: "declared_contract",
                        label: label("sourceContract"),
                        disabled: executionMode === "direct" || (criteriaMode && needsReference),
                      },
                      { value: "independent_sample", label: label("sourceSample") },
                      { value: "business_expert", label: label("sourceExpert") },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="evidenceRef"
                  label={label("evidenceLabel")}
                  extra={label("evidenceHelp")}
                  rules={[
                    { required: true, whitespace: true, message: label("evidenceRequired") },
                    {
                      validator: (_, value: string) => {
                        const line = (value ?? "")
                          .split("\n")
                          .findIndex((entry) => Array.from(entry.trim()).length > 512);
                        return line < 0
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                t("knowledgeNetwork.eval.caseEditor.evidenceTooLong", {
                                  line: line + 1,
                                }),
                              ),
                            );
                      },
                    },
                  ]}
                >
                  <Input.TextArea
                    readOnly={isObjectDefinition}
                    rows={2}
                    maxLength={2000}
                    placeholder={label(
                      sourceKind === "independent_sample"
                        ? "evidenceSamplePlaceholder"
                        : "evidenceExpertPlaceholder",
                    )}
                  />
                </Form.Item>
              </>
            )}
            <div className={styles.sectionTitle}>{label("additionalSection")}</div>
            <Form.Item
              name="diagnosticNote"
              label={caseUiText("knowledgeNetwork.eval.suiteCaseUi.note")}
              extra={label("diagnosticHint")}
            >
              <Input.TextArea rows={2} maxLength={2000} />
            </Form.Item>
            {canEdit && canEditDefinition && (
              <Form.Item
                label={caseUiText("knowledgeNetwork.eval.templateUi.enabled")}
                extra={
                  definitionOnly
                    ? t("knowledgeNetwork.eval.definitionOnly.enableHint")
                    : caseUiText("whenDisabledTheCaseIsSavedButExcluded")
                }
              >
                <Switch
                  aria-label={caseUiText("enableCase")}
                  checked={enableOnSave}
                  disabled={busy || definitionOnly}
                  onChange={setEnableOnSave}
                />
              </Form.Item>
            )}
          </Form>
        </>
      )}
      {trialView && (
        <section aria-label={caseUiText("caseTestRunResult")}>
          <Typography.Title level={5}>{caseUiText("caseTestRunResult")}</Typography.Title>
          {trialStale && <Alert type="warning" showIcon message={label("trialStale")} />}
          {trialResult && (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Space>
                <Tag
                  color={
                    trialResult.evaluation.quality_outcome === "pass"
                      ? "green"
                      : trialResult.evaluation.quality_outcome === "fail"
                        ? "red"
                        : "orange"
                  }
                >
                  {trialResult.evaluation.quality_outcome === "pass"
                    ? evalTerm("passed")
                    : trialResult.evaluation.quality_outcome === "fail"
                      ? evalTerm("notPassed")
                      : evalTerm("inconclusive")}
                </Tag>
              </Space>
              {trialResult.error_class && (
                <Alert
                  type="error"
                  showIcon
                  message={caseUiText("trialExecutionError", {
                    reason: trialErrorClasses()[trialResult.error_class] ?? trialResult.error_class,
                  })}
                  description={trialResult.resource_query_summary?.execution_error}
                />
              )}
              <EvalRelationCheckResult summary={trialResult.resource_query_summary} />
              <Typography.Text strong>{evalTerm("actual")}</Typography.Text>
              <pre style={{ maxHeight: 220, overflow: "auto", background: "#f7f8fa", padding: 12 }}>
                {formatPrecisionSafeJSON(
                  transformPrecisionSafeJSONRequest(trialResult.actual ?? null),
                )}
              </pre>
              <Typography.Text strong>{evalTerm("expected")}</Typography.Text>
              <pre style={{ maxHeight: 220, overflow: "auto", background: "#f7f8fa", padding: 12 }}>
                {formatPrecisionSafeJSON(transformPrecisionSafeJSONRequest(trialResult.expected))}
              </pre>
              <Typography.Text strong>
                {caseUiText("knowledgeNetwork.eval.terms.decisionDetails")}
              </Typography.Text>
              {trialResult.evaluation.assertions.map((item, index) => (
                <div key={item.id}>
                  <Tag
                    color={
                      item.outcome === "pass" ? "green" : item.outcome === "fail" ? "red" : "orange"
                    }
                  >
                    {evalOutcomeLabel(item.outcome)}
                  </Tag>
                  {criteria?.find((c) => c.id === item.id)
                    ? `${criteria.find((c) => c.id === item.id)?.path} · ${label(`predicates.${criteria.find((c) => c.id === item.id)?.type}`)}`
                    : (assertionNames[item.id] ??
                      evalReferenceLabel("decision", { index: index + 1 }))}
                  {item.reason ? `：${assertionReasons()[item.reason] ?? item.reason}` : ""}
                </div>
              ))}
              {trialResult.evidence_status !== "complete" && (
                <Alert
                  type="warning"
                  showIcon
                  message={caseUiText("executionEvidenceIsIncompleteTheTestRunCannot")}
                />
              )}
            </Space>
          )}
        </section>
      )}
    </Drawer>
  );
}
