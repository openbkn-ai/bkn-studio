/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { RoleFormDrawer } from "@/modules/system-admin/components/RoleFormDrawer";
import { RoleMembersModal } from "@/modules/system-admin/components/RoleMembersModal";
import {
  deleteRole,
  listDepartments,
  listRoles,
  listUsers,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
} from "@/modules/system-admin/types/admin";
import {
  operationLabel,
  resourceTypeLabel,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "./admin.module.css";

// 超级管理员（最高权限角色）：不可修改，编辑禁用。兼容真实(中文名)与 mock(slug)。
function isSuperAdminRole(role: AdminRole) {
  return role.name === "超级管理员" || role.name === "super_admin";
}

function formatTime(value?: number) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

export function RoleManagementScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [roleDrawer, setRoleDrawer] = useState<{ open: boolean; role: AdminRole | null }>({
    open: false,
    role: null,
  });
  const [membersRole, setMembersRole] = useState<AdminRole | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [roleList, userList, deptList] = await Promise.all([
        listRoles(),
        listUsers(),
        listDepartments(),
      ]);
      setRoles(roleList);
      setUsers(userList);
      setDepartments(deptList);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (membersRole) {
      const next = roles.find((role) => role.id === membersRole.id);
      if (next && next !== membersRole) {
        setMembersRole(next);
      }
    }
  }, [membersRole, roles]);

  const filteredRoles = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return roles;
    }
    return roles.filter((role) =>
      `${role.name} ${role.description}`.toLowerCase().includes(query),
    );
  }, [keyword, roles]);

  const grantSummary = (role: AdminRole) =>
    role.permissions
      .map((grant) => {
        const scope =
          grant.resource.id === WILDCARD
            ? t("systemAdmin.grant.wholeType")
            : grant.resource.id;
        const ops = grant.operations
          .map((op) => (op === "*" ? t("systemAdmin.grant.allOps") : operationLabel(grant.resource.type, op)))
          .join("、");
        return `${resourceTypeLabel(grant.resource.type)}（${scope}）: ${ops}`;
      })
      .join("\n");

  const columns: ColumnsType<AdminRole> = [
    {
      title: t("systemAdmin.roles.columns.role"),
      dataIndex: "name",
      render: (_, role) => (
        <div className={styles.nameCell}>
          <span className={styles.nameTitle}>
            {role.name}
            {role.builtin ? <Tag>{t("systemAdmin.roles.builtin")}</Tag> : null}
          </span>
          {role.description ? <span className={styles.subText}>{role.description}</span> : null}
        </div>
      ),
    },
    {
      title: t("systemAdmin.roles.columns.permissions"),
      key: "permissions",
      render: (_, role) => {
        if (!role.permissions.length) {
          return <span className={styles.mutedText}>{t("systemAdmin.grant.empty")}</span>;
        }
        const shown = role.permissions.slice(0, 3);
        const more = role.permissions.length - shown.length;
        return (
          <Tooltip title={<span style={{ whiteSpace: "pre-line" }}>{grantSummary(role)}</span>}>
            <span className={styles.chipRow}>
              {shown.map((grant, index) => (
                <Tag className={styles.permChip} key={`${grant.resource.type}:${grant.resource.id}:${index}`}>
                  {resourceTypeLabel(grant.resource.type)}
                  {grant.resource.id === WILDCARD ? "" : ` · ${grant.resource.id}`}
                </Tag>
              ))}
              {more > 0 ? <Tag className={styles.permChip}>+{more}</Tag> : null}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: t("systemAdmin.roles.columns.members"),
      key: "members",
      render: (_, role) => <span className={styles.modeText}>{role.accessorIds.length}</span>,
    },
    {
      title: t("systemAdmin.roles.columns.updateTime"),
      dataIndex: "updatedAt",
      render: (value?: number) => <span className={styles.subText}>{formatTime(value)}</span>,
    },
    {
      title: t("systemAdmin.roles.columns.actions"),
      key: "actions",
      render: (_, role) => (
        <Space className={styles.actionGroup}>
          <PermissionGate permissions="admin-role:members">
            <AppButton className={styles.actionLink} onClick={() => setMembersRole(role)} type="link">
              {t("systemAdmin.roles.actions.members")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-role:edit">
            {isSuperAdminRole(role) ? (
              <Tooltip title={t("systemAdmin.roles.superAdminLocked")}>
                <AppButton className={styles.actionLink} disabled type="link">
                  {t("systemAdmin.roles.actions.edit")}
                </AppButton>
              </Tooltip>
            ) : (
              <AppButton
                className={styles.actionLink}
                onClick={() => setRoleDrawer({ open: true, role })}
                type="link"
              >
                {role.builtin ? t("common.detail") : t("systemAdmin.roles.actions.edit")}
              </AppButton>
            )}
          </PermissionGate>
          {!role.builtin ? (
            <PermissionGate permissions="admin-role:delete">
              <AppButton
                className={[styles.actionLink, styles.actionDanger].join(" ")}
                danger
                onClick={() => {
                  void modal.confirm({
                    title: t("systemAdmin.roles.deleteTitle"),
                    content: role.accessorIds.length
                      ? t("systemAdmin.roles.deleteConfirmWithMembers", {
                          name: role.name,
                          count: role.accessorIds.length,
                        })
                      : t("systemAdmin.roles.deleteConfirm", { name: role.name }),
                    okText: t("common.delete"),
                    cancelText: t("common.cancel"),
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      try {
                        await deleteRole(role.id);
                        message.success(t("systemAdmin.roles.toast.deleted"));
                        await loadData();
                      } catch (error) {
                        void message.error(extractRequestErrorMessage(error));
                      }
                    },
                  });
                }}
                type="link"
              >
                {t("systemAdmin.roles.actions.delete")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <PermissionGate permissions="admin-role:create">
                <AppButton
                  icon={<PlusOutlined />}
                  onClick={() => setRoleDrawer({ open: true, role: null })}
                  type="primary"
                >
                  {t("systemAdmin.roles.create")}
                </AppButton>
              </PermissionGate>
              <AppButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  void loadData();
                  message.info(t("systemAdmin.roles.toast.refreshed"));
                }}
              >
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>{t("systemAdmin.roles.description")}</span>
          </div>
          <div className={styles.toolbarFilters}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("systemAdmin.roles.searchPlaceholder")}
              value={keyword}
            />
          </div>
        </div>
        <div className={styles.tableSurface}>
          {loadError ? (
            <Alert
              action={
                <AppButton onClick={() => void loadData()} type="link">
                  {t("common.retry")}
                </AppButton>
              }
              message={loadError}
              showIcon
              type="error"
            />
          ) : (
            <AppTable<AdminRole>
              columns={columns}
              dataSource={filteredRoles}
              loading={loading}
              locale={{ emptyText: t("systemAdmin.roles.empty") }}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              rowKey="id"
            />
          )}
        </div>
      </section>

      <RoleFormDrawer
        onClose={() => setRoleDrawer({ open: false, role: null })}
        onSaved={loadData}
        open={roleDrawer.open}
        role={roleDrawer.role}
      />
      {membersRole ? (
        <RoleMembersModal
          departments={departments}
          onChanged={loadData}
          onClose={() => setMembersRole(null)}
          open={Boolean(membersRole)}
          role={membersRole}
          users={users}
        />
      ) : null}
    </>
  );
}
