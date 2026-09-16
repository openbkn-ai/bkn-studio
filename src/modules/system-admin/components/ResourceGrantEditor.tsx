/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Checkbox, Empty, Input, Select, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { AuthorizationRegistryFailureAlert } from "@/modules/system-admin/components/AuthorizationRegistryFailureAlert";
import type { ResourceGrant, ResourceRef } from "@/modules/system-admin/types/admin";
import {
  operationLabel,
  isRoleGrantResourceType,
  resourceTypeLabel,
  resourceTypeDescription,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ResourceGrantEditorProps = {
  disabled?: boolean;
  /** Role grants are type-wide; concrete object grants are managed elsewhere. */
  typeWideOnly?: boolean;
  /** Locked to one resource, such as a data-connection grant; only operations can be selected. */
  lockedResource?: ResourceRef;
  onChange: (next: ResourceGrant[]) => void;
  value: ResourceGrant[];
};

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

type GrantOperation = { key: string; requires: string[] };

function normalizeOperations(selected: string[], definitions: GrantOperation[]): string[] {
  const requested = new Set(selected);
  for (const operation of definitions) {
    if (requested.has(operation.key)) {
      operation.requires.forEach((requirement) => requested.add(requirement));
    }
  }
  return definitions.filter((operation) => requested.has(operation.key)).map((operation) => operation.key);
}

export function ResourceGrantEditor({
  disabled,
  lockedResource,
  typeWideOnly = false,
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
  const [draftType, setDraftType] = useState<string>(
    lockedResource?.type ?? "",
  );
  const [draftId, setDraftId] = useState<string>(lockedResource?.id ?? "");
  const [wholeType, setWholeType] = useState<boolean>(!lockedResource);
  const [draftOps, setDraftOps] = useState<string[]>([]);
  const [addingGrantKey, setAddingGrantKey] = useState<string | null>(null);

  const roleResourceTypeOptions = useMemo(
    () => resourceTypeOptions().filter((option) => isRoleGrantResourceType(option.value)),
    [resourceTypeOptions],
  );
  const ops = useMemo(() => operationsForType(draftType), [draftType, operationsForType]);
  const registryReady = Boolean(catalog?.resourceTypes.length) && !catalogLoading && !catalogError;
  const canEdit = !disabled && registryReady;
  const draftContractReady = ops.length > 0;

  useEffect(() => {
    if (lockedResource || !registryReady) return;
    if (!roleResourceTypeOptions.some((option) => option.value === draftType)) {
      setDraftType(roleResourceTypeOptions[0]?.value ?? "");
      setDraftOps([]);
    }
  }, [draftType, lockedResource, registryReady, roleResourceTypeOptions]);

  const canEditGrant = (grant: ResourceGrant) => {
    if (!canEdit) return false;
    const definitions = operationsForType(grant.resource.type);
    const definedOperations = new Set(definitions.map((operation) => operation.key));
    return definitions.length > 0 && grant.operations.every(
      (operation) => operation === WILDCARD || definedOperations.has(operation),
    );
  };

  const resolvedId = lockedResource ? lockedResource.id : wholeType ? WILDCARD : draftId.trim();

  const addGrant = () => {
    if (
      !canEdit ||
      !draftContractReady ||
      !draftOps.length ||
      (!lockedResource && !wholeType && (typeWideOnly || !draftId.trim()))
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
    if (!lockedResource && !wholeType) {
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
    onChange(value.map((item) =>
      sameResource(item.resource, grant.resource)
        ? { ...item, operations: normalizeOperations([...item.operations, operation], definitions) }
        : item,
    ));
    setAddingGrantKey(null);
  };

  const removeOperation = (grant: ResourceGrant, operation: string) => {
    if (!canEditGrant(grant)) return;
    const definitions = operationsForType(grant.resource.type);
    const removed = new Set([operation]);
    for (const definition of definitions) {
      if (definition.requires.some((requirement) => removed.has(requirement))) {
        removed.add(definition.key);
      }
    }
    const remaining = grant.operations.filter((item) => !removed.has(item));
    onChange(remaining.length
      ? value.map((item) => sameResource(item.resource, grant.resource)
        ? { ...item, operations: remaining }
        : item)
      : value.filter((item) => !sameResource(item.resource, grant.resource)));
  };

  return (
    <div className={styles.grantEditor}>
      {value.length ? (
        <div className={styles.grantList}>
          {value.map((grant, index) => {
            const grantCanEdit = canEditGrant(grant);
            return (
              <div className={styles.grantItem} key={`${grant.resource.type}:${grant.resource.id}:${index}`}>
                <div className={styles.grantMeta}>
                  <Tooltip title={resourceTypeDescription(grant.resource.type)}>
                    <Tag className={styles.roleTag}>{resourceTypeLabel(grant.resource.type)}</Tag>
                  </Tooltip>
                  <span className={styles.slugChip}>
                    {grant.resource.id === WILDCARD ? t("systemAdmin.grant.wholeType") : grant.resource.id}
                  </span>
                </div>
                <div className={styles.chipRow}>
                  {grant.operations.map((op) => (
                    <Tag
                      closable={grantCanEdit}
                      className={styles.permChip}
                      key={op}
                      onClose={(event) => {
                        event.preventDefault();
                        if (grantCanEdit) removeOperation(grant, op);
                      }}
                    >
                      {grant.resource.id === WILDCARD || op === "*"
                        ? op === "*"
                          ? t("systemAdmin.grant.allOps")
                          : operationLabel(grant.resource.type, op)
                        : operationLabel(grant.resource.type, op)
                      }
                    </Tag>
                  ))}
                  {grantCanEdit && !grant.operations.includes("*") ? (
                    addingGrantKey === `${grant.resource.type}:${grant.resource.id}:${index}` ? (
                      <Select
                        autoFocus
                        onBlur={() => setAddingGrantKey(null)}
                        onSelect={(operation: string) => addOperation(grant, operation)}
                        options={operationsForType(grant.resource.type)
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
          <AuthorizationRegistryFailureAlert error={catalogError} onRetry={retryAuthorizationRegistry} />
          <div className={styles.grantAddRow}>
            {!lockedResource ? (
              <>
                <Select
                  disabled={!canEdit}
                  onChange={(type) => {
                    setDraftType(type);
                    setDraftOps([]);
                  }}
                  options={roleResourceTypeOptions}
                  style={{ minWidth: 160 }}
                  value={draftType}
                />
                {!typeWideOnly ? (
                  <Input
                    disabled={!canEdit || wholeType}
                    onChange={(event) => setDraftId(event.target.value)}
                    placeholder={t("systemAdmin.grant.resourceIdPlaceholder")}
                    style={{ flex: 1, minWidth: 140 }}
                    value={wholeType ? "" : draftId}
                  />
                ) : null}
                <Checkbox
                  checked={typeWideOnly || wholeType}
                  disabled={!canEdit || typeWideOnly}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setWholeType(checked);
                    if (checked || typeWideOnly) {
                      setDraftId("");
                    }
                  }}
                >
                  {t("systemAdmin.grant.wholeType")}
                </Checkbox>
              </>
            ) : null}
            <Select
              disabled={!canEdit || !draftContractReady}
              mode="multiple"
              onChange={(selected) => setDraftOps(normalizeOperations(selected, ops))}
              options={ops.map((op) => ({ label: op.label, value: op.key }))}
              placeholder={t("systemAdmin.grant.operationsPlaceholder")}
              style={{ flex: 1, minWidth: 200 }}
              value={draftOps}
            />
            <AppButton disabled={!canEdit || !draftContractReady} icon={<PlusOutlined />} onClick={addGrant} type="primary">
              {t("systemAdmin.grant.add")}
            </AppButton>
          </div>
        </>
      ) : null}
      {!disabled && resourceTypeDescription(draftType) ? (
        <p>{resourceTypeDescription(draftType)}</p>
      ) : null}
    </div>
  );
}
