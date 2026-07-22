/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ToolDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionDefinitionFields } from "@/modules/execution-factory/components/FunctionDefinitionFields";
import { HttpToolLifecyclePanel } from "@/modules/execution-factory/components/HttpToolLifecyclePanel";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { ToolDebugPanel } from "@/modules/execution-factory/components/ToolDebugPanel";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import {
  getToolDetail,
  updateTool,
} from "@/modules/execution-factory/services/tool.service";
import type {
  ToolGlobalParameter,
  ToolIoSpec,
  ToolMetadataType,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import { parseOpenApiEndpointDetail } from "@/modules/execution-factory/utils/openapi-detail";

import styles from "./UnitFormScene.module.css";

type ToolFormValues = {
  name: string;
  description?: string;
  useRule?: string;
  openapiSpec?: string;
  functionCode?: string;
  functionInputs?: FunctionParameterDef[];
  functionOutputs?: FunctionParameterDef[];
  globalParameters?: ToolGlobalParameter;
};

export function ToolDetailScene({ boxId, onBack, toolId }: ToolDetailSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metadataType, setMetadataType] = useState<ToolMetadataType>("openapi");
  const [ioSpec, setIoSpec] = useState<ToolIoSpec | undefined>();
  const [sessionLogs, setSessionLogs] = useState<ToolRunLogEntry[]>([]);
  const debugSectionRef = useRef<HTMLDivElement | null>(null);
  const toolName = Form.useWatch<ToolFormValues["name"]>("name", form);
  const openapiSpec = Form.useWatch<ToolFormValues["openapiSpec"]>("openapiSpec", form);
  const functionInputs = Form.useWatch("functionInputs", form);
  const functionOutputs = Form.useWatch("functionOutputs", form);
  const endpoint = useMemo(() => parseOpenApiEndpointDetail(openapiSpec), [openapiSpec]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolDetail(boxId, toolId);
        const type = record.metadataType ?? "openapi";
        setMetadataType(type);
        setIoSpec(record.ioSpec);
        form.setFieldsValue({
          name: record.name,
          description: record.description,
          useRule: record.useRule,
          openapiSpec: record.openapiSpec,
          functionCode: record.functionInput?.code,
          functionInputs: record.functionInput?.inputs,
          functionOutputs: record.functionInput?.outputs,
          globalParameters: record.globalParameters
            ? {
                ...record.globalParameters,
                value:
                  record.globalParameters.value !== undefined
                    ? JSON.stringify(record.globalParameters.value, null, 2)
                    : undefined,
              }
            : undefined,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, form, toolId]);

  useEffect(() => {
    if (!loading && !loadError && searchParams.get("focus") === "debug") {
      debugSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loadError, loading, searchParams]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate(`/execution-factory/toolboxes/${boxId}/tools`);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (metadataType === "openapi") {
      const openApiValidation = validateOpenApiDocumentText(values.openapiSpec);
      if (!openApiValidation.ok) {
        void message.error(openApiValidation.reason);
        return;
      }
    }

    setSubmitting(true);

    try {
      await updateTool(boxId, toolId, {
        name: values.name,
        description: values.description,
        useRule: values.useRule,
        metadataType,
        openapiSpec: metadataType === "openapi" ? values.openapiSpec : undefined,
        globalParameters: values.globalParameters,
        functionInput:
          metadataType === "function"
            ? {
                code: values.functionCode,
                description: values.description,
                inputs: values.functionInputs,
                name: values.name,
                outputs: values.functionOutputs,
                script_type: "python",
              }
            : undefined,
      });
      void message.success(t("common.success"));
      handleBack();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDebugRunComplete = (entry: ToolRunLogEntry) => {
    setSessionLogs((current) => [entry, ...current].slice(0, 20));
  };

  const functionInput =
    metadataType === "function"
      ? { inputs: functionInputs, outputs: functionOutputs }
      : undefined;

  return (
    <PermissionGate
      fallback={
        <Alert message={t("common.noPermission")} showIcon type="warning" />
      }
      permissions="execution-factory:tool:edit"
    >
      <CrudFormPage
        description={t("executionFactory.toolDetailDescription")}
        onBack={handleBack}
        title={t("executionFactory.toolDetailTitle")}
      >
        {loading ? <Spin /> : null}
        {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        {!loading && !loadError ? (
          <div className={styles.formSurfaceWide}>
            <Form form={form} layout="vertical">
              <HttpToolLifecyclePanel
                advancedConfig={
                  metadataType === "function" ? <FunctionDefinitionFields /> : undefined
                }
                businessFields={
                  <>
                    <Form.Item
                      label={t("executionFactory.toolName")}
                      name="name"
                      rules={[{ required: true, message: t("common.required") }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item label={t("common.description")} name="description">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label={t("executionFactory.useRule")} name="useRule">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    {metadataType === "openapi" ? (
                      <Form.Item
                        label={t("executionFactory.openapiSpec")}
                        name="openapiSpec"
                        rules={[{ required: true, message: t("common.required") }]}
                      >
                        <OpenApiSpecInput rows={10} showEndpointReview />
                      </Form.Item>
                    ) : null}
                  </>
                }
                debugWorkbench={
                  <div ref={debugSectionRef}>
                    <ToolDebugPanel
                      boxId={boxId}
                      functionInput={functionInput}
                      ioSpec={ioSpec}
                      onRunComplete={handleDebugRunComplete}
                      record={{
                        toolId,
                        name: toolName ?? toolId,
                        status: "enabled",
                        method: endpoint?.method,
                        path: endpoint?.path,
                        serverUrl: endpoint?.serverUrl,
                      }}
                    />
                  </div>
                }
                ioPreview={
                  <ToolIoPanel
                    functionInput={functionInput}
                    ioSpec={ioSpec}
                    runLogs={sessionLogs}
                  />
                }
                metadataTypeLabel={t(`executionFactory.metadataTypes.${metadataType}`)}
              />
              <Form.Item hidden name={["globalParameters", "name"]}>
                <Input />
              </Form.Item>
              <Form.Item hidden name={["globalParameters", "description"]}>
                <Input />
              </Form.Item>
              <Form.Item hidden name={["globalParameters", "in"]}>
                <Input />
              </Form.Item>
              <Form.Item hidden name={["globalParameters", "type"]}>
                <Input />
              </Form.Item>
              <Form.Item hidden name={["globalParameters", "value"]}>
                <Input />
              </Form.Item>
            </Form>
            <div className={styles.formActions}>
              <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
              <PermissionGate permissions="execution-factory:tool:debug">
                <AppButton
                  onClick={() =>
                    debugSectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                >
                  {t("executionFactory.debug")}
                </AppButton>
              </PermissionGate>
              <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
                {t("common.save")}
              </AppButton>
            </div>
          </div>
        ) : null}
      </CrudFormPage>
    </PermissionGate>
  );
}
