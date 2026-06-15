import { Modal, Select, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { modifyRoleMembers } from "@/modules/system-admin/services/admin.service";
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
  const [members, setMembers] = useState<RoleMember[]>(role.members);
  const [candidate, setCandidate] = useState<string>();

  useEffect(() => {
    setMembers(role.members);
  }, [role.members]);

  const memberName = (member: RoleMember) => {
    if (member.type === "user") {
      const user = users.find((item) => item.id === member.id);
      return user ? `${user.name}（${user.account}）` : member.id;
    }
    return deptPath(departments, member.id) || member.id;
  };

  const candidates = useMemo(() => {
    const userOptions = users
      .filter((user) => !members.some((m) => m.type === "user" && m.id === user.id))
      .map((user) => ({
        label: `${user.name}（${user.account}）`,
        value: `user:${user.id}`,
      }));
    const deptOptions = departments
      .filter((dept) => !members.some((m) => m.type === "department" && m.id === dept.id))
      .map((dept) => ({
        label: `${t("systemAdmin.roles.membersModal.memberDept")} · ${deptPath(departments, dept.id)}`,
        value: `department:${dept.id}`,
      }));
    return [...userOptions, ...deptOptions];
  }, [departments, members, t, users]);

  const apply = async (method: "POST" | "DELETE", member: RoleMember) => {
    try {
      await modifyRoleMembers(role.id, method, [member]);
      setMembers((current) =>
        method === "POST"
          ? [...current, member]
          : current.filter((m) => !(m.id === member.id && m.type === member.type)),
      );
      message.success(
        method === "POST"
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
    const [type, ...rest] = candidate.split(":");
    void apply("POST", { id: rest.join(":"), type: type === "department" ? "department" : "user" });
    setCandidate(undefined);
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("systemAdmin.roles.membersModal.title", { name: role.displayName })}
      width={560}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Select
          onChange={setCandidate}
          options={candidates}
          placeholder={t("systemAdmin.roles.membersModal.addPlaceholder")}
          showSearch
          style={{ flex: 1 }}
          value={candidate}
          optionFilterProp="label"
        />
        <AppButton onClick={handleAdd} type="primary">
          {t("systemAdmin.roles.membersModal.add")}
        </AppButton>
      </div>
      {members.length ? (
        <div className={styles.memberList}>
          {members.map((member) => (
            <div className={styles.memberItem} key={`${member.type}:${member.id}`}>
              <span className={styles.memberName}>
                {memberName(member)}
                <Tag className={member.type === "user" ? styles.roleTag : styles.permChip}>
                  {member.type === "user"
                    ? t("systemAdmin.roles.membersModal.memberUser")
                    : t("systemAdmin.roles.membersModal.memberDept")}
                </Tag>
              </span>
              <AppButton
                className={[styles.actionLink, styles.actionDanger].join(" ")}
                onClick={() => void apply("DELETE", member)}
                type="link"
              >
                {t("systemAdmin.roles.membersModal.remove")}
              </AppButton>
            </div>
          ))}
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
