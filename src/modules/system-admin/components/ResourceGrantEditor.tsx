/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, InfoCircleOutlined, LockOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Empty, Radio, Select, Spin, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listAuthorizableObjectsPage } from "@/modules/system-admin/services/authz.service";
import {
  resourceGrantNameKey,
  resolveResourceGrantNames,
} from "@/modules/system-admin/services/authz-objects.service";
import type { AuthorizableObject } from "@/modules/system-admin/types/authz";
import type { ResourceGrant, ResourceRef } from "@/modules/system-admin/types/admin";
import {
  HIDDEN_INSTANCE_OPS,
  isAuthzObjectPickerType,
} from "@/modules/system-admin/utils/authz-catalog";
import {
  addOperationToGrant,
  normalizeRoleOperations,
  removeOperationFromGrant,
} from "@/modules/system-admin/utils/resource-grant-operations";
import {
  operationLabel,
  operationsForType,
  ROLE_GRANT_RESOURCE_TYPES,
  resourceTypeLabel,
  resourceTypeDescription,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ResourceGrantEditorProps = {
  disabled?: boolean;
  /** Locked to one resource, such as a data-connection grant; only operations can be selected. */
  lockedResource?: ResourceRef;
  onChange: (next: ResourceGrant[]) => void;
  value: ResourceGrant[];
};

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

const ROLE_RESOURCE_TYPE_GROUPS = [
  { key: "data", types: ["catalog", "resource"] },
  {
    key: "knowledge",
    types: ["knowledge_network", "concept_group", "object_type", "relation_type", "action_type", "metric"],
  },
  { key: "model", types: ["small_model", "large_model"] },
  { key: "execution", types: ["operator", "tool_box", "mcp", "skill"] },
  { key: "system", types: ["admin-user", "admin-dept", "admin-role", "admin-authz", "admin-audit", "safe_admin"] },
] as const;

export function ResourceGrantEditor({
  disabled,
  lockedResource,
  onChange,
  value,
}: ResourceGrantEditorProps) {
  const { t } = useTranslation();
  const [draftType, setDraftType] = useState<string>(
    lockedResource?.type ?? "",
  );
  const [draftId, setDraftId] = useState<string>(lockedResource?.id ?? "");
  const [wholeType, setWholeType] = useState<boolean>(!lockedResource);
  const [draftOps, setDraftOps] = useState<string[]>([]);
  const [addingGrantKey, setAddingGrantKey] = useState<string | null>(null);
  const [objects, setObjects] = useState<AuthorizableObject[]>([]);
  const [objectKeyword, setObjectKeyword] = useState("");
  const debouncedObjectKeyword = useDebouncedValue(objectKeyword.trim(), 300);
  const [objectLoading, setObjectLoading] = useState(false);
  const [objectLoadError, setObjectLoadError] = useState<string | null>(null);
  const [failedObjectRequest, setFailedObjectRequest] = useState<{
    append: boolean;
    page: number;
  } | null>(null);
  const [objectPage, setObjectPage] = useState(0);
  const [objectTotal, setObjectTotal] = useState(0);
  const [resourceNames, setResourceNames] = useState<Map<string, { name: string; sub?: string }>>(
    new Map(),
  );
  const objectRequestRef = useRef(0);

  const supportsSpecificResource = isAuthzObjectPickerType(draftType);
  const effectiveWholeType = !supportsSpecificResource || wholeType;
  const canConfigureOperations = Boolean(draftType && (effectiveWholeType || draftId));
  const resourceTypeOptions = useMemo(() => {
    const allowed = new Map(ROLE_GRANT_RESOURCE_TYPES.map((item) => [item.type, item]));
    return ROLE_RESOURCE_TYPE_GROUPS.map((group) => ({
      label: t(`systemAdmin.objectGrants.objectTypeGroups.${group.key}`),
      options: group.types.flatMap((type) => {
        const resourceType = allowed.get(type);
        return resourceType
          ? [{ label: resourceTypeLabel(resourceType.type), value: resourceType.type }]
          : [];
      }),
    })).filter((group) => group.options.length);
  }, [t]);
  const ops = useMemo(
    () => operationsForType(draftType).filter(
      (operation) => effectiveWholeType || !HIDDEN_INSTANCE_OPS.has(operation.key),
    ),
    [draftType, effectiveWholeType],
  );

  const resolvedId = lockedResource
    ? lockedResource.id
    : effectiveWholeType
      ? WILDCARD
      : draftId.trim();

  const loadObjectPage = useCallback(async (page: number, append: boolean) => {
    if (!supportsSpecificResource || effectiveWholeType) {
      return;
    }
    const request = ++objectRequestRef.current;
    setObjectLoading(true);
    setObjectLoadError(null);
    setFailedObjectRequest(null);
    try {
      const result = await listAuthorizableObjectsPage(draftType, {
        keyword: debouncedObjectKeyword,
        page,
      });
      if (request !== objectRequestRef.current) {
        return;
      }
      setObjects((previous) => {
        const candidates = append ? [...previous, ...result.items] : result.items;
        return [...new Map(candidates.map((item) => [item.id, item])).values()];
      });
      setObjectPage(page);
      setObjectTotal(result.total);
    } catch (error) {
      if (request === objectRequestRef.current) {
        setObjectLoadError(extractRequestErrorMessage(error));
        setFailedObjectRequest({ append, page });
      }
    } finally {
      if (request === objectRequestRef.current) {
        setObjectLoading(false);
      }
    }
  }, [debouncedObjectKeyword, draftType, effectiveWholeType, supportsSpecificResource]);

  useEffect(() => {
    if (!supportsSpecificResource || effectiveWholeType) {
      objectRequestRef.current += 1;
      setObjects([]);
      setObjectPage(0);
      setObjectTotal(0);
      setObjectLoadError(null);
      setFailedObjectRequest(null);
      return;
    }
    void loadObjectPage(0, false);
  }, [effectiveWholeType, loadObjectPage, supportsSpecificResource]);

  useEffect(() => {
    let active = true;
    void resolveResourceGrantNames(value)
      .then((names) => {
        if (active) {
          setResourceNames(names);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [value]);

  const objectOptions = useMemo(() => {
    const selected = draftId && !objects.some((item) => item.id === draftId)
      ? [{ id: draftId, name: draftId, type: draftType }, ...objects]
      : objects;
    return selected.map((item) => ({
      label: item.sub ? `${item.name} (${item.sub})` : item.name,
      value: item.id,
    }));
  }, [draftId, draftType, objects]);

  const draftRequirements = useMemo(
    () => ops.flatMap((requirement) => {
      const dependents = ops.filter(
        (operation) => draftOps.includes(operation.key) && operation.requires.includes(requirement.key),
      );
      return dependents.length ? [{ dependents, requirement }] : [];
    }),
    [draftOps, ops],
  );

  const toggleDraftOperation = (operationKey: string) => {
    setDraftOps((previous) => {
      if (previous.includes(operationKey)) {
        const requiredBySelected = ops.some(
          (operation) => previous.includes(operation.key) && operation.requires.includes(operationKey),
        );
        return requiredBySelected ? previous : previous.filter((key) => key !== operationKey);
      }
      return normalizeRoleOperations(draftType, [...previous, operationKey]);
    });
  };

  const addGrant = () => {
    if (
      !draftType ||
      !draftOps.length ||
      (!lockedResource && !effectiveWholeType && !draftId.trim())
    ) {
      return;
    }
    const resource: ResourceRef = { type: draftType, id: resolvedId };
    const existing = value.find((grant) => sameResource(grant.resource, resource));
    const next = existing
      ? value.map((grant) =>
          grant === existing
            ? { ...grant, operations: Array.from(new Set([...grant.operations, ...draftOps])) }
            : grant,
        )
      : [...value, { resource, operations: [...draftOps] }];
    onChange(next);
    setDraftOps([]);
    if (!lockedResource && !wholeType) {
      setDraftId("");
    }
  };

  const removeGrant = (grant: ResourceGrant) => {
    onChange(value.filter((item) => item !== grant));
  };

  const addOperation = (grant: ResourceGrant, operation: string) => {
    onChange(addOperationToGrant(value, grant, operation));
    setAddingGrantKey(null);
  };

  const removeOperation = (grant: ResourceGrant, operation: string) => {
    onChange(removeOperationFromGrant(value, grant, operation));
  };

  return (
    <div className={styles.grantEditor}>
      {value.length ? (
        <div className={styles.grantList}>
          {value.map((grant, index) => (
            <div className={styles.grantItem} key={`${grant.resource.type}:${grant.resource.id}:${index}`}>
              <div className={styles.grantMeta}>
                <Tooltip title={resourceTypeDescription(grant.resource.type)}>
                  <Tag className={styles.roleTag}>{resourceTypeLabel(grant.resource.type)}</Tag>
                </Tooltip>
                <span
                  className={[styles.slugChip, styles.grantResourceName].join(" ")}
                  title={grant.resource.id === WILDCARD ? undefined : grant.resource.id}
                >
                  {grant.resource.id === WILDCARD
                    ? t("systemAdmin.grant.wholeType")
                    : resourceNames.get(resourceGrantNameKey(grant.resource.type, grant.resource.id))?.name ?? grant.resource.id}
                </span>
              </div>
              <div className={styles.chipRow}>
                {grant.operations.map((op) => (
                  <Tag
                    closable={!disabled}
                    className={styles.permChip}
                    key={op}
                    onClose={(event) => {
                      event.preventDefault();
                      removeOperation(grant, op);
                    }}
                  >
                    {grant.resource.id === WILDCARD || op === "*"
                      ? op === "*"
                        ? t("systemAdmin.grant.allOps")
                        : operationLabel(grant.resource.type, op)
                      : operationLabel(grant.resource.type, op)}
                  </Tag>
                ))}
                {!disabled && !grant.operations.includes("*") ? (
                  addingGrantKey === `${grant.resource.type}:${grant.resource.id}:${index}` ? (
                    <Select
                      autoFocus
                      onBlur={() => setAddingGrantKey(null)}
                      onSelect={(operation: string) => addOperation(grant, operation)}
                      options={operationsForType(grant.resource.type)
                        .filter((operation) =>
                          grant.resource.id === WILDCARD || !HIDDEN_INSTANCE_OPS.has(operation.key))
                        .filter((operation) => !grant.operations.includes(operation.key))
                        .map((operation) => ({ label: operation.label, value: operation.key }))}
                      placeholder={t("systemAdmin.grant.operationsPlaceholder")}
                      size="small"
                      style={{ minWidth: 150 }}
                    />
                  ) : (
                    <Tooltip title={t("systemAdmin.grant.addOperation")}>
                      <AppButton
                        icon={<PlusOutlined />}
                        onClick={() => setAddingGrantKey(`${grant.resource.type}:${grant.resource.id}:${index}`)}
                        size="small"
                        type="link"
                      >
                        {t("systemAdmin.grant.addOperation")}
                      </AppButton>
                    </Tooltip>
                  )
                ) : null}
              </div>
              {!disabled ? (
                <AppButton
                  className={[styles.actionLink, styles.actionDanger].join(" ")}
                  icon={<DeleteOutlined />}
                  onClick={() => removeGrant(grant)}
                  size="small"
                  type="link"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("systemAdmin.grant.empty")}
          style={{ margin: "8px 0" }}
        />
      )}

      {!disabled ? (
        <div className={styles.grantAddRow}>
          {!lockedResource ? (
            <>
              <Select
                allowClear
                aria-label={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                onChange={(type) => {
                  setDraftType(type ?? "");
                  setDraftId("");
                  setWholeType(true);
                  setObjectKeyword("");
                  setDraftOps([]);
                }}
                options={resourceTypeOptions}
                placeholder={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                style={{ minWidth: 160 }}
                value={draftType || undefined}
              />
              {draftType ? (
                <>
                  <div className={styles.grantScope}>
                    <span className={styles.grantScopeLabel}>{t("systemAdmin.grant.scopeLabel")}</span>
                    <Radio.Group
                      aria-label={t("systemAdmin.grant.scopeLabel")}
                      onChange={(event) => {
                        const nextWholeType = event.target.value === "all";
                        setWholeType(nextWholeType);
                        setDraftId("");
                        setObjectKeyword("");
                        setDraftOps([]);
                      }}
                      value={effectiveWholeType ? "all" : "specific"}
                    >
                      <Radio value="all">{t("systemAdmin.grant.wholeType")}</Radio>
                      <Radio disabled={!supportsSpecificResource} value="specific">
                        {t("systemAdmin.grant.specificResources")}
                      </Radio>
                    </Radio.Group>
                  </div>
                  {supportsSpecificResource && !effectiveWholeType ? (
                    <Select
                      aria-label={t("systemAdmin.objectGrants.pickerObjectPlaceholder")}
                      className={styles.grantObjectSelect}
                      filterOption={false}
                      loading={objectLoading}
                      notFoundContent={objectLoading
                        ? <Spin size="small" />
                        : t("systemAdmin.objectGrants.pickerNoResults")}
                      onChange={(id) => {
                        setDraftId(id);
                        setObjectKeyword("");
                      }}
                      onPopupScroll={(event) => {
                        const target = event.currentTarget;
                        if (
                          target.scrollTop + target.clientHeight >= target.scrollHeight - 24 &&
                          !objectLoading &&
                          objects.length < objectTotal
                        ) {
                          void loadObjectPage(objectPage + 1, true);
                        }
                      }}
                      onSearch={setObjectKeyword}
                      options={objectOptions}
                      popupRender={(menu) => (
                        <>
                          {menu}
                          <div className={styles.objectPickerStatus}>
                            {objectLoading
                              ? t("systemAdmin.objectGrants.pickerLoading")
                              : t("systemAdmin.objectGrants.pickerCount", {
                                  loaded: objects.length,
                                  total: objectTotal,
                                })}
                          </div>
                        </>
                      )}
                      placeholder={t("systemAdmin.objectGrants.pickerObjectPlaceholder")}
                      searchValue={objectKeyword}
                      showSearch
                      style={{ flex: 1, minWidth: 140 }}
                      value={draftId || undefined}
                    />
                  ) : null}
                  {!supportsSpecificResource ? (
                    <span className={styles.grantScopeHint}>
                      {t("systemAdmin.grant.specificResourcesUnavailable")}
                    </span>
                  ) : null}
                  {!effectiveWholeType && !draftId ? (
                    <span className={styles.grantScopeHint}>
                      {t("systemAdmin.grant.pickResourceFirst")}
                    </span>
                  ) : null}
                  {objectLoadError ? (
                    <Alert
                      action={
                        <AppButton
                          onClick={() => {
                            if (failedObjectRequest) {
                              void loadObjectPage(
                                failedObjectRequest.page,
                                failedObjectRequest.append,
                              );
                            }
                          }}
                          size="small"
                          type="link"
                        >
                          {t("common.retry")}
                        </AppButton>
                      }
                      className={styles.grantLoadError}
                      message={objectLoadError}
                      showIcon
                      type="error"
                    />
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {canConfigureOperations ? (
            <div className={styles.roleGrantOperationPicker}>
            <div className={styles.authzGrantFieldHead}>
              <span className={styles.authzGrantFieldLabel}>
                {t("systemAdmin.objectGrants.grantOperationsLabel")}
              </span>
              <div className={styles.authzGrantFieldActions}>
                <span>
                  {t("systemAdmin.objectGrants.selectedOperationCount", {
                    selected: draftOps.length,
                    total: ops.length,
                  })}
                </span>
                <AppButton
                  disabled={!ops.length || draftOps.length === ops.length}
                  onClick={() => setDraftOps(ops.map((operation) => operation.key))}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.selectAllOperations")}
                </AppButton>
                <AppButton
                  disabled={!draftOps.length}
                  onClick={() => setDraftOps([])}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.clearOperations")}
                </AppButton>
              </div>
            </div>
            <div
              aria-label={t("systemAdmin.objectGrants.grantOperationsLabel")}
              className={styles.authzCreateOperationGrid}
              role="group"
            >
              {ops.map((operation) => {
                const prerequisiteLocked = draftRequirements.some(
                  ({ requirement }) => requirement.key === operation.key,
                );
                const selected = draftOps.includes(operation.key);
                return (
                  <button
                    aria-pressed={selected}
                    className={[
                      styles.chipOpt,
                      styles.authzCreateOperation,
                      selected ? styles.chipOptSelected : "",
                      prerequisiteLocked ? styles.chipRequired : "",
                    ].join(" ")}
                    key={operation.key}
                    onClick={() => toggleDraftOperation(operation.key)}
                    title={`${operation.label} (${operation.key})`}
                    type="button"
                  >
                    <span className={styles.chipLabelRow}>
                      <span className={styles.chipCode}>{operation.label}</span>
                      {prerequisiteLocked ? (
                        <Tooltip title={t("systemAdmin.objectGrants.requiredBySelection")}>
                          <LockOutlined
                            aria-label={t("systemAdmin.objectGrants.requiredBySelection")}
                            className={styles.chipLock}
                          />
                        </Tooltip>
                      ) : null}
                    </span>
                    <span className={styles.chipType}>{operation.key}</span>
                  </button>
                );
              })}
            </div>
            {draftRequirements.length ? (
              <div className={styles.requirementNotice}>
                <InfoCircleOutlined />
                <div>
                  {draftRequirements.map(({ dependents, requirement }) => (
                    <div key={requirement.key}>
                      {t("systemAdmin.objectGrants.requiredSelectionNotice", {
                        dependents: dependents.map((item) => item.label).join("、"),
                        requirement: requirement.label,
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.authzGrantFooter}>
              <span>{t("systemAdmin.grant.allowOnlyHint")}</span>
              <AppButton icon={<PlusOutlined />} onClick={addGrant} type="primary">
                {t("systemAdmin.grant.add")}
              </AppButton>
            </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {!disabled && resourceTypeDescription(draftType) ? (
        <p>{resourceTypeDescription(draftType)}</p>
      ) : null}
    </div>
  );
}
