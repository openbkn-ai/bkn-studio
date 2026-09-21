/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Avatar, Empty, Input, Segmented, Select, Spin, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage, isRequestConflict } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DirectoryUserPicker } from "@/modules/system-admin";
import type {
  RowFilterExplain,
  RowFilterPolicy,
  RowFilterSnapshot,
  RowFilterSubject,
  RowFilterSubjectType,
  RowFilterTemplate,
  RowFilterValueType,
} from "@/modules/knowledge-network/types/row-filter-authorization";
import {
  explainRowFilter,
  getRowFilterSnapshot,
  patchRowFilterPolicy,
} from "@/modules/knowledge-network/services/row-filter-authorization.service";
import type { AdminRole, AdminUser } from "@/modules/system-admin/types/admin";

import styles from "./RowFilterAuthorizationPanel.module.css";

type EditableTemplate = "inherit" | RowFilterTemplate;

type Props = {
  discardNonce: number;
  objectTypeRef: string;
  onDirtyChange: (dirty: boolean) => void;
  roles: AdminRole[];
  users: AdminUser[];
};

const TEMPLATES_REQUIRING_PROPERTY = new Set<RowFilterTemplate>([
  "self",
  "department",
  "department_tree",
  "value_set",
]);

function policyKey(policy: RowFilterPolicy | null) {
  return JSON.stringify(policy ?? null);
}

function valueInputType(type?: RowFilterValueType) {
  if (type === "integer") return "numeric";
  return "text";
}

function parseValues(raw: string, type?: RowFilterValueType): Array<string | number | boolean> | null {
  const tokens = raw
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length || tokens.length > 100) return null;
  if (type === "integer") {
    const values = tokens.map(Number);
    return values.every(Number.isInteger) ? [...new Set(values)] : null;
  }
  if (type === "boolean") {
    const values = tokens.map((value) => value.toLowerCase());
    if (!values.every((value) => value === "true" || value === "false")) return null;
    return [...new Set(values)].map((value) => value === "true");
  }
  return [...new Set(tokens)];
}

function policySummary(policy: RowFilterPolicy | null, t: (key: string, options?: object) => string) {
  if (!policy) return t("knowledgeNetwork.rowFilterInherit");
  const template = t(`knowledgeNetwork.rowFilterTemplate.${policy.template}`);
  if (!policy.propertyName) return template;
  const values = policy.values?.length ? ` · ${policy.values.join(", ")}` : "";
  return `${template} · ${policy.propertyName}${values}`;
}

export function RowFilterAuthorizationPanel({
  discardNonce,
  objectTypeRef,
  onDirtyChange,
  roles,
  users,
}: Props) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [subjectType, setSubjectType] = useState<RowFilterSubjectType>("user");
  const [subjectId, setSubjectId] = useState<string>();
  const [roleKeyword, setRoleKeyword] = useState("");
  const [snapshot, setSnapshot] = useState<RowFilterSnapshot>();
  const [explain, setExplain] = useState<RowFilterExplain>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<EditableTemplate>("inherit");
  const [propertyName, setPropertyName] = useState<string>();
  const [valuesText, setValuesText] = useState("");

  const subject = useMemo<RowFilterSubject | null>(
    () => (subjectId ? { id: subjectId, type: subjectType } : null),
    [subjectId, subjectType],
  );
  const selectedField = snapshot?.availableFields.find((field) => field.name === propertyName);
  const initialPolicy = snapshot?.policy ?? null;
  const draftPolicy = useMemo<RowFilterPolicy | null>(() => {
    if (template === "inherit") return null;
    const values = template === "value_set" ? parseValues(valuesText, selectedField?.type) : [];
    return {
      propertyName: TEMPLATES_REQUIRING_PROPERTY.has(template) ? propertyName : undefined,
      template,
      values: values ?? [],
    };
  }, [propertyName, selectedField?.type, template, valuesText]);
  const dirty = Boolean(snapshot) && policyKey(draftPolicy) !== policyKey(initialPolicy);
  const valueError =
    template === "value_set" && parseValues(valuesText, selectedField?.type) === null
      ? t("knowledgeNetwork.rowFilterValueSetInvalid")
      : undefined;
  const policyIncomplete =
    template !== "inherit" &&
    (TEMPLATES_REQUIRING_PROPERTY.has(template) && !propertyName ||
      (template === "value_set" && Boolean(valueError)));
  const highRisk = template === "inherit" || template === "all_rows" || template === "no_rows";

  const resetDraft = useCallback((next: RowFilterSnapshot | undefined) => {
    const policy = next?.policy ?? null;
    setTemplate(policy?.template ?? "inherit");
    setPropertyName(policy?.propertyName);
    setValuesText(policy?.values?.join(", ") ?? "");
  }, []);

  const load = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    try {
      const [nextSnapshot, nextExplain] = await Promise.all([
        getRowFilterSnapshot(subject, objectTypeRef),
        explainRowFilter(subject, objectTypeRef),
      ]);
      setSnapshot(nextSnapshot);
      setExplain(nextExplain);
      resetDraft(nextSnapshot);
    } finally {
      setLoading(false);
    }
  }, [objectTypeRef, resetDraft, subject]);

  useEffect(() => {
    setSnapshot(undefined);
    setExplain(undefined);
    resetDraft(undefined);
    if (subject) void load();
  }, [load, resetDraft, subject]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!snapshot) return;
    resetDraft(snapshot);
  }, [discardNonce, resetDraft, snapshot]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const visibleRoles = useMemo(() => {
    const keyword = roleKeyword.trim().toLowerCase();
    return roles.filter((role) => `${role.name} ${role.description}`.toLowerCase().includes(keyword));
  }, [roleKeyword, roles]);

  const changeSubjectType = (nextType: RowFilterSubjectType) => {
    setSubjectType(nextType);
    setSubjectId(undefined);
    setRoleKeyword("");
  };

  const save = () => {
    if (!subject || !snapshot || !dirty || policyIncomplete) return;
    const submit = async () => {
      setSaving(true);
      try {
        const nextSnapshot = await patchRowFilterPolicy({
          expectedRevision: snapshot.revision,
          objectTypeRef,
          policy: draftPolicy,
          reason: "updated-from-object-type-authorization",
          subject,
        });
        setSnapshot(nextSnapshot);
        resetDraft(nextSnapshot);
        setExplain(await explainRowFilter(subject, objectTypeRef));
      } catch (error) {
        if (isRequestConflict(error)) {
          void message.warning(t("knowledgeNetwork.rowFilterRevisionConflict"));
          await load();
          return;
        }
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setSaving(false);
      }
    };
    if (highRisk) {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("knowledgeNetwork.rowFilterRiskConfirm", {
          next: policySummary(draftPolicy, t),
          previous: policySummary(initialPolicy, t),
        }),
        okButtonProps: { danger: template === "no_rows" },
        okText: t("common.confirm"),
        onOk: submit,
        title: t("knowledgeNetwork.rowFilterRiskHint"),
      });
      return;
    }
    void submit();
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.subjectRail}>
        <div className={styles.railHead}>
          <h2>{t("knowledgeNetwork.rowFilterSubjectTitle")}</h2>
          <p>{t("knowledgeNetwork.rowFilterSubjectDescription")}</p>
        </div>
        <Segmented
          block
          onChange={(value) => changeSubjectType(value as RowFilterSubjectType)}
          options={[
            { icon: <UserOutlined />, label: t("knowledgeNetwork.propertyAuthorizationUser"), value: "user" },
            { icon: <TeamOutlined />, label: t("knowledgeNetwork.propertyAuthorizationRole"), value: "role" },
          ]}
          value={subjectType}
        />
        {subjectType === "user" ? (
          <DirectoryUserPicker
            ariaLabel={t("knowledgeNetwork.rowFilterSelectUser")}
            initialUsers={users}
            onChange={setSubjectId}
            presentation="inline"
            value={subjectId}
          />
        ) : (
          <>
            <Input
              allowClear
              onChange={(event) => setRoleKeyword(event.target.value)}
              placeholder={t("knowledgeNetwork.propertyAuthorizationSearchRole")}
              value={roleKeyword}
            />
            <div className={styles.roleList}>
              {visibleRoles.map((role) => (
                <button
                  className={role.id === subjectId ? styles.subjectSelected : styles.subjectItem}
                  key={role.id}
                  onClick={() => setSubjectId(role.id)}
                  type="button"
                >
                  <Avatar icon={<TeamOutlined />} size={32} />
                  <span><strong>{role.name || role.id}</strong></span>
                </button>
              ))}
              {!visibleRoles.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
            </div>
          </>
        )}
      </aside>

      <section className={styles.content}>
        {!subject ? (
          <div className={styles.emptyState}>
            <SafetyCertificateOutlined />
            <h3>{t("knowledgeNetwork.rowFilterSelectSubject")}</h3>
            <p>{t("knowledgeNetwork.rowFilterSelectSubjectDescription")}</p>
          </div>
        ) : loading || !snapshot ? (
          <div className={styles.loading}><Spin /></div>
        ) : (
          <>
            <Alert
              className={styles.boundary}
              message={t("knowledgeNetwork.rowFilterBoundary")}
              showIcon
              type="info"
            />
            <div className={styles.policyCard}>
              <div className={styles.cardHead}>
                <div>
                  <span>{t("knowledgeNetwork.rowFilterPolicyTitle")}</span>
                  <p>{t("knowledgeNetwork.rowFilterPolicyDescription")}</p>
                </div>
                <Tag color={snapshot.policy ? "blue" : "default"}>{policySummary(snapshot.policy, t)}</Tag>
              </div>
              <label>{t("knowledgeNetwork.rowFilterTemplateLabel")}</label>
              <Select
                onChange={(next) => {
                  setTemplate(next as EditableTemplate);
                  if (next === "inherit" || !TEMPLATES_REQUIRING_PROPERTY.has(next as RowFilterTemplate)) {
                    setPropertyName(undefined);
                    setValuesText("");
                  }
                }}
                options={[
                  { label: t("knowledgeNetwork.rowFilterInherit"), value: "inherit" },
                  ...snapshot.availableTemplates.map((item) => ({
                    label: t(`knowledgeNetwork.rowFilterTemplate.${item}`),
                    value: item,
                  })),
                ]}
                value={template}
              />
              {TEMPLATES_REQUIRING_PROPERTY.has(template as RowFilterTemplate) ? (
                <div className={styles.fieldBlock}>
                  <label>{t("knowledgeNetwork.rowFilterFieldLabel")}</label>
                  <Select
                    onChange={(next) => { setPropertyName(next); setValuesText(""); }}
                    options={snapshot.availableFields.map((field) => ({ label: `${field.name} · ${field.type}`, value: field.name }))}
                    placeholder={t("knowledgeNetwork.rowFilterFieldPlaceholder")}
                    value={propertyName}
                  />
                </div>
              ) : null}
              {template === "value_set" ? (
                <div className={styles.fieldBlock}>
                  <label>{t("knowledgeNetwork.rowFilterValuesLabel")}</label>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    disabled={!propertyName}
                    inputMode={valueInputType(selectedField?.type)}
                    onChange={(event) => setValuesText(event.target.value)}
                    placeholder={t("knowledgeNetwork.rowFilterValuesPlaceholder")}
                    status={valueError ? "error" : undefined}
                    value={valuesText}
                  />
                  {valueError ? <span className={styles.fieldError}>{valueError}</span> : null}
                </div>
              ) : null}
              {highRisk && dirty ? <Alert message={t("knowledgeNetwork.rowFilterRiskHint")} showIcon type="warning" /> : null}
              <div className={styles.actions}>
                <AppButton disabled={!dirty || saving} onClick={() => resetDraft(snapshot)}>{t("common.cancel")}</AppButton>
                <AppButton disabled={!dirty || policyIncomplete} loading={saving} onClick={save} type="primary">
                  {t("knowledgeNetwork.rowFilterSave")}
                </AppButton>
              </div>
            </div>
            <div className={styles.explainCard}>
              <div className={styles.cardHead}>
                <div><span>{t("knowledgeNetwork.rowFilterExplainTitle")}</span><p>{t("knowledgeNetwork.rowFilterExplainDescription")}</p></div>
                <Tooltip title={t("knowledgeNetwork.rowFilterExplainDigestHelp")}><InfoCircleOutlined /></Tooltip>
              </div>
              {explain?.rolePolicyOnly ? (
                <Alert message={t("knowledgeNetwork.rowFilterRoleExplain")} showIcon type="info" />
              ) : (
                <>
                  <div className={styles.explainLine}><span>{t("knowledgeNetwork.rowFilterDirectPolicy")}</span><strong>{policySummary(explain?.directPolicy ?? null, t)}</strong></div>
                  <div className={styles.explainLine}><span>{t("knowledgeNetwork.rowFilterEffectiveRule")}</span><strong>{explain?.effectivePredicate?.kind ?? "—"}</strong></div>
                  <div className={styles.explainLine}><span>{t("knowledgeNetwork.rowFilterDigest")}</span><code>{explain?.effectiveRowFilterDigest || "—"}</code></div>
                </>
              )}
              {explain?.rolePolicies.length ? (
                <div className={styles.rolePolicies}>
                  {explain.rolePolicies.map((source) => <Tag key={`${source.subject.type}:${source.subject.id}`}>{source.subject.id} · {policySummary(source.policy, t)}</Tag>)}
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
