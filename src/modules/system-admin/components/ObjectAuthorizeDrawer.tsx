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
  GlobalOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Drawer, Empty, Segmented, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AuthorizationRegistryFailureAlert } from "@/modules/system-admin/components/AuthorizationRegistryFailureAlert";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { authzPoints } from "@/modules/system-admin/permissions";
import {
  listObjectGrantsForObject,
  revokeObjectGrantForObject,
  revokeObjectGrantsForObject,
  upsertObjectGrantForObject,
} from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import type {
  EffectiveDecision,
  GrantRecord,
  ObjectGrant,
} from "@/modules/system-admin/types/authz";
import {
  HIDDEN_INSTANCE_OPS,
  isCommunityObjectGrantType,
} from "@/modules/system-admin/utils/authz-catalog";
import {
  canManageGrantSource,
  grantCreatorUserId,
  PUBLIC_ACCESSOR_ID,
  isRoleGrantSubject,
  isDelegateProtectedGrant,
  isSelfAuthorizeLockout,
} from "@/modules/system-admin/utils/object-grant-guards";
import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

import styles from "@/modules/system-admin/scenes/admin.module.css";

import { GrantableUserPicker } from "./GrantableUserPicker";
import { GrantableRolePicker } from "./GrantableRolePicker";

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
  function: <FunctionOutlined />,
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
  const { catalogError, catalogLoading, operationsForType, retryAuthorizationRegistry } =
    useAuthorizationRegistry();
  const fineGrainedState = useCapability(CAPABILITIES.PERM_FINE_GRAINED);
  const fineGrained = fineGrainedState === "available";
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
  // Source ownership is checked in the revoke direction. A caller holding only
  // admin-authz:grant is still an ordinary object delegate when deleting and
  // must not be offered controls the backend will reject.
  const isPlatformAuthzRevoker = isAdminRevoker;
  const currentUserId = runtimeConfig.currentUser.id;
  const canGrant = objectAuthorized || isAdminGrantor;
  const canRevoke = objectAuthorized || isAdminRevoker;
  const canManageGrants = canGrant || canRevoke;
  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [grantUsers, setGrantUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<string>();
  const [candidateType, setCandidateType] = useState<"user" | "role">("user");
  const [candidateOperations, setCandidateOperations] = useState<string[]>([]);
  const [sourceAccessorId, setSourceAccessorId] = useState<string>();
  const [loadedResourceKey, setLoadedResourceKey] = useState<string>();
  const loadRequestId = useRef(0);
  const resourceKey = `${objType}\u0000${objId}`;
  const resourceLoaded = loadedResourceKey === resourceKey;
  const scopedGrants = useMemo(() => (resourceLoaded ? grants : []), [grants, resourceLoaded]);
  const scopedGrantUsers = useMemo(
    () => (resourceLoaded ? grantUsers : []),
    [grantUsers, resourceLoaded],
  );

  // `authorize` is offered only to platform administrators. bkn-safe refuses it from anyone else —
  // a delegate that could pass `authorize` on would mint further delegates, and only an
  // administrator can take it back — so showing the chip to an owner would be a control that always
  // 403s. Owners share their object; deciding who else may share it stays administrative.
  const ops = useMemo(
    () =>
      operationsForType(objType).filter(
        (op) =>
          !HIDDEN_INSTANCE_OPS.has(op.key) &&
          (op.key !== "authorize" || !objectAuthorized || isAdminGrantor),
      ),
    [isAdminGrantor, objType, objectAuthorized, operationsForType],
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

  const loadRemote = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setLoadError(undefined);
      try {
        const { accounts, grants: grantList } = await listObjectGrantsForObject(objType, objId);
        if (signal?.aborted || requestId !== loadRequestId.current) {
          return;
        }
        setGrants(grantList);
        setGrantUsers(accounts);
        setLoadedResourceKey(resourceKey);
      } catch (error) {
        if (signal?.aborted || requestId !== loadRequestId.current) {
          return;
        }
        setGrants([]);
        setGrantUsers([]);
        setLoadedResourceKey(undefined);
        const errorMessage = extractRequestErrorMessage(error);
        setLoadError(errorMessage);
        void message.error(errorMessage);
      } finally {
        if (!signal?.aborted && requestId === loadRequestId.current) {
          setLoading(false);
        }
      }
    },
    [message, objId, objType, resourceKey],
  );

  useEffect(() => {
    if (!open) {
      loadRequestId.current += 1;
      setGrants([]);
      setGrantUsers([]);
      setLoadedResourceKey(undefined);
      setLoadError(undefined);
      setLoading(false);
      setCandidate(undefined);
      setCandidateType("user");
      setCandidateOperations([]);
      setSourceAccessorId(undefined);
      return;
    }
    setGrants([]);
    setGrantUsers([]);
    setLoadedResourceKey(undefined);
    setCandidate(prefillGranteeId);
    setCandidateType("user");
    setCandidateOperations([]);
    setSourceAccessorId(undefined);
    const controller = new AbortController();
    void loadRemote(controller.signal);
    return () => controller.abort();
  }, [loadRemote, open, prefillGranteeId]);

  const grantUserMap = useMemo(
    () => new Map(scopedGrantUsers.map((user) => [user.id, user])),
    [scopedGrantUsers],
  );

  const resolveGrantee = useCallback(
    (grant: ObjectGrant) => {
      const id = grant.accessorId;
      if (grant.accessorType === "public" || id === PUBLIC_ACCESSOR_ID) {
        return { id, name: t("systemAdmin.objectGrants.publicSubject"), type: "public" as const };
      }
      if (isRoleGrantSubject(grant)) {
        return {
          id,
          name: grant.accessorName || t("systemAdmin.objectGrants.roleSubject"),
          type: "role" as const,
        };
      }
      const user = grantUserMap.get(id);
      return {
        id,
        name: grant.accessorName || grant.accessorAccount || user?.name || user?.account || id,
        sub: grant.accessorAccount || user?.account,
        type: "user" as const,
      };
    },
    [grantUserMap, t],
  );

  const resolveGrantCreator = useCallback(
    (source: GrantRecord) => {
      const id = grantCreatorUserId(source);
      if (!id) {
        return {
          name: source.createdBy
            ? t(`systemAdmin.objectGrants.authority.${source.authoritySource}`)
            : t("systemAdmin.objectGrants.creatorNotRecorded"),
        };
      }
      const user = grantUserMap.get(id);
      if (user) {
        return { name: user.name, sub: user.account };
      }
      return { name: id };
    },
    [grantUserMap, t],
  );

  const grantProtection = useCallback(
    (grant: ObjectGrant) => {
      const delegateLocked = !isPlatformAuthzRevoker && isDelegateProtectedGrant(grant);
      const selfAuthorizeLocked = isSelfAuthorizeLockout({
        currentUserId,
        grant,
        isAdminGrantor,
      });
      return {
        eraseLocked: delegateLocked,
        sourceWriteLocked: delegateLocked,
        reason: delegateLocked ? t("systemAdmin.objectGrants.delegateLocked") : undefined,
        selfAuthorizeLocked,
      };
    },
    [currentUserId, isAdminGrantor, isPlatformAuthzRevoker, t],
  );

  const visibleGrants = useMemo(
    () =>
      fineGrained
        ? scopedGrants
        : scopedGrants.filter(
            (grant) =>
              grant.bundle === FULL_BUSINESS_ACCESS ||
              (grant.grants ?? []).some(
                (source) => source.active && source.policySource === "community_bundle",
              ),
          ),
    [fineGrained, scopedGrants],
  );

  const hasProtectedGrant = useMemo(
    () => visibleGrants.some((grant) => grantProtection(grant).eraseLocked),
    [grantProtection, visibleGrants],
  );

  const handleAdd = async () => {
    if (!resourceLoaded || loading) {
      return;
    }
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
        accessorType: candidateType,
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
      return (
        source.active &&
        !source.inherited &&
        source.policySource !== "role_permission" &&
        canManageGrantSource({
          currentUserId,
          isPlatformAuthzAdmin: isPlatformAuthzRevoker,
          source,
        }) &&
        Boolean(source.grantId) &&
        !protection.sourceWriteLocked &&
        !(protection.selfAuthorizeLocked && source.operation === "authorize")
      );
    });

  const dependentOperationsForGrant = (grant: ObjectGrant | undefined, source: GrantRecord) => {
    if (source.effect !== "allow") {
      return [];
    }
    const remainingRequirementSource = (grant?.grants ?? []).some(
      (candidate) =>
        candidate.active &&
        candidate.effect === "allow" &&
        candidate.operation === source.operation &&
        candidate.grantId !== source.grantId,
    );
    if (remainingRequirementSource) {
      return [];
    }
    const allowedOperations = new Set(
      grant
        ? decisionsForGrant(grant)
            .filter((decision) => decision.decision === "allow")
            .map((decision) => decision.operation)
        : [],
    );
    return ops.filter(
      (operation) =>
        allowedOperations.has(operation.key) && operation.requires.includes(source.operation),
    );
  };

  const handleDeleteGrant = (grant: ObjectGrant) => {
    if (grantProtection(grant).eraseLocked) {
      return;
    }
    const sources = revocableSourcesForGrant(grant).sort(
      (left, right) =>
        dependentOperationsForGrant(grant, left).length -
        dependentOperationsForGrant(grant, right).length,
    );
    if (!canRevoke || !sources.length) {
      return;
    }
    const grantee = resolveGrantee(grant);
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
          await revokeObjectGrantsForObject(sources.map((source) => source.grantId));
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
    if (
      !grant ||
      !canManageGrantSource({
        currentUserId,
        isPlatformAuthzAdmin: isPlatformAuthzRevoker,
        source,
      }) ||
      dependentOperationsForGrant(grant, source).length
    ) {
      return;
    }
    const grantee = resolveGrantee(grant);
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

  const sourceGrant = scopedGrants.find((grant) => grant.accessorId === sourceAccessorId);
  const grantColumns: ColumnsType<ObjectGrant> = [
    {
      dataIndex: "accessorId",
      key: "grantee",
      render: (_accessorId: string, grant: ObjectGrant) => {
        const grantee = resolveGrantee(grant);
        const protection = grantProtection(grant);
        return (
          <div className={styles.authzSubjectCell}>
            <span className={styles.authzAvatar}>
              {grantee.type === "role" ? (
                <TeamOutlined />
              ) : grantee.type === "public" ? (
                <GlobalOutlined />
              ) : (
                <UserOutlined />
              )}
            </span>
            <span>
              <strong>{grantee.name}</strong>
              {grantee.sub ? <small>{grantee.sub}</small> : null}
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
      ? [
          {
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
                        title={`${operation.description ?? operation.key} · ${decisionLabel} · ${t(`systemAdmin.objectGrants.basis.${decision.basis}`)}`}
                      >
                        <span
                          aria-label={`${operation.label}: ${decisionLabel}`}
                          className={[
                            styles.authzPermissionChip,
                            styles[`authzPermissionChip_${decision.decision}`],
                          ].join(" ")}
                        >
                          {decision.decision === "allow" ? (
                            <CheckCircleOutlined />
                          ) : (
                            <CloseCircleOutlined />
                          )}
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
          },
        ]
      : [
          {
            key: "bundle",
            render: () => (
              <div className={styles.authzPermissionSummary}>
                <span
                  className={[styles.authzPermissionChip, styles.authzPermissionChip_allow].join(
                    " ",
                  )}
                >
                  <CheckCircleOutlined />
                  <span>{t("systemAdmin.objectGrants.fullBundleName")}</span>
                </span>
              </div>
            ),
            title: t("systemAdmin.objectGrants.effectivePermissions"),
          },
        ]),
    {
      key: "sources",
      render: (_value, grant) => {
        const activeSources = (grant.grants ?? []).filter((source) => source.active);
        const sourceLabels = [
          ...new Set(
            activeSources.map((source) =>
              t(`systemAdmin.objectGrants.source.${source.policySource}`),
            ),
          ),
        ];
        return activeSources.length ? (
          <AppButton
            className={styles.authzSourceSummary}
            onClick={() => setSourceAccessorId(grant.accessorId)}
            size="small"
            type="link"
          >
            <strong>
              {t("systemAdmin.objectGrants.sourceCount", { count: activeSources.length })}
            </strong>
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
        const deleteDisabled =
          busy ||
          loading ||
          !resourceLoaded ||
          !canRevoke ||
          protection.eraseLocked ||
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
              title={
                deleteDisabled
                  ? (protection.reason ?? t("systemAdmin.objectGrants.deleteGrantUnavailable"))
                  : undefined
              }
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
        const operation = ops.find(
          (candidateOperation) => candidateOperation.key === source.operation,
        );
        return (
          <Tooltip title={operation?.description ?? source.operation}>
            <div className={styles.authzSourceOperationCell}>
              <strong>{operation?.label ?? source.operation}</strong>
              <code>{source.operation}</code>
            </div>
          </Tooltip>
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
      dataIndex: "createdBy",
      key: "createdBy",
      render: (_createdBy: string | undefined, source) => {
        const creator = resolveGrantCreator(source);
        return (
          <span className={styles.authzSourceOperationCell}>
            <strong>{creator.name}</strong>
            {creator.sub ? <small>{creator.sub}</small> : null}
          </span>
        );
      },
      title: t("systemAdmin.objectGrants.actualGrantor"),
      width: 148,
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
        const operation = ops.find(
          (candidateOperation) => candidateOperation.key === source.operation,
        );
        const revocable =
          canRevoke &&
          revocableSourcesForGrant(sourceGrant).some(
            (candidateSource) => candidateSource.grantId === source.grantId,
          );
        const blockingDependents = dependentOperationsForGrant(sourceGrant, source);
        const deletionBlocked = blockingDependents.length > 0;
        return revocable ? (
          <Tooltip
            title={
              deletionBlocked
                ? t("systemAdmin.objectGrants.deleteRequiredSourceBlocked", {
                    dependents: blockingDependents
                      .map((candidateOperation) => candidateOperation.label)
                      .join("、"),
                    requirement: operation?.label ?? source.operation,
                  })
                : undefined
            }
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
          name: resolveGrantee(sourceGrant).name,
        })}
      </span>
    </div>
  ) : (
    t("systemAdmin.objectGrants.drawerTitle", { name: objName })
  );

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
        scroll={{ x: 968 }}
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

      {loadError ? (
        <Alert
          action={<AppButton onClick={() => void loadRemote()}>{t("common.retry")}</AppButton>}
          description={loadError}
          message={t("common.requestFailed")}
          showIcon
          type="error"
        />
      ) : null}

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
              <Segmented
                block
                onChange={(value) => {
                  setCandidateType(value as "user" | "role");
                  setCandidate(undefined);
                }}
                options={[
                  {
                    icon: <UserOutlined />,
                    label: t("knowledgeNetwork.propertyAuthorizationUser"),
                    value: "user",
                  },
                  {
                    icon: <TeamOutlined />,
                    label: t("knowledgeNetwork.propertyAuthorizationRole"),
                    value: "role",
                  },
                ]}
                value={candidateType}
              />
              {candidateType === "user" ? (
                <GrantableUserPicker
                  ariaLabel={t("systemAdmin.objectGrants.grantUserLabel")}
                  id="object-grant-user"
                  initialUsers={scopedGrantUsers}
                  loading={loading}
                  onChange={setCandidate}
                  onUsersChange={(users) => {
                    if (!users.length) return;
                    setGrantUsers((current) => {
                      const byId = new Map(current.map((user) => [user.id, user]));
                      users.forEach((user) => byId.set(user.id, user));
                      return [...byId.values()];
                    });
                  }}
                  placeholder={t("systemAdmin.objectGrants.addGranteePlaceholder")}
                  resourceId={objId}
                  resourceType={objType}
                  value={candidate}
                />
              ) : (
                <GrantableRolePicker
                  ariaLabel={t("knowledgeNetwork.propertyAuthorizationSearchRole")}
                  loading={loading}
                  onChange={setCandidate}
                  placeholder={t("knowledgeNetwork.propertyAuthorizationSearchRole")}
                  resourceId={objId}
                  resourceType={objType}
                  value={candidate}
                />
              )}
            </div>
            <div className={styles.authzGrantField}>
              <div className={styles.authzGrantFieldHead}>
                <span className={styles.authzGrantFieldLabel}>
                  {t("systemAdmin.objectGrants.grantOperationsLabel")}
                </span>
                {fineGrained ? (
                  <div className={styles.authzGrantFieldActions}>
                    <AppButton
                      disabled={
                        catalogLoading ||
                        loading ||
                        !resourceLoaded ||
                        !ops.length ||
                        candidateOperations.length === ops.length
                      }
                      onClick={selectAllCandidateOperations}
                      size="small"
                      type="link"
                    >
                      {t("systemAdmin.objectGrants.selectAllOperations")}
                    </AppButton>
                    <AppButton
                      disabled={
                        catalogLoading || loading || !resourceLoaded || !candidateOperations.length
                      }
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
                      <Tooltip key={operation.key} title={operation.description ?? operation.key}>
                        <button
                          aria-label={`${operation.label} (${operation.key})`}
                          aria-pressed={selected}
                          className={
                            selected
                              ? styles.authzGrantOperationSelected
                              : styles.authzGrantOperation
                          }
                          onClick={() => toggleCandidateOperation(operation.key)}
                          disabled={catalogLoading || loading || !resourceLoaded}
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
                        className={
                          candidateOperations.includes(FULL_BUSINESS_ACCESS)
                            ? styles.authzGrantOperationSelected
                            : styles.authzGrantOperation
                        }
                        onClick={() =>
                          setCandidateOperations((current) =>
                            current.includes(FULL_BUSINESS_ACCESS) ? [] : [FULL_BUSINESS_ACCESS],
                          )
                        }
                        disabled={catalogLoading || loading || !resourceLoaded}
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
                    ? t(
                        fineGrained
                          ? "systemAdmin.objectGrants.grantNeedsOperation"
                          : "systemAdmin.objectGrants.grantNeedsBundle",
                      )
                    : fineGrained
                      ? t("systemAdmin.objectGrants.grantReady", {
                          count: candidateOperations.length,
                        })
                      : t("systemAdmin.objectGrants.grantBundleReady")}
              </span>
              <AppButton
                disabled={
                  catalogLoading ||
                  loading ||
                  !resourceLoaded ||
                  !candidate ||
                  !candidateOperations.length
                }
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
            <span>
              {t("systemAdmin.objectGrants.grantUserCount", { count: visibleGrants.length })}
            </span>
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
    </>
  );

  const content =
    fineGrainedState === "unknown" ? (
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
    ) : (
      (sourceDetails ?? grantOverview)
    );

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={drawerTitle}
      width="min(920px, calc(100vw - 24px))"
    >
      <AuthorizationRegistryFailureAlert
        error={catalogError}
        onRetry={retryAuthorizationRegistry}
      />
      {content}
    </Drawer>
  );
}
