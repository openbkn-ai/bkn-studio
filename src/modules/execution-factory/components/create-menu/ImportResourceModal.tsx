/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloudUploadOutlined } from "@ant-design/icons";

import { Alert, Form, Modal, Radio, Upload } from "antd";

import type { UploadFile } from "antd/es/upload/interface";

import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import { importComponentFile } from "@/modules/execution-factory/services/impex.service";

import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";

import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";

import styles from "./create-menu.module.css";

type ImportResourceModalProps = {
  activeTab: ExecutionUnitTab;

  open: boolean;

  onClose: () => void;

  onSuccess?: () => void;
};

type AdpFormValues = {
  mode: ImpexImportMode;
};

function tabToImpexType(activeTab: ExecutionUnitTab): ImpexComponentType | null {
  if (activeTab === "toolbox" || activeTab === "mcp") {
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

  const [adpForm] = Form.useForm<AdpFormValues>();

  const [adpFileList, setAdpFileList] = useState<UploadFile[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const [errorDetail, setErrorDetail] = useState<ReturnType<
    typeof extractRequestErrorDetail
  > | null>(null);

  const impexType = tabToImpexType(activeTab);

  const adpImportMode = Form.useWatch("mode", adpForm) ?? "create";

  useEffect(() => {
    if (!open) {
      return;
    }

    adpForm.setFieldsValue({ mode: "create" });
    setAdpFileList([]);
    setErrorDetail(null);
  }, [adpForm, open]);

  const handleSubmit = async () => {
    if (!impexType) {
      return;
    }

    setSubmitting(true);

    setErrorDetail(null);

    try {
      const values = await adpForm.validateFields();

      const uploadFile = readUploadFile(adpFileList);

      if (!uploadFile) {
        void message.info(t("executionFactory.importAdpFileRequired"));
        return;
      }

      await importComponentFile(impexType, uploadFile, values.mode);

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

      destroyOnHidden

      okText={t("executionFactory.importConfirm")}

      onCancel={onClose}

      onOk={() => {
        void handleSubmit();
      }}

      open={open}

      title={t(`executionFactory.importResourceTitle.${activeTab}`)}

      width={760}
    >
      <Form form={adpForm} layout="vertical">
        <CapabilityBusinessIntro
          messageKey={`executionFactory.businessIntro.impexAdp${activeTab === "mcp" ? "Mcp" : "Toolbox"}`}
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

          <p className="ant-upload-text">{t("executionFactory.importAdpDraggerHint")}</p>
        </Upload.Dragger>
      </Form>

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
