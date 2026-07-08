/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Form, Input, Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createDepartment,
  getUser,
  listUsersPage,
  updateDepartment,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import { buildDeptTree } from "@/modules/system-admin/utils/admin-helpers";

import styles from "@/modules/system-admin/scenes/admin.module.css";

const MANAGER_SEARCH_LIMIT = 50;

type DeptFormValues = {
  code: string;
  email: string;
  managerId: string;
  name: string;
  parentId: string;
  remark: string;
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
  const [managerSearch, setManagerSearch] = useState("");
  const [managerOptions, setManagerOptions] = useState<{ label: string; value: string }[]>([]);
  const [pinnedManagerOption, setPinnedManagerOption] = useState<{ label: string; value: string } | null>(
    null,
  );
  const [managerLoading, setManagerLoading] = useState(false);
  const debouncedManagerSearch = useDebouncedValue(managerSearch.trim());
  const managerRequestSeq = useRef(0);
  const isEdit = Boolean(department);
  const isRoot = isEdit && !department?.parentId;

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
      managerId: department?.managerId ?? "",
      code: department?.code ?? "",
      email: department?.email ?? "",
      remark: department?.remark ?? "",
    });
  }, [department, form, open, presetParentId]);

  useEffect(() => {
    if (!open) {
      setManagerSearch("");
      setManagerOptions([]);
      setPinnedManagerOption(null);
      return;
    }
    const managerId = department?.managerId?.trim();
    if (!managerId) {
      setPinnedManagerOption(null);
      return;
    }
    void getUser(managerId)
      .then((user) => {
        setPinnedManagerOption({ label: `${user.name} (${user.account})`, value: user.id });
      })
      .catch(() => {
        setPinnedManagerOption({ label: managerId, value: managerId });
      });
  }, [department?.managerId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const requestSeq = ++managerRequestSeq.current;
    setManagerLoading(true);
    void listUsersPage(
      {
        limit: MANAGER_SEARCH_LIMIT,
        offset: 0,
        search: debouncedManagerSearch || undefined,
      },
      { skipErrorToast: true },
    )
      .then((result) => {
        if (requestSeq !== managerRequestSeq.current) {
          return;
        }
        const fromSearch = result.users.map((user) => ({
          label: `${user.name} (${user.account})`,
          value: user.id,
        }));
        const merged = new Map(fromSearch.map((item) => [item.value, item]));
        if (pinnedManagerOption) {
          merged.set(pinnedManagerOption.value, pinnedManagerOption);
        }
        setManagerOptions([...merged.values()]);
      })
      .catch(() => {
        if (requestSeq === managerRequestSeq.current) {
          setManagerOptions(pinnedManagerOption ? [pinnedManagerOption] : []);
        }
      })
      .finally(() => {
        if (requestSeq === managerRequestSeq.current) {
          setManagerLoading(false);
        }
      });
  }, [debouncedManagerSearch, open, pinnedManagerOption]);

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        const payload = {
          name: values.name.trim(),
          parentId: isRoot ? null : values.parentId || null,
          type: values.type,
          managerId: values.managerId.trim(),
          code: values.code.trim(),
          email: values.email.trim(),
          remark: values.remark.trim(),
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
      rootClassName={styles.adminOverlay}
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
        <Form.Item label={t("systemAdmin.users.deptDrawer.manager")} name="managerId">
          <Select
            allowClear
            filterOption={false}
            loading={managerLoading}
            onSearch={setManagerSearch}
            options={managerOptions}
            placeholder={t("systemAdmin.users.deptDrawer.managerPlaceholder")}
            showSearch
          />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.code")} name="code">
          <Input placeholder={t("systemAdmin.users.deptDrawer.codePlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("systemAdmin.users.deptDrawer.email")}
          name="email"
          rules={[{ type: "email", message: t("systemAdmin.users.deptDrawer.emailInvalid") }]}
        >
          <Input placeholder={t("systemAdmin.users.deptDrawer.emailPlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.users.deptDrawer.remark")} name="remark">
          <Input.TextArea placeholder={t("systemAdmin.users.deptDrawer.remarkPlaceholder")} rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
