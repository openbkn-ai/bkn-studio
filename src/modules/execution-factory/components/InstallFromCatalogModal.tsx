import { Alert, Form, Modal, Radio } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  exportComponent,
  importComponent,
} from "@/modules/execution-factory/services/impex.service";
import type { ImpexComponentType, ImpexImportMode } from "@/modules/execution-factory/types/impex";

type InstallFromCatalogModalProps = {
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      return;
    }

    form.setFieldsValue({ mode: "create" });
  }, [form, open]);

  const handleInstall = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const values = await form.validateFields();
      const payload = await exportComponent(componentType, componentId);
      await importComponent(componentType, payload, values.mode);
      void message.success(t("common.success"));
      onSuccess?.();
      onClose();
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t("executionFactory.install")}
      onCancel={onClose}
      onOk={() => {
        void handleInstall();
      }}
      open={open}
      title={t("executionFactory.installTitle")}
    >
      <p>{t("executionFactory.installDescription", { name: componentName })}</p>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.importMode")} name="mode">
          <Radio.Group>
            <Radio value="create">{t("executionFactory.importModeCreate")}</Radio>
            <Radio value="upsert">{t("executionFactory.importModeUpsert")}</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon type="error" /> : null}
    </Modal>
  );
}
