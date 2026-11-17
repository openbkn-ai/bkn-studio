/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import {
  CopyOutlined,
  DownOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Collapse,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tooltip,
} from "antd";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  listSSOProviders,
  deleteSSOProvider,
  saveSSOProvider,
  testSSOProvider,
  type SSOProvider,
  type SSOProviderInput,
  type SSOProviderPage,
} from "@/modules/system-admin/services/sso-provider.service";

import { SSODirectorySyncModal } from "../components/SSODirectorySyncModal";
import styles from "./admin.module.css";
import ssoStyles from "./SSOManagementScene.module.css";

export function SSOManagementScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [page, setPage] = useState<SSOProviderPage>({ entries: [], total: 0, next_cursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SSOProvider>();
  const [syncProvider, setSyncProvider] = useState<SSOProvider>();
  const [busy, setBusy] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    discovery: "passed" | "failed";
    keys: "passed" | "failed" | "notChecked";
  }>();
  const [advancedKeys, setAdvancedKeys] = useState<string[]>([]);
  const [form] = Form.useForm<SSOProviderInput>();
  const manualURLs = useRef({ discovery: false, callback: false });
  const providerEnabled = Form.useWatch("enabled", form);
  const loginEnabled = Form.useWatch("login_enabled", form);
  const exchangeEnabled = Form.useWatch("exchange_enabled", form);
  const redirectURI = Form.useWatch("redirect_uri", form);
  const secretEnv = Form.useWatch("client_secret_env", form);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const entries: SSOProvider[] = [];
      const seenCursors = new Set<string>();
      let pageCount = 0;
      let cursor: string | undefined;
      let result: SSOProviderPage;
      do {
        if (++pageCount > 100 || (cursor && seenCursors.has(cursor))) {
          setError("SSO_PROVIDER_PAGINATION_FAILED");
          return;
        }
        if (cursor) seenCursors.add(cursor);
        result = await listSSOProviders(cursor);
        entries.push(...result.entries);
        cursor = result.next_cursor ?? undefined;
      } while (cursor);
      setPage({ ...result, entries, next_cursor: null });
    } catch (e) {
      setError(extractRequestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const label = (key: string) => t(`systemAdmin.sso.${key}`);
  const showError = (e: unknown) => {
    if (axios.isAxiosError<{ field?: string }>(e) && e.response?.data.field) {
      if (["department_claim", "allow_insecure_http"].includes(e.response.data.field))
        setAdvancedKeys(["advanced"]);
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
    setConnectionResult(undefined);
    setAdvancedKeys([]);
    setEditing(entry);
    manualURLs.current = { discovery: false, callback: false };
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
        login_enabled: false,
        exchange_enabled: false,
        enabled: true,
        default_for_login: false,
        allow_insecure_http: true,
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
  const remove = (entry: SSOProvider) => {
    modal.confirm({
      title: label("deleteConfirm"),
      content: t("systemAdmin.sso.deleteHint", { name: entry.display_name, id: entry.id }),
      okText: label("delete"),
      cancelText: label("cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSSOProvider(entry.id);
          void message.success(label("deleted"));
          await load();
        } catch (e) {
          const code = axios.isAxiosError<{ error_code?: string }>(e)
            ? e.response?.data.error_code
            : undefined;
          void message.error(
            code &&
              ["SSO_PROVIDER_IN_USE", "SSO_PROVIDER_ACTIVE", "RESOURCE_NOT_FOUND"].includes(code)
              ? t(`systemAdmin.sso.errors.${code}`)
              : extractRequestErrorMessage(e),
          );
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
    setConnectionResult(undefined);
    await form.validateFields();
    const values = form.getFieldsValue(true) as SSOProviderInput;
    setBusy(true);
    try {
      await testSSOProvider(values);
      setConnectionResult({ discovery: "passed", keys: "passed" });
    } catch (e) {
      const code = axios.isAxiosError<{ error_code?: string }>(e)
        ? e.response?.data.error_code
        : undefined;
      if (code === "SSO_DISCOVERY_FAILED")
        setConnectionResult({ discovery: "failed", keys: "notChecked" });
      else if (code === "SSO_JWKS_FAILED")
        setConnectionResult({ discovery: "passed", keys: "failed" });
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const text = (name: keyof SSOProviderInput, required = false, wide = false, hint?: string) => (
    <Form.Item
      key={name}
      name={name}
      className={wide ? ssoStyles.fullWidth : undefined}
      label={label(name)}
      tooltip={hint}
      rules={required ? [{ required: true, message: label("required") }] : []}
    >
      <Input />
    </Form.Item>
  );
  const tokens = (name: keyof SSOProviderInput, required = false, hint?: string) => (
    <Form.Item
      key={name}
      name={name}
      label={label(name)}
      tooltip={hint ?? label("multiValueHint")}
      rules={required ? [{ required: true, message: label("required") }] : []}
      getValueProps={(value?: string) => ({ value: value?.split(/\s+/).filter(Boolean) ?? [] })}
      normalize={(values: string[]) =>
        values
          .flatMap((value) => value.split(/\s+/))
          .filter(Boolean)
          .join(" ")
      }
    >
      <Select
        mode="tags"
        open={false}
        tokenSeparators={[" ", "\n", "\t"]}
        placeholder={label("multiValueHint")}
      />
    </Form.Item>
  );
  const flag = (name: keyof SSOProviderInput, disabled = false, hint?: string) => (
    <Form.Item
      key={name}
      name={name}
      label={label(name)}
      tooltip={hint}
      valuePropName="checked"
      layout="horizontal"
      labelCol={{ flex: "auto" }}
      wrapperCol={{ flex: "none" }}
      labelAlign="left"
      colon={false}
      className={ssoStyles.switchField}
    >
      <Switch disabled={disabled || busy} />
    </Form.Item>
  );
  const capabilityCell = (enabled: boolean, provider: SSOProvider) =>
    provider.enabled ? (
      label(enabled ? "yes" : "no")
    ) : (
      <Tooltip title={label("inactiveHint")}>
        <span className={ssoStyles.inactiveCapability}>
          {label(enabled ? "yes" : "no")} <InfoCircleOutlined aria-hidden />
        </span>
      </Tooltip>
    );
  return (
    <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>
      <SSODirectorySyncModal provider={syncProvider} onClose={() => setSyncProvider(undefined)} />
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <AppButton type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => edit()}>
              {label("add")}
            </AppButton>
            <AppButton
              icon={<ReloadOutlined aria-hidden />}
              onClick={() => void load()}
              loading={loading}
            >
              {label("refresh")}
            </AppButton>
          </div>
          <span className={styles.toolbarMeta}>{label("description")}</span>
        </div>
      </div>
      <div className={styles.tableSurface}>
        {error && (
          <Alert
            type="error"
            showIcon
            message={error === "SSO_PROVIDER_PAGINATION_FAILED" ? label("paginationFailed") : error}
          />
        )}
        <AppTable<SSOProvider>
          rowKey="id"
          loading={loading}
          dataSource={page.entries}
          pagination={false}
          scroll={{ x: 820 }}
          columns={[
            {
              title: label("display_name"),
              dataIndex: "display_name",
              render: (_, row) => (
                <div className={styles.nameCell}>
                  <div className={ssoStyles.providerName}>
                    <span className={ssoStyles.nameText} title={row.display_name}>
                      {row.display_name}
                    </span>
                    {row.default_for_login && (
                      <LightStatusTag tone="info">{label("defaultBadge")}</LightStatusTag>
                    )}
                  </div>
                  <span className={ssoStyles.providerId} title={row.id}>
                    {row.id}
                  </span>
                </div>
              ),
            },
            {
              title: label("adapter"),
              dataIndex: "adapter",
              width: 130,
              render: (adapter: SSOProvider["adapter"]) =>
                adapter === "casdoor" ? "Casdoor" : label("generic"),
            },
            {
              title: label("status"),
              width: 110,
              render: (_, row) => (
                <LightStatusTag tone={row.enabled ? "success" : "neutral"}>
                  {label(row.enabled ? "enabledStatus" : "disabledStatus")}
                </LightStatusTag>
              ),
            },
            {
              title: label("login_enabled"),
              width: 120,
              render: (_, row) => capabilityCell(row.login_enabled, row),
            },
            {
              title: label("exchange_enabled"),
              width: 150,
              render: (_, row) => capabilityCell(row.exchange_enabled, row),
            },
            {
              title: label("actions"),
              fixed: "right",
              width: 140,
              render: (_, row) => (
                <Space size="small">
                  <AppButton
                    type="link"
                    size="small"
                    className={styles.actionLink}
                    onClick={() => edit(row)}
                  >
                    {label("edit")}
                  </AppButton>
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        ...(row.adapter === "casdoor"
                          ? [
                              {
                                key: "sync",
                                label: label("sync.title"),
                                onClick: () => setSyncProvider(row),
                              },
                            ]
                          : []),
                        {
                          key: "toggle",
                          label: label(row.enabled ? "disable" : "enable"),
                          onClick: () => toggle(row),
                        },
                        { type: "divider" },
                        {
                          key: "delete",
                          label: label("delete"),
                          danger: true,
                          disabled: row.enabled || row.default_for_login,
                          title:
                            row.enabled || row.default_for_login
                              ? label("deleteDisabledHint")
                              : undefined,
                          onClick: () => remove(row),
                        },
                      ],
                    }}
                  >
                    <AppButton type="link" size="small" className={styles.actionLink}>
                      {label("more")}
                      <DownOutlined aria-hidden />
                    </AppButton>
                  </Dropdown>
                </Space>
              ),
            },
          ]}
        />
      </div>
      <div className={ssoStyles.pagination}>
        <span>{t("systemAdmin.sso.total", { count: page.total })}</span>
      </div>
      <Modal
        rootClassName={styles.adminOverlay}
        title={label(editing ? "edit" : "add")}
        open={open}
        width={760}
        styles={{ body: { maxHeight: "min(68vh, 720px)", overflowY: "auto" } }}
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
              title={label("testHint")}
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
          disabled={busy}
          className={ssoStyles.providerForm}
          scrollToFirstError={{ focus: true }}
          onFinish={() => void submit(form.getFieldsValue(true) as SSOProviderInput)}
          onValuesChange={(changed: Partial<SSOProviderInput>, values: SSOProviderInput) => {
            setConnectionResult(undefined);
            if (changed.discovery_url !== undefined) manualURLs.current.discovery = true;
            if (changed.redirect_uri !== undefined) manualURLs.current.callback = true;
            if (changed.issuer !== undefined && !editing && !manualURLs.current.discovery)
              form.setFieldValue(
                "discovery_url",
                changed.issuer
                  ? `${changed.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`
                  : "",
              );
            if (changed.id !== undefined && !editing && !manualURLs.current.callback)
              form.setFieldValue(
                "redirect_uri",
                changed.id ? `${window.location.origin}/sso/callback/${changed.id}` : "",
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
          <Form.Item name="enabled" hidden valuePropName="checked">
            <Switch />
          </Form.Item>
          <section className={ssoStyles.formSection} aria-labelledby="sso-provider-section">
            <h3 id="sso-provider-section" className={ssoStyles.sectionTitle}>
              {label("sections.provider")}
            </h3>
            <div className={ssoStyles.formGrid}>
              {text("display_name", true, true)}
              <Form.Item
                className={ssoStyles.fullWidth}
                name="id"
                label={label("id")}
                extra={label("idHint")}
                rules={[
                  { required: true, message: label("required") },
                  { pattern: /^[a-z0-9-]{1,64}$/, message: label("idFormat") },
                ]}
              >
                <Input disabled={!!editing || busy} />
              </Form.Item>
              <Form.Item className={ssoStyles.fullWidth} name="adapter" label={label("adapter")}>
                <Select
                  options={[
                    { value: "casdoor", label: "Casdoor" },
                    { value: "generic", label: label("generic") },
                  ]}
                />
              </Form.Item>
              {text("issuer", true, true)}
              {text("discovery_url", true, true, label("discoveryHint"))}
              {text("client_id", true, true, label("clientIdHint"))}
              <Form.Item
                className={ssoStyles.fullWidth}
                name="client_secret"
                label={label("client_secret")}
                extra={editing?.has_client_secret ? label("secretKept") : undefined}
                tooltip={label("secretHint")}
                rules={
                  !editing?.has_client_secret
                    ? [{ required: true, message: label("required") }]
                    : []
                }
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder={editing?.has_client_secret ? "********" : undefined}
                />
              </Form.Item>
            </div>
            {secretEnv && (
              <Alert
                type="info"
                message={label("envSecret")}
                description={
                  <Space direction="vertical">
                    <span>{secretEnv}</span>
                    <AppButton
                      onClick={() => {
                        form.setFieldValue("client_secret_env", "");
                        setConnectionResult(undefined);
                      }}
                    >
                      {label("useDatabaseSecret")}
                    </AppButton>
                  </Space>
                }
              />
            )}
          </section>
          <section className={ssoStyles.formSection}>
            {flag("login_enabled")}
            {loginEnabled && (
              <div className={ssoStyles.dependentFields}>
                <Form.Item
                  name="redirect_uri"
                  label={label("redirect_uri")}
                  tooltip={label("callbackHint")}
                  rules={[{ required: true, message: label("required") }]}
                >
                  <Input
                    suffix={
                      <AppButton
                        type="text"
                        size="small"
                        icon={<CopyOutlined aria-hidden />}
                        aria-label={label("copyCallback")}
                        title={label("copyCallback")}
                        disabled={!redirectURI || busy}
                        onClick={() => {
                          if (!redirectURI) return;
                          void writeTextToClipboard(redirectURI).then(
                            () => message.success(t("common.copySuccess")),
                            () => message.error(label("copyFailed")),
                          );
                        }}
                      />
                    }
                  />
                </Form.Item>
                {tokens("scopes")}
                {flag("default_for_login", !providerEnabled)}
                <p className={ssoStyles.sectionDescription}>{label("defaultAvailableHint")}</p>
              </div>
            )}
          </section>
          <section className={ssoStyles.formSection}>
            {flag("exchange_enabled")}
            {exchangeEnabled && (
              <div className={ssoStyles.dependentFields}>
                {tokens("allowed_client_ids", true, label("externalClientHint"))}
                {tokens("exchange_audience", true, label("audienceHint"))}
                {tokens("external_required_scope", true, label("externalScopeHint"))}
                {tokens("hydra_issue_scope", true, label("issuedScopeHint"))}
              </div>
            )}
          </section>
          <Collapse
            className={ssoStyles.advancedSection}
            ghost
            activeKey={advancedKeys}
            onChange={(keys) => setAdvancedKeys(typeof keys === "string" ? [keys] : keys)}
            items={[
              {
                key: "advanced",
                label: label("sections.advanced"),
                forceRender: true,
                children: (
                  <>
                    {text("department_claim", false, false, label("departmentHint"))}
                    {flag("allow_insecure_http", false, label("httpHint"))}
                  </>
                ),
              },
            ]}
          />
          {connectionResult && (
            <Alert
              showIcon
              type={connectionResult.keys === "passed" ? "success" : "error"}
              message={label(
                connectionResult.keys === "passed"
                  ? "connectionChecks.passedTitle"
                  : "connectionChecks.failedTitle",
              )}
              description={
                <ul className={ssoStyles.checkResults}>
                  <li>
                    {label("connectionChecks.discovery")}:{" "}
                    {label(`connectionChecks.${connectionResult.discovery}`)}
                  </li>
                  <li>
                    {label("connectionChecks.keys")}:{" "}
                    {label(`connectionChecks.${connectionResult.keys}`)}
                  </li>
                  <li>{label("connectionChecks.limitHint")}</li>
                </ul>
              }
            />
          )}
        </Form>
      </Modal>
    </section>
  );
}
