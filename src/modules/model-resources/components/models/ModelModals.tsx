/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Form, Input, InputNumber, Modal, Select, Spin, Switch } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createLlmModel,
  testLlmModel,
  updateLlmModel,
} from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildLlmSavePayload,
  llmModelToFormValues,
  type LlmFormValues,
} from "@/modules/model-resources/utils/model-form";
import { MODEL_SERIES_OPTIONS } from "@/modules/model-resources/utils/model-display";
import { getLlmModelTypeLabel } from "@/modules/model-resources/utils/llm-labels";

import modalStyles from "./LlmModelFormModal.module.css";

type LlmModelFormModalProps = {
  mode: "create" | "edit" | "view";
  onClose: (refresh?: boolean) => void;
  open: boolean;
  record: LlmModel | null;
  showQuotaField?: boolean;
};

export function LlmModelFormModal({
  mode,
  onClose,
  open,
  record,
  showQuotaField = false,
}: LlmModelFormModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<LlmFormValues>();
  const [modalMode, setModalMode] = useState(mode);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const authValue = Form.useWatch("auth", form);
  const modelTypeValue = Form.useWatch<LlmFormValues["modelType"]>("modelType", form);

  const modelTypeOptions = useMemo(
    () => [
      { value: "llm", label: t("modelResources.models.types.llmFull") },
      { value: "rlm", label: t("modelResources.models.types.rlmFull") },
      { value: "vu", label: t("modelResources.models.types.vuFull") },
    ],
    [t],
  );

  const authOptions = useMemo(
    () => [
      { value: "empty", label: t("modelResources.models.auth.empty") },
      { value: "auth", label: "API Key" },
      { value: "dual_key", label: "Dual Key" },
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
      form.setFieldsValue(llmModelToFormValues(record));
      return;
    }

    form.setFieldsValue({
      modelType: "llm",
      auth: "empty",
      quota: false,
    });
  }, [form, mode, open, record]);

  const isView = modalMode === "view";

  const handleTest = async (silent = false) => {
    const values = await form.validateFields();
    const payload = buildLlmSavePayload(values, record ?? undefined);

    setTesting(true);

    try {
      const result = await testLlmModel(payload, silent);
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
    const payload = buildLlmSavePayload(values, record ?? undefined);

    setSubmitting(true);

    try {
      const tested = await handleTest(true);
      if (!tested) {
        return;
      }

      const result =
        modalMode === "edit" ? await updateLlmModel(payload) : await createLlmModel(payload);

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
      width={640}
    >
      <Form
        colon={isView}
        disabled={isView}
        form={form}
        labelAlign="left"
        labelCol={{ span: 7 }}
        wrapperCol={{ span: 17 }}
      >
        <Form.Item
          label={t("modelResources.models.modal.modelName")}
          name="modelName"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("modelResources.models.modal.baseModel")}
          name="modelSeries"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <Select options={MODEL_SERIES_OPTIONS} placeholder={t("modelResources.models.modal.selectPlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("modelResources.models.columns.modelType")}
          name="modelType"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          {isView ? (
            <span>{getLlmModelTypeLabel(modelTypeValue, t)}</span>
          ) : (
            <Select options={modelTypeOptions} />
          )}
        </Form.Item>
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
        <Form.Item
          label={t("modelResources.models.modal.auth")}
          name="auth"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <Select options={authOptions} />
        </Form.Item>
        {authValue === "auth" || authValue === "dual_key" ? (
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
          >
            <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
          </Form.Item>
        ) : null}
        {authValue === "dual_key" ? (
          <Form.Item
            label="Secret Key"
            name="secretKey"
            rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
          >
            <Input placeholder={t("modelResources.models.modal.enterPlaceholder")} />
          </Form.Item>
        ) : null}
        <Form.Item
          label={t("modelResources.models.columns.maximumContext")}
          name="maxModelLen"
          rules={[{ required: true, message: t("modelResources.models.modal.required") }]}
        >
          <InputNumber addonAfter="K" controls={false} min={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          label={t("modelResources.models.columns.parameterQuantity")}
          name="modelParameters"
          rules={[
            {
              validator: (_rule, value: number | null | undefined) => {
                if (value == null) {
                  return Promise.resolve();
                }

                if (Number.isInteger(value) && value > 0) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error(t("modelResources.models.modal.positiveInteger")));
              },
            },
          ]}
        >
          <InputNumber
            addonAfter="B"
            controls={false}
            min={1}
            precision={0}
            style={{ width: "100%" }}
          />
        </Form.Item>
        {showQuotaField ? (
          <>
            <Form.Item
              label={t("modelResources.models.modal.quotaTitle")}
              name="quota"
              valuePropName="checked"
            >
              <Switch disabled={isView} />
            </Form.Item>
            <div className={modalStyles.quotaHint}>
              {t("modelResources.models.modal.quotaTitleDescribe1")}
            </div>
            <div className={`${modalStyles.quotaHint} ${modalStyles.quotaHintLast}`}>
              {modalMode === "create"
                ? t("modelResources.models.modal.quotaTitleDescribe2")
                : t("modelResources.models.modal.quotaTitleDescribe2Edit")}
            </div>
          </>
        ) : null}
      </Form>
      {isView ? (
        <div style={{ marginTop: 8 }}>
          <AppButton type="link" onClick={() => setModalMode("edit")}>
            {t("modelResources.models.modal.switchToEdit")}
          </AppButton>
        </div>
      ) : null}
    </Modal>
  );
}

export { LlmApiGuideDrawer } from "@/modules/model-resources/components/models/api-guide/LlmApiGuideDrawer";

export function LlmMonitorDrawer({
  onClose,
  open,
  record,
}: {
  onClose: () => void;
  open: boolean;
  record: LlmModel | null;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof import("@/modules/model-resources/services/llm.service").getLlmModelMonitor>> | null>(null);

  useEffect(() => {
    if (!open || !record) {
      return;
    }

    setLoading(true);
    void import("@/modules/model-resources/services/llm.service")
      .then(({ getLlmModelMonitor }) => getLlmModelMonitor(record.modelId))
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, record]);

  const sections = [
    {
      key: "averageFirstTokenTime",
      title: t("modelResources.models.monitor.initialSpeed"),
      description: t("modelResources.models.monitor.initialSpeedSub"),
    },
    {
      key: "outputTokenSpeed",
      title: t("modelResources.models.monitor.outputSpeed"),
      description: t("modelResources.models.monitor.outputSpeedSub"),
    },
    {
      key: "totalTokenSpeed",
      title: t("modelResources.models.monitor.tokenThroughput"),
      description: t("modelResources.models.monitor.tokenThroughputSub"),
    },
  ] as const;

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={t("modelResources.models.monitor.title")}
      width={800}
    >
      {loading ? <Spin /> : (
        sections.map((section) => {
          const points = data?.[section.key] ?? [];

          return (
            <div key={section.key} style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 4 }}>{section.title}</h4>
              <p style={{ color: "rgba(15, 30, 54, 0.62)", marginBottom: 12 }}>{section.description}</p>
              <div style={{ display: "grid", gap: 8 }}>
                {points.length === 0 ? (
                  <span>--</span>
                ) : (
                  points.map((point) => (
                    <div key={`${section.key}-${point.time}`}>
                      {point.time}: {point.value}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })
      )}
    </Drawer>
  );
}

export { SmallModelApiGuideDrawer } from "@/modules/model-resources/components/models/api-guide/SmallModelApiGuideDrawer";
