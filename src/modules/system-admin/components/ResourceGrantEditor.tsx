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
import { AuthorizationRegistryFailureAlert } from "@/modules/system-admin/components/AuthorizationRegistryFailureAlert";
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
  operationLabel,
  isRoleGrantResourceType,
  resourceTypeDescription,
  resourceTypeLabel,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";
import { availableOperationsForGrant } from "@/modules/system-admin/utils/resource-grant-operations";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ResourceGrantEditorProps = {
  disabled?: boolean;
  /** Locked to one resource, such as a data-connection grant; only operations can be selected. */
  lockedResource?: ResourceRef;
  onChange: (next: ResourceGrant[]) => void;
  value: ResourceGrant[];
};

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

type GrantOperation = { description?: string; key: string; label: string; requires: string[] };

const ROLE_RESOURCE_TYPE_GROUPS = [
  { key: "data", types: ["catalog"] },
  {
    key: "knowledge",
    types: [
      "knowledge_network",
      "concept_group",
      "object_type",
      "relation_type",
      "action_type",
      "metric",
    ],
  },
  { key: "model", types: ["small_model", "large_model"] },
  { key: "execution", types: ["function", "tool_box", "mcp", "skill"] },
  {
    key: "system",
    types: ["admin-user", "admin-dept", "admin-role", "admin-authz", "admin-audit", "safe_admin"],
  },
] as const;

function normalizeOperations(selected: string[], definitions: GrantOperation[]): string[] {
  const requested = new Set(selected);
  for (const operation of definitions) {
    if (requested.has(operation.key)) {
      operation.requires.forEach((requirement) => requested.add(requirement));
    }
  }
  return definitions
    .filter((operation) => requested.has(operation.key))
    .map((operation) => operation.key);
}

export function ResourceGrantEditor({
  disabled,
  lockedResource,
  onChange,
  value,
}: ResourceGrantEditorProps) {
  const { t } = useTranslation();
  const {
    catalog,
    catalogError,
    catalogLoading,
    operationsForType,
    resourceTypeOptions,
    retryAuthorizationRegistry,
  } = useAuthorizationRegistry();
  const [draftType, setDraftType] = useState<string>(lockedResource?.type ?? "");
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

  const registryReady = Boolean(catalog?.resourceTypes.length) && !catalogLoading && !catalogError;
  const canEdit = !disabled && registryReady;
  const availableRoleTypeOptions = useMemo(
    () => resourceTypeOptions().filter((option) => isRoleGrantResourceType(option.value)),
    [resourceTypeOptions],
  );
  const roleResourceTypeOptions = useMemo(() => {
    const available = new Map(availableRoleTypeOptions.map((option) => [option.value, option]));
    const grouped = ROLE_RESOURCE_TYPE_GROUPS.map((group) => ({
      label: t(`systemAdmin.objectGrants.objectTypeGroups.${group.key}`),
      options: group.types.flatMap((type) => {
        const option = available.get(type);
        return option ? [option] : [];
      }),
    })).filter((group) => group.options.length);
    return grouped;
  }, [availableRoleTypeOptions, t]);
  const roleTypeValues = useMemo(
    () => roleResourceTypeOptions.flatMap((group) => group.options.map((option) => option.value)),
    [roleResourceTypeOptions],
  );
  const supportsSpecificResource = isAuthzObjectPickerType(draftType);
  const effectiveWholeType = !supportsSpecificResource || wholeType;
  const ops = useMemo(
    () =>
      operationsForType(draftType).filter(
        (operation) => effectiveWholeType || !HIDDEN_INSTANCE_OPS.has(operation.key),
      ),
    [draftType, effectiveWholeType, operationsForType],
  );
  const draftContractReady = ops.length > 0;
  const canConfigureOperations = Boolean(
    draftType && draftContractReady && (effectiveWholeType || draftId),
  );

  useEffect(() => {
    if (lockedResource || !registryReady) return;
    if (!roleTypeValues.includes(draftType)) {
      setDraftType("");
      setDraftOps([]);
    }
  }, [draftType, lockedResource, registryReady, roleTypeValues]);

  const loadObjectPage = useCallback(
    async (page: number, append: boolean) => {
      if (!supportsSpecificResource || effectiveWholeType) return;
      const request = ++objectRequestRef.current;
      setObjectLoading(true);
      setObjectLoadError(null);
      setFailedObjectRequest(null);
      try {
        const result = await listAuthorizableObjectsPage(draftType, {
          keyword: debouncedObjectKeyword,
          page,
        });
        if (request !== objectRequestRef.current) return;
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
        if (request === objectRequestRef.current) setObjectLoading(false);
      }
    },
    [debouncedObjectKeyword, draftType, effectiveWholeType, supportsSpecificResource],
  );

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
    void resolveResourceGrantNames(value).then(
      (names) => {
        if (active) setResourceNames(names);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [value]);

  const objectOptions = useMemo(() => {
    const candidates =
      draftId && !objects.some((item) => item.id === draftId)
        ? [{ id: draftId, name: draftId, type: draftType }, ...objects]
        : objects;
    return candidates.map((item) => ({
      label: item.sub ? `${item.name} (${item.sub})` : item.name,
      value: item.id,
    }));
  }, [draftId, draftType, objects]);

  const draftRequirements = useMemo(
    () =>
      ops.flatMap((requirement) => {
        const dependents = ops.filter(
          (operation) =>
            draftOps.includes(operation.key) && operation.requires.includes(requirement.key),
        );
        return dependents.length ? [{ dependents, requirement }] : [];
      }),
    [draftOps, ops],
  );

  const toggleDraftOperation = (operationKey: string) => {
    setDraftOps((previous) => {
      if (previous.includes(operationKey)) {
        const requiredBySelected = ops.some(
          (operation) =>
            previous.includes(operation.key) && operation.requires.includes(operationKey),
        );
        return requiredBySelected ? previous : previous.filter((key) => key !== operationKey);
      }
      return normalizeOperations([...previous, operationKey], ops);
    });
  };

  const canEditGrant = (grant: ResourceGrant) => {
    if (!canEdit) return false;
    const definitions = operationsForType(grant.resource.type);
    const definedOperations = new Set(definitions.map((operation) => operation.key));
    return (
      definitions.length > 0 &&
      grant.operations.every(
        (operation) => operation === WILDCARD || definedOperations.has(operation),
      )
    );
  };

  const resolvedId = lockedResource
    ? lockedResource.id
    : effectiveWholeType
      ? WILDCARD
      : draftId.trim();

  const addGrant = () => {
    if (
      !canEdit ||
      !draftContractReady ||
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
            ? { ...grant, operations: normalizeOperations([...grant.operations, ...draftOps], ops) }
            : grant,
        )
      : [...value, { resource, operations: [...draftOps] }];
    onChange(next);
    setDraftOps([]);
    if (!lockedResource && !effectiveWholeType) {
      setDraftId("");
    }
  };

  const removeGrant = (grant: ResourceGrant) => {
    if (!canEditGrant(grant)) return;
    onChange(value.filter((item) => item !== grant));
  };

  const addOperation = (grant: ResourceGrant, operation: string) => {
    if (!canEditGrant(grant)) return;
    const definitions = operationsForType(grant.resource.type);
    onChange(
      value.map((item) =>
        sameResource(item.resource, grant.resource)
          ? {
              ...item,
              operations: normalizeOperations([...item.operations, operation], definitions),
            }
          : item,
      ),
    );
    setAddingGrantKey(null);
  };

  const removeOperation = (grant: ResourceGrant, operation: string) => {
    if (!canEditGrant(grant)) return;
    const definitions = operationsForType(grant.resource.type);
    const requiredBySelectedOperation = definitions.some(
      (definition) =>
        grant.operations.includes(definition.key) && definition.requires.includes(operation),
    );
    if (requiredBySelectedOperation) return;

    const remaining = grant.operations.filter((item) => item !== operation);
    onChange(
      remaining.length
        ? value.map((item) =>
            sameResource(item.resource, grant.resource) ? { ...item, operations: remaining } : item,
          )
        : value.filter((item) => !sameResource(item.resource, grant.resource)),
    );
  };

  return (
    <div className={styles.grantEditor}>
      {value.length ? (
        <div className={styles.grantList}>
          {value.map((grant, index) => {
            const grantCanEdit = canEditGrant(grant);
            const operationDefinitions = new Map(
              operationsForType(grant.resource.type).map((operation) => [operation.key, operation]),
            );
            const requiredOperations = new Set(
              [...operationDefinitions.values()]
                .filter((operation) => grant.operations.includes(operation.key))
                .flatMap((operation) => operation.requires),
            );
            return (
              <div
                className={styles.grantItem}
                key={`${grant.resource.type}:${grant.resource.id}:${index}`}
              >
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
                      : (resourceNames.get(
                          resourceGrantNameKey(grant.resource.type, grant.resource.id),
                        )?.name ?? grant.resource.id)}
                  </span>
                </div>
                <div className={styles.chipRow}>
                  {grant.operations.map((op) => {
                    const operation = operationDefinitions.get(op);
                    const title = [
                      operation?.description,
                      requiredOperations.has(op)
                        ? t("systemAdmin.objectGrants.requiredBySelection")
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <Tooltip key={op} title={title || undefined}>
                        <Tag
                          closable={grantCanEdit && !requiredOperations.has(op)}
                          className={styles.permChip}
                          onClose={(event) => {
                            event.preventDefault();
                            if (grantCanEdit) removeOperation(grant, op);
                          }}
                        >
                          {op === "*"
                            ? t("systemAdmin.grant.allOps")
                            : operationLabel(grant.resource.type, op)}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                  {grantCanEdit && !grant.operations.includes("*") ? (
                    addingGrantKey === `${grant.resource.type}:${grant.resource.id}:${index}` ? (
                      <Select
                        autoFocus
                        onBlur={() => setAddingGrantKey(null)}
                        onSelect={(operation: string) => addOperation(grant, operation)}
                        options={availableOperationsForGrant(
                          grant,
                          operationsForType(grant.resource.type),
                        ).map((operation) => ({
                          label: (
                            <Tooltip title={operation.description}>
                              <span>{operation.label}</span>
                            </Tooltip>
                          ),
                          value: operation.key,
                        }))}
                        placeholder={t("systemAdmin.grant.operationsPlaceholder")}
                        size="small"
                        style={{ minWidth: 150 }}
                      />
                    ) : (
                      <Tooltip title={t("systemAdmin.grant.addOperation")}>
                        <AppButton
                          icon={<PlusOutlined />}
                          onClick={() =>
                            setAddingGrantKey(
                              `${grant.resource.type}:${grant.resource.id}:${index}`,
                            )
                          }
                          size="small"
                          type="link"
                        >
                          {t("systemAdmin.grant.addOperation")}
                        </AppButton>
                      </Tooltip>
                    )
                  ) : null}
                </div>
                {grantCanEdit ? (
                  <AppButton
                    className={[styles.actionLink, styles.actionDanger].join(" ")}
                    icon={<DeleteOutlined />}
                    onClick={() => removeGrant(grant)}
                    size="small"
                    type="link"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("systemAdmin.grant.empty")}
          style={{ margin: "8px 0" }}
        />
      )}

      {!disabled ? (
        <>
          <AuthorizationRegistryFailureAlert
            error={catalogError}
            onRetry={retryAuthorizationRegistry}
          />
          <div className={styles.grantAddRow}>
            {!lockedResource ? (
              <>
                <Select
                  allowClear
                  aria-label={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                  disabled={!canEdit}
                  onChange={(type: string | undefined) => {
                    setDraftType(type ?? "");
                    setDraftId("");
                    setWholeType(true);
                    setObjectKeyword("");
                    setDraftOps([]);
                  }}
                  options={roleResourceTypeOptions}
                  placeholder={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                  style={{ width: "100%" }}
                  value={draftType || undefined}
                />
                {draftType ? (
                  <>
                    <div className={styles.grantScope}>
                      <span className={styles.grantScopeLabel}>
                        {t("systemAdmin.grant.scopeLabel")}
                      </span>
                      <Radio.Group
                        aria-label={t("systemAdmin.grant.scopeLabel")}
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                        filterOption={false}
                        loading={objectLoading}
                        notFoundContent={
                          objectLoading ? (
                            <Spin size="small" />
                          ) : (
                            t("systemAdmin.objectGrants.pickerNoResults")
                          )
                        }
                        onChange={(id: string) => {
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
                        style={{ width: "100%" }}
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
                              if (failedObjectRequest)
                                void loadObjectPage(
                                  failedObjectRequest.page,
                                  failedObjectRequest.append,
                                );
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
                      disabled={!canEdit || !ops.length || draftOps.length === ops.length}
                      onClick={() => setDraftOps(ops.map((operation) => operation.key))}
                      size="small"
                      type="link"
                    >
                      {t("systemAdmin.objectGrants.selectAllOperations")}
                    </AppButton>
                    <AppButton
                      disabled={!canEdit || !draftOps.length}
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
                        disabled={!canEdit}
                        key={operation.key}
                        onClick={() => toggleDraftOperation(operation.key)}
                        title={operation.description ?? `${operation.label} (${operation.key})`}
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
                  <AppButton
                    disabled={!canEdit || !draftOps.length}
                    icon={<PlusOutlined />}
                    onClick={addGrant}
                    type="primary"
                  >
                    {t("systemAdmin.grant.add")}
                  </AppButton>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {!disabled && resourceTypeDescription(draftType) ? (
        <p>{resourceTypeDescription(draftType)}</p>
      ) : null}
    </div>
  );
}
