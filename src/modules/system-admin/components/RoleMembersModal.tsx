/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Select, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { setRoleMember } from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  RoleMember,
} from "@/modules/system-admin/types/admin";
import { deptPath } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type RoleMembersModalProps = {
  departments: AdminDepartment[];
  onChanged: () => void;
  onClose: () => void;
  open: boolean;
  role: AdminRole;
  users: AdminUser[];
};

export function RoleMembersModal({
  departments,
  onChanged,
  onClose,
  open,
  role,
  users,
}: RoleMembersModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [accessorIds, setAccessorIds] = useState<string[]>(role.accessorIds);
  const [candidate, setCandidate] = useState<string>();

  useEffect(() => {
    setAccessorIds(role.accessorIds);
  }, [role.accessorIds]);

  // accessor id 反查类型 + 名称（用户优先，再部门）。
  const resolve = useMemo(() => {
    const userById = new Map(users.map((user) => [user.id, user]));
    const deptById = new Map(departments.map((dept) => [dept.id, dept]));
    return (id: string): RoleMember => {
      const user = userById.get(id);
      if (user) {
        return { id, type: "user", label: `${user.name}（${user.account}）` };
      }
      if (deptById.has(id)) {
        return { id, type: "department", label: deptPath(departments, id) };
      }
      return { id, type: "user", label: id };
    };
  }, [departments, users]);

  const candidates = useMemo(() => {
    const userOptions = users
      .filter((user) => !accessorIds.includes(user.id))
      .map((user) => ({ label: `${user.name}（${user.account}）`, value: user.id }));
    const deptOptions = departments
      .filter((dept) => !accessorIds.includes(dept.id))
      .map((dept) => ({
        label: `${t("systemAdmin.roles.membersModal.memberDept")} · ${deptPath(departments, dept.id)}`,
        value: dept.id,
      }));
    return [...userOptions, ...deptOptions];
  }, [accessorIds, departments, t, users]);

  const apply = async (accessorId: string, attach: boolean) => {
    try {
      await setRoleMember(role.id, accessorId, attach);
      setAccessorIds((current) =>
        attach ? [...current, accessorId] : current.filter((id) => id !== accessorId),
      );
      message.success(
        attach
          ? t("systemAdmin.roles.toast.memberAdded")
          : t("systemAdmin.roles.toast.memberRemoved"),
      );
      onChanged();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleAdd = () => {
    if (!candidate) {
      return;
    }
    void apply(candidate, true);
    setCandidate(undefined);
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("systemAdmin.roles.membersModal.title", { name: role.name })}
      width={560}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Select
          onChange={setCandidate}
          optionFilterProp="label"
          options={candidates}
          placeholder={t("systemAdmin.roles.membersModal.addPlaceholder")}
          showSearch
          style={{ flex: 1 }}
          value={candidate}
        />
        <AppButton onClick={handleAdd} type="primary">
          {t("systemAdmin.roles.membersModal.add")}
        </AppButton>
      </div>
      {accessorIds.length ? (
        <div className={styles.memberList}>
          {accessorIds.map((id) => {
            const member = resolve(id);
            return (
              <div className={styles.memberItem} key={id}>
                <span className={styles.memberName}>
                  {member.label}
                  <Tag className={member.type === "user" ? styles.roleTag : styles.permChip}>
                    {member.type === "user"
                      ? t("systemAdmin.roles.membersModal.memberUser")
                      : t("systemAdmin.roles.membersModal.memberDept")}
                  </Tag>
                </span>
                <AppButton
                  className={[styles.actionLink, styles.actionDanger].join(" ")}
                  onClick={() => void apply(id, false)}
                  type="link"
                >
                  {t("systemAdmin.roles.membersModal.remove")}
                </AppButton>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyStatePanel title={t("systemAdmin.roles.membersModal.empty")} />
      )}
      <p className={styles.footNote} style={{ marginTop: 16 }}>
        {t("systemAdmin.roles.membersModal.note", { id: role.id })}
      </p>
    </Modal>
  );
}
