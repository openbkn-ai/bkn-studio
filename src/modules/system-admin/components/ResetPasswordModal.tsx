/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined } from "@ant-design/icons";
import { Form, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { resetUserPassword } from "@/modules/system-admin/services/admin.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";

import styles from "@/modules/system-admin/scenes/admin.module.css";
import modalStyles from "@/modules/system-admin/components/ResetPasswordModal.module.css";

type ResetFormValues = {
  confirm: string;
  password: string;
};

type ResetPasswordModalProps = {
  onClose: () => void;
  open: boolean;
  user: AdminUser;
};

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function ResetPasswordModal({ onClose, open, user }: ResetPasswordModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ResetFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        await resetUserPassword(user.id, values.password);
        message.success(t("systemAdmin.users.reset.success", { name: user.name }));
        onClose();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      destroyOnClose
      okText={t("systemAdmin.users.reset.submit")}
      onCancel={onClose}
      onOk={handleSubmit}
      open={open}
      rootClassName={[styles.adminOverlay, modalStyles.resetPasswordModal].join(" ")}
      title={t("systemAdmin.users.reset.title", { name: user.name })}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t("systemAdmin.users.reset.newPassword")}
          name="password"
          rules={[
            { required: true, message: t("common.required") },
            { pattern: STRONG_PASSWORD, message: t("systemAdmin.users.reset.weak") },
          ]}
        >
          <Input.Password placeholder={t("systemAdmin.users.reset.newPasswordPlaceholder")} />
        </Form.Item>
        <Form.Item
          dependencies={["password"]}
          label={t("systemAdmin.users.reset.confirm")}
          name="confirm"
          rules={[
            { required: true, message: t("common.required") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("systemAdmin.users.reset.mismatch")));
              },
            }),
          ]}
        >
          <Input.Password placeholder={t("systemAdmin.users.reset.confirmPlaceholder")} />
        </Form.Item>
      </Form>
      <div className={styles.calloutBox}>
        <InfoCircleOutlined />
        <span>{t("systemAdmin.users.reset.note")}</span>
      </div>
    </Modal>
  );
}
