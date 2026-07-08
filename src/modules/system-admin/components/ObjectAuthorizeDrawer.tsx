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
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listUsersPage } from "@/modules/system-admin/services/admin.service";
import {
  listObjectGrants,
  revokeObjectGrant,
  upsertObjectGrant,
} from "@/modules/system-admin/services/authz.service";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import type { ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  getCachedDepartments,
  getCachedUserSync,
  hydrateUserLookup,
  primeUserLookupCache,
} from "@/modules/system-admin/utils/audit-lookup-cache";
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
  /** 鍦ㄦ柊寤烘祦绋嬩腑棰勯€夎鎺堟潈鏂癸紙鍙€夛級銆?*/
  prefillGranteeId?: string;
  /** 鐖剁骇宸插姞杞界殑鎺堟潈鍒楄〃锛涙彁渚涙椂涓嶅啀閲嶅鎷夊叏閲?grants銆?*/
  allGrants?: ObjectGrant[];
  onGrantsChange?: (grants: ObjectGrant[]) => void;
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

function filterObjectGrants(grants: ObjectGrant[], objType: string, objId: string) {
  return grants.filter((grant) => grant.objType === objType && grant.objId === objId);
}

function mergeObjectGrants(
  allGrants: ObjectGrant[],
  objType: string,
  objId: string,
  objectGrants: ObjectGrant[],
) {
  const others = allGrants.filter((grant) => !(grant.objType === objType && grant.objId === objId));
  return [...others, ...objectGrants];
}

export function ObjectAuthorizeDrawer({
  objId,
  objName,
  objSub,
  objType,
  prefillGranteeId,
  allGrants,
  onGrantsChange,
  onChanged,
  onClose,
  open,
}: ObjectAuthorizeDrawerProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<string>();
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const debouncedCandidateKeyword = useDebouncedValue(candidateKeyword.trim(), 300);
  const [candidateUserOptions, setCandidateUserOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [candidateSearchLoading, setCandidateSearchLoading] = useState(false);

  const ops = useMemo(
    () => operationsForType(objType).filter((op) => !HIDDEN_INSTANCE_OPS.has(op.key)),
    [objType],
  );

  const syncLookup = useCallback(async (accessorIds: string[]) => {
    const deptList = await getCachedDepartments();
    setDepartments(deptList);
    await hydrateUserLookup(accessorIds);
    setLookupRevision((revision) => revision + 1);
  }, []);

  const loadRemote = useCallback(async () => {
    setLoading(true);
    try {
      const grantList = await listObjectGrants({ resourceType: objType, resourceId: objId });
      setGrants(grantList);
      await syncLookup(grantList.map((grant) => grant.accessorId));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, objId, objType, syncLookup]);

  const applyLocalGrants = useCallback(
    (nextObjectGrants: ObjectGrant[]) => {
      setGrants(nextObjectGrants);
      if (allGrants && onGrantsChange) {
        onGrantsChange(mergeObjectGrants(allGrants, objType, objId, nextObjectGrants));
      }
    },
    [allGrants, objId, objType, onGrantsChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setCandidate(prefillGranteeId);
    setCandidateKeyword("");
    if (allGrants) {
      const filtered = filterObjectGrants(allGrants, objType, objId);
      setGrants(filtered);
      setLoading(false);
      void syncLookup(filtered.map((grant) => grant.accessorId));
      return;
    }
    void loadRemote();
  }, [allGrants, loadRemote, objId, objType, open, prefillGranteeId, syncLookup]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setCandidateSearchLoading(true);
    void listUsersPage({ search: debouncedCandidateKeyword || undefined, limit: 20 })
      .then(({ users }) => {
        if (cancelled) {
          return;
        }
        primeUserLookupCache(users);
        setCandidateUserOptions(
          users.map((user) => ({
            value: user.id,
            label: `${user.name}锛?{user.account}锛塦,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCandidateUserOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCandidateSearchLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCandidateKeyword, open]);

  const deptMap = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );

  const isProtected = useCallback(
    (id: string) => {
      void lookupRevision;
      return getCachedUserSync(id)?.builtin === true;
    },
    [lookupRevision],
  );

  const resolveGrantee = useCallback(
    (id: string) => {
      void lookupRevision;
      const user = getCachedUserSync(id);
      if (user) {
        return { id, name: user.name, sub: user.account, type: "user" as const };
      }
      const dept = deptMap.get(id);
      if (dept) {
        return { id, name: dept.name, sub: undefined, type: "department" as const };
      }
      return { id, name: id, sub: undefined, type: "user" as const };
    },
    [deptMap, lookupRevision],
  );

  const hasProtectedGrant = useMemo(
    () => grants.some((grant) => isProtected(grant.accessorId)),
    [grants, isProtected],
  );

  const candidates = useMemo(() => {
    const taken = new Set(grants.map((grant) => grant.accessorId));
    const userOptions = candidateUserOptions.filter((option) => !taken.has(option.value));
    const deptOptions = departments
      .filter((department) => !taken.has(department.id))
      .map((department) => ({ value: department.id, label: department.name }));
    return [
      { label: t("systemAdmin.objectGrants.granteeUser"), options: userOptions },
      { label: t("systemAdmin.objectGrants.granteeDept"), options: deptOptions },
    ];
  }, [candidateUserOptions, departments, grants, t]);

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
    const defaultOp = ops.find((op) => /view|display|list/.test(op.key))?.key ?? ops[0]?.key;
    if (!defaultOp) {
      return;
    }
    setBusy(true);
    try {
      await upsertObjectGrant({
        accessorId: candidate,
        objType,
        objId,
        objName,
        objSub,
        operations: [defaultOp],
      });
      message.success(t("systemAdmin.objectGrants.toast.granteeAdded"));
      setCandidate(undefined);
      const nextGrant: ObjectGrant = {
        accessorId: candidate,
        objType,
        objId,
        objName,
        objSub,
        operations: [defaultOp],
      };
      const nextGrants = [...grants.filter((grant) => grant.accessorId !== candidate), nextGrant];
      applyLocalGrants(nextGrants);
      await hydrateUserLookup([candidate]);
      setLookupRevision((revision) => revision + 1);
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
        const nextGrants = next.length
          ? grants.map((item) =>
              item.accessorId === grant.accessorId ? { ...item, operations: next } : item,
            )
          : grants.filter((item) => item.accessorId !== grant.accessorId);
        applyLocalGrants(nextGrants);
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
    const grantee = resolveGrantee(grant.accessorId);
    void modal.confirm({
      title: t("systemAdmin.objectGrants.removeGrantTitle"),
      content: t("systemAdmin.objectGrants.removeGrantConfirm", { name: grantee.name }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revokeObjectGrant(grant.accessorId, grant.objType, grant.objId);
          message.success(t("systemAdmin.objectGrants.toast.revoked"));
          applyLocalGrants(grants.filter((item) => item.accessorId !== grant.accessorId));
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
      width={720}
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
        <div className={styles.authzObjStats}>
          <span className={styles.authzObjStat}>
            <strong>{grants.length}</strong>
            <span>
              {t("systemAdmin.objectGrants.granteeUser")}/{t("systemAdmin.objectGrants.granteeDept")}
            </span>
          </span>
          <span className={styles.authzObjStat}>
            <strong>{ops.length}</strong>
            <span>{t("systemAdmin.objectGrants.columns.operations")}</span>
          </span>
        </div>
      </div>

      <div className={[styles.calloutBox, styles.sectionCalloutBottom].join(" ")}>
        <span>{t("systemAdmin.objectGrants.drawerHint")}</span>
      </div>

      <section className={styles.createPanel}>
        <div className={styles.createPanelHead}>
          <h3 className={styles.createPanelTitle}>{t("systemAdmin.objectGrants.add")}</h3>
          <p className={styles.createPanelDesc}>{t("systemAdmin.objectGrants.addGranteePlaceholder")}</p>
        </div>
        <div className={styles.createPanelBody}>
          <div className={styles.grantAddRow}>
            <Select
              filterOption={false}
              loading={loading || candidateSearchLoading}
              notFoundContent={candidateSearchLoading ? <Spin size="small" /> : null}
              onChange={setCandidate}
              onSearch={setCandidateKeyword}
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
        </div>
      </section>

      {loading ? (
        <div className={styles.createLoading}>
          <Spin />
        </div>
      ) : grants.length ? (
        <section className={[styles.createPanel, styles.sectionCallout].join(" ")}>
          <div className={styles.createPanelHead}>
            <h3 className={styles.createPanelTitle}>{t("systemAdmin.objectGrants.manage")}</h3>
            <p className={styles.createPanelDesc}>{t("systemAdmin.objectGrants.drawerHint")}</p>
          </div>
          <div className={styles.createPanelBody}>
            {hasProtectedGrant ? (
              <div className={[styles.calloutBox, styles.calloutWarn].join(" ")}>
                <LockOutlined />
                <span>{t("systemAdmin.objectGrants.adminLocked")}</span>
              </div>
            ) : null}
            <div className={styles.authzList}>
              {grants.map((grant) => {
                const locked = isProtected(grant.accessorId);
                const grantee = resolveGrantee(grant.accessorId);
                return (
                  <div className={styles.authzCard} key={grant.accessorId}>
                    <div className={styles.authzCardHead}>
                      <span className={styles.authzWho}>
                        <span className={styles.authzAvatar}>
                          {grantee.type === "department" ? <AppstoreOutlined /> : <UserOutlined />}
                        </span>
                        <span className={styles.authzWhoName}>{grantee.name}</span>
                        {grantee.sub ? <span className={styles.authzWhoSub}>{grantee.sub}</span> : null}
                        <Tag className={styles.granteeTag}>
                          {grantee.type === "department"
                            ? t("systemAdmin.objectGrants.granteeDept")
                            : t("systemAdmin.objectGrants.granteeUser")}
                        </Tag>
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
                          className={[
                            styles.chipOpt,
                            grant.operations.includes(op.key) ? styles.chipOptSelected : "",
                          ].join(" ")}
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
          </div>
        </section>
      ) : (
        <section className={[styles.createPanel, styles.sectionCallout].join(" ")}>
          <div className={styles.createPanelHead}>
            <h3 className={styles.createPanelTitle}>{t("systemAdmin.objectGrants.manage")}</h3>
            <p className={styles.createPanelDesc}>{t("systemAdmin.objectGrants.drawerHint")}</p>
          </div>
          <div className={styles.createPanelBody}>
            <Empty
              description={t("systemAdmin.objectGrants.drawerEmpty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </section>
      )}
    </Drawer>
  );
}
