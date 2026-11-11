/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Collapse, Form, Input, Modal, Select, Space, Switch, Typography } from "antd";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import {
  listSSOProviders,
  saveSSOProvider,
  testSSOProvider,
  type SSOProvider,
  type SSOProviderInput,
  type SSOProviderPage,
} from "@/modules/system-admin/services/sso-provider.service";

import { SSODirectorySyncModal } from "../components/SSODirectorySyncModal";

export function SSOManagementScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [page, setPage] = useState<SSOProviderPage>({ entries: [], total: 0, next_cursor: null });
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SSOProvider>();
  const [syncProvider, setSyncProvider] = useState<SSOProvider>();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<SSOProviderInput>();
  const loginEnabled = Form.useWatch("login_enabled", form);
  const exchangeEnabled = Form.useWatch("exchange_enabled", form);
  const redirectURI = Form.useWatch("redirect_uri", form);
  const secretEnv = Form.useWatch("client_secret_env", form);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPage(await listSSOProviders(cursor));
    } catch (e) {
      setError(extractRequestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  const label = (key: string) => t(`systemAdmin.sso.${key}`);
  const showError = (e: unknown) => {
    if (axios.isAxiosError<{ field?: string }>(e) && e.response?.data.field) {
      form.setFields([
        { name: e.response.data.field as keyof SSOProviderInput, errors: [label("invalidField")] },
      ]);
    }
    const code = axios.isAxiosError<{ error_code?: string }>(e)
      ? e.response?.data.error_code
      : undefined;
    const known = [
      "INVALID_PARAMETER",
      "RESOURCE_EXISTED",
      "RESOURCE_NOT_FOUND",
      "SSO_IDENTITY_BOUND",
      "SSO_DISCOVERY_FAILED",
      "SSO_JWKS_FAILED",
      "INTERNAL_ERROR",
    ];
    void message.error(
      code && known.includes(code)
        ? t(`systemAdmin.sso.errors.${code}`)
        : extractRequestErrorMessage(e),
    );
  };
  const edit = (entry?: SSOProvider) => {
    setEditing(entry);
    form.resetFields();
    if (entry) {
      // Never put credential-presence metadata into a write document.
      const { has_client_secret: _hasSecret, ...config } = entry;
      void _hasSecret;
      form.setFieldsValue({ ...config, client_secret: undefined });
    } else {
      form.setFieldsValue({
        id: "",
        display_name: "",
        protocol: "oidc",
        adapter: "casdoor",
        issuer: "",
        discovery_url: "",
        client_id: "",
        client_secret_env: "",
        redirect_uri: "",
        scopes: "openid profile email",
        department_claim: "groups",
        allowed_client_ids: "",
        exchange_audience: "",
        external_required_scope: "read",
        hydra_issue_scope: "openid",
        login_enabled: true,
        exchange_enabled: false,
        enabled: true,
        default_for_login: false,
        allow_insecure_http: false,
      });
    }
    setOpen(true);
  };
  const toggle = (entry: SSOProvider) => {
    modal.confirm({
      title: label(entry.enabled ? "disableConfirm" : "enableConfirm"),
      content: entry.display_name,
      onOk: async () => {
        try {
          await saveSSOProvider(
            { enabled: !entry.enabled, ...(!entry.enabled ? {} : { default_for_login: false }) },
            entry.id,
          );
          await load();
        } catch (e) {
          showError(e);
          throw e;
        }
      },
    });
  };
  const submit = async (values: SSOProviderInput) => {
    const persist = async () => {
      setBusy(true);
      try {
        await saveSSOProvider(values, editing?.id);
        setOpen(false);
        void message.success(label("saved"));
        await load();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    };
    if (values.default_for_login)
      modal.confirm({
        title: label("defaultConfirm"),
        content: label("defaultHint"),
        onOk: persist,
      });
    else await persist();
  };
  const test = async () => {
    await form.validateFields();
    const values = form.getFieldsValue(true) as SSOProviderInput;
    setBusy(true);
    try {
      await testSSOProvider(values);
      void message.success(label("testPassed"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const text = (name: keyof SSOProviderInput, required = false) => (
    <Form.Item
      key={name}
      name={name}
      label={label(name)}
      rules={required ? [{ required: true, message: label("required") }] : []}
    >
      <Input />
    </Form.Item>
  );
  const flag = (name: keyof SSOProviderInput) => (
    <Form.Item key={name} name={name} label={label(name)} valuePropName="checked">
      <Switch />
    </Form.Item>
  );
  return (
    <section>
      <SSODirectorySyncModal provider={syncProvider} onClose={() => setSyncProvider(undefined)} />
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Title level={3}>{label("title")}</Typography.Title>
        <Typography.Paragraph>{label("description")}</Typography.Paragraph>
        <Space>
          <AppButton type="primary" onClick={() => edit()}>
            {label("add")}
          </AppButton>
          <AppButton onClick={() => void load()} loading={loading}>
            {label("refresh")}
          </AppButton>
        </Space>
        {error && <Alert type="error" showIcon message={error} />}
        <AppTable<SSOProvider>
          rowKey="id"
          loading={loading}
          dataSource={page.entries}
          pagination={false}
          columns={[
            { title: label("display_name"), dataIndex: "display_name" },
            { title: label("adapter"), dataIndex: "adapter" },
            { title: label("enabled"), render: (_, row) => label(row.enabled ? "yes" : "no") },
            {
              title: label("login_enabled"),
              render: (_, row) => label(row.login_enabled ? "yes" : "no"),
            },
            {
              title: label("exchange_enabled"),
              render: (_, row) => label(row.exchange_enabled ? "yes" : "no"),
            },
            {
              title: label("default_for_login"),
              render: (_, row) => label(row.default_for_login ? "yes" : "no"),
            },
            {
              title: label("actions"),
              render: (_, row) => (
                <Space>
                  <AppButton onClick={() => edit(row)}>{label("edit")}</AppButton>
                  {row.adapter === "casdoor" && (
                    <AppButton onClick={() => setSyncProvider(row)}>
                      {label("sync.title")}
                    </AppButton>
                  )}
                  <AppButton onClick={() => toggle(row)}>
                    {label(row.enabled ? "disable" : "enable")}
                  </AppButton>
                </Space>
              ),
            },
          ]}
        />
        <Space>
          <AppButton
            disabled={cursors.length === 1 || loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {label("previous")}
          </AppButton>
          <AppButton
            disabled={!page.next_cursor || loading}
            onClick={() => setCursors((v) => [...v, page.next_cursor ?? undefined])}
          >
            {label("next")}
          </AppButton>
          <span>{t("systemAdmin.sso.total", { count: page.total })}</span>
        </Space>
      </Space>
      <Modal
        title={label(editing ? "edit" : "add")}
        open={open}
        width={760}
        destroyOnHidden
        afterClose={() => form.resetFields()}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <Space>
            <AppButton disabled={busy} onClick={() => setOpen(false)}>
              {label("cancel")}
            </AppButton>
            <AppButton
              loading={busy}
              onClick={() => {
                void test().catch(() => undefined);
              }}
            >
              {label("test")}
            </AppButton>
            <AppButton loading={busy} type="primary" onClick={() => form.submit()}>
              {label("save")}
            </AppButton>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={() => void submit(form.getFieldsValue(true) as SSOProviderInput)}
          onValuesChange={(changed: Partial<SSOProviderInput>, values: SSOProviderInput) => {
            if (changed.issuer !== undefined && !editing)
              form.setFieldValue(
                "discovery_url",
                `${changed.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
              );
            if (changed.id !== undefined && !editing)
              form.setFieldValue(
                "redirect_uri",
                `${window.location.origin}/sso/callback/${changed.id}`,
              );
            if (changed.enabled === false || changed.login_enabled === false)
              form.setFieldValue("default_for_login", false);
            if (changed.adapter === "casdoor" && !values.department_claim)
              form.setFieldValue("department_claim", "groups");
          }}
        >
          <Form.Item name="protocol" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="client_secret_env" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="id"
            label={label("id")}
            rules={[
              { required: true, message: label("required") },
              { pattern: /^[a-z0-9-]{1,64}$/, message: label("idFormat") },
            ]}
          >
            <Input disabled={!!editing} />
          </Form.Item>
          {text("display_name", true)}
          <Form.Item name="adapter" label={label("adapter")}>
            <Select
              options={[
                { value: "casdoor", label: "Casdoor" },
                { value: "generic", label: label("generic") },
              ]}
            />
          </Form.Item>
          {text("issuer", true)}
          {text("discovery_url", true)}
          {text("client_id", true)}
          <Form.Item
            name="client_secret"
            label={label("client_secret")}
            extra={editing?.has_client_secret ? label("secretKept") : label("secretHint")}
            rules={
              !editing?.has_client_secret ? [{ required: true, message: label("required") }] : []
            }
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          {secretEnv && (
            <Alert
              type="info"
              message={label("envSecret")}
              description={
                <Space direction="vertical">
                  <span>{secretEnv}</span>
                  <AppButton onClick={() => form.setFieldValue("client_secret_env", "")}>
                    {label("useDatabaseSecret")}
                  </AppButton>
                </Space>
              }
            />
          )}
          {flag("enabled")}
          {flag("login_enabled")}
          {loginEnabled && (
            <>
              {text("redirect_uri", true)}
              <Typography.Paragraph copyable={{ text: redirectURI }}>
                {label("callbackHint")}
              </Typography.Paragraph>
              {text("scopes")}
              {flag("default_for_login")}
            </>
          )}
          {flag("exchange_enabled")}
          {exchangeEnabled && (
            <>
              {text("allowed_client_ids", true)}
              {text("exchange_audience", true)}
              {text("external_required_scope", true)}
              {text("hydra_issue_scope", true)}
              <Typography.Paragraph>{label("exchangeHint")}</Typography.Paragraph>
            </>
          )}
          <Collapse
            items={[
              {
                key: "advanced",
                label: label("advanced"),
                children: (
                  <>
                    {text("department_claim")}
                    {flag("allow_insecure_http")}
                    <Typography.Paragraph>{label("httpHint")}</Typography.Paragraph>
                  </>
                ),
              },
            ]}
          />
          <Typography.Paragraph>{label("testHint")}</Typography.Paragraph>
        </Form>
      </Modal>
    </section>
  );
}
