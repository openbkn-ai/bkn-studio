/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { UploadOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Radio, Space, Typography, Upload } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  importKnowledgeNetwork,
  KnowledgeNetworkImportConflictError,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  readFileReaderText,
  stringFromUnknown,
} from "@/modules/knowledge-network/services/shared/runtime";
import type { KnowledgeNetworkBindingPolicy } from "@/modules/knowledge-network/types/knowledge-network";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import styles from "./KnowledgeNetworkImportButton.module.css";

type KnowledgeNetworkImportButtonProps = {
  className?: string;
  onImported: () => void | Promise<void>;
};

type ImportPayload = Record<string, unknown>;
type ImportSubmitAction = "create" | "import" | "overwrite";

function isKnowledgeNetworkBindingPolicy(value: unknown): value is KnowledgeNetworkBindingPolicy {
  return value === "detach" || value === "preserve";
}

export function KnowledgeNetworkImportButton({
  className,
  onImported,
}: KnowledgeNetworkImportButtonProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<{ identifier: string; name: string }>();
  const [bindingPolicy, setBindingPolicy] = useState<KnowledgeNetworkBindingPolicy>("preserve");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<ImportSubmitAction | null>(null);
  const [pendingPayload, setPendingPayload] = useState<ImportPayload | null>(null);
  const isSubmitting = submittingAction !== null;

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setConflictMessage(null);
    setPendingPayload(null);
    form.resetFields();
  };

  const finishImport = async (
    payload: ImportPayload,
    importMode?: "ignore" | "overwrite",
    action: ImportSubmitAction = "import",
  ) => {
    setSubmittingAction(action);

    try {
      await importKnowledgeNetwork(payload, importMode, bindingPolicy);
      void message.success(t("knowledgeNetwork.importSuccess"));
      closeImportDialog();
      await onImported();
    } catch (error) {
      if (error instanceof KnowledgeNetworkImportConflictError) {
        setPendingPayload(payload);
        setConflictMessage(error.message);
        form.setFieldsValue({
          name: stringFromUnknown(payload.name),
          identifier: stringFromUnknown(payload.id, stringFromUnknown(payload.code)),
        });
        return;
      }

      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const parseUploadFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const payload = JSON.parse(readFileReaderText(event.target?.result)) as ImportPayload;
        setPendingPayload(payload);
        setBindingPolicy("preserve");
        setConflictMessage(null);
        form.resetFields();
        setImportDialogOpen(true);
      } catch {
        void message.error(t("knowledgeNetwork.importInvalidJson"));
      }
    };

    reader.readAsText(file);
  };

  return (
    <>
      <Upload
        accept=".json"
        beforeUpload={(file) => {
          parseUploadFile(file);
          return false;
        }}
        showUploadList={false}
      >
        <AppButton className={className} icon={<UploadOutlined />} loading={isSubmitting}>
          {t("knowledgeNetwork.importButton")}
        </AppButton>
      </Upload>

      <Modal
        closable={!isSubmitting}
        cancelButtonProps={{ disabled: isSubmitting }}
        confirmLoading={submittingAction === "import"}
        destroyOnClose
        footer={
          conflictMessage
            ? [
                <AppButton
                  danger
                  disabled={isSubmitting && submittingAction !== "overwrite"}
                  key="overwrite"
                  loading={submittingAction === "overwrite"}
                  onClick={() => {
                    if (pendingPayload) {
                      void finishImport(pendingPayload, "overwrite", "overwrite");
                    }
                  }}
                >
                  {t("knowledgeNetwork.importOverwrite")}
                </AppButton>,
                <AppButton
                  disabled={isSubmitting && submittingAction !== "create"}
                  key="create"
                  loading={submittingAction === "create"}
                  onClick={() => {
                    void form.validateFields().then((values) => {
                      if (!pendingPayload) {
                        return;
                      }

                      return finishImport(
                        {
                          ...pendingPayload,
                          code: values.identifier,
                          id: values.identifier,
                          name: values.name,
                        },
                        undefined,
                        "create",
                      );
                    });
                  }}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>,
                <AppButton disabled={isSubmitting} key="cancel" onClick={closeImportDialog}>
                  {t("common.cancel")}
                </AppButton>,
              ]
            : undefined
        }
        maskClosable={!isSubmitting}
        okButtonProps={{ disabled: !pendingPayload || isSubmitting }}
        okText={t("knowledgeNetwork.importButton")}
        onCancel={closeImportDialog}
        onOk={() => {
          if (pendingPayload) {
            void finishImport(pendingPayload);
          }
        }}
        open={importDialogOpen}
        rootClassName={modalStyles.businessModal}
        title={t("knowledgeNetwork.importTitle")}
      >
        <Typography.Paragraph>
          {t("knowledgeNetwork.importBindingPolicyDescription")}
        </Typography.Paragraph>
        <Radio.Group
          disabled={isSubmitting}
          onChange={(event) => {
            const nextBindingPolicy: unknown = event.target.value;

            if (isKnowledgeNetworkBindingPolicy(nextBindingPolicy)) {
              setBindingPolicy(nextBindingPolicy);
            }
          }}
          value={bindingPolicy}
        >
          <Space direction="vertical" size="middle">
            <Radio value="preserve">
              <Typography.Text strong>
                {t("knowledgeNetwork.importBindingPolicyPreserveTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.bindingOptionDescription}>
                {t("knowledgeNetwork.importBindingPolicyPreserveDescription")}
              </Typography.Paragraph>
            </Radio>
            <Radio value="detach">
              <Typography.Text strong>
                {t("knowledgeNetwork.importBindingPolicyDetachTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.bindingOptionDescription}>
                {t("knowledgeNetwork.importBindingPolicyDetachDescription")}
              </Typography.Paragraph>
            </Radio>
          </Space>
        </Radio.Group>
        {conflictMessage ? (
          <>
            <Alert description={conflictMessage} showIcon type="error" />
            <Typography.Paragraph>{t("knowledgeNetwork.importConflictTip")}</Typography.Paragraph>
            <Form form={form} layout="vertical">
              <Form.Item
                label={t("knowledgeNetwork.name")}
                name="name"
                rules={[{ required: true, message: t("knowledgeNetwork.nameRequired") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("knowledgeNetwork.identifier")} name="identifier">
                <Input />
              </Form.Item>
            </Form>
          </>
        ) : null}
      </Modal>
    </>
  );
}
