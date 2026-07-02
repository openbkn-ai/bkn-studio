/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Select } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  listDepartmentMemberIds,
  setDepartmentMembers,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";
import { deptPath } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type DeptMembersModalProps = {
  department: AdminDepartment;
  departments: AdminDepartment[];
  onChanged: () => void;
  onClose: () => void;
  open: boolean;
  users: AdminUser[];
};

export function DeptMembersModal({
  department,
  departments,
  onChanged,
  onClose,
  open,
  users,
}: DeptMembersModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMemberIds(await listDepartmentMemberIds(department.id));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [department.id, message]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const candidates = useMemo(
    () =>
      users
        .filter((user) => !memberIds.includes(user.id))
        .map((user) => ({ label: `${user.name}（${user.account}）`, value: user.id })),
    [memberIds, users],
  );

  const apply = async (userId: string, attach: boolean) => {
    try {
      await setDepartmentMembers(department.id, [userId], attach);
      setMemberIds((current) =>
        attach ? [...current, userId] : current.filter((id) => id !== userId),
      );
      message.success(
        attach
          ? t("systemAdmin.users.deptMembers.added")
          : t("systemAdmin.users.deptMembers.removed"),
      );
      onChanged();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={t("systemAdmin.users.deptMembers.title", { name: deptPath(departments, department.id) })}
      width={560}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Select
          onChange={setCandidate}
          optionFilterProp="label"
          options={candidates}
          placeholder={t("systemAdmin.users.deptMembers.addPlaceholder")}
          showSearch
          style={{ flex: 1 }}
          value={candidate}
        />
        <AppButton
          disabled={!candidate}
          onClick={() => {
            if (candidate) {
              void apply(candidate, true);
              setCandidate(undefined);
            }
          }}
          type="primary"
        >
          {t("systemAdmin.users.deptMembers.add")}
        </AppButton>
      </div>
      {loading ? null : memberIds.length ? (
        <div className={styles.memberList}>
          {memberIds.map((id) => {
            const user = userById.get(id);
            return (
              <div className={styles.memberItem} key={id}>
                <span className={styles.memberName}>
                  {user ? `${user.name}（${user.account}）` : id}
                </span>
                <AppButton
                  className={[styles.actionLink, styles.actionDanger].join(" ")}
                  onClick={() => void apply(id, false)}
                  type="link"
                >
                  {t("systemAdmin.users.deptMembers.remove")}
                </AppButton>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyStatePanel title={t("systemAdmin.users.deptMembers.empty")} />
      )}
      <p className={styles.footNote} style={{ marginTop: 16 }}>
        {t("systemAdmin.users.deptMembers.note", { id: department.id })}
      </p>
    </Modal>
  );
}
