/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Radio, Select, Tabs } from "antd";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OpenApiOperationsIoPreview } from "@/modules/execution-factory/components/OpenApiOperationsIoPreview";
import { analyzeOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import {
  parseCurlCommand,
  parseQuickApiUrl,
  type QuickApiParameter,
  type QuickApiRequestBody,
} from "@/modules/execution-factory/utils/curl-to-openapi";
import {
  buildEffectiveQuickApiValues,
  buildQuickApiSubmissionFromValues,
  mergeQuickApiParameters,
  resolveQuickApiFormContract,
  type QuickApiContractFormValues,
} from "@/modules/execution-factory/utils/quick-api-contract";
import {
  CapabilityBusinessIntro,
  ToolboxPlacementIntro,
} from "@/modules/execution-factory/components/CapabilityBusinessIntro";
import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import { QuickApiContractEditor } from "./QuickApiContractEditor";
import styles from "./create-menu.module.css";

export type QuickAddApiFormValues = QuickApiContractFormValues & {
  curlText?: string;
  apiUrl?: string;
  toolboxMode: "existing" | "new";
  boxId?: string;
  toolboxName?: string;
  toolboxDescription?: string;
  category?: string;
  operatorSync?: OperatorSyncPublishInput;
};

type QuickAddApiFormProps = {
  formId: string;
  initialBoxId?: string;
  onSubmit: (payload: { openapiSpec: string; serviceUrl: string; values: QuickAddApiFormValues }) => void;
};

type QuickAddApiSubmitErrorField = "curlText" | "serverUrl" | "apiUrl" | "summary" | "toolboxName";

export type QuickAddApiFormHandle = {
  submit: () => void;
  showSubmitError: (error: { field?: QuickAddApiSubmitErrorField; message: string }) => void;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function formatJsonValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function buildCurlContract(parsed: {
  method: string;
  serverUrl: string;
  path: string;
  summary: string;
  queryParams: QuickApiParameter[];
  requestBody?: QuickApiRequestBody;
}): Partial<QuickApiContractFormValues> {
  return {
    method: parsed.method,
    serverUrl: parsed.serverUrl,
    path: parsed.path,
    summary: parsed.summary,
    parameters: parsed.queryParams,
    requestBodyEnabled: Boolean(parsed.requestBody),
    requestBodyContentType: parsed.requestBody?.contentType ?? "application/json",
    requestBodyRequired: parsed.requestBody?.required ?? true,
    requestBodySchemaText: formatJsonValue(parsed.requestBody?.schema),
    requestBodyExampleText:
      parsed.requestBody?.example !== undefined
        ? JSON.stringify(parsed.requestBody.example, null, 2)
        : parsed.requestBody?.raw,
  };
}

export const QuickAddApiForm = forwardRef<QuickAddApiFormHandle, QuickAddApiFormProps>(
  function QuickAddApiForm({ formId, initialBoxId, onSubmit }, ref) {
  const { t } = useTranslation();
  const [form] = Form.useForm<QuickAddApiFormValues>();
  useImperativeHandle(ref, () => ({
    submit: () => {
      form.submit();
    },
    showSubmitError: ({ field, message }) => {
      const targetField = field ?? (inputMode === "curl" ? "curlText" : "serverUrl");
      setInputMode(targetField === "curlText" ? "curl" : "form");
      setParseHint(message);
      form.setFields([{ name: targetField, errors: [message] }]);
      window.setTimeout(() => {
        form.scrollToField(targetField, { behavior: "smooth", focus: true });
      });
    },
  }));
  const [inputMode, setInputMode] = useState<"curl" | "form">("curl");
  const [parseHint, setParseHintState] = useState<{ text: string; tone: "info" | "error" } | null>(
    null,
  );
  const setParseHint = (text: string) => setParseHintState({ text, tone: "error" });
  const setParseOkHint = (text: string) => setParseHintState({ text, tone: "info" });
  const [detectedUrlParameters, setDetectedUrlParameters] = useState<QuickApiParameter[]>([]);
  const [detectedCurlContract, setDetectedCurlContract] = useState<
    Partial<QuickApiContractFormValues> | undefined
  >();
  const [toolboxOptions, setToolboxOptions] = useState<Array<{ label: string; value: string }>>([]);
  const toolboxMode = Form.useWatch("toolboxMode", form) ?? (initialBoxId ? "existing" : "new");
  const watchedValues = Form.useWatch([], form) as QuickAddApiFormValues | undefined;

  const previewSpec = useMemo(() => {
    if (!watchedValues) {
      return undefined;
    }

    const contractValues =
      inputMode === "form" ? resolveQuickApiFormContract(watchedValues) : watchedValues;

    return buildSpecFromValues(
      buildEffectiveQuickApiValues(
        contractValues,
        inputMode,
        detectedUrlParameters,
        detectedCurlContract,
      ),
    );
  }, [detectedCurlContract, detectedUrlParameters, inputMode, watchedValues]);

  const previewValidation = useMemo(
    () => (previewSpec ? analyzeOpenApiDocumentText(previewSpec) : { ok: false as const, reason: "" }),
    [previewSpec],
  );

  useEffect(() => {
    form.setFieldsValue({
      method: "GET",
      toolboxMode: initialBoxId ? "existing" : "new",
      boxId: initialBoxId,
      category: "other_category",
      requestBodyEnabled: false,
      requestBodyContentType: "application/json",
      requestBodyRequired: true,
      responses: [
        {
          statusCode: "200",
          description: "OK",
          contentType: "application/json",
          schemaText: '{\n  "type": "object"\n}',
        },
      ],
    });
  }, [form, initialBoxId]);

  useEffect(() => {
    void (async () => {
      const result = await listToolboxes({ page: 1, pageSize: 100 });
      setToolboxOptions(
        result.items.map((item) => ({
          label: item.name,
          value: item.boxId,
        })),
      );
    })();
  }, []);

  const applyParsedApi = (
    parsed: {
      method: string;
      serverUrl: string;
      path: string;
      summary: string;
      queryParams: QuickApiParameter[];
      requestBody?: QuickApiRequestBody;
    },
    options?: { preserveManualContract?: boolean },
  ) => {
    const preserveManualContract = options?.preserveManualContract === true;
    setDetectedUrlParameters(preserveManualContract ? parsed.queryParams : []);
    setDetectedCurlContract(preserveManualContract ? undefined : buildCurlContract(parsed));

    form.setFieldsValue({
      method: preserveManualContract
        ? ((form.getFieldValue("method") as string | undefined) ?? parsed.method)
        : parsed.method,
      serverUrl: parsed.serverUrl,
      path: parsed.path,
      summary: parsed.summary,
    });
    setParseOkHint(
      parsed.queryParams.length > 0
        ? t("executionFactory.quickApiParsedParams", { count: parsed.queryParams.length })
        : t("executionFactory.quickApiParsedOk"),
    );
  };

  const handleParseCurl = () => {
    const curlText = form.getFieldValue("curlText") as string | undefined;
    const result = parseCurlCommand(curlText ?? "");
    if (!result.ok) {
      setParseHint(result.reason);
      form.setFields([{ name: "curlText", errors: [result.reason] }]);
      return;
    }

    form.setFields([{ name: "curlText", errors: [] }]);
    applyParsedApi(result.value);
  };

  const handleParseUrl = () => {
    const apiUrl = form.getFieldValue("apiUrl") as string | undefined;
    const result = parseQuickApiUrl(apiUrl ?? "");
    if (!result.ok) {
      setParseHint(result.reason);
      form.setFields([{ name: "apiUrl", errors: [result.reason] }]);
      return;
    }

    form.setFields([{ name: "apiUrl", errors: [] }]);
    const currentParams = (form.getFieldValue("parameters") ?? []) as QuickApiParameter[];
    const mergedParams = mergeQuickApiParameters(result.value.queryParams, currentParams);
    applyParsedApi(result.value, { preserveManualContract: true });
    setDetectedUrlParameters([]);
    form.setFieldsValue({ parameters: mergedParams });
  };

  const handleFinish = (values: QuickAddApiFormValues) => {
    const resolvedValues =
      inputMode === "form" ? resolveQuickApiFormContract(values) : values;

    // cURL 模式下「识别接口信息」是可选动作，用户常直接提交。此时没有已识别的
    // 契约，缺的是解析而不是输入，所以在提交时补一次解析并回报真实原因。
    let curlContract = detectedCurlContract;
    if (inputMode === "curl" && !curlContract) {
      const parsed = parseCurlCommand(values.curlText ?? "");
      if (!parsed.ok) {
        setParseHint(parsed.reason);
        form.setFields([{ name: "curlText", errors: [parsed.reason] }]);
        form.scrollToField("curlText", { behavior: "smooth", focus: true });
        return;
      }
      curlContract = buildCurlContract(parsed.value);
      form.setFields([{ name: "curlText", errors: [] }]);
      setDetectedCurlContract(curlContract);
    }

    if (inputMode === "form") {
      if (
        !resolvedValues.serverUrl?.trim() ||
        !resolvedValues.path?.trim() ||
        !resolvedValues.method?.trim()
      ) {
        setParseHint(t("executionFactory.quickApiBuildFailed"));
        return;
      }
    }

    const submission = buildQuickApiSubmissionFromValues(
      buildEffectiveQuickApiValues(
        resolvedValues,
        inputMode,
        detectedUrlParameters,
        curlContract,
      ),
    );
    if (!submission) {
      setParseHint(t("executionFactory.quickApiBuildFailed"));
      return;
    }

    const validation = analyzeOpenApiDocumentText(submission.openapiSpec);
    if (!validation.ok) {
      setParseHint(validation.reason);
      return;
    }

    const targetValues =
      resolvedValues.toolboxMode === "existing"
        ? {
            ...resolvedValues,
            toolboxName: undefined,
            toolboxDescription: undefined,
          }
        : {
            ...resolvedValues,
            boxId: undefined,
          };

    onSubmit({
      openapiSpec: submission.openapiSpec,
      serviceUrl: submission.serviceUrl,
      values: {
        ...targetValues,
        serverUrl: submission.serviceUrl,
        method: submission.method,
        path: submission.path,
      },
    });
  };

  return (
    <Form form={form} id={formId} layout="vertical" onFinish={handleFinish}>
      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.quickApiTop" />
      <Tabs
        activeKey={inputMode}
        destroyInactiveTabPane
        items={[
          {
            key: "curl",
            label: t("executionFactory.quickApiTabCurl"),
            children: (
              <>
                <CapabilityBusinessIntro
                  messageKey="executionFactory.businessIntro.quickApiInputCurl"
                  variant="section"
                />
                <Form.Item label={t("executionFactory.quickApiCurlLabel")} name="curlText">
                  <Input.TextArea
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    placeholder={t("executionFactory.quickApiCurlPlaceholder")}
                  />
                </Form.Item>
                <button className={styles.inlineAction} onClick={handleParseCurl} type="button">
                  {t("executionFactory.quickApiParseAction")}
                </button>
              </>
            ),
          },
          {
            key: "form",
            label: t("executionFactory.quickApiTabForm"),
            children: (
              <>
                <CapabilityBusinessIntro
                  messageKey="executionFactory.businessIntro.quickApiInputForm"
                  variant="section"
                />
                <Form.Item label={t("executionFactory.quickApiUrlLabel")} name="apiUrl">
                  <Input placeholder="https://example.com/api/v1/resource" />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.quickApiMethod")}
                  name="method"
                  rules={[{ required: true, message: t("common.required") }]}
                >
                  <Select options={HTTP_METHODS.map((value) => ({ label: value, value }))} />
                </Form.Item>
                <QuickApiContractEditor />
                <button className={styles.inlineAction} onClick={handleParseUrl} type="button">
                  {t("executionFactory.quickApiParseAction")}
                </button>
              </>
            ),
          },
        ]}
        onChange={(key) => setInputMode(key as "curl" | "form")}
      />

      <Form.Item hidden name="serverUrl">
        <Input />
      </Form.Item>
      <Form.Item hidden name="path">
        <Input />
      </Form.Item>

      <CapabilityBusinessIntro
        messageKey="executionFactory.businessIntro.toolMetadataSection"
        variant="section"
      />

      <Form.Item
        label={t("executionFactory.quickApiSummary")}
        name="summary"
        rules={[{ required: true, message: t("common.required") }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label={t("common.description")} name="description">
        <Input.TextArea rows={2} />
      </Form.Item>

      {parseHint ? (
        <Alert message={parseHint.text} showIcon style={{ marginBottom: 16 }} type={parseHint.tone} />
      ) : null}

      {previewValidation.ok && previewSpec ? (
        <div style={{ marginBottom: 16 }}>
          <Alert
            className={styles.interfaceSuccessAlert}
            message={t("executionFactory.quickApiIoPreviewTitle")}
            showIcon
            style={{ marginBottom: 8 }}
            type="success"
          />
          <OpenApiOperationsIoPreview limit={1} openapiSpec={previewSpec} />
        </div>
      ) : null}

      {!initialBoxId ? (
        <>
          <CapabilityBusinessIntro
            messageKey="executionFactory.businessIntro.toolboxPlacementSection"
            variant="section"
          />
          <Form.Item label={t("executionFactory.quickApiToolboxTarget")} name="toolboxMode">
            <Radio.Group>
              <Radio value="existing">{t("executionFactory.quickApiToolboxExisting")}</Radio>
              <Radio value="new">{t("executionFactory.quickApiToolboxNew")}</Radio>
            </Radio.Group>
          </Form.Item>
          <ToolboxPlacementIntro mode={toolboxMode} />
          {toolboxMode === "existing" ? (
            <Form.Item
              label={t("executionFactory.toolboxName")}
              name="boxId"
              preserve={false}
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select options={toolboxOptions} showSearch optionFilterProp="label" />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                label={t("executionFactory.toolboxName")}
                name="toolboxName"
                preserve={false}
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label={t("common.description")}
                name="toolboxDescription"
                preserve={false}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <CapabilityCategoryFields />
            </>
          )}
        </>
      ) : null}
    </Form>
  );
},
);

function buildSpecFromValues(values: QuickAddApiFormValues) {
  return buildQuickApiSubmissionFromValues(values)?.openapiSpec;
}
