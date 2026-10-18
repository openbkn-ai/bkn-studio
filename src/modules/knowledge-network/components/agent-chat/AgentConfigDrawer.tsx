/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Smart Q&A configuration for the current network, in three tabs: a read-only summary of
 * the shared Agent (edited in System Admin), this network's setting (editable by whoever
 * may modify the network), and the viewer's own preferences. Lower layers only add
 * instructions or narrow tools and limits.
 */

import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import {
  AGENT_LIMIT_KEYS,
  getAgentConfig,
  narrow,
  resetNetworkSetting,
  resetUserSetting,
  saveNetworkSetting,
  saveUserSetting,
  selectableTools,
  type AgentConfig,
  type AgentEffective,
  type AgentLimits,
  type AgentSetting,
  type LimitKey,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";
import { executionRequestError } from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  listMcpTools,
  type ContextLoaderEnv,
} from "@/modules/knowledge-network/services/context-loader.service";

const P = "knowledgeNetwork.agentChat.config";
const INSTRUCTION_MAX = 2000;
const MIN: Record<LimitKey, number> = {
  max_turns: 1,
  max_tool_calls: 0,
  timeout_s: 1,
  max_output_tokens: 10,
  keep_tool_results: 1,
  data_result_chars: 500,
  schema_result_chars: 500,
  summarize_after_tokens: 4000,
};

function LimitFields({
  value,
  caps,
  disabled,
  onChange,
}: {
  value: AgentLimits | null | undefined;
  /** null caps mean the shared layer itself: no upper bound and no "follow" wording. */
  caps: AgentLimits | null;
  disabled?: boolean;
  onChange: (next: AgentLimits) => void;
}) {
  const { t } = useTranslation();
  return (
    <Row gutter={16}>
      {AGENT_LIMIT_KEYS.map((key) => {
        const cap = caps?.[key] ?? undefined;
        return (
          <Col span={12} key={key}>
            <Form.Item
              label={t(`${P}.limitFields.${key}.label`)}
              tooltip={t(`${P}.limitFields.${key}.hint`)}
              extra={
                caps ? (cap == null ? t(`${P}.noCap`) : t(`${P}.capValue`, { value: cap })) : null
              }
            >
              <InputNumber
                style={{ width: "100%" }}
                min={MIN[key]}
                max={cap}
                precision={0}
                disabled={disabled}
                value={value?.[key] ?? null}
                placeholder={caps ? t(`${P}.followUpper`) : t(`${P}.serviceDefault`)}
                onChange={(next) => onChange({ ...value, [key]: next ?? null })}
              />
            </Form.Item>
          </Col>
        );
      })}
    </Row>
  );
}

function LayerForm({
  description,
  value,
  upper,
  disabled = false,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  description: string;
  value: AgentSetting;
  upper: AgentEffective & { allowed_tools: string[] };
  disabled?: boolean;
  saving: boolean;
  onChange: (next: AgentSetting) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const custom = value.allowed_tools != null;
  return (
    <Form layout="vertical" disabled={disabled}>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      <Form.Item label={t(`${P}.instruction`)}>
        <Input.TextArea
          autoSize={{ minRows: 4, maxRows: 10 }}
          maxLength={INSTRUCTION_MAX}
          showCount
          value={value.instruction ?? ""}
          placeholder={t(`${P}.instructionPlaceholder`)}
          onChange={(e) => onChange({ ...value, instruction: e.target.value })}
        />
      </Form.Item>
      <Form.Item label={t(`${P}.tools`)}>
        <Radio.Group
          value={custom ? "custom" : "follow"}
          onChange={(e) =>
            onChange({
              ...value,
              allowed_tools: e.target.value === "custom" ? [...upper.allowed_tools] : null,
            })
          }
        >
          <Radio value="follow">{t(`${P}.followUpper`)}</Radio>
          <Radio value="custom">{t(`${P}.customTools`)}</Radio>
        </Radio.Group>
        {custom ? (
          <Checkbox.Group
            style={{ marginTop: 12, width: "100%" }}
            value={value.allowed_tools ?? []}
            onChange={(names) => onChange({ ...value, allowed_tools: names.map(String) })}
          >
            <Row gutter={[8, 8]}>
              {upper.allowed_tools.map((name) => (
                <Col span={12} key={name}>
                  <Checkbox value={name}>{name}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        ) : null}
      </Form.Item>
      <LimitFields
        value={value.limits}
        caps={upper.limits}
        disabled={disabled}
        onChange={(limits) => onChange({ ...value, limits })}
      />
      {disabled ? null : (
        <Space style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={onReset} disabled={saving}>
            {t(`${P}.reset`)}
          </Button>
          <Button type="primary" onClick={onSave} loading={saving}>
            {t(`${P}.save`)}
          </Button>
        </Space>
      )}
    </Form>
  );
}

/** Drops empty values so an untouched field keeps following the layer above. */
function clean(setting: AgentSetting): AgentSetting {
  const limits = Object.fromEntries(
    Object.entries(setting.limits ?? {}).filter(([, v]) => v != null),
  );
  const instruction = setting.instruction?.trim();
  return {
    ...(instruction ? { instruction } : {}),
    ...(setting.allowed_tools == null ? {} : { allowed_tools: setting.allowed_tools }),
    ...(Object.keys(limits).length ? { limits } : {}),
  };
}

function SharedSummary({ config }: { config: AgentConfig }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = config.mcp_profile
    ? t(config.mcp_profile === "compact" ? `${P}.mcpCompact` : `${P}.mcpFull`)
    : t(`${P}.mcpDefault`);
  return (
    <>
      <Typography.Paragraph type="secondary">{t(`${P}.sharedReadOnly`)}</Typography.Paragraph>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t(`${P}.model`)}>
          {config.model || t(`${P}.defaultModel`)}
        </Descriptions.Item>
        <Descriptions.Item label={t(`${P}.mcpProfile`)}>{profile}</Descriptions.Item>
        <Descriptions.Item label={t(`${P}.status`)}>
          {config.status === "published" ? t(`${P}.published`) : t(`${P}.draft`)}
        </Descriptions.Item>
        {AGENT_LIMIT_KEYS.map((key) => (
          <Descriptions.Item key={key} label={t(`${P}.limitFields.${key}.label`)}>
            {config.shared.limits[key] ?? t(`${P}.noCap`)}
          </Descriptions.Item>
        ))}
      </Descriptions>
      {config.can_edit_shared ? (
        <Space style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Button type="primary" onClick={() => void navigate("/system/agent-config")}>
            {t(`${P}.openSystemConfig`)}
          </Button>
        </Space>
      ) : null}
    </>
  );
}

export function AgentConfigDrawer({
  open,
  onClose,
  env,
  tokenProvider,
}: {
  open: boolean;
  onClose: () => void;
  env: ContextLoaderEnv;
  tokenProvider: AgentTokenProvider;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const params = useMemo(() => ({ base: env.base, tokenProvider }), [env.base, tokenProvider]);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [network, setNetwork] = useState<AgentSetting>({});
  const [user, setUser] = useState<AgentSetting>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAgentConfig({ ...params, knId: env.knId });
      // Tool names differ between the full and compact surfaces; list the one in use.
      const defs = await listMcpTools(
        { ...env, mcpProfile: next.mcp_profile ?? "full" },
        tokenProvider,
      ).catch(() => []);
      setConfig(next);
      setNetwork(next.network.setting);
      setUser(next.user.setting);
      setTools(selectableTools(defs.map((d) => d.name)));
    } catch (e) {
      setError(executionRequestError(e).message);
    } finally {
      setLoading(false);
    }
  }, [env, params, tokenProvider]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string) => {
      setSaving(true);
      try {
        await action();
        message.success(t(done));
        await load();
      } catch (e) {
        message.error(executionRequestError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [load, message, t],
  );

  const sharedTools = config?.shared.allowed_tools ?? tools;
  const networkUpper = config && { limits: config.shared.limits, allowed_tools: sharedTools };
  const narrowed = networkUpper && config ? narrow(networkUpper, config.network.setting) : null;
  const userUpper = narrowed && {
    limits: narrowed.limits,
    allowed_tools: narrowed.allowed_tools ?? sharedTools,
  };

  return (
    <Drawer
      title={t(`${P}.title`)}
      placement="right"
      width={640}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {loading && !config ? (
        <Spin />
      ) : error ? (
        <Alert type="error" message={error} />
      ) : config && networkUpper && userUpper ? (
        <Tabs
          defaultActiveKey="network"
          items={[
            {
              key: "shared",
              label: t(`${P}.sharedTitle`),
              children: <SharedSummary config={config} />,
            },
            {
              key: "network",
              label: t(`${P}.networkTitle`),
              children: (
                <LayerForm
                  description={
                    config.can_edit_network
                      ? t(`${P}.networkDescription`)
                      : t(`${P}.networkReadOnly`)
                  }
                  value={network}
                  upper={networkUpper}
                  disabled={!config.can_edit_network}
                  saving={saving}
                  onChange={setNetwork}
                  onSave={() =>
                    void run(
                      () =>
                        saveNetworkSetting({ ...params, knId: env.knId, setting: clean(network) }),
                      `${P}.saved`,
                    )
                  }
                  onReset={() =>
                    void run(
                      () => resetNetworkSetting({ ...params, knId: env.knId }),
                      `${P}.resetDone`,
                    )
                  }
                />
              ),
            },
            {
              key: "user",
              label: t(`${P}.userTitle`),
              children: (
                <LayerForm
                  description={t(`${P}.userDescription`)}
                  value={user}
                  upper={userUpper}
                  saving={saving}
                  onChange={setUser}
                  onSave={() =>
                    void run(
                      () => saveUserSetting({ ...params, setting: clean(user) }),
                      `${P}.saved`,
                    )
                  }
                  onReset={() => void run(() => resetUserSetting(params), `${P}.resetDone`)}
                />
              ),
            },
          ]}
        />
      ) : null}
    </Drawer>
  );
}
