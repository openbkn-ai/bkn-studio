/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Configuration of one built-in Agent: model, Context Loader MCP surface, execution caps,
 * publish state, and the versioned shared Prompt. For smart Q&A, network settings and
 * personal preferences narrow this from the Q&A page. Without edit rights it is read-only.
 */

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import {
  BknAgentExecutionError,
  executionRequestError,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  AGENT_LIMIT_KEYS,
  CONTEXT_LIMIT_KEYS,
  getShared,
  getSharedPrompt,
  publishSharedPrompt,
  rollbackSharedPrompt,
  updateShared,
  type AgentLimits,
  type LimitKey,
  type McpProfileChoice,
  type SharedAgent,
  type SharedPrompt,
  unsetLimitMeansNoCap,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import { useAgentAdminParams } from "@/modules/system-admin/scenes/agent-config-admin";

const P = "systemAdmin.agentConfig";
const L = "knowledgeNetwork.agentChat.config";
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

export function AgentConfigScene({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const base = useAgentAdminParams();
  const params = useMemo(() => ({ ...base, agentId }), [base, agentId]);

  const [shared, setShared] = useState<SharedAgent | null>(null);
  const [prompt, setPrompt] = useState<SharedPrompt | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [profile, setProfile] = useState<McpProfileChoice | "default">("default");
  const [published, setPublished] = useState(false);
  const [limits, setLimits] = useState<AgentLimits>({});
  const [content, setContent] = useState("");
  const [version, setVersion] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A notice in place of the page, with the way back: missing, or unreadable on a
  // backend that still refuses non-editors instead of answering read-only.
  const [blocked, setBlocked] = useState<"notFound" | "forbidden" | null>(null);

  // The runtime card and the prompt card save separately; each save applies only its own
  // response, so a draft in the other card survives.
  const applyRuntime = useCallback((agent: SharedAgent) => {
    setShared(agent);
    setModel(agent.model ?? "");
    setProfile(agent.mcp_profile ?? "default");
    setPublished(agent.status === "published");
    setLimits(agent.limits);
  }, []);

  const applyPrompt = useCallback((next: SharedPrompt) => {
    setPrompt(next);
    setContent(next.prompt.content);
    setVersion(next.prompt.current_version);
    setShared((cur) => cur && { ...cur, prompt_version: next.prompt.current_version });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agent, sharedPrompt, llms] = await Promise.all([
        getShared(params),
        getSharedPrompt(params),
        listLlmModels({ page: 1, size: 100 }).catch(() => ({ items: [] })),
      ]);
      applyRuntime(agent);
      applyPrompt(sharedPrompt);
      setModels(llms.items.map((m) => m.modelName));
    } catch (e) {
      if (e instanceof BknAgentExecutionError && e.status === 404) setBlocked("notFound");
      else if (e instanceof BknAgentExecutionError && e.status === 403) setBlocked("forbidden");
      else setError(executionRequestError(e).message);
    } finally {
      setLoading(false);
    }
  }, [applyPrompt, applyRuntime, params]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, done: string, apply: (result: T) => void) => {
      setSaving(true);
      try {
        apply(await action());
        message.success(t(done));
      } catch (e) {
        message.error(executionRequestError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [message, t],
  );

  const back = (
    <SceneBackButton onClick={() => void navigate("/system/agent-config")}>
      {t(`${P}.back`)}
    </SceneBackButton>
  );
  if (loading && !shared) return <Spin />;
  if (blocked)
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {back}
        <Alert type="info" showIcon message={t(`${P}.${blocked}`)} />
      </Space>
    );
  if (error)
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {back}
        <Alert type="error" showIcon message={error} />
      </Space>
    );
  if (!shared || !prompt) return null;

  const current = prompt.prompt.current_version;
  const selected = prompt.versions.find((v) => v.version === version);
  const editable = shared.can_edit;
  // Context budget limits only apply on the public execution surface.
  const limitKeys = shared.layered
    ? AGENT_LIMIT_KEYS
    : AGENT_LIMIT_KEYS.filter((key) => !CONTEXT_LIMIT_KEYS.includes(key));

  return (
    <div>
      <Space align="center" size={12} style={{ marginBottom: 12 }} wrap>
        {back}
        <Typography.Title level={5} style={{ margin: 0 }}>
          {shared.name}
        </Typography.Title>
        <Typography.Text type="secondary" code>
          {shared.agent_id}
        </Typography.Text>
      </Space>
      <Typography.Paragraph type="secondary">
        {t(shared.layered ? `${P}.intro` : `${P}.introPlain`)}
      </Typography.Paragraph>
      {editable ? null : (
        <Alert
          type="info"
          showIcon
          message={t(`${P}.readOnlyNotice`)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title={t(`${P}.runtimeTitle`)}>
          <Form layout="vertical" disabled={!editable}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label={t(`${L}.model`)}>
                  <Select
                    value={model}
                    onChange={setModel}
                    options={[
                      { value: "", label: t(`${L}.defaultModel`) },
                      ...models.map((name) => ({ value: name, label: name })),
                    ]}
                  />
                </Form.Item>
              </Col>
              {shared.uses_context_loader ? (
                <Col xs={24} md={12}>
                  <Form.Item label={t(`${P}.mcpProfile`)} tooltip={t(`${P}.mcpProfileHint`)}>
                    <Radio.Group
                      value={profile}
                      onChange={(e) => setProfile(e.target.value as McpProfileChoice | "default")}
                      options={[
                        { value: "default", label: t(`${P}.mcpDefault`) },
                        { value: "full", label: t(`${P}.mcpFull`) },
                        { value: "compact", label: t(`${P}.mcpCompact`) },
                      ]}
                    />
                  </Form.Item>
                </Col>
              ) : null}
            </Row>
            <Row gutter={16}>
              {limitKeys.map((key) => (
                <Col xs={24} md={6} key={key}>
                  <Form.Item
                    label={t(`${L}.limitFields.${key}.label`)}
                    tooltip={t(`${L}.limitFields.${key}.hint`)}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={MIN[key]}
                      precision={0}
                      value={limits[key] ?? null}
                      placeholder={t(
                        unsetLimitMeansNoCap(key) ? `${L}.noCap` : `${L}.serviceDefault`,
                      )}
                      onChange={(next) => setLimits({ ...limits, [key]: next ?? null })}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
            <Form.Item label={t(`${L}.status`)}>
              <Switch
                checked={published}
                onChange={setPublished}
                checkedChildren={t(`${L}.published`)}
                unCheckedChildren={t(`${L}.draft`)}
              />
            </Form.Item>
            {editable ? (
              <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="primary"
                  loading={saving}
                  onClick={() =>
                    void run(
                      () =>
                        updateShared({
                          ...params,
                          update: {
                            model,
                            ...(shared.uses_context_loader
                              ? { mcp_profile: profile === "default" ? null : profile }
                              : {}),
                            status: published ? "published" : "draft",
                            limits: Object.fromEntries(
                              Object.entries(limits).filter(
                                ([key, v]) => v != null && limitKeys.includes(key as LimitKey),
                              ),
                            ),
                          },
                        }),
                      `${L}.saved`,
                      applyRuntime,
                    )
                  }
                >
                  {t(`${L}.save`)}
                </Button>
              </Space>
            ) : null}
          </Form>
        </Card>

        <Card
          title={t(`${L}.sharedPrompt`)}
          extra={
            <Space>
              <Select
                style={{ minWidth: 160 }}
                value={version}
                onChange={(next: number) => {
                  setVersion(next);
                  setContent(prompt.versions.find((v) => v.version === next)?.content ?? "");
                }}
                options={prompt.versions.map((v) => ({
                  value: v.version,
                  label: (
                    <span>
                      v{v.version}{" "}
                      {v.version === current ? <Tag color="blue">{t(`${L}.inUse`)}</Tag> : null}
                    </span>
                  ),
                }))}
              />
              {editable && selected && selected.version !== current ? (
                <Button
                  disabled={saving}
                  onClick={() =>
                    void run(
                      () => rollbackSharedPrompt({ ...params, version: selected.version }),
                      `${L}.rolledBack`,
                      applyPrompt,
                    )
                  }
                >
                  {t(`${L}.useThisVersion`)}
                </Button>
              ) : null}
            </Space>
          }
        >
          <Input.TextArea
            autoSize={{ minRows: 10, maxRows: 28 }}
            readOnly={!editable}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {editable ? (
            <Space style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button
                type="primary"
                loading={saving}
                disabled={!content.trim() || content === prompt.prompt.content}
                onClick={() =>
                  void run(
                    () => publishSharedPrompt({ ...params, content }),
                    `${L}.promptPublished`,
                    applyPrompt,
                  )
                }
              >
                {t(`${L}.publishPrompt`)}
              </Button>
            </Space>
          ) : null}
        </Card>
      </Space>
    </div>
  );
}
