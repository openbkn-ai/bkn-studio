/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Col, Form, Input, Row, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  ActionTypeExecutionEditor,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import { normalizeActionTypeCondition } from "@/modules/knowledge-network/utils/action-type-execution";
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
import { buildActionTypeKindSelectOptions } from "@/modules/knowledge-network/constants/action-type-kinds";
import {
  createKnowledgeNetworkActionType,
  getKnowledgeNetworkActionTypeDetail,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
  updateKnowledgeNetworkActionType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeCondition,
  ActionTypeExecutionConfig,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeFormScene.module.css";

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

type BasicFormValues = {
  actionKind: KnowledgeNetworkActionTypeKind;
  affectComment?: string;
  affectObjectTypeId?: string;
  color: string;
  condition?: ActionTypeCondition | null;
  description: string;
  id?: string;
  name: string;
  objectTypeId: string;
  tags: string[];
};

type ActionTypeFormSceneProps = {
  mode: "create" | "edit";
};

export function ActionTypeFormScene({ mode }: ActionTypeFormSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", actionTypeId = "" } = useParams<{
    actionTypeId?: string;
    networkId: string;
  }>();
  const [basicForm] = Form.useForm<BasicFormValues>();
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [conditionPropertyOptions, setConditionPropertyOptions] = useState<
    RelationTypePropertyOption[]
  >([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [doneStep, setDoneStep] = useState(0);
  const [basicValue, setBasicValue] = useState<BasicFormValues | null>(null);
  const [executionValue, setExecutionValue] = useState<ActionTypeExecutionConfig>(
    createDefaultActionTypeExecutionConfig(),
  );
  const [pageTitle, setPageTitle] = useState(
    mode === "edit"
      ? t("knowledgeNetwork.actionTypeEditTitle")
      : t("knowledgeNetwork.actionTypeCreateTitle"),
  );

  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const watchedObjectTypeId = Form.useWatch("objectTypeId", basicForm);
  const watchedCondition = Form.useWatch("condition", basicForm);
  const conditionObjectTypeId = watchedCondition?.objectTypeId || watchedObjectTypeId;

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
    const loadConditionProperties = async () => {
      if (!networkId || !conditionObjectTypeId) {
        setConditionPropertyOptions([]);
        return;
      }

      const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, conditionObjectTypeId);
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

    void loadConditionProperties();
  }, [conditionObjectTypeId, networkId]);

  useEffect(() => {
    const condition = basicForm.getFieldValue("condition") as ActionTypeCondition | null | undefined;
    if (
      condition?.objectTypeId &&
      watchedObjectTypeId &&
      condition.objectTypeId !== watchedObjectTypeId
    ) {
      basicForm.setFieldValue("condition", null);
    }
  }, [basicForm, watchedObjectTypeId]);

  useEffect(() => {
    const loadData = async () => {
      if (!networkId) {
        return;
      }

      try {
        const nextObjectTypes = await listKnowledgeNetworkObjectTypes(networkId);
        setObjectTypes(nextObjectTypes);

        if (mode === "edit" && actionTypeId) {
          setLoading(true);
          const detail = await getKnowledgeNetworkActionTypeDetail(networkId, actionTypeId);
          if (!detail) {
            throw new Error(t("common.notFound"));
          }

          const nextBasic: BasicFormValues = {
            actionKind: detail.actionKind,
            affectComment: detail.affect?.comment ?? "",
            affectObjectTypeId: detail.affect?.objectTypeId,
            color: detail.color,
            condition: detail.condition ?? null,
            description: detail.description,
            id: detail.id,
            name: detail.name,
            objectTypeId: detail.objectTypeId,
            tags: detail.tags,
          };

          setBasicValue(nextBasic);
          setExecutionValue(detail.executionConfig);
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
  }, [actionTypeId, basicForm, mode, networkId, t]);

  const steps = useMemo(
    () => [
      { title: t("knowledgeNetwork.actionTypeConceptDefinitionStep") },
      { title: t("knowledgeNetwork.actionTypeResourceMappingStep") },
    ],
    [t],
  );

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
      setBasicValue(values);
      if (mode === "edit") {
        setPageTitle(values.name.trim() || t("knowledgeNetwork.actionTypeEditTitle"));
      }
      return values;
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

    const validationError = validateActionTypeExecutionConfig(t, executionValue);
    if (validationError) {
      void message.error(validationError);
      return;
    }

    const normalizedExecution = normalizeActionTypeExecutionConfig(executionValue);
    const affect =
      resolvedBasic.affectObjectTypeId || resolvedBasic.affectComment?.trim()
        ? {
            comment: resolvedBasic.affectComment?.trim() || undefined,
            objectTypeId: resolvedBasic.affectObjectTypeId,
          }
        : undefined;
    const payload: KnowledgeNetworkActionTypeMutationPayload = {
      actionKind: resolvedBasic.actionKind,
      affect,
      color: resolvedBasic.color,
      condition: normalizeActionTypeCondition(resolvedBasic.condition, resolvedBasic.objectTypeId),
      description: resolvedBasic.description,
      executionConfig: normalizedExecution,
      id: resolvedBasic.id,
      name: resolvedBasic.name,
      objectTypeId: resolvedBasic.objectTypeId,
      tags: resolvedBasic.tags,
    };

    setSubmitting(true);
    try {
      if (mode === "edit" && actionTypeId) {
        await updateKnowledgeNetworkActionType(networkId, actionTypeId, payload);
      } else {
        await createKnowledgeNetworkActionType(networkId, payload);
      }

      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className={styles.basicForm}>
          <Form
            colon={false}
            form={basicForm}
            initialValues={{
              actionKind: "create",
              color: DEFAULT_RESOURCE_COLOR,
              description: "",
              name: "",
              tags: [],
            }}
            layout="vertical"
            requiredMark
          >
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
                      max: 40,
                      message: t("knowledgeNetwork.objectTypeNameMaxLength"),
                    },
                  ]}
                >
                  <Input maxLength={40} placeholder={t("knowledgeNetwork.pleaseInput")} />
                </Form.Item>
              </Col>
              <Col span={12}>
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
                  <Input disabled={mode === "edit"} placeholder={t("knowledgeNetwork.pleaseInput")} />
                </Form.Item>
              </Col>
            </Row>
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
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label={t("knowledgeNetwork.actionTypeKind")}
                  name="actionKind"
                  rules={[
                    {
                      message: t("knowledgeNetwork.actionTypeKindRequired"),
                      required: true,
                    },
                  ]}
                >
                  <Select
                    options={buildActionTypeKindSelectOptions(t)}
                    placeholder={t("knowledgeNetwork.pleaseSelect")}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={t("knowledgeNetwork.actionTypeObject")}
                  name="objectTypeId"
                  rules={[
                    {
                      message: t("knowledgeNetwork.actionTypeObjectRequired"),
                      required: true,
                    },
                  ]}
                >
                  <RelationTypeObjectTypeSelect
                    objectTypes={objectTypes}
                    placeholder={t("knowledgeNetwork.actionTypeObjectSelectPlaceholder")}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label={t("knowledgeNetwork.actionTypeTriggerCondition")} name="condition">
              <ActionTypeConditionEditor
                boundObjectTypeId={watchedObjectTypeId}
                objectTypes={objectTypes}
                propertyOptions={conditionPropertyOptions}
              />
            </Form.Item>
            <Form.Item
              label={t("knowledgeNetwork.actionTypeAffectedObject")}
              name="affectObjectTypeId"
            >
              <RelationTypeObjectTypeSelect
                allowClear
                objectTypes={objectTypes}
                placeholder={t("knowledgeNetwork.actionTypeAffectedObjectPlaceholder")}
              />
            </Form.Item>
            <Form.Item
              label={t("knowledgeNetwork.actionTypeAffectDescription")}
              name="affectComment"
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                maxLength={255}
                placeholder={t("knowledgeNetwork.actionTypeAffectDescriptionPlaceholder")}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      );
    }

    return (
      <div className={styles.executionForm}>
        <ActionTypeExecutionEditor
          networkId={networkId}
          objectTypeId={
            basicValue?.objectTypeId ??
            (basicForm.getFieldValue("objectTypeId") as string | undefined) ??
            ""
          }
          onChange={setExecutionValue}
          value={executionValue}
        />
      </div>
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
            onClick: () => handleStepChange(0),
            text: t("common.previous"),
          },
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
