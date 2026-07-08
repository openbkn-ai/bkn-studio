/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Result, Spin, Steps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectFormSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ConnectorTypePicker } from "@/modules/data-connect/components/ConnectorTypePicker";
import { DataConnectConfigForm } from "@/modules/data-connect/components/DataConnectConfigForm";
import { DataConnectPageHeader } from "@/modules/data-connect/components/DataConnectPageHeader";
import { getConnectorConfigDefaults } from "@/modules/data-connect/lib/connector-template";
import {
  createDataConnectRecord,
  getDataConnectRecord,
  listDataConnectConnectorTypes,
  testDataConnectRecord,
  updateDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectMutationInput,
  DataConnectMutationPayload,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";

import styles from "./DataConnectFormScene.module.css";

export function DataConnectFormScene({
  mode,
  onBack,
  onSubmitSuccess,
  recordId,
}: DataConnectFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<DataConnectMutationInput>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [record, setRecord] = useState<DataConnectRecord | null>(null);
  const [connectorTypes, setConnectorTypes] = useState<DataConnectConnectorType[]>([]);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>();
  const [currentStep, setCurrentStep] = useState(mode === "edit" ? 1 : 0);
  const [draftRecordId, setDraftRecordId] = useState<string>();

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const types = await listDataConnectConnectorTypes();
        setConnectorTypes(types);

        if (mode === "edit" && recordId) {
          const currentRecord = await getDataConnectRecord(recordId);
          setRecord(currentRecord);

          if (currentRecord) {
            setSelectedConnectorType(currentRecord.connectorType);
            form.setFieldsValue({
              connectorConfig: sanitizeConnectorConfig(currentRecord.connectorConfig),
              connectorType: currentRecord.connectorType,
              description: currentRecord.description,
              enabled: currentRecord.enabled,
              name: currentRecord.name,
              tags: currentRecord.tags,
            });
          }
        } else {
          form.setFieldsValue({
            connectorConfig: {},
            description: "",
            enabled: true,
            name: "",
            tags: [],
          });
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, mode, recordId]);

  const selectedConnector = useMemo(
    () => connectorTypes.find((item) => item.type === selectedConnectorType),
    [connectorTypes, selectedConnectorType],
  );

  // 对齐后端 catalog op 词表（catalog.json）：新建=catalog:create，编辑=catalog:modify。
  // 旧的 data-connect:create/edit 是前端自造 key，/me/permissions 不返回 → 永远 403。
  const permission = mode === "create" ? "catalog:create" : "catalog:modify";
  const pageTitle =
    mode === "create" ? t("dataConnect.createTitle") : t("dataConnect.editTitle");
  const pageDescription =
    mode === "create"
      ? t("dataConnect.createDescription")
      : t("dataConnect.editDescription");

  const stepItems = [
    { title: t("dataConnect.connectorTypeStep") },
    { title: t("dataConnect.configStep") },
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/data-connect");
  };

  const handleNext = () => {
    if (!selectedConnectorType) {
      void message.warning(t("dataConnect.selectConnectorTypeRequired"));
      return;
    }

    const connector = connectorTypes.find((item) => item.type === selectedConnectorType);
    const defaults = getConnectorConfigDefaults(connector);
    const currentConfig = (form.getFieldValue("connectorConfig") ?? {}) as Record<string, unknown>;
    const mergedConfig: DataConnectMutationInput["connectorConfig"] = {
      ...defaults,
      ...sanitizeConnectorConfig(currentConfig),
    };

    form.setFieldsValue({
      connectorConfig: mergedConfig,
      connectorType: selectedConnectorType,
    });
    setCurrentStep(1);
  };

  const buildMutationPayload = async () => {
    const values = await form.validateFields();

    return {
      connectorConfig: normalizeConnectorConfig(values.connectorConfig ?? {}),
      connectorType: selectedConnectorType ?? values.connectorType,
      description: values.description ?? "",
      enabled: record?.enabled ?? values.enabled ?? true,
      name: values.name.trim(),
      tags: values.tags ?? [],
    } satisfies DataConnectMutationPayload;
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = await buildMutationPayload();
      const persistedRecordId = mode === "edit" ? recordId : draftRecordId;

      if (mode === "create" && persistedRecordId) {
        await updateDataConnectRecord(persistedRecordId, payload);
      } else if (mode === "create") {
        await createDataConnectRecord(payload);
      } else if (recordId) {
        await updateDataConnectRecord(recordId, payload);
      }

      message.success(t("common.success"));

      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }

      void navigate("/data-connect");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "errorFields" in error
      ) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const payload = await buildMutationPayload();
      let targetRecordId = recordId ?? draftRecordId;

      if (!targetRecordId) {
        const createdRecordId = await createDataConnectRecord(payload);
        if (!createdRecordId) {
          throw new Error(t("common.notFound"));
        }
        setDraftRecordId(createdRecordId);
        targetRecordId = createdRecordId;
      } else {
        await updateDataConnectRecord(targetRecordId, payload);
      }

      await testDataConnectRecord(targetRecordId);
      message.success(t("dataConnect.testConnectionSuccess"));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "errorFields" in error
      ) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <PermissionGate
      fallback={<Result status="403" subTitle={t("common.noPermission")} title="403" />}
      permissions={permission}
    >
      <section className={styles.contentSurface}>
        <DataConnectPageHeader
          description={pageDescription}
          layout={mode === "create" ? "default" : "inline"}
          onBack={handleBack}
          title={pageTitle}
          trailing={
            mode === "create" ? (
              <div className={styles.headerSteps}>
                <Steps current={currentStep} items={stepItems} />
              </div>
            ) : undefined
          }
        />
        <div className={styles.formShell}>
          {loading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : loadError ? (
            <Alert
              action={
                <AppButton
                  onClick={() => {
                    window.location.reload();
                  }}
                  type="link"
                >
                  {t("common.retry")}
                </AppButton>
              }
              message={loadError}
              showIcon
              type="error"
            />
          ) : mode === "edit" && !record ? (
            <Alert message={t("common.notFound")} showIcon type="warning" />
          ) : (
            <div className={styles.stepPanel}>
              <Form
                className={
                  currentStep === 0 && mode === "create"
                    ? undefined
                    : styles.configFormHorizontal
                }
                colon={false}
                form={form}
                labelAlign="right"
                labelCol={
                  currentStep === 0 && mode === "create"
                    ? undefined
                    : { flex: "0 0 96px" }
                }
                layout={
                  currentStep === 0 && mode === "create" ? "vertical" : "horizontal"
                }
                wrapperCol={
                  currentStep === 0 && mode === "create"
                    ? undefined
                    : { flex: "1 1 0" }
                }
              >
                {currentStep === 0 && mode === "create" ? (
                  <ConnectorTypePicker
                    onChange={(value) => {
                      const connector = connectorTypes.find((item) => item.type === value);
                      setSelectedConnectorType(value);
                      form.setFieldsValue({
                        connectorConfig: getConnectorConfigDefaults(connector),
                        connectorType: value,
                      });
                    }}
                    options={connectorTypes}
                    value={selectedConnectorType}
                  />
                ) : (
                  <DataConnectConfigForm
                    isEdit={mode === "edit"}
                    selectedConnectorType={selectedConnector}
                  />
                )}
              </Form>
            </div>
          )}
        </div>
        <div className={styles.footerBar}>
          <div className={styles.actionsRight}>
            {currentStep === 1 && mode === "create" ? (
              <AppButton
                onClick={() => {
                  setCurrentStep(0);
                }}
              >
                {t("common.previous")}
              </AppButton>
            ) : null}
            {((currentStep === 1 && mode === "create") || (mode === "edit" && recordId)) ? (
              <AppButton
                loading={testingConnection}
                onClick={() => {
                  void handleTestConnection();
                }}
              >
                {t("common.testConnection")}
              </AppButton>
            ) : null}
            <AppButton
              loading={submitting}
              onClick={() => {
                void (currentStep === 0 && mode === "create" ? handleNext() : handleSubmit());
              }}
              type="primary"
            >
              {currentStep === 0 && mode === "create"
                ? t("common.next")
                : currentStep === 1 && mode === "create"
                  ? t("common.confirm")
                  : t("common.save")}
            </AppButton>
          </div>
        </div>
      </section>
    </PermissionGate>
  );
}

function sanitizeConnectorConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [key, value];
      }

      if (Array.isArray(value)) {
        return [key, value.map((item) => String(item))];
      }

      return [key, JSON.stringify(value)];
    }),
  ) as Record<string, boolean | number | string | string[]>;
}

function normalizeConnectorConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => {
        if (typeof value === "string") {
          const trimmed = value.trim();

          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              return [key, JSON.parse(trimmed) as unknown];
            } catch {
              return [key, value];
            }
          }
        }

        return [key, value];
      }),
  ) as Record<string, unknown>;
}
