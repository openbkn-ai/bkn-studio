/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, DatePicker, Form, Input, Modal, Radio } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { issueApiKey } from "@/modules/api-keys/services/api-key.service";
import type { IssuedApiKey } from "@/modules/api-keys/types/api-key";

type ExpiryMode = "default" | "custom" | "never";

type FormValues = {
  name: string;
  expiryMode: ExpiryMode;
  expiryDate?: Dayjs;
};

export function IssueApiKeyModal({
  open,
  onCancel,
  onIssued,
}: {
  open: boolean;
  onCancel: () => void;
  onIssued: (issued: IssuedApiKey) => void;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const expiryMode = Form.useWatch("expiryMode", form) ?? "default";

  const handleClose = () => {
    form.resetFields();
    onCancel();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const issued = await issueApiKey({
        name: values.name.trim(),
        ...(values.expiryMode === "never" ? { neverExpire: true } : {}),
        ...(values.expiryMode === "custom" && values.expiryDate
          ? { expiresAt: values.expiryDate.toISOString() }
          : {}),
      });
      form.resetFields();
      onIssued(issued);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        form.setFields([{ name: "name", errors: [t("apiKeys.issueModal.dupName")] }]);
      } else {
        message.error(extractRequestErrorMessage(error) || t("apiKeys.issueFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("apiKeys.issueModal.title")}
      okText={t("apiKeys.issueModal.submit")}
      confirmLoading={submitting}
      onOk={() => void handleSubmit()}
      onCancel={handleClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ expiryMode: "default" }} preserve={false}>
        <Form.Item
          name="name"
          label={t("apiKeys.issueModal.name")}
          rules={[{ required: true, whitespace: true, message: t("apiKeys.issueModal.nameRequired") }]}
        >
          <Input maxLength={64} placeholder={t("apiKeys.issueModal.namePlaceholder")} />
        </Form.Item>

        <Form.Item name="expiryMode" label={t("apiKeys.issueModal.expiry")}>
          <Radio.Group>
            <Radio.Button value="default">{t("apiKeys.issueModal.expiryDefault")}</Radio.Button>
            <Radio.Button value="custom">{t("apiKeys.issueModal.expiryCustom")}</Radio.Button>
            <Radio.Button value="never">{t("apiKeys.issueModal.expiryNever")}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {expiryMode === "custom" ? (
          <Form.Item
            name="expiryDate"
            label={t("apiKeys.issueModal.expiryDate")}
            rules={[
              { required: true, message: t("apiKeys.issueModal.expiryDateRequired") },
              {
                validator: (_rule, value: Dayjs | undefined) =>
                  value && value.isAfter(dayjs())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t("apiKeys.issueModal.expiryFuture"))),
              },
            ]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={(current) => current && current.isBefore(dayjs().startOf("day"))}
            />
          </Form.Item>
        ) : null}

        {expiryMode === "never" ? (
          <Alert type="warning" showIcon message={t("apiKeys.issueModal.neverWarn")} />
        ) : null}
      </Form>
    </Modal>
  );
}
