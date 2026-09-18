/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Drawer, Empty, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { isSuperAdmin } from "@/framework/auth/super-admin";
import { AppTable } from "@/framework/ui/common/AppTable";
import { DirectoryUserPicker } from "@/modules/system-admin/components/DirectoryUserPicker";
import { listObjectGrantsPage } from "@/modules/system-admin/services/authz.service";
import { resolveGrantNames } from "@/modules/system-admin/services/authz-objects.service";
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";
import type { EffectiveDecision, ObjectGrant } from "@/modules/system-admin/types/authz";
import { operationLabel, resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type MemberAuthorizationPanelProps = {
  departments: AdminDepartment[];
};

function userName(user: AdminUser) {
  return user.name || user.account || user.id;
}

function userIsSuperAdmin(user: AdminUser) {
  return isSuperAdmin([...(user.roleNames ?? []), ...(user.roleIds ?? [])]);
}

function grantKey(grant: ObjectGrant) {
  return `${grant.accessorId}:${grant.objType}:${grant.objId}`;
}

function parentResourceName(grant: ObjectGrant) {
  if (grant.objSub) {
    return grant.objSub;
  }
  if (
    ["action_type", "concept_group", "metric", "object_type", "relation_type"].includes(
      grant.objType,
    )
  ) {
    return grant.objId.split("/", 1)[0] || undefined;
  }
  return undefined;
}

function decisionsFor(grant: ObjectGrant): EffectiveDecision[] {
  if (grant.effectiveDecisions?.length) {
    return grant.effectiveDecisions;
  }
  return [
    ...grant.operations.map((operation) => ({
      basis: "direct" as const,
      decision: "allow" as const,
      operation,
      requires: [],
    })),
    ...(grant.deniedOperations ?? []).map((operation) => ({
      basis: "direct" as const,
      decision: "deny" as const,
      operation,
      requires: [],
    })),
  ];
}

export function MemberAuthorizationPanel({ departments }: MemberAuthorizationPanelProps) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [detailGrantKey, setDetailGrantKey] = useState<string | null>(null);

  useEffect(() => {
    setDetailGrantKey(null);
    if (!selectedUser) {
      setGrants([]);
      setGrantsLoading(false);
      return;
    }
    if (userIsSuperAdmin(selectedUser)) {
      // `super_admin` has the global `*:*:*` wildcard. Do not make a narrower object-grant
      // request that adds no useful information to this review view.
      setGrants([]);
      setGrantsLoading(false);
      return;
    }
    let cancelled = false;
    setGrantsLoading(true);
    void listObjectGrantsPage(
      { accessorId: selectedUser.id, limit: 100, offset: 0 },
      { resolveNames: false },
    )
      .then((result) => {
        if (cancelled) return;
        // A large administrator policy set can require many domain lookups to turn IDs into names.
        // Render the authoritative grant records immediately; display enrichment must never keep this
        // review surface in a permanent loading state.
        setGrants(result.grants);
        setGrantsLoading(false);
        void resolveGrantNames(result.grants)
          .then((resolved) => {
            if (!cancelled) setGrants(resolved);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) {
          setGrants([]);
          setGrantsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUser]);

  const grantColumns: ColumnsType<ObjectGrant> = useMemo(
    () => [
      {
        title: t("systemAdmin.objectGrants.columns.object"),
        render: (_, grant) => {
          const parent = parentResourceName(grant);
          return (
            <span className={styles.memberResourceCell}>
              <strong>{grant.objName}</strong>
              <small>
                {parent
                  ? t("systemAdmin.objectGrants.memberParentResource", { name: parent })
                  : t("systemAdmin.objectGrants.memberRootResource")}
              </small>
              <small className={styles.memberResourceId}>
                {t("systemAdmin.objectGrants.memberResourceIdentifier", { id: grant.objId })}
              </small>
            </span>
          );
        },
      },
      {
        title: t("systemAdmin.objectGrants.columns.type"),
        width: 132,
        render: (_, grant) => <Tag>{resourceTypeLabel(grant.objType)}</Tag>,
      },
      {
        title: t("systemAdmin.objectGrants.memberEffectivePermissions"),
        width: 196,
        render: (_, grant) => {
          const decisions = decisionsFor(grant);
          const allowed = decisions.filter((decision) => decision.decision === "allow").length;
          const denied = decisions.length - allowed;
          return (
            <span className={styles.memberPermissionOverview}>
              {allowed ? (
                <Tag color="green">
                  {t("systemAdmin.objectGrants.memberPermissionAllowCount", { count: allowed })}
                </Tag>
              ) : null}
              {denied ? (
                <Tag color="red">
                  {t("systemAdmin.objectGrants.memberPermissionDenyCount", { count: denied })}
                </Tag>
              ) : null}
              <Button onClick={() => setDetailGrantKey(grantKey(grant))} type="link">
                {t("systemAdmin.objectGrants.memberPermissionDetail")}
              </Button>
            </span>
          );
        },
      },
      {
        title: t("systemAdmin.objectGrants.memberAuthorizationMode"),
        width: 128,
        render: (_, grant) =>
          grant.grants?.length ? (
            <span className={styles.chipRow}>
              {[...new Set(grant.grants.map((source) => source.policySource))].map((source) => (
                <Tag key={source}>{t(`systemAdmin.objectGrants.mode.${source}`)}</Tag>
              ))}
            </span>
          ) : (
            "-"
          ),
      },
      {
        title: t("systemAdmin.objectGrants.memberGrantSource"),
        width: 128,
        render: (_, grant) =>
          grant.grants?.length ? (
            <span className={styles.chipRow}>
              {[...new Set(grant.grants.map((source) => source.authoritySource))].map((source) => (
                <Tag key={source}>{t(`systemAdmin.objectGrants.authority.${source}`)}</Tag>
              ))}
            </span>
          ) : (
            "-"
          ),
      },
    ],
    [t],
  );
  const userRoles = selectedUser?.roleNames?.length
    ? selectedUser.roleNames
    : (selectedUser?.roleIds ?? []);
  const selectedUserIsSuperAdmin = selectedUser ? userIsSuperAdmin(selectedUser) : false;
  const detailGrant = detailGrantKey
    ? (grants.find((grant) => grantKey(grant) === detailGrantKey) ?? null)
    : null;
  const detailDecisions = detailGrant ? decisionsFor(detailGrant) : [];

  return (
    <div className={styles.memberAuthorizationLayout}>
      <aside className={styles.memberUserPane}>
        <div className={styles.memberUserHead}>
          <h2>{t("systemAdmin.objectGrants.memberUserTitle")}</h2>
          <p>{t("systemAdmin.objectGrants.memberUserDescription")}</p>
        </div>
        <DirectoryUserPicker
          ariaLabel={t("systemAdmin.objectGrants.memberUser")}
          className={styles.memberUserPicker}
          departments={departments}
          onChange={(userId) => {
            if (!userId) setSelectedUser(null);
          }}
          onUsersChange={(users) => setSelectedUser(users[0] ?? null)}
          presentation="inline"
          value={selectedUser?.id}
        />
      </aside>
      <section className={styles.memberDetailPane}>
        <div className={styles.memberPaneHeader}>
          <div>
            <div className={styles.memberIdentityHeader}>
              <strong>
                {selectedUser ? userName(selectedUser) : t("systemAdmin.objectGrants.memberEmpty")}
              </strong>
              {userRoles.map((role) => (
                <Tag color="blue" key={role}>
                  {role}
                </Tag>
              ))}
            </div>
            <p className={styles.memberPaneHint}>
              {t("systemAdmin.objectGrants.memberAccessHint")}
            </p>
          </div>
        </div>
        {selectedUser && selectedUserIsSuperAdmin ? (
          <div className={styles.memberSuperAdminAccess}>
            <strong aria-label={t("systemAdmin.objectGrants.memberSuperAdminTitle")}>*</strong>
            <div>
              <h3>{t("systemAdmin.objectGrants.memberSuperAdminTitle")}</h3>
              <p>{t("systemAdmin.objectGrants.memberSuperAdminDescription")}</p>
            </div>
          </div>
        ) : selectedUser ? (
          <AppTable<ObjectGrant>
            columns={grantColumns}
            dataSource={grants}
            loading={grantsLoading}
            pagination={false}
            rowKey={grantKey}
            size="small"
          />
        ) : (
          <Empty
            description={t("systemAdmin.objectGrants.memberEmpty")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </section>
      <Drawer
        onClose={() => setDetailGrantKey(null)}
        open={Boolean(detailGrant)}
        rootClassName={styles.adminOverlay}
        title={
          detailGrant
            ? t("systemAdmin.objectGrants.memberPermissionDetailTitle", {
                name: detailGrant.objName,
              })
            : undefined
        }
        width="min(560px, calc(100vw - 24px))"
      >
        {detailGrant ? (
          <div className={styles.memberPermissionDetail}>
            <div className={styles.memberPermissionResource}>
              <strong>{detailGrant.objName}</strong>
              <small>
                {parentResourceName(detailGrant)
                  ? t("systemAdmin.objectGrants.memberParentResource", {
                      name: parentResourceName(detailGrant),
                    })
                  : t("systemAdmin.objectGrants.memberRootResource")}
              </small>
              <small>
                {t("systemAdmin.objectGrants.memberResourceIdentifier", { id: detailGrant.objId })}
              </small>
            </div>
            <p>{t("systemAdmin.objectGrants.memberPermissionDetailHint")}</p>
            <div className={styles.memberPermissionDecisionList}>
              {detailDecisions.map((decision) => (
                <div
                  className={styles.memberPermissionDecision}
                  key={`${decision.decision}:${decision.operation}`}
                >
                  <strong>{operationLabel(detailGrant.objType, decision.operation)}</strong>
                  <Tag color={decision.decision === "deny" ? "red" : "green"}>
                    {t(`systemAdmin.objectGrants.decision.${decision.decision}`)}
                  </Tag>
                  <small>{t(`systemAdmin.objectGrants.basis.${decision.basis ?? "direct"}`)}</small>
                  {decision.inheritedFrom ? (
                    <small>
                      {t("systemAdmin.objectGrants.memberInheritedFrom", {
                        name: decision.inheritedFrom.resource.id,
                      })}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
