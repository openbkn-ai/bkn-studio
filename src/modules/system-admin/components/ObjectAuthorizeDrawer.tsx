/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Drawer, Empty, Select, Spin, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { authzPoints } from "@/modules/system-admin/permissions";
import { listUsersPage } from "@/modules/system-admin/services/admin.service";
import {
  listObjectGrantsForObject,
  listEnterpriseObjectGrants,
  revokeObjectGrantForObject,
  upsertObjectGrantForObject,
} from "@/modules/system-admin/services/authz.service";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import type { EffectiveDecision, EnterpriseObjectGrant, GrantRecord, ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  getCachedDepartments,
  getCachedUserSync,
  hydrateUserLookup,
  primeUserLookupCache,
} from "@/modules/system-admin/utils/audit-lookup-cache";
import {
  HIDDEN_INSTANCE_OPS,
  isCommunityObjectGrantType,
} from "@/modules/system-admin/utils/authz-catalog";
import {
  isDelegateProtectedGrant,
  isSelfAuthorizeLockout,
} from "@/modules/system-admin/utils/object-grant-guards";
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

const FULL_BUSINESS_ACCESS = "full_business_access" as const;

export function ObjectAuthorizeDrawer({
  objectAuthorized = false,
  objId,
  objName,
  objSub,
  objType,
  prefillGranteeId,
  onChanged,
  onClose,
  open,
}: ObjectAuthorizeDrawerProps) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const fineGrainedState = useCapability(CAPABILITIES.PERM_FINE_GRAINED);
  const fineGrained = fineGrainedState === "available";
  const enterpriseAvailable = useCapability(CAPABILITIES.PERM_OBJECT_LEVEL) === "available";
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
  const isAdminRevoker = hasPermissions({
    currentPermissions,
    requiredPermissions: authzPoints.revoke,
  });
  // Either admin-authz point makes the caller a platform administrator, the party bkn-safe exempts
  // from its per-row guard. The two points are held separately — a review role may carry `revoke`
  // alone — so reading administrator status off `grant` would lock a revoke-only administrator out
  // of rows the backend accepts from them. Which control they get is still decided per direction by
  // canGrant/canRevoke below.
  const isPlatformAuthzAdmin = isAdminGrantor || isAdminRevoker;
  const currentUserId = runtimeConfig.currentUser.id;
  const canGrant = objectAuthorized || isAdminGrantor;
  const canRevoke = objectAuthorized || isAdminRevoker;
  const canManageGrants = canGrant || canRevoke;
  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [enterpriseGrants, setEnterpriseGrants] = useState<EnterpriseObjectGrant[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<string>();
  const [candidateOperations, setCandidateOperations] = useState<string[]>([]);
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const [sourceAccessorId, setSourceAccessorId] = useState<string>();
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

  const candidateRequirements = useMemo(
    () =>
      ops.flatMap((requirement) => {
        const dependents = ops.filter(
          (operation) =>
            candidateOperations.includes(operation.key) &&
            operation.requires.includes(requirement.key),
        );
        return dependents.length > 0 ? [{ dependents, requirement }] : [];
      }),
    [candidateOperations, ops],
  );

  const toggleCandidateOperation = (operationKey: string) => {
    setCandidateOperations((current) => {
      if (current.includes(operationKey)) {
        const requiredBySelection = ops.some(
          (operation) =>
            current.includes(operation.key) && operation.requires.includes(operationKey),
        );
        return requiredBySelection
          ? current
          : current.filter((candidateOperation) => candidateOperation !== operationKey);
      }
      const requirements = ops.find((operation) => operation.key === operationKey)?.requires ?? [];
      return [...new Set([...current, ...requirements, operationKey])];
    });
  };

  const selectAllCandidateOperations = () => {
    setCandidateOperations(ops.map((operation) => operation.key));
  };

  const clearCandidateOperations = () => {
    setCandidateOperations([]);
  };

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
      if (enterpriseAvailable) {
        setEnterpriseGrants(await listEnterpriseObjectGrants({ resourceId: objId, resourceType: objType }));
      } else {
        setEnterpriseGrants([]);
      }
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [enterpriseAvailable, message, objId, objType, syncLookup]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCandidate(prefillGranteeId);
    setCandidateOperations([]);
    setCandidateKeyword("");
    setSourceAccessorId(undefined);
    void loadRemote();
  }, [loadRemote, open, prefillGranteeId]);

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

  const grantProtection = useCallback(
    (grant: ObjectGrant) => {
      const delegateLocked = !isPlatformAuthzAdmin && isDelegateProtectedGrant(grant);
      const selfAuthorizeLocked = isSelfAuthorizeLockout({
        currentUserId,
        grant,
        isAdminGrantor,
      });
      return {
        eraseLocked: delegateLocked || selfAuthorizeLocked,
        sourceWriteLocked: delegateLocked,
        reason: delegateLocked
            ? t("systemAdmin.objectGrants.delegateLocked")
            : selfAuthorizeLocked
              ? t("systemAdmin.objectGrants.selfAuthorizeLocked")
              : undefined,
        selfAuthorizeLocked,
      };
    },
    [currentUserId, isAdminGrantor, isPlatformAuthzAdmin, t],
  );

  const visibleGrants = useMemo(
    () => fineGrained
      ? grants
      : grants.filter(
          (grant) => grant.bundle === FULL_BUSINESS_ACCESS ||
            (grant.grants ?? []).some(
              (source) => source.active && source.policySource === "community_bundle",
            ),
        ),
    [fineGrained, grants],
  );

  const hasProtectedGrant = useMemo(
    () => visibleGrants.some((grant) => grantProtection(grant).eraseLocked),
    [grantProtection, visibleGrants],
  );

  // Users only — the backend rejects department accessors (see ObjectAuthorizationCreateScene).
  // Departments are still resolved for display, since older grants may name one.
  const candidates = useMemo(() => {
    return [{ label: t("systemAdmin.objectGrants.granteeUser"), options: candidateUserOptions }];
  }, [candidateUserOptions, t]);

  const handleAdd = async () => {
    if (!candidate) {
      void message.error(t("systemAdmin.objectGrants.pickGranteeFirst"));
      return;
    }
    if (!candidateOperations.length) {
      return;
    }
    setBusy(true);
    try {
      await upsertObjectGrantForObject({
        accessorId: candidate,
        ...(fineGrained
          ? { effect: "allow" as const, operations: candidateOperations }
          : { bundle: FULL_BUSINESS_ACCESS }),
        objType,
        objId,
        objName,
        objSub,
      });
      message.success(t("systemAdmin.objectGrants.toast.granteeAdded"));
      setCandidate(undefined);
      setCandidateOperations([]);
      await loadRemote();
      await hydrateUserLookup([candidate]);
      setLookupRevision((revision) => revision + 1);
      onChanged?.();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const decisionsForGrant = (grant: ObjectGrant): EffectiveDecision[] =>
    grant.effectiveDecisions?.length
      ? grant.effectiveDecisions
      : grant.operations.map((operation) => ({
          basis: "direct" as const,
          decision: "allow" as const,
          operation,
          requires: [],
        }));

  const revocableSourcesForGrant = (grant?: ObjectGrant) =>
    (grant?.grants ?? []).filter((source) => {
      if (!grant) {
        return false;
      }
      const protection = grantProtection(grant);
      return source.active && !source.inherited && source.policySource !== "role_permission" &&
        Boolean(source.grantId) && !protection.sourceWriteLocked &&
        !(protection.selfAuthorizeLocked && source.operation === "authorize");
    });

  const dependentOperationsForGrant = (grant: ObjectGrant | undefined, requirementKey: string) => {
    const allowedOperations = new Set(
      grant ? decisionsForGrant(grant)
        .filter((decision) => decision.decision === "allow")
        .map((decision) => decision.operation) : [],
    );
    return ops.filter(
      (operation) =>
        allowedOperations.has(operation.key) && operation.requires.includes(requirementKey),
    );
  };

  const handleDeleteGrant = (grant: ObjectGrant) => {
    if (grantProtection(grant).eraseLocked) {
      return;
    }
    const sources = revocableSourcesForGrant(grant).sort(
      (left, right) =>
        dependentOperationsForGrant(grant, left.operation).length -
        dependentOperationsForGrant(grant, right.operation).length,
    );
    if (!canRevoke || !sources.length) {
      return;
    }
    const grantee = resolveGrantee(grant.accessorId);
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("systemAdmin.objectGrants.deleteGrantConfirm", {
        count: sources.length,
        name: grantee.name,
      }),
      okButtonProps: { danger: true },
      okText: t("systemAdmin.objectGrants.deleteGrant"),
      onOk: async () => {
        setBusy(true);
        try {
          for (const source of sources) {
            await revokeObjectGrantForObject(source.grantId);
          }
          setSourceAccessorId(undefined);
          message.success(t("systemAdmin.objectGrants.toast.revoked"));
          await loadRemote();
          onChanged?.();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        } finally {
          setBusy(false);
        }
      },
      title: t("systemAdmin.objectGrants.deleteGrantTitle"),
    });
  };

  const handleRevokeSource = (grant: ObjectGrant | undefined, source: GrantRecord) => {
    if (!grant || dependentOperationsForGrant(grant, source.operation).length) {
      return;
    }
    const grantee = resolveGrantee(grant.accessorId);
    void modal.confirm({
      title: t("systemAdmin.objectGrants.deleteSourceTitle"),
      content: t("systemAdmin.objectGrants.deleteSourceConfirm", {
        effect: t(`systemAdmin.objectGrants.effect.${source.effect}`),
        grantId: source.grantId,
        name: grantee.name,
        operation: source.operation,
        source: t(`systemAdmin.objectGrants.source.${source.policySource}`),
      }),
      okText: t("systemAdmin.objectGrants.deleteGrant"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revokeObjectGrantForObject(source.grantId);
          message.success(t("systemAdmin.objectGrants.toast.revoked"));
          await loadRemote();
          onChanged?.();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  const sourceGrant = grants.find((grant) => grant.accessorId === sourceAccessorId);
  const grantColumns: ColumnsType<ObjectGrant> = [
    {
      dataIndex: "accessorId",
      key: "grantee",
      render: (accessorId: string) => {
        const grantee = resolveGrantee(accessorId);
        const grant = grants.find((candidateGrant) => candidateGrant.accessorId === accessorId);
        const protection = grant ? grantProtection(grant) : undefined;
        return (
          <div className={styles.authzSubjectCell}>
            <span className={styles.authzAvatar}>
              {grantee.type === "department" ? <AppstoreOutlined /> : <UserOutlined />}
            </span>
            <span>
              <strong>{grantee.name}</strong>
              <small>{grantee.sub}</small>
            </span>
            {protection?.eraseLocked ? (
              <Tooltip title={protection.reason}>
                <LockOutlined />
              </Tooltip>
            ) : null}
          </div>
        );
      },
      title: t("systemAdmin.objectGrants.columns.grantee"),
      width: 210,
    },
    ...(fineGrained
      ? [{
          key: "effectivePermissions",
          render: (_value: unknown, grant: ObjectGrant) => {
            const decisions = new Map(
              decisionsForGrant(grant).map((decision) => [decision.operation, decision]),
            );
            const effectiveOperations = ops.flatMap((operation) => {
              const decision = decisions.get(operation.key);
              return decision ? [{ decision, operation }] : [];
            });
            return effectiveOperations.length ? (
              <div className={styles.authzPermissionSummary}>
                {effectiveOperations.map(({ decision, operation }) => {
                  const decisionLabel = t(
                    decision.decision === "allow"
                      ? "systemAdmin.objectGrants.permissionAllowed"
                      : "systemAdmin.objectGrants.permissionDenied",
                  );
                  return (
                    <Tooltip
                      key={operation.key}
                      title={`${operation.key} · ${decisionLabel} · ${t(`systemAdmin.objectGrants.basis.${decision.basis}`)}`}
                    >
                      <span
                        aria-label={`${operation.label}: ${decisionLabel}`}
                        className={[
                          styles.authzPermissionChip,
                          styles[`authzPermissionChip_${decision.decision}`],
                        ].join(" ")}
                      >
                        {decision.decision === "allow"
                          ? <CheckCircleOutlined />
                          : <CloseCircleOutlined />}
                        <span>{operation.label}</span>
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            ) : (
              <span className={styles.authzMutedMark}>
                {t("systemAdmin.objectGrants.permissionNotGranted")}
              </span>
            );
          },
          title: t("systemAdmin.objectGrants.effectivePermissions"),
        }]
      : [{
          key: "bundle",
          render: () => (
            <div className={styles.authzPermissionSummary}>
              <span
                className={[
                  styles.authzPermissionChip,
                  styles.authzPermissionChip_allow,
                ].join(" ")}
              >
                <CheckCircleOutlined />
                <span>{t("systemAdmin.objectGrants.fullBundleName")}</span>
              </span>
            </div>
          ),
          title: t("systemAdmin.objectGrants.effectivePermissions"),
        }]),
    {
      key: "sources",
      render: (_value, grant) => {
        const activeSources = (grant.grants ?? []).filter((source) => source.active);
        const sourceLabels = [
          ...new Set(activeSources.map((source) =>
            t(`systemAdmin.objectGrants.source.${source.policySource}`),
          )),
        ];
        return activeSources.length ? (
          <AppButton
            className={styles.authzSourceSummary}
            onClick={() => setSourceAccessorId(grant.accessorId)}
            size="small"
            type="link"
          >
            <strong>{t("systemAdmin.objectGrants.sourceCount", { count: activeSources.length })}</strong>
            <small>{sourceLabels.join(" / ")}</small>
          </AppButton>
        ) : (
          <span className={styles.authzMutedMark}>—</span>
        );
      },
      title: t("systemAdmin.objectGrants.grantSource"),
      width: 150,
    },
    {
      key: "actions",
      render: (_value, grant) => {
        const protection = grantProtection(grant);
        const deleteDisabled = busy || !canRevoke || protection.eraseLocked ||
          !revocableSourcesForGrant(grant).length;
        return (
          <div className={styles.authzRowActions}>
            <AppButton
              onClick={() => setSourceAccessorId(grant.accessorId)}
              size="small"
              type="link"
            >
              {t("common.viewDetails")}
            </AppButton>
            <span aria-hidden className={styles.authzActionDivider} />
            <Tooltip
              title={deleteDisabled
                ? protection.reason ?? t("systemAdmin.objectGrants.deleteGrantUnavailable")
                : undefined}
            >
              <span>
                <AppButton
                  danger
                  disabled={deleteDisabled}
                  onClick={() => handleDeleteGrant(grant)}
                  size="small"
                  type="link"
                >
                  {t("systemAdmin.objectGrants.deleteGrant")}
                </AppButton>
              </span>
            </Tooltip>
          </div>
        );
      },
      title: t("common.actions"),
      width: 156,
    },
  ];

  const activeSourceRecords = (sourceGrant?.grants ?? []).filter((source) => source.active);
  const sourceColumns: ColumnsType<GrantRecord> = [
    {
      key: "operation",
      render: (_value, source) => {
        const operation = ops.find((candidateOperation) =>
          candidateOperation.key === source.operation);
        return (
          <div className={styles.authzSourceOperationCell}>
            <strong>{operation?.label ?? source.operation}</strong>
            <code>{source.operation}</code>
          </div>
        );
      },
      title: t("systemAdmin.objectGrants.columns.operations"),
      width: 148,
    },
    {
      dataIndex: "effect",
      key: "effect",
      render: (effect: GrantRecord["effect"]) => (
        <Tag color={effect === "allow" ? "green" : "red"}>
          {t(`systemAdmin.objectGrants.effect.${effect}`)}
        </Tag>
      ),
      title: t("systemAdmin.objectGrants.sourceDecision"),
      width: 84,
    },
    {
      dataIndex: "policySource",
      key: "source",
      render: (policySource: GrantRecord["policySource"]) =>
        t(`systemAdmin.objectGrants.source.${policySource}`),
      title: t("systemAdmin.objectGrants.grantSource"),
      width: 132,
    },
    {
      dataIndex: "authoritySource",
      key: "grantedBy",
      render: (authoritySource: GrantRecord["authoritySource"]) =>
        t(`systemAdmin.objectGrants.authority.${authoritySource}`),
      title: t("systemAdmin.objectGrants.columns.grantedBy"),
      width: 132,
    },
    {
      dataIndex: "grantId",
      ellipsis: true,
      key: "grantId",
      render: (grantId: string) => <code>{grantId}</code>,
      title: t("systemAdmin.objectGrants.grantId"),
    },
    {
      align: "right",
      key: "actions",
      render: (_value, source) => {
        const operation = ops.find((candidateOperation) =>
          candidateOperation.key === source.operation);
        const revocable = canRevoke && revocableSourcesForGrant(sourceGrant)
          .some((candidateSource) => candidateSource.grantId === source.grantId);
        const blockingDependents = dependentOperationsForGrant(
          sourceGrant,
          source.operation,
        );
        const deletionBlocked = blockingDependents.length > 0;
        return revocable ? (
          <Tooltip
            title={deletionBlocked
              ? t("systemAdmin.objectGrants.deleteRequiredSourceBlocked", {
                  dependents: blockingDependents
                    .map((candidateOperation) => candidateOperation.label)
                    .join("、"),
                  requirement: operation?.label ?? source.operation,
                })
              : undefined}
          >
            <span>
              <AppButton
                danger
                disabled={deletionBlocked}
                onClick={() => handleRevokeSource(sourceGrant, source)}
                size="small"
                type="link"
              >
                {t("systemAdmin.objectGrants.deleteGrant")}
              </AppButton>
            </span>
          </Tooltip>
        ) : (
          <span className={styles.authzSourceReadOnly}>
            {t("systemAdmin.objectGrants.readOnlySource")}
          </span>
        );
      },
      title: t("common.actions"),
      width: 112,
    },
  ];

  const drawerTitle = sourceGrant ? (
    <div className={styles.authzDrillTitle}>
      <AppButton
        aria-label={t("common.back")}
        icon={<ArrowLeftOutlined />}
        onClick={() => setSourceAccessorId(undefined)}
        size="small"
        type="text"
      />
      <span>
        {t("systemAdmin.objectGrants.sourceDrawerTitle", {
          name: resolveGrantee(sourceGrant.accessorId).name,
        })}
      </span>
    </div>
  ) : t("systemAdmin.objectGrants.drawerTitle", { name: objName });

  const sourceDetails = sourceGrant ? (
    <div className={styles.authzSourceView}>
      <div className={styles.authzSourceOverview}>
        <div className={styles.authzSourceOverviewHeader}>
          <strong>{t("systemAdmin.objectGrants.sourceRecords")}</strong>
          <span>
            {t("systemAdmin.objectGrants.sourceRecordCount", {
              count: activeSourceRecords.length,
            })}
          </span>
        </div>
        <div className={styles.authzSourceHint}>
          <InfoCircleOutlined />
          <span>{t("systemAdmin.objectGrants.sourceDrawerDescription")}</span>
        </div>
      </div>
      <Table<GrantRecord>
        className={styles.authzSourceTable}
        columns={sourceColumns}
        dataSource={activeSourceRecords}
        locale={{ emptyText: t("systemAdmin.objectGrants.sourceEmpty") }}
        pagination={false}
        rowKey="grantId"
        scroll={{ x: 820 }}
        size="small"
        tableLayout="fixed"
      />
    </div>
  ) : null;

  const grantOverview = (
    <>
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
            <strong>{visibleGrants.length}</strong>
            <span>{t("systemAdmin.objectGrants.authorizedUserStat")}</span>
          </span>
          <span className={styles.authzObjStat}>
            <strong>{fineGrained ? ops.length : 1}</strong>
            <span>{t("systemAdmin.objectGrants.grantableOperationStat")}</span>
          </span>
        </div>
      </div>

      {!canManageGrants ? (
        <div className={[styles.calloutBox, styles.sectionCalloutBottom].join(" ")}>
          <span>{t("systemAdmin.objectGrants.drawerReadOnly")}</span>
        </div>
      ) : null}

      {canGrant ? (
        <section className={styles.authzGrantComposer}>
          <header className={styles.authzGrantComposerHead}>
            <strong>{t("systemAdmin.objectGrants.newGrantTitle")}</strong>
            <span>
              {t("systemAdmin.objectGrants.selectedOperationCount", {
                selected: candidateOperations.length,
                total: fineGrained ? ops.length : 1,
              })}
            </span>
          </header>
          <div className={styles.authzGrantForm}>
            <div className={[styles.authzGrantField, styles.authzGrantUserField].join(" ")}>
              <label htmlFor="object-grant-user">
                {t("systemAdmin.objectGrants.grantUserLabel")}
              </label>
              <Select
                aria-label={t("systemAdmin.objectGrants.grantUserLabel")}
                filterOption={false}
                id="object-grant-user"
                loading={loading || candidateSearchLoading}
                notFoundContent={candidateSearchLoading ? <Spin size="small" /> : null}
                onChange={setCandidate}
                onSearch={setCandidateKeyword}
                options={candidates}
                placeholder={t("systemAdmin.objectGrants.addGranteePlaceholder")}
                showSearch
                value={candidate}
              />
            </div>
            <div className={styles.authzGrantField}>
              <div className={styles.authzGrantFieldHead}>
                <span className={styles.authzGrantFieldLabel}>
                  {t("systemAdmin.objectGrants.grantOperationsLabel")}
                </span>
                {fineGrained ? (
                  <div className={styles.authzGrantFieldActions}>
                    <AppButton
                      disabled={!ops.length || candidateOperations.length === ops.length}
                      onClick={selectAllCandidateOperations}
                      size="small"
                      type="link"
                    >
                      {t("systemAdmin.objectGrants.selectAllOperations")}
                    </AppButton>
                    <AppButton
                      disabled={!candidateOperations.length}
                      onClick={clearCandidateOperations}
                      size="small"
                      type="link"
                    >
                      {t("systemAdmin.objectGrants.clearOperations")}
                    </AppButton>
                  </div>
                ) : null}
              </div>
              {fineGrained ? (
                <div
                  aria-label={t("systemAdmin.objectGrants.grantOperationsLabel")}
                  className={styles.authzGrantOperations}
                  role="group"
                >
                  {ops.map((operation) => {
                    const selected = candidateOperations.includes(operation.key);
                    const required = candidateRequirements.some(
                      ({ requirement }) => requirement.key === operation.key,
                    );
                    return (
                      <Tooltip key={operation.key} title={operation.key}>
                        <button
                          aria-label={`${operation.label} (${operation.key})`}
                          aria-pressed={selected}
                          className={selected
                            ? styles.authzGrantOperationSelected
                            : styles.authzGrantOperation}
                          onClick={() => toggleCandidateOperation(operation.key)}
                          type="button"
                        >
                          {operation.label}
                          {required ? <LockOutlined className={styles.authzGrantLock} /> : null}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div
                    aria-label={t("systemAdmin.objectGrants.grantOperationsLabel")}
                    className={[
                      styles.authzGrantOperations,
                      styles.authzGrantOperationsSingle,
                    ].join(" ")}
                    role="group"
                  >
                    <Tooltip title={FULL_BUSINESS_ACCESS}>
                      <button
                        aria-label={`${t("systemAdmin.objectGrants.fullBundleName")} (${FULL_BUSINESS_ACCESS})`}
                        aria-pressed={candidateOperations.includes(FULL_BUSINESS_ACCESS)}
                        className={candidateOperations.includes(FULL_BUSINESS_ACCESS)
                          ? styles.authzGrantOperationSelected
                          : styles.authzGrantOperation}
                        onClick={() => setCandidateOperations((current) =>
                          current.includes(FULL_BUSINESS_ACCESS) ? [] : [FULL_BUSINESS_ACCESS])}
                        type="button"
                      >
                        {t("systemAdmin.objectGrants.fullBundleName")}
                      </button>
                    </Tooltip>
                  </div>
                  <span className={styles.authzBundleHint}>
                    {t("systemAdmin.objectGrants.fullBundleScope")}
                  </span>
                </>
              )}
            </div>
            <footer className={styles.authzGrantFooter}>
              <span aria-live="polite">
                {!candidate
                  ? t("systemAdmin.objectGrants.grantNeedsUser")
                  : !candidateOperations.length
                    ? t(fineGrained
                      ? "systemAdmin.objectGrants.grantNeedsOperation"
                      : "systemAdmin.objectGrants.grantNeedsBundle")
                    : fineGrained
                      ? t("systemAdmin.objectGrants.grantReady", {
                          count: candidateOperations.length,
                        })
                      : t("systemAdmin.objectGrants.grantBundleReady")}
              </span>
              <AppButton
                disabled={!candidate || !candidateOperations.length}
                icon={<PlusOutlined />}
                loading={busy}
                onClick={() => void handleAdd()}
                type="primary"
              >
                {t("systemAdmin.objectGrants.addGrant")}
              </AppButton>
            </footer>
          </div>
          {candidateRequirements.length > 0 ? (
            <div className={styles.authzGrantNotice}>
              <InfoCircleOutlined />
              <div>
                {candidateRequirements.map(({ dependents, requirement }) => (
                  <div key={requirement.key}>
                    {t("systemAdmin.objectGrants.requiredSelectionNotice", {
                      dependents: dependents.map((operation) => operation.label).join("、"),
                      requirement: requirement.label,
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.authzGrantMatrix}>
        <header className={styles.authzGrantMatrixHead}>
          <div>
            <strong>{t("systemAdmin.objectGrants.grantDetails")}</strong>
            <span>{t("systemAdmin.objectGrants.grantUserCount", { count: visibleGrants.length })}</span>
          </div>
          {!canManageGrants ? <span>{t("systemAdmin.objectGrants.drawerReadOnly")}</span> : null}
        </header>
        {hasProtectedGrant ? (
          <div className={styles.authzMatrixNotice}>
            <LockOutlined />
            <span>{t("systemAdmin.objectGrants.protectedGrantNotice")}</span>
          </div>
        ) : null}
        {loading || visibleGrants.length ? (
          <Table<ObjectGrant>
            className={styles.authzGrantTable}
            columns={grantColumns}
            dataSource={visibleGrants}
            loading={loading}
            pagination={false}
            rowKey="accessorId"
            size="small"
            tableLayout="fixed"
          />
        ) : (
          <div className={styles.authzGrantEmpty}>
            <Empty
              description={t("systemAdmin.objectGrants.drawerEmpty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <span>{t("systemAdmin.objectGrants.drawerEmptyHelp")}</span>
          </div>
        )}
      </section>

      {enterpriseAvailable && enterpriseGrants.length ? (
        <section className={[styles.createPanel, styles.sectionCallout].join(" ")}>
          <div className={styles.createPanelHead}>
            <h3 className={styles.createPanelTitle}>
              {t("systemAdmin.objectGrants.enterpriseRulesTitle")}
            </h3>
            <p className={styles.createPanelDesc}>
              {t("systemAdmin.objectGrants.enterpriseRulesDescription")}
            </p>
          </div>
          <div className={styles.createPanelBody}>
            <div className={styles.sourceList}>
              {enterpriseGrants.map((rule) => (
                <div className={styles.sourceRow} key={rule.grantId}>
                  <Tag color={rule.effect === "allow" ? "green" : "red"}>
                    {t(`systemAdmin.objectGrants.effect.${rule.effect}`)}
                  </Tag>
                  <span className={styles.sourceOperation}>{rule.operation}</span>
                  <span>{rule.classification}</span>
                  <span>{t(`systemAdmin.objectGrants.enterpriseState.${rule.activationState}`)}</span>
                  <code>{rule.ruleId}</code>
                  <span className={styles.sourceReadOnly}>
                    {rule.runtimeEligible
                      ? t("systemAdmin.objectGrants.runtimeEligible")
                      : t("systemAdmin.objectGrants.runtimeInactive")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );

  const content = fineGrainedState === "unknown" ? (
    <RequireEdition
      capability={CAPABILITIES.PERM_FINE_GRAINED}
      minEdition="professional"
      mountLockedContent={false}
    >
      {grantOverview}
    </RequireEdition>
  ) : !fineGrained && !isCommunityObjectGrantType(objType) ? (
    <RequireEdition
      capability={CAPABILITIES.PERM_FINE_GRAINED}
      minEdition="professional"
      mountLockedContent={false}
    >
      {grantOverview}
    </RequireEdition>
  ) : sourceDetails ?? grantOverview;

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={drawerTitle}
      width="min(1040px, 100vw)"
    >
      {content}
    </Drawer>
  );
}
