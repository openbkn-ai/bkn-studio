import { CloudUploadOutlined, DownloadOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { OPENAPI_TOOLBOX_TEMPLATE } from "@/modules/execution-factory/constants/import-templates";
import { importOpenApiTools } from "@/modules/execution-factory/services/tool.service";
import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";
import { triggerBrowserDownload } from "@/modules/execution-factory/utils/download-file";

import styles from "./create-menu.module.css";

type ImportOpenApiToolsModalProps = {
  boxId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type FormValues = {
  useRule?: string;
};

function readUploadFile(fileList: UploadFile[]) {
  return fileList[0]?.originFileObj ?? null;
}

export function ImportOpenApiToolsModal({
  boxId,
  open,
  onClose,
  onSuccess,
}: ImportOpenApiToolsModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorDetail, setErrorDetail] = useState<ReturnType<
    typeof extractRequestErrorDetail
  > | null>(null);
  const [importFailures, setImportFailures] = useState<
    Array<{ toolName?: string; error?: string }>
  >([]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([OPENAPI_TOOLBOX_TEMPLATE], { type: "text/yaml" });
    triggerBrowserDownload(blob, "toolbox-openapi-template.yaml");
  };

  const handleSubmit = async () => {
    const uploadFile = readUploadFile(fileList);

    if (!uploadFile) {
      void message.info(t("executionFactory.importOpenApiFileRequired"));
      return;
    }

    setSubmitting(true);
    setErrorDetail(null);
    setImportFailures([]);

    try {
      const values = await form.validateFields();
      const openapiSpec = await uploadFile.text();
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
      width={640}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <AppButton icon={<DownloadOutlined />} onClick={handleDownloadTemplate} type="link">
          {t("executionFactory.downloadImportTemplate")}
        </AppButton>
      </div>
      <p className={styles.modalHint}>{t("executionFactory.importOpenApiToolsHint")}</p>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.useRule")} name="useRule">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
      <Upload.Dragger
        accept=".json,.yaml,.yml"
        beforeUpload={() => false}
        className={styles.uploadDragger}
        fileList={fileList}
        maxCount={1}
        onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
      >
        <p className="ant-upload-drag-icon">
          <CloudUploadOutlined />
        </p>
        <p className="ant-upload-text">{t("executionFactory.importOpenApiDraggerHint")}</p>
      </Upload.Dragger>
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
