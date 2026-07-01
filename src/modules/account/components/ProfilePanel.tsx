/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { updateMyProfile, type MyProfile } from "@/modules/account/services/profile.service";

import styles from "./ProfilePanel.module.css";

type FormValues = { name: string; email: string; telephone: string };

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function formatTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** 资料 · 基本信息自助编辑（PUT /me）+ 账号信息只读展示。 */
export function ProfilePanel({ profile, onSaved }: { profile: MyProfile; onSaved: (next: MyProfile) => void }) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({ name: profile.name, email: profile.email, telephone: profile.telephone });
  }, [form, profile]);

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const next = await updateMyProfile({
        name: values.name.trim(),
        email: values.email.trim(),
        telephone: values.telephone.trim(),
      });
      onSaved(next);
      message.success(t("account.profile.saved"));
    } catch (error) {
      if (statusOf(error) === 400) {
        message.error(t("account.profile.invalid"));
      } else {
        message.error(t("account.profile.saveFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const readonly: { label: string; value: string }[] = [
    { label: t("account.profile.account"), value: profile.account },
    { label: t("account.profile.accountType"), value: profile.accountType || "—" },
    {
      label: t("account.profile.status"),
      value: profile.enabled ? t("account.profile.enabled") : t("account.profile.disabled"),
    },
    { label: t("account.profile.departments"), value: profile.departments.join("、") || "—" },
    { label: t("account.profile.roles"), value: profile.roles.join("、") || "—" },
    { label: t("account.profile.updatedAt"), value: formatTime(profile.updatedAt) },
  ];

  return (
    <div className={styles.panel}>
      <section className={styles.block}>
        <h3 className={styles.title}>{t("account.profile.basicTitle")}</h3>
        <p className={styles.hint}>{t("account.profile.basicHint")}</p>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} className={styles.form}>
          <Form.Item
            name="name"
            label={t("account.profile.name")}
            rules={[
              { required: true, whitespace: true, message: t("account.profile.nameRequired") },
              { max: 255, message: t("account.profile.nameMax") },
            ]}
          >
            <Input placeholder={t("account.profile.namePlaceholder")} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("account.profile.email")}
            rules={[{ type: "email", message: t("account.profile.emailInvalid") }]}
          >
            <Input placeholder={t("account.profile.emailPlaceholder")} allowClear />
          </Form.Item>
          <Form.Item
            name="telephone"
            label={t("account.profile.telephone")}
            rules={[{ max: 64, message: t("account.profile.telephoneMax") }]}
          >
            <Input placeholder={t("account.profile.telephonePlaceholder")} allowClear />
          </Form.Item>
          <Form.Item className={styles.actions}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t("account.profile.submit")}
            </Button>
          </Form.Item>
        </Form>
      </section>

      <section className={styles.block}>
        <h3 className={styles.title}>{t("account.profile.accountTitle")}</h3>
        <p className={styles.hint}>{t("account.profile.accountHint")}</p>
        <dl className={styles.infoGrid}>
          {readonly.map((row) => (
            <div key={row.label} className={styles.infoRow}>
              <dt className={styles.infoLabel}>{row.label}</dt>
              <dd className={styles.infoValue}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
