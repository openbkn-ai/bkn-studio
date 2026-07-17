/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Radio, Select } from "antd";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CapabilityBusinessIntro,
  ToolboxPlacementIntro,
} from "@/modules/execution-factory/components/CapabilityBusinessIntro";
import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";
import {
  analyzeOpenApiDocumentText,
  extractOpenApiMetadataHints,
  normalizeGeneratedCapabilityName,
  normalizeGeneratedToolboxDescription,
  resolveOpenApiServiceUrl,
  type OpenApiSpecSource,
} from "@/modules/execution-factory/utils/metadata-content";

import styles from "./create-menu.module.css";

export type ImportOpenApiCapabilityFormValues = {
  toolboxMode: "existing" | "new";
  boxId?: string;
  toolboxName?: string;
  toolboxDescription?: string;
  serviceUrl?: string;
  useRule?: string;
  category?: string;
  operatorSync?: OperatorSyncPublishInput;
};

type ImportOpenApiCapabilityFormProps = {
  formId: string;
  initialBoxId?: string;
  onSubmit: (payload: { openapiSpec: string; values: ImportOpenApiCapabilityFormValues }) => void;
};

export type ImportOpenApiCapabilityFormHandle = {
  submit: () => void;
};

function buildOpenApiAutofillKey(openapiSpec: string, openapiSource: OpenApiSpecSource): string {
  if (openapiSource.kind === "url") {
    return `${openapiSpec}\n#source:url:${openapiSource.url}`;
  }
  if (openapiSource.kind === "file") {
    return `${openapiSpec}\n#source:file:${openapiSource.fileName ?? ""}`;
  }
  return `${openapiSpec}\n#source:paste`;
}

export const ImportOpenApiCapabilityForm = forwardRef<
  ImportOpenApiCapabilityFormHandle,
  ImportOpenApiCapabilityFormProps
>(function ImportOpenApiCapabilityForm({ formId, initialBoxId, onSubmit }, ref) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ImportOpenApiCapabilityFormValues>();
  const [openapiSpec, setOpenApiSpec] = useState("");
  const [openapiSource, setOpenApiSource] = useState<OpenApiSpecSource>({ kind: "paste" });
  const [parseHint, setParseHint] = useState<string | null>(null);
  const [toolboxOptions, setToolboxOptions] = useState<Array<{ label: string; value: string }>>([]);
  const lastAutofillKeyRef = useRef<string>("");

  const toolboxMode = Form.useWatch("toolboxMode", form) ?? (initialBoxId ? "existing" : "new");

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.submit();
    },
  }));

  useEffect(() => {
    form.setFieldsValue({
      toolboxMode: initialBoxId ? "existing" : "new",
      boxId: initialBoxId,
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

  const analysis = useMemo(() => analyzeOpenApiDocumentText(openapiSpec), [openapiSpec]);
  const resolvedServiceUrl = useMemo(
    () => (analysis.ok ? resolveOpenApiServiceUrl(openapiSpec, openapiSource) : undefined),
    [analysis, openapiSource, openapiSpec],
  );

  useEffect(() => {
    if (!openapiSpec.trim()) {
      setParseHint(null);
      lastAutofillKeyRef.current = "";
      return;
    }

    if (!analysis.ok) {
      setParseHint(t("executionFactory.importOpenApiCapabilityFileReady"));
      return;
    }

    const nextParseHint =
      resolvedServiceUrl?.ok && resolvedServiceUrl.source === "resolved-relative"
        ? t("executionFactory.importOpenApiRelativeServerResolved", {
            relativeUrl: analysis.serverUrl,
            serviceUrl: resolvedServiceUrl.url,
          })
        : resolvedServiceUrl && !resolvedServiceUrl.ok && resolvedServiceUrl.relativeUrl
          ? t("executionFactory.importOpenApiRelativeServerManual", {
              relativeUrl: resolvedServiceUrl.relativeUrl,
            })
          : t("executionFactory.importOpenApiCapabilityParsed", {
              count: analysis.operationCount,
            });

    setParseHint(nextParseHint);

    const autofillKey = buildOpenApiAutofillKey(openapiSpec, openapiSource);
    const documentChanged = lastAutofillKeyRef.current !== autofillKey;
    if (!documentChanged) {
      return;
    }

    lastAutofillKeyRef.current = autofillKey;

    const nextServiceUrl = resolvedServiceUrl?.ok
      ? resolvedServiceUrl.url
      : analysis.serverUrl;

    const nextValues: Partial<ImportOpenApiCapabilityFormValues> = {};
    if (nextServiceUrl) {
      nextValues.serviceUrl = nextServiceUrl;
    }

    if (!initialBoxId && toolboxMode === "new") {
      const hints = extractOpenApiMetadataHints(openapiSpec);
      const nextToolboxName = normalizeGeneratedCapabilityName(hints.title);
      const nextToolboxDescription = normalizeGeneratedToolboxDescription(hints.description);
      if (nextToolboxName) {
        nextValues.toolboxName = nextToolboxName;
      }
      if (nextToolboxDescription) {
        nextValues.toolboxDescription = nextToolboxDescription;
      }
    }

    if (Object.keys(nextValues).length > 0) {
      form.setFieldsValue(nextValues);
    }

    if (resolvedServiceUrl?.ok) {
      form.setFields([{ name: "serviceUrl", errors: [] }]);
    }
  }, [
    analysis,
    form,
    initialBoxId,
    openapiSource,
    openapiSpec,
    resolvedServiceUrl,
    t,
    toolboxMode,
  ]);

  const handleFinish = (values: ImportOpenApiCapabilityFormValues) => {
    if (!openapiSpec.trim()) {
      setParseHint(t("executionFactory.importOpenApiFileRequired"));
      return;
    }

    const serviceUrl = values.serviceUrl?.trim();
    if (!serviceUrl || !/^https?:\/\//i.test(serviceUrl)) {
      const message =
        resolvedServiceUrl && !resolvedServiceUrl.ok && resolvedServiceUrl.relativeUrl
          ? t("executionFactory.importOpenApiRelativeServerManual", {
              relativeUrl: resolvedServiceUrl.relativeUrl,
            })
          : t("executionFactory.importOpenApiServiceUrlRequired");
      form.setFields([{ name: "serviceUrl", errors: [message] }]);
      form.scrollToField("serviceUrl", { behavior: "smooth", focus: true });
      setParseHint(message);
      return;
    }

    const targetValues =
      values.toolboxMode === "existing"
        ? {
            ...values,
            toolboxName: undefined,
            toolboxDescription: undefined,
          }
        : {
            ...values,
            boxId: undefined,
          };

    onSubmit({ openapiSpec, values: { ...targetValues, serviceUrl } });
  };

  return (
    <Form form={form} id={formId} layout="vertical" onFinish={handleFinish}>
      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.importOpenApiTop" />

      <OpenApiSpecInput
        onChange={(value, source) => {
          setOpenApiSpec(value);
          if (source) {
            setOpenApiSource(source);
          }
        }}
        registrationTarget="toolbox"
        rows={8}
        showEndpointReview
        value={openapiSpec}
      />

      {parseHint ? (
        <Alert message={parseHint} showIcon style={{ margin: "12px 0" }} type="info" />
      ) : null}

      {analysis.ok ? (
        <Alert
          className={styles.interfaceSuccessAlert}
          message={t("executionFactory.importOpenApiCapabilityPreview", {
            version: analysis.openApiVersion,
            count: analysis.operationCount,
          })}
          showIcon
          style={{ marginBottom: 16 }}
          type="success"
        />
      ) : null}

      <Form.Item label={t("executionFactory.useRule")} name="useRule">
        <Input.TextArea rows={2} />
      </Form.Item>

      <Form.Item label={t("executionFactory.serviceUrl")} name="serviceUrl">
        <Input placeholder="https://api.example.com" />
      </Form.Item>

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
});
