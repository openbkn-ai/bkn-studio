/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined, SearchOutlined } from "@ant-design/icons";
import { Drawer, Input, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { getUser, syncUserRoleBindings } from "@/modules/system-admin/services/admin.service";
import type { AdminRole, AdminUser } from "@/modules/system-admin/types/admin";
import { rolesOfUser } from "@/modules/system-admin/utils/admin-helpers";

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

  const systemRoles = useMemo(() => roles.filter((role) => role.source === "system"), [roles]);
  const businessRoles = useMemo(() => roles.filter((role) => role.source !== "system"), [roles]);
  const roleSearch = roleKeyword.trim().toLowerCase();

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
    setRoleIds(rolesOfUser(roles, user.id).map((role) => role.id));
    setLoading(true);
    void getUser(user.id)
      .then((detail) => {
        setRoleIds(detail.roleIds ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open, roles, user.id]);

  const isSystemRole = (roleId: string) => systemRoles.some((role) => role.id === roleId);

  const toggleRole = (roleId: string) => {
    setRoleIds((current) => {
      if (current.includes(roleId)) {
        return current.filter((id) => id !== roleId);
      }
      const sameGroup = current.filter((id) => isSystemRole(id) === isSystemRole(roleId));
      return [...sameGroup, roleId];
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
    <button
      className={[styles.chipOpt, roleIds.includes(role.id) ? styles.chipOptSelected : ""].join(" ")}
      key={role.id}
      onClick={() => toggleRole(role.id)}
      type="button"
    >
      <span className={styles.chipCode}>{role.name}</span>
      {role.description ? <span className={styles.chipType}>{role.description}</span> : null}
    </button>
  );

  return (
    <Drawer
      className={drawerStyles.drawer}
      destroyOnClose
      footer={
        <div className={drawerStyles.drawerFooter}>
          <div className={drawerStyles.footerActions}>
            <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
            <AppButton loading={submitting} onClick={handleSubmit} type="primary">
              {t("common.save")}
            </AppButton>
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
      width={560}
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
                <span>{t("systemAdmin.users.drawer.roleExclusiveHint")}</span>
              </div>
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
                    {t("systemAdmin.users.drawer.rolesSelected", { count: roleIds.length })}
                  </span>
                </div>
              ) : (
                <div className={drawerStyles.roleToolbar}>
                  <span />
                  <span className={drawerStyles.roleSelectedCount}>
                    {t("systemAdmin.users.drawer.rolesSelected", { count: roleIds.length })}
                  </span>
                </div>
              )}
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
                    <div className={styles.chipGroup}>{filteredBusinessRoles.map(roleChip)}</div>
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
                    <div className={styles.chipGroup}>{filteredSystemRoles.map(roleChip)}</div>
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
            </div>
          </section>
        </div>
      </Spin>
    </Drawer>
  );
}
