/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { enableKnVersioning } from "@/modules/knowledge-network/services/kn-version.service";

type EnableVersioningModalProps = {
  networkId: string;
  onClose: () => void;
  onEnabled: () => void;
  open: boolean;
};

type FormValues = { label?: string; notes?: string };

/** Turns versioning on; the dialog says plainly that edits need a publish to take effect. */
export function EnableVersioningModal({
  networkId,
  onClose,
  onEnabled,
  open,
}: EnableVersioningModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    setError(null);
    try {
      await enableKnVersioning(networkId, values);
      form.resetFields();
      onEnabled();
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      destroyOnHidden
      okText={t("knowledgeNetwork.versions.enable.action")}
      onCancel={onClose}
      onOk={() => void submit()}
      open={open}
      title={t("knowledgeNetwork.versions.enable.title")}
    >
      <Alert
        message={t("knowledgeNetwork.versions.enable.warning")}
        showIcon
        style={{ marginBottom: 16 }}
        type="warning"
      />
      <Form<FormValues> form={form} layout="vertical">
        <Form.Item label={t("knowledgeNetwork.versions.publish.label")} name="label">
          <Input maxLength={64} placeholder="v1.0.0" />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.versions.publish.notes")} name="notes">
          <Input.TextArea maxLength={1000} rows={3} showCount />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon type="error" /> : null}
    </Modal>
  );
}
