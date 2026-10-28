/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { UploadOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Radio, Space, Switch, Typography, Upload } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  KnowledgeNetworkImportBindingError,
  importKnowledgeNetwork,
  importKnowledgeNetworkPackage,
  isKnowledgeNetworkPackage,
  KnowledgeNetworkImportConflictError,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  readFileReaderText,
  stringFromUnknown,
} from "@/modules/knowledge-network/services/shared/runtime";
import type {
  CapabilityImportReport,
  KnowledgeNetworkBindingPolicy,
  KnowledgeNetworkImportMode,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  capabilitySkipReasonKey,
  capabilitySkipTypeKey,
} from "@/modules/knowledge-network/utils/capability-import-skip";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import styles from "./KnowledgeNetworkImportButton.module.css";

type KnowledgeNetworkImportButtonProps = {
  className?: string;
  onImported: () => void | Promise<void>;
};

type ImportPayload = Record<string, unknown>;
type ImportSubmitAction = "create" | "ignore" | "import" | "overwrite";
/**
 * What is being imported: a JSON export, which the dialog can rename on a conflict, or a BKN
 * package, which also brings the capabilities it declares and reports the ones it could not bind.
 */
type ImportSource = { kind: "json"; payload: ImportPayload } | { file: File; kind: "package" };

/** Files the import accepts: a JSON export, or a BKN package as studio exports it. */
const IMPORT_ACCEPT = ".json,.tar,.tar.gz,.tgz,.zip";

// This matches the bundled gateway body limit, not a guaranteed browser parsing limit.
const DEFAULT_IMPORT_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const configuredImportMaxFileSizeBytes = Number(
  import.meta.env.VITE_KNOWLEDGE_NETWORK_IMPORT_MAX_FILE_SIZE_BYTES,
);
const IMPORT_MAX_FILE_SIZE_BYTES =
  Number.isFinite(configuredImportMaxFileSizeBytes) && configuredImportMaxFileSizeBytes > 0
    ? configuredImportMaxFileSizeBytes
    : DEFAULT_IMPORT_MAX_FILE_SIZE_BYTES;
const IMPORT_MAX_FILE_SIZE_MB = Math.floor(IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024));

function isKnowledgeNetworkBindingPolicy(value: unknown): value is KnowledgeNetworkBindingPolicy {
  return value === "detach" || value === "preserve";
}

function isKnowledgeNetworkImportMode(value: unknown): value is KnowledgeNetworkImportMode {
  return value === "ignore" || value === "normal" || value === "overwrite";
}

export function KnowledgeNetworkImportButton({
  className,
  onImported,
}: KnowledgeNetworkImportButtonProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [form] = Form.useForm<{ identifier: string; name: string }>();
  const [importMode, setImportMode] = useState<KnowledgeNetworkImportMode>("normal");
  const [strictMode, setStrictMode] = useState(false);
  const [bindingPolicy, setBindingPolicy] = useState<KnowledgeNetworkBindingPolicy>("preserve");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bindingError, setBindingError] = useState<KnowledgeNetworkImportBindingError | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<ImportSubmitAction | null>(null);
  const [pendingSource, setPendingSource] = useState<ImportSource | null>(null);
  // Shown after a package import that could not bind every capability it declared.
  const [skipReport, setSkipReport] = useState<CapabilityImportReport | null>(null);
  const isSubmitting = submittingAction !== null;

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setBindingError(null);
    setConflictMessage(null);
    setPendingSource(null);
    setImportMode("normal");
    setStrictMode(false);
    setBindingPolicy("preserve");
    form.resetFields();
  };

  const finishImport = async (
    source: ImportSource,
    selectedImportMode: KnowledgeNetworkImportMode,
    action: ImportSubmitAction = "import",
  ) => {
    setSubmittingAction(action);

    try {
      if (source.kind === "package") {
        const report = await importKnowledgeNetworkPackage(
          source.file,
          selectedImportMode,
          bindingPolicy,
          strictMode,
        );
        if (report.skipped.length) {
          setSkipReport(report);
        } else {
          void message.success(
            report.bound
              ? t("knowledgeNetwork.packageImport.successBound", { count: report.bound })
              : t("knowledgeNetwork.importSuccess"),
          );
        }
      } else {
        await importKnowledgeNetwork(source.payload, selectedImportMode, bindingPolicy, strictMode);
        void message.success(t("knowledgeNetwork.importSuccess"));
      }
      closeImportDialog();
      await onImported();
    } catch (error) {
      if (error instanceof KnowledgeNetworkImportConflictError) {
        setBindingError(null);
        setPendingSource(source);
        setConflictMessage(error.message);
        if (source.kind === "json") {
          form.setFieldsValue({
            name: stringFromUnknown(source.payload.name),
            identifier: stringFromUnknown(
              source.payload.id,
              stringFromUnknown(source.payload.code),
            ),
          });
        }
        return;
      }

      if (error instanceof KnowledgeNetworkImportBindingError) {
        setBindingError(error);
        return;
      }

      setBindingError(null);
      setConflictMessage(null);
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmittingAction(null);
    }
  };

  const confirmOverwrite = (source: ImportSource, action: ImportSubmitAction) => {
    void modal.confirm({
      content: t("knowledgeNetwork.importOverwriteConfirmDescription"),
      okButtonProps: { danger: true },
      okText: t("knowledgeNetwork.importOverwrite"),
      onOk: () => finishImport(source, "overwrite", action),
      title: t("knowledgeNetwork.importOverwriteConfirmTitle"),
    });
  };

  const submitImport = (
    source: ImportSource,
    selectedImportMode: KnowledgeNetworkImportMode,
    action: ImportSubmitAction = "import",
  ) => {
    if (selectedImportMode === "overwrite") {
      confirmOverwrite(source, action);
      return;
    }

    void finishImport(source, selectedImportMode, action);
  };

  const openImportDialog = (source: ImportSource) => {
    setPendingSource(source);
    setImportMode("normal");
    setStrictMode(false);
    setBindingPolicy("preserve");
    setBindingError(null);
    setConflictMessage(null);
    form.resetFields();
    setImportDialogOpen(true);
  };

  const parseUploadFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const payload = JSON.parse(readFileReaderText(event.target?.result)) as ImportPayload;
        openImportDialog({ kind: "json", payload });
      } catch {
        void message.error(t("knowledgeNetwork.importInvalidJson"));
      }
    };

    reader.readAsText(file);
  };

  return (
    <>
      <Upload
        accept={IMPORT_ACCEPT}
        beforeUpload={(file) => {
          if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
            void message.error(
              t("knowledgeNetwork.importFileTooLarge", { maxSizeMB: IMPORT_MAX_FILE_SIZE_MB }),
            );
            return false;
          }
          if (isKnowledgeNetworkPackage(file.name)) {
            openImportDialog({ file, kind: "package" });
          } else {
            parseUploadFile(file);
          }
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
        destroyOnHidden
        footer={
          conflictMessage
            ? [
                <AppButton
                  danger
                  disabled={isSubmitting && submittingAction !== "overwrite"}
                  key="overwrite"
                  loading={submittingAction === "overwrite"}
                  onClick={() => {
                    if (pendingSource) {
                      confirmOverwrite(pendingSource, "overwrite");
                    }
                  }}
                >
                  {t("knowledgeNetwork.importOverwrite")}
                </AppButton>,
                <AppButton
                  disabled={isSubmitting && submittingAction !== "ignore"}
                  key="ignore"
                  loading={submittingAction === "ignore"}
                  onClick={() => {
                    if (pendingSource) {
                      void finishImport(pendingSource, "ignore", "ignore");
                    }
                  }}
                >
                  {t("knowledgeNetwork.importIgnore")}
                </AppButton>,
                // A package's name and id cannot be edited here, so it cannot be imported as a copy.
                pendingSource?.kind === "json" ? (
                  <AppButton
                    disabled={isSubmitting && submittingAction !== "create"}
                    key="create"
                    loading={submittingAction === "create"}
                    onClick={() => {
                      void form.validateFields().then((values) => {
                        if (pendingSource?.kind !== "json") {
                          return;
                        }

                        return finishImport(
                          {
                            kind: "json",
                            payload: {
                              ...pendingSource.payload,
                              code: values.identifier,
                              id: values.identifier,
                              name: values.name,
                            },
                          },
                          "normal",
                          "create",
                        );
                      });
                    }}
                    type="primary"
                  >
                    {t("common.create")}
                  </AppButton>
                ) : null,
                <AppButton disabled={isSubmitting} key="cancel" onClick={closeImportDialog}>
                  {t("common.cancel")}
                </AppButton>,
              ]
            : undefined
        }
        maskClosable={!isSubmitting}
        okButtonProps={{ disabled: !pendingSource || isSubmitting }}
        okText={t("knowledgeNetwork.importButton")}
        onCancel={closeImportDialog}
        onOk={() => {
          if (pendingSource) {
            submitImport(pendingSource, importMode);
          }
        }}
        open={importDialogOpen}
        rootClassName={`${modalStyles.businessModal} ${styles.importModal}`}
        title={t("knowledgeNetwork.importTitle")}
      >
        {pendingSource?.kind === "package" ? (
          <Typography.Paragraph className={styles.sectionDescription}>
            {t("knowledgeNetwork.packageImport.file", { name: pendingSource.file.name })}
          </Typography.Paragraph>
        ) : null}
        <Typography.Text strong>{t("knowledgeNetwork.importModeTitle")}</Typography.Text>
        <Typography.Paragraph className={styles.sectionDescription}>
          {t("knowledgeNetwork.importModeDescription")}
        </Typography.Paragraph>
        <Radio.Group
          disabled={isSubmitting}
          onChange={(event) => {
            const nextImportMode: unknown = event.target.value;

            if (isKnowledgeNetworkImportMode(nextImportMode)) {
              setImportMode(nextImportMode);
              setBindingError(null);
              setConflictMessage(null);
            }
          }}
          value={importMode}
        >
          <Space direction="vertical" size="middle">
            <Radio value="normal">
              <Typography.Text strong>
                {t("knowledgeNetwork.importModeNormalTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.optionDescription}>
                {t("knowledgeNetwork.importModeNormalDescription")}
              </Typography.Paragraph>
            </Radio>
            <Radio value="ignore">
              <Typography.Text strong>
                {t("knowledgeNetwork.importModeIgnoreTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.optionDescription}>
                {t("knowledgeNetwork.importModeIgnoreDescription")}
              </Typography.Paragraph>
            </Radio>
            <Radio value="overwrite">
              <Typography.Text strong>
                {t("knowledgeNetwork.importModeOverwriteTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.optionDescription}>
                {t("knowledgeNetwork.importModeOverwriteDescription")}
              </Typography.Paragraph>
            </Radio>
          </Space>
        </Radio.Group>
        {importMode === "overwrite" ? (
          <Alert
            className={styles.optionAlert}
            description={t("knowledgeNetwork.importOverwriteRisk")}
            showIcon
            type="warning"
          />
        ) : null}
        <div className={styles.strictModeRow}>
          <div>
            <Typography.Text strong>{t("knowledgeNetwork.importStrictModeTitle")}</Typography.Text>
            <Typography.Paragraph className={styles.strictModeDescription}>
              {t("knowledgeNetwork.importStrictModeDescription")}
            </Typography.Paragraph>
          </div>
          <Switch
            aria-label={t("knowledgeNetwork.importStrictModeTitle")}
            checked={strictMode}
            disabled={isSubmitting}
            onChange={setStrictMode}
          />
        </div>
        <Typography.Text strong>{t("knowledgeNetwork.importBindingPolicyTitle")}</Typography.Text>
        <Typography.Paragraph>
          {t("knowledgeNetwork.importBindingPolicyDescription")}
        </Typography.Paragraph>
        <Radio.Group
          disabled={isSubmitting}
          onChange={(event) => {
            const nextBindingPolicy: unknown = event.target.value;

            if (isKnowledgeNetworkBindingPolicy(nextBindingPolicy)) {
              setBindingPolicy(nextBindingPolicy);
              setBindingError(null);
            }
          }}
          value={bindingPolicy}
        >
          <Space direction="vertical" size="middle">
            <Radio value="preserve">
              <Typography.Text strong>
                {t("knowledgeNetwork.importBindingPolicyPreserveTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.optionDescription}>
                {t("knowledgeNetwork.importBindingPolicyPreserveDescription")}
              </Typography.Paragraph>
            </Radio>
            <Radio value="detach">
              <Typography.Text strong>
                {t("knowledgeNetwork.importBindingPolicyDetachTitle")}
              </Typography.Text>
              <Typography.Paragraph className={styles.optionDescription}>
                {t("knowledgeNetwork.importBindingPolicyDetachDescription")}
              </Typography.Paragraph>
            </Radio>
          </Space>
        </Radio.Group>
        {bindingError ? (
          <Alert
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text strong>{bindingError.message}</Typography.Text>
                {bindingError.details ? (
                  <Typography.Text>{bindingError.details}</Typography.Text>
                ) : null}
              </Space>
            }
            showIcon
            type="error"
          />
        ) : null}
        {conflictMessage ? (
          <>
            <Alert description={conflictMessage} showIcon type="error" />
            {pendingSource?.kind === "package" ? (
              <Typography.Paragraph>
                {t("knowledgeNetwork.packageImport.conflictTip")}
              </Typography.Paragraph>
            ) : (
              <>
                <Typography.Paragraph>
                  {t("knowledgeNetwork.importConflictTip")}
                </Typography.Paragraph>
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
            )}
          </>
        ) : null}
      </Modal>

      {skipReport ? (
        <Modal
          footer={
            <AppButton onClick={() => setSkipReport(null)} type="primary">
              {t("knowledgeNetwork.packageImport.done")}
            </AppButton>
          }
          onCancel={() => setSkipReport(null)}
          open
          rootClassName={modalStyles.businessModal}
          title={t("knowledgeNetwork.packageImport.skippedTitle", {
            count: skipReport.skipped.length,
          })}
        >
          <Typography.Paragraph className={styles.sectionDescription}>
            {t("knowledgeNetwork.packageImport.skippedDescription", { count: skipReport.bound })}
          </Typography.Paragraph>
          <ul className={styles.skipList}>
            {skipReport.skipped.map((skip, index) => (
              <li className={styles.skipItem} key={`${skip.capabilityType}-${skip.name}-${index}`}>
                <Typography.Text strong>
                  {t(
                    skip.boxName
                      ? "knowledgeNetwork.packageImport.skipItemInBox"
                      : "knowledgeNetwork.packageImport.skipItem",
                    {
                      box: skip.boxName,
                      name: skip.name || t("knowledgeNetwork.packageImport.unnamed"),
                      type: t(capabilitySkipTypeKey(skip.capabilityType)),
                    },
                  )}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t(capabilitySkipReasonKey(skip.reason))}
                </Typography.Text>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </>
  );
}
