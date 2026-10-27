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
 *
 * Built-in Agents back platform features, so the whole configuration sits in a danger zone:
 * every change is confirmed with what it changes, and the Agent can be restored to what it
 * shipped with. Built-in Agents stay published and cannot be deleted.
 */

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { MonacoDiffEditor } from "@/framework/monaco/MonacoDiffEditor";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import {
  BknAgentExecutionError,
  executionRequestError,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  AGENT_LIMIT_KEYS,
  CONTEXT_LIMIT_KEYS,
  activateVersion,
  deleteVersion,
  getShared,
  getSharedPrompt,
  listVersions,
  publishSharedPrompt,
  restoreShared,
  updateShared,
  type AgentLimits,
  type AgentToolDefinition,
  type AgentToolSource,
  type ToolParameterSchema,
  type AgentVersion,
  type LimitKey,
  type McpProfileChoice,
  type SharedAgent,
  type SharedPrompt,
  unsetLimitMeansNoCap,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import { useAgentAdminParams } from "@/modules/system-admin/scenes/agent-config-admin";

import styles from "./AgentConfigScene.module.css";

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
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const base = useAgentAdminParams();
  const params = useMemo(() => ({ ...base, agentId }), [base, agentId]);

  const [shared, setShared] = useState<SharedAgent | null>(null);
  const [prompt, setPrompt] = useState<SharedPrompt | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [profile, setProfile] = useState<McpProfileChoice | "default">("default");
  const [limits, setLimits] = useState<AgentLimits>({});
  const [content, setContent] = useState("");
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const publishing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // A notice in place of the page, with the way back: missing, or unreadable on a
  // backend that still refuses non-editors instead of answering read-only.
  const [blocked, setBlocked] = useState<"notFound" | "forbidden" | null>(null);
  // Versions shown side by side in the compare dialog: [older, newer].
  const [comparing, setComparing] = useState<[number, number] | null>(null);

  // The runtime card and the prompt card save separately; each save applies only its own
  // response, so a draft in the other card survives.
  const applyRuntime = useCallback((agent: SharedAgent) => {
    setShared(agent);
    setModel(agent.model ?? "");
    setProfile(agent.mcp_profile ?? "default");
    setLimits(agent.limits);
  }, []);

  // Publishing changes only the status; runtime and prompt drafts stay.
  const applyStatus = useCallback((agent: SharedAgent) => {
    setShared((cur) => cur && { ...cur, status: agent.status, update_time: agent.update_time });
  }, []);

  const applyPrompt = useCallback((next: SharedPrompt) => {
    setPrompt(next);
    setContent(next.prompt.content);
    setShared((cur) => cur && { ...cur, prompt_version: next.prompt.current_version });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agent, sharedPrompt, history, llms] = await Promise.all([
        getShared(params),
        getSharedPrompt(params),
        listVersions(params),
        listLlmModels({ page: 1, size: 100 }).catch(() => ({ items: [] })),
      ]);
      applyRuntime(agent);
      applyPrompt(sharedPrompt);
      setVersions(history);
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

  // A save writes a new version; refresh the list and version numbers without touching
  // drafts (setShared alone leaves the form fields as they are).
  const refreshVersions = useCallback(async () => {
    const [history, agent] = await Promise.all([listVersions(params), getShared(params)]);
    setVersions(history);
    setShared(agent);
  }, [params]);

  /** Ask first; the confirmation names what changes, since it applies to every user at once. */
  const confirmThen = useCallback(
    (title: string, content: ReactNode, onOk: () => Promise<void>) => {
      modal.confirm({
        title,
        content,
        okText: t(`${P}.confirmChange`),
        cancelText: t("common.cancel"),
        onOk,
      });
    },
    [modal, t],
  );

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

  const publishPrompt = async () => {
    if (publishing.current) return;
    const version = prompt.next_version;
    if (version == null || !Number.isSafeInteger(version) || version < 1) {
      message.error(t(`${P}.promptVersionUnavailable`));
      return;
    }
    publishing.current = true;
    setSaving(true);
    try {
      // Capture one version per confirmation; transport retries reuse this body.
      const next = await publishSharedPrompt({ ...params, content, version });
      applyPrompt(next);
      message.success(t(`${L}.promptPublished`));
      await refreshVersions().catch(() => undefined);
    } catch (e) {
      const conflict = e instanceof BknAgentExecutionError && e.status === 409;
      const uncertain =
        e instanceof TypeError || (e instanceof BknAgentExecutionError && e.status >= 500);
      if (conflict || uncertain) {
        // Refresh the server baseline, but keep the editor draft for comparison.
        try {
          const next = await getSharedPrompt(params);
          setPrompt(next);
          await refreshVersions();
        } catch {
          // The result remains unknown; never allocate another version here.
        }
        message.warning(t(`${P}.${conflict ? "promptVersionConflict" : "promptPublishUncertain"}`));
      } else {
        message.error(executionRequestError(e).message);
      }
    } finally {
      publishing.current = false;
      setSaving(false);
    }
  };

  const currentVersion = shared.version ?? null;
  const versionOf = (v: number) => versions.find((item) => item.version === v);
  const editable = shared.can_edit;
  // Context budget limits only apply on the public execution surface.
  const limitKeys = shared.layered
    ? AGENT_LIMIT_KEYS
    : AGENT_LIMIT_KEYS.filter((key) => !CONTEXT_LIMIT_KEYS.includes(key));
  const unset = (key: LimitKey) =>
    t(unsetLimitMeansNoCap(key) ? `${L}.noCap` : `${L}.serviceDefault`);
  const profileLabel = (value: McpProfileChoice | "default") =>
    t(
      value === "full"
        ? `${P}.mcpFull`
        : value === "compact"
          ? `${P}.mcpCompact`
          : `${P}.mcpDefault`,
    );
  // What the runtime save would change, against what the server last returned.
  const changes: { label: string; from: string; to: string }[] = [];
  if (model !== (shared.model ?? ""))
    changes.push({
      label: t(`${L}.model`),
      from: shared.model || t(`${L}.defaultModel`),
      to: model || t(`${L}.defaultModel`),
    });
  if (shared.uses_context_loader && profile !== (shared.mcp_profile ?? "default"))
    changes.push({
      label: t(`${P}.mcpProfile`),
      from: profileLabel(shared.mcp_profile ?? "default"),
      to: profileLabel(profile),
    });
  for (const key of limitKeys) {
    const before = shared.limits[key] ?? null;
    const after = limits[key] ?? null;
    if (before !== after)
      changes.push({
        label: t(`${L}.limitFields.${key}.label`),
        from: before == null ? unset(key) : String(before),
        to: after == null ? unset(key) : String(after),
      });
  }
  const saveRuntime = () =>
    run(
      () =>
        updateShared({
          ...params,
          update: {
            model,
            ...(shared.uses_context_loader
              ? { mcp_profile: profile === "default" ? null : profile }
              : {}),
            limits: Object.fromEntries(
              Object.entries(limits).filter(
                ([key, v]) => v != null && limitKeys.includes(key as LimitKey),
              ),
            ),
          },
        }),
      `${L}.saved`,
      (agent) => {
        applyRuntime(agent);
        void refreshVersions();
      },
    );
  // A built-in Agent ships as a draft only before its first publish; publishing is one way.
  const publish = () =>
    run(
      () => updateShared({ ...params, update: { status: "published" } }),
      `${P}.publishedDone`,
      applyStatus,
    );
  // Switching versions replaces both cards on purpose, drafts included.
  const switchTo = (action: () => Promise<SharedAgent>, done: string) =>
    run(
      async () => {
        const agent = await action();
        const [nextPrompt, history] = await Promise.all([
          getSharedPrompt(params),
          listVersions(params),
        ]);
        return { agent, nextPrompt, history };
      },
      done,
      ({ agent, nextPrompt, history }) => {
        applyRuntime(agent);
        applyPrompt(nextPrompt);
        setVersions(history);
      },
    );
  const restore = () => switchTo(() => restoreShared(params), `${P}.restored`);
  const changeLabel = (version: AgentVersion) =>
    version.changes.length
      ? version.changes.map((change) => t(`${P}.change.${change}`)).join(t(`${P}.changeSeparator`))
      : t(`${P}.firstVersion`);
  // Runtime differences between two versions, for the compare dialog.
  const runtimeRows = (left?: AgentVersion, right?: AgentVersion) => {
    const value = (v: AgentVersion | undefined, key: LimitKey) =>
      v?.limits?.[key] == null ? unset(key) : String(v.limits[key]);
    return [
      {
        label: t(`${L}.model`),
        left: left?.model || t(`${L}.defaultModel`),
        right: right?.model || t(`${L}.defaultModel`),
      },
      ...(shared.uses_context_loader
        ? [
            {
              label: t(`${P}.mcpProfile`),
              left: profileLabel(left?.mcp_profile ?? "default"),
              right: profileLabel(right?.mcp_profile ?? "default"),
            },
          ]
        : []),
      ...limitKeys.map((key) => ({
        label: t(`${L}.limitFields.${key}.label`),
        left: value(left, key),
        right: value(right, key),
      })),
    ];
  };

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
      {shared.status === "published" ? null : (
        <Alert
          type="warning"
          showIcon
          message={t(`${P}.notPublished`)}
          action={
            editable ? (
              <Button
                type="primary"
                disabled={saving}
                onClick={() =>
                  confirmThen(
                    t(`${P}.confirmPublishTitle`, { name: shared.name }),
                    t(`${P}.publishOnce`),
                    publish,
                  )
                }
              >
                {t(`${P}.publish`)}
              </Button>
            ) : null
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {/* Read-only, so outside the danger zone. */}
      {shared.tools ? <AgentTools sources={shared.tools} /> : null}
      <section className={styles.dangerZone} aria-label={t(`${P}.dangerZone`)}>
        <div className={styles.dangerHeader}>
          <span className={styles.dangerTitle}>{t(`${P}.dangerZone`)}</span>
          {editable && shared.restorable ? (
            <Button
              danger
              disabled={saving || !shared.modified}
              onClick={() =>
                confirmThen(
                  t(`${P}.confirmRestoreTitle`, { name: shared.name }),
                  t(`${P}.confirmRestoreBody`),
                  restore,
                )
              }
            >
              {t(`${P}.restore`)}
            </Button>
          ) : null}
        </div>
        <Space direction="vertical" size={16} className={styles.dangerBody}>
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
              {editable ? (
                <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="primary"
                    danger
                    loading={saving}
                    disabled={changes.length === 0}
                    onClick={() =>
                      confirmThen(
                        t(`${P}.confirmRuntimeTitle`, { name: shared.name }),
                        <ul className={styles.changeList}>
                          {changes.map((change) => (
                            <li key={change.label}>
                              <span className={styles.changeLabel}>{change.label}</span>
                              {change.from} → {change.to}
                            </li>
                          ))}
                        </ul>,
                        saveRuntime,
                      )
                    }
                  >
                    {t(`${L}.save`)}
                  </Button>
                </Space>
              ) : null}
            </Form>
          </Card>

          <Card title={t(`${L}.sharedPrompt`)}>
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
                  danger
                  loading={saving}
                  disabled={!content.trim() || content === prompt.prompt.content}
                  onClick={() =>
                    confirmThen(
                      t(`${P}.confirmPublishPromptTitle`),
                      t(`${P}.confirmPromptBody`),
                      publishPrompt,
                    )
                  }
                >
                  {t(`${L}.publishPrompt`)}
                </Button>
              </Space>
            ) : null}
          </Card>

          <Card title={t(`${P}.versionsTitle`)}>
            <ul className={styles.versionList}>
              {versions.map((v) => (
                <li key={v.version} className={styles.versionRow}>
                  <div className={styles.versionMain}>
                    <span className={styles.versionNumber}>v{v.version}</span>
                    {v.current ? <Tag color="blue">{t(`${L}.inUse`)}</Tag> : null}
                    {v.initial ? <Tag>{t(`${P}.initialVersion`)}</Tag> : null}
                    <span className={styles.versionChanges}>{changeLabel(v)}</span>
                    <Typography.Text type="secondary" className={styles.versionTime}>
                      {formatDateTimeYmdHms(v.create_time)}
                    </Typography.Text>
                  </div>
                  {v.current || currentVersion === null ? null : (
                    <Space size={4}>
                      <Button
                        size="small"
                        aria-label={t(`${P}.compareVersion`, { version: v.version })}
                        onClick={() =>
                          setComparing([
                            Math.min(v.version, currentVersion),
                            Math.max(v.version, currentVersion),
                          ])
                        }
                      >
                        {t(`${P}.compare`)}
                      </Button>
                      {editable ? (
                        <Button
                          size="small"
                          danger
                          disabled={saving}
                          aria-label={t(`${P}.activateVersion`, { version: v.version })}
                          onClick={() =>
                            confirmThen(
                              t(`${P}.confirmActivateTitle`, { version: v.version }),
                              t(`${P}.confirmActivateBody`),
                              () =>
                                switchTo(
                                  () => activateVersion({ ...params, version: v.version }),
                                  `${P}.activated`,
                                ),
                            )
                          }
                        >
                          {t(`${L}.useThisVersion`)}
                        </Button>
                      ) : null}
                      {editable && !v.initial ? (
                        <Button
                          size="small"
                          danger
                          type="text"
                          disabled={saving}
                          aria-label={t(`${P}.deleteVersionNamed`, { version: v.version })}
                          onClick={() =>
                            confirmThen(
                              t(`${P}.confirmDeleteVersionTitle`, { version: v.version }),
                              t(`${P}.confirmDeleteVersionBody`),
                              () =>
                                run(
                                  () => deleteVersion({ ...params, version: v.version }),
                                  `${P}.versionDeleted`,
                                  setVersions,
                                ),
                            )
                          }
                        >
                          {t(`${P}.deleteVersion`)}
                        </Button>
                      ) : null}
                    </Space>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </Space>
      </section>

      <Modal
        title={t(`${P}.compareTitle`)}
        open={comparing !== null}
        onCancel={() => setComparing(null)}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        {comparing ? (
          <>
            <Space style={{ marginBottom: 12 }}>
              {([0, 1] as const).map((side) => (
                <Select
                  key={side}
                  aria-label={t(side === 0 ? `${P}.compareFrom` : `${P}.compareTo`)}
                  style={{ minWidth: 140 }}
                  value={comparing[side]}
                  onChange={(next: number) =>
                    setComparing(side === 0 ? [next, comparing[1]] : [comparing[0], next])
                  }
                  options={versions.map((v) => ({
                    value: v.version,
                    label: `v${v.version}`,
                  }))}
                />
              ))}
            </Space>
            <table className={styles.compareTable}>
              <tbody>
                {runtimeRows(versionOf(comparing[0]), versionOf(comparing[1])).map((row) => (
                  <tr
                    key={row.label}
                    className={row.left === row.right ? undefined : styles.compareChanged}
                  >
                    <th>{row.label}</th>
                    <td>{row.left}</td>
                    <td>{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.compareSubtitle}>{t(`${L}.sharedPrompt`)}</div>
            <MonacoDiffEditor
              height={420}
              language="markdown"
              original={versionOf(comparing[0])?.prompt_content ?? ""}
              modified={versionOf(comparing[1])?.prompt_content ?? ""}
              // wordWrap only reaches the modified side; the original side needs
              // diffWordWrap, and older Monaco builds ignore that, so set it directly too.
              // The diff must not start inline either: the dialog is still narrow while it
              // opens, and Monaco then turns the original side's wrapping off for good
              // (wordWrapOverride2) without restoring it when it switches to side by side.
              options={{
                readOnly: true,
                renderSideBySide: true,
                useInlineViewWhenSpaceIsLimited: false,
                wordWrap: "on",
                diffWordWrap: "on",
              }}
              onMount={(editor) => editor.getOriginalEditor().updateOptions({ wordWrap: "on" })}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/** The Agent's tools by source, as configured; changing them is not a product operation. */
function AgentTools({ sources }: { sources: AgentToolSource[] }) {
  const { t } = useTranslation();
  const sourceLabel = (source: AgentToolSource) => {
    const detail = source.provider ?? source.box_id ?? source.agent_id ?? source.name;
    const kind = t(`${P}.toolSource.${source.type}`, { defaultValue: source.type });
    return detail ? `${kind} · ${detail}` : kind;
  };
  return (
    <Card title={t(`${P}.toolsTitle`)} className={styles.tools} data-testid="agent-config-tools">
      {sources.length === 0 ? (
        <Typography.Text type="secondary">{t(`${P}.toolsNone`)}</Typography.Text>
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {sources.map((source, index) => (
            <div key={`${source.type}-${index}`} data-testid="agent-config-tool-source">
              <Typography.Text strong>{sourceLabel(source)}</Typography.Text>
              <div className={styles.toolNames}>
                {source.definitions?.length ? (
                  <Collapse
                    size="small"
                    className={styles.toolDefinitions}
                    items={source.definitions.map((definition) => ({
                      key: definition.name,
                      label: <span className={styles.toolName}>{definition.name}</span>,
                      children: <ToolDefinition definition={definition} />,
                    }))}
                  />
                ) : source.names?.length ? (
                  source.names.map((name) => (
                    <Tag key={name} className={styles.toolName}>
                      {name}
                    </Tag>
                  ))
                ) : (
                  <Typography.Text type="secondary">
                    {t(
                      source.type !== "context_loader"
                        ? `${P}.toolsAtRuntime`
                        : // An empty allow-list opens the session for the Agent's own tools but
                          // gives the model none of its tools; only a missing one means all.
                          source.names
                          ? `${P}.toolsNoContextLoader`
                          : `${P}.toolsAllContextLoader`,
                    )}
                  </Typography.Text>
                )}
              </div>
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

/** A parameter's JSON Schema type in short: `array<string>`, alternatives joined, null left out. */
function schemaType(schema: ToolParameterSchema): string {
  if (schema.anyOf)
    return schema.anyOf
      .filter((option) => option.type !== "null")
      .map(schemaType)
      .join(" | ");
  if (schema.type === "array" && schema.items) return `array<${schemaType(schema.items)}>`;
  return schema.type ?? "";
}

function ToolDefinition({ definition }: { definition: AgentToolDefinition }) {
  const { t } = useTranslation();
  const properties = Object.entries(definition.parameters?.properties ?? {});
  const required = new Set(definition.parameters?.required ?? []);
  return (
    <div data-testid="agent-config-tool-definition">
      {definition.description ? (
        <Typography.Paragraph className={styles.toolDescription}>
          {definition.description}
        </Typography.Paragraph>
      ) : null}
      {properties.length === 0 ? (
        <Typography.Text type="secondary">{t(`${P}.toolNoParameters`)}</Typography.Text>
      ) : (
        <Table
          size="small"
          pagination={false}
          rowKey="name"
          dataSource={properties.map(([name, schema]) => ({
            name,
            type: schemaType(schema),
            required: required.has(name),
            description: schema.description ?? "",
          }))}
          columns={[
            {
              title: t(`${P}.toolParameter`),
              dataIndex: "name",
              render: (name: string) => <span className={styles.toolName}>{name}</span>,
            },
            { title: t(`${P}.toolParameterType`), dataIndex: "type" },
            {
              title: t(`${P}.toolParameterRequired`),
              dataIndex: "required",
              render: (value: boolean) => (value ? t(`${P}.toolParameterRequiredYes`) : ""),
            },
            { title: t(`${P}.toolParameterDescription`), dataIndex: "description" },
          ]}
        />
      )}
    </div>
  );
}
