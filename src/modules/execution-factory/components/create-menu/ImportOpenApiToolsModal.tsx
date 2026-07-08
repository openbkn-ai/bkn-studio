/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal } from "antd";

import { useState } from "react";

import { useTranslation } from "react-i18next";



import { useAppServices } from "@/framework/context/use-app-services";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";

import { importOpenApiTools } from "@/modules/execution-factory/services/tool.service";

import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";



type ImportOpenApiToolsModalProps = {

  boxId: string;

  open: boolean;

  onClose: () => void;

  onSuccess: () => void;

};



type FormValues = {

  useRule?: string;

};



export function ImportOpenApiToolsModal({

  boxId,

  open,

  onClose,

  onSuccess,

}: ImportOpenApiToolsModalProps) {

  const { t } = useTranslation();

  const { message } = useAppServices();

  const [form] = Form.useForm<FormValues>();

  const [openapiSpec, setOpenApiSpec] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [errorDetail, setErrorDetail] = useState<ReturnType<

    typeof extractRequestErrorDetail

  > | null>(null);

  const [importFailures, setImportFailures] = useState<

    Array<{ toolName?: string; error?: string }>

  >([]);



  const handleSubmit = async () => {

    if (!openapiSpec.trim()) {

      void message.info(t("executionFactory.importOpenApiFileRequired"));

      return;

    }



    const validation = validateOpenApiDocumentText(openapiSpec);

    if (!validation.ok) {

      void message.error(validation.reason);

      return;

    }



    setSubmitting(true);

    setErrorDetail(null);

    setImportFailures([]);



    try {

      const values = await form.validateFields();

      const result = await importOpenApiTools(boxId, openapiSpec, values.useRule);



      if (result.failureCount > 0) {

        setImportFailures(result.failures);

      }



      if (result.successCount > 0) {

        void message.success(

          t("executionFactory.importOpenApiToolsSuccess", {

            count: result.successCount,

          }),

        );

        onSuccess();

        if (result.failureCount === 0) {

          onClose();

        }

        return;

      }



      void message.error(t("executionFactory.importOpenApiToolsAllFailed"));

    } catch (error) {

      setErrorDetail(extractRequestErrorDetail(error));

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <Modal

      confirmLoading={submitting}

      destroyOnClose

      okText={t("executionFactory.importConfirm")}

      onCancel={onClose}

      onOk={() => void handleSubmit()}

      open={open}

      title={t("executionFactory.importOpenApiToolsTitle")}

      width={760}

    >

      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.importOpenApiToolsTop" />

      <Form form={form} layout="vertical">

        <Form.Item label={t("executionFactory.useRule")} name="useRule">

          <Input.TextArea rows={2} />

        </Form.Item>

      </Form>

      <OpenApiSpecInput

        onChange={setOpenApiSpec}

        registrationTarget="toolbox"

        rows={8}

        showEndpointReview

        value={openapiSpec}

      />

      {errorDetail ? (

        <Alert

          description={

            <div>

              {errorDetail.code ? <div>{errorDetail.code}</div> : null}

              {errorDetail.detail ? (

                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>

                  {JSON.stringify(errorDetail.detail, null, 2)}

                </pre>

              ) : null}

              {errorDetail.solution ? <div>{errorDetail.solution}</div> : null}

            </div>

          }

          message={errorDetail.message}

          showIcon

          style={{ marginTop: 12 }}

          type="error"

        />

      ) : null}

      {importFailures.length > 0 ? (

        <Alert

          description={

            <ul style={{ margin: 0, paddingLeft: 20 }}>

              {importFailures.map((item) => (

                <li key={`${item.toolName}-${item.error}`}>

                  {item.toolName ?? t("executionFactory.unknownTool")}: {item.error}

                </li>

              ))}

            </ul>

          }

          message={t("executionFactory.importPartialFailureTitle")}

          showIcon

          style={{ marginTop: 12 }}

          type="warning"

        />
      ) : null}
    </Modal>
  );
}
