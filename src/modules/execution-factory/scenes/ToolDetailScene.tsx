/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import type { ToolDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionDefinitionFields } from "@/modules/execution-factory/components/FunctionDefinitionFields";
import { ToolCallGuideDrawer } from "@/modules/execution-factory/components/ToolCallGuideDrawer";
import { HttpToolLifecyclePanel } from "@/modules/execution-factory/components/HttpToolLifecyclePanel";
import { OpenApiDefinitionFields } from "@/modules/execution-factory/components/OpenApiDefinitionFields";
import { ToolDebugPanel } from "@/modules/execution-factory/components/ToolDebugPanel";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import { getToolDetail, updateTool } from "@/modules/execution-factory/services/tool.service";
import {
  storedScriptFields,
  type FunctionScriptFields,
} from "@/modules/execution-factory/utils/function-script";
import type {
  ToolGlobalParameter,
  ToolIoSpec,
  ToolMetadataType,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import { readReturnTo } from "@/modules/execution-factory/utils/back-navigation";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import { toolCallKind } from "@/modules/execution-factory/utils/tool-call-guide";
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metadataType, setMetadataType] = useState<ToolMetadataType>("openapi");
  const [ioSpec, setIoSpec] = useState<ToolIoSpec | undefined>();
  const [sessionLogs, setSessionLogs] = useState<ToolRunLogEntry[]>([]);
  const debugSectionRef = useRef<HTMLDivElement | null>(null);
  /** Sent back unchanged on save: this form edits a function's code, never its kind. */
  const scriptFieldsRef = useRef<FunctionScriptFields>({ script_type: "python" });
  const [scriptFields, setScriptFields] = useState<FunctionScriptFields>({
    script_type: "python",
  });
  const [callGuideOpen, setCallGuideOpen] = useState(false);
  const toolName = Form.useWatch<ToolFormValues["name"]>("name", form);
  const openapiSpec = Form.useWatch<ToolFormValues["openapiSpec"]>("openapiSpec", form);
  const functionInputs = Form.useWatch("functionInputs", form);
  const functionOutputs = Form.useWatch("functionOutputs", form);
  const endpoint = useMemo(() => parseOpenApiEndpointDetail(openapiSpec), [openapiSpec]);
  const callKind = useMemo(
    () => toolCallKind(metadataType, scriptFields),
    [metadataType, scriptFields],
  );

  // Read when the tool has loaded; the load itself should not rerun when history state changes.
  const arrivalStateRef = useRef<unknown>(location.state);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);
      let redirected = false;

      try {
        const record = await getToolDetail(boxId, toolId);
        const type = record.metadataType ?? "openapi";
        if (type === "function") {
          // Functions are edited, run and described in the function workbench; this page is the
          // API tool's. A typed or bookmarked address lands there with the function selected,
          // keeping where the visitor came from for the workbench's back.
          redirected = true;
          void navigate(
            `/execution-factory/toolboxes/${boxId}/tools?toolId=${encodeURIComponent(toolId)}`,
            { replace: true, state: arrivalStateRef.current },
          );
          return;
        }
        setMetadataType(type);
        setIoSpec(record.ioSpec);
        scriptFieldsRef.current = storedScriptFields(record.functionInput);
        setScriptFields(scriptFieldsRef.current);
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
        if (!redirected) setLoading(false);
      }
    })();
  }, [boxId, form, navigate, toolId]);

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

    // The toolset's tool list is this page's parent. A knowledge network's capability list links
    // straight here and says so in location state, since sending it to the tool list would strand
    // it in another module. Neither case may use `navigate(-1)`: the tool list answered its own
    // back the same way and the two pages bounced between each other (#386). `replace` keeps this
    // page out of the history stack so the browser's back from the parent does not land here.
    void navigate(readReturnTo(location.state) ?? `/execution-factory/toolboxes/${boxId}/tools`, {
      replace: true,
    });
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
                ...scriptFieldsRef.current,
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
    metadataType === "function" ? { inputs: functionInputs, outputs: functionOutputs } : undefined;
  const editPermission =
    metadataType === "function"
      ? "execution-factory:function:edit"
      : "execution-factory:toolbox:edit";
  const debugPermission =
    metadataType === "function"
      ? "execution-factory:function:debug"
      : "execution-factory:toolbox:debug";

  return (
    <CrudFormPage
      actions={
        !loading && !loadError ? (
          <AppButton onClick={() => setCallGuideOpen(true)}>
            {t("executionFactory.callGuide.open")}
          </AppButton>
        ) : null
      }
      description={t("executionFactory.toolDetailDescription")}
      onBack={handleBack}
      title={t("executionFactory.toolDetailTitle")}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError ? (
        <PermissionGate
          fallback={<Alert message={t("common.noPermission")} showIcon type="warning" />}
          permissions={editPermission}
        >
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
                      <OpenApiDefinitionFields showEndpointReview />
                    ) : null}
                  </>
                }
                debugWorkbench={
                  <PermissionGate permissions={debugPermission}>
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
                  </PermissionGate>
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
              <PermissionGate permissions={debugPermission}>
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
        </PermissionGate>
      ) : null}
      <ToolCallGuideDrawer
        boxId={boxId}
        functionInput={
          metadataType === "function"
            ? { inputs: functionInputs, outputs: functionOutputs, ...scriptFields }
            : undefined
        }
        ioSpec={ioSpec}
        kind={callKind}
        onClose={() => setCallGuideOpen(false)}
        open={callGuideOpen}
        toolId={toolId}
      />
    </CrudFormPage>
  );
}
