import { ShareAltOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Spin } from "antd";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  validateRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
} from "@/modules/knowledge-network/components/relation-type/mapping-utils";
import { DEFAULT_RESOURCE_COLOR } from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import { ResourceFormStepsShell } from "@/modules/knowledge-network/components/shared/ResourceFormStepsShell";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  createKnowledgeNetworkRelationType,
  getKnowledgeNetworkRelationTypeDetail,
  listKnowledgeNetworkObjectTypes,
  updateKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeMutationPayload,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeFormScene.module.css";

const RelationTypeMappingEditor = lazy(async () => {
  const module = await import(
    "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor"
  );
  return { default: module.RelationTypeMappingEditor };
});

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

type BasicFormValues = {
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
  const [pageTitle, setPageTitle] = useState(
    mode === "edit"
      ? t("knowledgeNetwork.relationTypeEditTitle")
      : t("knowledgeNetwork.relationTypeCreateTitle"),
  );

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;

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
        const nextObjectTypes = await listKnowledgeNetworkObjectTypes(networkId);
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
          };
          const nextMapping: RelationTypeMappingFormValues = {
            mappingMode: detail.mappingMode,
            mappingRules: buildRelationTypeMappingRulesFromDetail(detail),
          };

          setBasicValue(nextBasic);
          setMappingValue(nextMapping);
          setPageTitle(detail.name);
          basicForm.setFieldsValue(nextBasic);
          setDoneStep(1);
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
    if (mappingValue.mappingMode === "data-view") {
      return mappingValue.mappingRules.dataViewMappings.filter(
        (item) =>
          item.sourceObjectPropertyName &&
          item.dataViewSourcePropertyName &&
          item.dataViewTargetPropertyName &&
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
        void navigate(listPath);
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
    };

    setSubmitting(true);
    try {
      if (mode === "edit" && relationTypeId) {
        await updateKnowledgeNetworkRelationType(networkId, relationTypeId, payload);
      } else {
        await createKnowledgeNetworkRelationType(networkId, payload);
      }

      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderRelationInfoBar = () => {
    if (!basicValue || currentStep === 0) {
      return null;
    }

    const mappingModeLabel =
      mappingValue.mappingMode === "direct"
        ? t("knowledgeNetwork.relationTypeDirectMapping")
        : t("knowledgeNetwork.relationTypeDataViewMapping");

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
              {t("knowledgeNetwork.relationTypeDataViewMappingCount", {
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
          <Form
            colon={false}
            form={basicForm}
            initialValues={{
              description: "",
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
                  max: 40,
                  message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                },
              ]}
            >
              <Input maxLength={40} showCount />
            </Form.Item>
            <Form.Item
              label="ID"
              name="id"
              rules={[
                {
                  max: 40,
                  message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                },
                {
                  message: t("knowledgeNetwork.objectTypeIdPattern"),
                  pattern: IDENTIFIER_PATTERN,
                },
              ]}
            >
              <Input disabled={mode === "edit"} />
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
          </Form>
        </div>
      );
    }

    return (
      <>
        {renderRelationInfoBar()}
        <div className={`${styles.sectionPanel} ${styles.mappingFormPanel}`}>
          <Suspense
            fallback={
              <div className={styles.loadingState}>
                <Spin />
              </div>
            }
          >
            <RelationTypeMappingEditor
              networkId={networkId}
              objectTypes={objectTypes}
              onChange={setMappingValue}
              value={mappingValue}
            />
          </Suspense>
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
