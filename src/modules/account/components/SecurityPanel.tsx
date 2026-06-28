import { Button, Form, Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { changePassword } from "@/modules/account/services/profile.service";

import styles from "./SecurityPanel.module.css";

type FormValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/** 安全 · 自助改密：验当前密码 → 直接设新密码（Path 1 JSON API，无 OAuth/hydra）。 */
export function SecurityPanel({ account }: { account: string }) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: FormValues) => {
    if (!account) return;
    setSubmitting(true);
    try {
      await changePassword(account, values.oldPassword, values.newPassword);
      message.success(t("account.security.success"));
      form.resetFields();
    } catch (error) {
      const status = statusOf(error);
      if (status === 401) {
        form.setFields([{ name: "oldPassword", errors: [t("account.security.oldWrong")] }]);
      } else if (status === 400) {
        form.setFields([{ name: "newPassword", errors: [t("account.security.sameAsOld")] }]);
      } else {
        message.error(t("account.security.failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t("account.security.title")}</h3>
      <p className={styles.hint}>{t("account.security.hint")}</p>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} className={styles.form}>
        <Form.Item
          name="oldPassword"
          label={t("account.security.current")}
          rules={[{ required: true, message: t("account.security.currentRequired") }]}
        >
          <Input.Password autoComplete="current-password" placeholder={t("account.security.currentPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t("account.security.next")}
          rules={[
            { required: true, message: t("account.security.nextRequired") },
            { min: 8, message: t("account.security.nextMin") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (value && value === getFieldValue("oldPassword")) {
                  return Promise.reject(new Error(t("account.security.sameAsOld")));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder={t("account.security.nextPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t("account.security.confirm")}
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: t("account.security.confirmRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value === getFieldValue("newPassword")) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("account.security.mismatch")));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder={t("account.security.confirmPlaceholder")} />
        </Form.Item>
        <Form.Item className={styles.actions}>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={!account}>
            {t("account.security.submit")}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
