/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ResourceGrantEditor } from "@/modules/system-admin/components/ResourceGrantEditor";
import { authzPoints } from "@/modules/system-admin/permissions";
import {
  createRole,
  setRolePermission,
  updateRole,
} from "@/modules/system-admin/services/admin.service";
import type { AdminRole, ResourceGrant } from "@/modules/system-admin/types/admin";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type RoleFormValues = {
  description: string;
  name: string;
};

type RoleFormDrawerProps = {
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  role: AdminRole | null;
};

const grantKey = (resourceType: string, id: string) => `${resourceType}\u0000${id}`;

/** Calculates the difference between original and target grants, splitting it into attach and detach calls. */
function diffGrants(original: ResourceGrant[], desired: ResourceGrant[]) {
  const byKey = new Map<string, { type: string; id: string; orig: Set<string>; want: Set<string> }>();
  for (const grant of original) {
    const key = grantKey(grant.resource.type, grant.resource.id);
    byKey.set(key, { type: grant.resource.type, id: grant.resource.id, orig: new Set(grant.operations), want: new Set() });
  }
  for (const grant of desired) {
    const key = grantKey(grant.resource.type, grant.resource.id);
    const entry = byKey.get(key) ?? { type: grant.resource.type, id: grant.resource.id, orig: new Set<string>(), want: new Set<string>() };
    grant.operations.forEach((op) => entry.want.add(op));
    byKey.set(key, entry);
  }
  const adds: ResourceGrant[] = [];
  const removes: ResourceGrant[] = [];
  for (const { type, id, orig, want } of byKey.values()) {
    const addOps = [...want].filter((op) => !orig.has(op));
    const removeOps = [...orig].filter((op) => !want.has(op));
    if (addOps.length) {
      adds.push({ resource: { type, id }, operations: addOps });
    }
    if (removeOps.length) {
      removes.push({ resource: { type, id }, operations: removeOps });
    }
  }
  return { adds, removes };
}

export function RoleFormDrawer({ onClose, onSaved, open, role }: RoleFormDrawerProps) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const [form] = Form.useForm<RoleFormValues>();
  const [grants, setGrants] = useState<ResourceGrant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(role);
  const locked = Boolean(role?.builtin);
  // Renaming/describing uses admin-role:edit while configuring permissions uses admin-role:permissions.
  // Backend PR #474 separates them, so edit-only callers can open the drawer and change names, but
  // the permission editor stays read-only because its POST/DELETE roles/:id/permissions calls would receive 403.
  const canEditPermissions = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.rolePermissions,
  });
  const permissionsReadOnly = locked || !canEditPermissions;

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({ name: role?.name ?? "", description: role?.description ?? "" });
    setGrants(role ? role.permissions.map((grant) => ({ ...grant, operations: [...grant.operations] })) : []);
  }, [form, open, role]);

  const handleSubmit = () => {
    if (locked) {
      onClose();
      return;
    }
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        if (isEdit && role) {
          await updateRole(role.id, {
            name: values.name.trim(),
            description: values.description.trim(),
          });
          // Without admin-role:permissions, the editor is read-only and should have no difference.
          // Skip explicitly to prevent a future change from sending a series of guaranteed-403 requests from a read-only diff.
          if (canEditPermissions) {
            const { adds, removes } = diffGrants(role.permissions, grants);
            for (const grant of adds) {
              await setRolePermission(role.id, true, grant);
            }
            for (const grant of removes) {
              await setRolePermission(role.id, false, grant);
            }
          }
          message.success(t("systemAdmin.roles.toast.saved"));
        } else {
          const newId = await createRole({
            name: values.name.trim(),
            description: values.description.trim(),
          });
          if (canEditPermissions) {
            for (const grant of grants) {
              await setRolePermission(newId, true, grant);
            }
          }
          message.success(t("systemAdmin.roles.toast.created"));
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
          {!locked ? (
            <AppButton loading={submitting} onClick={handleSubmit} type="primary">
              {isEdit ? t("common.save") : t("common.create")}
            </AppButton>
          ) : null}
        </div>
      }
      onClose={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={
        isEdit
          ? t("systemAdmin.roles.drawer.editTitle", { name: role?.name })
          : t("systemAdmin.roles.drawer.createTitle")
      }
      width={680}
    >
      {locked ? (
        <div className={[styles.calloutBox, styles.calloutWarn].join(" ")} style={{ marginBottom: 16 }}>
          <InfoCircleOutlined />
          <span>{t("systemAdmin.roles.drawer.builtinLocked")}</span>
        </div>
      ) : null}
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t("systemAdmin.roles.drawer.name")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input disabled={locked} placeholder={t("systemAdmin.roles.drawer.namePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.roles.drawer.description")} name="description">
          <Input disabled={locked} placeholder={t("systemAdmin.roles.drawer.descriptionPlaceholder")} />
        </Form.Item>
        <Form.Item
          label={
            <span>
              {t("systemAdmin.roles.drawer.permissions")}{" "}
              <span className={styles.subText}>
                {permissionsReadOnly && !locked
                  ? t("systemAdmin.roles.drawer.permissionsReadOnly")
                  : t("systemAdmin.roles.drawer.permissionsHint")}
              </span>
            </span>
          }
        >
          <ResourceGrantEditor disabled={permissionsReadOnly} onChange={setGrants} value={grants} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
