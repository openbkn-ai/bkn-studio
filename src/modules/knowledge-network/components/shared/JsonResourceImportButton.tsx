import { UploadOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { KnowledgeNetworkImportMode } from "@/modules/knowledge-network/types/knowledge-network";
import {
  KnowledgeNetworkImportConflictError,
  readFileReaderText,
} from "@/modules/knowledge-network/services/shared/runtime";

export type ResourceImportConflictError = {
  isConflict: true;
  message: string;
};

type JsonResourceImportButtonProps = {
  className?: string;
  label?: string;
  onImported: () => void | Promise<void>;
  onImport: (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => Promise<void>;
};

export function JsonResourceImportButton({
  className,
  label,
  onImported,
  onImport,
}: JsonResourceImportButtonProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [importing, setImporting] = useState(false);

  const finishImport = async (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => {
    setImporting(true);

    try {
      await onImport(payload, importMode);
      void message.success(t("knowledgeNetwork.importSuccess"));
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

      const conflict = error as ResourceImportConflictError;

      if (conflict?.isConflict) {
        const modalContext = modal.info({
          title: t("knowledgeNetwork.importConflictTitle"),
          content: (
            <div>
              <p>{conflict.message}</p>
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

  return (
    <Upload
      accept=".json"
      beforeUpload={(file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const payload = JSON.parse(readFileReaderText(event.target?.result)) as Record<
              string,
              unknown
            >;
            void finishImport(payload);
          } catch {
            void message.error(t("knowledgeNetwork.importInvalidJson"));
          }
        };
        reader.readAsText(file);
        return false;
      }}
      showUploadList={false}
    >
      <AppButton className={className} icon={<UploadOutlined />} loading={importing}>
        {label ?? t("common.import")}
      </AppButton>
    </Upload>
  );
}
