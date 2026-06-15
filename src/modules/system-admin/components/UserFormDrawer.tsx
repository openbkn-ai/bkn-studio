import { InfoCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { createUser, updateUser } from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
} from "@/modules/system-admin/types/admin";
import { buildDeptTree, rolesOfUser } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type UserFormValues = {
  account: string;
  deptId: string;
  email: string;
  name: string;
  position: string;
  remark: string;
};

type UserFormDrawerProps = {
  departments: AdminDepartment[];
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  roles: AdminRole[];
  user: AdminUser | null;
};

export function UserFormDrawer({
  departments,
  onClose,
  onSaved,
  open,
  roles,
  user,
}: UserFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<UserFormValues>();
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(user);

  const deptTree = useMemo(() => buildDeptTree(departments), [departments]);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      account: user?.account ?? "",
      name: user?.name ?? "",
      email: user?.email ?? "",
      position: user?.position ?? "",
      deptId: user?.deptIds[0] ?? "dep-root",
      remark: user?.remark ?? "",
    });
    setRoleIds(user ? rolesOfUser(roles, user.id).map((role) => role.id) : []);
  }, [form, open, roles, user]);

  const toggleRole = (roleId: string) => {
    setRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId],
    );
  };

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        if (isEdit && user) {
          await updateUser(user.id, {
            name: values.name.trim(),
            email: values.email.trim(),
            position: values.position.trim(),
            deptIds: [values.deptId],
            remark: values.remark.trim(),
            roleIds,
          });
          message.success(t("systemAdmin.users.toast.userSaved"));
        } else {
          await createUser({
            account: values.account.trim(),
            name: values.name.trim(),
            email: values.email.trim(),
            position: values.position.trim(),
            deptIds: [values.deptId],
            remark: values.remark.trim(),
            roleIds,
          });
          message.success(t("systemAdmin.users.toast.userCreated"));
        }
        onSaved();
        onClose();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      destroyOnClose
      footer={
        <div className={styles.drawerFooter}>
          <span className={styles.footNote}>
            ShareMgnt.Usrm_{isEdit ? "EditUser" : "AddUser"}
          </span>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton loading={submitting} onClick={handleSubmit} type="primary">
            {isEdit ? t("common.save") : t("common.create")}
          </AppButton>
        </div>
      }
      onClose={onClose}
      open={open}
      title={
        isEdit
          ? t("systemAdmin.users.drawer.editTitle", { name: user?.name })
          : t("systemAdmin.users.drawer.createTitle")
      }
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t("systemAdmin.users.drawer.account")}
          name="account"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input
            disabled={isEdit}
            placeholder={t("systemAdmin.users.drawer.accountPlaceholder")}
          />
        </Form.Item>
        <Form.Item
          label={t("systemAdmin.users.drawer.displayName")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input placeholder={t("systemAdmin.users.drawer.displayNamePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.drawer.email")} name="email">
          <Input placeholder={t("systemAdmin.users.drawer.emailPlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.drawer.position")} name="position">
          <Input placeholder={t("systemAdmin.users.drawer.positionPlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.drawer.department")} name="deptId">
          <Select
            options={deptTree.map(({ dept, depth }) => ({
              label: `${"　".repeat(depth)}${dept.name}`,
              value: dept.id,
            }))}
          />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.drawer.grantRoles")}>
          <div className={styles.chipGroup}>
            {roles.map((role) => (
              <button
                className={[
                  styles.chipOpt,
                  roleIds.includes(role.id) ? styles.chipOptSelected : "",
                ].join(" ")}
                key={role.id}
                onClick={() => toggleRole(role.id)}
                type="button"
              >
                <span className={styles.chipCode}>{role.name}</span>
                <span className={styles.chipType}>{role.displayName}</span>
              </button>
            ))}
          </div>
          <p className={styles.subText} style={{ marginTop: 8 }}>
            {t("systemAdmin.users.drawer.rolesHint")}
          </p>
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.drawer.remark")} name="remark">
          <Input placeholder={t("systemAdmin.users.drawer.remarkPlaceholder")} />
        </Form.Item>
        {!isEdit ? (
          <div className={styles.calloutBox}>
            <InfoCircleOutlined />
            <span>{t("systemAdmin.users.drawer.defaultPasswordNote")}</span>
          </div>
        ) : null}
      </Form>
    </Drawer>
  );
}
