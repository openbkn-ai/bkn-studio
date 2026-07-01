/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createDepartment,
  updateDepartment,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import { buildDeptTree } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type DeptFormValues = {
  name: string;
  parentId: string;
  type: string;
};

type DepartmentFormDrawerProps = {
  department: AdminDepartment | null;
  departments: AdminDepartment[];
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  presetParentId?: string;
};

export function DepartmentFormDrawer({
  department,
  departments,
  onClose,
  onSaved,
  open,
  presetParentId,
}: DepartmentFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<DeptFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(department);
  const isRoot = isEdit && !department?.parentId;

  // value "" = 顶层（根部门），提交时 parent_id 为空。
  const parentOptions = useMemo(
    () => [
      { label: t("systemAdmin.users.deptDrawer.rootNode"), value: "" },
      ...buildDeptTree(departments)
        .filter(({ dept }) => !department || dept.id !== department.id)
        .map(({ dept, depth }) => ({ label: `${"　".repeat(depth)}${dept.name}`, value: dept.id })),
    ],
    [department, departments, t],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      name: department?.name ?? "",
      parentId: department?.parentId ?? presetParentId ?? "",
      type: department?.type ?? "dept",
    });
  }, [department, form, open, presetParentId]);

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        const payload = {
          name: values.name.trim(),
          parentId: isRoot ? null : values.parentId || null,
          type: values.type,
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
          <span style={{ flex: 1 }} />
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
          ? t("systemAdmin.users.deptDrawer.editTitle", { name: department?.name })
          : t("systemAdmin.users.deptDrawer.createTitle")
      }
      width={480}
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
                ? [{ label: t("systemAdmin.users.deptDrawer.rootNode"), value: "" }]
                : parentOptions
            }
          />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.type")} name="type">
          <Select
            options={[
              { label: t("systemAdmin.users.deptDrawer.typeOrg"), value: "org" },
              { label: t("systemAdmin.users.deptDrawer.typeDept"), value: "dept" },
            ]}
          />
        </Form.Item>
      </Form>
      <div className={styles.calloutBox}>
        <InfoCircleOutlined />
        <span>{t("systemAdmin.users.deptDrawer.fieldsNote")}</span>
      </div>
    </Drawer>
  );
}
