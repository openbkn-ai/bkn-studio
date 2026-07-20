/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Select, Spin, Alert } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { ResourceFormStepsShell } from "@/modules/knowledge-network/components/shared/ResourceFormStepsShell";
import {
  ObjectTypeDataAttributeEditor,
  type ObjectTypeDataAttributeEditorHandle,
} from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeEditor";
import {
  ObjectTypeLogicAttributeEditor,
  type ObjectTypeLogicAttributeEditorHandle,
} from "@/modules/knowledge-network/components/object-type/logic-attribute/ObjectTypeLogicAttributeEditor";
import {
  DEFAULT_RESOURCE_ICON,
  ResourceIconSelect,
} from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  DEFAULT_RESOURCE_COLOR,
  ResourceColorSelect,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  createKnowledgeNetworkObjectType,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkConceptGroups,
  updateKnowledgeNetworkObjectType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkObjectTypeMutationPayload,
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeFormScene.module.css";

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

type BasicFormValues = {
  color: string;
  conceptGroupIds: string[];
  description: string;
  icon?: string;
  id?: string;
  name: string;
  tags: string[];
};

type ObjectTypeFormSceneProps = {
  mode: "create" | "edit";
};

export function ObjectTypeFormScene({ mode }: ObjectTypeFormSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", objectTypeId = "" } = useParams<{
    networkId: string;
    objectTypeId?: string;
  }>();
  const [basicForm] = Form.useForm<BasicFormValues>();
  const dataAttributeRef = useRef<ObjectTypeDataAttributeEditorHandle>(null);
  const logicAttributeRef = useRef<ObjectTypeLogicAttributeEditorHandle>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conceptGroups, setConceptGroups] = useState<ConceptGroupRecord[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [doneStep, setDoneStep] = useState(0);
  const [basicValue, setBasicValue] = useState<BasicFormValues | null>(null);
  const [dataProperties, setDataProperties] = useState<ObjectTypeDataProperty[]>([]);
  const [dataSource, setDataSource] = useState<ObjectTypeDataSource | undefined>();
  const [logicProperties, setLogicProperties] = useState<ObjectTypeLogicProperty[]>([]);
  const [pageTitle, setPageTitle] = useState(
    mode === "edit"
      ? t("knowledgeNetwork.objectTypeEditTitle")
      : t("knowledgeNetwork.objectTypeCreateTitle"),
  );

  const listPath = `/knowledge-network/workspace/${networkId}/object-types`;

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
        const groups = await listKnowledgeNetworkConceptGroups(networkId);
        setConceptGroups(groups);

        if (mode === "edit" && objectTypeId) {
          setLoading(true);
          const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId);
          if (!detail) {
            throw new Error(t("common.notFound"));
          }
          const nextBasic: BasicFormValues = {
            color: detail.color,
            conceptGroupIds: detail.conceptGroupIds,
            description: detail.description,
            icon: detail.icon,
            id: detail.id,
            name: detail.name,
            tags: detail.tags,
          };
          setBasicValue(nextBasic);
          setPageTitle(detail.name);
          basicForm.setFieldsValue(nextBasic);
          setDataProperties(
            detail.dataProperties.length > 0
              ? detail.dataProperties.map((item) => ({ ...item }))
              : [],
          );
          setDataSource(detail.dataSource);
          setLogicProperties(detail.logicProperties.map((item) => ({ ...item })));
          setDoneStep(2);
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [basicForm, mode, networkId, objectTypeId, t]);

  const steps = useMemo(
    () => [
      { title: t("common.basicInfo") },
      { title: t("knowledgeNetwork.objectTypeDataProperty") },
      { title: t("knowledgeNetwork.objectTypeLogicProperty") },
    ],
    [t],
  );

  const logicPropertyNames = useMemo(
    () => logicProperties.map((item) => item.name),
    [logicProperties],
  );

  const dataAttributeBasicValue = useMemo(
    () =>
      basicValue
        ? {
            color: basicValue.color,
            icon: basicValue.icon,
            name: basicValue.name,
          }
        : null,
    [basicValue],
  );

  const handleDataAttributeChange = useCallback(
    ({
      dataProperties: nextProperties,
      dataSource: nextDataSource,
    }: {
      dataProperties: ObjectTypeDataProperty[];
      dataSource?: ObjectTypeDataSource;
    }) => {
      setDataProperties(nextProperties);
      setDataSource(nextDataSource);
    },
    [],
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
        setPageTitle(values.name.trim() || t("knowledgeNetwork.objectTypeEditTitle"));
      }
      return values;
    } catch {
      return null;
    }
  };

  const handleBasicNext = async () => {
    const values = await syncBasicValueFromForm();
    if (!values) {
      return;
    }

    setDoneStep((prev) => Math.max(prev, 1));
    setCurrentStep(1);
  };

  const handleDataPrev = async () => {
    try {
      const values = await dataAttributeRef.current?.getDataProperties();
      if (values) {
        setDataProperties(values.dataProperties);
        setDataSource(values.dataSource);
      }
      setCurrentStep(0);
    } catch {
      // keep current step
    }
  };

  const handleDataNext = async () => {
    try {
      const values = await dataAttributeRef.current?.validateFields();
      if (!values) {
        return;
      }
      setDataProperties(values.dataProperties);
      setDataSource(values.dataSource);
      setDoneStep((prev) => Math.max(prev, 2));
      setCurrentStep(2);
    } catch {
      // validation message handled in editor
    }
  };

  const handleLogicPrev = async () => {
    try {
      const values = await logicAttributeRef.current?.validateFields();
      if (values) {
        setLogicProperties(values.logicProperties);
      }
      setCurrentStep(1);
    } catch {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    let normalizedBasicValue = basicValue;
    let normalizedDataProperties = dataProperties;
    let normalizedDataSource = dataSource;
    let normalizedLogicProperties = logicProperties;

    if (currentStep === 0) {
      try {
        normalizedBasicValue = await basicForm.validateFields();
        setBasicValue(normalizedBasicValue);
      } catch {
        setCurrentStep(0);
        return;
      }
    } else {
      const storedBasicValue = basicForm.getFieldsValue(true) as Partial<BasicFormValues>;
      normalizedBasicValue = basicValue
        ? {
            color: storedBasicValue.color ?? basicValue.color,
            conceptGroupIds: storedBasicValue.conceptGroupIds ?? basicValue.conceptGroupIds,
            description: storedBasicValue.description ?? basicValue.description,
            icon: storedBasicValue.icon ?? basicValue.icon,
            id: storedBasicValue.id ?? basicValue.id,
            name: storedBasicValue.name ?? basicValue.name,
            tags: storedBasicValue.tags ?? basicValue.tags,
          }
        : null;
      if (normalizedBasicValue) {
        setBasicValue(normalizedBasicValue);
      }
    }

    if (!normalizedBasicValue?.name?.trim()) {
      setCurrentStep(0);
      return;
    }

    try {
      const dataValues = await dataAttributeRef.current?.validateFields();
      if (dataValues) {
        normalizedDataProperties = dataValues.dataProperties;
        normalizedDataSource = dataValues.dataSource;
        setDataProperties(dataValues.dataProperties);
        setDataSource(dataValues.dataSource);
      }
    } catch {
      setCurrentStep(1);
      return;
    }

    try {
      const logicValues = await logicAttributeRef.current?.validateFields();
      if (logicValues) {
        normalizedLogicProperties = logicValues.logicProperties;
        setLogicProperties(logicValues.logicProperties);
      }
    } catch {
      return;
    }

    const payload: KnowledgeNetworkObjectTypeMutationPayload = {
      color: normalizedBasicValue.color,
      conceptGroupIds: normalizedBasicValue.conceptGroupIds,
      dataProperties: normalizedDataProperties,
      dataSource: normalizedDataSource,
      description: normalizedBasicValue.description,
      icon: normalizedBasicValue.icon,
      id: normalizedBasicValue.id,
      logicProperties: normalizedLogicProperties,
      name: normalizedBasicValue.name,
      tags: normalizedBasicValue.tags,
    };

    setSubmitting(true);
    try {
      if (mode === "edit" && objectTypeId) {
        await updateKnowledgeNetworkObjectType(networkId, objectTypeId, payload);
      } else {
        await createKnowledgeNetworkObjectType(networkId, payload);
      }

      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStepChange = (nextStep: number) => {
    if (nextStep === currentStep || nextStep > doneStep) {
      return;
    }

    void (async () => {
      if (nextStep === 1 && currentStep === 2) {
        const values = await logicAttributeRef.current?.validateFields();
        if (values) {
          setLogicProperties(values.logicProperties);
        }
      }

      if (nextStep === 0 && currentStep >= 1) {
        const values = await dataAttributeRef.current?.getDataProperties();
        if (values) {
          setDataProperties(values.dataProperties);
          setDataSource(values.dataSource);
        }
      }

      if (nextStep === 1 && currentStep === 0) {
        const values = await dataAttributeRef.current?.getDataProperties();
        if (values) {
          setDataProperties(values.dataProperties);
          setDataSource(values.dataSource);
        }
      }

      setCurrentStep(nextStep);
    })();
  };

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className={styles.basicForm}>
          <Form
            colon={false}
            form={basicForm}
            initialValues={{
              color: DEFAULT_RESOURCE_COLOR,
              conceptGroupIds: [],
              description: "",
              icon: DEFAULT_RESOURCE_ICON,
              tags: [],
            }}
            labelAlign="left"
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 20 }}
          >
            <Form.Item
              label={t("knowledgeNetwork.objectTypeName")}
              name="name"
              rules={[
                { message: t("knowledgeNetwork.objectTypeNameRequired"), required: true },
                { max: 40, message: t("knowledgeNetwork.objectTypeNameMaxLength") },
              ]}
            >
              <Input maxLength={40} showCount />
            </Form.Item>
            <Form.Item
              label="ID"
              name="id"
              rules={[
                { max: 40, message: t("knowledgeNetwork.objectTypeNameMaxLength") },
                {
                  message: t("knowledgeNetwork.objectTypeIdPattern"),
                  pattern: IDENTIFIER_PATTERN,
                },
              ]}
            >
              <Input disabled={mode === "edit"} />
            </Form.Item>
            <Form.Item label={t("knowledgeNetwork.iconField")} name="icon">
              <ResourceIconSelect inModal={false} />
            </Form.Item>
            <Form.Item label={t("knowledgeNetwork.color")} name="color">
              <ResourceColorSelect inModal={false} />
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
            <Form.Item
              label={t("knowledgeNetwork.objectTypeConceptGroups")}
              name="conceptGroupIds"
            >
              <Select
                allowClear
                mode="multiple"
                optionFilterProp="label"
                options={conceptGroups.map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
                placeholder={t("knowledgeNetwork.objectTypeConceptGroupsPlaceholder")}
              />
            </Form.Item>
            <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
              <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} maxLength={1000} showCount />
            </Form.Item>
          </Form>
        </div>
      );
    }

    if (currentStep === 1) {
      if (!dataAttributeBasicValue) {
        return null;
      }

      return (
        <div className={styles.dataAttributePanel}>
          <ObjectTypeDataAttributeEditor
            basicValue={dataAttributeBasicValue}
            dataProperties={dataProperties}
            dataSource={dataSource}
            logicPropertyNames={logicPropertyNames}
            networkId={networkId}
            onChange={handleDataAttributeChange}
            ref={dataAttributeRef}
          />
        </div>
      );
    }

    if (!basicValue) {
      return null;
    }

    return (
      <div className={styles.logicAttributePanel}>
        <ObjectTypeLogicAttributeEditor
          basicValue={{
            color: basicValue.color,
            icon: basicValue.icon,
            name: basicValue.name,
          }}
          dataProperties={dataProperties}
          logicProperties={logicProperties}
          onChange={setLogicProperties}
          ref={logicAttributeRef}
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
      : currentStep === 1
        ? {
            prev: {
              onClick: () => {
                void handleDataPrev();
              },
              text: t("common.previous"),
            },
            next: {
              onClick: () => {
                void handleDataNext();
              },
              text: t("common.next"),
            },
          }
        : {
            prev: {
              onClick: () => {
                void handleLogicPrev();
              },
              text: t("common.previous"),
            },
            save: {
              loading: submitting,
              onClick: () => {
                void handleSubmit();
              },
              text: t("knowledgeNetwork.objectTypeSaveAndExit"),
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
