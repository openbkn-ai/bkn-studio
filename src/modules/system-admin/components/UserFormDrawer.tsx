/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Form, Input, Spin, Tag, TreeSelect } from "antd";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";

import drawerStyles from "@/modules/system-admin/components/UserFormDrawer.module.css";
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
  user: AdminUser | null;
};

function formatDrawerTime(value: number | undefined, locale: string) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

function userInitials(name: string, account: string) {
  const source = (name.trim() || account.trim()).replace(/\s+/g, "");
  if (!source) {
    return "?";
  }
  return source.slice(0, 1).toUpperCase();
}

type DeptTreeNode = {
  title: string;
  value: string;
  key: string;
  children?: DeptTreeNode[];
};

function buildDeptTreeData(departments: AdminDepartment[], parentId: string | null): DeptTreeNode[] {
  return departments
    .filter((dept) => dept.parentId === parentId)
    .map((dept) => ({
      key: dept.id,
      title: dept.name,
      value: dept.id,
      children: buildDeptTreeData(departments, dept.id),
    }))
    .filter((node) => node.children?.length || true);
}

function FormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className={drawerStyles.formSectionCard}>
      <div className={drawerStyles.formSectionHead}>
        <h3 className={drawerStyles.formSectionTitle}>{title}</h3>
        <p className={drawerStyles.formSectionDesc}>{description}</p>
      </div>
      <div className={drawerStyles.formSectionBody}>{children}</div>
    </section>
  );
}

export function UserFormDrawer({
  departments,
  onClose,
  onSaved,
  open,
  user,
}: UserFormDrawerProps) {
  const { t, i18n } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<UserFormValues>();
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const preservedRoleIds = useRef<string[]>([]);
  const isEdit = Boolean(user);

  // TreeSelect uses a real tree (not flat indents).
  const deptTreeData = useMemo(() => buildDeptTreeData(departments, null), [departments]);

  useEffect(() => {
    if (!open) {
      return;
    }
    preservedRoleIds.current = [];
    form.setFieldsValue({
      account: user?.account ?? "",
      name: user?.name ?? "",
      email: user?.email ?? "",
      telephone: user?.telephone ?? "",
    });
    setDeptIds(user?.departmentIds ?? []);
    if (user) {
      preservedRoleIds.current = user.roleIds ?? [];
      setSeeding(true);
      void getUser(user.id)
        .then((detail) => {
          form.setFieldsValue({
            account: detail.account,
            name: detail.name,
            email: detail.email,
            telephone: detail.telephone,
          });
          setDeptIds(detail.departmentIds ?? []);
          preservedRoleIds.current = detail.roleIds ?? [];
        })
        .catch(() => undefined)
        .finally(() => setSeeding(false));
    }
  }, [form, open, user]);

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
            roleIds: preservedRoleIds.current,
          });
          message.success(t("systemAdmin.users.toast.userSaved"));
        } else {
          await createUser({
            account: values.account.trim(),
            name: values.name.trim(),
            email: values.email.trim(),
            telephone: values.telephone.trim(),
            departmentIds: deptIds,
            roleIds: [],
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

  const optionalSuffix = (
    <span className={drawerStyles.optionalMark}>{t("systemAdmin.users.drawer.optional")}</span>
  );

  const watchedName = Form.useWatch("name", form);
  const watchedAccount = Form.useWatch("account", form);
  const displayName = watchedName || user?.name || "";
  const displayAccount = user?.account ?? watchedAccount ?? "";

  return (
    <Drawer
      className={drawerStyles.drawer}
      destroyOnClose
      footer={
        <div className={drawerStyles.drawerFooter}>
          {!isEdit ? (
            <span className={drawerStyles.footerHint}>
              {t("systemAdmin.users.drawer.createPasswordHint", {
                password: DEFAULT_NEW_USER_PASSWORD,
              })}
            </span>
          ) : null}
          <div className={drawerStyles.footerActions}>
            <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
            <AppButton loading={submitting} onClick={handleSubmit} type="primary">
              {isEdit ? t("common.save") : t("common.create")}
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
      title={
        isEdit
          ? t("systemAdmin.users.drawer.editTitle", { name: user?.name })
          : t("systemAdmin.users.drawer.createTitle")
      }
      width={560}
    >
      <Spin spinning={seeding}>
        <div className={drawerStyles.drawerBody}>
          {isEdit && user ? (
            <div className={drawerStyles.summaryCard}>
              <div aria-hidden className={drawerStyles.summaryAvatar}>
                {userInitials(displayName, displayAccount)}
              </div>
              <div className={drawerStyles.summaryMain}>
                <div className={drawerStyles.summaryTopRow}>
                  <h3 className={drawerStyles.summaryTitle}>{displayName}</h3>
                  <div className={drawerStyles.summaryMeta}>
                    <Tag
                      className={[
                        styles.statusTag,
                        user.enabled ? styles.statusEnabled : styles.statusDisabled,
                      ].join(" ")}
                    >
                      {user.enabled
                        ? t("systemAdmin.users.statusEnabled")
                        : t("systemAdmin.users.statusDisabled")}
                    </Tag>
                    {user.builtin ? (
                      <Tag className={styles.roleTag}>{t("systemAdmin.users.builtin")}</Tag>
                    ) : null}
                  </div>
                </div>
                <div className={drawerStyles.summaryBottomRow}>
                  <span className={drawerStyles.summaryAccountInline}>
                    {t("systemAdmin.users.drawer.account")}：{user.account}
                  </span>
                  {user.updatedAt ? (
                    <span className={drawerStyles.summaryUpdated}>
                      {t("systemAdmin.users.drawer.lastUpdated", {
                        time: formatDrawerTime(user.updatedAt, i18n.language),
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <Form className={drawerStyles.formStack} form={form} layout="vertical" requiredMark={false}>
            <FormSection
              description={t("systemAdmin.users.drawer.sectionBasicDesc")}
              title={t("systemAdmin.users.drawer.sectionBasic")}
            >
              <div className={drawerStyles.fieldGrid}>
                <Form.Item
                  label={t("systemAdmin.users.drawer.account")}
                  name="account"
                  rules={isEdit ? undefined : [{ required: true, message: t("common.required") }]}
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
              </div>
              <div className={drawerStyles.fieldGroup}>
                <p className={drawerStyles.fieldGroupLabel}>
                  {t("systemAdmin.users.drawer.fieldGroupContact")}
                </p>
                <div className={drawerStyles.fieldGrid}>
                  <Form.Item
                    label={
                      <>
                        {t("systemAdmin.users.drawer.email")}
                        {optionalSuffix}
                      </>
                    }
                    name="email"
                    rules={[
                      { type: "email", message: t("systemAdmin.users.deptDrawer.emailInvalid") },
                    ]}
                  >
                    <Input placeholder={t("systemAdmin.users.drawer.emailPlaceholder")} />
                  </Form.Item>
                  <Form.Item
                    label={
                      <>
                        {t("systemAdmin.users.drawer.telephone")}
                        {optionalSuffix}
                      </>
                    }
                    name="telephone"
                  >
                    <Input placeholder={t("systemAdmin.users.drawer.telephonePlaceholder")} />
                  </Form.Item>
                </div>
              </div>
            </FormSection>

            <FormSection
              description={t("systemAdmin.users.drawer.sectionOrganizationDesc")}
              title={t("systemAdmin.users.drawer.sectionOrganization")}
            >
              <Form.Item label={t("systemAdmin.users.drawer.department")}>
                <TreeSelect
                  allowClear
                  multiple
                  mode="multiple"
                  onChange={setDeptIds}
                  placeholder={t("systemAdmin.users.drawer.departmentPlaceholder")}
                  showSearch
                  treeData={deptTreeData}
                  treeDefaultExpandAll
                  treeNodeFilterProp="title"
                  value={deptIds}
                />
              </Form.Item>
            </FormSection>
          </Form>
        </div>
      </Spin>
    </Drawer>
  );
}
