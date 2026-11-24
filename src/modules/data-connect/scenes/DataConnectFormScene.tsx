/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Modal, Result, Spin, Steps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectFormSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { atLeast } from "@/framework/entitlement/edition";
import { extractRequestErrorMessage, isRequestConflict } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ConnectorTypePicker } from "@/modules/data-connect/components/ConnectorTypePicker";
import { DataConnectConfigForm } from "@/modules/data-connect/components/DataConnectConfigForm";
import { DataConnectPageHeader } from "@/modules/data-connect/components/DataConnectPageHeader";
import {
  ApiCatalogConnectionTestModal,
  ApiCatalogTestResultNotice,
  type ApiCatalogTestScope,
  type ApiCatalogTestResult,
} from "@/modules/data-connect/components/ApiCatalogConnectionTestModal";
import {
  buildApiCatalogPreview,
  prepareApiCatalogConfigForEdit,
} from "@/modules/data-connect/lib/api-catalog-config";
import apiStyles from "@/modules/data-connect/components/ApiCatalogConfigEditor.module.css";
import {
  getConnectorConfigDefaults,
  getConnectorRequiredEdition,
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
  testDataConnectRecord,
  updateDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  ConnectorFieldConfig,
  DataConnectConnectorType,
  DataConnectMutationInput,
  DataConnectMutationPayload,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";
import { hasCatalogOperation } from "@/shared/catalog";

import styles from "./DataConnectFormScene.module.css";

export function DataConnectFormScene({
  mode,
  onBack,
  onSubmitSuccess,
  recordId,
}: DataConnectFormSceneProps) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const { snapshot } = useEntitlementContext();
  const [form] = Form.useForm<DataConnectMutationInput>();
  const apiDraftConfig = Form.useWatch<Record<string, unknown>>("connectorConfig", form);
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
  const [hasConnectorConfigChanges, setHasConnectorConfigChanges] = useState(false);
  const [apiEditorValid, setApiEditorValid] = useState(true);
  const [apiTestOpen, setApiTestOpen] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<ApiCatalogTestResult | null>(null);
  const [apiPreview, setApiPreview] = useState<string | null>(null);
  const [apiConflict, setApiConflict] = useState(false);
  const [configRevision, setConfigRevision] = useState(0);
  const configRevisionRef = useRef(0);
  const apiTestSequence = useRef(0);
  const apiTestController = useRef<AbortController | null>(null);
  const selectedConnectorTypeRef = useRef<string | undefined>(undefined);
  const configuredConnectorTypeRef = useRef<string | undefined>(undefined);
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

  const changeConnectorType = (value: string) => {
    if (value === selectedConnectorTypeRef.current) return;

    const applyChange = () => {
      selectConnectorType(value);
      form.setFieldValue("connectorType", value);
      setHasUnsavedChanges(true);
    };

    if (
      configuredConnectorTypeRef.current &&
      value !== configuredConnectorTypeRef.current &&
      hasConnectorConfigChanges
    ) {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("dataConnect.changeConnectorDescription"),
        okText: t("dataConnect.changeConnectorConfirm"),
        onOk: applyChange,
        title: t("dataConnect.changeConnectorTitle"),
      });
      return;
    }

    applyChange();
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setApiTestOpen(false);
      setApiTestResult(null);
      setApiPreview(null);
      setApiConflict(false);
      setApiEditorValid(true);
      configRevisionRef.current = 0;
      setConfigRevision(0);
      apiTestSequence.current++;

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
            setConnectorTypes((currentTypes) =>
              currentTypes.map((item) => (item.type === connector.type ? connector : item)),
            );
            selectConnectorType(currentRecord.connectorType);
            configuredConnectorTypeRef.current = currentRecord.connectorType;
            form.setFieldValue(
              "connectorConfig",
              sanitizeConnectorConfig(
                currentRecord.connectorConfig,
                connector?.fieldConfig,
                connector?.category === "api",
              ),
            );
            form.setFieldsValue({
              connectorType: currentRecord.connectorType,
              description: currentRecord.description,
              enabled: currentRecord.enabled,
              name: currentRecord.name,
              tags: currentRecord.tags,
            });
          }
        } else {
          configuredConnectorTypeRef.current = undefined;
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
        setHasConnectorConfigChanges(false);
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
      apiTestController.current?.abort();
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

    if (connectorTypes.find((item) => item.type === selectedConnectorType)?.category === "api") {
      setApiConflict(true);
      return;
    }

    try {
      const latestRecord = await getDataConnectRecord(submittedRecordId);
      if (recordIdentityRef.current !== submittedRecordIdentity) {
        return;
      }

      setRecord(latestRecord);
      if (latestRecord) {
        const connector = connectorTypes.find((item) => item.type === latestRecord.connectorType);
        selectConnectorType(latestRecord.connectorType);
        configuredConnectorTypeRef.current = latestRecord.connectorType;
        form.setFieldValue(
          "connectorConfig",
          sanitizeConnectorConfig(latestRecord.connectorConfig, connector?.fieldConfig),
        );
        form.setFieldsValue({
          connectorType: latestRecord.connectorType,
          description: latestRecord.description,
          enabled: latestRecord.enabled,
          name: latestRecord.name,
          tags: latestRecord.tags,
        });
        setHasUnsavedChanges(false);
        setHasConnectorConfigChanges(false);
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
  const isApiConnector = selectedConnector?.category === "api";
  const apiRequiredEdition = selectedConnector
    ? getConnectorRequiredEdition(selectedConnector)
    : undefined;
  const apiUnavailable = !!(
    isApiConnector &&
    selectedConnector &&
    (!selectedConnector.available ||
      !selectedConnector.enabled ||
      (snapshot !== null && apiRequiredEdition && !atLeast(snapshot.edition, apiRequiredEdition)))
  );
  const canTestUnsavedConfig = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:create",
  });

  // Align with backend catalog operation vocabulary (catalog.json): create=catalog:create and edit=catalog:modify.
  // Legacy data-connect:create/edit keys were invented by the frontend and absent from /me/permissions, causing permanent 403 responses.
  const permission = mode === "create" ? "catalog:create" : "catalog:modify";
  const pageTitle = mode === "create" ? t("dataConnect.createTitle") : t("dataConnect.editTitle");
  const pageDescription =
    mode === "create" ? t("dataConnect.createDescription") : t("dataConnect.editDescription");

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
      if (connector.category === "api" && (!connector.available || !connector.enabled)) {
        throw new Error(t("dataConnect.apiCatalog.unavailable"));
      }
      setConnectorTypes((currentTypes) =>
        currentTypes.map((item) => (item.type === connector.type ? connector : item)),
      );
      const defaults = getConnectorConfigDefaults(connector);
      const currentConfig = (form.getFieldValue("connectorConfig") ?? {}) as Record<
        string,
        unknown
      >;
      const mergedConfig: DataConnectMutationInput["connectorConfig"] = {
        ...defaults,
        ...(configuredConnectorTypeRef.current === selectedConnectorType
          ? connector.category === "api"
            ? currentConfig
            : sanitizeConnectorConfig(currentConfig, connector.fieldConfig)
          : {}),
      };

      form.setFieldValue("connectorConfig", mergedConfig);
      form.setFieldValue("connectorType", selectedConnectorType);
      if (configuredConnectorTypeRef.current !== selectedConnectorType) {
        setHasConnectorConfigChanges(false);
      }
      configuredConnectorTypeRef.current = selectedConnectorType;
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
    if (apiUnavailable) throw new Error(t("dataConnect.apiCatalog.unavailable"));
    const includeConnection = mode === "create" || hasConnectorConfigChanges;
    if (isApiConnector && includeConnection && !apiEditorValid) {
      throw new Error(t("dataConnect.apiCatalog.errors.incompleteInput"));
    }
    const values = await form.validateFields(
      includeConnection ? undefined : ["name", "description", "tags"],
    );
    const connectorConfig = includeConnection
      ? normalizeConnectorConfig(
          values.connectorConfig ?? {},
          selectedConnector?.fieldConfig,
          selectedConnector?.type,
          isApiConnector,
        )
      : {};

    return {
      connectorConfig,
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
    const currentValues = form.getFieldsValue(["connectorType"]) as Pick<
      DataConnectMutationInput,
      "connectorType"
    >;

    return {
      connectorConfig: normalizeConnectorConfig(
        values.connectorConfig ?? {},
        selectedConnector?.fieldConfig,
        selectedConnector?.type,
        isApiConnector,
      ),
      connectorType: selectedConnectorType ?? currentValues.connectorType,
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
        await updateDataConnectRecord(
          recordId,
          {
            ...payload,
            connectorConfig: hasConnectorConfigChanges ? payload.connectorConfig : undefined,
            expectedUpdateTime: record.expectedUpdateTime,
          },
          {
            skipErrorToast: true,
          },
        );
      }

      if (recordIdentityRef.current !== submittedRecordIdentity) {
        return;
      }
      finishSubmit();
    } catch (error) {
      if (typeof error === "object" && error !== null && "errorFields" in error) {
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
                await updateDataConnectRecord(
                  recordId,
                  {
                    ...retryPayload,
                    connectorConfig: hasConnectorConfigChanges
                      ? retryPayload.connectorConfig
                      : undefined,
                    expectedUpdateTime: record.expectedUpdateTime,
                  },
                  {
                    allowUnhealthy: true,
                    skipErrorToast: true,
                  },
                );
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
      await refreshRecordAfterConflict(error, submittedRecordId, submittedRecordIdentity);
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
      if (mode === "edit" && recordId && !canTestUnsavedConfig) {
        await testDataConnectRecord(recordId);
      } else {
        await testDataConnectConfig(await buildConnectionTestPayload());
      }
      message.success(t("dataConnect.testConnectionSuccess"));
    } catch (error) {
      if (typeof error === "object" && error !== null && "errorFields" in error) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleApiTest = async (scope: ApiCatalogTestScope) => {
    if (apiUnavailable) return;
    if (
      (scope === "draft" && !canTestUnsavedConfig) ||
      (scope === "saved" && (!recordId || !record || !hasCatalogOperation(record, "modify")))
    )
      return;
    const identity = recordIdentityRef.current;
    const revision = configRevisionRef.current;
    const sequence = ++apiTestSequence.current;
    apiTestController.current?.abort();
    const controller = new AbortController();
    apiTestController.current = controller;
    setApiTestResult(null);
    setTestingConnection(true);
    try {
      if (scope === "draft" && !apiEditorValid)
        throw new Error(t("dataConnect.apiCatalog.errors.incompleteInput"));
      if (scope === "saved") {
        await testDataConnectRecord(recordId!, { signal: controller.signal });
      } else {
        const payload = await buildConnectionTestPayload();
        if (
          identity !== recordIdentityRef.current ||
          revision !== configRevisionRef.current ||
          controller.signal.aborted
        )
          return;
        await testDataConnectConfig(payload, { signal: controller.signal });
      }
      if (
        identity !== recordIdentityRef.current ||
        sequence !== apiTestSequence.current ||
        controller.signal.aborted
      )
        return;
      setApiTestResult({
        scope,
        revision,
        type: "success",
        message: t("dataConnect.apiCatalog.connectionSuccess"),
      });
    } catch (error) {
      if (
        identity !== recordIdentityRef.current ||
        sequence !== apiTestSequence.current ||
        controller.signal.aborted
      )
        return;
      if (typeof error === "object" && error !== null && "errorFields" in error) {
        setApiTestOpen(false);
        return;
      }
      setApiTestResult({
        scope,
        revision,
        type: "error",
        message: extractRequestErrorMessage(error),
      });
    } finally {
      if (identity === recordIdentityRef.current && sequence === apiTestSequence.current)
        setTestingConnection(false);
    }
  };

  const reloadApiRecord = () => {
    const identity = recordIdentityRef.current;
    const id = recordId;
    void modal.confirm({
      title: t("dataConnect.apiCatalog.reloadTitle"),
      content: t("dataConnect.apiCatalog.reloadHint"),
      okText: t("dataConnect.apiCatalog.reload"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        if (!id) return;
        const latest = await getDataConnectRecord(id);
        if (identity !== recordIdentityRef.current || !latest) return;
        setRecord(latest);
        form.setFieldValue(
          "connectorConfig",
          prepareApiCatalogConfigForEdit(latest.connectorConfig),
        );
        form.setFieldsValue({
          connectorType: latest.connectorType,
          description: latest.description,
          enabled: latest.enabled,
          name: latest.name,
          tags: latest.tags,
        });
        configRevisionRef.current++;
        setConfigRevision(configRevisionRef.current);
        setApiTestResult(null);
        setApiConflict(false);
        setHasUnsavedChanges(false);
        setHasConnectorConfigChanges(false);
      },
    });
  };

  if (
    mode === "edit" &&
    !loading &&
    record &&
    (record.builtin || !hasCatalogOperation(record, "modify"))
  ) {
    return <Result status="403" subTitle={t("dataConnect.permissionRequired")} title="403" />;
  }

  return (
    <PermissionGate
      fallback={<Result status="403" subTitle={t("dataConnect.permissionRequired")} title="403" />}
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
              description={t("dataConnect.loadErrorRefreshHint")}
              message={loadError}
              showIcon
              type="error"
            />
          ) : mode === "edit" && !record ? (
            <Alert message={t("common.notFound")} showIcon type="warning" />
          ) : (
            <div className={styles.stepPanel}>
              {isApiConnector ? (
                <div className={`${apiStyles.section} ${apiStyles.context}`}>
                  {apiUnavailable ? (
                    <Alert
                      showIcon
                      type="warning"
                      message={t("dataConnect.apiCatalog.unavailable")}
                    />
                  ) : null}
                  <Alert
                    showIcon
                    type={hasConnectorConfigChanges && mode === "edit" ? "warning" : "info"}
                    message={t(
                      `dataConnect.apiCatalog.${mode === "create" ? "newConfig" : hasConnectorConfigChanges ? "replacement" : "metadataPreserved"}`,
                    )}
                  />
                  {apiConflict ? (
                    <Alert
                      showIcon
                      type="warning"
                      message={t("dataConnect.apiCatalog.conflict")}
                      action={
                        <AppButton onClick={reloadApiRecord}>
                          {t("dataConnect.apiCatalog.reload")}
                        </AppButton>
                      }
                    />
                  ) : null}
                  {apiTestResult ? (
                    <ApiCatalogTestResultNotice result={apiTestResult} revision={configRevision} />
                  ) : null}
                </div>
              ) : null}
              <Form
                className={
                  currentStep === 0 && mode === "create" ? undefined : styles.configFormHorizontal
                }
                colon={false}
                disabled={apiUnavailable}
                form={form}
                onValuesChange={(changedValues) => {
                  setHasUnsavedChanges(true);
                  if (Object.prototype.hasOwnProperty.call(changedValues, "connectorConfig")) {
                    setHasConnectorConfigChanges(true);
                    configRevisionRef.current++;
                    setConfigRevision(configRevisionRef.current);
                  }
                }}
                labelAlign="right"
                labelCol={
                  currentStep === 0 && mode === "create" ? undefined : { flex: "0 0 128px" }
                }
                layout={currentStep === 0 && mode === "create" ? "vertical" : "horizontal"}
                wrapperCol={currentStep === 0 && mode === "create" ? undefined : { flex: "1 1 0" }}
              >
                {currentStep === 0 && mode === "create" ? (
                  <ConnectorTypePicker
                    onChange={changeConnectorType}
                    options={connectorTypes}
                    value={selectedConnectorType}
                  />
                ) : (
                  <DataConnectConfigForm
                    isEdit={mode === "edit"}
                    selectedConnectorType={selectedConnector}
                    onApiValidityChange={setApiEditorValid}
                    apiDisabled={apiUnavailable}
                  />
                )}
              </Form>
            </div>
          )}
        </div>
        <div className={styles.footerBar}>
          <div className={styles.actionsRight}>
            {isApiConnector && currentStep === 1 ? (
              <AppButton
                onClick={() =>
                  setApiPreview(
                    buildApiCatalogPreview(
                      (form.getFieldValue("connectorConfig") ?? {}) as Record<string, unknown>,
                    ),
                  )
                }
              >
                {t("dataConnect.apiCatalog.preview")}
              </AppButton>
            ) : null}
            {currentStep === 1 && mode === "create" ? (
              <AppButton
                onClick={() => {
                  setCurrentStep(0);
                }}
              >
                {t("common.previous")}
              </AppButton>
            ) : null}
            {(currentStep === 1 && mode === "create") || (mode === "edit" && record) ? (
              <AppButton
                disabled={
                  apiUnavailable ||
                  (!isApiConnector && mode === "edit" && !canTestUnsavedConfig && hasUnsavedChanges)
                }
                loading={testingConnection}
                onClick={() => {
                  if (isApiConnector) setApiTestOpen(true);
                  else void handleTestConnection();
                }}
                title={
                  !isApiConnector && mode === "edit" && !canTestUnsavedConfig && hasUnsavedChanges
                    ? t("dataConnect.saveBeforeTesting")
                    : undefined
                }
              >
                {t("common.testConnection")}
              </AppButton>
            ) : null}
            <AppButton
              disabled={apiUnavailable || (isApiConnector && apiConflict)}
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
        {apiPreview !== null ? (
          <Modal
            open
            title={t("dataConnect.apiCatalog.preview")}
            footer={null}
            width={800}
            onCancel={() => setApiPreview(null)}
          >
            <p className={apiStyles.hint}>{t("dataConnect.apiCatalog.previewHint")}</p>
            <pre className={apiStyles.preview}>{apiPreview}</pre>
          </Modal>
        ) : null}
        {apiTestOpen && isApiConnector ? (
          <ApiCatalogConnectionTestModal
            saved={!!record}
            draftLogin={!!apiDraftConfig?.login_request}
            savedLogin={!!record?.connectorConfig.login_request}
            defaultScope={
              record && (!hasConnectorConfigChanges || !canTestUnsavedConfig) ? "saved" : "draft"
            }
            canTestDraft={canTestUnsavedConfig}
            canTestSaved={!!record && hasCatalogOperation(record, "modify")}
            loading={testingConnection}
            result={apiTestResult}
            revision={configRevision}
            onRun={(scope) => {
              void handleApiTest(scope);
            }}
            onClose={() => {
              apiTestController.current?.abort();
              apiTestSequence.current++;
              setTestingConnection(false);
              setApiTestOpen(false);
            }}
          />
        ) : null}
      </section>
    </PermissionGate>
  );
}

function sanitizeConnectorConfig(
  config: Record<string, unknown>,
  fieldConfig: Record<string, ConnectorFieldConfig> = {},
  api = false,
) {
  if (api) return prepareApiCatalogConfigForEdit(config);
  return Object.fromEntries(
    Object.entries(config)
      .filter(([key, value]) => !shouldOmitConnectorConfigValue(fieldConfig[key], value))
      .map(([key, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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
  api = false,
) {
  if (api) return config;
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

function shouldOmitConnectorConfigValue(field: ConnectorFieldConfig | undefined, value: unknown) {
  if (field?.encrypted) {
    return value === undefined || value === null || value === "";
  }

  return (
    field?.type === "object" &&
    (value === null || (typeof value === "string" && value.trim() === ""))
  );
}
