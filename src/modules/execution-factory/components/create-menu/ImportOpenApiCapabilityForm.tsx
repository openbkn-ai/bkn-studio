/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Radio, Select } from "antd";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";



import {

  CapabilityBusinessIntro,

  ToolboxPlacementIntro,

} from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";

import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";

import { OperatorSyncPublishFields } from "@/modules/execution-factory/components/OperatorSyncPublishFields";

import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";

import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import {

  analyzeOpenApiDocumentText,

  extractOpenApiMetadataHints,

} from "@/modules/execution-factory/utils/metadata-content";



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



export const ImportOpenApiCapabilityForm = forwardRef<

  ImportOpenApiCapabilityFormHandle,

  ImportOpenApiCapabilityFormProps

>(function ImportOpenApiCapabilityForm({ formId, initialBoxId, onSubmit }, ref) {

  const { t } = useTranslation();

  const [form] = Form.useForm<ImportOpenApiCapabilityFormValues>();

  const [openapiSpec, setOpenApiSpec] = useState("");

  const [parseHint, setParseHint] = useState<string | null>(null);

  const [toolboxOptions, setToolboxOptions] = useState<Array<{ label: string; value: string }>>([]);

  const toolboxMode = Form.useWatch("toolboxMode", form) ?? (initialBoxId ? "existing" : "new");

  const toolboxName = Form.useWatch("toolboxName", form) as string | undefined;



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



  useEffect(() => {

    if (!openapiSpec.trim()) {

      setParseHint(null);

      return;

    }



    if (analysis.ok) {

      setParseHint(

        t("executionFactory.importOpenApiCapabilityParsed", { count: analysis.operationCount }),

      );



      if (!initialBoxId) {

        const hints = extractOpenApiMetadataHints(openapiSpec);

        form.setFieldsValue({

          toolboxName: hints.title?.trim() || form.getFieldValue("toolboxName"),

          toolboxDescription: hints.description ?? form.getFieldValue("toolboxDescription"),

          serviceUrl: analysis.serverUrl ?? form.getFieldValue("serviceUrl"),

        });

      }

      return;

    }



    setParseHint(t("executionFactory.importOpenApiCapabilityFileReady"));

  }, [analysis, form, initialBoxId, openapiSpec, t]);



  const handleFinish = (values: ImportOpenApiCapabilityFormValues) => {

    if (!openapiSpec.trim()) {

      setParseHint(t("executionFactory.importOpenApiFileRequired"));

      return;

    }



    onSubmit({ openapiSpec, values });

  };



  return (

    <Form form={form} id={formId} layout="vertical" onFinish={handleFinish}>

      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.importOpenApiTop" />

      <OpenApiSpecInput

        onChange={setOpenApiSpec}

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



      <OperatorSyncPublishFields defaultOperatorName={toolboxName} />



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

              <Form.Item label={t("executionFactory.serviceUrl")} name="serviceUrl">

                <Input placeholder="https://api.example.com" />

              </Form.Item>

              <CapabilityCategoryFields />

            </>

          )}

        </>

      ) : null}

    </Form>

  );

});
