/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Input, Select, Space, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { DepartmentFormDrawer } from "@/modules/system-admin/components/DepartmentFormDrawer";
import { DepartmentNavTree } from "@/modules/system-admin/components/DepartmentNavTree";
import { DeptMembersModal } from "@/modules/system-admin/components/DeptMembersModal";
import { ResetPasswordModal } from "@/modules/system-admin/components/ResetPasswordModal";
import { UserFormDrawer } from "@/modules/system-admin/components/UserFormDrawer";
import { UserRolesDrawer } from "@/modules/system-admin/components/UserRolesDrawer";
import {
  deleteDepartment,
  deleteUser,
  listDepartments,
  listRoles,
  listUsersPage,
  setUserEnabled,
  updateDepartment,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminRole, AdminUser } from "@/modules/system-admin/types/admin";
import { departmentInputFrom } from "@/modules/system-admin/utils/admin-helpers";
import { buildAuditLogHref } from "@/modules/system-admin/utils/audit-log-url";
import { extractSystemAdminErrorMessage } from "@/modules/system-admin/utils/system-admin-error-message";
import {
  applyUserManagementFilters,
  readUserManagementFilters,
  type UserManagementStatusFilter,
} from "@/modules/system-admin/utils/user-management-url";

import styles from "./admin.module.css";
import layoutStyles from "./UserManagementScene.module.css";

type StatusFilter = UserManagementStatusFilter;

function formatTime(value: number | undefined, locale: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
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

function renderSummaryNameList(
  names: string[] | undefined,
  empty: ReactNode,
  moreLabel: (preview: string, count: number) => string,
  maxVisible = 2,
) {
  if (!names?.length) {
    return empty;
  }
  const fullText = names.join("、");
  const preview =
    names.length <= maxVisible ? fullText : moreLabel(names.slice(0, maxVisible).join("、"), names.length);
  return (
    <Tooltip title={fullText}>
      <span className={layoutStyles.ellipsisCell}>{preview}</span>
    </Tooltip>
  );
}

export function UserManagementScene() {
  const { t, i18n } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const userPermissions = runtimeConfig.currentUser.permissions;
  const canEditUser = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: "admin-user:edit",
  });
  const canResetPassword = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: "admin-user:reset-password",
  });
  const canToggleUser = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: "admin-user:toggle",
  });
  const canDeleteUser = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: "admin-user:delete",
  });
  const canViewAudit = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: "admin-audit:view",
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => readUserManagementFilters(searchParams), [searchParams]);
  const selectedDeptId = urlFilters.deptId;
  const statusFilter = urlFilters.status;
  const roleFilter = urlFilters.roleId;
  const pageState = useMemo(
    () => ({ page: urlFilters.page, pageSize: urlFilters.pageSize }),
    [urlFilters.page, urlFilters.pageSize],
  );

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalAllUsers, setTotalAllUsers] = useState(0);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keywordDraft, setKeywordDraft] = useState(urlFilters.keyword);
  const debouncedKeyword = useDebouncedValue(keywordDraft.trim());
  const tableSectionRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(360);
  const usersRequestSeq = useRef(0);

  const [userDrawer, setUserDrawer] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [rolesUser, setRolesUser] = useState<AdminUser | null>(null);
  const [deptDrawer, setDeptDrawer] = useState<{
    department: AdminDepartment | null;
    open: boolean;
    presetParentId?: string;
  }>({ department: null, open: false });
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [membersDept, setMembersDept] = useState<AdminDepartment | null>(null);

  const selectedDepartment = useMemo(
    () => (selectedDeptId ? departments.find((dept) => dept.id === selectedDeptId) ?? null : null),
    [departments, selectedDeptId],
  );

  const updateUrlFilters = useCallback(
    (patch: Partial<typeof urlFilters>) => {
      setSearchParams(
        (prev) =>
          applyUserManagementFilters(prev, {
            ...readUserManagementFilters(prev),
            ...patch,
          }),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const listQuery = useMemo(
    () => ({
      search: urlFilters.keyword || undefined,
      enabled:
        statusFilter === "enabled" ? true : statusFilter === "disabled" ? false : undefined,
      departmentId: selectedDeptId ?? undefined,
      includeSubtree: Boolean(selectedDeptId),
      roleId: roleFilter || undefined,
      offset: (pageState.page - 1) * pageState.pageSize,
      limit: pageState.pageSize,
    }),
    [
      pageState.page,
      pageState.pageSize,
      roleFilter,
      selectedDeptId,
      statusFilter,
      urlFilters.keyword,
    ],
  );

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [deptList, roleList, allUsersCount] = await Promise.all([
        listDepartments(),
        listRoles(),
        listUsersPage({ offset: 0, limit: 1 }),
      ]);
      setDepartments(deptList);
      setRoles(roleList);
      setTotalAllUsers(allUsersCount.total);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadUsersPage = useCallback(async () => {
    const requestSeq = ++usersRequestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listUsersPage(listQuery);
      if (requestSeq !== usersRequestSeq.current) {
        return;
      }
      setUsers(result.users);
      setTotalUsers(result.total);
    } catch (error) {
      if (requestSeq !== usersRequestSeq.current) {
        return;
      }
      setUsers([]);
      setTotalUsers(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      if (requestSeq === usersRequestSeq.current) {
        setLoading(false);
      }
    }
  }, [listQuery]);

  const reloadUsers = useCallback(async () => {
    await loadUsersPage();
  }, [loadUsersPage]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadMeta(), loadUsersPage()]);
  }, [loadMeta, loadUsersPage]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadUsersPage();
  }, [loadUsersPage]);

  useEffect(() => {
    setKeywordDraft(urlFilters.keyword);
  }, [urlFilters.keyword]);

  useEffect(() => {
    if (debouncedKeyword === urlFilters.keyword) {
      return;
    }
    updateUrlFilters({ keyword: debouncedKeyword, page: 1 });
  }, [debouncedKeyword, updateUrlFilters, urlFilters.keyword]);

  useLayoutEffect(() => {
    const element = tableSectionRef.current;
    if (!element) {
      return;
    }
    const updateHeight = () => {
      setTableScrollY(Math.max(240, element.clientHeight - 4));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedDeptId || !departments.length) {
      return;
    }
    if (!departments.some((dept) => dept.id === selectedDeptId)) {
      updateUrlFilters({ deptId: null, page: 1 });
    }
  }, [departments, selectedDeptId, updateUrlFilters]);

  const handleSelectDept = useCallback(
    (deptId: string | null) => {
      updateUrlFilters({ deptId, page: 1 });
    },
    [updateUrlFilters],
  );

  const setPagination = useCallback(
    (page: number, pageSize: number) => {
      updateUrlFilters({ page, pageSize });
    },
    [updateUrlFilters],
  );

  const handleDeleteUser = useCallback(
    (user: AdminUser) => {
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
          await reloadAll();
        },
      });
    },
    [message, modal, reloadAll, t],
  );

  const handleToggle = useCallback(
    (user: AdminUser) => {
      if (user.builtin) {
        return;
      }
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
              await reloadUsers();
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
          await reloadUsers();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      })();
    },
    [message, modal, reloadUsers, t],
  );

  const buildUserMoreMenu = useCallback(
    (user: AdminUser): MenuProps => {
      const items: NonNullable<MenuProps["items"]> = [];

      if (canResetPassword) {
        items.push({
          key: "resetPassword",
          label: t("systemAdmin.users.actions.resetPassword"),
        });
      }
      if (canToggleUser) {
        items.push({
          disabled: user.builtin,
          key: "toggle",
          label: user.enabled
            ? t("systemAdmin.users.actions.disable")
            : t("systemAdmin.users.actions.enable"),
        });
      }
      if (canDeleteUser) {
        items.push({
          danger: true,
          disabled: user.builtin,
          key: "delete",
          label: t("systemAdmin.users.actions.delete"),
        });
      }
      if (canViewAudit) {
        items.push({
          key: "auditLogs",
          label: t("systemAdmin.users.actions.viewAuditLogs"),
        });
      }

      return {
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === "resetPassword") {
            setResetUser(user);
            return;
          }
          if (key === "toggle") {
            handleToggle(user);
            return;
          }
          if (key === "delete") {
            handleDeleteUser(user);
            return;
          }
          if (key === "auditLogs") {
            void navigate(buildAuditLogHref(user.id));
          }
        },
      };
    },
    [canDeleteUser, canResetPassword, canToggleUser, canViewAudit, handleDeleteUser, handleToggle, navigate, t],
  );

  const muted = <span className={styles.mutedText}>—</span>;

  const userColumns: ColumnsType<AdminUser> = [
    {
      title: t("systemAdmin.users.columns.user"),
      key: "user",
      width: 200,
      render: (_, user) => (
        <div className={styles.nameCell}>
          <span className={styles.nameTitle}>
            {user.name}
            {user.builtin ? `（${t("systemAdmin.users.builtin")}）` : ""}
          </span>
          <span className={styles.subText}>
            {user.account}
            {user.email ? ` · ${user.email}` : ""}
          </span>
        </div>
      ),
    },
    {
      title: t("systemAdmin.users.columns.telephone"),
      dataIndex: "telephone",
      width: 120,
      render: (value: string) => value?.trim() || muted,
    },
    {
      title: t("systemAdmin.users.columns.department"),
      key: "department",
      width: 148,
      ellipsis: true,
      render: (_, user) =>
        renderSummaryNameList(user.departmentNames, muted, (preview, count) =>
          t("systemAdmin.users.nameListMore", { preview, count }),
        ),
    },
    {
      title: t("systemAdmin.users.columns.roles"),
      key: "roles",
      width: 168,
      ellipsis: true,
      render: (_, user) =>
        renderSummaryNameList(
          user.roleNames,
          <span className={styles.mutedText}>{t("systemAdmin.users.rolesEmpty")}</span>,
          (preview, count) => t("systemAdmin.users.nameListMore", { preview, count }),
        ),
    },
    {
      title: t("systemAdmin.users.columns.status"),
      key: "status",
      width: 88,
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
      width: 132,
      render: (value?: number) => (
        <span className={styles.subText}>{formatTime(value, i18n.language)}</span>
      ),
    },
    {
      title: t("systemAdmin.users.columns.actions"),
      key: "actions",
      width: 148,
      fixed: "right",
      render: (_, user) => {
        const moreMenu = buildUserMoreMenu(user);
        const hasMoreActions = Boolean(moreMenu.items?.length);

        return (
          <Space className={styles.actionGroup} size={4}>
            {canEditUser ? (
              <AppButton
                className={styles.actionLink}
                onClick={() => setUserDrawer({ open: true, user })}
                type="link"
              >
                {t("systemAdmin.users.actions.edit")}
              </AppButton>
            ) : null}
            {canEditUser ? (
              <AppButton className={styles.actionLink} onClick={() => setRolesUser(user)} type="link">
                {t("systemAdmin.users.actions.configureRoles")}
              </AppButton>
            ) : null}
            {hasMoreActions ? (
              <Dropdown menu={moreMenu} trigger={["click"]}>
                <AppButton
                  className={styles.actionLink}
                  onClick={(event) => event.stopPropagation()}
                  type="link"
                >
                  {t("systemAdmin.users.actions.more")}
                  <DownOutlined className={layoutStyles.moreIcon} />
                </AppButton>
              </Dropdown>
            ) : null}
          </Space>
        );
      },
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
          if (selectedDeptId === dept.id) {
            updateUrlFilters({ deptId: null, page: 1 });
          }
          await reloadAll();
        } catch (error) {
          void message.error(extractSystemAdminErrorMessage(error));
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
        await updateDepartment(dragId, { ...departmentInputFrom(dept), parentId: newParentId });
        message.success(t("systemAdmin.users.toast.deptSaved"));
        await reloadAll();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  };

  const roleFilterOptions = useMemo(
    () => [
      { label: t("systemAdmin.users.roleAll"), value: "" },
      ...roles.map((role) => ({ label: role.name, value: role.id })),
    ],
    [roles, t],
  );

  return (
    <>
      <section className={[styles.contentSurface, layoutStyles.pageSurface].join(" ")}>
        <div className={layoutStyles.explorer}>
          <aside className={layoutStyles.deptPanel}>
            <div className={layoutStyles.deptTreeWrap}>
              {departments.length ? (
                <DepartmentNavTree
                  departments={departments}
                  headerPrimaryAction={
                    <PermissionGate permissions="admin-dept:create">
                      <AppButton
                        icon={<PlusOutlined />}
                        onClick={() =>
                          setDeptDrawer({
                            department: null,
                            open: true,
                            presetParentId: selectedDeptId ?? undefined,
                          })
                        }
                        size="small"
                        type="primary"
                      >
                        {selectedDepartment
                          ? t("systemAdmin.users.actions.addChild")
                          : t("systemAdmin.users.createDept")}
                      </AppButton>
                    </PermissionGate>
                  }
                  headerSecondaryActions={
                    selectedDepartment ? (
                      <div className={layoutStyles.deptActionRowSecondary}>
                        <PermissionGate permissions="admin-dept:edit">
                          <AppButton
                            className={styles.actionLink}
                            onClick={() => setDeptDrawer({ department: selectedDepartment, open: true })}
                            size="small"
                            type="link"
                          >
                            {t("systemAdmin.users.actions.edit")}
                          </AppButton>
                        </PermissionGate>
                        <PermissionGate permissions="admin-dept:members">
                          <AppButton
                            className={styles.actionLink}
                            onClick={() => setMembersDept(selectedDepartment)}
                            size="small"
                            type="link"
                          >
                            {t("systemAdmin.users.actions.members")}
                          </AppButton>
                        </PermissionGate>
                        <PermissionGate permissions="admin-dept:delete">
                          <AppButton
                            className={[styles.actionLink, styles.actionDanger].join(" ")}
                            onClick={() => handleDeleteDept(selectedDepartment)}
                            size="small"
                            type="link"
                          >
                            {t("systemAdmin.users.actions.delete")}
                          </AppButton>
                        </PermissionGate>
                      </div>
                    ) : null
                  }
                  onAddChild={(parentId) =>
                    setDeptDrawer({ department: null, open: true, presetParentId: parentId })
                  }
                  onDelete={handleDeleteDept}
                  onEdit={(dept) => setDeptDrawer({ department: dept, open: true })}
                  onMembers={setMembersDept}
                  onReparent={handleReparent}
                  onSelect={handleSelectDept}
                  selectedDeptId={selectedDeptId}
                  totalUserCount={totalAllUsers}
                />
              ) : (
                <p className={styles.mutedText}>{t("systemAdmin.users.emptyDepts")}</p>
              )}
            </div>
          </aside>

          <div className={layoutStyles.userPanel}>
            <div className={layoutStyles.userPanelHead}>
              <div className={layoutStyles.userPanelToolbar}>
                <div className={layoutStyles.userPanelLeading}>
                  <div className={styles.toolbarActions}>
                    <PermissionGate permissions="admin-user:create">
                      <Tooltip
                        title={t("systemAdmin.users.userToolbarHint")}
                      >
                        <AppButton
                          icon={<PlusOutlined />}
                          onClick={() => setUserDrawer({ open: true, user: null })}
                          type="primary"
                        >
                          {t("systemAdmin.users.createUser")}
                        </AppButton>
                      </Tooltip>
                    </PermissionGate>
                    <AppButton
                      icon={<ReloadOutlined />}
                      loading={loading || metaLoading}
                      onClick={() => void reloadAll()}
                    >
                      {t("common.refresh")}
                    </AppButton>
                  </div>
                </div>
                <div className={[layoutStyles.userPanelFilters, styles.filtersInline].join(" ")}>
                  <Input.Search
                    allowClear
                    className={styles.searchInput}
                    onChange={(event) => setKeywordDraft(event.target.value)}
                    placeholder={t("systemAdmin.users.searchPlaceholder")}
                    value={keywordDraft}
                  />
                  <Select
                    className={styles.filterSelect}
                    onChange={(value: StatusFilter) => {
                      updateUrlFilters({ status: value, page: 1 });
                    }}
                    options={[
                      { label: t("systemAdmin.users.statusAll"), value: "" },
                      { label: t("systemAdmin.users.statusEnabled"), value: "enabled" },
                      { label: t("systemAdmin.users.statusDisabled"), value: "disabled" },
                    ]}
                    value={statusFilter}
                  />
                  <Select
                    className={styles.filterSelect}
                    onChange={(value) => {
                      updateUrlFilters({ roleId: value, page: 1 });
                    }}
                    options={roleFilterOptions}
                    placeholder={t("systemAdmin.users.roleFilter")}
                    value={roleFilter || undefined}
                  />
                </div>
              </div>
            </div>

            <div className={layoutStyles.tableSection} ref={tableSectionRef}>
              {loadError ? (
                <Alert
                  action={
                    <AppButton onClick={() => void reloadAll()} type="link">
                      {t("common.retry")}
                    </AppButton>
                  }
                  message={loadError}
                  showIcon
                  type="error"
                />
              ) : (
                <AppTable<AdminUser>
                  columns={userColumns}
                  dataSource={users}
                  loading={loading}
                  locale={{ emptyText: t("systemAdmin.users.emptyUsers") }}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 1080, y: tableScrollY }}
                />
              )}
            </div>
            {totalUsers > 0 ? (
              <TablePaginationBar
                current={pageState.page}
                onChange={setPagination}
                pageSize={pageState.pageSize}
                showSizeChanger
                showTotal={(count) => t("common.total", { total: count })}
                total={totalUsers}
              />
            ) : null}
          </div>
        </div>
      </section>

      <UserFormDrawer
        departments={departments}
        onClose={() => setUserDrawer({ open: false, user: null })}
        onSaved={() => void reloadAll()}
        open={userDrawer.open}
        user={userDrawer.user}
      />
      {rolesUser ? (
        <UserRolesDrawer
          onClose={() => setRolesUser(null)}
          onSaved={() => void reloadUsers()}
          open={Boolean(rolesUser)}
          roles={roles}
          user={rolesUser}
        />
      ) : null}
      <DepartmentFormDrawer
        department={deptDrawer.department}
        departments={departments}
        onClose={() => setDeptDrawer({ department: null, open: false })}
        onSaved={() => void reloadAll()}
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
          onChanged={() => void reloadAll()}
          onClose={() => setMembersDept(null)}
          open={Boolean(membersDept)}
        />
      ) : null}
    </>
  );
}
