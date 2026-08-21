/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Result, Spin, Steps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectFormSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import {
  extractRequestErrorMessage,
  isRequestConflict,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ConnectorTypePicker } from "@/modules/data-connect/components/ConnectorTypePicker";
import { DataConnectConfigForm } from "@/modules/data-connect/components/DataConnectConfigForm";
import { DataConnectPageHeader } from "@/modules/data-connect/components/DataConnectPageHeader";
import {
  getConnectorConfigDefaults,
  isConnectorFieldVisible,
  mergeKnownConnectorTypes,
} from "@/modules/data-connect/lib/connector-template";
import {
  createDataConnectRecord,
  getDataConnectConnectorType,
  getDataConnectRecord,
  isDataConnectConnectionTestFailure,
  listDataConnectConnectorTypes,
  testDataConnectConfig,
  updateDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  ConnectorFieldConfig,
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
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<DataConnectMutationInput>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingConnectorDefinition, setLoadingConnectorDefinition] = useState(false);
  const [record, setRecord] = useState<DataConnectRecord | null>(null);
  const [connectorTypes, setConnectorTypes] = useState<DataConnectConnectorType[]>([]);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>();
  const [currentStep, setCurrentStep] = useState(mode === "edit" ? 1 : 0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const selectedConnectorTypeRef = useRef<string | undefined>(undefined);
  const recordIdentityKey = mode === "edit" ? (recordId ?? "") : "";
  const recordIdentityRef = useRef({ generation: 0, key: recordIdentityKey });
  if (recordIdentityRef.current.key !== recordIdentityKey) {
    recordIdentityRef.current = {
      generation: recordIdentityRef.current.generation + 1,
      key: recordIdentityKey,
    };
  }

  const selectConnectorType = (connectorType: string) => {
    selectedConnectorTypeRef.current = connectorType;
    setSelectedConnectorType(connectorType);
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const types = await listDataConnectConnectorTypes();
        const mergedTypes = mergeKnownConnectorTypes(types);
        if (!active) {
          return;
        }
        setConnectorTypes(mergedTypes);

        if (mode === "edit" && recordId) {
          const currentRecord = await getDataConnectRecord(recordId);
          if (!active) {
            return;
          }
          setRecord(currentRecord);

          if (currentRecord) {
            const connector = await getDataConnectConnectorType(currentRecord.connectorType);
            if (!active) {
              return;
            }
            setConnectorTypes((currentTypes) => currentTypes.map((item) => (
              item.type === connector.type ? connector : item
            )));
            selectConnectorType(currentRecord.connectorType);
            form.setFieldsValue({
              connectorConfig: sanitizeConnectorConfig(
                currentRecord.connectorConfig,
                connector?.fieldConfig,
              ),
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
            healthCheckSchedule: {
              mode: "inherit",
            },
            name: "",
            tags: [],
          });
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        if (active) {
          setLoadError(extractRequestErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [form, mode, recordId]);

  const refreshRecordAfterConflict = async (
    error: unknown,
    submittedRecordId: string | undefined,
    submittedRecordIdentity: typeof recordIdentityRef.current,
  ) => {
    if (mode !== "edit" || !submittedRecordId || !isRequestConflict(error)) {
      return;
    }

    try {
      const latestRecord = await getDataConnectRecord(submittedRecordId);
      if (recordIdentityRef.current !== submittedRecordIdentity) {
        return;
      }

      setRecord(latestRecord);
      if (latestRecord) {
        const connector = connectorTypes.find(
          (item) => item.type === latestRecord.connectorType,
        );
        selectConnectorType(latestRecord.connectorType);
        form.setFieldsValue({
          connectorConfig: sanitizeConnectorConfig(
            latestRecord.connectorConfig,
            connector?.fieldConfig,
          ),
          connectorType: latestRecord.connectorType,
          description: latestRecord.description,
          enabled: latestRecord.enabled,
          name: latestRecord.name,
          tags: latestRecord.tags,
        });
        setHasUnsavedChanges(false);
      }
    } catch (refreshError) {
      if (recordIdentityRef.current === submittedRecordIdentity) {
        void message.error(extractRequestErrorMessage(refreshError));
      }
    }
  };

  const selectedConnector = useMemo(
    () => connectorTypes.find((item) => item.type === selectedConnectorType),
    [connectorTypes, selectedConnectorType],
  );

  // Align with backend catalog operation vocabulary (catalog.json): create=catalog:create and edit=catalog:modify.
  // Legacy data-connect:create/edit keys were invented by the frontend and absent from /me/permissions, causing permanent 403 responses.
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

  const leavePage = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/data-connect");
  };

  const handleBack = () => {
    if (!hasUnsavedChanges) {
      leavePage();
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("dataConnect.discardChangesDescription"),
      okButtonProps: { danger: true },
      okText: t("dataConnect.discardChangesConfirm"),
      onOk: leavePage,
      title: t("dataConnect.discardChangesTitle"),
    });
  };

  const handleNext = async () => {
    if (!selectedConnectorType) {
      void message.warning(t("dataConnect.selectConnectorTypeRequired"));
      return;
    }

    try {
      setLoadingConnectorDefinition(true);
      const connector = await getDataConnectConnectorType(selectedConnectorType);
      if (selectedConnectorTypeRef.current !== selectedConnectorType) {
        return;
      }
      setConnectorTypes((currentTypes) => currentTypes.map((item) => (
        item.type === connector.type ? connector : item
      )));
      const defaults = getConnectorConfigDefaults(connector);
      const currentConfig = (form.getFieldValue("connectorConfig") ?? {}) as Record<string, unknown>;
      const mergedConfig: DataConnectMutationInput["connectorConfig"] = {
        ...defaults,
        ...sanitizeConnectorConfig(currentConfig, connector.fieldConfig),
      };

      form.setFieldsValue({
        connectorConfig: mergedConfig,
        connectorType: selectedConnectorType,
      });
      setCurrentStep(1);
    } catch (error) {
      if (selectedConnectorTypeRef.current !== selectedConnectorType) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoadingConnectorDefinition(false);
    }
  };

  const buildMutationPayload = async () => {
    const values = await form.validateFields();

    return {
      connectorConfig: normalizeConnectorConfig(
        values.connectorConfig ?? {},
        selectedConnector?.fieldConfig,
        selectedConnector?.type,
      ),
      connectorType: selectedConnectorType ?? values.connectorType,
      description: values.description ?? "",
      enabled: record?.enabled ?? values.enabled ?? true,
      healthCheckSchedule:
        mode === "create"
          ? {
              cronExpr:
                values.healthCheckSchedule?.mode === "enabled"
                  ? values.healthCheckSchedule.cronExpr?.trim()
                  : undefined,
              mode: values.healthCheckSchedule?.mode ?? "inherit",
            }
          : undefined,
      name: values.name.trim(),
      tags: values.tags ?? [],
    } satisfies DataConnectMutationPayload;
  };

  const buildConnectionTestPayload = async () => {
    const values = (await form.validateFields([["connectorConfig"]], {
      recursive: true,
    })) as Pick<DataConnectMutationInput, "connectorConfig">;
    const currentValues = form.getFieldsValue([
      "connectorType",
    ]) as Pick<DataConnectMutationInput, "connectorType">;

    return {
      connectorConfig: normalizeConnectorConfig(
        values.connectorConfig ?? {},
        selectedConnector?.fieldConfig,
        selectedConnector?.type,
      ),
      connectorType:
        selectedConnectorType ?? currentValues.connectorType,
    };
  };

  const handleSubmit = async () => {
    let payload: DataConnectMutationPayload | null = null;
    const submittedRecordId = recordId;
    const submittedRecordIdentity = recordIdentityRef.current;

    try {
      setSubmitting(true);
      payload = await buildMutationPayload();

      if (mode === "create") {
        await createDataConnectRecord(payload, { skipErrorToast: true });
      } else if (recordId) {
        if (!record) {
          throw new Error(t("common.requestFailed"));
        }
        await updateDataConnectRecord(recordId, {
          ...payload,
          expectedUpdateTime: record.expectedUpdateTime,
        }, {
          skipErrorToast: true,
        });
      }

      if (recordIdentityRef.current !== submittedRecordIdentity) {
        return;
      }
      finishSubmit();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "errorFields" in error
      ) {
        return;
      }

      if (recordIdentityRef.current !== submittedRecordIdentity) {
        return;
      }

      if (payload && isDataConnectConnectionTestFailure(error)) {
        const retryPayload = payload;

        void modal.confirm({
          cancelText: t("common.cancel"),
          content: t("dataConnect.allowUnhealthy.description"),
          okButtonProps: { danger: true },
          okText: t("dataConnect.allowUnhealthy.confirm"),
          onOk: async () => {
            if (recordIdentityRef.current !== submittedRecordIdentity) {
              return;
            }

            try {
              setSubmitting(true);

              if (mode === "create") {
                await createDataConnectRecord(retryPayload, {
                  allowUnhealthy: true,
                  skipErrorToast: true,
                });
              } else if (recordId) {
                if (!record) {
                  throw new Error(t("common.requestFailed"));
                }
                await updateDataConnectRecord(recordId, {
                  ...retryPayload,
                  expectedUpdateTime: record.expectedUpdateTime,
                }, {
                  allowUnhealthy: true,
                  skipErrorToast: true,
                });
              }

              if (recordIdentityRef.current === submittedRecordIdentity) {
                finishSubmit();
              }
            } catch (retryError) {
              if (recordIdentityRef.current !== submittedRecordIdentity) {
                return;
              }
              void message.error(extractRequestErrorMessage(retryError));
              await refreshRecordAfterConflict(
                retryError,
                submittedRecordId,
                submittedRecordIdentity,
              );
              throw retryError;
            } finally {
              if (recordIdentityRef.current === submittedRecordIdentity) {
                setSubmitting(false);
              }
            }
          },
          title: t("dataConnect.allowUnhealthy.title"),
        });
        return;
      }

      void message.error(extractRequestErrorMessage(error));
      await refreshRecordAfterConflict(
        error,
        submittedRecordId,
        submittedRecordIdentity,
      );
    } finally {
      if (recordIdentityRef.current === submittedRecordIdentity) {
        setSubmitting(false);
      }
    }
  };

  const finishSubmit = () => {
    message.success(t("common.success"));

    if (onSubmitSuccess) {
      onSubmitSuccess();
      return;
    }

    void navigate("/data-connect");
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      await testDataConnectConfig(await buildConnectionTestPayload());
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
                onValuesChange={() => {
                  setHasUnsavedChanges(true);
                }}
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
                      setHasUnsavedChanges(true);
                      selectConnectorType(value);
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
              <PermissionGate permissions="catalog:create">
                <AppButton
                  loading={testingConnection}
                  onClick={() => {
                    void handleTestConnection();
                  }}
                >
                  {t("common.testConnection")}
                </AppButton>
              </PermissionGate>
            ) : null}
            <AppButton
              loading={submitting || loadingConnectorDefinition}
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

function sanitizeConnectorConfig(
  config: Record<string, unknown>,
  fieldConfig: Record<string, ConnectorFieldConfig> = {},
) {
  return Object.fromEntries(
    Object.entries(config)
      .filter(
        ([key, value]) =>
          !shouldOmitConnectorConfigValue(fieldConfig[key], value),
      )
      .map(([key, value]) => {
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

function normalizeConnectorConfig(
  config: Record<string, unknown>,
  fieldConfig: Record<string, ConnectorFieldConfig> = {},
  connectorType?: string,
) {
  return Object.fromEntries(
    Object.entries(config)
      .filter(
        ([key, value]) =>
          isConnectorFieldVisible(connectorType, key, config) &&
          !shouldOmitConnectorConfigValue(fieldConfig[key], value),
      )
      .map(([key, value]) => {
        if (typeof value === "string") {
          if (fieldConfig[key]?.encrypted) {
            return [key, value];
          }

          const trimmed = value.trim();

          if (fieldConfig[key]?.type === "object") {
            try {
              return [key, JSON.parse(trimmed) as unknown];
            } catch {
              return [key, trimmed];
            }
          }

          return [key, trimmed];
        }

        return [key, value];
      }),
  ) as Record<string, unknown>;
}

function shouldOmitConnectorConfigValue(
  field: ConnectorFieldConfig | undefined,
  value: unknown,
) {
  if (field?.encrypted) {
    return value === undefined || value === null || value === "";
  }

  return (
    field?.type === "object" &&
    (value === null || (typeof value === "string" && value.trim() === ""))
  );
}
