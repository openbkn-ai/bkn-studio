import { Drawer, Form, Input, Select } from "antd";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createDepartment,
  updateDepartment,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminUser,
} from "@/modules/system-admin/types/admin";
import { buildDeptTree } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type DeptFormValues = {
  code: string;
  managerId: string | null;
  name: string;
  parentId: string;
  remark: string;
};

type DepartmentFormDrawerProps = {
  department: AdminDepartment | null;
  departments: AdminDepartment[];
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  presetParentId?: string;
  users: AdminUser[];
};

export function DepartmentFormDrawer({
  department,
  departments,
  onClose,
  onSaved,
  open,
  presetParentId,
  users,
}: DepartmentFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<DeptFormValues>();
  const isEdit = Boolean(department);
  const isRoot = isEdit && !department?.parentId;

  const parentOptions = useMemo(
    () =>
      buildDeptTree(departments)
        .filter(({ dept }) => !department || dept.id !== department.id)
        .map(({ dept, depth }) => ({
          label: `${"　".repeat(depth)}${dept.name}`,
          value: dept.id,
        })),
    [department, departments],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      name: department?.name ?? "",
      parentId: department?.parentId ?? presetParentId ?? "dep-root",
      code: department?.code ?? "",
      managerId: department?.managerId ?? null,
      remark: department?.remark ?? "",
    });
  }, [department, form, open, presetParentId]);

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      try {
        const payload = {
          name: values.name.trim(),
          code: values.code.trim(),
          managerId: values.managerId || null,
          remark: values.remark.trim(),
          parentId: isRoot ? null : values.parentId,
        };
        if (isEdit && department) {
          await updateDepartment(department.id, payload);
          message.success(t("systemAdmin.users.toast.deptSaved"));
        } else {
          await createDepartment(payload);
          message.success(t("systemAdmin.users.toast.deptCreated"));
        }
        onSaved();
        onClose();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    });
  };

  return (
    <Drawer
      destroyOnClose
      footer={
        <div className={styles.drawerFooter}>
          <span className={styles.footNote}>
            ShareMgnt.Usrm_{isEdit ? "EditDepartment" : "AddDepartment"}
          </span>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton onClick={handleSubmit} type="primary">
            {isEdit ? t("common.save") : t("common.create")}
          </AppButton>
        </div>
      }
      onClose={onClose}
      open={open}
      title={
        isEdit
          ? t("systemAdmin.users.deptDrawer.editTitle", { name: department?.name })
          : t("systemAdmin.users.deptDrawer.createTitle")
      }
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t("systemAdmin.users.deptDrawer.name")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input placeholder={t("systemAdmin.users.deptDrawer.namePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.parent")} name="parentId">
          <Select
            disabled={isRoot}
            options={
              isRoot
                ? [{ label: t("systemAdmin.users.deptDrawer.rootNode"), value: "dep-root" }]
                : parentOptions
            }
          />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.code")} name="code">
          <Input placeholder={t("systemAdmin.users.deptDrawer.codePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.manager")} name="managerId">
          <Select
            allowClear
            options={users.map((user) => ({
              label: `${user.name}（${user.account}）`,
              value: user.id,
            }))}
            placeholder={t("systemAdmin.users.deptDrawer.managerUnset")}
          />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.remark")} name="remark">
          <Input placeholder={t("systemAdmin.users.deptDrawer.remarkPlaceholder")} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
