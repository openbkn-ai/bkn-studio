/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  BulbOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FunctionOutlined,
  LockOutlined,
  PlusOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Drawer, Empty, Select, Spin, Tag, Tooltip } from "antd";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listUsers } from "@/modules/system-admin/services/admin.service";
import {
  listObjectGrants,
  revokeObjectGrant,
  upsertObjectGrant,
} from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import type { ObjectGrant } from "@/modules/system-admin/types/authz";
import { HIDDEN_INSTANCE_OPS } from "@/modules/system-admin/utils/authz-catalog";
import {
  operationsForType,
  resourceTypeLabel,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ObjectAuthorizeDrawerProps = {
  objId: string;
  objName: string;
  objSub?: string;
  objType: string;
  onChanged?: () => void;
  onClose: () => void;
  open: boolean;
};

const OBJ_ICON: Record<string, ReactNode> = {
  catalog: <DatabaseOutlined />,
  resource: <DatabaseOutlined />,
  knowledge_network: <DeploymentUnitOutlined />,
  small_model: <AppstoreOutlined />,
  large_model: <AppstoreOutlined />,
  operator: <FunctionOutlined />,
  tool_box: <ToolOutlined />,
  mcp: <ApiOutlined />,
  skill: <BulbOutlined />,
};

export function ObjectAuthorizeDrawer({
  objId,
  objName,
  objSub,
  objType,
  onChanged,
  onClose,
  open,
}: ObjectAuthorizeDrawerProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<string>();

  // 对象授权只给「实例级」操作，隐藏类型级的 create。
  const ops = useMemo(
    () => operationsForType(objType).filter((op) => !HIDDEN_INSTANCE_OPS.has(op.key)),
    [objType],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grantList, userList] = await Promise.all([listObjectGrants(), listUsers()]);
      setGrants(grantList.filter((g) => g.objType === objType && g.objId === objId));
      setUsers(userList);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, objId, objType]);

  useEffect(() => {
    if (open) {
      setCandidate(undefined);
      void load();
    }
  }, [load, open]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userName = useCallback((id: string) => userMap.get(id)?.name ?? id, [userMap]);
  const userAccount = useCallback((id: string) => userMap.get(id)?.account ?? "", [userMap]);
  // 内置(超级)管理员本就拥有全部权限,其授权不可在此调整或移除。
  const isProtected = useCallback(
    (id: string) => userMap.get(id)?.builtin === true,
    [userMap],
  );

  // 候选用户（排除本对象已授权的）。
  const candidates = useMemo(() => {
    const taken = new Set(grants.map((g) => g.accessorId));
    return users
      .filter((u) => !taken.has(u.id))
      .map((u) => ({ value: u.id, label: `${u.name}（${u.account}）` }));
  }, [grants, users]);

  const targetOf = (grant: ObjectGrant) => ({
    accessorId: grant.accessorId,
    objType: grant.objType,
    objId: grant.objId,
    objName: grant.objName,
    objSub: grant.objSub,
  });

  const handleAdd = async () => {
    if (!candidate) {
      void message.error(t("systemAdmin.objectGrants.pickGranteeFirst"));
      return;
    }
    // 默认给一个「只读」类操作占位，再让用户在卡片里调整。
    const defaultOp = ops.find((op) => /view|display|list/.test(op.key))?.key ?? ops[0]?.key;
    if (!defaultOp) {
      return;
    }
    setBusy(true);
    try {
      await upsertObjectGrant({ accessorId: candidate, objType, objId, objName, objSub, operations: [defaultOp] });
      message.success(t("systemAdmin.objectGrants.toast.granteeAdded"));
      setCandidate(undefined);
      await load();
      onChanged?.();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleOp = async (grant: ObjectGrant, opKey: string) => {
    const next = grant.operations.includes(opKey)
      ? grant.operations.filter((op) => op !== opKey)
      : [...grant.operations, opKey];
    const commit = async () => {
      setBusy(true);
      try {
        await upsertObjectGrant({ ...targetOf(grant), operations: next });
        await load();
        onChanged?.();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setBusy(false);
      }
    };
    if (!next.length) {
      void modal.confirm({
        title: t("systemAdmin.objectGrants.removeGrantTitle"),
        content: t("systemAdmin.objectGrants.removeLastOpConfirm"),
        okText: t("common.delete"),
        cancelText: t("common.cancel"),
        okButtonProps: { danger: true },
        onOk: commit,
      });
      return;
    }
    await commit();
  };

  const handleRemove = (grant: ObjectGrant) => {
    void modal.confirm({
      title: t("systemAdmin.objectGrants.removeGrantTitle"),
      content: t("systemAdmin.objectGrants.removeGrantConfirm", { name: userName(grant.accessorId) }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revokeObjectGrant(grant.accessorId, grant.objType, grant.objId);
          message.success(t("systemAdmin.objectGrants.toast.revoked"));
          await load();
          onChanged?.();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={t("systemAdmin.objectGrants.drawerTitle", { name: objName })}
      width={640}
    >
      <div className={styles.authzObjHead}>
        <span className={styles.authzAvatar}>{OBJ_ICON[objType] ?? <AppstoreOutlined />}</span>
        <div className={styles.authzObjMeta}>
          <div className={styles.authzObjName}>
            {objName}
            <Tag className={styles.roleTag}>{resourceTypeLabel(objType)}</Tag>
          </div>
          {objSub ? <span className={styles.subText}>{objSub}</span> : null}
        </div>
      </div>

      <div className={[styles.calloutBox, styles.sectionCalloutBottom].join(" ")}>
        <span>{t("systemAdmin.objectGrants.drawerHint")}</span>
      </div>

      <div className={styles.grantAddRow}>
        <Select
          loading={loading}
          onChange={setCandidate}
          optionFilterProp="label"
          options={candidates}
          placeholder={t("systemAdmin.objectGrants.addGranteePlaceholder")}
          showSearch
          style={{ flex: 1, minWidth: 220 }}
          value={candidate}
        />
        <AppButton icon={<PlusOutlined />} loading={busy} onClick={() => void handleAdd()} type="primary">
          {t("systemAdmin.objectGrants.add")}
        </AppButton>
      </div>

      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <Spin />
        </div>
      ) : grants.length ? (
        <div className={styles.authzList}>
          {grants.map((grant) => {
            const locked = isProtected(grant.accessorId);
            return (
              <div className={styles.authzCard} key={grant.accessorId}>
                <div className={styles.authzCardHead}>
                  <span className={styles.authzWho}>
                    <span className={styles.authzAvatar}>
                      <UserOutlined />
                    </span>
                    <span className={styles.authzWhoName}>{userName(grant.accessorId)}</span>
                    <span className={styles.authzWhoSub}>{userAccount(grant.accessorId)}</span>
                  </span>
                  {locked ? (
                    <Tooltip title={t("systemAdmin.objectGrants.adminLocked")}>
                      <span className={styles.subText}>
                        <LockOutlined />
                      </span>
                    </Tooltip>
                  ) : (
                    <AppButton
                      className={[styles.actionLink, styles.actionDanger].join(" ")}
                      onClick={() => handleRemove(grant)}
                      type="link"
                    >
                      {t("systemAdmin.objectGrants.remove")}
                    </AppButton>
                  )}
                </div>
                <div className={styles.chipGroup}>
                  {ops.map((op) => (
                    <button
                      className={[styles.chipOpt, grant.operations.includes(op.key) ? styles.chipOptSelected : ""].join(" ")}
                      disabled={busy || locked}
                      key={op.key}
                      onClick={() => void toggleOp(grant, op.key)}
                      type="button"
                    >
                      <span className={styles.chipCode}>{op.label}</span>
                      <span className={styles.chipType}>{op.key}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          description={t("systemAdmin.objectGrants.drawerEmpty")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: "20px 0" }}
        />
      )}
    </Drawer>
  );
}
