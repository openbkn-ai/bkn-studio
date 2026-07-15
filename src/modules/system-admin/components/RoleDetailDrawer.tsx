/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Input, Space, Tag } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AdminRole } from "@/modules/system-admin/types/admin";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  operationLabel,
  resourceTypeLabel,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";

import appStyles from "@/modules/system-admin/scenes/admin.module.css";
import styles from "./RoleDetailDrawer.module.css";

type RoleDetailDrawerProps = {
  canEdit?: boolean;
  canManageMembers?: boolean;
  memberSummary?: { deptCount: number; userCount: number };
  onClose: () => void;
  onEdit?: () => void;
  onOpenMembers?: () => void;
  open: boolean;
  role: AdminRole;
};

function hasWildcard(role: AdminRole) {
  return role.permissions.some(
    (grant) => grant.resource.id === WILDCARD || grant.operations.includes("*"),
  );
}

export function RoleDetailDrawer({
  canEdit,
  canManageMembers,
  memberSummary,
  onClose,
  onEdit,
  onOpenMembers,
  open,
  role,
}: RoleDetailDrawerProps) {
  const { t, i18n } = useTranslation();
  const [grantSearch, setGrantSearch] = useState("");
  const grantQuery = grantSearch.trim().toLowerCase();

  const updatedTime = useMemo(() => {
    if (!role.updatedAt) {
      return "";
    }
    return new Intl.DateTimeFormat(i18n.language, {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(role.updatedAt)
      .replace(/\//g, "-");
  }, [i18n.language, role.updatedAt]);

  const grantsByType = useMemo(() => {
    const out = new Map<string, AdminRole["permissions"]>();
    role.permissions.forEach((grant) => {
      if (grantQuery) {
        const typeLabel = resourceTypeLabel(grant.resource.type);
        const opsLabel = grant.operations
          .map((op) => (op === "*" ? t("systemAdmin.grant.allOps") : operationLabel(grant.resource.type, op)))
          .join(" ");
        const scope = grant.resource.id === WILDCARD ? t("systemAdmin.grant.wholeType") : grant.resource.id;
        const haystack = `${grant.resource.type} ${typeLabel} ${scope} ${opsLabel}`.toLowerCase();
        if (!haystack.includes(grantQuery)) {
          return;
        }
      }
      const list = out.get(grant.resource.type) ?? [];
      list.push(grant);
      out.set(grant.resource.type, list);
    });
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [grantQuery, role.permissions, t]);

  const shownGrantCount = useMemo(
    () => grantsByType.reduce((sum, [, grants]) => sum + grants.length, 0),
    [grantsByType],
  );

  return (
    <Drawer
      className={styles.drawer}
      destroyOnClose
      onClose={onClose}
      open={open}
      rootClassName={appStyles.adminOverlay}
      extra={
        <Space size={8}>
          {canManageMembers ? (
            <AppButton onClick={onOpenMembers} size="small" type="default">
              {t("systemAdmin.roles.actions.members")}
            </AppButton>
          ) : null}
          {canEdit ? (
            <AppButton onClick={onEdit} size="small" type="primary">
              {t("systemAdmin.roles.actions.edit")}
            </AppButton>
          ) : null}
        </Space>
      }
      styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }}
      title={t("systemAdmin.roles.detail.title", { name: role.name })}
      width={640}
    >
      <div className={styles.content}>
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
          <div className={styles.summaryRow}>
            <Tag className={appStyles.roleTag}>
              {role.builtin ? t("systemAdmin.roles.builtin") : t("common.custom")}
            </Tag>
            {hasWildcard(role) ? (
              <Tag className={appStyles.permChip}>{t("systemAdmin.roles.detail.hasWildcard")}</Tag>
            ) : null}
            {updatedTime ? (
              <span className={styles.muted}>
                {t("systemAdmin.roles.detail.updatedAt", { time: updatedTime })}
              </span>
            ) : null}
          </div>
          {memberSummary ? (
            <div className={styles.muted} style={{ marginTop: 8 }}>
              {t("systemAdmin.roles.membersModal.memberUser")} {memberSummary.userCount} ·{" "}
              {t("systemAdmin.roles.membersModal.memberDept")} {memberSummary.deptCount}
            </div>
          ) : null}
          {role.description ? (
            <p className={styles.muted} style={{ margin: "10px 0 0" }}>
              {role.description}
            </p>
          ) : null}
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("systemAdmin.roles.columns.permissions")}</h3>
          {role.permissions.length === 0 ? (
            <p className={styles.muted} style={{ margin: 0 }}>{t("systemAdmin.grant.empty")}</p>
          ) : (
            <>
              <div className={styles.permissionToolbar}>
                <Input
                  allowClear
                  onChange={(event) => setGrantSearch(event.target.value)}
                  placeholder={t("systemAdmin.roles.detail.searchPlaceholder")}
                  value={grantSearch}
                />
                <span className={styles.muted}>
                  {t("systemAdmin.roles.detail.filteredCount", {
                    shown: shownGrantCount,
                    total: role.permissions.length,
                  })}
                </span>
              </div>
              <div className={styles.grantGroup}>
                {grantsByType.map(([type, grants]) => (
                  <div className={styles.grantTypeBlock} key={type}>
                    <div className={styles.grantTypeHead}>
                      <span className={styles.grantTypeName}>{resourceTypeLabel(type)}</span>
                      <span className={styles.grantTypeMeta}>
                        {t("systemAdmin.roles.detail.grantCount", { count: grants.length })}
                      </span>
                    </div>
                    <div className={styles.grantList}>
                      {grants.map((grant) => (
                        <div className={styles.grantItem} key={`${grant.resource.type}:${grant.resource.id}`}>
                          <span className={appStyles.slugChip}>
                            {grant.resource.id === WILDCARD ? t("systemAdmin.grant.wholeType") : grant.resource.id}
                          </span>
                          <div className={styles.grantOps}>
                            {grant.operations.map((op) => (
                              <Tag className={appStyles.permChip} key={op}>
                                {op === "*" ? t("systemAdmin.grant.allOps") : operationLabel(grant.resource.type, op)}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </Drawer>
  );
}

