/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Drawer,
  Empty,
  Input,
  Segmented,
  Select,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState, type Key } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectTypeDataAttributeFormDrawer } from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeFormDrawer";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  getKnowledgeNetworkObjectTypeDetail,
  updateKnowledgeNetworkObjectType,
} from "@/modules/knowledge-network/services/object-type.service";
import {
  listPropertyGrantSnapshot,
  patchPropertyGrants,
} from "@/modules/knowledge-network/services/property-authorization.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDetail,
  PropertyAccessLevel,
  PropertyAccessSelection,
  PropertyGrantSnapshot,
  PropertyGrantSubject,
  PropertyGrantSubjectType,
} from "@/modules/knowledge-network/types/knowledge-network";
import { isMaskRuleValid } from "@/modules/knowledge-network/utils/mask-rule";
import {
  applyPropertySelectionBatch,
  basePropertyAccessLevel,
  propertyAccessRowState,
  summarizePropertyGrantChanges,
} from "@/modules/knowledge-network/utils/property-authorization";
import {
  listRoles,
  listUsersPage,
} from "@/modules/system-admin/services/admin.service";
import { authzPoints } from "@/modules/system-admin/permissions";
import {
  listObjectGrantsForObject,
  revokeObjectGrantForObject,
  upsertObjectGrantForObject,
} from "@/modules/system-admin/services/authz.service";
import type { AdminRole, AdminUser } from "@/modules/system-admin/types/admin";
import type { GrantRecord, ObjectGrant } from "@/modules/system-admin/types/authz";
import { HIDDEN_INSTANCE_OPS } from "@/modules/system-admin/utils/authz-catalog";
import {
  isDelegateProtectedGrant,
  isSelfAuthorizeLockout,
} from "@/modules/system-admin/utils/object-grant-guards";
import { operationsForType } from "@/modules/system-admin/utils/resource-catalog";

import styles from "./ObjectTypeAuthorizationScene.module.css";

type AuthorizationTab = "base" | "property";
type PropertyFilter = "all" | "explicit" | "inherit" | "invalid";

type PropertyRow = ObjectTypeDataProperty & {
  effective: PropertyAccessLevel;
  explicit: PropertyAccessSelection;
  maskState: "configured" | "missing" | "invalid" | "unsupported";
  source: string;
};

type GrantSourceRow = GrantRecord & {
  grantIds: string[];
};

const LEVELS: PropertyAccessSelection[] = ["inherit", "none", "schema", "masked", "full"];
const MAX_PROPERTY_GRANT_CHANGES = 200;
const PROPERTY_GRANT_AUDIT_REASON = "updated-from-object-type-authorization";
const PROPERTY_PAGE_SIZE = 50;

function mergeUsers(primary: AdminUser[], secondary: AdminUser[]) {
  return [...new Map([...primary, ...secondary].map((user) => [user.id, user])).values()];
}

function userLabel(user: AdminUser) {
  return user.name ? `${user.name}（${user.account}）` : user.account || user.id;
}

function collapseGrantSources(records: GrantRecord[]): GrantSourceRow[] {
  const grouped = new Map<string, GrantSourceRow>();
  for (const record of records) {
    const key = [
      record.accessorId,
      record.active,
      record.authoritySource,
      record.effect,
      record.inherited,
      record.operation,
      record.policySource,
    ].join("\u0000");
    const current = grouped.get(key);
    if (current) {
      current.grantIds.push(record.grantId);
      continue;
    }
    grouped.set(key, { ...record, grantIds: [record.grantId] });
  }
  return [...grouped.values()];
}

export function ObjectTypeAuthorizationScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal, runtimeConfig } = useAppServices();
  const { networkId = "", objectTypeId = "" } = useParams<{
    networkId: string;
    objectTypeId: string;
  }>();
  const propertyCapability = useCapability(CAPABILITIES.PERM_OBJECT_LEVEL);
  const propertyAvailable = propertyCapability === "available";
  const networkAuthorized = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const objectTypeRef = `${networkId}/${objectTypeId}`;
  const detailPath = `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`;

  const [detail, setDetail] = useState<ObjectTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseBusy, setBaseBusy] = useState(false);
  const [objectGrants, setObjectGrants] = useState<ObjectGrant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [candidateUserId, setCandidateUserId] = useState<string>();
  const [candidateOperations, setCandidateOperations] = useState<string[]>([]);
  const [sourceAccessorId, setSourceAccessorId] = useState<string>();
  const [activeTab, setActiveTab] = useState<AuthorizationTab>("base");
  const [subjectType, setSubjectType] = useState<PropertyGrantSubjectType>("user");
  const [subjectId, setSubjectId] = useState<string>();
  const [subjectKeyword, setSubjectKeyword] = useState("");
  const [propertyKeyword, setPropertyKeyword] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilter>("all");
  const [selectedProperties, setSelectedProperties] = useState<Key[]>([]);
  const [grantSnapshot, setGrantSnapshot] = useState<PropertyGrantSnapshot | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [draft, setDraft] = useState<Map<string, PropertyAccessSelection>>(new Map());
  const [editingMaskProperty, setEditingMaskProperty] = useState<ObjectTypeDataProperty>();

  const loadBase = useCallback(async () => {
    setBaseLoading(true);
    try {
      const [grantResult, userResult, roleResult] = await Promise.all([
        listObjectGrantsForObject("object_type", objectTypeRef),
        listUsersPage({ limit: 500 }, { skipErrorToast: true }).catch(() => null),
        listRoles({ withMembers: true }).catch(() => null),
      ]);
      setObjectGrants(grantResult.grants);
      setUsers(mergeUsers(userResult?.users ?? [], grantResult.accounts));
      setRoles(roleResult ?? []);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBaseLoading(false);
    }
  }, [message, objectTypeRef]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          void message.error(extractRequestErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    void loadBase();
    return () => {
      cancelled = true;
    };
  }, [loadBase, message, networkId, objectTypeId]);

  const selectedSubject = useMemo<PropertyGrantSubject | null>(
    () => (subjectId ? { id: subjectId, type: subjectType } : null),
    [subjectId, subjectType],
  );

  useEffect(() => {
    if (!selectedSubject || !propertyAvailable) {
      setGrantSnapshot(null);
      setPropertyLoading(false);
      return;
    }

    let cancelled = false;
    setPropertyLoading(true);
    void listPropertyGrantSnapshot(selectedSubject, objectTypeRef)
      .then((snapshot) => {
        if (!cancelled) {
          setGrantSnapshot(snapshot);
          setDraft(new Map());
          setSelectedProperties([]);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setGrantSnapshot(null);
          void message.error(extractRequestErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPropertyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [message, objectTypeRef, propertyAvailable, selectedSubject]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (draft.size) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft.size]);

  const confirmDiscard = useCallback(
    (next: () => void) => {
      if (!draft.size) {
        next();
        return;
      }
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("knowledgeNetwork.propertyAuthorizationDiscardDescription", {
          count: draft.size,
        }),
        okButtonProps: { danger: true },
        okText: t("knowledgeNetwork.propertyAuthorizationDiscard"),
        onOk: next,
        title: t("knowledgeNetwork.propertyAuthorizationDiscardTitle"),
      });
    },
    [draft.size, modal, t],
  );

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const currentSubjectRecord = subjectType === "user" ? userMap.get(subjectId ?? "") : roleMap.get(subjectId ?? "");

  const subjectOperations = useMemo(() => {
    if (!subjectId || subjectType === "role") {
      return [];
    }
    return (objectGrants.find((grant) => grant.accessorId === subjectId)?.effectiveDecisions ?? [])
      .filter((decision) => decision.decision === "allow")
      .map((decision) => decision.operation);
  }, [objectGrants, subjectId, subjectType]);
  const baseLevel = basePropertyAccessLevel(subjectOperations);

  const entryMap = useMemo(
    () => new Map((grantSnapshot?.entries ?? []).map((entry) => [entry.propertyName, entry])),
    [grantSnapshot],
  );
  const decisionMap = useMemo(
    () => new Map((grantSnapshot?.decisions ?? []).map((entry) => [entry.name, entry])),
    [grantSnapshot],
  );

  const propertyRows = useMemo<PropertyRow[]>(() => {
    const keyword = propertyKeyword.trim().toLowerCase();
    return (detail?.dataProperties ?? [])
      .map((property) => ({
        ...property,
        ...propertyAccessRowState(property, baseLevel, entryMap, decisionMap, draft),
      }))
      .filter((row) => {
        if (keyword && !`${row.name} ${row.displayName}`.toLowerCase().includes(keyword)) {
          return false;
        }
        if (propertyFilter === "explicit" && row.explicit === "inherit") {
          return false;
        }
        if (propertyFilter === "inherit" && row.explicit !== "inherit") {
          return false;
        }
        if (
          propertyFilter === "invalid" &&
          row.maskState !== "invalid" &&
          !(row.explicit === "masked" && row.maskState !== "configured")
        ) {
          return false;
        }
        return true;
      });
  }, [baseLevel, decisionMap, detail?.dataProperties, draft, entryMap, propertyFilter, propertyKeyword]);

  const setPropertySelection = (name: string, next: PropertyAccessSelection) => {
    setDraft((current) => {
      const result = new Map(current);
      const original = entryMap.get(name)?.level ?? "inherit";
      if (next === original) {
        result.delete(name);
      } else {
        result.set(name, next);
      }
      return result;
    });
  };

  const applyBatch = (next: PropertyAccessSelection) => {
    setDraft((current) =>
      applyPropertySelectionBatch(
        (detail?.dataProperties ?? []).map((property) => property.name),
        selectedProperties.map(String),
        next,
        entryMap,
        current,
      ),
    );
  };

  const invalidMaskedProperties = useMemo(
    () =>
      [...draft]
        .filter(([, level]) => level === "masked")
        .map(([name]) => detail?.dataProperties.find((property) => property.name === name))
        .filter(
          (property): property is ObjectTypeDataProperty =>
            property !== undefined && !isMaskRuleValid(property.type, property.maskRule),
        ),
    [detail?.dataProperties, draft],
  );
  const tooManyChanges = draft.size > MAX_PROPERTY_GRANT_CHANGES;

  const savePropertyChanges = () => {
    if (
      !selectedSubject ||
      !draft.size ||
      invalidMaskedProperties.length ||
      tooManyChanges
    ) {
      return;
    }
    const summary = summarizePropertyGrantChanges(baseLevel, entryMap, draft);
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: (
        <div className={styles.confirmContent}>
          <p>
            {t("knowledgeNetwork.propertyAuthorizationConfirmSummary", summary)}
          </p>
          {summary.full ? (
            <Alert
              message={t("knowledgeNetwork.propertyAuthorizationFullRisk", {
                count: summary.full,
              })}
              showIcon
              type="warning"
            />
          ) : null}
          {subjectType === "role" ? (
            <Alert
              message={t("knowledgeNetwork.propertyAuthorizationRoleImpact", {
                count: (currentSubjectRecord as AdminRole | undefined)?.accessorIds.length ?? 0,
              })}
              showIcon
              type="info"
            />
          ) : null}
        </div>
      ),
      okText: t("common.confirm"),
      onOk: async () => {
        setPropertySaving(true);
        try {
          const result = await patchPropertyGrants({
            accessor: selectedSubject,
            changes: [...draft].map(([propertyName, level]) => ({ level, propertyName })),
            objectTypeRef,
            reason: PROPERTY_GRANT_AUDIT_REASON,
          });
          setGrantSnapshot(result);
          setDraft(new Map());
          setSelectedProperties([]);
          void message.success(
            t("knowledgeNetwork.propertyAuthorizationSaveSuccess", { count: result.changed }),
          );
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
          throw error;
        } finally {
          setPropertySaving(false);
        }
      },
      title: t("knowledgeNetwork.propertyAuthorizationConfirmTitle"),
      width: 520,
    });
  };

  const saveMaskRule = async (nextProperty: ObjectTypeDataProperty) => {
    if (!detail) {
      return;
    }
    const dataProperties = detail.dataProperties.map((property) =>
      property.name === nextProperty.name ? nextProperty : property,
    );
    await updateKnowledgeNetworkObjectType(networkId, objectTypeId, {
      color: detail.color,
      conceptGroupIds: detail.conceptGroupIds,
      dataProperties,
      dataSource: detail.dataSource,
      description: detail.description,
      icon: detail.icon,
      id: detail.id,
      logicProperties: detail.logicProperties,
      name: detail.name,
      tags: detail.tags,
    });
    setDetail((current) => current ? { ...current, dataProperties } : current);
    void message.success(t("common.success"));
  };

  const levelTag = (level: PropertyAccessLevel | PropertyAccessSelection) => (
    <Tag className={`${styles.levelTag} ${styles[`level_${level}`]}`}>
      {t(`knowledgeNetwork.propertyAuthorizationLevel.${level}`)}
    </Tag>
  );

  const propertyColumns: ColumnsType<PropertyRow> = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "property",
      render: (_name, row) => (
        <div className={styles.propertyIdentity}>
          <strong>{row.displayName || row.name}</strong>
          <span>{row.name}</span>
        </div>
      ),
      title: t("knowledgeNetwork.propertyAuthorizationColumnProperty"),
      width: 185,
    },
    {
      dataIndex: "type",
      key: "type",
      title: t("knowledgeNetwork.propertyAuthorizationColumnType"),
      width: 85,
    },
    {
      key: "base",
      render: () => levelTag(baseLevel),
      title: t("knowledgeNetwork.propertyAuthorizationBasePermission"),
      width: 105,
    },
    {
      dataIndex: "explicit",
      key: "explicit",
      render: (value: PropertyAccessSelection, row) => (
        <Select
          className={styles.levelSelect}
          onChange={(next) => setPropertySelection(row.name, next)}
          options={LEVELS.map((level) => ({
            label: t(`knowledgeNetwork.propertyAuthorizationLevel.${level}`),
            value: level,
          }))}
          value={value}
        />
      ),
      title: t("knowledgeNetwork.propertyAuthorizationColumnExplicit"),
      width: 125,
    },
    {
      dataIndex: "effective",
      key: "effective",
      render: levelTag,
      title: (
        <span className={styles.columnTitleWithHelp}>
          {t("knowledgeNetwork.propertyAuthorizationColumnEffective")}
          <Tooltip title={t("knowledgeNetwork.propertyAuthorizationBoundaryHint")}>
            <InfoCircleOutlined
              aria-label={t("knowledgeNetwork.propertyAuthorizationBoundaryHint")}
              className={styles.columnHelpIcon}
              tabIndex={0}
            />
          </Tooltip>
        </span>
      ),
      width: 105,
    },
    {
      dataIndex: "source",
      key: "source",
      render: (value: string) =>
        t(`knowledgeNetwork.propertyAuthorizationSource.${value}`, { defaultValue: value }),
      title: t("knowledgeNetwork.propertyAuthorizationColumnSource"),
      width: 125,
    },
    {
      dataIndex: "maskState",
      key: "mask",
      render: (value: PropertyRow["maskState"], row) => (
        <div className={styles.maskStateCell}>
          <span className={`${styles.maskState} ${styles[`mask_${value}`]}`}>
            {value === "configured" ? <CheckCircleOutlined /> : value === "invalid" ? <WarningOutlined /> : <LockOutlined />}
            {t(`knowledgeNetwork.propertyAuthorizationMaskState.${value}`)}
          </span>
          {value !== "unsupported" && detail?.operations?.includes("modify") ? (
            <button onClick={() => setEditingMaskProperty(row)} type="button">
              {t("knowledgeNetwork.propertyAuthorizationConfigureMask")}
            </button>
          ) : null}
        </div>
      ),
      title: t("knowledgeNetwork.propertyAuthorizationColumnMaskRule"),
      width: 150,
    },
  ];

  const visibleSubjects = useMemo(() => {
    const keyword = subjectKeyword.trim().toLowerCase();
    if (subjectType === "user") {
      return users.filter((user) => `${user.name} ${user.account}`.toLowerCase().includes(keyword));
    }
    return roles.filter((role) => `${role.name} ${role.description}`.toLowerCase().includes(keyword));
  }, [roles, subjectKeyword, subjectType, users]);

  const isAdminGrantor = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.grant,
  });
  const isAdminRevoker = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.revoke,
  });
  const canGrant = networkAuthorized || isAdminGrantor;
  const canRevoke = networkAuthorized || isAdminRevoker;
  const isPlatformAuthzAdmin = isAdminGrantor || isAdminRevoker;
  const baseOps = useMemo(
    () => operationsForType("object_type").filter(
      (operation) =>
        !HIDDEN_INSTANCE_OPS.has(operation.key) &&
        (operation.key !== "authorize" || isAdminGrantor),
    ),
    [isAdminGrantor],
  );
  const candidateRequirements = useMemo(
    () => baseOps.flatMap((requirement) => {
      const dependents = baseOps.filter(
        (operation) =>
          candidateOperations.includes(operation.key) &&
          operation.requires.includes(requirement.key),
      );
      return dependents.length ? [{ dependents, requirement }] : [];
    }),
    [baseOps, candidateOperations],
  );

  const isProtectedBaseGrant = (grant: ObjectGrant) =>
    (!isPlatformAuthzAdmin && isDelegateProtectedGrant(grant)) ||
    isSelfAuthorizeLockout({
      currentUserId: runtimeConfig.currentUser.id,
      grant,
      isAdminGrantor,
    });

  const candidateGrant = objectGrants.find((grant) => grant.accessorId === candidateUserId);
  const candidateManagedSources = (candidateGrant?.grants ?? []).filter(
    (source) =>
      source.active &&
      !source.inherited &&
      source.effect === "allow" &&
      source.policySource === "professional_rule" &&
      Boolean(source.grantId),
  );
  const candidateManagedOperations = new Set(
    candidateManagedSources.map((source) => source.operation),
  );
  const candidateOperationsToAdd = candidateOperations.filter(
    (operation) => !candidateManagedOperations.has(operation),
  );
  const candidateSourcesToRemove = [...new Set(candidateManagedSources.map((source) => source.operation))]
    .flatMap((operation) => {
      const records = candidateManagedSources.filter((source) => source.operation === operation);
      return candidateOperations.includes(operation) ? records.slice(1) : records;
    });
  const candidateWriteLocked = candidateGrant ? isProtectedBaseGrant(candidateGrant) : false;
  const candidateHasChanges =
    candidateOperationsToAdd.length > 0 || candidateSourcesToRemove.length > 0;

  const selectCandidateUser = (accessorId?: string) => {
    setCandidateUserId(accessorId);
    const grant = objectGrants.find((candidate) => candidate.accessorId === accessorId);
    const directOperations = [...new Set((grant?.grants ?? [])
      .filter(
        (source) =>
          source.active &&
          !source.inherited &&
          source.effect === "allow" &&
          source.policySource === "professional_rule",
      )
      .map((source) => source.operation))];
    setCandidateOperations(directOperations.length ? directOperations : grant?.operations ?? []);
  };

  const toggleCandidateOperation = (operationKey: string) => {
    setCandidateOperations((current) => {
      if (current.includes(operationKey)) {
        const requiredBySelection = baseOps.some(
          (operation) =>
            current.includes(operation.key) && operation.requires.includes(operationKey),
        );
        return requiredBySelection
          ? current
          : current.filter((candidateOperation) => candidateOperation !== operationKey);
      }
      const requirements = baseOps.find((operation) => operation.key === operationKey)?.requires ?? [];
      return [...new Set([...current, ...requirements, operationKey])];
    });
  };

  const handleAddBaseUser = async () => {
    if (
      !candidateUserId ||
      !candidateOperations.length ||
      !candidateHasChanges ||
      candidateWriteLocked ||
      !detail ||
      !canGrant
    ) {
      return;
    }
    setBaseBusy(true);
    try {
      for (const source of candidateSourcesToRemove) {
        await revokeObjectGrantForObject(source.grantId);
      }
      if (candidateOperationsToAdd.length) {
        await upsertObjectGrantForObject({
          accessorId: candidateUserId,
          effect: "allow",
          objId: objectTypeRef,
          objName: detail.name,
          objSub: networkId,
          objType: "object_type",
          operations: candidateOperationsToAdd,
        });
      }
      setCandidateUserId(undefined);
      setCandidateOperations([]);
      await loadBase();
      void message.success(t("systemAdmin.objectGrants.toast.granteeAdded"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBaseBusy(false);
    }
  };

  const revocableSourcesForGrant = (grant: ObjectGrant) =>
    (grant.grants ?? []).filter(
      (source) =>
        source.active &&
        !source.inherited &&
        source.policySource !== "role_permission" &&
        Boolean(source.grantId),
    );

  const deleteBaseGrant = (grant: ObjectGrant) => {
    if (!canRevoke || isProtectedBaseGrant(grant)) {
      return;
    }
    const sources = revocableSourcesForGrant(grant);
    const grantee = userMap.get(grant.accessorId);
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("systemAdmin.objectGrants.deleteGrantConfirm", {
        count: sources.length || grant.operations.length,
        name: grantee?.name || grant.accessorId,
      }),
      okButtonProps: { danger: true },
      okText: t("systemAdmin.objectGrants.deleteGrant"),
      onOk: async () => {
        setBaseBusy(true);
        try {
          if (sources.length) {
            for (const source of sources) {
              await revokeObjectGrantForObject(source.grantId);
            }
          } else {
            await upsertObjectGrantForObject({ ...grant, effect: "allow", operations: [] });
          }
          setSourceAccessorId(undefined);
          await loadBase();
          void message.success(t("systemAdmin.objectGrants.toast.revoked"));
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        } finally {
          setBaseBusy(false);
        }
      },
      title: t("systemAdmin.objectGrants.removeGrantTitle"),
    });
  };

  const sourceGrant = objectGrants.find((grant) => grant.accessorId === sourceAccessorId);
  const sourceGrantee = sourceGrant ? userMap.get(sourceGrant.accessorId) : undefined;
  const sourceRows = collapseGrantSources(
    (sourceGrant?.grants ?? []).filter((source) => source.active),
  );

  const allowedOperationsForGrant = (grant: ObjectGrant) => new Set(
    grant.effectiveDecisions?.length
      ? grant.effectiveDecisions
        .filter((decision) => decision.decision === "allow")
        .map((decision) => decision.operation)
      : grant.operations,
  );

  const handleDeleteSource = (source: GrantSourceRow) => {
    if (!sourceGrant || !canRevoke || isProtectedBaseGrant(sourceGrant)) {
      return;
    }
    const allowedOperations = allowedOperationsForGrant(sourceGrant);
    const blockingDependents = baseOps.filter(
      (operation) =>
        allowedOperations.has(operation.key) && operation.requires.includes(source.operation),
    );
    if (
      !source.active ||
      source.inherited ||
      source.policySource === "role_permission" ||
      !source.grantIds.length ||
      blockingDependents.length
    ) {
      return;
    }
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("systemAdmin.objectGrants.deleteSourceConfirm", {
        effect: t(`systemAdmin.objectGrants.effect.${source.effect}`),
        grantId: source.grantIds.join("、"),
        name: sourceGrantee?.name || sourceGrant.accessorId,
        operation: baseOps.find((operation) => operation.key === source.operation)?.label ??
          source.operation,
        source: t(`systemAdmin.objectGrants.source.${source.policySource}`),
      }),
      okButtonProps: { danger: true },
      okText: t("systemAdmin.objectGrants.deleteGrant"),
      onOk: async () => {
        setBaseBusy(true);
        try {
          for (const grantId of source.grantIds) {
            await revokeObjectGrantForObject(grantId);
          }
          await loadBase();
          void message.success(t("systemAdmin.objectGrants.toast.revoked"));
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        } finally {
          setBaseBusy(false);
        }
      },
      title: t("systemAdmin.objectGrants.deleteSourceTitle"),
    });
  };

  const sourceColumns: ColumnsType<GrantSourceRow> = [
    {
      key: "operation",
      render: (_value, source) => (
        <div className={styles.sourceOperationCell}>
          <strong>
            {baseOps.find((operation) => operation.key === source.operation)?.label ??
              source.operation}
          </strong>
          <code>{source.operation}</code>
        </div>
      ),
      title: t("systemAdmin.objectGrants.columns.operations"),
      width: 140,
    },
    {
      dataIndex: "effect",
      key: "effect",
      render: (effect: GrantRecord["effect"]) => (
        <Tag color={effect === "allow" ? "green" : "red"}>
          {t(`systemAdmin.objectGrants.effect.${effect}`)}
        </Tag>
      ),
      title: t("systemAdmin.objectGrants.sourceDecision"),
      width: 84,
    },
    {
      dataIndex: "policySource",
      key: "source",
      render: (policySource: GrantRecord["policySource"]) =>
        t(`systemAdmin.objectGrants.source.${policySource}`),
      title: t("systemAdmin.objectGrants.grantSource"),
      width: 128,
    },
    {
      dataIndex: "grantId",
      ellipsis: true,
      key: "grantId",
      render: (_grantId: string, source) => (
        <div className={styles.sourceGrantIds}>
          <code>{source.grantIds[0]}</code>
          {source.grantIds.length > 1 ? (
            <Tag>{t("systemAdmin.objectGrants.collapsedSourceCount", {
              count: source.grantIds.length,
            })}</Tag>
          ) : null}
        </div>
      ),
      title: t("systemAdmin.objectGrants.grantId"),
    },
    {
      align: "right",
      key: "actions",
      render: (_value, source) => {
        const allowedOperations = sourceGrant
          ? allowedOperationsForGrant(sourceGrant)
          : new Set<string>();
        const blockingDependents = baseOps.filter(
          (operation) =>
            allowedOperations.has(operation.key) && operation.requires.includes(source.operation),
        );
        const protectedGrant = sourceGrant ? isProtectedBaseGrant(sourceGrant) : true;
        const deleteDisabled =
          baseBusy ||
          !canRevoke ||
          protectedGrant ||
          !source.active ||
          source.inherited ||
          source.policySource === "role_permission" ||
          !source.grantIds.length ||
          blockingDependents.length > 0;
        return (
          <Tooltip
            title={blockingDependents.length
              ? t("systemAdmin.objectGrants.deleteRequiredSourceBlocked", {
                  dependents: blockingDependents.map((operation) => operation.label).join("、"),
                  requirement: baseOps.find((operation) => operation.key === source.operation)?.label ??
                    source.operation,
                })
              : protectedGrant
                ? t("systemAdmin.objectGrants.delegateLocked")
                : source.inherited || source.policySource === "role_permission"
                  ? t("systemAdmin.objectGrants.readOnlySource")
                  : undefined}
          >
            <span>
              <AppButton
                danger
                disabled={deleteDisabled}
                onClick={() => handleDeleteSource(source)}
                size="small"
                type="link"
              >
                {t("systemAdmin.objectGrants.deleteGrant")}
              </AppButton>
            </span>
          </Tooltip>
        );
      },
      title: t("common.actions"),
      width: 104,
    },
  ];

  const baseGrantColumns: ColumnsType<ObjectGrant> = [
    {
      dataIndex: "accessorId",
      render: (id: string) => (
        <div className={styles.subjectName}>
          <Avatar icon={<UserOutlined />} size={34} />
          <span>
            <strong>{userMap.get(id)?.name || id}</strong>
            <small>{userMap.get(id)?.account}</small>
          </span>
        </div>
      ),
      title: t("knowledgeNetwork.propertyAuthorizationUser"),
      width: 220,
    },
    {
      key: "operations",
      render: (_value, grant) => {
        const visibleDecisions = baseOps.flatMap((operation) => {
          const decision = grant.effectiveDecisions?.find(
            (candidate) => candidate.operation === operation.key,
          );
          const state = decision?.decision ??
            (grant.operations.includes(operation.key) ? "allow" : "unset");
          return state === "unset" ? [] : [{ operation, state }];
        });
        return visibleDecisions.length ? (
          <div className={styles.effectivePermissions}>
            {visibleDecisions.map(({ operation, state }) => (
              <Tooltip key={operation.key} title={operation.key}>
                <span
                  aria-label={t(`systemAdmin.objectGrants.permission${
                    state === "allow" ? "Allowed" : "Denied"
                  }`, { operation: operation.label })}
                  className={`${styles.permissionDecision} ${styles[`permissionDecision_${state}`]}`}
                >
                  {state === "allow" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  {operation.label}
                </span>
              </Tooltip>
            ))}
          </div>
        ) : <span className={styles.sourceEmptyMark}>—</span>;
      },
      title: t("systemAdmin.objectGrants.effectivePermissions"),
    },
    {
      key: "sources",
      render: (_value, grant) => {
        const activeSources = (grant.grants ?? []).filter((source) => source.active);
        const collapsedSources = collapseGrantSources(activeSources);
        const sourceLabels = [...new Set(collapsedSources.map((source) =>
          t(`systemAdmin.objectGrants.source.${source.policySource}`),
        ))];
        return collapsedSources.length ? (
          <AppButton
            className={styles.sourceSummary}
            onClick={() => setSourceAccessorId(grant.accessorId)}
            size="small"
            type="link"
          >
            <strong>{t("systemAdmin.objectGrants.sourceCount", { count: collapsedSources.length })}</strong>
            <small>{sourceLabels.join(" / ")}</small>
          </AppButton>
        ) : <span className={styles.sourceEmptyMark}>—</span>;
      },
      title: t("systemAdmin.objectGrants.grantSource"),
      width: 138,
    },
    {
      key: "actions",
      render: (_value, grant) => {
        const protectedGrant = isProtectedBaseGrant(grant);
        const deleteDisabled = baseBusy || !canRevoke || protectedGrant;
        return (
          <div className={styles.grantActions}>
            <AppButton
              onClick={() => setSourceAccessorId(grant.accessorId)}
              size="small"
              type="link"
            >
              {t("common.viewDetails")}
            </AppButton>
            <span aria-hidden className={styles.grantActionDivider} />
            <Tooltip
              title={protectedGrant ? t("systemAdmin.objectGrants.delegateLocked") : undefined}
            >
              <span>
                <AppButton
                  danger
                  disabled={deleteDisabled}
                  onClick={() => deleteBaseGrant(grant)}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.deleteGrant")}
                </AppButton>
              </span>
            </Tooltip>
          </div>
        );
      },
      title: t("common.actions"),
      width: 156,
    },
  ];

  const basePanel = (
    <div className={[styles.panel, styles.basePanel].join(" ")}>
      <div className={styles.panelIntro}>
        <div>
          <h2>{t("knowledgeNetwork.propertyAuthorizationTabBase")}</h2>
          <p>{t("knowledgeNetwork.propertyAuthorizationBaseDescription")}</p>
        </div>
      </div>

      <section className={styles.baseGrantComposer}>
        <header className={styles.baseGrantComposerHead}>
          <strong>{t("systemAdmin.objectGrants.newGrantTitle")}</strong>
          <span>
            {t("systemAdmin.objectGrants.selectedOperationCount", {
              selected: candidateOperations.length,
              total: baseOps.length,
            })}
          </span>
        </header>
        <div className={styles.baseGrantForm}>
          <div className={styles.baseGrantUserField}>
            <label htmlFor="object-type-grant-user">
              {t("systemAdmin.objectGrants.grantUserLabel")}
            </label>
            <Select
              allowClear
              aria-label={t("systemAdmin.objectGrants.grantUserLabel")}
              id="object-type-grant-user"
              onChange={selectCandidateUser}
              optionFilterProp="label"
              options={users.map((user) => ({ label: userLabel(user), value: user.id }))}
              placeholder={t("systemAdmin.objectGrants.addGranteePlaceholder")}
              showSearch
              value={candidateUserId}
            />
          </div>
          <div className={styles.baseGrantOperationsField}>
            <div className={styles.baseGrantFieldHead}>
              <span>{t("systemAdmin.objectGrants.grantOperationsLabel")}</span>
              <div>
                <AppButton
                  disabled={candidateOperations.length === baseOps.length}
                  onClick={() => setCandidateOperations(baseOps.map((operation) => operation.key))}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.selectAllOperations")}
                </AppButton>
                <AppButton
                  disabled={!candidateOperations.length}
                  onClick={() => setCandidateOperations([])}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.clearOperations")}
                </AppButton>
              </div>
            </div>
            <div className={styles.baseGrantOperations} role="group">
              {baseOps.map((operation) => {
                const selected = candidateOperations.includes(operation.key);
                const required = candidateRequirements.some(
                  ({ requirement }) => requirement.key === operation.key,
                );
                return (
                  <Tooltip key={operation.key} title={operation.key}>
                    <button
                      aria-label={operation.key}
                      aria-pressed={selected}
                      className={selected
                        ? styles.baseGrantOperationSelected
                        : styles.baseGrantOperation}
                      onClick={() => toggleCandidateOperation(operation.key)}
                      type="button"
                    >
                      {operation.label}
                      {required ? <LockOutlined /> : null}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <footer className={styles.baseGrantFooter}>
            <span aria-live="polite">
              {t(
                !candidateUserId
                  ? "systemAdmin.objectGrants.grantNeedsUser"
                  : candidateWriteLocked
                    ? "systemAdmin.objectGrants.delegateLocked"
                  : !candidateOperations.length
                    ? "systemAdmin.objectGrants.grantNeedsOperation"
                    : !candidateHasChanges
                      ? "systemAdmin.objectGrants.grantNoChanges"
                    : "systemAdmin.objectGrants.grantReady",
                { count: candidateOperations.length },
              )}
            </span>
            <AppButton
              disabled={
                !candidateUserId ||
                !candidateOperations.length ||
                !candidateHasChanges ||
                candidateWriteLocked ||
                !canGrant
              }
              icon={<PlusOutlined />}
              loading={baseBusy}
              onClick={() => void handleAddBaseUser()}
              type="primary"
            >
              {t("systemAdmin.objectGrants.addGrant")}
            </AppButton>
          </footer>
        </div>
        {candidateRequirements.length ? (
          <div className={styles.baseGrantNotice}>
            <InfoCircleOutlined />
            {candidateRequirements.map(({ dependents, requirement }) => (
              <span key={requirement.key}>
                {t("systemAdmin.objectGrants.requiredSelectionNotice", {
                  dependents: dependents.map((operation) => operation.label).join("、"),
                  requirement: requirement.label,
                })}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.baseGrantMatrix}>
        <header className={styles.baseGrantMatrixHead}>
          <strong>{t("systemAdmin.objectGrants.grantDetails")}</strong>
          <span>{t("systemAdmin.objectGrants.grantUserCount", { count: objectGrants.length })}</span>
        </header>
        <Table<ObjectGrant>
          className={styles.baseGrantTable}
          columns={baseGrantColumns}
          dataSource={objectGrants}
          loading={baseLoading}
          locale={{
            emptyText: (
              <div className={styles.baseGrantEmpty}>
                <Empty
                  description={t("systemAdmin.objectGrants.drawerEmpty")}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
                <span>{t("systemAdmin.objectGrants.drawerEmptyHelp")}</span>
              </div>
            ),
          }}
          pagination={false}
          rowKey="accessorId"
          size="small"
          tableLayout="fixed"
        />
      </section>

      <Drawer
        destroyOnClose
        onClose={() => setSourceAccessorId(undefined)}
        open={Boolean(sourceGrant)}
        rootClassName={styles.baseSourceDrawer}
        title={sourceGrant
          ? `${sourceGrantee?.name || sourceGrant.accessorId} / ${t("systemAdmin.objectGrants.grantSource")}`
          : t("systemAdmin.objectGrants.grantSource")}
        width="min(760px, 100vw)"
      >
        <div className={styles.sourceDrawerIntro}>
          <InfoCircleOutlined />
          <span>{t("systemAdmin.objectGrants.sourceDrawerDescription")}</span>
        </div>
        <Table<GrantSourceRow>
          className={styles.sourceTable}
          columns={sourceColumns}
          dataSource={sourceRows}
          locale={{ emptyText: t("systemAdmin.objectGrants.sourceEmpty") }}
          pagination={false}
          rowKey={(source) => source.grantIds.join("|")}
          scroll={{ x: 680 }}
          size="small"
          tableLayout="fixed"
        />
      </Drawer>
    </div>
  );
  const propertyPanel = (
    <div className={styles.propertyWorkspace}>
      <aside className={styles.subjectRail}>
        <div className={styles.subjectRailHead}>
          <h2>{t("knowledgeNetwork.propertyAuthorizationSubjectTitle")}</h2>
          <p>{t("knowledgeNetwork.propertyAuthorizationSubjectDescription")}</p>
        </div>
        <Segmented
          block
          onChange={(value) =>
            confirmDiscard(() => {
              setSubjectType(value as PropertyGrantSubjectType);
              setSubjectId(undefined);
              setDraft(new Map());
            })
          }
          options={[
            { icon: <UserOutlined />, label: t("knowledgeNetwork.propertyAuthorizationUser"), value: "user" },
            { icon: <TeamOutlined />, label: t("knowledgeNetwork.propertyAuthorizationRole"), value: "role" },
          ]}
          value={subjectType}
        />
        <Input
          allowClear
          onChange={(event) => setSubjectKeyword(event.target.value)}
          placeholder={t("knowledgeNetwork.propertyAuthorizationSearchSubject")}
          prefix={<SearchOutlined />}
          value={subjectKeyword}
        />
        <div className={styles.subjectList}>
          {visibleSubjects.map((record) => {
            const id = record.id;
            const selected = id === subjectId;
            const isRole = subjectType === "role";
            return (
              <button
                className={selected ? styles.subjectItemSelected : styles.subjectItem}
                key={id}
                onClick={() => confirmDiscard(() => setSubjectId(id))}
                type="button"
              >
                <Avatar icon={isRole ? <TeamOutlined /> : <UserOutlined />} size={34} />
                <span>
                  <strong>{record.name || id}</strong>
                  <small>
                    {isRole
                      ? t("knowledgeNetwork.propertyAuthorizationMemberCount", {
                          count: (record as AdminRole).accessorIds.length,
                        })
                      : (record as AdminUser).account}
                  </small>
                </span>
                <span className={styles.subjectChevron}>›</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={styles.matrixArea}>
        {!selectedSubject ? (
          <div className={styles.subjectEmpty}>
            <SafetyCertificateOutlined />
            <h3>{t("knowledgeNetwork.propertyAuthorizationSelectSubject")}</h3>
            <p>{t("knowledgeNetwork.propertyAuthorizationSelectSubjectDescription")}</p>
          </div>
        ) : (
          <>
            <div className={styles.subjectSummary}>
              <div className={styles.subjectSummaryIdentity}>
                <Avatar icon={subjectType === "role" ? <TeamOutlined /> : <UserOutlined />} size={42} />
                <span>
                  <strong>{currentSubjectRecord?.name || selectedSubject.id}</strong>
                  <span className={styles.subjectSummaryMeta}>
                    <small>{subjectType === "role" ? t("knowledgeNetwork.propertyAuthorizationRole") : (currentSubjectRecord as AdminUser | undefined)?.account}</small>
                    {subjectType === "role" ? (
                      <Tooltip
                        title={t("knowledgeNetwork.propertyAuthorizationRoleImpact", {
                          count: (currentSubjectRecord as AdminRole | undefined)?.accessorIds.length ?? 0,
                        })}
                      >
                        <span className={styles.roleImpactHint} tabIndex={0}>
                          <WarningOutlined />
                          {t("knowledgeNetwork.propertyAuthorizationRoleImpactCompact", {
                            count: (currentSubjectRecord as AdminRole | undefined)?.accessorIds.length ?? 0,
                          })}
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>
                </span>
              </div>
              <div className={styles.summaryStat}>
                <span>{t("knowledgeNetwork.propertyAuthorizationBasePermission")}</span>
                {levelTag(baseLevel)}
              </div>
              <div className={styles.summaryStat}>
                <span>{t("knowledgeNetwork.propertyAuthorizationPropertyCount", { count: detail?.dataProperties.length ?? 0 })}</span>
                <strong>{detail?.dataProperties.length ?? 0}</strong>
              </div>
              <div className={styles.summaryStat}>
                <span>{t("knowledgeNetwork.propertyAuthorizationExplicitCount", { count: entryMap.size })}</span>
                <strong>{entryMap.size}</strong>
              </div>
            </div>
            <div className={styles.matrixToolbar}>
              <div className={styles.matrixFilters}>
                <Input
                  allowClear
                  onChange={(event) => setPropertyKeyword(event.target.value)}
                  placeholder={t("knowledgeNetwork.propertyAuthorizationSearchProperty")}
                  prefix={<SearchOutlined />}
                  value={propertyKeyword}
                />
                <Select
                  onChange={setPropertyFilter}
                  options={(["all", "explicit", "inherit", "invalid"] as PropertyFilter[]).map((value) => ({
                    label: t(`knowledgeNetwork.propertyAuthorizationFilter${value[0].toUpperCase()}${value.slice(1)}`),
                    value,
                  }))}
                  value={propertyFilter}
                />
              </div>
              {selectedProperties.length ? (
                <div className={styles.matrixToolbarActions}>
                  <div className={styles.batchBar}>
                    <strong>{t("knowledgeNetwork.propertyAuthorizationSelected", { count: selectedProperties.length })}</strong>
                    <Select
                      onChange={applyBatch}
                      options={LEVELS.filter((level) => level !== "inherit").map((level) => ({
                        label: t(`knowledgeNetwork.propertyAuthorizationLevel.${level}`),
                        value: level,
                      }))}
                      placeholder={t("knowledgeNetwork.propertyAuthorizationBatchSet")}
                    />
                    <AppButton onClick={() => applyBatch("inherit")}>
                      {t("knowledgeNetwork.propertyAuthorizationRestoreInheritance")}
                    </AppButton>
                  </div>
                </div>
              ) : null}
            </div>

            {invalidMaskedProperties.length ? (
              <Alert
                className={styles.validationAlert}
                message={t("knowledgeNetwork.propertyAuthorizationMaskedMissing")}
                showIcon
                type="error"
              />
            ) : null}
            {tooManyChanges ? (
              <Alert
                className={styles.validationAlert}
                message={t("knowledgeNetwork.propertyAuthorizationBatchLimit", {
                  count: MAX_PROPERTY_GRANT_CHANGES,
                })}
                showIcon
                type="error"
              />
            ) : null}

            <Table<PropertyRow>
              columns={propertyColumns}
              dataSource={propertyRows}
              loading={propertyLoading}
              locale={{ emptyText: t("knowledgeNetwork.propertyAuthorizationNoProperty") }}
              pagination={
                propertyRows.length > PROPERTY_PAGE_SIZE
                  ? {
                      defaultPageSize: PROPERTY_PAGE_SIZE,
                      pageSizeOptions: [50, 100, 200],
                      showSizeChanger: true,
                    }
                  : false
              }
              rowKey="name"
              rowSelection={{
                onChange: setSelectedProperties,
                preserveSelectedRowKeys: true,
                selectedRowKeys: selectedProperties,
              }}
              scroll={{ x: 930 }}
              size="middle"
            />
          </>
        )}
      </section>
    </div>
  );

  if (loading) {
    return (
      <KnowledgeNetworkResourceConfigShell
        loading
        onBack={() => {
          void navigate(detailPath);
        }}
        subtitle={`${networkId} / ${objectTypeId}`}
        title={t("knowledgeNetwork.propertyAuthorizationAction")}
      />
    );
  }
  if (!detail) {
    return <Empty description={t("knowledgeNetwork.propertyAuthorizationLoadFailed")} />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        draft.size ? (
          <div className={styles.saveActions}>
            <span>{t("knowledgeNetwork.propertyAuthorizationUnsaved", { count: draft.size })}</span>
            <AppButton onClick={() => setDraft(new Map())}>{t("common.cancel")}</AppButton>
            <Tooltip
              title={
                tooManyChanges
                  ? t("knowledgeNetwork.propertyAuthorizationBatchLimit", {
                      count: MAX_PROPERTY_GRANT_CHANGES,
                    })
                  : invalidMaskedProperties.length
                  ? t("knowledgeNetwork.propertyAuthorizationMaskedMissing")
                  : undefined
              }
            >
              <span>
                <AppButton
                  disabled={Boolean(invalidMaskedProperties.length) || tooManyChanges}
                  loading={propertySaving}
                  onClick={savePropertyChanges}
                  type="primary"
                >
                  {t("knowledgeNetwork.propertyAuthorizationSave", { count: draft.size })}
                </AppButton>
              </span>
            </Tooltip>
          </div>
        ) : null
      }
      onBack={() => confirmDiscard(() => void navigate(detailPath))}
      subtitle={`${networkId} / ${detail.id}`}
      title={t("knowledgeNetwork.propertyAuthorizationTitle", { name: detail.name })}
    >
      <div className={styles.page}>
        <Tabs
          activeKey={activeTab}
          items={[
            {
              children: (
                <RequireEdition
                  capability={CAPABILITIES.PERM_FINE_GRAINED}
                  minEdition="professional"
                  mountLockedContent={false}
                >
                  {basePanel}
                </RequireEdition>
              ),
              key: "base",
              label: (
                <span className="console-tab-with-tier">
                  {t("knowledgeNetwork.propertyAuthorizationTabBase")}
                  <EditionBadge
                    capability={CAPABILITIES.PERM_FINE_GRAINED}
                    edition="professional"
                  />
                </span>
              ),
            },
            {
              children: (
                <RequireEdition
                  capability={CAPABILITIES.PERM_OBJECT_LEVEL}
                  minEdition="enterprise"
                >
                  {propertyPanel}
                </RequireEdition>
              ),
              key: "property",
              label: (
                <span className="console-tab-with-tier">
                  {t("knowledgeNetwork.propertyAuthorizationTabProperty")}
                  <EditionBadge
                    alwaysShow
                    capability={CAPABILITIES.PERM_OBJECT_LEVEL}
                    edition="enterprise"
                  />
                </span>
              ),
            },
          ]}
          onChange={(key) => confirmDiscard(() => setActiveTab(key as AuthorizationTab))}
        />
      </div>

      <ObjectTypeDataAttributeFormDrawer
        mode="mask-rule"
        onClose={() => setEditingMaskProperty(undefined)}
        onSubmit={saveMaskRule}
        open={Boolean(editingMaskProperty)}
        property={editingMaskProperty}
      />
    </KnowledgeNetworkResourceConfigShell>
  );
}
