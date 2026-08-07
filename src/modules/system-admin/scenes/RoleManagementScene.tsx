/**

 * Copyright (c) 2026 OpenBKN

 * SPDX-License-Identifier: LicenseRef-OpenBKN

 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional

 * Conditions. See LICENSE for the full text.

 */



import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";

import { Alert, Input, Space, Tooltip } from "antd";

import type { ColumnsType } from "antd/es/table";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";



import { useAppServices } from "@/framework/context/use-app-services";

import { usePageState } from "@/framework/hooks/use-page-state";

import { CapabilityGate } from "@/framework/entitlement/CapabilityGate";

import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";

import { EditionBadge } from "@/framework/entitlement/EditionBadge";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";

import { PermissionGate } from "@/framework/permission/PermissionGate";

import { extractRequestErrorMessage } from "@/framework/request/error-message";

import { AppButton } from "@/framework/ui/common/AppButton";

import { AppTable } from "@/framework/ui/common/AppTable";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";

import { RoleDetailDrawer } from "@/modules/system-admin/components/RoleDetailDrawer";

import { RoleFormDrawer } from "@/modules/system-admin/components/RoleFormDrawer";

import { RoleMembersModal } from "@/modules/system-admin/components/RoleMembersModal";

import {

  deleteRole,

  listDepartments,

  listRoles,

} from "@/modules/system-admin/services/admin.service";

import type { AdminDepartment, AdminRole } from "@/modules/system-admin/types/admin";

import {

  operationLabel,

  resourceTypeLabel,

  WILDCARD,

} from "@/modules/system-admin/utils/resource-catalog";
import { isSuperAdminRole } from "@/modules/system-admin/utils/role-catalog";



import styles from "./admin.module.css";



function resolveMemberSummary(role: AdminRole, deptIdSet: Set<string>) {

  let userCount = 0;

  let deptCount = 0;

  role.accessorIds.forEach((id) => {

    if (deptIdSet.has(id)) {

      deptCount += 1;

      return;

    }

    userCount += 1;

  });

  return { deptCount, userCount };

}



function formatTime(value?: number) {

  if (!value) {

    return "—";

  }

  return new Intl.DateTimeFormat(undefined, {

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
  const [rbacUpgradeOpen, setRbacUpgradeOpen] = useState(false);



  const { t } = useTranslation();

  /*
    没买时的「新建角色」:按钮照常可点,点开讲清这项是什么、要哪一档——置灰的死按钮
    说不清是坏了还是没买。fallback 与 upgrade 用同一个节点:社区镜像上这项是
    not-installed,只配 upgrade 的话按钮会整个消失,而那恰恰是最该告诉客户有东西可买的
    部署。
  */
  const rbacUpgradeButton = (
    <PermissionGate permissions="admin-role:create">
      <AppButton
        icon={<PlusOutlined />}
        onClick={() => setRbacUpgradeOpen(true)}
        type="primary"
      >
        {t("systemAdmin.roles.create")}
        <EditionBadge edition="professional" />
      </AppButton>
    </PermissionGate>
  );

  const { message, modal } = useAppServices();

  const { pageState, setPagination } = usePageState();

  const [roles, setRoles] = useState<AdminRole[]>([]);

  const [departments, setDepartments] = useState<AdminDepartment[]>([]);

  const [rolesLoading, setRolesLoading] = useState(false);

  const [metaLoading, setMetaLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");

  const [roleDrawer, setRoleDrawer] = useState<{ open: boolean; role: AdminRole | null }>({

    open: false,

    role: null,

  });

  const [membersRole, setMembersRole] = useState<AdminRole | null>(null);

  const [detailRole, setDetailRole] = useState<AdminRole | null>(null);

  const rolesRequestSeq = useRef(0);



  const deptIdSet = useMemo(() => new Set(departments.map((dept) => dept.id)), [departments]);



  const loadDepartments = useCallback(async () => {

    setMetaLoading(true);

    try {

      setDepartments(await listDepartments());

    } catch (error) {

      setLoadError(extractRequestErrorMessage(error));

    } finally {

      setMetaLoading(false);

    }

  }, []);



  const loadRoles = useCallback(async () => {

    const requestSeq = ++rolesRequestSeq.current;

    setRolesLoading(true);

    setLoadError(null);

    try {

      const roleList = await listRoles({ withMembers: true });

      if (requestSeq !== rolesRequestSeq.current) {

        return;

      }

      setRoles(roleList);

    } catch (error) {

      if (requestSeq !== rolesRequestSeq.current) {

        return;

      }

      setRoles([]);

      setLoadError(extractRequestErrorMessage(error));

    } finally {

      if (requestSeq === rolesRequestSeq.current) {

        setRolesLoading(false);

      }

    }

  }, []);



  const reloadAll = useCallback(async () => {

    await Promise.all([loadDepartments(), loadRoles()]);

  }, [loadDepartments, loadRoles]);



  useEffect(() => {

    void reloadAll();

  }, [reloadAll]);



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



  const pagedRoles = useMemo(() => {

    const start = (pageState.page - 1) * pageState.pageSize;

    return filteredRoles.slice(start, start + pageState.pageSize);

  }, [filteredRoles, pageState.page, pageState.pageSize]);



  const resetRolePage = () => {

    setPagination(1, pageState.pageSize);

  };



  const columns: ColumnsType<AdminRole> = useMemo(

    () => [

      {

        title: t("systemAdmin.roles.columns.role"),

        dataIndex: "name",

        render: (_, role) => (

          <div className={styles.nameCell}>

            <span className={styles.nameTitle}>

              <AppButton

                className={styles.actionLink}

                onClick={() => setDetailRole(role)}

                type="link"

              >

                {role.name}

              </AppButton>

              {role.builtin ? (

                <span className={styles.mutedText}>（{t("systemAdmin.roles.builtin")}）</span>

              ) : (

                ""

              )}

            </span>

            {role.description ? (

              <Tooltip title={role.description}>

                <span className={styles.singleLineText}>{role.description}</span>

              </Tooltip>

            ) : null}

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

          const typeCounts = new Map<string, number>();

          let hasWildcard = false;

          role.permissions.forEach((grant) => {

            typeCounts.set(grant.resource.type, (typeCounts.get(grant.resource.type) ?? 0) + 1);

            if (grant.resource.id === WILDCARD || grant.operations.includes("*")) {

              hasWildcard = true;

            }

          });

          const tags = [...typeCounts.entries()]

            .sort(([a], [b]) => a.localeCompare(b))

            .slice(0, 3)

            .map(([type, count]) => {

              const grants = role.permissions.filter((grant) => grant.resource.type === type);

              const operationSummary = [

                resourceTypeLabel(type),

                ...grants.map((grant) => {

                  const scope =

                    grant.resource.id === WILDCARD

                      ? t("systemAdmin.grant.wholeType")

                      : grant.resource.id;

                  const ops = grant.operations

                    .map((op) =>

                      op === "*" ? t("systemAdmin.grant.allOps") : operationLabel(type, op),

                    )

                    .join("、");

                  return `${scope}: ${ops}`;

                }),

              ].join("\n");

              return (

                <Tooltip key={type} title={<span style={{ whiteSpace: "pre-line" }}>{operationSummary}</span>}>

                  <span className={styles.permissionPill}>

                    <span className={styles.permissionPillLabel}>{resourceTypeLabel(type)}</span>
                    <span className={styles.permissionPillCount}>{count}</span>

                  </span>

                </Tooltip>

              );

            });

          return (

            <div className={styles.permissionSummaryRow}>

              {tags}

              {typeCounts.size > 3 ? (

                <span className={styles.permissionMore}>+{typeCounts.size - 3}</span>

              ) : null}

              {hasWildcard ? (

                <span className={styles.permissionWildcard}>{t("systemAdmin.roles.detail.hasWildcard")}</span>

              ) : null}

              <AppButton

                className={styles.actionLink}

                onClick={() => setDetailRole(role)}

                type="link"

              >

                {t("common.detail")}

              </AppButton>

            </div>

          );

        },

      },

      {

        title: t("systemAdmin.roles.columns.members"),

        key: "members",

        width: 140,

        render: (_, role) => {

          const { userCount, deptCount } = resolveMemberSummary(role, deptIdSet);

          return (

            <span className={styles.singleLineText}>

              {t("systemAdmin.roles.membersModal.memberUser")} {userCount} ·{" "}

              {t("systemAdmin.roles.membersModal.memberDept")} {deptCount}

            </span>

          );

        },

      },

      {

        title: t("systemAdmin.roles.columns.updateTime"),

        dataIndex: "updatedAt",

        width: 132,

        render: (value?: number) => (

          <span className={styles.singleLineText}>{formatTime(value)}</span>

        ),

      },

      {

        title: t("systemAdmin.roles.columns.actions"),

        key: "actions",

        render: (_, role) => (

          <Space className={[styles.actionGroup, styles.actionGroupInline].join(" ")}>

            <PermissionGate permissions="admin-role:members">

              <AppButton className={styles.actionLink} onClick={() => setMembersRole(role)} type="link">

                {t("systemAdmin.roles.actions.members")}

              </AppButton>

            </PermissionGate>

            {/* 行内操作直接藏,不置灰:每行都挂一排点不动的按钮只是噪音,想买的
                信息由工具栏那个入口给。 */}
            <CapabilityGate capability={CAPABILITIES.RBAC_BASIC}>
            <PermissionGate permissions="admin-role:edit">

              {role.builtin ? null : isSuperAdminRole(role) ? (

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

                  {t("systemAdmin.roles.actions.edit")}

                </AppButton>

              )}

            </PermissionGate>
            </CapabilityGate>

            {!role.builtin ? (

              <CapabilityGate capability={CAPABILITIES.RBAC_BASIC}>
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

                          await loadRoles();

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
              </CapabilityGate>

            ) : null}

          </Space>

        ),

      },

    ],

    [deptIdSet, loadRoles, message, modal, t],

  );



  return (

    <>

      <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>

        <div className={styles.operationBar}>

          <div className={styles.operationPrimary}>

            <div className={styles.toolbarActions}>

              {/*
                档位包在权限外层:集群没买 rbac_basic 时,谁的权限齐全都不该看到写
                入口——档位是集群属性,权限是人的属性。

                这里(工具栏,独一份)置灰+提示而不是藏掉:它是这套付费能力最显眼的
                入口,客户看得见才知道有东西可买。行内操作(编辑/删除)反过来直接藏,
                每行挂两个置灰按钮只是噪音。
              */}
              <CapabilityGate
                capability={CAPABILITIES.RBAC_BASIC}
                fallback={rbacUpgradeButton}
                upgrade={rbacUpgradeButton}
              >
                <PermissionGate permissions="admin-role:create">

                  <AppButton

                    icon={<PlusOutlined />}

                    onClick={() => setRoleDrawer({ open: true, role: null })}

                    type="primary"

                  >

                    {t("systemAdmin.roles.create")}

                  </AppButton>

                </PermissionGate>
              </CapabilityGate>

              <AppButton

                icon={<ReloadOutlined />}

                loading={rolesLoading || metaLoading}

                onClick={() => void reloadAll()}

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

              onChange={(event) => {

                setKeyword(event.target.value);

                resetRolePage();

              }}

              placeholder={t("systemAdmin.roles.searchPlaceholder")}

              value={keyword}

            />

          </div>

        </div>

        <div className={styles.tableSurface}>

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

            <AppTable<AdminRole>

              columns={columns}

              dataSource={pagedRoles}

              loading={rolesLoading}

              locale={{ emptyText: t("systemAdmin.roles.empty") }}

              pagination={false}

              rowKey="id"

            />

          )}

        </div>

        {filteredRoles.length > 0 ? (

          <TablePaginationBar

            current={pageState.page}

            onChange={setPagination}

            pageSize={pageState.pageSize}

            showSizeChanger

            showTotal={(count) => t("common.total", { total: count })}

            total={filteredRoles.length}

          />

        ) : null}

      </section>



      <RoleFormDrawer

        onClose={() => setRoleDrawer({ open: false, role: null })}

        onSaved={() => void loadRoles()}

        open={roleDrawer.open}

        role={roleDrawer.role}

      />

      {detailRole ? (

        <RoleDetailDrawer

          canEdit={!detailRole.builtin && !isSuperAdminRole(detailRole)}

          canManageMembers

          onClose={() => setDetailRole(null)}

          onEdit={() => {

            setDetailRole(null);

            setRoleDrawer({ open: true, role: detailRole });

          }}

          onOpenMembers={() => {

            setDetailRole(null);

            setMembersRole(detailRole);

          }}

          open={Boolean(detailRole)}

          memberSummary={resolveMemberSummary(detailRole, deptIdSet)}

          role={detailRole}

        />

      ) : null}

      {membersRole ? (

        <RoleMembersModal

          departments={departments}

          onChanged={() => void loadRoles()}

          onClose={() => setMembersRole(null)}

          open={Boolean(membersRole)}

          role={membersRole}

        />

      ) : null}

    <CapabilityUpgradeDialog

      capability={CAPABILITIES.RBAC_BASIC}

      minEdition="professional"

      onClose={() => setRbacUpgradeOpen(false)}

      open={rbacUpgradeOpen}

    />

    </>

  );

}
