/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloudUploadOutlined } from "@ant-design/icons";

import { Alert, Form, Input, Modal, Radio, Select, Tabs, Upload } from "antd";

import type { UploadFile } from "antd/es/upload/interface";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";



import { useAppServices } from "@/framework/context/use-app-services";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";

import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";

import { importComponentFile } from "@/modules/execution-factory/services/impex.service";

import { registerOperator } from "@/modules/execution-factory/services/operator.service";
import type { OperatorCategory } from "@/modules/execution-factory/types/operator";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";

import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";

import {
  analyzeOpenApiDocumentText,
  extractOpenApiMetadataHints,
  normalizeGeneratedCapabilityName,
  normalizeOpenApiDocumentText,
  rewriteOpenApiServerUrl,
  validateOpenApiDocumentText,
} from "@/modules/execution-factory/utils/metadata-content";

import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";



import styles from "./create-menu.module.css";

type ImportKind = "openapi" | "adp";



type ImportResourceModalProps = {

  activeTab: ExecutionUnitTab;

  initialKind?: ImportKind;

  open: boolean;

  onClose: () => void;

  onSuccess?: () => void;

};



type OpenApiFormValues = {

  category: string;

  name?: string;

  serviceUrl?: string;

};



type AdpFormValues = {

  mode: ImpexImportMode;

};



function tabToImpexType(activeTab: ExecutionUnitTab): ImpexComponentType | null {

  if (activeTab === "operator" || activeTab === "toolbox" || activeTab === "mcp") {

    return activeTab;

  }



  return null;

}



function readUploadFile(fileList: UploadFile[]) {

  const uploadFile = fileList[0]?.originFileObj;

  return uploadFile ?? null;

}



export function ImportResourceModal({

  activeTab,

  initialKind,

  open,

  onClose,

  onSuccess,

}: ImportResourceModalProps) {

  const { t } = useTranslation();

  const { message } = useAppServices();

  const [openApiForm] = Form.useForm<OpenApiFormValues>();

  const [adpForm] = Form.useForm<AdpFormValues>();

  const [importKind, setImportKind] = useState<ImportKind>("openapi");

  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>(

    [],

  );

  const [openapiSpec, setOpenApiSpec] = useState("");

  const [adpFileList, setAdpFileList] = useState<UploadFile[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const [errorDetail, setErrorDetail] = useState<ReturnType<
    typeof extractRequestErrorDetail
  > | null>(null);
  const lastOpenApiAutofillKeyRef = useRef("");

  const impexType = tabToImpexType(activeTab);

  const supportsOpenApi = activeTab === "operator" || activeTab === "toolbox";

  const adpImportMode = Form.useWatch("mode", adpForm) ?? "create";
  const currentOpenApiName = Form.useWatch<OpenApiFormValues["name"]>("name", openApiForm);



  const importKindOptions = useMemo(

    () =>

      [

        supportsOpenApi

          ? { key: "openapi" as const, label: t("executionFactory.importKindOpenApi") }

          : null,

        { key: "adp" as const, label: t("executionFactory.importKindAdp") },

      ].filter(Boolean) as Array<{ key: ImportKind; label: string }>,

    [supportsOpenApi, t],

  );



  useEffect(() => {

    if (!open) {

      return;

    }



    void (async () => {

      const items = await listOperatorCategories();

      const options = items.map((item) => ({

        value: item.categoryType,

        label: item.name,

      }));

      setCategories(options);

      const defaultCategory = options[0]?.value ?? "other_category";

      openApiForm.setFieldsValue({
        category: defaultCategory,
        serviceUrl: "http://127.0.0.1:9000",
      });
      adpForm.setFieldsValue({ mode: "create" });
      setImportKind(initialKind ?? (supportsOpenApi ? "openapi" : "adp"));
      setOpenApiSpec("");
      setAdpFileList([]);
      setErrorDetail(null);
      lastOpenApiAutofillKeyRef.current = "";
    })();
  }, [adpForm, initialKind, open, openApiForm, supportsOpenApi]);

  useEffect(() => {
    if (!openapiSpec.trim()) {
      return;
    }

    const analysis = analyzeOpenApiDocumentText(openapiSpec);
    if (!analysis.ok) {
      return;
    }

    // One-shot autofill when the document content changes. Do not overwrite
    // subsequent manual edits to the form service URL.
    if (lastOpenApiAutofillKeyRef.current === openapiSpec) {
      return;
    }
    lastOpenApiAutofillKeyRef.current = openapiSpec;

    const hints = extractOpenApiMetadataHints(openapiSpec);
    const nextValues: Partial<OpenApiFormValues> = {};

    if (activeTab === "toolbox") {
      nextValues.name =
        normalizeGeneratedCapabilityName(hints.title) ||
        normalizeGeneratedCapabilityName(currentOpenApiName) ||
        currentOpenApiName;
    }

    // Always reset serviceUrl on document change so a prior absolute server
    // does not stick when the next document omits servers.
    nextValues.serviceUrl =
      analysis.serverUrl && /^https?:\/\//i.test(analysis.serverUrl)
        ? analysis.serverUrl
        : "http://127.0.0.1:9000";

    openApiForm.setFieldsValue(nextValues);
  }, [activeTab, currentOpenApiName, openApiForm, openapiSpec]);



  const handleSubmit = async () => {

    if (!impexType) {

      return;

    }



    setSubmitting(true);

    setErrorDetail(null);



    try {

      if (importKind === "openapi" && supportsOpenApi) {

        const values = await openApiForm.validateFields();



        if (!openapiSpec.trim()) {

          void message.info(t("executionFactory.importOpenApiFileRequired"));

          return;

        }



        const validation = validateOpenApiDocumentText(openapiSpec);

        if (!validation.ok) {
          void message.error(validation.reason);
          return;
        }

        const analysis = analyzeOpenApiDocumentText(openapiSpec);
        const docAbsoluteServerUrl =
          analysis.ok &&
          analysis.serverUrl?.trim() &&
          /^https?:\/\//i.test(analysis.serverUrl)
            ? analysis.serverUrl.trim()
            : undefined;

        const formServiceUrl = values.serviceUrl?.trim();
        // Operator tab has no visible Service URL field. Preserve absolute
        // servers from the document; only inject a form/default URL when missing.
        const serviceUrl =
          activeTab === "operator" && docAbsoluteServerUrl
            ? docAbsoluteServerUrl
            : formServiceUrl || "http://127.0.0.1:9000";

        if (!/^https?:\/\//i.test(serviceUrl)) {
          void message.error(
            docAbsoluteServerUrl
              ? t("executionFactory.importOpenApiServiceUrlRequired")
              : t("executionFactory.importOpenApiMissingServerManual"),
          );
          return;
        }

        const normalizedText = normalizeOpenApiDocumentText(openapiSpec);
        const normalizedOpenapiSpec =
          activeTab === "operator" && docAbsoluteServerUrl
            ? normalizedText
            : rewriteOpenApiServerUrl(normalizedText, serviceUrl);

        const hints = extractOpenApiMetadataHints(openapiSpec);

        const fallbackName =
          normalizeGeneratedCapabilityName(hints.title) || `import_${Date.now()}`;

        const resolvedName =
          normalizeGeneratedCapabilityName(values.name) || fallbackName;

        if (activeTab === "operator") {
          await registerOperator({
            metadataType: "openapi",
            name: resolvedName,
            openapiSpec: normalizedOpenapiSpec,
            category: values.category as OperatorCategory,
          });
        } else {
          await createToolbox({
            name: resolvedName,
            category: values.category,
            metadataType: "openapi",
            serviceUrl,
            openapiSpec: normalizedOpenapiSpec,
          });
        }

      } else {

        const values = await adpForm.validateFields();

        const uploadFile = readUploadFile(adpFileList);



        if (!uploadFile) {

          void message.info(t("executionFactory.importAdpFileRequired"));

          return;

        }



        await importComponentFile(impexType, uploadFile, values.mode);

      }



      void message.success(t("executionFactory.importSuccess"));

      onSuccess?.();

      onClose();

    } catch (caughtError) {

      setErrorDetail(extractRequestErrorDetail(caughtError));

    } finally {

      setSubmitting(false);

    }

  };



  if (!impexType) {

    return null;

  }



  return (

    <Modal

      confirmLoading={submitting}

      destroyOnClose

      okText={t("executionFactory.importConfirm")}

      onCancel={onClose}

      onOk={() => {

        void handleSubmit();

      }}

      open={open}

      title={t(`executionFactory.importResourceTitle.${activeTab}`)}

      width={760}

    >

      <Tabs

        activeKey={importKind}

        items={importKindOptions.map((item) => ({

          key: item.key,

          label: item.label,

          children:

            item.key === "openapi" ? (

              <Form form={openApiForm} layout="vertical">

                <CapabilityBusinessIntro

                  messageKey={`executionFactory.businessIntro.impexOpenApi${activeTab === "operator" ? "Operator" : "Toolbox"}`}

                />

                <Form.Item

                  label={t("executionFactory.category")}

                  name="category"

                  rules={[{ required: true, message: t("common.required") }]}

                >

                  <Select options={categories} />

                </Form.Item>

                {activeTab === "toolbox" ? (

                  <>

                    <Form.Item

                      label={t("executionFactory.toolboxName")}

                      name="name"

                      rules={[{ required: true, message: t("common.required") }]}

                    >

                      <Input />

                    </Form.Item>

                    <Form.Item

                      label={t("executionFactory.serviceUrl")}

                      name="serviceUrl"

                      rules={[{ required: true, message: t("common.required") }]}

                    >

                      <Input />

                    </Form.Item>

                  </>

                ) : null}

                <OpenApiSpecInput

                  onChange={setOpenApiSpec}

                  registrationTarget={activeTab === "toolbox" ? "toolbox" : "operator"}

                  rows={8}

                  showEndpointReview

                  value={openapiSpec}

                />

              </Form>

            ) : (

              <Form form={adpForm} layout="vertical">

                <CapabilityBusinessIntro

                  messageKey={`executionFactory.businessIntro.impexAdp${activeTab === "operator" ? "Operator" : activeTab === "mcp" ? "Mcp" : "Toolbox"}`}

                />

                <p className={styles.sectionIntro}>{t("executionFactory.importKindAdpHint")}</p>

                <Form.Item label={t("executionFactory.importMode")} name="mode">

                  <Radio.Group>

                    <Radio value="create">{t("executionFactory.importModeCreate")}</Radio>

                    <Radio value="upsert">{t("executionFactory.importModeUpsert")}</Radio>

                  </Radio.Group>

                </Form.Item>

                <p className={styles.sectionIntro}>

                  {t(

                    adpImportMode === "upsert"

                      ? "executionFactory.importModeUpsertHint"

                      : "executionFactory.importModeCreateHint",

                  )}

                </p>

                <Upload.Dragger

                  accept=".adp,.json"

                  beforeUpload={() => false}

                  className={styles.uploadDragger}

                  fileList={adpFileList}

                  maxCount={1}

                  onChange={({ fileList }) => setAdpFileList(fileList)}

                >

                  <p className="ant-upload-drag-icon">

                    <CloudUploadOutlined />

                  </p>

                  <p className="ant-upload-text">

                    {t("executionFactory.importAdpDraggerHint")}

                  </p>

                </Upload.Dragger>

              </Form>

            ),

        }))}

        onChange={(key) => setImportKind(key as ImportKind)}

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
    </Modal>
  );
}
