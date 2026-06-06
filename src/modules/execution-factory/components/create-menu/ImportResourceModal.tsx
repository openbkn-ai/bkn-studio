import { CloudUploadOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Radio, Select, Tabs, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import { importComponentFile } from "@/modules/execution-factory/services/impex.service";
import { registerOperator } from "@/modules/execution-factory/services/operator.service";
import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";
import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";

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
  const [openApiFileList, setOpenApiFileList] = useState<UploadFile[]>([]);
  const [adpFileList, setAdpFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const impexType = tabToImpexType(activeTab);
  const supportsOpenApi = activeTab === "operator" || activeTab === "toolbox";

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
      setOpenApiFileList([]);
      setAdpFileList([]);
      setError(null);
    })();
  }, [adpForm, open, openApiForm, supportsOpenApi]);

  const handleSubmit = async () => {
    if (!impexType) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (importKind === "openapi" && supportsOpenApi) {
        const values = await openApiForm.validateFields();
        const uploadFile = readUploadFile(openApiFileList);

        if (!uploadFile) {
          void message.info(t("executionFactory.importOpenApiFileRequired"));
          return;
        }

        const openapiSpec = await uploadFile.text();

        if (activeTab === "operator") {
          await registerOperator({
            metadataType: "openapi",
            openapiSpec,
            category: values.category,
          });
        } else {
          await createToolbox({
            name: values.name?.trim() || uploadFile.name.replace(/\.[^.]+$/, ""),
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
      setError(extractRequestErrorMessage(caughtError));
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
      width={640}
    >
      <Tabs
        activeKey={importKind}
        items={importKindOptions.map((item) => ({
          key: item.key,
          label: item.label,
          children:
            item.key === "openapi" ? (
              <Form form={openApiForm} layout="vertical">
                <p className={styles.modalHint}>
                  {t(`executionFactory.importOpenApiHint.${activeTab}`)}
                </p>
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
                <Upload.Dragger
                  accept=".json,.yaml,.yml"
                  beforeUpload={() => false}
                  className={styles.uploadDragger}
                  fileList={openApiFileList}
                  maxCount={1}
                  onChange={({ fileList }) => setOpenApiFileList(fileList)}
                >
                  <p className="ant-upload-drag-icon">
                    <CloudUploadOutlined />
                  </p>
                  <p className="ant-upload-text">
                    {t("executionFactory.importOpenApiDraggerHint")}
                  </p>
                </Upload.Dragger>
              </Form>
            ) : (
              <Form form={adpForm} layout="vertical">
                <p className={styles.modalHint}>
                  {t(`executionFactory.importAdpHint.${activeTab}`)}
                </p>
                <Form.Item label={t("executionFactory.importMode")} name="mode">
                  <Radio.Group>
                    <Radio value="create">{t("executionFactory.importModeCreate")}</Radio>
                    <Radio value="upsert">{t("executionFactory.importModeUpsert")}</Radio>
                  </Radio.Group>
                </Form.Item>
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
      {error ? <Alert message={error} showIcon style={{ marginTop: 12 }} type="error" /> : null}
    </Modal>
  );
}
