/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import {
  Alert,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  getDirectorySync,
  saveDirectorySync,
  runDirectorySync,
  type DirectorySyncInput,
  type DirectorySyncView,
  type SSOProvider,
} from "../services/sso-provider.service";

export function SSODirectorySyncModal({
  provider,
  onClose,
}: {
  provider?: SSOProvider;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const label = (key: string) => t(`systemAdmin.sso.sync.${key}`);
  const [form] = Form.useForm<DirectorySyncInput>();
  const [view, setView] = useState<DirectorySyncView>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!provider) return;
    let active = true;
    setView(undefined);
    setError("");
    form.resetFields();
    const load = async (initial: boolean) => {
      try {
        const value = await getDirectorySync(provider.id);
        if (!active) return;
        setView(value);
        setError("");
        if (initial)
          form.setFieldsValue({
            enabled: value.config.enabled,
            organization: value.config.organization,
            interval_seconds: value.config.interval_seconds,
          });
      } catch (e) {
        if (active) setError(extractRequestErrorMessage(e));
      }
    };
    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [provider, form]);
  const save = async (input: DirectorySyncInput) => {
    if (!provider) return;
    setBusy(true);
    try {
      setView(await saveDirectorySync(provider.id, input));
      form.setFieldValue("webhook_secret", undefined);
      void message.success(label("saved"));
    } catch (e) {
      setError(extractRequestErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      await runDirectorySync(provider.id);
      void message.success(label("queued"));
    } catch (e) {
      setError(extractRequestErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  let origin = window.location.origin;
  try {
    if (provider?.redirect_uri) origin = new URL(provider.redirect_uri).origin;
  } catch {
    /* Keep the browser origin if a stored URI is malformed. */
  }
  return (
    <Modal
      open={!!provider}
      title={label("title")}
      width={760}
      onCancel={() => {
        if (!busy) onClose();
      }}
      destroyOnHidden
      footer={
        <Space>
          <AppButton disabled={busy} onClick={onClose}>
            {label("close")}
          </AppButton>
          <AppButton
            disabled={!view?.config.enabled || !provider?.enabled || !view || view.running}
            loading={busy}
            onClick={() => {
              void run();
            }}
          >
            {label("run")}
          </AppButton>
          <AppButton type="primary" disabled={!view} loading={busy} onClick={() => form.submit()}>
            {label("save")}
          </AppButton>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Alert type="info" showIcon message={label("scopeHint")} />
        {error && <Alert type="error" message={error} />}
        {view && (
          <>
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: DirectorySyncInput) => {
                void save(values);
              }}
            >
              <Form.Item name="enabled" label={label("enabled")} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                name="organization"
                label={label("organization")}
                rules={[
                  { required: true },
                  { pattern: /^[a-zA-Z0-9_.-]{1,100}$/, message: label("organizationFormat") },
                ]}
              >
                <Input disabled={!!view.config.organization} />
              </Form.Item>
              <Form.Item
                name="interval_seconds"
                label={label("interval")}
                rules={[{ required: true }]}
              >
                <InputNumber min={60} max={86400} precision={0} />
              </Form.Item>
              <Form.Item
                name="webhook_secret"
                label={label("secret")}
                extra={label(view.has_webhook_secret ? "secretKept" : "secretHint")}
                rules={[{ required: !view.has_webhook_secret }, { min: 32, max: 256 }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <AppButton
                onClick={() => {
                  const bytes = crypto.getRandomValues(new Uint8Array(32));
                  form.setFieldValue(
                    "webhook_secret",
                    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
                  );
                }}
              >
                {label("generate")}
              </AppButton>
            </Form>
            <Typography.Paragraph copyable={{ text: origin + view.webhook_path }}>
              {label("webhook")}: {origin + view.webhook_path}
            </Typography.Paragraph>
            <Typography.Paragraph>{label("webhookHint")}</Typography.Paragraph>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: "state",
                  label: label("state"),
                  children: label(view.running ? "running" : "idle"),
                },
                {
                  key: "success",
                  label: label("lastSuccess"),
                  children: view.config.last_success_at || "—",
                },
                {
                  key: "error",
                  label: label("lastError"),
                  children: view.config.last_error_code ? label(view.config.last_error_code) : "—",
                },
                { key: "users", label: label("users"), children: view.config.users },
                {
                  key: "departments",
                  label: label("departments"),
                  children: view.config.departments,
                },
                {
                  key: "disabled",
                  label: label("disabledUsers"),
                  children: view.config.disabled_users,
                },
                {
                  key: "retained",
                  label: label("retainedDepartments"),
                  children: view.config.retained_departments,
                },
              ]}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
