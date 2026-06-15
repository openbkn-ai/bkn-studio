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
import { ResetPasswordModal } from "@/modules/system-admin/components/ResetPasswordModal";
import { UserFormDrawer } from "@/modules/system-admin/components/UserFormDrawer";
import {
  deleteDepartment,
  deleteUser,
  listDepartments,
  listRoles,
  listUsers,
  setUserEnabled,
  unfreezeUser,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  DeptTreeEntry,
} from "@/modules/system-admin/types/admin";
import {
  buildDeptTree,
  deptPath,
  deptUsers,
  rolesOfUser,
} from "@/modules/system-admin/utils/admin-helpers";

import styles from "./admin.module.css";

type StatusFilter = "" | "enabled" | "disabled" | "frozen";

function formatTime(value: number) {
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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

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

  const deptTree = useMemo(() => buildDeptTree(departments), [departments]);

  const filteredUsers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return users.filter((user) => {
      if (query) {
        const haystack = `${user.name} ${user.account} ${user.email}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (deptFilter && !user.deptIds.includes(deptFilter)) {
        return false;
      }
      if (statusFilter === "enabled" && (!user.enabled || user.frozen)) {
        return false;
      }
      if (statusFilter === "disabled" && user.enabled) {
        return false;
      }
      if (statusFilter === "frozen" && !user.frozen) {
        return false;
      }
      return true;
    });
  }, [deptFilter, keyword, statusFilter, users]);

  const statusTag = (user: AdminUser) => {
    if (user.frozen) {
      return (
        <Tag className={[styles.statusTag, styles.statusFrozen].join(" ")}>
          {t("systemAdmin.users.statusFrozen")}
        </Tag>
      );
    }
    return (
      <Tag
        className={[
          styles.statusTag,
          user.enabled ? styles.statusEnabled : styles.statusDisabled,
        ].join(" ")}
      >
        {user.enabled ? t("systemAdmin.users.statusEnabled") : t("systemAdmin.users.statusDisabled")}
      </Tag>
    );
  };

  const handleToggle = (user: AdminUser) => {
    if (user.enabled) {
      void modal.confirm({
        title: t("systemAdmin.users.disableUserTitle"),
        content: t("systemAdmin.users.disableUserConfirm", {
          name: user.name,
          account: user.account,
        }),
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
      dataIndex: "deptIds",
      render: (_, user) => (
        <span className={styles.modeText}>
          {deptPath(departments, user.deptIds[0]) || t("systemAdmin.users.noDepartment")}
        </span>
      ),
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
      title: t("systemAdmin.users.columns.position"),
      dataIndex: "position",
      render: (value: string) => (
        <span className={styles.modeText}>{value || t("systemAdmin.users.noDepartment")}</span>
      ),
    },
    {
      title: t("systemAdmin.users.columns.status"),
      key: "status",
      render: (_, user) => statusTag(user),
    },
    {
      title: t("systemAdmin.users.columns.updateTime"),
      dataIndex: "updatedAt",
      render: (value: number) => <span className={styles.subText}>{formatTime(value)}</span>,
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
            <AppButton
              className={styles.actionLink}
              onClick={() => setResetUser(user)}
              type="link"
            >
              {t("systemAdmin.users.actions.resetPassword")}
            </AppButton>
          </PermissionGate>
          {user.frozen ? (
            <PermissionGate permissions="admin-user:toggle">
              <AppButton
                className={styles.actionLink}
                onClick={() => {
                  void (async () => {
                    try {
                      await unfreezeUser(user.id);
                      message.success(t("systemAdmin.users.toast.unfrozen", { name: user.name }));
                      await loadData();
                    } catch (error) {
                      void message.error(extractRequestErrorMessage(error));
                    }
                  })();
                }}
                type="link"
              >
                {t("systemAdmin.users.actions.unfreeze")}
              </AppButton>
            </PermissionGate>
          ) : null}
          <PermissionGate permissions="admin-user:toggle">
            <AppButton
              className={styles.actionLink}
              onClick={() => handleToggle(user)}
              type="link"
            >
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

  const deptColumns: ColumnsType<DeptTreeEntry> = [
    {
      title: t("systemAdmin.users.columns.department"),
      key: "dept",
      render: (_, entry) => (
        <div className={styles.nameCell} style={{ paddingLeft: entry.depth * 24 }}>
          <span className={styles.nameTitle}>
            {entry.depth ? <span className={styles.treeIndent}>└</span> : null}
            {entry.dept.name}
          </span>
          {entry.dept.code ? <span className={styles.slugChip}>{entry.dept.code}</span> : null}
        </div>
      ),
    },
    {
      title: t("systemAdmin.users.columns.manager"),
      key: "manager",
      render: (_, entry) => {
        const manager = entry.dept.managerId
          ? users.find((user) => user.id === entry.dept.managerId)
          : null;
        return <span className={styles.modeText}>{manager?.name ?? "—"}</span>;
      },
    },
    {
      title: t("systemAdmin.users.columns.memberCount"),
      key: "members",
      render: (_, entry) => (
        <span className={styles.modeText}>{deptUsers(users, entry.dept.id).length}</span>
      ),
    },
    {
      title: t("systemAdmin.users.columns.remark"),
      key: "remark",
      render: (_, entry) => (
        <span className={styles.subText}>{entry.dept.remark || "—"}</span>
      ),
    },
    {
      title: t("systemAdmin.users.columns.actions"),
      key: "actions",
      render: (_, entry) => (
        <Space className={styles.actionGroup}>
          <PermissionGate permissions="admin-dept:create">
            <AppButton
              className={styles.actionLink}
              onClick={() =>
                setDeptDrawer({ department: null, open: true, presetParentId: entry.dept.id })
              }
              type="link"
            >
              {t("systemAdmin.users.actions.addChild")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-dept:edit">
            <AppButton
              className={styles.actionLink}
              onClick={() => setDeptDrawer({ department: entry.dept, open: true })}
              type="link"
            >
              {t("systemAdmin.users.actions.edit")}
            </AppButton>
          </PermissionGate>
          {entry.dept.parentId ? (
            <PermissionGate permissions="admin-dept:delete">
              <AppButton
                className={[styles.actionLink, styles.actionDanger].join(" ")}
                danger
                onClick={() => {
                  void modal.confirm({
                    title: t("systemAdmin.users.deleteDeptTitle"),
                    content: t("systemAdmin.users.deleteDeptConfirm", { name: entry.dept.name }),
                    okText: t("common.delete"),
                    cancelText: t("common.cancel"),
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      try {
                        await deleteDepartment(entry.dept.id);
                        message.success(
                          t("systemAdmin.users.toast.deptDeleted", { name: entry.dept.name }),
                        );
                        await loadData();
                      } catch (error) {
                        void message.error(extractRequestErrorMessage(error));
                      }
                    },
                  });
                }}
                type="link"
              >
                {t("systemAdmin.users.actions.delete")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </Space>
      ),
    },
  ];

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
            {tab === "depts" ? (
              <span className={styles.toolbarMeta}>{t("systemAdmin.users.deptToolbarHint")}</span>
            ) : null}
          </div>
          {tab === "users" ? (
            <div className={styles.toolbarFilters}>
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
                options={deptTree.map(({ dept, depth }) => ({
                  label: `${"　".repeat(depth)}${dept.name}`,
                  value: dept.id,
                }))}
                placeholder={t("systemAdmin.users.deptFilterAll")}
                value={deptFilter}
              />
              <Select
                className={styles.filterSelect}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { label: t("systemAdmin.users.statusAll"), value: "" },
                  { label: t("systemAdmin.users.statusEnabled"), value: "enabled" },
                  { label: t("systemAdmin.users.statusDisabled"), value: "disabled" },
                  { label: t("systemAdmin.users.statusFrozen"), value: "frozen" },
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
          ) : (
            <AppTable<DeptTreeEntry>
              columns={deptColumns}
              dataSource={deptTree}
              loading={loading}
              locale={{ emptyText: t("systemAdmin.users.emptyDepts") }}
              pagination={false}
              rowKey={(entry) => entry.dept.id}
            />
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
        users={users}
      />
      {resetUser ? (
        <ResetPasswordModal onClose={() => setResetUser(null)} open={Boolean(resetUser)} user={resetUser} />
      ) : null}
    </>
  );
}
