import { InfoCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { createRole, updateRole } from "@/modules/system-admin/services/admin.service";
import type { AdminRole } from "@/modules/system-admin/types/admin";
import {
  PERMISSION_GROUPS,
  permissionsByGroup,
} from "@/modules/system-admin/utils/permission-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type RoleFormValues = {
  description: string;
  displayName: string;
  name: string;
};

type RoleFormDrawerProps = {
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  role: AdminRole | null;
};

export function RoleFormDrawer({ onClose, onSaved, open, role }: RoleFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<RoleFormValues>();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(role);
  const permsLocked = isEdit && Boolean(role?.builtin);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      name: role?.name ?? "",
      displayName: role?.displayName ?? "",
      description: role?.description ?? "",
    });
    setPermissions(role ? [...role.permissions] : []);
  }, [form, open, role]);

  const togglePermission = (key: string) => {
    if (permsLocked) {
      return;
    }
    setPermissions((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const toggleGroup = (group: string) => {
    if (permsLocked) {
      return;
    }
    const keys = permissionsByGroup(group).map((item) => item.key);
    setPermissions((current) => {
      const allOn = keys.every((key) => current.includes(key));
      return allOn
        ? current.filter((key) => !keys.includes(key))
        : Array.from(new Set([...current, ...keys]));
    });
  };

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        if (isEdit && role) {
          await updateRole(role.id, {
            displayName: values.displayName.trim(),
            description: values.description.trim(),
            ...(permsLocked ? {} : { permissions }),
          });
          message.success(t("systemAdmin.roles.toast.saved"));
        } else {
          await createRole({
            name: values.name.trim(),
            displayName: values.displayName.trim(),
            description: values.description.trim(),
            permissions,
          });
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
          <span className={styles.footNote}>
            {isEdit ? "PUT" : "POST"} /authorization/v1/roles
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
          ? t("systemAdmin.roles.drawer.editTitle", { name: role?.displayName })
          : t("systemAdmin.roles.drawer.createTitle")
      }
      width={620}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t("systemAdmin.roles.drawer.name")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input
            disabled={isEdit}
            placeholder={t("systemAdmin.roles.drawer.namePlaceholder")}
          />
        </Form.Item>
        <Form.Item
          label={t("systemAdmin.roles.drawer.displayName")}
          name="displayName"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input placeholder={t("systemAdmin.roles.drawer.displayNamePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("systemAdmin.roles.drawer.description")} name="description">
          <Input placeholder={t("systemAdmin.roles.drawer.descriptionPlaceholder")} />
        </Form.Item>
        <Form.Item
          label={
            <span>
              {t("systemAdmin.roles.drawer.permissions")}{" "}
              <span className={styles.subText}>
                {t("systemAdmin.roles.drawer.permissionsHint")}
              </span>
            </span>
          }
        >
          {permsLocked ? (
            <div className={[styles.calloutBox, styles.calloutWarn].join(" ")} style={{ marginBottom: 12 }}>
              <InfoCircleOutlined />
              <span>{t("systemAdmin.roles.drawer.builtinLocked")}</span>
            </div>
          ) : null}
          <div className={styles.permGroupGrid}>
            {PERMISSION_GROUPS.map((group) => {
              const perms = permissionsByGroup(group);
              if (!perms.length) {
                return null;
              }
              const allOn = perms.every((perm) => permissions.includes(perm.key));
              return (
                <div className={styles.permGroup} key={group}>
                  <div className={styles.permGroupHead}>
                    <span className={styles.permGroupTitle}>{group}</span>
                    {!permsLocked ? (
                      <AppButton
                        className={styles.actionLink}
                        onClick={() => toggleGroup(group)}
                        size="small"
                        type="link"
                      >
                        {allOn
                          ? t("systemAdmin.roles.drawer.deselectAll")
                          : t("systemAdmin.roles.drawer.selectAll")}
                      </AppButton>
                    ) : null}
                  </div>
                  <div className={styles.chipGroup}>
                    {perms.map((perm) => (
                      <button
                        className={[
                          styles.chipOpt,
                          permissions.includes(perm.key) ? styles.chipOptSelected : "",
                          permsLocked ? styles.chipDisabled : "",
                        ].join(" ")}
                        disabled={permsLocked}
                        key={perm.key}
                        onClick={() => togglePermission(perm.key)}
                        type="button"
                      >
                        <span className={styles.chipCode}>{perm.key}</span>
                        <span className={styles.chipType}>{perm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
