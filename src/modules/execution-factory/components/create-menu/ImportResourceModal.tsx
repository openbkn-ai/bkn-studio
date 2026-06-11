import { CloudUploadOutlined } from "@ant-design/icons";

import { Alert, Form, Input, Modal, Radio, Select, Tabs, Upload } from "antd";

import type { UploadFile } from "antd/es/upload/interface";

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";



import { useAppServices } from "@/framework/context/use-app-services";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";

import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";

import { importComponentFile } from "@/modules/execution-factory/services/impex.service";

import { registerOperator } from "@/modules/execution-factory/services/operator.service";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";

import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";

import {

  analyzeOpenApiDocumentText,

  extractOpenApiMetadataHints,

  validateOpenApiDocumentText,

} from "@/modules/execution-factory/utils/metadata-content";

import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";



import styles from "./create-menu.module.css";



type ImportResourceModalProps = {

  activeTab: ExecutionUnitTab;

  open: boolean;

  onClose: () => void;

  onSuccess?: () => void;

};



type ImportKind = "openapi" | "adp";



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



  const impexType = tabToImpexType(activeTab);

  const supportsOpenApi = activeTab === "operator" || activeTab === "toolbox";

  const adpImportMode = Form.useWatch("mode", adpForm) ?? "create";



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

      setImportKind(supportsOpenApi ? "openapi" : "adp");

      setOpenApiSpec("");

      setAdpFileList([]);

      setErrorDetail(null);

    })();

  }, [adpForm, open, openApiForm, supportsOpenApi]);



  useEffect(() => {

    if (!openapiSpec.trim() || activeTab !== "toolbox") {

      return;

    }



    const analysis = analyzeOpenApiDocumentText(openapiSpec);

    if (!analysis.ok) {

      return;

    }



    const hints = extractOpenApiMetadataHints(openapiSpec);

    openApiForm.setFieldsValue({

      name: hints.title?.trim() || openApiForm.getFieldValue("name"),

      serviceUrl: analysis.serverUrl ?? openApiForm.getFieldValue("serviceUrl"),

    });

  }, [activeTab, openApiForm, openapiSpec]);



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



        const hints = extractOpenApiMetadataHints(openapiSpec);

        const fallbackName = hints.title?.trim() || `import_${Date.now()}`;



        if (activeTab === "operator") {

          await registerOperator({

            metadataType: "openapi",

            name: fallbackName,

            openapiSpec,

            category: values.category,

          });

        } else {

          await createToolbox({

            name: values.name?.trim() || fallbackName,

            category: values.category,

            metadataType: "openapi",

            serviceUrl: values.serviceUrl ?? "http://127.0.0.1:9000",

            openapiSpec,

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
