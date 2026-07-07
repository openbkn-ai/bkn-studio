/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Form, Input, Spin, Tabs, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { ToolDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionDefinitionFields } from "@/modules/execution-factory/components/FunctionDefinitionFields";
import { HttpCapabilityContractPanel } from "@/modules/execution-factory/components/HttpCapabilityContractPanel";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolGlobalParameterFields } from "@/modules/execution-factory/components/ToolGlobalParameterFields";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import {
  getToolDetail,
  updateTool,
} from "@/modules/execution-factory/services/tool.service";
import type {
  ToolGlobalParameter,
  ToolDetail,
  ToolIoSpec,
  ToolMetadataType,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import { buildToolCapabilityManifest } from "@/modules/execution-factory/utils/capability-manifest";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

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
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metadataType, setMetadataType] = useState<ToolMetadataType>("openapi");
  const [toolDetail, setToolDetail] = useState<ToolDetail | null>(null);
  const [ioSpec, setIoSpec] = useState<ToolIoSpec | undefined>();
  const [debugOpen, setDebugOpen] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<ToolRunLogEntry[]>([]);
  const functionInputs = Form.useWatch("functionInputs", form);
  const functionOutputs = Form.useWatch("functionOutputs", form);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolDetail(boxId, toolId);
        const type = record.metadataType ?? "openapi";
        setToolDetail(record);
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
        setToolDetail(null);
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, form, toolId]);

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

  const capabilityManifest = useMemo(() => {
    if (!toolDetail) {
      return null;
    }

    const manifest = buildToolCapabilityManifest(toolDetail);
    const latestLog = sessionLogs[0];

    if (!latestLog) {
      return manifest;
    }

    return {
      ...manifest,
      examples: latestLog.error
        ? manifest.examples
        : [
            {
              title: t("executionFactory.httpContract.latestDebugExample", {
                defaultValue: "Latest successful debug",
              }),
              input: latestLog.requestBody ?? {},
              expectedOutputSummary: JSON.stringify(latestLog.body ?? {}),
              status: "passed" as const,
              verifiedAt: latestLog.timestamp,
            },
            ...(manifest.examples ?? []),
          ],
      testStatus: latestLog.error ? ("failed" as const) : ("passed" as const),
    };
  }, [sessionLogs, t, toolDetail]);

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
        title={t("executionFactory.toolDetailTitle")}
      >
        {loading ? <Spin /> : null}
        {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        {!loading && !loadError ? (
          <div className={styles.formSurface}>
            <Form form={form} layout="vertical">
              <Tabs
                items={[
                  {
                    key: "overview",
                    label: t("executionFactory.httpContract.tabs.overview", {
                      defaultValue: "概览",
                    }),
                    children: (
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
                            <OpenApiSpecInput rows={14} />
                          </Form.Item>
                        ) : (
                          <FunctionDefinitionFields />
                        )}
                        <Collapse
                          ghost
                          items={[
                            {
                              key: "globalParameters",
                              label: t("executionFactory.globalParametersTitle"),
                              children: <ToolGlobalParameterFields />,
                            },
                          ]}
                        />
                      </>
                    ),
                  },
                  ...(metadataType === "openapi"
                    ? [
                        {
                          key: "contract",
                          label: t("executionFactory.httpContract.tabs.contract", {
                            defaultValue: "契约",
                          }),
                          children: capabilityManifest ? (
                            <HttpCapabilityContractPanel manifest={capabilityManifest} />
                          ) : (
                            <Alert
                              message={t("executionFactory.httpContract.noManifest", {
                                defaultValue: "暂无可展示的能力契约。",
                              })}
                              showIcon
                              type="info"
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    key: "debug",
                    label: t("executionFactory.httpContract.tabs.debug", {
                      defaultValue: "调试",
                    }),
                    children: (
                      <section style={{ marginTop: 8 }}>
                        <Alert
                          message={t("executionFactory.httpContract.debugHint", {
                            defaultValue:
                              "运行调试后，最近一次成功结果会作为本会话的 Agent 验证示例展示在契约中。",
                          })}
                          showIcon
                          style={{ marginBottom: 16 }}
                          type="info"
                        />
                        <ToolIoPanel
                          functionInput={functionInput}
                          ioSpec={ioSpec}
                          runLogs={sessionLogs}
                        />
                      </section>
                    ),
                  },
                  {
                    key: "publish",
                    label: t("executionFactory.httpContract.tabs.publish", {
                      defaultValue: "发布",
                    }),
                    children: (
                      <section style={{ display: "grid", gap: 12, marginTop: 8 }}>
                        <Alert
                          message={t("executionFactory.httpContract.publishHint", {
                            defaultValue:
                              "资源发布状态与 Agent 可用状态需要分开判断。已发布不代表 Agent 可以自动调用。",
                          })}
                          showIcon
                          type="info"
                        />
                        <div>
                          <Tag>
                            {t("executionFactory.httpContract.resourceStatus", {
                              defaultValue: "资源状态",
                            })}
                            : {toolDetail?.status ?? "-"}
                          </Tag>
                          {capabilityManifest ? (
                            <>
                              <Tag>
                                Agent: {capabilityManifest.agentVisibility ?? "hidden"}
                              </Tag>
                              <Tag>
                                Invoke: {capabilityManifest.agentInvokePolicy ?? "manual_only"}
                              </Tag>
                              <Tag>
                                Risk: {capabilityManifest.riskLevel ?? "medium"}
                              </Tag>
                              <Tag>
                                Verification: {capabilityManifest.testStatus ?? "untested"}
                              </Tag>
                            </>
                          ) : null}
                        </div>
                      </section>
                    ),
                  },
                ]}
              />
            </Form>
            <div className={styles.formActions}>
              <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
              <PermissionGate permissions="execution-factory:tool:debug">
                <AppButton onClick={() => setDebugOpen(true)}>
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
      <ToolDebugModal
        boxId={boxId}
        functionInput={
          metadataType === "function"
            ? {
                inputs: functionInputs,
                outputs: functionOutputs,
              }
            : undefined
        }
        ioSpec={ioSpec}
        onClose={() => setDebugOpen(false)}
        onRunComplete={handleDebugRunComplete}
        open={debugOpen}
        record={{
          toolId,
          name: form.getFieldValue("name") ?? toolId,
          status: "enabled",
        }}
      />
    </PermissionGate>
  );
}
