/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ShareAltOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Spin } from "antd";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  validateRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
} from "@/modules/knowledge-network/components/relation-type/mapping-utils";
import { DefinitionDeclarationFields } from "@/modules/knowledge-network/components/definition-declarations/DefinitionDeclarationFields";
import { DefinitionRefusal } from "@/modules/knowledge-network/components/definition-declarations/DefinitionRefusal";
import { RelationDeclarationsSection } from "@/modules/knowledge-network/components/relation-type/RelationDeclarationsSection";
import { useRelationPropertyGuard } from "@/modules/knowledge-network/components/relation-type/relation-property-guard";
import { DEFAULT_RESOURCE_COLOR } from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import { ResourceFormStepsShell } from "@/modules/knowledge-network/components/shared/ResourceFormStepsShell";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import { knowledgeNetworkReturnPath } from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  RESOURCE_IDENTIFIER_PATTERN,
  RESOURCE_ID_MAX_LENGTH,
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
import {
  createKnowledgeNetworkRelationType,
  getKnowledgeNetworkRelationTypeDetail,
  getKnowledgeNetworkObjectType,
  getKnowledgeNetworkRelationType,
  listKnowledgeNetworkObjectTypePage,
  listKnowledgeNetworkRelationTypePage,
  updateKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  definitionDeclarationPatch,
  relationDeclarationPatch,
} from "@/modules/knowledge-network/services/mappers/declarations";
import {
  type DeclarationRefusal,
  readDeclarationRefusal,
} from "@/modules/knowledge-network/services/shared/declaration-errors";
import { isRelationBasicInfoRefusal } from "@/modules/knowledge-network/services/shared/definition-refusals";
import {
  type DefinitionDeclarationFormValues,
  definitionAliasProblem,
  fromDefinitionDeclarationForm,
  toDefinitionDeclarationForm,
} from "@/modules/knowledge-network/utils/definition-declarations";
import type {
  DefinitionDeclarations,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeMutationPayload,
  RelationDeclarations,
  StoredRelationProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeFormScene.module.css";

const RelationTypeMappingEditor = lazy(async () => {
  const module =
    await import("@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor");
  return { default: module.RelationTypeMappingEditor };
});

type BasicFormValues = DefinitionDeclarationFormValues & {
  color: string;
  description: string;
  id?: string;
  name: string;
  tags: string[];
};

type RelationTypeFormSceneProps = {
  mode: "create" | "edit";
};

export function RelationTypeFormScene({ mode }: RelationTypeFormSceneProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", relationTypeId = "" } = useParams<{
    networkId: string;
    relationTypeId?: string;
  }>();
  const [basicForm] = Form.useForm<BasicFormValues>();
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [doneStep, setDoneStep] = useState(0);
  const [basicValue, setBasicValue] = useState<BasicFormValues | null>(null);
  const [mappingValue, setMappingValue] = useState<RelationTypeMappingFormValues>(
    createDefaultRelationTypeMappingValues(),
  );
  const [declarations, setDeclarations] = useState<RelationDeclarations | undefined>();
  // What the declarations were when read: a save sends only the ones that changed.
  const declarationBaseline = useRef<RelationDeclarations | undefined>(undefined);
  const [relationProperties, setRelationProperties] = useState<StoredRelationProperty[]>([]);
  const [refusal, setRefusal] = useState<DeclarationRefusal | null>(null);
  // Whether the refusal concerns the aliases or lifecycle, shown in the basic info.
  const [refusalOnBasicInfo, setRefusalOnBasicInfo] = useState(false);
  // What the aliases and lifecycle were when read; a save sends what changed.
  const definitionBaseline = useRef<DefinitionDeclarations | undefined>(undefined);
  const confirmRelationPropertyChange = useRelationPropertyGuard();
  const [pageTitle, setPageTitle] = useState(
    mode === "edit"
      ? t("knowledgeNetwork.relationTypeEditTitle")
      : t("knowledgeNetwork.relationTypeCreateTitle"),
  );

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;
  const returnPath = knowledgeNetworkReturnPath(networkId, location.state, listPath);

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
        setObjectTypes(nextObjectTypes);

        if (mode === "edit" && relationTypeId) {
          setLoading(true);
          const detail = await getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId);
          if (!detail) {
            throw new Error(t("common.notFound"));
          }

          const nextBasic: BasicFormValues = {
            color: detail.color,
            description: detail.description,
            id: detail.id,
            name: detail.name,
            tags: detail.tags,
            ...toDefinitionDeclarationForm(detail.definitionDeclarations),
          };
          definitionBaseline.current = detail.definitionDeclarations
            ? structuredClone(detail.definitionDeclarations)
            : undefined;
          const nextMapping: RelationTypeMappingFormValues = {
            mappingMode: detail.mappingMode,
            mappingRules: buildRelationTypeMappingRulesFromDetail(detail),
          };
          const selectedObjectTypeIds = Array.from(
            new Set(
              [
                nextMapping.mappingRules.sourceObjectTypeId,
                nextMapping.mappingRules.targetObjectTypeId,
              ].filter(Boolean),
            ),
          );
          const selectedObjectTypes = await Promise.all(
            selectedObjectTypeIds
              .filter((id) => !nextObjectTypes.some((item) => item.id === id))
              .map((id) => getKnowledgeNetworkObjectType(networkId, id)),
          );
          nextObjectTypes = [
            ...nextObjectTypes,
            ...selectedObjectTypes.filter((item): item is KnowledgeNetworkObjectTypeRecord =>
              Boolean(item),
            ),
          ];
          setObjectTypes(nextObjectTypes);

          setBasicValue(nextBasic);
          setMappingValue(nextMapping);
          declarationBaseline.current = detail.declarations;
          setDeclarations(detail.declarations);
          setRelationProperties(detail.relationProperties ?? []);
          setPageTitle(detail.name);
          basicForm.setFieldsValue(nextBasic);
          setDoneStep(1);
        } else {
          setObjectTypes(nextObjectTypes);
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [basicForm, mode, networkId, relationTypeId, t]);

  const steps = useMemo(
    () => [
      { title: t("common.basicInfo") },
      { title: t("knowledgeNetwork.relationTypeMappingStep") },
    ],
    [t],
  );

  const validPropertyMappingCount = useMemo(() => {
    if (mappingValue.mappingMode === "resource") {
      return mappingValue.mappingRules.resourceMappings.filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.resourceSourcePropertyName &&
          item.resourceTargetPropertyName &&
          item.targetObjectPropertyName,
      ).length;
    }

    return mappingValue.mappingRules.propertyMappings.filter(
      (item) => item.sourcePropertyName && item.targetPropertyName,
    ).length;
  }, [mappingValue]);

  const goBack = () => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeUnsavedLeaveTitle"),
      content: t("knowledgeNetwork.objectTypeUnsavedLeaveDescription"),
      cancelText: t("common.cancel"),
      okText: t("knowledgeNetwork.objectTypeUnsavedLeaveOk"),
      onOk: () => {
        void navigate(returnPath);
      },
    });
  };

  const syncBasicValueFromForm = async (): Promise<BasicFormValues | null> => {
    try {
      const values = await basicForm.validateFields();
      const nextBasic: BasicFormValues = {
        ...values,
        color: basicValue?.color ?? DEFAULT_RESOURCE_COLOR,
      };
      setBasicValue(nextBasic);
      if (mode === "edit") {
        setPageTitle(nextBasic.name.trim() || t("knowledgeNetwork.relationTypeEditTitle"));
      }
      return nextBasic;
    } catch {
      return null;
    }
  };

  const handleStepChange = (nextStep: number) => {
    void (async () => {
      if (nextStep === currentStep) {
        return;
      }

      if (nextStep > doneStep) {
        if (nextStep === 1 && currentStep === 0) {
          const values = await syncBasicValueFromForm();
          if (!values) {
            return;
          }
          setDoneStep(1);
        } else {
          return;
        }
      }

      if (nextStep === 0 && basicValue) {
        basicForm.setFieldsValue(basicValue);
      }

      setCurrentStep(nextStep);
    })();
  };

  const handleBasicNext = async () => {
    const values = await syncBasicValueFromForm();
    if (!values) {
      return;
    }

    setDoneStep((prev) => Math.max(prev, 1));
    setCurrentStep(1);
  };

  const handleSubmit = async () => {
    let resolvedBasic = basicValue;
    if (currentStep === 0 || !resolvedBasic) {
      resolvedBasic = await syncBasicValueFromForm();
      if (!resolvedBasic) {
        return;
      }
    }

    const validationError = validateRelationTypeMappingValues(t, mappingValue);
    if (validationError) {
      void message.error(validationError);
      return;
    }

    // The reverse name is set on the mapping step; an alias may not repeat it either.
    if (definitionAliasProblem(resolvedBasic.aliases, ownNames(resolvedBasic.name))) {
      setCurrentStep(0);
      basicForm.setFieldsValue(resolvedBasic);
      setTimeout(() => void basicForm.validateFields(["aliases"]).catch(() => undefined));
      return;
    }

    const normalizedMapping = normalizeRelationTypeMappingValues(mappingValue);
    const payload: KnowledgeNetworkRelationTypeMutationPayload = {
      color: resolvedBasic.color,
      description: resolvedBasic.description,
      id: resolvedBasic.id,
      mappingMode: normalizedMapping.mappingMode,
      mappingRules: normalizedMapping.mappingRules,
      name: resolvedBasic.name,
      sourceObjectTypeId: normalizedMapping.mappingRules.sourceObjectTypeId,
      tags: resolvedBasic.tags,
      targetObjectTypeId: normalizedMapping.mappingRules.targetObjectTypeId,
      declarationEdit: { baseline: declarationBaseline.current, current: declarations },
      definitionDeclarationEdit: {
        baseline: definitionBaseline.current,
        current: fromDefinitionDeclarationForm(resolvedBasic),
      },
    };

    const changed = {
      definition:
        Object.keys(
          definitionDeclarationPatch(
            payload.definitionDeclarationEdit?.current,
            payload.definitionDeclarationEdit?.baseline,
          ),
        ).length > 0,
      relation:
        Object.keys(relationDeclarationPatch(declarations, declarationBaseline.current)).length > 0,
    };

    setSubmitting(true);
    setRefusal(null);
    try {
      if (mode === "edit" && relationTypeId) {
        await updateKnowledgeNetworkRelationType(networkId, relationTypeId, payload);
      } else {
        await createKnowledgeNetworkRelationType(networkId, payload);
      }

      void message.success(t("common.success"));
      void navigate(returnPath);
    } catch (error) {
      const declarationRefusal = readDeclarationRefusal(error);
      if (declarationRefusal) {
        // Shown with the declarations it concerns, not as a toast: the aliases and lifecycle are
        // in the basic info, the relation's own declarations on the mapping step.
        const onBasicInfo = isRelationBasicInfoRefusal(declarationRefusal, changed);
        setRefusal(declarationRefusal);
        setRefusalOnBasicInfo(onBasicInfo);
        if (onBasicInfo) {
          if (currentStep !== 0) {
            basicForm.setFieldsValue(resolvedBasic);
          }
          setCurrentStep(0);
        }
      } else {
        void message.error(extractRequestErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ownNames = (name: string | undefined) =>
    [name ?? "", declarations?.reverseName ?? ""].filter((item) => item.trim() !== "");

  const searchReplacements = useCallback(
    async (keyword: string) =>
      (
        await listKnowledgeNetworkRelationTypePage(networkId, {
          direction: "asc",
          limit: 20,
          namePattern: keyword || undefined,
          offset: 0,
          sort: "name",
        })
      ).entries.map((item) => ({
        declarations: item.definitionDeclarations,
        id: item.id,
        name: item.name,
      })),
    [networkId],
  );
  const resolveReplacement = useCallback(
    async (id: string) => {
      // The select says itself when the replacement is gone or hidden; no error toast.
      const item = await getKnowledgeNetworkRelationType(networkId, id, { skipErrorToast: true });
      return item
        ? { declarations: item.definitionDeclarations, id: item.id, name: item.name }
        : undefined;
    },
    [networkId],
  );

  const refusalBanner = refusal ? (
    <DefinitionRefusal
      networkId={networkId}
      refusal={refusal}
      saved={{
        id:
          mode === "edit"
            ? relationTypeId
            : (basicValue?.id ?? (basicForm.getFieldValue("id") as string | undefined)),
        kind: "relation_type",
      }}
    />
  ) : null;

  const objectTypeName = (id: string) => objectTypes.find((item) => item.id === id)?.name ?? id;

  const renderRelationInfoBar = () => {
    if (!basicValue || currentStep === 0) {
      return null;
    }

    const mappingModeLabel =
      mappingValue.mappingMode === "direct"
        ? t("knowledgeNetwork.relationTypeDirectMapping")
        : t("knowledgeNetwork.relationTypeResourceMapping");

    return (
      <div className={styles.objectInfoBar}>
        <div className={styles.objectInfoMain}>
          <span
            className={styles.objectInfoIcon}
            style={{ backgroundColor: basicValue.color ?? DEFAULT_RESOURCE_COLOR }}
          >
            <ShareAltOutlined />
          </span>
          <span className={styles.objectInfoName}>{basicValue.name}</span>
        </div>
        <div className={styles.objectInfoStats}>
          <span>{mappingModeLabel}</span>
          {mappingValue.mappingMode === "direct" ? (
            <span>
              {t("knowledgeNetwork.relationTypePropertyMappingCount", {
                count: validPropertyMappingCount,
              })}
            </span>
          ) : (
            <span>
              {t("knowledgeNetwork.relationTypeResourceMappingCount", {
                count: validPropertyMappingCount,
              })}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className={styles.basicForm}>
          {refusalOnBasicInfo ? refusalBanner : null}
          <Form
            colon={false}
            form={basicForm}
            initialValues={{
              aliases: [],
              description: "",
              lifecycleStatus: "active",
              name: "",
              tags: [],
            }}
            labelAlign="left"
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 20 }}
          >
            <Form.Item
              label={t("knowledgeNetwork.relationTypeName")}
              name="name"
              rules={[
                {
                  message: t("knowledgeNetwork.relationTypeNameRequired"),
                  required: true,
                },
                {
                  max: RESOURCE_NAME_MAX_LENGTH,
                  message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                },
              ]}
            >
              <Input count={RESOURCE_NAME_COUNT} showCount />
            </Form.Item>
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
              <Input disabled={mode === "edit"} maxLength={RESOURCE_ID_MAX_LENGTH} showCount />
            </Form.Item>
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
            <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
              <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} maxLength={1000} showCount />
            </Form.Item>
            <DefinitionDeclarationFields
              definitionId={mode === "edit" ? relationTypeId : undefined}
              otherOwnNames={ownNames(undefined)}
              ownNameFields={["name"]}
              resolveReplacement={resolveReplacement}
              searchReplacements={searchReplacements}
            />
          </Form>
        </div>
      );
    }

    return (
      <>
        {renderRelationInfoBar()}
        <div className={`${styles.sectionPanel} ${styles.mappingFormPanel}`}>
          <RelationDeclarationsSection
            ends={mappingValue.mappingRules}
            networkId={networkId}
            onChange={setDeclarations}
            refused={Boolean(refusal)}
            relationName={basicValue?.name ?? ""}
            relationTypeId={mode === "edit" ? relationTypeId : undefined}
            sourceName={objectTypeName(mappingValue.mappingRules.sourceObjectTypeId)}
            targetName={objectTypeName(mappingValue.mappingRules.targetObjectTypeId)}
            value={declarations}
          >
            {({ advanced, semantics }) => (
              <>
                <Suspense
                  fallback={
                    <div className={styles.loadingState}>
                      <Spin />
                    </div>
                  }
                >
                  <RelationTypeMappingEditor
                    confirmRelationPropertyChange={confirmRelationPropertyChange}
                    networkId={networkId}
                    objectTypes={objectTypes}
                    onChange={setMappingValue}
                    relationProperties={
                      mappingValue.mappingMode === "resource" ? relationProperties : undefined
                    }
                    semantics={semantics}
                    value={mappingValue}
                  />
                </Suspense>
                {refusalOnBasicInfo ? null : refusalBanner}
                {advanced}
              </>
            )}
          </RelationDeclarationsSection>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <ResourceFormStepsShell
        currentStep={0}
        doneStep={0}
        onBack={goBack}
        steps={steps}
        title={pageTitle}
      >
        <div className={styles.loadingState}>
          <Spin />
        </div>
      </ResourceFormStepsShell>
    );
  }

  const stepActions = loadError
    ? undefined
    : currentStep === 0
      ? {
          next: {
            loading: submitting,
            onClick: () => {
              void handleBasicNext();
            },
            text: t("common.next"),
          },
        }
      : {
          prev: {
            onClick: () => {
              handleStepChange(0);
            },
            text: t("common.previous"),
          },
          save: {
            loading: submitting,
            onClick: () => {
              void handleSubmit();
            },
            text: t("knowledgeNetwork.relationTypeSaveAndExit"),
          },
        };

  return (
    <ResourceFormStepsShell
      actions={stepActions}
      currentStep={currentStep}
      doneStep={doneStep}
      onBack={goBack}
      onStepChange={handleStepChange}
      steps={steps}
      title={pageTitle}
    >
      {loadError ? (
        <Alert className={styles.loadError} message={loadError} showIcon type="error" />
      ) : null}
      {loadError ? null : renderStepContent()}
    </ResourceFormStepsShell>
  );
}
