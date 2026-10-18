/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Shared configuration of the built-in smart Q&A Agent: model, Context Loader MCP surface,
 * execution caps, publish state, and the versioned shared Prompt. Network settings and
 * personal preferences narrow this from the Q&A page.
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

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import {
  BknAgentExecutionError,
  executionRequestError,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  AGENT_LIMIT_KEYS,
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
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";

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

export function AgentConfigScene() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const runtimeConfig = useRuntimeConfig();
  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );
  const params = useMemo(() => ({ base: window.location.origin, tokenProvider }), [tokenProvider]);

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
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agent, sharedPrompt, llms] = await Promise.all([
        getShared(params),
        getSharedPrompt(params),
        listLlmModels({ page: 1, size: 100 }).catch(() => ({ items: [] })),
      ]);
      setShared(agent);
      setModel(agent.model ?? "");
      setProfile(agent.mcp_profile ?? "default");
      setPublished(agent.status === "published");
      setLimits(agent.limits);
      setPrompt(sharedPrompt);
      setContent(sharedPrompt.prompt.content);
      setVersion(sharedPrompt.prompt.current_version);
      setModels(llms.items.map((m) => m.modelName));
    } catch (e) {
      if (e instanceof BknAgentExecutionError && e.status === 403) setForbidden(true);
      else setError(executionRequestError(e).message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (loading && !shared) return <Spin />;
  if (forbidden) return <Alert type="info" showIcon message={t(`${P}.forbidden`)} />;
  if (error) return <Alert type="error" showIcon message={error} />;
  if (!shared || !prompt) return null;

  const current = prompt.prompt.current_version;
  const selected = prompt.versions.find((v) => v.version === version);

  return (
    <div>
      <Typography.Paragraph type="secondary">{t(`${P}.intro`)}</Typography.Paragraph>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title={t(`${P}.runtimeTitle`)}>
          <Form layout="vertical">
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
            </Row>
            <Row gutter={16}>
              {AGENT_LIMIT_KEYS.map((key) => (
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
                      placeholder={t(`${L}.serviceDefault`)}
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
                          mcp_profile: profile === "default" ? null : profile,
                          status: published ? "published" : "draft",
                          limits: Object.fromEntries(
                            Object.entries(limits).filter(([, v]) => v != null),
                          ),
                        },
                      }),
                    `${L}.saved`,
                  )
                }
              >
                {t(`${L}.save`)}
              </Button>
            </Space>
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
              {selected && selected.version !== current ? (
                <Button
                  disabled={saving}
                  onClick={() =>
                    void run(
                      () => rollbackSharedPrompt({ ...params, version: selected.version }),
                      `${L}.rolledBack`,
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Space style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button
              type="primary"
              loading={saving}
              disabled={!content.trim() || content === prompt.prompt.content}
              onClick={() =>
                void run(() => publishSharedPrompt({ ...params, content }), `${L}.promptPublished`)
              }
            >
              {t(`${L}.publishPrompt`)}
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
