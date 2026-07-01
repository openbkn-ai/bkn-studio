/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { UploadOutlined } from "@ant-design/icons";
import { Form, Input, Modal, Upload } from "antd";
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

type KnowledgeNetworkImportButtonProps = {
  className?: string;
  onImported: () => void | Promise<void>;
};

type ImportPayload = Record<string, unknown>;

export function KnowledgeNetworkImportButton({
  className,
  onImported,
}: KnowledgeNetworkImportButtonProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [form] = Form.useForm<{ identifier: string; name: string }>();
  const [renameOpen, setRenameOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ImportPayload | null>(null);

  const finishImport = async (
    payload: ImportPayload,
    importMode?: "ignore" | "overwrite",
  ) => {
    setImporting(true);

    try {
      await importKnowledgeNetwork(payload, importMode);
      void message.success(t("knowledgeNetwork.importSuccess"));
      setRenameOpen(false);
      setPendingPayload(null);
      form.resetFields();
      await onImported();
    } catch (error) {
      if (error instanceof KnowledgeNetworkImportConflictError) {
        const modalContext = modal.info({
          title: t("knowledgeNetwork.importConflictTitle"),
          content: (
            <div>
              <p>{error.message}</p>
              <p>{t("knowledgeNetwork.importConflictTip")}</p>
            </div>
          ),
          footer: (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <AppButton
                onClick={() => {
                  void finishImport(payload, "overwrite").finally(() => {
                    modalContext.destroy();
                  });
                }}
                type="primary"
              >
                {t("knowledgeNetwork.importOverwrite")}
              </AppButton>
              <AppButton
                onClick={() => {
                  modalContext.destroy();
                  setPendingPayload(payload);
                  form.setFieldsValue({
                    name: stringFromUnknown(payload.name),
                    identifier: stringFromUnknown(payload.id, stringFromUnknown(payload.code)),
                  });
                  setRenameOpen(true);
                }}
              >
                {t("common.create")}
              </AppButton>
              <AppButton
                onClick={() => {
                  void finishImport(payload, "ignore").finally(() => {
                    modalContext.destroy();
                  });
                }}
              >
                {t("knowledgeNetwork.importIgnore")}
              </AppButton>
              <AppButton onClick={() => modalContext.destroy()}>
                {t("common.cancel")}
              </AppButton>
            </div>
          ),
        });
        return;
      }

      void message.error(extractRequestErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const parseUploadFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const payload = JSON.parse(readFileReaderText(event.target?.result)) as ImportPayload;
        void finishImport(payload);
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
        <AppButton className={className} icon={<UploadOutlined />} loading={importing}>
          {t("knowledgeNetwork.importButton")}
        </AppButton>
      </Upload>

      <Modal
        destroyOnClose
        onCancel={() => {
          setRenameOpen(false);
          setPendingPayload(null);
        }}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            if (!pendingPayload) {
              return;
            }

            await finishImport({
              ...pendingPayload,
              id: values.identifier,
              code: values.identifier,
              name: values.name,
            });
          });
        }}
        open={renameOpen}
        title={t("knowledgeNetwork.importTitle")}
      >
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
      </Modal>
    </>
  );
}
