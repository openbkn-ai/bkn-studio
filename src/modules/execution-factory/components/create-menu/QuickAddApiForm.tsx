import { Alert, Form, Input, Radio, Select, Tabs } from "antd";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OpenApiOperationsIoPreview } from "@/modules/execution-factory/components/OpenApiOperationsIoPreview";
import { analyzeOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import {
  buildOpenApiFromQuickApi,
  parseCurlCommand,
  parseQuickApiUrl,
  type QuickApiParameter,
} from "@/modules/execution-factory/utils/curl-to-openapi";
import {
  CapabilityBusinessIntro,
  ToolboxPlacementIntro,
} from "@/modules/execution-factory/components/CapabilityBusinessIntro";
import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";
import { OperatorSyncPublishFields } from "@/modules/execution-factory/components/OperatorSyncPublishFields";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import styles from "./create-menu.module.css";

export type QuickAddApiFormValues = {
  curlText?: string;
  apiUrl?: string;
  method: string;
  serverUrl: string;
  path: string;
  summary: string;
  description?: string;
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

export type QuickAddApiFormHandle = {
  submit: () => void;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const QuickAddApiForm = forwardRef<QuickAddApiFormHandle, QuickAddApiFormProps>(
  function QuickAddApiForm({ formId, initialBoxId, onSubmit }, ref) {
  const { t } = useTranslation();
  const [form] = Form.useForm<QuickAddApiFormValues>();
  useImperativeHandle(ref, () => ({
    submit: () => {
      form.submit();
    },
  }));
  const [inputMode, setInputMode] = useState<"curl" | "form">("curl");
  const [parseHint, setParseHint] = useState<string | null>(null);
  const [toolboxOptions, setToolboxOptions] = useState<Array<{ label: string; value: string }>>([]);
  const toolboxMode = Form.useWatch("toolboxMode", form) ?? (initialBoxId ? "existing" : "new");
  const summary = Form.useWatch("summary", form) as string | undefined;
  const watchedValues = Form.useWatch([], form) as QuickAddApiFormValues | undefined;

  const previewSpec = useMemo(() => {
    if (!watchedValues) {
      return undefined;
    }

    return buildSpecFromValues(watchedValues, inputMode);
  }, [inputMode, watchedValues]);

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

  const applyParsedApi = (parsed: {
    method: string;
    serverUrl: string;
    path: string;
    summary: string;
    queryParams: QuickApiParameter[];
  }) => {
    form.setFieldsValue({
      method: parsed.method,
      serverUrl: parsed.serverUrl,
      path: parsed.path,
      summary: parsed.summary,
    });
    setParseHint(
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
      return;
    }

    applyParsedApi(result.value);
  };

  const handleParseUrl = () => {
    const apiUrl = form.getFieldValue("apiUrl") as string | undefined;
    const result = parseQuickApiUrl(apiUrl ?? "");
    if (!result.ok) {
      setParseHint(result.reason);
      return;
    }

    applyParsedApi(result.value);
  };

  const handleFinish = (values: QuickAddApiFormValues) => {
    if (inputMode === "form") {
      if (!values.serverUrl?.trim() || !values.path?.trim() || !values.method?.trim()) {
        setParseHint(t("executionFactory.quickApiBuildFailed"));
        return;
      }
    }

    const spec = buildSpecFromValues(values, inputMode);
    if (!spec) {
      setParseHint(t("executionFactory.quickApiBuildFailed"));
      return;
    }

    const validation = analyzeOpenApiDocumentText(spec);
    if (!validation.ok) {
      setParseHint(validation.reason);
      return;
    }

    onSubmit({
      openapiSpec: spec,
      serviceUrl: values.serverUrl,
      values,
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
                <button className={styles.inlineAction} onClick={handleParseUrl} type="button">
                  {t("executionFactory.quickApiParseAction")}
                </button>
                <Form.Item label={t("executionFactory.quickApiServerUrl")} name="serverUrl">
                  <Input />
                </Form.Item>
                <Form.Item label={t("executionFactory.quickApiMethod")} name="method">
                  <Select options={HTTP_METHODS.map((value) => ({ label: value, value }))} />
                </Form.Item>
                <Form.Item label={t("executionFactory.quickApiPath")} name="path">
                  <Input />
                </Form.Item>
              </>
            ),
          },
        ]}
        onChange={(key) => setInputMode(key as "curl" | "form")}
      />

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
        <Alert message={parseHint} showIcon style={{ marginBottom: 16 }} type="info" />
      ) : null}

      {previewValidation.ok && previewSpec ? (
        <div style={{ marginBottom: 16 }}>
          <Alert
            message={t("executionFactory.quickApiIoPreviewTitle")}
            showIcon
            style={{ marginBottom: 8 }}
            type="success"
          />
          <OpenApiOperationsIoPreview limit={1} openapiSpec={previewSpec} />
        </div>
      ) : null}

      <OperatorSyncPublishFields defaultOperatorName={summary} />

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
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select options={toolboxOptions} showSearch optionFilterProp="label" />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                label={t("executionFactory.toolboxName")}
                name="toolboxName"
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("common.description")} name="toolboxDescription">
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

function buildSpecFromValues(values: QuickAddApiFormValues, inputMode: "curl" | "form") {
  if (inputMode === "curl" && values.curlText?.trim()) {
    const parsed = parseCurlCommand(values.curlText);
    if (parsed.ok) {
      return buildOpenApiFromQuickApi({
        ...parsed.value,
        summary: values.summary || parsed.value.summary,
        description: values.description,
        queryParams: parsed.value.queryParams,
      });
    }
  }

  if (!values.serverUrl || !values.path || !values.summary) {
    return undefined;
  }

  let queryParams: QuickApiParameter[] = [];

  if (values.apiUrl?.trim()) {
    const parsed = parseQuickApiUrl(values.apiUrl);
    if (parsed.ok) {
      queryParams = parsed.value.queryParams;
    }
  }

  return buildOpenApiFromQuickApi({
    method: values.method || "GET",
    serverUrl: values.serverUrl,
    path: values.path,
    summary: values.summary,
    description: values.description,
    queryParams,
  });
}
