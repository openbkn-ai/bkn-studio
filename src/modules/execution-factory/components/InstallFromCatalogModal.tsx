import { Alert, Form, Modal, Radio } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  exportComponent,
  importComponent,
} from "@/modules/execution-factory/services/impex.service";
import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";
import { resolveCatalogInstallErrorMessage } from "@/modules/execution-factory/utils/impex-error-message";

type InstallFromCatalogModalProps = {
  alreadyInstalled?: boolean;
  componentId: string;
  componentName: string;
  componentType: ImpexComponentType;
  onClose: () => void;
  onSuccess?: () => void;
  open: boolean;
};

type InstallFormValues = {
  mode: ImpexImportMode;
};

export function InstallFromCatalogModal({
  alreadyInstalled = false,
  componentId,
  componentName,
  componentType,
  onClose,
  onSuccess,
  open,
}: InstallFromCatalogModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<InstallFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      return;
    }

    form.setFieldsValue({ mode: alreadyInstalled ? "upsert" : "create" });
  }, [alreadyInstalled, form, open]);

  const handleInstall = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const mode: ImpexImportMode = alreadyInstalled
        ? "upsert"
        : (await form.validateFields()).mode;
      const payload = await exportComponent(componentType, componentId);
      await importComponent(componentType, payload, mode);
      void message.success(
        t(alreadyInstalled ? "executionFactory.syncSuccess" : "executionFactory.introduceSuccess"),
      );
      onSuccess?.();
      onClose();
    } catch (caughtError) {
      setError(
        resolveCatalogInstallErrorMessage(caughtError, {
          mode: form.getFieldValue("mode") ?? (alreadyInstalled ? "upsert" : "create"),
          componentType,
          t,
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t(
        alreadyInstalled ? "executionFactory.syncConfirm" : "executionFactory.introduceConfirm",
      )}
      onCancel={onClose}
      onOk={() => {
        void handleInstall();
      }}
      open={open}
      title={t(
        alreadyInstalled ? "executionFactory.syncTitle" : "executionFactory.introduceTitle",
      )}
    >
      <p>
        {t(
          alreadyInstalled
            ? "executionFactory.syncDescription"
            : "executionFactory.introduceDescription",
          { name: componentName },
        )}
      </p>
      {alreadyInstalled ? (
        <Alert
          message={t("executionFactory.syncModeHint")}
          showIcon
          style={{ marginBottom: 16 }}
          type="info"
        />
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item label={t("executionFactory.importMode")} name="mode">
            <Radio.Group>
              <Radio value="create">
                <div>{t("executionFactory.importModeCreate")}</div>
                <div style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
                  {t("executionFactory.importModeCreateHint")}
                </div>
              </Radio>
              <Radio value="upsert">
                <div>{t("executionFactory.importModeUpsert")}</div>
                <div style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
                  {t("executionFactory.importModeUpsertHint")}
                </div>
              </Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      )}
      {error ? (
        <Alert
          description={error.hint}
          message={error.title}
          showIcon
          type="error"
        />
      ) : null}
    </Modal>
  );
}
