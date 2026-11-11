/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Col, Collapse, Form, Input, Radio, Row, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  ActionTypeExecutionEditor,
  ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import type { ActionTypeExecutionParameterSchemaState } from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import { ActionTypeRelationFields } from "@/modules/knowledge-network/components/action-type/ActionTypeRelationFields";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";

import {
  actionTypeOperationLabelKey,
  getActionTypeOperationKind,
  readActionTypeOperationKind,
  validateActionRelationBindings,
} from "@/modules/knowledge-network/utils/action-type-operation";
import type {
  ActionTypeOperationConfig,
  ActionTypeOperationKind,
} from "@/modules/knowledge-network/types/action-type";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import {
  DefinitionAliasField,
  DefinitionLifecycleFields,
} from "@/modules/knowledge-network/components/definition-declarations/DefinitionDeclarationFields";
import { DefinitionRefusal } from "@/modules/knowledge-network/components/definition-declarations/DefinitionRefusal";
import {
  getActionSourceDisplayName,
  isActionConditionEmpty,
  normalizeActionTypeCondition,
} from "@/modules/knowledge-network/utils/action-type-execution";
import { validateActionCondition } from "@/modules/knowledge-network/utils/action-type-condition";
import { RelationTypeObjectTypeSelect } from "@/modules/knowledge-network/components/relation-type/RelationTypeObjectTypeSelect";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import {
  DEFAULT_RESOURCE_COLOR,
  ResourceColorSelect,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import { ResourceFormStepsShell } from "@/modules/knowledge-network/components/shared/ResourceFormStepsShell";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  actionTypeCreatedState,
  readActionTypeContext,
} from "@/modules/knowledge-network/lib/action-type-context";
import { knowledgeNetworkReturnPath } from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  RESOURCE_IDENTIFIER_PATTERN,
  RESOURCE_ID_MAX_LENGTH,
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
import {
  createKnowledgeNetworkActionType,
  getKnowledgeNetworkActionType,
  getKnowledgeNetworkActionTypeDetail,
  listKnowledgeNetworkActionTypePage,
  getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkObjectType,
  listKnowledgeNetworkObjectTypePage,
  updateKnowledgeNetworkActionType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  type DeclarationRefusal,
  readDeclarationRefusal,
} from "@/modules/knowledge-network/services/shared/declaration-errors";
import {
  type DefinitionDeclarationFormValues,
  fromDefinitionDeclarationForm,
  toDefinitionDeclarationForm,
} from "@/modules/knowledge-network/utils/definition-declarations";
import type {
  ActionTypeCondition,
  ActionTypeExecutionConfig,
  DefinitionDeclarations,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeFormScene.module.css";

type BasicFormValues = DefinitionDeclarationFormValues & {
  actionKind: KnowledgeNetworkActionTypeKind | "link" | "unlink";
  affectComment?: string;
  affectObjectTypeId?: string;
  color: string;
  condition?: ActionTypeCondition | null;
  description: string;
  id?: string;
  name: string;
  objectTypeId: string;
  relationTypeId?: string;
  relationAnchor?: "source" | "target";
  otherObjectCondition?: ActionTypeCondition | null;
  tags: string[];
};

type ActionOperationDraft = {
  affectComment?: string;
  affectObjectTypeId?: string;
  condition: ActionTypeCondition | null;
  executionValue: ActionTypeExecutionConfig;
  hasSavedCondition: boolean;
  openRulePanels: string[];
  otherObjectCondition: ActionTypeCondition | null;
  relationAnchor?: "source" | "target";
  relationTypeId?: string;
  selectedRelation: KnowledgeNetworkRelationTypeRecord | null;
};

type ActionTypeFormSceneProps = {
  mode: "create" | "edit";
};

const INSTANCE_OPERATIONS = [
  {
    kind: "create",
    titleKey: "knowledgeNetwork.actionTypeInstanceOperationCreate",
  },
  {
    kind: "update",
    titleKey: "knowledgeNetwork.actionTypeInstanceOperationUpdate",
  },
  {
    kind: "delete",
    titleKey: "knowledgeNetwork.actionTypeInstanceOperationDelete",
  },
  { kind: "link", titleKey: "knowledgeNetwork.actionRelationCreate" },
  { kind: "unlink", titleKey: "knowledgeNetwork.actionRelationDelete" },
] as const;

// The rule panel each form field of a collapsed panel sits in.
const RULE_PANEL_OF_FIELD: Readonly<Record<string, string>> = {
  affectComment: "impact",
  affectObjectTypeId: "impact",
  condition: "trigger",
  otherObjectCondition: "trigger",
};

/** The rule panels holding a field that failed validation. */
function rulePanelsOf(error: unknown): string[] {
  const fields = (error as { errorFields?: { name: (string | number)[] }[] } | null)?.errorFields;
  return Array.from(
    new Set(
      (fields ?? []).flatMap((field) => {
        const panel = RULE_PANEL_OF_FIELD[String(field.name[0])];
        return panel ? [panel] : [];
      }),
    ),
  );
}

function highlightObjectTypeName(text: string, objectTypeName: string) {
  const start = objectTypeName ? text.indexOf(objectTypeName) : -1;
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <strong className={styles.objectTypeName}>{objectTypeName}</strong>
      {text.slice(start + objectTypeName.length)}
    </>
  );
}

export function ActionTypeFormScene({ mode }: ActionTypeFormSceneProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", actionTypeId = "" } = useParams<{
    actionTypeId?: string;
    networkId: string;
  }>();
  const routeOperation = new URLSearchParams(location.search).get("operation");
  const legacyCreateMode = (location.state as { actionTypeCreateMode?: unknown } | null)
    ?.actionTypeCreateMode;
  const requestedOperation =
    readActionTypeOperationKind(routeOperation) ??
    (legacyCreateMode === "independent"
      ? "tool"
      : readActionTypeContext(location.state)?.prefill?.execution &&
          !readActionTypeContext(location.state)?.prefill?.objectTypeId
        ? "tool"
        : "object");
  const [operationKind, setOperationKind] = useState<ActionTypeOperationKind>(requestedOperation);
  const isObjectOperation = operationKind === "object";
  const isObjectBoundOperation = operationKind !== "tool";
  const [basicForm] = Form.useForm<BasicFormValues>();
  const activeActionKind = useRef<BasicFormValues["actionKind"]>(
    requestedOperation === "relation" ? "link" : "create",
  );
  const operationDrafts = useRef<
    Partial<Record<BasicFormValues["actionKind"], ActionOperationDraft>>
  >({});
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const mergeResolvedObjectTypes = useCallback((resolved: KnowledgeNetworkObjectTypeRecord[]) => {
    setObjectTypes((current) => {
      const merged = new Map(current.map((item) => [item.id, item]));
      resolved.forEach((item) => merged.set(item.id, item));
      return Array.from(merged.values());
    });
  }, []);
  const [selectedRelation, setSelectedRelation] =
    useState<KnowledgeNetworkRelationTypeRecord | null>(null);
  const [hasSavedCondition, setHasSavedCondition] = useState(false);
  const [conditionPropertyOptions, setConditionPropertyOptions] = useState<
    RelationTypePropertyOption[]
  >([]);
  const [otherPropertyOptions, setOtherPropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  // A page that opened the form for a need may say what carries the action out: the form starts
  // with it, and reads its parameters as for one chosen here.
  const [executionValue, setExecutionValue] = useState<ActionTypeExecutionConfig>(() => {
    const execution =
      mode === "create" ? readActionTypeContext(location.state)?.prefill?.execution : undefined;
    return execution
      ? {
          ...createDefaultActionTypeExecutionConfig(),
          actionSource: { ...execution },
          sourceName: execution.toolName ?? "",
          sourceType: execution.type,
        }
      : createDefaultActionTypeExecutionConfig();
  });
  const [executionSchemaState, setExecutionSchemaState] =
    useState<ActionTypeExecutionParameterSchemaState>({
      loaded: false,
      parameterCount: 0,
    });
  const [executionSourceError, setExecutionSourceError] = useState<string | null>(null);
  const [relationBindingError, setRelationBindingError] = useState<string | null>(null);
  const [relationIdentityError, setRelationIdentityError] = useState<string | null>(null);
  const [openRulePanels, setOpenRulePanels] = useState<string[]>(() =>
    mode === "create" ? ["execution"] : [],
  );
  const [pageTitle, setPageTitle] = useState(
    mode === "edit"
      ? t("knowledgeNetwork.actionTypeEditTitle")
      : t("knowledgeNetwork.actionTypeCreateTitle"),
  );
  const headerTitle =
    mode === "create"
      ? `${pageTitle} · ${t(
          operationKind === "tool"
            ? actionTypeOperationLabelKey("tool")
            : "knowledgeNetwork.actionOperationObjectEntry",
        )}`
      : pageTitle;

  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const returnPath = knowledgeNetworkReturnPath(
    networkId,
    location.state,
    mode === "create" && operationKind !== "object"
      ? `${listPath}?view=list&operation=${operationKind}`
      : listPath,
  );
  // Another page opened the form for a need of its own: it states the need, fills the form and
  // gets the new action type back. Only on create.
  const [navigationContext] = useState(() =>
    mode === "create" ? readActionTypeContext(location.state) : undefined,
  );
  const routeObjectTypeId = (location.state as { actionTypeInitialObjectTypeId?: unknown } | null)
    ?.actionTypeInitialObjectTypeId;
  const prefillObjectTypeId =
    navigationContext?.prefill?.objectTypeId ??
    (mode === "create" && typeof routeObjectTypeId === "string" && routeObjectTypeId.trim()
      ? routeObjectTypeId.trim()
      : undefined);
  const leave = (state?: Record<string, unknown>) =>
    navigationContext
      ? void navigate(navigationContext.returnTo, {
          state: state ?? navigationContext.returnState,
        })
      : void navigate(returnPath);
  const watchedObjectTypeId = Form.useWatch("objectTypeId", basicForm);
  const watchedActionKind = Form.useWatch("actionKind", basicForm);
  const relationAnchor = Form.useWatch("relationAnchor", basicForm);
  const otherObjectTypeId =
    selectedRelation && relationAnchor
      ? relationAnchor === "source"
        ? selectedRelation.targetObjectTypeId
        : selectedRelation.sourceObjectTypeId
      : "";
  const currentObjectTypeName =
    objectTypes.find((item) => item.id === watchedObjectTypeId)?.name ||
    (selectedRelation && selectedRelation.sourceObjectTypeId === watchedObjectTypeId
      ? selectedRelation.sourceObjectTypeName
      : selectedRelation?.targetObjectTypeName) ||
    watchedObjectTypeId ||
    t("knowledgeNetwork.actionRelationCurrentObject");
  const otherObjectTypeName =
    objectTypes.find((item) => item.id === otherObjectTypeId)?.name ||
    (relationAnchor === "source"
      ? selectedRelation?.targetObjectTypeName
      : selectedRelation?.sourceObjectTypeName) ||
    otherObjectTypeId;
  const selfRelation =
    selectedRelation !== null &&
    selectedRelation.sourceObjectTypeId === selectedRelation.targetObjectTypeId;
  const currentConditionObjectName =
    selfRelation && relationAnchor
      ? t("knowledgeNetwork.actionRelationObjectWithRole", {
          objectTypeName: currentObjectTypeName,
          role: t(
            relationAnchor === "source"
              ? "knowledgeNetwork.actionRelationSourceRole"
              : "knowledgeNetwork.actionRelationTargetRole",
          ),
        })
      : currentObjectTypeName;
  const otherConditionObjectName =
    selfRelation && relationAnchor
      ? t("knowledgeNetwork.actionRelationObjectWithRole", {
          objectTypeName: otherObjectTypeName,
          role: t(
            relationAnchor === "source"
              ? "knowledgeNetwork.actionRelationTargetRole"
              : "knowledgeNetwork.actionRelationSourceRole",
          ),
        })
      : otherObjectTypeName;
  // What the aliases and lifecycle were when the action type was read; a save sends what changed.
  const definitionBaseline = useRef<DefinitionDeclarations | undefined>(undefined);
  const [definitionRefusal, setDefinitionRefusal] = useState<DeclarationRefusal | null>(null);
  const watchedCondition = Form.useWatch("condition", basicForm);
  const watchedOtherCondition = Form.useWatch("otherObjectCondition", basicForm);
  const conditionObjectTypeId = watchedCondition?.objectTypeId || watchedObjectTypeId;
  const showConditionPanel =
    operationKind === "relation" ||
    (isObjectOperation && watchedActionKind !== "create" && watchedActionKind !== undefined);

  const switchActionKind = (nextKind: BasicFormValues["actionKind"]) => {
    const previousKind = activeActionKind.current;
    if (previousKind === nextKind) return;

    const condition = basicForm.getFieldValue("condition") as
      ActionTypeCondition | null | undefined;
    const otherObjectCondition = basicForm.getFieldValue("otherObjectCondition") as
      ActionTypeCondition | null | undefined;
    operationDrafts.current[previousKind] = {
      affectComment: basicForm.getFieldValue("affectComment") as string | undefined,
      affectObjectTypeId: basicForm.getFieldValue("affectObjectTypeId") as string | undefined,
      condition: condition ? structuredClone(condition) : null,
      executionValue: structuredClone(executionValue),
      hasSavedCondition,
      openRulePanels: [...openRulePanels],
      otherObjectCondition: otherObjectCondition ? structuredClone(otherObjectCondition) : null,
      relationAnchor: basicForm.getFieldValue("relationAnchor") as "source" | "target" | undefined,
      relationTypeId: basicForm.getFieldValue("relationTypeId") as string | undefined,
      selectedRelation,
    };

    const nextDraft = operationDrafts.current[nextKind];
    basicForm.setFieldsValue({
      actionKind: nextKind,
      affectComment: nextDraft?.affectComment ?? "",
      affectObjectTypeId: nextDraft?.affectObjectTypeId,
      condition: nextDraft?.condition ? structuredClone(nextDraft.condition) : null,
      otherObjectCondition: nextDraft?.otherObjectCondition
        ? structuredClone(nextDraft.otherObjectCondition)
        : null,
      relationAnchor: nextDraft?.relationAnchor,
      relationTypeId: nextDraft?.relationTypeId,
    });
    basicForm.setFields(
      (
        [
          "condition",
          "otherObjectCondition",
          "relationTypeId",
          "relationAnchor",
          "affectComment",
          "affectObjectTypeId",
        ] as const
      ).map((name) => ({ name, errors: [] })),
    );
    activeActionKind.current = nextKind;
    setOperationKind(nextKind === "link" || nextKind === "unlink" ? "relation" : "object");
    setSelectedRelation(nextDraft?.selectedRelation ?? null);
    setExecutionValue(
      nextDraft
        ? structuredClone(nextDraft.executionValue)
        : createDefaultActionTypeExecutionConfig(),
    );
    setExecutionSchemaState({ loaded: false, parameterCount: 0 });
    setHasSavedCondition(nextDraft?.hasSavedCondition ?? false);
    setOpenRulePanels(nextDraft?.openRulePanels ?? ["execution"]);
    setExecutionSourceError(null);
    setRelationBindingError(null);
    setRelationIdentityError(null);
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const leaveMessage = t("knowledgeNetwork.objectTypeUnsavedLeaveDescription");
      event.preventDefault();
      event.returnValue = leaveMessage;
      return leaveMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setConditionPropertyOptions([]);
    const loadConditionProperties = async () => {
      if (!networkId || !conditionObjectTypeId) {
        setConditionPropertyOptions([]);
        return;
      }

      const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, conditionObjectTypeId);
      if (cancelled) return;
      setConditionPropertyOptions(
        detail?.dataProperties.map((item) => ({
          comment: item.comment,
          displayName: item.displayName || item.name,
          label: item.displayName || item.name,
          name: item.name,
          type: item.type,
          value: item.name,
        })) ?? [],
      );
    };

    void loadConditionProperties().catch(() => {
      if (!cancelled) setConditionPropertyOptions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [conditionObjectTypeId, networkId]);

  useEffect(() => {
    let cancelled = false;
    setOtherPropertyOptions([]);
    if (operationKind !== "relation" || !otherObjectTypeId) return;
    void getKnowledgeNetworkObjectTypeDetail(networkId, otherObjectTypeId)
      .then((detail) => {
        if (!cancelled)
          setOtherPropertyOptions(
            detail?.dataProperties.map((item) => ({
              comment: item.comment,
              displayName: item.displayName || item.name,
              label: item.displayName || item.name,
              name: item.name,
              type: item.type,
              value: item.name,
            })) ?? [],
          );
      })
      .catch(() => {
        if (!cancelled) setOtherPropertyOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, otherObjectTypeId, operationKind]);

  useEffect(() => {
    const condition = basicForm.getFieldValue("condition") as
      ActionTypeCondition | null | undefined;
    if (
      condition?.objectTypeId &&
      watchedObjectTypeId &&
      condition.objectTypeId !== watchedObjectTypeId
    ) {
      basicForm.setFieldValue("condition", null);
    }
  }, [basicForm, watchedObjectTypeId]);

  useEffect(() => {
    if (
      watchedOtherCondition?.objectTypeId &&
      otherObjectTypeId &&
      watchedOtherCondition.objectTypeId !== otherObjectTypeId
    ) {
      basicForm.setFieldValue("otherObjectCondition", null);
    }
  }, [basicForm, otherObjectTypeId, watchedOtherCondition]);

  useEffect(() => {
    const loadData = async () => {
      if (!networkId) {
        return;
      }

      try {
        const objectTypePage = await listKnowledgeNetworkObjectTypePage(networkId, {
          direction: "asc",
          limit: 20,
          offset: 0,
          sort: "name",
        });
        let nextObjectTypes = objectTypePage.entries;

        if (mode === "edit" && actionTypeId) {
          setLoading(true);
          const detail = await getKnowledgeNetworkActionTypeDetail(networkId, actionTypeId);
          if (!detail) {
            throw new Error(t("common.notFound"));
          }

          const nextBasic: BasicFormValues = {
            actionKind:
              detail.operationConfig?.type === "relation"
                ? detail.operationConfig.relationOperation === "delete"
                  ? "unlink"
                  : "link"
                : detail.actionKind,
            ...(detail.operationConfig?.type === "relation" ? detail.operationConfig : {}),
            relationAnchor:
              detail.operationConfig?.type === "relation"
                ? detail.operationConfig.anchorRole
                : undefined,
            otherObjectCondition:
              detail.operationConfig?.type === "relation"
                ? (detail.operationConfig.otherObjectCondition ?? null)
                : null,
            affectComment: detail.affect?.comment ?? "",
            affectObjectTypeId: detail.affect?.objectTypeId,
            color: detail.color,
            condition:
              detail.operationConfig?.type !== "relation" && detail.actionKind === "create"
                ? null
                : (detail.condition ?? null),
            description: detail.description,
            id: detail.id,
            name: detail.name,
            objectTypeId: detail.objectTypeId,
            tags: detail.tags,
            ...toDefinitionDeclarationForm(detail.declarations),
          };
          definitionBaseline.current = detail.declarations
            ? structuredClone(detail.declarations)
            : undefined;
          const selectedObjectTypes = await Promise.all(
            Array.from(
              new Set([nextBasic.objectTypeId, nextBasic.affectObjectTypeId].filter(Boolean)),
            )
              .filter((id) => !nextObjectTypes.some((item) => item.id === id))
              .map((id) => getKnowledgeNetworkObjectType(networkId, id!)),
          );
          nextObjectTypes = [
            ...nextObjectTypes,
            ...selectedObjectTypes.filter((item): item is KnowledgeNetworkObjectTypeRecord =>
              Boolean(item),
            ),
          ];

          setExecutionValue(detail.executionConfig);
          setOperationKind(getActionTypeOperationKind(detail));
          activeActionKind.current = nextBasic.actionKind;
          operationDrafts.current = {};
          setHasSavedCondition(
            detail.operationConfig?.type !== "relation" && detail.actionKind === "create"
              ? false
              : !isActionConditionEmpty(detail.condition),
          );
          setPageTitle(detail.name);
          basicForm.setFieldsValue(nextBasic);
        } else if (
          prefillObjectTypeId &&
          !nextObjectTypes.some((item) => item.id === prefillObjectTypeId)
        ) {
          // The object type the form starts with may lie past the first page.
          const prefilled = await getKnowledgeNetworkObjectType(networkId, prefillObjectTypeId);
          nextObjectTypes = prefilled ? [...nextObjectTypes, prefilled] : nextObjectTypes;
        }
        setObjectTypes(nextObjectTypes);
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [actionTypeId, basicForm, mode, networkId, prefillObjectTypeId, t]);

  const steps = useMemo(() => [{ title: t("knowledgeNetwork.actionTypeConfigStep") }], [t]);

  const goBack = () => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeUnsavedLeaveTitle"),
      content: t("knowledgeNetwork.objectTypeUnsavedLeaveDescription"),
      cancelText: t("common.cancel"),
      okText: t("knowledgeNetwork.objectTypeUnsavedLeaveOk"),
      onOk: () => leave(),
    });
  };

  const syncBasicValueFromForm = async (): Promise<BasicFormValues | null> => {
    try {
      const values = await basicForm.validateFields();
      if (mode === "edit") {
        setPageTitle(values.name.trim() || t("knowledgeNetwork.actionTypeEditTitle"));
      }
      return values;
    } catch (error) {
      // Opens the rule panels holding a field that failed, so the message can be seen.
      const failed = rulePanelsOf(error);
      if (failed.length) {
        setOpenRulePanels((open) => Array.from(new Set([...open, ...failed])));
      }
      return null;
    }
  };

  const handleSubmit = async () => {
    const resolvedBasic = await syncBasicValueFromForm();
    if (!resolvedBasic) {
      return;
    }

    const validationErrorKey = validateActionTypeExecutionConfig(executionValue, {
      allowEmptyParameters:
        executionSchemaState.loaded && executionSchemaState.parameterCount === 0,
    });
    if (validationErrorKey) {
      const validationError = t(validationErrorKey);
      setExecutionSourceError(
        validationErrorKey === ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY ? validationError : null,
      );
      setOpenRulePanels((open) => (open.includes("execution") ? open : [...open, "execution"]));
      void message.error(validationError);
      return;
    }
    setExecutionSourceError(null);
    if (operationKind === "relation") {
      const errorKey =
        relationIdentityError ?? validateActionRelationBindings(executionValue.parameters ?? []);
      if (errorKey) {
        setRelationBindingError(t(errorKey));
        setOpenRulePanels((open) => (open.includes("execution") ? open : [...open, "execution"]));
        return;
      }
    }
    setRelationBindingError(null);

    const normalizedExecution = normalizeActionTypeExecutionConfig(executionValue);
    const affect =
      isObjectOperation && (resolvedBasic.affectObjectTypeId || resolvedBasic.affectComment?.trim())
        ? {
            comment: resolvedBasic.affectComment?.trim() || undefined,
            objectTypeId: resolvedBasic.affectObjectTypeId,
          }
        : undefined;
    const operationConfig: ActionTypeOperationConfig =
      operationKind === "relation"
        ? {
            type: "relation",
            relationTypeId: resolvedBasic.relationTypeId!,
            relationOperation: resolvedBasic.actionKind === "unlink" ? "delete" : "create",
            anchorRole: resolvedBasic.relationAnchor!,
            otherObjectCondition: normalizeActionTypeCondition(
              resolvedBasic.otherObjectCondition,
              otherObjectTypeId,
            ),
          }
        : { type: operationKind };
    const payload: KnowledgeNetworkActionTypeMutationPayload = {
      operationConfig,
      // The backend still requires an operation enum for object-free actions. It has no object
      // semantics in this mode, so non-object operations retain the legacy create/add value.
      actionKind:
        resolvedBasic.actionKind === "link" || resolvedBasic.actionKind === "unlink"
          ? "create"
          : (resolvedBasic.actionKind ?? "create"),
      affect,
      color: resolvedBasic.color,
      condition:
        !isObjectBoundOperation || (isObjectOperation && resolvedBasic.actionKind === "create")
          ? undefined
          : normalizeActionTypeCondition(resolvedBasic.condition, resolvedBasic.objectTypeId),
      description: resolvedBasic.description,
      executionConfig: normalizedExecution,
      id: resolvedBasic.id,
      name: resolvedBasic.name,
      objectTypeId: resolvedBasic.objectTypeId || "",
      tags: resolvedBasic.tags,
      definitionDeclarationEdit: {
        baseline: definitionBaseline.current,
        current: fromDefinitionDeclarationForm(resolvedBasic),
      },
    };

    setSubmitting(true);
    setDefinitionRefusal(null);
    try {
      let createdId: string | undefined;
      if (mode === "edit" && actionTypeId) {
        await updateKnowledgeNetworkActionType(networkId, actionTypeId, payload);
      } else {
        createdId = (await createKnowledgeNetworkActionType(networkId, payload))?.id;
      }

      void message.success(t("common.success"));
      leave(
        navigationContext && createdId
          ? actionTypeCreatedState(navigationContext, createdId)
          : undefined,
      );
    } catch (error) {
      const refusal = readDeclarationRefusal(error);
      if (refusal) {
        // Shown above the basic info, where the aliases and lifecycle are.
        setDefinitionRefusal(refusal);
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const searchReplacements = useCallback(
    async (keyword: string) =>
      (
        await listKnowledgeNetworkActionTypePage(networkId, {
          direction: "asc",
          limit: 20,
          namePattern: keyword || undefined,
          offset: 0,
          sort: "name",
        })
      ).entries,
    [networkId],
  );
  const resolveReplacement = useCallback(
    // The select says itself when the replacement is gone or hidden; no error toast.
    async (id: string) =>
      (await getKnowledgeNetworkActionType(networkId, id, { skipErrorToast: true })) ?? undefined,
    [networkId],
  );

  const renderStepContent = () => {
    return (
      <div className={styles.basicForm}>
        {definitionRefusal ? (
          <DefinitionRefusal
            networkId={networkId}
            refusal={definitionRefusal}
            saved={{
              id:
                mode === "edit"
                  ? actionTypeId
                  : (basicForm.getFieldValue("id") as string | undefined),
              kind: "action_type",
            }}
          />
        ) : null}
        <Form
          colon={false}
          form={basicForm}
          initialValues={{
            actionKind: requestedOperation === "relation" ? "link" : "create",
            otherObjectCondition: null,
            aliases: [],
            lifecycleStatus: "active",
            color: DEFAULT_RESOURCE_COLOR,
            description: navigationContext?.prefill?.description ?? "",
            name: navigationContext?.prefill?.name ?? "",
            ...(operationKind === "object" && prefillObjectTypeId
              ? { objectTypeId: prefillObjectTypeId }
              : {}),
            tags: [],
          }}
          layout="vertical"
          requiredMark
        >
          <section className={styles.formSection}>
            <h3>{t("knowledgeNetwork.actionTypeBasicInfo")}</h3>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label={t("knowledgeNetwork.actionTypeName")}
                  name="name"
                  rules={[
                    {
                      message: t("knowledgeNetwork.actionTypeNameRequired"),
                      required: true,
                    },
                    {
                      max: RESOURCE_NAME_MAX_LENGTH,
                      message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                    },
                  ]}
                >
                  <Input
                    count={RESOURCE_NAME_COUNT}
                    placeholder={t("knowledgeNetwork.pleaseInput")}
                    showCount
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="ID"
                  name="id"
                  rules={[
                    {
                      max: RESOURCE_ID_MAX_LENGTH,
                      message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                    },
                    {
                      message: t("knowledgeNetwork.objectTypeIdPattern"),
                      pattern: RESOURCE_IDENTIFIER_PATTERN,
                    },
                  ]}
                >
                  <Input
                    disabled={mode === "edit"}
                    maxLength={RESOURCE_ID_MAX_LENGTH}
                    placeholder={t("knowledgeNetwork.pleaseInput")}
                    showCount
                  />
                </Form.Item>
              </Col>
            </Row>
            <DefinitionAliasField hintInTooltip ownNameFields={["name"]} />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label={t("common.tag")}
                  name="tags"
                  rules={[
                    {
                      validator: (rule, value) => validateKnowledgeNetworkTags(t, rule, value),
                    },
                  ]}
                >
                  <ResourceTagsSelect />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t("knowledgeNetwork.color")} name="color">
                  <ResourceColorSelect inModal={false} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 8 }}
                maxLength={1000}
                placeholder={t("knowledgeNetwork.pleaseInput")}
                showCount
              />
            </Form.Item>
            <DefinitionLifecycleFields
              definitionId={mode === "edit" ? actionTypeId : undefined}
              hintInTooltip
              resolveReplacement={resolveReplacement}
              searchReplacements={searchReplacements}
            />
          </section>
          <section className={styles.formSection}>
            <div className={styles.operationHeading}>
              <h3>{t("knowledgeNetwork.actionOperationConfiguration")}</h3>
            </div>
            {!isObjectBoundOperation ? null : (
              <>
                <Form.Item
                  label={t("knowledgeNetwork.actionTypeTargetObject")}
                  name="objectTypeId"
                  rules={[
                    { message: t("knowledgeNetwork.actionTypeObjectRequired"), required: true },
                  ]}
                >
                  <RelationTypeObjectTypeSelect
                    networkId={networkId}
                    objectTypes={objectTypes}
                    onResolvedOptionsChange={mergeResolvedObjectTypes}
                    onChange={(nextId) => {
                      if (nextId !== watchedObjectTypeId) {
                        operationDrafts.current = {};
                        basicForm.setFieldsValue({
                          condition: null,
                          otherObjectCondition: null,
                          relationTypeId: undefined,
                          relationAnchor: undefined,
                          affectObjectTypeId: undefined,
                          affectComment: "",
                        });
                        setSelectedRelation(null);
                        setHasSavedCondition(false);
                        setExecutionValue((current) => ({
                          ...current,
                          parameters: (current.parameters ?? []).map((parameter) =>
                            parameter.valueFrom === "property" ||
                            parameter.valueFrom === "source_identity" ||
                            parameter.valueFrom === "target_identity"
                              ? {
                                  ...parameter,
                                  valueFrom: "input",
                                  value: undefined,
                                  sourcePropertyName: undefined,
                                }
                              : parameter,
                          ),
                        }));
                      }
                    }}
                    placeholder={t("knowledgeNetwork.actionTypeObjectSelectPlaceholder")}
                  />
                </Form.Item>
                <Form.Item
                  label={t("knowledgeNetwork.actionOperationTypeLabel")}
                  name="actionKind"
                  rules={[
                    { message: t("knowledgeNetwork.actionTypeKindRequired"), required: true },
                  ]}
                >
                  <Radio.Group
                    onChange={(event) => {
                      switchActionKind(event.target.value as BasicFormValues["actionKind"]);
                    }}
                    options={INSTANCE_OPERATIONS.map(({ kind, titleKey }) => ({
                      label: t(titleKey),
                      value: kind,
                    }))}
                  />
                </Form.Item>
              </>
            )}
            {operationKind === "relation" ? (
              <ActionTypeRelationFields
                networkId={networkId}
                objectTypeId={watchedObjectTypeId || ""}
                onRelationChange={setSelectedRelation}
                onRelationTypeChange={() => {
                  basicForm.setFieldValue("otherObjectCondition", null);
                  setExecutionValue((current) => ({
                    ...current,
                    parameters: (current.parameters ?? []).map((parameter) =>
                      parameter.valueFrom === "source_identity" ||
                      parameter.valueFrom === "target_identity"
                        ? { ...parameter, valueFrom: "input", value: undefined }
                        : parameter,
                    ),
                  }));
                  setRelationBindingError(null);
                }}
              />
            ) : null}
            <Collapse
              bordered={false}
              className={styles.ruleCollapse}
              activeKey={openRulePanels}
              items={[
                ...(showConditionPanel
                  ? [
                      {
                        // Rendered while collapsed too: a field only reaches the saved values once it
                        // is mounted, so a save without opening the panel would drop it. The same
                        // holds for the other two panels.
                        forceRender: true,
                        key: "trigger",
                        label: (
                          <span className={styles.ruleHeader}>
                            <span className={styles.ruleIndex}>1</span>
                            <span>{t("knowledgeNetwork.actionTypeApplicableCondition")}</span>
                          </span>
                        ),
                        children: (
                          <div className={styles.ruleSection}>
                            <p className={styles.ruleHint}>
                              {highlightObjectTypeName(
                                t(
                                  operationKind === "relation"
                                    ? "knowledgeNetwork.actionRelationConditionsHint"
                                    : "knowledgeNetwork.actionTypeApplicableConditionHint",
                                  {
                                    objectTypeName: watchedObjectTypeId
                                      ? currentObjectTypeName
                                      : t("knowledgeNetwork.actionTypeGenericObjectName"),
                                  },
                                ),
                                operationKind === "object" && watchedObjectTypeId
                                  ? currentObjectTypeName
                                  : "",
                              )}
                            </p>
                            <Form.Item
                              label={
                                operationKind === "relation"
                                  ? highlightObjectTypeName(
                                      t("knowledgeNetwork.actionRelationCurrentCondition", {
                                        objectTypeName: currentConditionObjectName,
                                      }),
                                      watchedObjectTypeId ? currentObjectTypeName : "",
                                    )
                                  : t("knowledgeNetwork.actionTypeTriggerCondition")
                              }
                              name="condition"
                              rules={[
                                {
                                  validator: (_, condition: ActionTypeCondition | undefined) => {
                                    const error = validateActionCondition(
                                      condition,
                                      conditionPropertyOptions,
                                      executionValue.parameters ?? [],
                                    );
                                    return error
                                      ? Promise.reject(new Error(t(error)))
                                      : Promise.resolve();
                                  },
                                },
                              ]}
                            >
                              <ActionTypeConditionEditor
                                boundObjectTypeId={watchedObjectTypeId}
                                executionParameters={executionValue.parameters ?? []}
                                hideObjectTypeSelect
                                objectTypes={objectTypes}
                                propertyOptions={conditionPropertyOptions}
                              />
                            </Form.Item>
                            {operationKind === "relation" && otherObjectTypeId ? (
                              <Form.Item
                                label={highlightObjectTypeName(
                                  t("knowledgeNetwork.actionRelationOtherCondition", {
                                    objectTypeName: otherConditionObjectName,
                                  }),
                                  otherObjectTypeName,
                                )}
                                name="otherObjectCondition"
                                rules={[
                                  {
                                    validator: (_, condition: ActionTypeCondition | undefined) => {
                                      const error = validateActionCondition(
                                        condition,
                                        otherPropertyOptions,
                                        executionValue.parameters ?? [],
                                      );
                                      return error
                                        ? Promise.reject(new Error(t(error)))
                                        : Promise.resolve();
                                    },
                                  },
                                ]}
                              >
                                <ActionTypeConditionEditor
                                  boundObjectTypeId={otherObjectTypeId}
                                  executionParameters={executionValue.parameters ?? []}
                                  hideObjectTypeSelect
                                  objectTypes={objectTypes}
                                  propertyOptions={otherPropertyOptions}
                                />
                              </Form.Item>
                            ) : null}
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  // Mounted while collapsed as well, so it reports whether the tool takes
                  // parameters before a save checks them.
                  forceRender: true,
                  key: "execution",
                  label: (
                    <span className={styles.ruleHeader}>
                      <span className={styles.ruleIndex}>{showConditionPanel ? 2 : 1}</span>
                      <span>{t("knowledgeNetwork.actionTypeExecutionTool")}</span>
                    </span>
                  ),
                  children: (
                    <div className={styles.ruleSection}>
                      {operationKind !== "tool" ? (
                        <p className={styles.ruleHint}>
                          {highlightObjectTypeName(
                            t(
                              operationKind === "relation"
                                ? "knowledgeNetwork.actionRelationExecutionHint"
                                : watchedActionKind === "update"
                                  ? "knowledgeNetwork.actionTypeExecutionUpdateHint"
                                  : watchedActionKind === "delete"
                                    ? "knowledgeNetwork.actionTypeExecutionDeleteHint"
                                    : "knowledgeNetwork.actionTypeExecutionCreateHint",
                              {
                                objectTypeName: watchedObjectTypeId
                                  ? currentObjectTypeName
                                  : t("knowledgeNetwork.actionTypeGenericObjectName"),
                              },
                            ),
                            operationKind === "object" && watchedObjectTypeId
                              ? currentObjectTypeName
                              : "",
                          )}
                        </p>
                      ) : null}
                      <ActionTypeExecutionEditor
                        key={watchedActionKind ?? "create"}
                        networkId={networkId}
                        objectTypeId={
                          operationKind === "tool"
                            ? ""
                            : (watchedObjectTypeId ??
                              (basicForm.getFieldValue("objectTypeId") as string | undefined) ??
                              "")
                        }
                        onParameterSchemaStateChange={setExecutionSchemaState}
                        onChange={(nextValue) => {
                          setExecutionValue(nextValue);
                          setRelationBindingError(null);
                          if (
                            getActionSourceDisplayName(nextValue.actionSource) ||
                            nextValue.sourceName.trim()
                          ) {
                            setExecutionSourceError(null);
                          }
                        }}
                        sourceError={executionSourceError}
                        parameterError={operationKind === "relation" ? relationBindingError : null}
                        onRelationValidationChange={setRelationIdentityError}
                        relationBinding={
                          operationKind === "relation"
                            ? {
                                relation: selectedRelation,
                              }
                            : undefined
                        }
                        value={executionValue}
                      />
                    </div>
                  ),
                },
                ...(isObjectOperation
                  ? [
                      {
                        forceRender: true,
                        key: "impact",
                        label: (
                          <span className={styles.ruleHeader}>
                            <span className={styles.ruleIndex}>{showConditionPanel ? 3 : 2}</span>
                            <span>{t("knowledgeNetwork.actionTypeAdditionalImpact")}</span>
                          </span>
                        ),
                        children: (
                          <div className={styles.ruleSection}>
                            <p className={styles.ruleHint}>
                              {highlightObjectTypeName(
                                t("knowledgeNetwork.actionTypeImpactStaticHint", {
                                  objectTypeName: watchedObjectTypeId
                                    ? currentObjectTypeName
                                    : t("knowledgeNetwork.actionTypeGenericObjectName"),
                                }),
                                watchedObjectTypeId ? currentObjectTypeName : "",
                              )}
                            </p>
                            <Form.Item
                              label={t("knowledgeNetwork.actionTypeAffectedObject")}
                              name="affectObjectTypeId"
                            >
                              <RelationTypeObjectTypeSelect
                                allowClear
                                networkId={networkId}
                                objectTypes={objectTypes}
                                placeholder={t(
                                  "knowledgeNetwork.actionTypeAffectedObjectPlaceholder",
                                )}
                              />
                            </Form.Item>
                            <Form.Item
                              label={t("knowledgeNetwork.actionTypeAffectDescription")}
                              name="affectComment"
                            >
                              <Input.TextArea
                                autoSize={{ minRows: 3, maxRows: 6 }}
                                maxLength={255}
                                placeholder={t(
                                  "knowledgeNetwork.actionTypeAffectDescriptionPlaceholder",
                                )}
                                showCount
                              />
                            </Form.Item>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              onChange={(keys) => setOpenRulePanels(Array.isArray(keys) ? keys : [keys])}
            />
          </section>
        </Form>
      </div>
    );
  };

  if (loading) {
    return (
      <ResourceFormStepsShell
        currentStep={0}
        doneStep={0}
        hideSteps
        onBack={goBack}
        steps={steps}
        title={headerTitle}
      >
        <div className={styles.loadingState}>
          <Spin />
        </div>
      </ResourceFormStepsShell>
    );
  }

  const stepActions = loadError
    ? undefined
    : {
        save: {
          loading: submitting,
          onClick: () => {
            void handleSubmit();
          },
          text: t("knowledgeNetwork.actionTypeSaveAndExit"),
        },
        cancel: {
          onClick: goBack,
          text: t("common.cancel"),
        },
      };

  return (
    <ResourceFormStepsShell
      actions={stepActions}
      currentStep={0}
      doneStep={0}
      hideSteps
      onBack={goBack}
      steps={steps}
      title={headerTitle}
    >
      {loadError ? (
        <Alert className={styles.loadError} message={loadError} showIcon type="error" />
      ) : null}
      {navigationContext && !loadError ? (
        <Alert
          action={
            <Button onClick={() => leave()} size="small">
              {navigationContext.returnLabel}
            </Button>
          }
          className={styles.contextAlert}
          description={
            navigationContext.notice ? (
              <>
                {navigationContext.description ? <div>{navigationContext.description}</div> : null}
                <div>{navigationContext.notice}</div>
              </>
            ) : (
              navigationContext.description
            )
          }
          message={navigationContext.title}
          showIcon
          type="info"
        />
      ) : null}
      {loadError ? null : renderStepContent()}
    </ResourceFormStepsShell>
  );
}
