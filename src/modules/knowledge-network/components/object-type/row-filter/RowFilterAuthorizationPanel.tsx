/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for details.
 */

import {
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Input, Segmented, Select, Spin, Tooltip } from "antd";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage, isRequestConflict } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { GrantableRolePicker, GrantableUserPicker } from "@/modules/system-admin";
import type { GrantableRole } from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import {
  explainRowFilter,
  getRowFilterSnapshot,
  patchRowFilterPolicy,
} from "@/modules/knowledge-network/services/row-filter-authorization.service";
import type {
  RowFilterAvailableField,
  RowFilterConditionOperator,
  RowFilterExplain,
  RowFilterPolicy,
  RowFilterSnapshot,
  RowFilterSubject,
  RowFilterSubjectType,
  RowFilterValueType,
} from "@/modules/knowledge-network/types/row-filter-authorization";

import styles from "./RowFilterAuthorizationPanel.module.css";
import {
  parseRowFilterValues,
  rowFilterFieldBusinessLabel,
  rowFilterFieldOptionLabel,
} from "./row-filter.utils";

const MAX_CONDITIONS = 5;

type Props = {
  allowRoleSubjects: boolean;
  allowUserSubjects: boolean;
  canWriteRole: boolean;
  canWriteUser: boolean;
  discardNonce: number;
  initialSubjectId?: string;
  objectTypeRef: string;
  onBeforeSubjectChange: (next: () => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  roles: GrantableRole[];
  users: AdminUser[];
};

type EditableCondition = {
  id: string;
  operator: RowFilterConditionOperator;
  propertyName?: string;
  touched?: boolean;
  upperValueText?: string;
  valuesText: string;
};

type EffectiveRuleSource = { effect: string; id: string; label: string };

function valueInputType(type?: RowFilterValueType) {
  return type === "integer" ? "numeric" : "text";
}

function conditionOperators(type?: RowFilterValueType): RowFilterConditionOperator[] {
  if (type === "integer") return ["in", "not_in", "gt", "gte", "lt", "lte", "between"];
  if (type === "string") return ["in", "not_in"];
  return ["in"];
}

function parseConditionValues(
  condition: EditableCondition,
  type?: RowFilterValueType,
): Array<string | number | boolean> | null {
  if (!type || !conditionOperators(type).includes(condition.operator)) return null;
  const values = parseRowFilterValues(condition.valuesText, type);
  if (!values) return null;
  if (condition.operator === "in" || condition.operator === "not_in") return values;
  if (type !== "integer" || values.length !== 1) return null;
  if (condition.operator !== "between") return values;
  const upperValues = parseRowFilterValues(condition.upperValueText ?? "", "integer");
  if (!upperValues || upperValues.length !== 1 || Number(values[0]) > Number(upperValues[0]))
    return null;
  return [values[0], upperValues[0]];
}

function editableConditionsFor(policy: RowFilterPolicy | null): EditableCondition[] {
  return (policy?.conditions ?? []).map((condition, index) => ({
    id: `saved-${index}-${condition.propertyName}`,
    operator: condition.operator,
    propertyName: condition.propertyName,
    upperValueText:
      condition.operator === "between" ? String(condition.values[1] ?? "") : undefined,
    valuesText: String(condition.values[0] ?? "").concat(
      condition.operator === "in" || condition.operator === "not_in"
        ? condition.values
            .slice(1)
            .map((value) => `, ${value}`)
            .join("")
        : "",
    ),
  }));
}

function editableStateKey(relation: "and" | "or", conditions: EditableCondition[]) {
  return JSON.stringify({
    relation,
    conditions: conditions.map(({ operator, propertyName, upperValueText, valuesText }) => ({
      operator,
      propertyName: propertyName ?? "",
      upperValueText: upperValueText ?? "",
      valuesText,
    })),
  });
}

function policySummary(
  policy: RowFilterPolicy | null,
  t: TFunction,
  fields: RowFilterAvailableField[],
) {
  if (!policy) return t("knowledgeNetwork.rowFilterInherit");
  const relation = t(
    policy.relation === "and"
      ? "knowledgeNetwork.rowFilterConditionGroupAnd"
      : "knowledgeNetwork.rowFilterConditionGroupOr",
  );
  const summary = policy.conditions
    .map((condition) => {
      const field = fields.find((item) => item.name === condition.propertyName);
      const operator = t(`knowledgeNetwork.rowFilterConditionOperator.${condition.operator}`);
      return `${field ? rowFilterFieldBusinessLabel(field) : condition.propertyName} ${operator} ${condition.values.join("、")}`;
    })
    .join(` ${relation} `);
  return policy.conditions.length > 1
    ? t("knowledgeNetwork.rowFilterConditionGroupWrap", { summary })
    : summary;
}

export function RowFilterAuthorizationPanel({
  allowRoleSubjects,
  allowUserSubjects,
  canWriteRole,
  canWriteUser,
  discardNonce,
  initialSubjectId,
  objectTypeRef,
  onBeforeSubjectChange,
  onDirtyChange,
  roles,
  users,
}: Props) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [subjectType, setSubjectType] = useState<RowFilterSubjectType>(
    allowUserSubjects ? "user" : "role",
  );
  const [subjectId, setSubjectId] = useState<string>();
  const [pickedUsers, setPickedUsers] = useState<AdminUser[]>([]);
  const [pickedRoles, setPickedRoles] = useState<GrantableRole[]>([]);
  const [snapshot, setSnapshot] = useState<RowFilterSnapshot>();
  const [explain, setExplain] = useState<RowFilterExplain>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [conditions, setConditions] = useState<EditableCondition[]>([]);
  const [conditionRelation, setConditionRelation] = useState<"and" | "or">("and");
  const loadRequestId = useRef(0);

  useEffect(() => {
    if (initialSubjectId && allowUserSubjects) {
      setSubjectType("user");
      setSubjectId(initialSubjectId);
    }
  }, [allowUserSubjects, initialSubjectId]);

  useEffect(() => {
    if (subjectType === "user" && !allowUserSubjects && allowRoleSubjects) {
      setSubjectType("role");
      setSubjectId(undefined);
    } else if (subjectType === "role" && !allowRoleSubjects && allowUserSubjects) {
      setSubjectType("user");
      setSubjectId(undefined);
    }
  }, [allowRoleSubjects, allowUserSubjects, subjectType]);

  const subject = useMemo<RowFilterSubject | null>(
    () => (subjectId ? { id: subjectId, type: subjectType } : null),
    [subjectId, subjectType],
  );
  const initialPolicy = snapshot?.policy ?? null;
  const baselineState = useMemo(
    () => editableStateKey(initialPolicy?.relation ?? "and", editableConditionsFor(initialPolicy)),
    [initialPolicy],
  );
  const currentState = editableStateKey(conditionRelation, conditions);
  const canWriteCurrentSubject = subjectType === "user" ? canWriteUser : canWriteRole;
  const dirty =
    canWriteCurrentSubject && Boolean(snapshot) && editing && currentState !== baselineState;
  const conditionErrors = conditions.map((condition) => {
    const field = snapshot?.availableFields.find((item) => item.name === condition.propertyName);
    return !condition.propertyName || parseConditionValues(condition, field?.type) === null;
  });
  const hasConditionError = conditionErrors.some(Boolean);
  const validPolicy = useMemo<RowFilterPolicy | null>(() => {
    if (!conditions.length || hasConditionError) return null;
    return {
      relation: conditionRelation,
      conditions: conditions.map((condition) => {
        const field = snapshot?.availableFields.find(
          (item) => item.name === condition.propertyName,
        );
        return {
          operator: condition.operator,
          propertyName: condition.propertyName as string,
          values: parseConditionValues(condition, field?.type) as Array<string | number | boolean>,
        };
      }),
    };
  }, [conditionRelation, conditions, hasConditionError, snapshot?.availableFields]);
  const canSave =
    canWriteCurrentSubject &&
    dirty &&
    !saving &&
    !hasConditionError &&
    (Boolean(conditions.length) || Boolean(initialPolicy));
  const policyTitle = (
    <span className={styles.cardTitleWithHelp}>
      {t("knowledgeNetwork.rowFilterPolicyTitle")}
      <Tooltip title={t("knowledgeNetwork.rowFilterPolicyDescription")}>
        <InfoCircleOutlined
          aria-label={t("knowledgeNetwork.rowFilterPolicyDescription")}
          tabIndex={0}
        />
      </Tooltip>
    </span>
  );
  const directPolicy = explain?.directPolicy ?? initialPolicy;
  const currentSubjectName =
    subjectType === "user"
      ? (() => {
          const user =
            users.find((item) => item.id === subjectId) ??
            pickedUsers.find((item) => item.id === subjectId);
          return user?.name?.trim() || user?.account?.trim() || subjectId;
        })()
      : (
          roles.find((item) => item.id === subjectId) ??
          pickedRoles.find((item) => item.id === subjectId)
        )?.name || subjectId;
  const effectiveSources: EffectiveRuleSource[] = [];
  if (directPolicy) {
    effectiveSources.push({
      effect: policySummary(directPolicy, t, snapshot?.availableFields ?? []),
      id: `current-${subjectType}`,
      label: t(
        subjectType === "user"
          ? "knowledgeNetwork.rowFilterSourceCurrentUser"
          : "knowledgeNetwork.rowFilterSourceCurrentRole",
        { name: currentSubjectName },
      ),
    });
  }
  (explain?.rolePolicies ?? []).forEach((source) => {
    const roleName =
      (
        roles.find((role) => role.id === source.subject.id) ??
        pickedRoles.find((role) => role.id === source.subject.id)
      )?.name || source.subject.id;
    effectiveSources.push({
      effect: policySummary(source.policy, t, snapshot?.availableFields ?? []),
      id: `${source.subject.type}:${source.subject.id}`,
      label: t("knowledgeNetwork.rowFilterSourceRole", { name: roleName }),
    });
  });
  const effectivePolicyEffect = !effectiveSources.length
    ? t("knowledgeNetwork.rowFilterEffectBasePermission")
    : effectiveSources.length === 1
      ? t("knowledgeNetwork.rowFilterEffectFixedConditions")
      : t("knowledgeNetwork.rowFilterEffectOneOfSources");

  const resetDraft = useCallback((next: RowFilterSnapshot | undefined) => {
    const policy = next?.policy ?? null;
    setEditing(Boolean(policy));
    setConditions(editableConditionsFor(policy));
    setConditionRelation(policy?.relation ?? "and");
  }, []);

  const load = useCallback(async () => {
    if (!subject) return;
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextSnapshot, nextExplain] = await Promise.all([
        getRowFilterSnapshot(subject, objectTypeRef),
        explainRowFilter(subject, objectTypeRef),
      ]);
      if (requestId !== loadRequestId.current) return;
      setSnapshot(nextSnapshot);
      setExplain(nextExplain);
      resetDraft(nextSnapshot);
    } catch (error) {
      if (requestId !== loadRequestId.current) return;
      setSnapshot(undefined);
      setExplain(undefined);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [objectTypeRef, resetDraft, subject]);

  useEffect(() => {
    setSnapshot(undefined);
    setExplain(undefined);
    setLoadError(undefined);
    resetDraft(undefined);
    if (subject) void load();
    return () => {
      loadRequestId.current += 1;
    };
  }, [load, resetDraft, subject]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (snapshot) resetDraft(snapshot);
  }, [discardNonce, resetDraft, snapshot]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const changeSubjectType = (nextType: RowFilterSubjectType) =>
    onBeforeSubjectChange(() => {
      setSubjectType(nextType);
      setSubjectId(undefined);
    });
  const save = async () => {
    if (!subject || !snapshot || !canSave) return;
    const requestId = loadRequestId.current;
    setSaving(true);
    try {
      const nextSnapshot = await patchRowFilterPolicy({
        expectedRevision: snapshot.revision,
        objectTypeRef,
        policy: validPolicy,
        reason: "updated-from-object-type-authorization",
        subject,
      });
      if (requestId !== loadRequestId.current) return;
      setSnapshot(nextSnapshot);
      resetDraft(nextSnapshot);
      const nextExplain = await explainRowFilter(subject, objectTypeRef);
      if (requestId === loadRequestId.current) setExplain(nextExplain);
    } catch (error) {
      if (requestId !== loadRequestId.current) return;
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

  const addCondition = () =>
    setConditions((current) => [
      ...current,
      { id: crypto.randomUUID(), operator: "in", valuesText: "" },
    ]);
  const updateCondition = (id: string, update: Partial<EditableCondition>) =>
    setConditions((current) =>
      current.map((condition) => (condition.id === id ? { ...condition, ...update } : condition)),
    );

  return (
    <div className={styles.workspace}>
      <aside className={styles.subjectRail}>
        <div className={styles.railHead}>
          <h2>
            {t("knowledgeNetwork.rowFilterSubjectTitle")}
            <Tooltip title={t("knowledgeNetwork.rowFilterSubjectHelp")}>
              <InfoCircleOutlined
                aria-label={t("knowledgeNetwork.rowFilterSubjectHelp")}
                tabIndex={0}
              />
            </Tooltip>
          </h2>
          <p>{t("knowledgeNetwork.rowFilterSubjectDescription")}</p>
        </div>
        <Segmented
          block
          onChange={(value) => changeSubjectType(value as RowFilterSubjectType)}
          options={[
            ...(allowUserSubjects
              ? [
                  {
                    icon: <UserOutlined />,
                    label: t("knowledgeNetwork.propertyAuthorizationUser"),
                    value: "user",
                  },
                ]
              : []),
            ...(allowRoleSubjects
              ? [
                  {
                    icon: <TeamOutlined />,
                    label: t("knowledgeNetwork.propertyAuthorizationRole"),
                    value: "role",
                  },
                ]
              : []),
          ]}
          value={subjectType}
        />
        {subjectType === "user" ? (
          <div className={styles.userPickerSection}>
            <span>{t("knowledgeNetwork.rowFilterUserOrganizationFilter")}</span>
            <GrantableUserPicker
              ariaLabel={t("knowledgeNetwork.rowFilterSelectUser")}
              className={styles.userPicker}
              initialUsers={users}
              onChange={(nextUserId) => onBeforeSubjectChange(() => setSubjectId(nextUserId))}
              onUsersChange={(nextUsers) =>
                setPickedUsers((current) => {
                  const byID = new Map(current.map((user) => [user.id, user]));
                  nextUsers.forEach((user) => byID.set(user.id, user));
                  return [...byID.values()];
                })
              }
              presentation="inline"
              resourceId={objectTypeRef}
              resourceType="object_type"
              value={subjectId}
            />
          </div>
        ) : (
          <GrantableRolePicker
            ariaLabel={t("knowledgeNetwork.propertyAuthorizationSearchRole")}
            className={styles.userPicker}
            initialRoles={roles}
            onChange={(nextRoleId) => onBeforeSubjectChange(() => setSubjectId(nextRoleId))}
            onRolesChange={(nextRoles) =>
              setPickedRoles((current) => {
                const byId = new Map(current.map((role) => [role.id, role]));
                nextRoles.forEach((role) => byId.set(role.id, role));
                return [...byId.values()];
              })
            }
            presentation="inline"
            resourceId={objectTypeRef}
            resourceType="object_type"
            value={subjectId}
          />
        )}
      </aside>
      <section className={styles.content}>
        {!subject ? (
          <div className={styles.emptyState}>
            <SafetyCertificateOutlined />
            <h3>{t("knowledgeNetwork.rowFilterSelectSubject")}</h3>
            <p>{t("knowledgeNetwork.rowFilterSelectSubjectDescription")}</p>
          </div>
        ) : loading ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : loadError ? (
          <div className={styles.loadFailure}>
            <Alert
              action={<AppButton onClick={() => void load()}>{t("common.retry")}</AppButton>}
              description={loadError}
              message={t("knowledgeNetwork.rowFilterLoadFailed")}
              showIcon
              type="error"
            />
          </div>
        ) : !snapshot ? (
          <div className={styles.emptyState}>
            <p>{t("knowledgeNetwork.rowFilterLoadFailed")}</p>
          </div>
        ) : (
          <>
            {!editing ? (
              <div className={`${styles.policyCard} ${styles.inheritCard}`}>
                <div className={styles.cardHead}>
                  <div>{policyTitle}</div>
                </div>
                <div className={styles.inheritState}>
                  <strong>{t("knowledgeNetwork.rowFilterInheritStateTitle")}</strong>
                  <p>{t("knowledgeNetwork.rowFilterInheritStateDescription")}</p>
                  <AppButton
                    disabled={!canWriteCurrentSubject}
                    onClick={() => setEditing(true)}
                    type="primary"
                  >
                    {t("knowledgeNetwork.rowFilterConfigure")}
                  </AppButton>
                </div>
              </div>
            ) : (
              <div className={styles.policyCard}>
                <div className={styles.cardHead}>
                  <div>{policyTitle}</div>
                </div>
                <div className={styles.conditionsBlock}>
                  <div
                    className={conditions.length ? styles.conditionsGroup : styles.emptyConditions}
                  >
                    <div className={styles.conditionsHead}>
                      {conditions.length > 1 ? (
                        <div className={styles.conditionRelation}>
                          <span>{t("knowledgeNetwork.rowFilterConditionRelation")}</span>
                          <Select
                            disabled={!canWriteCurrentSubject}
                            onChange={setConditionRelation}
                            options={[
                              {
                                label: t("knowledgeNetwork.rowFilterConditionGroupAnd"),
                                value: "and",
                              },
                              {
                                label: t("knowledgeNetwork.rowFilterConditionGroupOr"),
                                value: "or",
                              },
                            ]}
                            value={conditionRelation}
                          />
                        </div>
                      ) : null}
                      <AppButton
                        disabled={!canWriteCurrentSubject || conditions.length >= MAX_CONDITIONS}
                        icon={<PlusOutlined />}
                        onClick={addCondition}
                        type="default"
                      >
                        {t("knowledgeNetwork.rowFilterAddCondition")}
                      </AppButton>
                    </div>
                    {conditions.length ? (
                      <div className={styles.conditionsList}>
                        {conditions.map((condition, index) => {
                          const field = snapshot.availableFields.find(
                            (item) => item.name === condition.propertyName,
                          );
                          const isRangeOperator = condition.operator === "between";
                          const showConditionError =
                            condition.touched &&
                            Boolean(
                              condition.valuesText.trim() || condition.upperValueText?.trim(),
                            ) &&
                            conditionErrors[index];
                          return (
                            <div className={styles.conditionItem} key={condition.id}>
                              <div className={styles.conditionRow}>
                                <Select
                                  disabled={!canWriteCurrentSubject}
                                  onChange={(propertyName) =>
                                    updateCondition(condition.id, {
                                      operator: "in",
                                      propertyName,
                                      touched: false,
                                      upperValueText: "",
                                      valuesText: "",
                                    })
                                  }
                                  options={snapshot.availableFields.map((item) => ({
                                    label: rowFilterFieldOptionLabel(item),
                                    value: item.name,
                                  }))}
                                  placeholder={t("knowledgeNetwork.rowFilterFieldPlaceholder")}
                                  value={condition.propertyName}
                                />
                                <Select
                                  className={styles.conditionOperatorSelect}
                                  disabled={!canWriteCurrentSubject || !condition.propertyName}
                                  onChange={(operator) =>
                                    updateCondition(condition.id, {
                                      operator,
                                      touched: false,
                                      upperValueText: "",
                                      valuesText: "",
                                    })
                                  }
                                  options={conditionOperators(field?.type).map((operator) => ({
                                    label: t(
                                      `knowledgeNetwork.rowFilterConditionOperator.${operator}`,
                                    ),
                                    value: operator,
                                  }))}
                                  value={condition.operator}
                                />
                                {isRangeOperator ? (
                                  <div className={styles.conditionValueRange}>
                                    <Input
                                      disabled={!canWriteCurrentSubject || !condition.propertyName}
                                      inputMode="numeric"
                                      onBlur={() =>
                                        updateCondition(condition.id, { touched: true })
                                      }
                                      onChange={(event) =>
                                        updateCondition(condition.id, {
                                          touched: true,
                                          valuesText: event.target.value,
                                        })
                                      }
                                      placeholder={t(
                                        "knowledgeNetwork.rowFilterRangeStartPlaceholder",
                                      )}
                                      status={showConditionError ? "error" : undefined}
                                      value={condition.valuesText}
                                    />
                                    <span>{t("knowledgeNetwork.rowFilterRangeSeparator")}</span>
                                    <Input
                                      disabled={!canWriteCurrentSubject || !condition.propertyName}
                                      inputMode="numeric"
                                      onBlur={() =>
                                        updateCondition(condition.id, { touched: true })
                                      }
                                      onChange={(event) =>
                                        updateCondition(condition.id, {
                                          touched: true,
                                          upperValueText: event.target.value,
                                        })
                                      }
                                      placeholder={t(
                                        "knowledgeNetwork.rowFilterRangeEndPlaceholder",
                                      )}
                                      status={showConditionError ? "error" : undefined}
                                      value={condition.upperValueText}
                                    />
                                  </div>
                                ) : (
                                  <Input.TextArea
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    disabled={!canWriteCurrentSubject || !condition.propertyName}
                                    inputMode={valueInputType(field?.type)}
                                    onBlur={() => updateCondition(condition.id, { touched: true })}
                                    onChange={(event) =>
                                      updateCondition(condition.id, {
                                        touched: true,
                                        valuesText: event.target.value,
                                      })
                                    }
                                    placeholder={t(
                                      condition.operator === "in" || condition.operator === "not_in"
                                        ? "knowledgeNetwork.rowFilterValuesPlaceholder"
                                        : "knowledgeNetwork.rowFilterValuePlaceholder",
                                    )}
                                    status={showConditionError ? "error" : undefined}
                                    value={condition.valuesText}
                                  />
                                )}
                                <AppButton
                                  aria-label={t("knowledgeNetwork.rowFilterRemoveCondition")}
                                  disabled={!canWriteCurrentSubject}
                                  icon={<DeleteOutlined />}
                                  onClick={() =>
                                    setConditions((current) =>
                                      current.filter((item) => item.id !== condition.id),
                                    )
                                  }
                                  type="text"
                                />
                                {showConditionError ? (
                                  <span className={styles.conditionError}>
                                    {t("knowledgeNetwork.rowFilterConditionValueInvalid")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.actions}>
                  <AppButton disabled={!dirty || saving} onClick={() => resetDraft(snapshot)}>
                    {t("common.cancel")}
                  </AppButton>
                  <AppButton
                    disabled={!canSave}
                    loading={saving}
                    onClick={() => void save()}
                    type="primary"
                  >
                    {t("knowledgeNetwork.rowFilterSave")}
                  </AppButton>
                </div>
              </div>
            )}
            <div className={styles.explainCard}>
              <div className={styles.cardHead}>
                <div>
                  <span>{t("knowledgeNetwork.rowFilterResultTitle")}</span>
                </div>
              </div>
              <div className={styles.effectiveResult}>
                <strong>{effectivePolicyEffect}</strong>
              </div>
              <div className={styles.sourceSection}>
                <span>{t("knowledgeNetwork.rowFilterSourcesTitle")}</span>
                {effectiveSources.length ? (
                  <div className={styles.sourceList}>
                    {effectiveSources.map((source) => (
                      <div className={styles.sourceItem} key={source.id}>
                        <strong>{source.label}</strong>
                        <span>
                          <b>{t("knowledgeNetwork.rowFilterFixedConditionsLabel")}</b>
                          {source.effect}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.sourceEmpty}>
                    {t("knowledgeNetwork.rowFilterNoRuleSources")}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
