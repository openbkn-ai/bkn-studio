/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Select, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listRoles, setRolePermission } from "@/modules/system-admin/services/admin.service";
import type { AdminRole } from "@/modules/system-admin/types/admin";
import {
  operationLabel,
  operationsForType,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type CatalogAuthorizeModalProps = {
  catalogId: string;
  catalogName: string;
  onClose: () => void;
  open: boolean;
};

const CATALOG_OPS = operationsForType("catalog");

type CatalogGrantRow = {
  operations: string[];
  role: AdminRole;
  wholeType: boolean;
};

export function CatalogAuthorizeModal({
  catalogId,
  catalogName,
  onClose,
  open,
}: CatalogAuthorizeModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleId, setRoleId] = useState<string>();
  const [ops, setOps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await listRoles());
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  // 已对这条 catalog(或整类)授权的角色。
  const grantRows = useMemo<CatalogGrantRow[]>(() => {
    const rows: CatalogGrantRow[] = [];
    for (const role of roles) {
      const direct = role.permissions.find(
        (grant) => grant.resource.type === "catalog" && grant.resource.id === catalogId,
      );
      const wildcard = role.permissions.find(
        (grant) =>
          (grant.resource.type === "catalog" || grant.resource.type === "*") &&
          grant.resource.id === WILDCARD,
      );
      if (direct) {
        rows.push({ role, operations: direct.operations, wholeType: false });
      } else if (wildcard) {
        rows.push({ role, operations: wildcard.operations, wholeType: true });
      }
    }
    return rows;
  }, [catalogId, roles]);

  const candidateRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          !role.builtin &&
          !role.permissions.some(
            (grant) => grant.resource.type === "catalog" && grant.resource.id === catalogId,
          ),
      ),
    [catalogId, roles],
  );

  const handleGrant = async () => {
    if (!roleId || !ops.length) {
      return;
    }
    setBusy(true);
    try {
      await setRolePermission(roleId, true, {
        resource: { type: "catalog", id: catalogId },
        operations: ops,
      });
      const role = roles.find((item) => item.id === roleId);
      message.success(t("systemAdmin.authorize.granted", { role: role?.name ?? roleId }));
      setRoleId(undefined);
      setOps([]);
      await load();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (row: CatalogGrantRow) => {
    if (row.wholeType || row.role.builtin) {
      return;
    }
    setBusy(true);
    try {
      await setRolePermission(row.role.id, false, {
        resource: { type: "catalog", id: catalogId },
        operations: row.operations,
      });
      message.success(t("systemAdmin.authorize.revoked", { role: row.role.name }));
      await load();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={t("systemAdmin.authorize.title", { name: catalogName })}
      width={600}
    >
      <p className={styles.subText} style={{ marginTop: 0 }}>
        {t("systemAdmin.authorize.subtitle")}
      </p>

      <div className={styles.grantAddRow} style={{ marginBottom: 16 }}>
        <Select
          loading={loading}
          onChange={setRoleId}
          optionFilterProp="label"
          options={candidateRoles.map((role) => ({
            label: `${role.name}${role.description ? ` · ${role.description}` : ""}`,
            value: role.id,
          }))}
          placeholder={t("systemAdmin.authorize.rolePlaceholder")}
          showSearch
          style={{ flex: 1, minWidth: 180 }}
          value={roleId}
        />
        <Select
          mode="multiple"
          onChange={setOps}
          options={CATALOG_OPS.map((op) => ({ label: op.label, value: op.key }))}
          placeholder={t("systemAdmin.authorize.operationsPlaceholder")}
          style={{ flex: 1, minWidth: 200 }}
          value={ops}
        />
        <AppButton loading={busy} onClick={() => void handleGrant()} type="primary">
          {t("systemAdmin.authorize.grant")}
        </AppButton>
      </div>

      <div className={styles.subText} style={{ marginBottom: 8 }}>
        {t("systemAdmin.authorize.currentGrants")}
      </div>
      {grantRows.length ? (
        <div className={styles.memberList}>
          {grantRows.map((row) => (
            <div className={styles.memberItem} key={row.role.id}>
              <span className={styles.memberName}>
                {row.role.name}
                {row.wholeType ? (
                  <Tag className={styles.permChip}>{t("systemAdmin.grant.wholeType")}</Tag>
                ) : null}
                <span className={styles.chipRow}>
                  {row.operations.map((op) => (
                    <Tag className={styles.permChip} key={op}>
                      {op === "*" ? t("systemAdmin.grant.allOps") : operationLabel("catalog", op)}
                    </Tag>
                  ))}
                </span>
              </span>
              {!row.wholeType && !row.role.builtin ? (
                <AppButton
                  className={[styles.actionLink, styles.actionDanger].join(" ")}
                  loading={busy}
                  onClick={() => void handleRevoke(row)}
                  type="link"
                >
                  {t("systemAdmin.authorize.revoke")}
                </AppButton>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>{t("systemAdmin.authorize.empty")}</p>
      )}

      <p className={styles.footNote} style={{ marginTop: 16 }}>
        {t("systemAdmin.authorize.note")}
      </p>
    </Modal>
  );
}
