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
import { useBeforeUnload, useBlocker, useNavigate } from "react-router-dom";

import { normalizeSupportedLocale } from "@/framework/i18n/locale";
import type { SupportedLocale } from "@/framework/runtime/types";
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
import { agentDisplayName } from "./agent-config-names";

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
  const { t, i18n } = useTranslation();
  const locale = normalizeSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? "zh-CN";
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const base = useAgentAdminParams();
  const params = useMemo(() => ({ ...base, agentId }), [base, agentId]);

  const [shared, setShared] = useState<SharedAgent | null>(null);
  const localizedParams = useMemo(() => ({ ...params, locale }), [params, locale]);
  const [promptViews, setPromptViews] = useState<
    Partial<Record<SupportedLocale, { prompt: SharedPrompt; content: string }>>
  >({});
  const view = promptViews[locale];
  const prompt = view?.prompt ?? null;
  const content = view?.content ?? "";
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptRevision, setPromptRevision] = useState(0);
  const languageGeneration = useRef(0);
  const activeLocale = useRef(locale);
  const setContent = (next: string) =>
    setPromptViews((views) => {
      const current = views[locale];
      return current ? { ...views, [locale]: { ...current, content: next } } : views;
    });
  const setPrompt = (next: SharedPrompt) =>
    setPromptViews((views) => ({
      ...views,
      [locale]: { prompt: next, content: views[locale]?.content ?? next.prompt.content },
    }));
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [profile, setProfile] = useState<McpProfileChoice | "default">("default");
  const [limits, setLimits] = useState<AgentLimits>({});
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

  const applyPrompt = useCallback(
    (next: SharedPrompt) => {
      setPromptViews((views) => ({
        ...views,
        [locale]: { prompt: next, content: next.prompt.content },
      }));
      setShared((cur) => cur && { ...cur, prompt_version: next.prompt.current_version });
    },
    [locale],
  );

  // Runtime data is language-independent: changing language must not reload its draft.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setBlocked(null);
    setPromptViews({});
    void Promise.all([
      getShared(params),
      listLlmModels({ page: 1, size: 100 }).catch(() => ({ items: [] })),
    ])
      .then(([agent, llms]) => {
        if (!active) return;
        applyRuntime(agent);
        setModels(llms.items.map((m) => m.modelName));
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof BknAgentExecutionError && e.status === 404) setBlocked("notFound");
        else if (e instanceof BknAgentExecutionError && e.status === 403) setBlocked("forbidden");
        else setError(executionRequestError(e).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyRuntime, params]);

  useEffect(() => {
    let active = true;
    languageGeneration.current += 1;
    activeLocale.current = locale;
    setPromptLoading(true);
    setComparing(null);
    setVersions([]);
    setPromptError(null);
    setBlocked(null);
    void Promise.all([getSharedPrompt(localizedParams), listVersions(localizedParams)])
      .then(([next, history]) => {
        if (!active) return;
        setPromptViews((views) => {
          const previous = views[locale];
          const draft = previous && previous.content !== previous.prompt.prompt.content;
          return {
            ...views,
            [locale]: { prompt: next, content: draft ? previous.content : next.prompt.content },
          };
        });
        setVersions(history);
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof BknAgentExecutionError && e.status === 404) setBlocked("notFound");
        else if (e instanceof BknAgentExecutionError && e.status === 403) setBlocked("forbidden");
        else setPromptError(executionRequestError(e).message);
      })
      .finally(() => {
        if (active) setPromptLoading(false);
      });
    return () => {
      active = false;
      languageGeneration.current += 1;
    };
  }, [locale, localizedParams, promptRevision]);

  // Refresh version numbers without overwriting any runtime or Prompt drafts.
  const refreshVersions = useCallback(async () => {
    if (activeLocale.current !== locale) return;
    const generation = languageGeneration.current;
    const [history, agent] = await Promise.all([listVersions(localizedParams), getShared(params)]);
    if (generation !== languageGeneration.current) return;
    setVersions(history);
    setShared(agent);
  }, [locale, localizedParams, params]);

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

  // Context budgets only apply to public execution. Compare editable fields using
  // the same defaults as the save summary.
  const limitKeys = shared?.layered
    ? AGENT_LIMIT_KEYS
    : AGENT_LIMIT_KEYS.filter((key) => !CONTEXT_LIMIT_KEYS.includes(key));
  const dirty = Boolean(
    shared?.can_edit &&
    (Object.values(promptViews).some((item) => item.content !== item.prompt.prompt.content) ||
      model !== (shared.model ?? "") ||
      (shared.uses_context_loader && profile !== (shared.mcp_profile ?? "default")) ||
      limitKeys.some((key) => (limits[key] ?? null) !== (shared.limits[key] ?? null))),
  );
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const dialog = modal.confirm({
      title: t(`${P}.unsavedTitle`),
      content: t(`${P}.unsavedBody`),
      okText: t(`${P}.discardAndLeave`),
      cancelText: t(`${P}.keepEditing`),
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, modal, t]);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [dirty],
    ),
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
  if (!shared) return <Spin />;

  const publishPrompt = async () => {
    if (publishing.current || promptLoading || promptError || !prompt) return;
    const version = prompt.next_version;
    if (version == null || !Number.isSafeInteger(version) || version < 1) {
      message.error(t(`${P}.promptVersionUnavailable`));
      return;
    }
    publishing.current = true;
    setSaving(true);
    try {
      // Capture one version per confirmation; transport retries reuse this body.
      const next = await publishSharedPrompt({ ...localizedParams, content, version });
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
          const next = await getSharedPrompt(localizedParams);
          if (
            next.prompt.prompt_id === prompt.prompt.prompt_id &&
            next.prompt.current_version === version &&
            next.prompt.content === content
          ) {
            // The requested content is active at the exact target version.
            // A failed history refresh cannot undo this confirmed outcome.
            applyPrompt(next);
            message.success(t(`${L}.promptPublished`));
            await refreshVersions().catch(() => undefined);
            return;
          }
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
  const displayName = agentDisplayName(shared, t);
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
    run(action, done, (agent) => {
      applyRuntime(agent);
      setPromptViews({});
      setPromptRevision((revision) => revision + 1);
    });
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
          {displayName}
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
                disabled={saving || promptLoading}
                onClick={() =>
                  confirmThen(
                    t(`${P}.confirmPublishTitle`, { name: displayName }),
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
              disabled={saving || promptLoading || !shared.modified}
              onClick={() =>
                confirmThen(
                  t(`${P}.confirmRestoreTitle`, { name: displayName }),
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
          <Alert type="info" showIcon message={t(`${P}.promptLanguagePolicy`)} />
          {Object.entries(promptViews).some(
            ([language, item]) =>
              language !== locale && item.content !== item.prompt.prompt.content,
          ) ? (
            <Alert type="warning" showIcon message={t(`${P}.otherLanguageDraft`)} />
          ) : null}
          <Card title={t(`${P}.runtimeTitle`)}>
            <Form layout="vertical" disabled={!editable || saving}>
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
                        t(`${P}.confirmRuntimeTitle`, { name: displayName }),
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
            {promptError ? (
              <Alert
                type="error"
                showIcon
                message={promptError}
                action={
                  <Button
                    disabled={promptLoading}
                    onClick={() => setPromptRevision((revision) => revision + 1)}
                  >
                    {t("common.retry")}
                  </Button>
                }
              />
            ) : null}
            {promptLoading && !prompt ? <Spin /> : null}
            <Input.TextArea
              autoSize={{ minRows: 10, maxRows: 28 }}
              readOnly={!editable || !prompt}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {editable ? (
              <Space style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <Button
                  type="primary"
                  danger
                  loading={saving}
                  disabled={
                    promptLoading ||
                    Boolean(promptError) ||
                    !prompt ||
                    !content.trim() ||
                    content === prompt.prompt.content
                  }
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
                          disabled={saving || promptLoading}
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
                          disabled={saving || promptLoading}
                          aria-label={t(`${P}.deleteVersionNamed`, { version: v.version })}
                          onClick={() =>
                            confirmThen(
                              t(`${P}.confirmDeleteVersionTitle`, { version: v.version }),
                              t(`${P}.confirmDeleteVersionBody`),
                              () =>
                                run(
                                  () => deleteVersion({ ...localizedParams, version: v.version }),
                                  `${P}.versionDeleted`,
                                  // Deletion is global; reload in the active language rather than
                                  // applying the response captured in a possibly older locale.
                                  () => setPromptRevision((revision) => revision + 1),
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
