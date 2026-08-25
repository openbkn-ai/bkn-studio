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
import { hasPermissions } from "@/framework/permission/has-permissions";
import { authzPoints } from "@/modules/system-admin/permissions";
import { chipTogglePoint } from "@/modules/system-admin/utils/authz-actions";
import { listUsersPage } from "@/modules/system-admin/services/admin.service";
import {
  listObjectGrantsForObject,
  revokeObjectGrantForObject,
  upsertObjectGrantForObject,
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
  /**
   * Whether the caller holds `authorize` on THIS object, from the object's own record rather than
   * from the global permission set (which drops resource.id and cannot answer per-object questions).
   * Omitted means "decide from the admin permission points alone", which is what the platform
   * authorization page and the model panels want.
   */
  objectAuthorized?: boolean;
  objId: string;
  objName: string;
  objSub?: string;
  objType: string;
  /** Optionally preselect the grantee during creation. */
  prefillGranteeId?: string;
  /** Grant list already loaded by the parent; when provided, do not fetch all grants again. */
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

/** The subject bkn-safe writes when the execution factory publishes something to everyone. */
const PUBLIC_ACCESSOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Whether bkn-safe will refuse a non-administrator write against this row
 * (its protectAuthorizeHolder guard), so the drawer can lock it rather than offer a control that
 * always 403s.
 *
 * Two rows are off limits to a delegate, and both because the write erases: POST is
 * replace-semantics and DELETE removes everything the accessor holds.
 *
 * - A row carrying `authorize` — the object's creator, or anyone an administrator trusted with
 *   sharing. Letting a delegate rewrite it would let them take the object away from the person who
 *   made it, and `authorize` is administrator-conferred, so nobody inside the drawer could put it
 *   back. This covers the caller's OWN row: an owner cannot drop their own authorize either.
 * - The public-access row, whose removal would un-publish the object platform-wide.
 */
function isDelegateProtected(grant: ObjectGrant) {
  return grant.accessorId === PUBLIC_ACCESSOR_ID || grant.operations.includes("authorize");
}

export function ObjectAuthorizeDrawer({
  objectAuthorized = false,
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
  const { message, modal, runtimeConfig } = useAppServices();
  // The drawer is a complete write panel for grants, operation changes, and revocation, but seeing
  // who has access to an object is legitimate for read-only reviewers. Guard each write control,
  // rather than blocking access to the drawer.
  //
  // Two ways to earn the write controls, matching what bkn-safe accepts: the platform-wide
  // admin-authz points, or `authorize` on this one object — the row the domain services write to
  // whoever created it. Without the second, the person the grant was written for opened the drawer
  // and could only look.
  const currentPermissions = runtimeConfig.currentUser.permissions;
  const isAdminGrantor = hasPermissions({
    currentPermissions,
    requiredPermissions: authzPoints.grant,
  });
  const canGrant = objectAuthorized || isAdminGrantor;
  const canRevoke =
    objectAuthorized ||
    hasPermissions({
      currentPermissions,
      requiredPermissions: authzPoints.revoke,
    });
  const canManageGrants = canGrant || canRevoke;
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

  // `authorize` is offered only to platform administrators. bkn-safe refuses it from anyone else —
  // a delegate that could pass `authorize` on would mint further delegates, and only an
  // administrator can take it back — so showing the chip to an owner would be a control that always
  // 403s. Owners share their object; deciding who else may share it stays administrative.
  const ops = useMemo(
    () =>
      operationsForType(objType).filter(
        (op) =>
          !HIDDEN_INSTANCE_OPS.has(op.key) && (op.key !== "authorize" || !objectAuthorized || isAdminGrantor),
      ),
    [isAdminGrantor, objType, objectAuthorized],
  );

  // Best-effort: departments and user details come from admin-path endpoints. Those reads now admit
  // the holder of `authorize` on a concrete object as well as the platform administrator, so an
  // owner gets real answers here — a narrower projection than an administrator sees, which is all
  // this drawer displays. A failure still costs a label rather than the screen.
  const syncLookup = useCallback(async (accessorIds: string[]) => {
    try {
      setDepartments(await getCachedDepartments());
      await hydrateUserLookup(accessorIds);
    } catch {
      // Leave whatever the cache already holds.
    }
    setLookupRevision((revision) => revision + 1);
  }, []);

  const loadRemote = useCallback(async () => {
    setLoading(true);
    try {
      const { accounts, grants: grantList } = await listObjectGrantsForObject(objType, objId);
      // Prime first: these accounts are the only source of names an owner has.
      primeUserLookupCache(accounts);
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
    // Nothing typed lists the first page rather than nothing, which is how every other grantee
    // picker in the console behaves (role members, department members, the administrator's
    // authorization page). This drawer was the exception only because the owner surface could not
    // reach the directory at all and had to use a per-object endpoint that made search mandatory;
    // now that an object owner may read it, opening the field shows people again.
    void listUsersPage({ limit: 20, search: debouncedCandidateKeyword || undefined }, { skipErrorToast: true })
      .then((result) => result.users)
      .then((users) => {
        if (cancelled) {
          return;
        }
        primeUserLookupCache(users);
        setCandidateUserOptions(
          users.map((user) => ({
            value: user.id,
            label: `${user.name}（${user.account}）`,
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
  }, [debouncedCandidateKeyword, objId, objType, open]);

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

  // Users only — the backend rejects department accessors (see ObjectAuthorizationCreateScene).
  // Departments are still resolved for display, since older grants may name one.
  const candidates = useMemo(() => {
    const taken = new Set(grants.map((grant) => grant.accessorId));
    const userOptions = candidateUserOptions.filter((option) => !taken.has(option.value));
    return [{ label: t("systemAdmin.objectGrants.granteeUser"), options: userOptions }];
  }, [candidateUserOptions, grants, t]);

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
      await upsertObjectGrantForObject({
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
        await upsertObjectGrantForObject({ ...targetOf(grant), operations: next });
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
          await revokeObjectGrantForObject(grant.accessorId, grant.objType, grant.objId);
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
            <span>{t("systemAdmin.objectGrants.granteeUser")}</span>
          </span>
          <span className={styles.authzObjStat}>
            <strong>{ops.length}</strong>
            <span>{t("systemAdmin.objectGrants.columns.operations")}</span>
          </span>
        </div>
      </div>

      <div className={[styles.calloutBox, styles.sectionCalloutBottom].join(" ")}>
        <span>
          {canManageGrants
            ? t("systemAdmin.objectGrants.drawerHint")
            : t("systemAdmin.objectGrants.drawerReadOnly")}
        </span>
      </div>

      {canGrant ? (
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
      ) : null}

      {loading ? (
        <div className={styles.createLoading}>
          <Spin />
        </div>
      ) : grants.length ? (
        <section className={[styles.createPanel, styles.sectionCallout].join(" ")}>
          <div className={styles.createPanelHead}>
            <h3 className={styles.createPanelTitle}>
              {t(
                canManageGrants
                  ? "systemAdmin.objectGrants.manage"
                  : "systemAdmin.objectGrants.viewDetail",
              )}
            </h3>
            <p className={styles.createPanelDesc}>
              {t(
                canManageGrants
                  ? "systemAdmin.objectGrants.drawerHint"
                  : "systemAdmin.objectGrants.drawerReadOnly",
              )}
            </p>
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
                const builtinLocked = isProtected(grant.accessorId);
                const delegateLocked = !isAdminGrantor && isDelegateProtected(grant);
                const locked = builtinLocked || delegateLocked;
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
                        <Tooltip
                          title={t(
                            builtinLocked
                              ? "systemAdmin.objectGrants.adminLocked"
                              : "systemAdmin.objectGrants.delegateLocked",
                          )}
                        >
                          <span className={styles.subText}>
                            <LockOutlined />
                          </span>
                        </Tooltip>
                      ) : (
                        canRevoke ? (
                          <AppButton
                            className={[styles.actionLink, styles.actionDanger].join(" ")}
                            onClick={() => handleRemove(grant)}
                            type="link"
                          >
                            {t("systemAdmin.objectGrants.remove")}
                          </AppButton>
                        ) : null
                      )}
                    </div>
                    <div className={styles.chipGroup}>
                      {ops.map((op) => {
                        const selected = grant.operations.includes(op.key);
                        // Checking and unchecking send different backend actions (see chipTogglePoint),
                        // so evaluate permissions by direction: grant-only users can add operations
                        // but not remove the last one, while revoke-only users have the inverse access.
                        const point = chipTogglePoint(selected, grant.operations.length);
                        const allowed =
                          point === authzPoints.revoke ? canRevoke : canGrant;
                        return (
                        <button
                          className={[
                            styles.chipOpt,
                            selected ? styles.chipOptSelected : "",
                          ].join(" ")}
                          disabled={busy || locked || !allowed}
                          key={op.key}
                          onClick={() => void toggleOp(grant, op.key)}
                          type="button"
                        >
                          <span className={styles.chipCode}>{op.label}</span>
                          <span className={styles.chipType}>{op.key}</span>
                        </button>
                        );
                      })}
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
            <h3 className={styles.createPanelTitle}>
              {t(
                canManageGrants
                  ? "systemAdmin.objectGrants.manage"
                  : "systemAdmin.objectGrants.viewDetail",
              )}
            </h3>
            <p className={styles.createPanelDesc}>
              {t(
                canManageGrants
                  ? "systemAdmin.objectGrants.drawerHint"
                  : "systemAdmin.objectGrants.drawerReadOnly",
              )}
            </p>
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
