/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber, Modal, Select, Switch } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createSmallModel,
  testSmallModel,
  updateSmallModel,
} from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";
import { getAdaptationCodeTemplate } from "@/modules/model-resources/utils/adapter-templates";
import {
  buildSmallModelSavePayload,
  smallModelToFormValues,
  type SmallModelFormValues,
} from "@/modules/model-resources/utils/model-form";

import { AdaptationCodeEditor } from "./AdaptationCodeEditor";

type SmallModelFormModalProps = {
  mode: "create" | "edit" | "view";
  onClose: (refresh?: boolean) => void;
  open: boolean;
  record: SmallModel | null;
};

export function SmallModelFormModal({ mode, onClose, open, record }: SmallModelFormModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<SmallModelFormValues>();
  const [modalMode, setModalMode] = useState(mode);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const skipAdapterTemplateRef = useRef(false);
  const adapterEnabled = Form.useWatch("adapter", form);
  const authValue = Form.useWatch("auth", form);
  const modelTypeValue = Form.useWatch("modelType", form);

  const modelTypeOptions = useMemo(
    () => [
      { value: "embedding", label: "embedding" },
      { value: "reranker", label: "reranker" },
    ],
    [],
  );

  const authOptions = useMemo(
    () => [
      { value: "empty", label: t("modelResources.models.auth.empty") },
      { value: "auth", label: "API Key" },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setModalMode(mode);
    form.resetFields();

    if (record) {
      skipAdapterTemplateRef.current = true;
      form.setFieldsValue(smallModelToFormValues(record));
      return;
    }

    skipAdapterTemplateRef.current = false;
    form.setFieldsValue({
      modelType: "embedding",
      auth: "empty",
      adapter: false,
    });
  }, [form, mode, open, record]);

  useEffect(() => {
    if (!open || !adapterEnabled) {
      return;
    }

    if (skipAdapterTemplateRef.current) {
      skipAdapterTemplateRef.current = false;
      return;
    }

    form.setFieldValue("adapterCode", getAdaptationCodeTemplate(modelTypeValue ?? "embedding"));
  }, [adapterEnabled, form, modelTypeValue, open]);

  useEffect(() => {
    if (!open || !adapterEnabled) {
      return;
    }

    const adapterCode = record?.adapterCode
      ? record.adapterCode
      : getAdaptationCodeTemplate(modelTypeValue ?? "embedding");
    form.setFieldValue("adapterCode", adapterCode);
  }, [adapterEnabled, form, modelTypeValue, open, record?.adapterCode]);

  const isView = modalMode === "view";

  const handleTest = async (silent = false) => {
    const values = await form.validateFields();
    const payload = buildSmallModelSavePayload(values, record ?? undefined);

    setTesting(true);

    try {
      const result = await testSmallModel(payload);
      if (result.status !== "ok") {
        throw new Error(t("modelResources.models.testFailed"));
      }

      if (!silent) {
        message.success(t("modelResources.models.testSuccess"));
      }

      return true;
    } catch (error) {
      if (!silent) {
        message.error(extractRequestErrorMessage(error));
      }
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = buildSmallModelSavePayload(values, record ?? undefined);

    setSubmitting(true);

    try {
      const tested = await handleTest(true);
      if (!tested) {
        return;
      }

      const result =
        modalMode === "edit"
          ? await updateSmallModel(payload)
          : await createSmallModel(payload);

      if (result.status !== "ok") {
        throw new Error(t("modelResources.models.saveFailed"));
      }

      message.success(t("modelResources.models.saveSuccess"));
      onClose(true);
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const titleKey =
    modalMode === "create"
      ? "modelResources.models.modal.create"
      : modalMode === "edit"
        ? "modelResources.models.modal.edit"
        : "modelResources.models.modal.view";

  return (
    <Modal
      destroyOnHidden
      footer={
        isView ? (
          <AppButton loading={testing} onClick={() => void handleTest()}>
            {t("modelResources.models.modal.testConnection")}
          </AppButton>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <AppButton loading={submitting} type="primary" onClick={() => void handleSubmit()}>
              {t("common.save")}
            </AppButton>
            <AppButton loading={testing} onClick={() => void handleTest()}>
              {t("modelResources.models.modal.testConnection")}
            </AppButton>
            <AppButton onClick={() => onClose(false)}>{t("common.cancel")}</AppButton>
          </div>
        )
      }
      maskClosable={false}
      onCancel={() => onClose(false)}
      open={open}
      title={t(titleKey)}
      width={760}
    >
      <Form
        colon={isView}
        disabled={isView}
        form={form}
        labelAlign="left"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
      >
        <Form.Item
          label={t("modelResources.models.modal.modelName")}
          name="modelName"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("modelResources.models.columns.modelType")}
          name="modelType"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <Select options={modelTypeOptions} />
        </Form.Item>
        <Form.Item label={t("modelResources.models.modal.adaptationFile")} name="adapter" valuePropName="checked">
          <Switch />
        </Form.Item>
        {!adapterEnabled ? (
          <>
            <Form.Item
              label="API Model"
              name="apiModel"
              rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
            >
              <Input placeholder={t("modelResources.models.modal.apiModelPlaceholder")} />
            </Form.Item>
            <Form.Item
              label="API URL"
              name="apiUrl"
              rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
            >
              <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
            </Form.Item>
            <Form.Item label={t("modelResources.models.modal.auth")} name="auth">
              <Select options={authOptions} />
            </Form.Item>
            {authValue === "auth" ? (
              <Form.Item
                label="API Key"
                name="apiKey"
                rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
              >
                <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
              </Form.Item>
            ) : null}
          </>
        ) : (
          <Form.Item
            label={t("modelResources.models.modal.adaptationFile")}
            name="adapterCode"
            rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
          >
            <AdaptationCodeEditor
              placeholder={t("modelResources.models.modal.adapterPlaceholder")}
              readOnly={isView}
            />
          </Form.Item>
        )}
        {modelTypeValue === "embedding" ? (
          <>
            <Form.Item label={t("modelResources.models.modal.vectorDimension")} name="embeddingDim">
              <InputNumber controls={false} min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label={t("modelResources.models.modal.batchSize")} name="batchSize">
              <InputNumber controls={false} min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label={t("modelResources.models.modal.maxNumberOfTokens")} name="maxTokens">
              <InputNumber controls={false} min={1} style={{ width: "100%" }} />
            </Form.Item>
          </>
        ) : null}
        {modelTypeValue === "reranker" ? (
          <>
            <Form.Item label={t("modelResources.models.modal.maxNumberOfDocuments")} name="maxDocuments">
              <InputNumber controls={false} min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label={t("modelResources.models.modal.maxNumberOfTokens")} name="maxTokens">
              <InputNumber controls={false} min={1} style={{ width: "100%" }} />
            </Form.Item>
          </>
        ) : null}
      </Form>
      {isView ? (
        <AppButton type="link" onClick={() => setModalMode("edit")}>
          {t("modelResources.models.modal.switchToEdit")}
        </AppButton>
      ) : null}
    </Modal>
  );
}
