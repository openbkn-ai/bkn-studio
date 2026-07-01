/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Space, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { DepartmentFormDrawer } from "@/modules/system-admin/components/DepartmentFormDrawer";
import { DepartmentTree } from "@/modules/system-admin/components/DepartmentTree";
import { DeptMembersModal } from "@/modules/system-admin/components/DeptMembersModal";
import { ResetPasswordModal } from "@/modules/system-admin/components/ResetPasswordModal";
import { UserFormDrawer } from "@/modules/system-admin/components/UserFormDrawer";
import {
  DEFAULT_NEW_USER_PASSWORD,
  deleteDepartment,
  deleteUser,
  listDepartmentMemberIds,
  listDepartments,
  listRoles,
  listUsers,
  setUserEnabled,
  updateDepartment,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
} from "@/modules/system-admin/types/admin";
import { buildDeptTree, rolesOfUser } from "@/modules/system-admin/utils/admin-helpers";

import styles from "./admin.module.css";

type StatusFilter = "" | "enabled" | "disabled";

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

export function UserManagementScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [tab, setTab] = useState<"users" | "depts">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  // deptId -> member user ids（部门视角；用户的部门归属由此反查）。
  const [deptMembers, setDeptMembers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [deptFilter, setDeptFilter] = useState<string>();

  const [userDrawer, setUserDrawer] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [deptDrawer, setDeptDrawer] = useState<{
    department: AdminDepartment | null;
    open: boolean;
    presetParentId?: string;
  }>({ department: null, open: false });
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [membersDept, setMembersDept] = useState<AdminDepartment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [userList, deptList, roleList] = await Promise.all([
        listUsers(),
        listDepartments(),
        listRoles(),
      ]);
      setUsers(userList);
      setDepartments(deptList);
      setRoles(roleList);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 成员数单独、非阻塞加载——成员接口慢/挂也不卡住整张表；逐部门各自容错。
  useEffect(() => {
    if (!departments.length) {
      setDeptMembers({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      departments.map(async (dept) => {
        try {
          return [dept.id, await listDepartmentMemberIds(dept.id)] as const;
        } catch {
          return [dept.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setDeptMembers(Object.fromEntries(entries));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [departments]);

  const deptTree = useMemo(() => buildDeptTree(departments), [departments]);
  const deptNameById = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept.name])),
    [departments],
  );
  // userId -> deptIds（由 deptMembers 反查）。
  const deptsByUser = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [deptId, ids] of Object.entries(deptMembers)) {
      for (const userId of ids) {
        (map[userId] ??= []).push(deptId);
      }
    }
    return map;
  }, [deptMembers]);

  const filteredUsers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return users.filter((user) => {
      if (query && !`${user.name} ${user.account} ${user.email}`.toLowerCase().includes(query)) {
        return false;
      }
      if (statusFilter === "enabled" && !user.enabled) {
        return false;
      }
      if (statusFilter === "disabled" && user.enabled) {
        return false;
      }
      if (deptFilter && !(deptsByUser[user.id] ?? []).includes(deptFilter)) {
        return false;
      }
      return true;
    });
  }, [deptFilter, deptsByUser, keyword, statusFilter, users]);

  const handleToggle = (user: AdminUser) => {
    if (user.enabled) {
      void modal.confirm({
        title: t("systemAdmin.users.disableUserTitle"),
        content: t("systemAdmin.users.disableUserConfirm", { name: user.name, account: user.account }),
        okText: t("systemAdmin.users.disableUser"),
        cancelText: t("common.cancel"),
        onOk: async () => {
          try {
            await setUserEnabled(user.id, false);
            message.success(t("systemAdmin.users.toast.disabled", { name: user.name }));
            await loadData();
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          }
        },
      });
      return;
    }
    void (async () => {
      try {
        await setUserEnabled(user.id, true);
        message.success(t("systemAdmin.users.toast.enabled", { name: user.name }));
        await loadData();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  };

  const userColumns: ColumnsType<AdminUser> = [
    {
      title: t("systemAdmin.users.columns.user"),
      dataIndex: "name",
      render: (_, user) => (
        <div className={styles.nameCell}>
          <span className={styles.nameTitle}>
            {user.name}
            {user.builtin ? <Tag>{t("systemAdmin.users.builtin")}</Tag> : null}
          </span>
          <span className={styles.subText}>
            {user.account}
            {user.email ? ` · ${user.email}` : ""}
          </span>
        </div>
      ),
    },
    {
      title: t("systemAdmin.users.columns.department"),
      key: "department",
      render: (_, user) => {
        const ids = deptsByUser[user.id] ?? [];
        if (!ids.length) {
          return <span className={styles.mutedText}>—</span>;
        }
        return (
          <span className={styles.chipRow}>
            {ids.map((id) => (
              <Tag className={styles.permChip} key={id}>
                {deptNameById.get(id) ?? id}
              </Tag>
            ))}
          </span>
        );
      },
    },
    {
      title: t("systemAdmin.users.columns.roles"),
      key: "roles",
      render: (_, user) => {
        const userRoles = rolesOfUser(roles, user.id);
        if (!userRoles.length) {
          return <span className={styles.mutedText}>{t("systemAdmin.users.rolesEmpty")}</span>;
        }
        return (
          <span className={styles.chipRow}>
            {userRoles.map((role) => (
              <Tag className={styles.roleTag} key={role.id}>
                {role.name}
              </Tag>
            ))}
          </span>
        );
      },
    },
    {
      title: t("systemAdmin.users.columns.status"),
      key: "status",
      render: (_, user) => (
        <Tag
          className={[
            styles.statusTag,
            user.enabled ? styles.statusEnabled : styles.statusDisabled,
          ].join(" ")}
        >
          {user.enabled ? t("systemAdmin.users.statusEnabled") : t("systemAdmin.users.statusDisabled")}
        </Tag>
      ),
    },
    {
      title: t("systemAdmin.users.columns.updateTime"),
      dataIndex: "updatedAt",
      render: (value?: number) => <span className={styles.subText}>{formatTime(value)}</span>,
    },
    {
      title: t("systemAdmin.users.columns.actions"),
      key: "actions",
      render: (_, user) => (
        <Space className={styles.actionGroup}>
          <PermissionGate permissions="admin-user:edit">
            <AppButton
              className={styles.actionLink}
              onClick={() => setUserDrawer({ open: true, user })}
              type="link"
            >
              {t("systemAdmin.users.actions.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-user:reset-password">
            <AppButton className={styles.actionLink} onClick={() => setResetUser(user)} type="link">
              {t("systemAdmin.users.actions.resetPassword")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-user:toggle">
            <AppButton className={styles.actionLink} onClick={() => handleToggle(user)} type="link">
              {user.enabled
                ? t("systemAdmin.users.actions.disable")
                : t("systemAdmin.users.actions.enable")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-user:delete">
            <AppButton
              className={[styles.actionLink, styles.actionDanger].join(" ")}
              danger
              onClick={() => {
                void modal.confirm({
                  title: t("systemAdmin.users.deleteUserTitle"),
                  content: t("systemAdmin.users.deleteUserConfirm", {
                    name: user.name,
                    account: user.account,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteUser(user.id);
                    message.success(t("systemAdmin.users.toast.userDeleted", { name: user.name }));
                    await loadData();
                  },
                });
              }}
              type="link"
            >
              {t("systemAdmin.users.actions.delete")}
            </AppButton>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  const handleDeleteDept = (dept: AdminDepartment) => {
    void modal.confirm({
      title: t("systemAdmin.users.deleteDeptTitle"),
      content: t("systemAdmin.users.deleteDeptConfirm", { name: dept.name }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDepartment(dept.id);
          message.success(t("systemAdmin.users.toast.deptDeleted", { name: dept.name }));
          await loadData();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  const handleReparent = (dragId: string, newParentId: string | null) => {
    const dept = departments.find((item) => item.id === dragId);
    if (!dept) {
      return;
    }
    void (async () => {
      try {
        await updateDepartment(dragId, { name: dept.name, parentId: newParentId, type: dept.type });
        message.success(t("systemAdmin.users.toast.deptSaved"));
        await loadData();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  };

  return (
    <>
      <section className={styles.contentSurface}>
        <Tabs
          activeKey={tab}
          className={styles.tabsRow}
          items={[
            { key: "users", label: `${t("systemAdmin.users.tabUsers")} (${users.length})` },
            { key: "depts", label: `${t("systemAdmin.users.tabDepts")} (${departments.length})` },
          ]}
          onChange={(key) => setTab(key as "users" | "depts")}
        />
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              {tab === "users" ? (
                <PermissionGate permissions="admin-user:create">
                  <AppButton
                    icon={<PlusOutlined />}
                    onClick={() => setUserDrawer({ open: true, user: null })}
                    type="primary"
                  >
                    {t("systemAdmin.users.createUser")}
                  </AppButton>
                </PermissionGate>
              ) : (
                <PermissionGate permissions="admin-dept:create">
                  <AppButton
                    icon={<PlusOutlined />}
                    onClick={() => setDeptDrawer({ department: null, open: true })}
                    type="primary"
                  >
                    {t("systemAdmin.users.createDept")}
                  </AppButton>
                </PermissionGate>
              )}
              <AppButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  void loadData();
                  message.info(t("systemAdmin.users.toast.refreshed"));
                }}
              >
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>
              {tab === "depts"
                ? t("systemAdmin.users.deptToolbarHint")
                : t("systemAdmin.users.userToolbarHint", { password: DEFAULT_NEW_USER_PASSWORD })}
            </span>
          </div>
          {tab === "users" ? (
            <div className={[styles.toolbarFilters, styles.filtersInline].join(" ")}>
              <Input.Search
                allowClear
                className={styles.searchInput}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t("systemAdmin.users.searchPlaceholder")}
                value={keyword}
              />
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setDeptFilter(value)}
                optionFilterProp="label"
                options={deptTree.map(({ dept, depth }) => ({
                  label: `${"　".repeat(depth)}${dept.name}`,
                  value: dept.id,
                }))}
                placeholder={t("systemAdmin.users.deptFilterAll")}
                showSearch
                value={deptFilter}
              />
              <Select
                className={styles.filterSelect}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { label: t("systemAdmin.users.statusAll"), value: "" },
                  { label: t("systemAdmin.users.statusEnabled"), value: "enabled" },
                  { label: t("systemAdmin.users.statusDisabled"), value: "disabled" },
                ]}
                value={statusFilter}
              />
            </div>
          ) : null}
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
          ) : tab === "users" ? (
            <AppTable<AdminUser>
              columns={userColumns}
              dataSource={filteredUsers}
              loading={loading}
              locale={{ emptyText: t("systemAdmin.users.emptyUsers") }}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              rowKey="id"
            />
          ) : departments.length ? (
            <>
              <p className={styles.deptDragHint}>{t("systemAdmin.users.deptNode.dragHint")}</p>
              <DepartmentTree
                deptMembers={deptMembers}
                departments={departments}
                onAddChild={(parentId) =>
                  setDeptDrawer({ department: null, open: true, presetParentId: parentId })
                }
                onDelete={handleDeleteDept}
                onEdit={(dept) => setDeptDrawer({ department: dept, open: true })}
                onMembers={(dept) => setMembersDept(dept)}
                onReparent={handleReparent}
              />
            </>
          ) : (
            <p className={styles.mutedText}>{t("systemAdmin.users.emptyDepts")}</p>
          )}
        </div>
      </section>

      <UserFormDrawer
        departments={departments}
        onClose={() => setUserDrawer({ open: false, user: null })}
        onSaved={loadData}
        open={userDrawer.open}
        roles={roles}
        user={userDrawer.user}
      />
      <DepartmentFormDrawer
        department={deptDrawer.department}
        departments={departments}
        onClose={() => setDeptDrawer({ department: null, open: false })}
        onSaved={loadData}
        open={deptDrawer.open}
        presetParentId={deptDrawer.presetParentId}
      />
      {resetUser ? (
        <ResetPasswordModal onClose={() => setResetUser(null)} open={Boolean(resetUser)} user={resetUser} />
      ) : null}
      {membersDept ? (
        <DeptMembersModal
          department={membersDept}
          departments={departments}
          onChanged={loadData}
          onClose={() => setMembersDept(null)}
          open={Boolean(membersDept)}
          users={users}
        />
      ) : null}
    </>
  );
}
