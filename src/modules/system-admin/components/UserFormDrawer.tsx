import { InfoCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createUser,
  DEFAULT_NEW_USER_PASSWORD,
  getUser,
  updateUser,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminRole, AdminUser } from "@/modules/system-admin/types/admin";
import { buildDeptTree, rolesOfUser } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type UserFormValues = {
  account: string;
  email: string;
  name: string;
  telephone: string;
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
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const isEdit = Boolean(user);

  const deptTree = useMemo(() => buildDeptTree(departments), [departments]);
  // 角色按 source 分组：系统角色 vs 业务/非系统角色。
  const systemRoles = useMemo(() => roles.filter((role) => role.source === "system"), [roles]);
  const businessRoles = useMemo(() => roles.filter((role) => role.source !== "system"), [roles]);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      account: user?.account ?? "",
      name: user?.name ?? "",
      email: user?.email ?? "",
      telephone: user?.telephone ?? "",
    });
    setRoleIds(user ? rolesOfUser(roles, user.id).map((role) => role.id) : []);
    setDeptIds(user?.departmentIds ?? []);
    // 列表不返 telephone/departments，编辑时拉详情回显。
    if (user) {
      setSeeding(true);
      void getUser(user.id)
        .then((detail) => {
          form.setFieldValue("telephone", detail.telephone);
          setDeptIds(detail.departmentIds ?? []);
        })
        .catch(() => undefined)
        .finally(() => setSeeding(false));
    }
  }, [form, open, roles, user]);

  const toggleRole = (roleId: string) => {
    setRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
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
            telephone: values.telephone.trim(),
            enabled: user.enabled,
            departmentIds: deptIds,
            roleIds,
          });
          message.success(t("systemAdmin.users.toast.userSaved"));
        } else {
          await createUser({
            account: values.account.trim(),
            name: values.name.trim(),
            email: values.email.trim(),
            telephone: values.telephone.trim(),
            departmentIds: deptIds,
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
      destroyOnClose
      footer={
        <div className={styles.drawerFooter}>
          <span className={styles.footNote}>
            {isEdit ? "PUT" : "POST"} /safe/v1/admin/users
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
      <Spin spinning={seeding}>
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            label={t("systemAdmin.users.drawer.account")}
            name="account"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input disabled={isEdit} placeholder={t("systemAdmin.users.drawer.accountPlaceholder")} />
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
          <Form.Item label={t("systemAdmin.users.drawer.telephone")} name="telephone">
            <Input placeholder={t("systemAdmin.users.drawer.telephonePlaceholder")} />
          </Form.Item>
          <Form.Item label={t("systemAdmin.users.drawer.department")}>
            <Select
              allowClear
              mode="multiple"
              onChange={setDeptIds}
              optionFilterProp="label"
              options={deptTree.map(({ dept, depth }) => ({
                label: `${"　".repeat(depth)}${dept.name}`,
                value: dept.id,
              }))}
              placeholder={t("systemAdmin.users.drawer.departmentPlaceholder")}
              value={deptIds}
            />
          </Form.Item>
          <Form.Item label={t("systemAdmin.users.drawer.grantRoles")}>
            {businessRoles.length ? (
              <>
                <p className={styles.roleGroupLabel}>{t("systemAdmin.users.drawer.businessRoles")}</p>
                <div className={styles.chipGroup}>{businessRoles.map(roleChip)}</div>
              </>
            ) : null}
            {systemRoles.length ? (
              <>
                <p className={styles.roleGroupLabel} style={{ marginTop: 12 }}>
                  {t("systemAdmin.users.drawer.systemRoles")}
                </p>
                <div className={styles.chipGroup}>{systemRoles.map(roleChip)}</div>
              </>
            ) : null}
            <p className={styles.subText} style={{ marginTop: 8 }}>
              {t("systemAdmin.users.drawer.rolesHint")}
            </p>
          </Form.Item>
          {!isEdit ? (
            <div className={styles.calloutBox}>
              <InfoCircleOutlined />
              <span>
                {t("systemAdmin.users.drawer.defaultPasswordNote", {
                  password: DEFAULT_NEW_USER_PASSWORD,
                })}
              </span>
            </div>
          ) : null}
        </Form>
      </Spin>
    </Drawer>
  );
}
