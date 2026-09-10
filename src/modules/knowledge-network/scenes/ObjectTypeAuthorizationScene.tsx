/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
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
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectTypeDataAttributeFormDrawer } from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeFormDrawer";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
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
import type { ObjectGrant } from "@/modules/system-admin/types/authz";
import { HIDDEN_INSTANCE_OPS } from "@/modules/system-admin/utils/authz-catalog";
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

const LEVELS: PropertyAccessSelection[] = ["inherit", "none", "schema", "masked", "full"];
const MAX_PROPERTY_GRANT_CHANGES = 200;
const PROPERTY_GRANT_AUDIT_REASON = "updated-from-object-type-authorization";
const PROPERTY_PAGE_SIZE = 50;
const PUBLIC_ACCESSOR_ID = "00000000-0000-0000-0000-000000000000";

function userLabel(user: AdminUser) {
  return user.name ? `${user.name}（${user.account}）` : user.account || user.id;
}

function mergeUsers(primary: AdminUser[], secondary: AdminUser[]) {
  return [...new Map([...primary, ...secondary].map((user) => [user.id, user])).values()];
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

  const loadPropertySnapshot = useCallback(
    async (subject: PropertyGrantSubject) => {
      if (!propertyAvailable) {
        return;
      }
      setPropertyLoading(true);
      try {
        const snapshot = await listPropertyGrantSnapshot(subject, objectTypeRef);
        setGrantSnapshot(snapshot);
        setDraft(new Map());
        setSelectedProperties([]);
      } catch (error) {
        setGrantSnapshot(null);
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setPropertyLoading(false);
      }
    },
    [message, objectTypeRef, propertyAvailable],
  );

  useEffect(() => {
    if (selectedSubject) {
      void loadPropertySnapshot(selectedSubject);
    } else {
      setGrantSnapshot(null);
    }
  }, [loadPropertySnapshot, selectedSubject]);

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

  const roleMatchesObject = useCallback(
    (role: AdminRole) =>
      role.permissions
        .filter(
          (grant) =>
            grant.resource.type === "object_type" &&
            (grant.resource.id === objectTypeRef || grant.resource.id === "*"),
        )
        .flatMap((grant) => grant.operations),
    [objectTypeRef],
  );

  const subjectOperations = useMemo(() => {
    if (!subjectId) {
      return [];
    }
    if (subjectType === "role") {
      const role = roleMap.get(subjectId);
      return role ? roleMatchesObject(role) : [];
    }
    const direct = objectGrants.find((grant) => grant.accessorId === subjectId)?.operations ?? [];
    const user = userMap.get(subjectId);
    const inherited = roles
      .filter(
        (role) => role.accessorIds.includes(subjectId) || user?.roleIds.includes(role.id),
      )
      .flatMap(roleMatchesObject);
    return [...new Set([...direct, ...inherited])];
  }, [objectGrants, roleMap, roleMatchesObject, roles, subjectId, subjectType, userMap]);
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
    const names = new Set(selectedProperties.map(String));
    for (const row of propertyRows) {
      if (names.has(row.name)) {
        setPropertySelection(row.name, next);
      }
    }
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
    const summary = summarizePropertyGrantChanges(entryMap, draft);
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

  const baseOps = useMemo(
    () =>
      operationsForType("object_type").filter(
        (operation) =>
          !HIDDEN_INSTANCE_OPS.has(operation.key) &&
          (operation.key !== "authorize" ||
            !detail?.operations?.includes("authorize") ||
            hasPermissions({
              currentPermissions: runtimeConfig.currentUser.permissions,
              requiredPermissions: authzPoints.grant,
            })),
      ),
    [detail?.operations, runtimeConfig.currentUser.permissions],
  );

  const isAdminGrantor = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.grant,
  });
  const isAdminRevoker = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.revoke,
  });
  const objectAuthorized = detail?.operations?.includes("authorize") ?? false;
  const canGrant = objectAuthorized || isAdminGrantor;
  const canRevoke = objectAuthorized || isAdminRevoker;
  const isPlatformAuthzAdmin = isAdminGrantor || isAdminRevoker;

  const isProtectedBaseGrant = (grant: ObjectGrant) =>
    !isPlatformAuthzAdmin &&
    (grant.accessorId === PUBLIC_ACCESSOR_ID || grant.operations.includes("authorize"));

  const handleAddBaseUser = async () => {
    if (!candidateUserId || !detail || !canGrant) {
      return;
    }
    setBaseBusy(true);
    try {
      await upsertObjectGrantForObject({
        accessorId: candidateUserId,
        objId: objectTypeRef,
        objName: detail.name,
        objSub: networkId,
        objType: "object_type",
        operations: ["view_detail"],
      });
      setCandidateUserId(undefined);
      await loadBase();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBaseBusy(false);
    }
  };

  const toggleBaseOperation = async (grant: ObjectGrant, operation: string) => {
    const removing = grant.operations.includes(operation);
    if (isProtectedBaseGrant(grant) || (removing ? !canRevoke : !canGrant)) {
      return;
    }
    const operations = grant.operations.includes(operation)
      ? grant.operations.filter((item) => item !== operation)
      : [...grant.operations, operation];
    if (!operations.length) {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("systemAdmin.objectGrants.removeLastOpConfirm"),
        okButtonProps: { danger: true },
        okText: t("common.delete"),
        onOk: async () => {
          await revokeObjectGrantForObject(grant.accessorId, grant.objType, grant.objId);
          await loadBase();
        },
        title: t("systemAdmin.objectGrants.removeGrantTitle"),
      });
      return;
    }
    setBaseBusy(true);
    try {
      await upsertObjectGrantForObject({ ...grant, operations });
      await loadBase();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBaseBusy(false);
    }
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

  const basePanel = (
    <div className={styles.panel}>
      <div className={styles.panelIntro}>
        <div>
          <h2>{t("knowledgeNetwork.propertyAuthorizationTabBase")}</h2>
          <p>{t("knowledgeNetwork.propertyAuthorizationBaseDescription")}</p>
        </div>
        <div className={styles.addUserRow}>
          <Select
            onChange={setCandidateUserId}
            options={users
              .filter((user) => !objectGrants.some((grant) => grant.accessorId === user.id))
              .map((user) => ({ label: userLabel(user), value: user.id }))}
            placeholder={t("knowledgeNetwork.propertyAuthorizationAddUser")}
            showSearch
            value={candidateUserId}
          />
          <AppButton
            disabled={!candidateUserId || !canGrant}
            loading={baseBusy}
            onClick={() => void handleAddBaseUser()}
            type="primary"
          >
            {t("common.add")}
          </AppButton>
        </div>
      </div>
      <Table<ObjectGrant>
        columns={[
          {
            dataIndex: "accessorId",
            render: (id: string) => (
              <div className={styles.subjectName}>
                <Avatar icon={<UserOutlined />} size={34} />
                <span><strong>{userMap.get(id)?.name || id}</strong><small>{userMap.get(id)?.account}</small></span>
              </div>
            ),
            title: t("knowledgeNetwork.propertyAuthorizationUser"),
            width: 240,
          },
          {
            key: "operations",
            render: (_value, grant) => (
              <div className={styles.permissionChips}>
                {baseOps.map((operation) => {
                  const selected = grant.operations.includes(operation.key);
                  return (
                    <button
                      className={selected ? styles.permissionChipActive : styles.permissionChip}
                      disabled={
                        baseBusy ||
                        userMap.get(grant.accessorId)?.builtin ||
                        isProtectedBaseGrant(grant) ||
                        (selected ? !canRevoke : !canGrant)
                      }
                      key={operation.key}
                      onClick={() => void toggleBaseOperation(grant, operation.key)}
                      type="button"
                    >
                      {operation.label}
                    </button>
                  );
                })}
              </div>
            ),
            title: t("knowledgeNetwork.propertyAuthorizationBasePermission"),
          },
        ]}
        dataSource={objectGrants}
        loading={baseLoading}
        locale={{ emptyText: t("knowledgeNetwork.propertyAuthorizationGranteeEmpty") }}
        pagination={false}
        rowKey="accessorId"
      />
    </div>
  );

  const propertyPanel = propertyAvailable ? (
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
  ) : null;

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
            { children: basePanel, key: "base", label: t("knowledgeNetwork.propertyAuthorizationTabBase") },
            ...(propertyAvailable
              ? [{
                  children: propertyPanel,
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
                }]
              : []),
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
