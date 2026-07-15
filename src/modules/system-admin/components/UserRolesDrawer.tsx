/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Drawer, Input, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { getUser, syncUserRoleBindings } from "@/modules/system-admin/services/admin.service";
import type { AdminRole, AdminUser } from "@/modules/system-admin/types/admin";
import { rolesOfUser } from "@/modules/system-admin/utils/admin-helpers";
import {
  hasThreeAdminConflict,
  isAssignableRole,
  isSuperAdminRole,
  isThreeAdminRole,
} from "@/modules/system-admin/utils/role-catalog";

import drawerStyles from "@/modules/system-admin/components/UserFormDrawer.module.css";
import styles from "@/modules/system-admin/scenes/admin.module.css";

type UserRolesDrawerProps = {
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  roles: AdminRole[];
  user: AdminUser;
};

function matchesRoleKeyword(role: AdminRole, keyword: string) {
  if (!keyword) {
    return true;
  }
  const haystack = `${role.name} ${role.description ?? ""}`.toLowerCase();
  return haystack.includes(keyword);
}

export function UserRolesDrawer({ onClose, onSaved, open, roles, user }: UserRolesDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [roleKeyword, setRoleKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const directRoleIds = useMemo(
    () => rolesOfUser(roles, user.id).map((role) => role.id),
    [roles, user.id],
  );
  const assignableRoles = useMemo(() => roles.filter(isAssignableRole), [roles]);
  const systemRoles = useMemo(
    () => assignableRoles.filter((role) => isThreeAdminRole(role) || role.source === "system"),
    [assignableRoles],
  );
  const businessRoles = useMemo(
    () => assignableRoles.filter((role) => !systemRoles.some((systemRole) => systemRole.id === role.id)),
    [assignableRoles, systemRoles],
  );
  const roleSearch = roleKeyword.trim().toLowerCase();
  const selectedRoles = useMemo(
    () => roles.filter((role) => roleIds.includes(role.id)),
    [roleIds, roles],
  );
  const selectedAssignableRoleCount = useMemo(
    () => selectedRoles.filter(isAssignableRole).length,
    [selectedRoles],
  );
  const controlledRoles = useMemo(
    () => selectedRoles.filter((role) => !isAssignableRole(role)),
    [selectedRoles],
  );
  const hasControlledSuperAdmin = controlledRoles.some(isSuperAdminRole);
  const canConfigureAssignableRoles = !hasControlledSuperAdmin;
  const hasDutyConflict = hasThreeAdminConflict(selectedRoles);

  const filteredBusinessRoles = useMemo(
    () => businessRoles.filter((role) => matchesRoleKeyword(role, roleSearch)),
    [businessRoles, roleSearch],
  );
  const filteredSystemRoles = useMemo(
    () => systemRoles.filter((role) => matchesRoleKeyword(role, roleSearch)),
    [roleSearch, systemRoles],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setRoleKeyword("");
    setRoleIds(directRoleIds);
    setLoading(true);
    void getUser(user.id)
      .then((detail) => {
        setRoleIds(detail.roleIds?.length ? detail.roleIds : directRoleIds);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [directRoleIds, open, user.id]);

  const toggleRole = (roleId: string) => {
    setRoleIds((current) => {
      if (current.includes(roleId)) {
        return current.filter((id) => id !== roleId);
      }
      return [...current, roleId];
    });
  };

  const handleSubmit = () => {
    setSubmitting(true);
    void syncUserRoleBindings(user.id, roleIds)
      .then(() => {
        message.success(t("systemAdmin.users.toast.rolesSaved"));
        onSaved();
        onClose();
      })
      .catch((error) => {
        void message.error(extractRequestErrorMessage(error));
      })
      .finally(() => setSubmitting(false));
  };

  const roleChip = (role: AdminRole) => (
    <label
      className={[
        drawerStyles.roleOption,
        roleIds.includes(role.id) ? drawerStyles.roleOptionSelected : "",
      ].join(" ")}
      key={role.id}
    >
      <Checkbox
        checked={roleIds.includes(role.id)}
        className={drawerStyles.roleOptionCheck}
        onChange={() => toggleRole(role.id)}
      />
      <span className={drawerStyles.roleOptionContent}>
        <span className={drawerStyles.roleOptionName}>{role.name}</span>
        {role.description ? (
          <span className={drawerStyles.roleOptionDesc}>{role.description}</span>
        ) : null}
      </span>
    </label>
  );

  return (
    <Drawer
      className={drawerStyles.drawer}
      destroyOnClose
      footer={
        <div className={drawerStyles.drawerFooter}>
          <div className={drawerStyles.footerActions}>
            <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
            {canConfigureAssignableRoles ? (
              <AppButton loading={submitting} onClick={handleSubmit} type="primary">
                {t("common.save")}
              </AppButton>
            ) : null}
          </div>
        </div>
      }
      maskClosable={false}
      onClose={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      styles={{
        body: { padding: 16 },
        header: { padding: "12px 16px" },
      }}
      title={t("systemAdmin.users.rolesDrawer.title", { name: user.name })}
      width={680}
    >
      <Spin spinning={loading}>
        <div className={drawerStyles.drawerBody}>
          <section className={drawerStyles.formSectionCard}>
            <div className={drawerStyles.formSectionHead}>
              <h3 className={drawerStyles.formSectionTitle}>
                {t("systemAdmin.users.drawer.sectionRoles")}
              </h3>
              <p className={drawerStyles.formSectionDesc}>
                {t("systemAdmin.users.rolesDrawer.description", { account: user.account })}
              </p>
            </div>
            <div className={drawerStyles.formSectionBody}>
              <div className={[styles.calloutBox, styles.sectionCalloutBottom].join(" ")}>
                <InfoCircleOutlined />
                <span>
                  {hasControlledSuperAdmin
                    ? t("systemAdmin.users.drawer.superAdminControlledHint")
                    : t("systemAdmin.users.drawer.roleExclusiveHint")}
                </span>
              </div>
              {hasDutyConflict && canConfigureAssignableRoles ? (
                <Alert
                  message={t("systemAdmin.users.drawer.threeAdminConflictTitle")}
                  showIcon
                  type="warning"
                  description={t("systemAdmin.users.drawer.threeAdminConflictDesc")}
                />
              ) : null}
              {roles.length > 6 ? (
                <div className={drawerStyles.roleToolbar}>
                  <Input
                    allowClear
                    className={drawerStyles.roleSearch}
                    onChange={(event) => setRoleKeyword(event.target.value)}
                    placeholder={t("systemAdmin.users.drawer.roleSearchPlaceholder")}
                    prefix={<SearchOutlined />}
                    value={roleKeyword}
                  />
                  <span className={drawerStyles.roleSelectedCount}>
                    {t("systemAdmin.users.drawer.rolesSelected", { count: selectedAssignableRoleCount })}
                    {controlledRoles.length
                      ? ` · ${t("systemAdmin.users.drawer.controlledRolesSelected", { count: controlledRoles.length })}`
                      : ""}
                  </span>
                </div>
              ) : (
                <div className={drawerStyles.roleToolbar}>
                  <span />
                  <span className={drawerStyles.roleSelectedCount}>
                    {t("systemAdmin.users.drawer.rolesSelected", { count: selectedAssignableRoleCount })}
                    {controlledRoles.length
                      ? ` · ${t("systemAdmin.users.drawer.controlledRolesSelected", { count: controlledRoles.length })}`
                      : ""}
                  </span>
                </div>
              )}
              {controlledRoles.length ? (
                <div className={drawerStyles.controlledRolePanel}>
                  <div className={drawerStyles.rolePanelHead}>
                    <p className={drawerStyles.rolePanelTitle}>
                      {t("systemAdmin.users.drawer.controlledRoles")}
                    </p>
                    <span className={drawerStyles.rolePanelCount}>
                      {t("systemAdmin.users.drawer.controlledRolesReadOnly")}
                    </span>
                  </div>
                  <div className={drawerStyles.controlledRoleList}>
                    {controlledRoles.map((role) => (
                      <span className={drawerStyles.controlledRoleItem} key={role.id}>
                        <span className={drawerStyles.roleOptionName}>{role.name}</span>
                        {role.description ? (
                          <span className={drawerStyles.roleOptionDesc}>{role.description}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {canConfigureAssignableRoles ? (
                <>
                  {businessRoles.length ? (
                    <div className={drawerStyles.rolePanel}>
                      <div className={drawerStyles.rolePanelHead}>
                        <p className={drawerStyles.rolePanelTitle}>
                          {t("systemAdmin.users.drawer.businessRoles")}
                        </p>
                        <span className={drawerStyles.rolePanelCount}>
                          {filteredBusinessRoles.length}/{businessRoles.length}
                        </span>
                      </div>
                      {filteredBusinessRoles.length ? (
                        <div className={drawerStyles.roleGrid}>{filteredBusinessRoles.map(roleChip)}</div>
                      ) : (
                        <p className={drawerStyles.roleEmpty}>
                          {t("systemAdmin.users.drawer.rolesSearchEmpty")}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {systemRoles.length ? (
                    <div className={drawerStyles.rolePanel}>
                      <div className={drawerStyles.rolePanelHead}>
                        <p className={drawerStyles.rolePanelTitle}>
                          {t("systemAdmin.users.drawer.systemRoles")}
                        </p>
                        <span className={drawerStyles.rolePanelCount}>
                          {filteredSystemRoles.length}/{systemRoles.length}
                        </span>
                      </div>
                      {filteredSystemRoles.length ? (
                        <div className={drawerStyles.roleGrid}>{filteredSystemRoles.map(roleChip)}</div>
                      ) : (
                        <p className={drawerStyles.roleEmpty}>
                          {t("systemAdmin.users.drawer.rolesSearchEmpty")}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {!businessRoles.length && !systemRoles.length ? (
                    <p className={drawerStyles.roleEmpty}>{t("systemAdmin.users.drawer.rolesEmpty")}</p>
                  ) : null}
                  <p className={[styles.subText, styles.sectionNote].join(" ")}>
                    {t("systemAdmin.users.drawer.rolesHint")}
                  </p>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </Spin>
    </Drawer>
  );
}
