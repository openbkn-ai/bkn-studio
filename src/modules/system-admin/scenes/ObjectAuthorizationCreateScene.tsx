/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listDepartments, listUsers } from "@/modules/system-admin/services/admin.service";
import {
  listAuthorizableObjects,
  upsertObjectGrant,
} from "@/modules/system-admin/services/authz.service";
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";
import type { AuthorizableObject } from "@/modules/system-admin/types/authz";
import { HIDDEN_INSTANCE_OPS } from "@/modules/system-admin/utils/authz-catalog";
import { operationsForType, resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

import styles from "./admin.module.css";

function parseObjValue(value?: string): { objId: string; objType: string } | null {
  if (!value) {
    return null;
  }
  const [type, id] = value.split("::");
  if (!type || !id) {
    return null;
  }
  return { objId: id, objType: type };
}

export function ObjectAuthorizationCreateScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [objects, setObjects] = useState<AuthorizableObject[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);

  const [objectValue, setObjectValue] = useState<string>();
  const [granteeIds, setGranteeIds] = useState<string[]>([]);
  const [opKeys, setOpKeys] = useState<string[]>([]);

  const selectedObject = useMemo(() => {
    const parsed = parseObjValue(objectValue);
    if (!parsed) {
      return null;
    }
    const meta = objects.find((item) => item.type === parsed.objType && item.id === parsed.objId);
    return meta
      ? { objType: meta.type, objId: meta.id, objName: meta.name, objSub: meta.sub }
      : {
          objType: parsed.objType,
          objId: parsed.objId,
          objName: parsed.objId,
          objSub: undefined,
        };
  }, [objectValue, objects]);

  const ops = useMemo(() => {
    if (!selectedObject) {
      return [];
    }
    return operationsForType(selectedObject.objType).filter((op) => !HIDDEN_INSTANCE_OPS.has(op.key));
  }, [selectedObject]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [objList, userList, deptList] = await Promise.all([
        listAuthorizableObjects(),
        listUsers(),
        listDepartments(),
      ]);
      setObjects(objList);
      setUsers(userList);
      setDepartments(deptList);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedObject || !ops.length) {
      setOpKeys([]);
      return;
    }
    setOpKeys((prev) => {
      if (prev.length > 0) {
        return prev.filter((key) => ops.some((op) => op.key === key));
      }
      const defaultOp = ops.find((op) => /view|display|list/.test(op.key))?.key ?? ops[0]?.key;
      return defaultOp ? [defaultOp] : [];
    });
  }, [ops, selectedObject]);

  const objectOptions = useMemo(() => {
    const byType = new Map<string, AuthorizableObject[]>();
    for (const obj of objects) {
      const list = byType.get(obj.type) ?? [];
      list.push(obj);
      byType.set(obj.type, list);
    }
    return [...byType.entries()].map(([type, list]) => ({
      label: resourceTypeLabel(type),
      options: list.map((obj) => ({
        label: obj.sub ? `${obj.name} (${obj.sub})` : obj.name,
        value: `${obj.type}::${obj.id}`,
      })),
    }));
  }, [objects]);

  const granteeOptions = useMemo(
    () => [
      {
        label: t("systemAdmin.objectGrants.granteeUser"),
        options: users.map((user) => ({
          value: user.id,
          label: `${user.name} (${user.account})`,
        })),
      },
      {
        label: t("systemAdmin.objectGrants.granteeDept"),
        options: departments.map((department) => ({
          value: department.id,
          label: department.name,
        })),
      },
    ],
    [departments, t, users],
  );

  const toggleOp = (opKey: string) => {
    setOpKeys((prev) =>
      prev.includes(opKey) ? prev.filter((key) => key !== opKey) : [...prev, opKey],
    );
  };

  const handleSubmit = async () => {
    if (!selectedObject) {
      void message.error(t("systemAdmin.objectGrants.pickObjectFirst"));
      return;
    }
    if (!granteeIds.length) {
      void message.error(t("systemAdmin.objectGrants.pickGranteeFirst"));
      return;
    }
    if (!opKeys.length) {
      void message.error(t("systemAdmin.objectGrants.pickOpsFirst"));
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        granteeIds.map((accessorId) =>
          upsertObjectGrant({
            accessorId,
            objId: selectedObject.objId,
            objName: selectedObject.objName,
            objSub: selectedObject.objSub,
            objType: selectedObject.objType,
            operations: opKeys,
          }),
        ),
      );
      message.success(t("systemAdmin.objectGrants.toast.grantCreated"));
      navigate("/system/authorizations");
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}
      data-page="object-authz-create"
    >
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <AppButton
              icon={<ArrowLeftOutlined />}
              onClick={() => void navigate("/system/authorizations")}
            >
              {t("common.back")}
            </AppButton>
          </div>
          <div className={styles.toolbarMeta}>
            <div className={styles.pageTitle}>{t("systemAdmin.objectGrants.createPageTitle")}</div>
            <div className={styles.pageSubtitle}>
              {t("systemAdmin.objectGrants.createPageHint")}
            </div>
          </div>
        </div>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} type="link">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          type="error"
        />
      ) : loading ? (
        <div className={styles.createLoading}>
          <Spin />
        </div>
      ) : (
        <>
          <div className={styles.createFormStack}>
            <section className={styles.createPanel}>
              <div className={styles.createPanelHead}>
                <h3 className={styles.createPanelTitle}>
                  {t("systemAdmin.objectGrants.createPagePickObject")}
                </h3>
              </div>
              <div className={styles.createPanelBody}>
                <Select
                  allowClear
                  onChange={(value) => setObjectValue(value)}
                  optionFilterProp="label"
                  options={objectOptions}
                  placeholder={t("systemAdmin.objectGrants.pickerObjectPlaceholder")}
                  showSearch
                  value={objectValue}
                />
                {selectedObject ? (
                  <div className={styles.createSummaryBox}>
                    <div className={styles.nameCell}>
                      <span className={styles.nameTitle}>{selectedObject.objName}</span>
                      {selectedObject.objSub ? (
                        <span className={styles.subText}>{selectedObject.objSub}</span>
                      ) : null}
                    </div>
                    <Tag className={styles.roleTag}>
                      {resourceTypeLabel(selectedObject.objType)}
                    </Tag>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.createPanel}>
              <div className={styles.createPanelHead}>
                <h3 className={styles.createPanelTitle}>
                  {t("systemAdmin.objectGrants.createPagePickGrantee")}
                </h3>
                <p className={styles.createPanelDesc}>
                  {t("systemAdmin.objectGrants.createPageGranteeHint")}
                </p>
              </div>
              <div className={styles.createPanelBody}>
                <Select
                  mode="multiple"
                  onChange={(value) => setGranteeIds(value)}
                  optionFilterProp="label"
                  options={granteeOptions}
                  placeholder={t("systemAdmin.objectGrants.pickerGranteePlaceholder")}
                  showSearch
                  value={granteeIds}
                />
              </div>
            </section>

            <section className={styles.createPanel}>
              <div className={styles.createPanelHead}>
                <h3 className={styles.createPanelTitle}>
                  {t("systemAdmin.objectGrants.createPagePickOps")}
                </h3>
                <p className={styles.createPanelDesc}>
                  {t("systemAdmin.objectGrants.createPageOpsPlaceholder")}
                </p>
              </div>
              <div className={styles.createPanelBody}>
                {selectedObject ? (
                  <div className={styles.chipGroup}>
                    {ops.map((op) => (
                      <button
                        className={[
                          styles.chipOpt,
                          opKeys.includes(op.key) ? styles.chipOptSelected : "",
                        ].join(" ")}
                        key={op.key}
                        onClick={() => toggleOp(op.key)}
                        type="button"
                      >
                        <span className={styles.chipCode}>{op.label}</span>
                        <span className={styles.chipType}>{op.key}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.createPanelDesc}>
                    {t("systemAdmin.objectGrants.pickObjectFirst")}
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className={styles.createFooterBar}>
            <AppButton onClick={() => void navigate("/system/authorizations")}>
              {t("common.cancel")}
            </AppButton>
            <PermissionGate permissions="admin-authz:grant">
              <AppButton loading={saving} onClick={() => void handleSubmit()} type="primary">
                {t("common.confirm")}
              </AppButton>
            </PermissionGate>
          </div>
        </>
      )}
    </section>
  );
}
