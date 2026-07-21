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
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Segmented, Select, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import {
  type AuthzGroup,
  listObjectGrantsPage,
  listObjectGroups,
  revokeObjectGrant,
} from "@/modules/system-admin/services/authz.service";
import { resolveGrantNames } from "@/modules/system-admin/services/authz-objects.service";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import type { AuthzSummary, ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  getCachedDepartments,
  getCachedUserSync,
  hydrateUserLookup,
} from "@/modules/system-admin/utils/audit-lookup-cache";
import { AUTHZ_OBJECT_TYPES, authzObjectTypeOptions } from "@/modules/system-admin/utils/authz-catalog";
import { operationLabel, resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

import styles from "./admin.module.css";

type ViewMode = "all" | "object" | "grantee";


type DrawerTarget = {
  id: string;
  name: string;
  sub?: string;
  type: string;
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

const grantKey = (grant: ObjectGrant) =>
  `${grant.accessorId}:${grant.objType}:${grant.objId}`;

export function ObjectAuthorizationScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { pageState, setPagination } = usePageState();

  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AuthzSummary>({ grants: 0, objects: 0, grantees: 0 });
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>("all");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);
  const [objTypeFilter, setObjTypeFilter] = useState<string>();
  const [granteeType, setGranteeType] = useState<"all" | "user" | "department">("all");
  // 分组视图(按对象/按成员)服务端分页返回的聚合行。
  const [groups, setGroups] = useState<AuthzGroup[]>([]);
  const [drawer, setDrawer] = useState<{ open: boolean; target: DrawerTarget | null }>({
    open: false,
    target: null,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const deptList = await getCachedDepartments();
      setDepartments(deptList);

      const offset = (pageState.page - 1) * pageState.pageSize;

      if (view === "all") {
        // resolveNames:false —— 列表先用 id 占位立即渲染;对象名按当前可见页 on-demand 回填。
        const result = await listObjectGrantsPage(
          {
            search: debouncedKeyword || undefined,
            resourceType: objTypeFilter,
            offset,
            limit: pageState.pageSize,
            includeSummary: true,
          },
          { resolveNames: false },
        );
        setGroups([]);
        setGrants(result.grants);
        setTotal(result.total);
        setSummary(
          result.summary ?? {
            grants: result.total,
            objects: new Set(result.grants.map((grant) => `${grant.objType}:${grant.objId}`)).size,
            grantees: new Set(result.grants.map((grant) => grant.accessorId)).size,
          },
        );
        await hydrateUserLookup([...new Set(result.grants.map((grant) => grant.accessorId))]);
        setLookupRevision((revision) => revision + 1);
      } else {
        // 按对象/按成员:服务端分组分页,每页只取一屏聚合行,不再全量拉再客户端分组。
        const { groups: rows, total: groupTotal } = await listObjectGroups(view, {
          offset,
          limit: pageState.pageSize,
          search: debouncedKeyword || undefined,
          resourceType: objTypeFilter,
        });
        setGrants([]);
        setGroups(rows);
        setTotal(groupTotal);
        setSummary((prev) => ({
          ...prev,
          objects: view === "object" ? groupTotal : prev.objects,
          grantees: view === "grantee" ? groupTotal : prev.grantees,
        }));
        if (view === "grantee") {
          await hydrateUserLookup(rows.map((row) => row.accessorId ?? "").filter(Boolean));
          setLookupRevision((revision) => revision + 1);
        }
      }
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [
    debouncedKeyword,
    objTypeFilter,
    pageState.page,
    pageState.pageSize,
    view,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const deptMap = useMemo(
    () => new Map(departments.map((item) => [item.id, item])),
    [departments],
  );
  const objectTypeOptions = useMemo(() => authzObjectTypeOptions(), []);

  const resolveGrantee = useCallback(
    (id: string) => {
      void lookupRevision;
      const user = getCachedUserSync(id);
      if (user) {
        return {
          id,
          name: user.name,
          account: user.account,
          label: user.account,
          type: "user" as const,
        };
      }

      const department = deptMap.get(id);
      if (department) {
        return {
          id,
          name: department.name,
          account: undefined,
          label: department.name,
          type: "department" as const,
        };
      }

      return {
        id,
        name: id,
        account: undefined,
        label: id,
        type: "user" as const,
      };
    },
    [deptMap, lookupRevision],
  );

  const filteredGrants = useMemo(() => {
    if (granteeType === "all") {
      return grants;
    }
    return grants.filter((grant) => resolveGrantee(grant.accessorId).type === granteeType);
  }, [granteeType, grants, resolveGrantee]);

  useEffect(() => {
    setPagination(1, pageState.pageSize);
  }, [debouncedKeyword, granteeType, objTypeFilter, pageState.pageSize, setPagination, view]);

  // 对象名按需解析:只解析「当前可见页」的对象名,翻页/切视图再解析新出现的。用缓存,
  // 翻回来的页零请求。避免为全部(数千条)一次性解析导致领域取名接口连接饱和/超时。
  useEffect(() => {
    if (view === "grantee") {
      // 按成员视图行是成员,名字走用户查找(hydrateUserLookup),此处不解析对象名。
      return;
    }
    const pendingGrants =
      view === "all" ? filteredGrants.filter((grant) => grant.objName === grant.objId) : [];
    const pendingGroups =
      view === "object" ? groups.filter((group) => group.objName === group.objId) : [];
    if (pendingGrants.length === 0 && pendingGroups.length === 0) {
      return;
    }
    let cancelled = false;
    const toResolve: ObjectGrant[] = [
      ...pendingGrants,
      ...pendingGroups.map((group) => ({
        accessorId: "",
        objType: group.objType ?? "",
        objId: group.objId ?? "",
        objName: group.objId ?? "",
        operations: [],
      })),
    ];
    void resolveGrantNames(toResolve).then((named) => {
      if (cancelled) {
        return;
      }
      const nameByKey = new Map(
        named
          .filter((grant) => grant.objName !== grant.objId)
          .map((grant) => [`${grant.objType}:${grant.objId}`, grant.objName] as const),
      );
      if (nameByKey.size === 0) {
        return;
      }
      if (view === "all") {
        setGrants((prev) =>
          prev.map((grant) => {
            const name = nameByKey.get(`${grant.objType}:${grant.objId}`);
            return name ? { ...grant, objName: name } : grant;
          }),
        );
      } else {
        setGroups((prev) =>
          prev.map((group) => {
            const name = nameByKey.get(`${group.objType}:${group.objId}`);
            return name ? { ...group, objName: name } : group;
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filteredGrants, groups, view]);

  const listTotal = total;

  const openDrawer = useCallback((target: DrawerTarget) => {
    setDrawer({ open: true, target });
  }, []);

  const granteeCell = useCallback(
    (accessorId: string) => {
      const grantee = resolveGrantee(accessorId);
      const label = <span className={styles.authzWhoName}>{grantee.label}</span>;
      if (grantee.type === "user" && grantee.name !== grantee.label) {
        return <Tooltip title={grantee.name}>{label}</Tooltip>;
      }
      return label;
    },
    [resolveGrantee],
  );

  const opChips = useCallback((grant: ObjectGrant) => {
    const visibleOperations = grant.operations.slice(0, 3);
    const hiddenCount = grant.operations.length - visibleOperations.length;
    const hiddenLabels = grant.operations
      .slice(3)
      .map((operation) => operationLabel(grant.objType, operation))
      .join(" / ");

    return (
      <span className={styles.chipRow}>
        {visibleOperations.map((operation) => (
          <Tag className={styles.permChip} key={`${grantKey(grant)}:${operation}`}>
            {operationLabel(grant.objType, operation)}
          </Tag>
        ))}
        {hiddenCount > 0 ? (
          <Tooltip title={hiddenLabels}>
            <span className={styles.moreHint}>+{hiddenCount}</span>
          </Tooltip>
        ) : null}
      </span>
    );
  }, []);

  const confirmRevoke = useCallback(
    (grant: ObjectGrant) => {
      const grantee = resolveGrantee(grant.accessorId);
      void modal.confirm({
        title: t("systemAdmin.objectGrants.revokeTitle"),
        content: t("systemAdmin.objectGrants.revokeConfirm", {
          name: grantee.label,
          object: grant.objName,
        }),
        okText: t("systemAdmin.objectGrants.revoke"),
        cancelText: t("common.cancel"),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await revokeObjectGrant(grant.accessorId, grant.objType, grant.objId);
            setGrants((prev) =>
              prev.filter(
                (item) =>
                  !(
                    item.accessorId === grant.accessorId &&
                    item.objType === grant.objType &&
                    item.objId === grant.objId
                  ),
              ),
            );
            setTotal((prev) => Math.max(0, prev - 1));
            setSummary((prev) => ({
              grants: Math.max(0, prev.grants - 1),
              objects: prev.objects,
              grantees: prev.grantees,
            }));
            message.success(t("systemAdmin.objectGrants.toast.revoked"));
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          }
        },
      });
    },
    [message, modal, resolveGrantee, t],
  );

  const columns: ColumnsType<ObjectGrant> = useMemo(() => [
    {
      title: t("systemAdmin.objectGrants.columns.object"),
      dataIndex: "objName",
      render: (_, grant) => (
        <div className={styles.nameCell}>
          <span className={styles.nameTitle}>
            <span className={styles.authzAvatar}>
              {OBJ_ICON[grant.objType] ?? <AppstoreOutlined />}
            </span>
            {grant.objName}
          </span>
          {grant.objSub ? <span className={styles.subText}>{grant.objSub}</span> : null}
        </div>
      ),
    },
    {
      title: t("systemAdmin.objectGrants.columns.type"),
      dataIndex: "objType",
      width: 160,
      render: (value: string) => <Tag className={styles.roleTag}>{resourceTypeLabel(value)}</Tag>,
    },
    {
      title: t("systemAdmin.objectGrants.columns.grantee"),
      dataIndex: "accessorId",
      render: (value: string) => granteeCell(value),
    },
    {
      title: t("systemAdmin.objectGrants.columns.operations"),
      dataIndex: "operations",
      render: (_, grant) => opChips(grant),
    },
    {
      title: t("systemAdmin.objectGrants.columns.actions"),
      key: "actions",
      width: 160,
      render: (_, grant) => (
        <div className={[styles.actionGroup, styles.actionGroupInline].join(" ")}>
          <AppButton
            className={styles.actionLink}
            onClick={() =>
              openDrawer({
                id: grant.objId,
                name: grant.objName,
                sub: grant.objSub,
                type: grant.objType,
              })
            }
            type="link"
          >
            {t("systemAdmin.objectGrants.manage")}
          </AppButton>
          <AppButton
            className={[styles.actionLink, styles.actionDanger].join(" ")}
            danger
            onClick={() => confirmRevoke(grant)}
            type="link"
          >
            {t("systemAdmin.objectGrants.revoke")}
          </AppButton>
        </div>
      ),
    },
  ], [confirmRevoke, granteeCell, openDrawer, opChips, t]);

  const renderBody = () => {
    const isEmpty = view === "all" ? filteredGrants.length === 0 : groups.length === 0;
    if (!loading && isEmpty) {
      return (
        <Empty
          description={t("systemAdmin.objectGrants.empty")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    if (view === "object") {
      return (
        <div className={styles.authzGroupList}>
          {groups.map((group) => {
            const objType = group.objType ?? "";
            const objId = group.objId ?? "";
            const objName = group.objName || objId;
            const pseudo: ObjectGrant = {
              accessorId: "",
              objType,
              objId,
              objName,
              operations: group.operations,
            };
            return (
              <div className={styles.authzGroup} key={`${objType}::${objId}`}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzAvatar}>
                      {OBJ_ICON[objType] ?? <AppstoreOutlined />}
                    </span>
                    <span className={styles.authzGroupName}>{objName}</span>
                    <Tag className={styles.roleTag}>{resourceTypeLabel(objType)}</Tag>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.granteeCount", { count: group.count })}
                    </span>
                  </span>
                  <AppButton
                    icon={<KeyOutlined />}
                    onClick={() => openDrawer({ id: objId, name: objName, type: objType })}
                  >
                    {t("systemAdmin.objectGrants.manage")}
                  </AppButton>
                </div>
                <div className={styles.authzGroupBody}>
                  <div className={styles.authzGrantLine}>{opChips(pseudo)}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (view === "grantee") {
      return (
        <div className={styles.authzGroupList}>
          {groups.map((group) => {
            const accessorId = group.accessorId ?? "";
            const grantee = resolveGrantee(accessorId);
            const pseudo: ObjectGrant = {
              accessorId,
              objType: "",
              objId: accessorId,
              objName: "",
              operations: group.operations,
            };
            return (
              <div className={styles.authzGroup} key={accessorId}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzGroupName}>{grantee.label}</span>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.objectCount", { count: group.count })}
                    </span>
                  </span>
                </div>
                <div className={styles.authzGroupBody}>
                  <div className={styles.authzGrantLine}>{opChips(pseudo)}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <AppTable<ObjectGrant>
        columns={columns}
        dataSource={filteredGrants}
        loading={loading}
        pagination={false}
        rowKey={grantKey}
      />
    );
  };

  return (
    <>
      <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>
        <div className={styles.statStrip}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t("systemAdmin.objectGrants.stats.grants")}</span>
            <span className={styles.statValue}>{summary.grants}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t("systemAdmin.objectGrants.stats.objects")}</span>
            <span className={styles.statValue}>{summary.objects}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t("systemAdmin.objectGrants.stats.grantees")}</span>
            <span className={styles.statValue}>{summary.grantees}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t("systemAdmin.objectGrants.stats.types")}</span>
            <span className={styles.statValue}>{AUTHZ_OBJECT_TYPES.length}</span>
          </div>
        </div>

        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <PermissionGate permissions="admin-authz:grant">
                <AppButton
                  icon={<PlusOutlined />}
                  onClick={() => void navigate("/system/authorizations/new")}
                  type="primary"
                >
                  {t("systemAdmin.objectGrants.create")}
                </AppButton>
              </PermissionGate>
              <AppButton
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadData()}
              >
                {t("common.refresh")}
              </AppButton>
            </div>
            <Segmented<ViewMode>
              onChange={(value) => setView(value)}
              options={[
                { label: t("systemAdmin.objectGrants.tabAll"), value: "all" },
                { label: t("systemAdmin.objectGrants.tabObject"), value: "object" },
                { label: t("systemAdmin.objectGrants.tabGrantee"), value: "grantee" },
              ]}
              value={view}
            />
          </div>

          <div className={[styles.toolbarFilters, styles.filtersInline].join(" ")}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("systemAdmin.objectGrants.searchPlaceholder")}
              value={keyword}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              onChange={(value) => setObjTypeFilter(value)}
              options={objectTypeOptions}
              placeholder={t("systemAdmin.objectGrants.filterObjType")}
              value={objTypeFilter}
            />
            <Select
              className={styles.filterSelect}
              onChange={(value) => setGranteeType(value)}
              options={[
                {
                  label: t("systemAdmin.objectGrants.filterGranteeTypeAll"),
                  value: "all",
                },
                {
                  label: t("systemAdmin.objectGrants.granteeUser"),
                  value: "user",
                },
                {
                  label: t("systemAdmin.objectGrants.granteeDept"),
                  value: "department",
                },
              ]}
              value={granteeType}
            />
          </div>
        </div>

        <div className={[styles.calloutBox, styles.sectionCallout].join(" ")}>
          <KeyOutlined />
          <span>
            {t("systemAdmin.objectGrants.calloutPrefix")}
            <AppButton
              className={styles.actionLink}
              onClick={() => void navigate("/system/roles")}
              style={{ fontSize: 13 }}
              type="link"
            >
              {t("systemAdmin.roles.title")}
            </AppButton>
            {t("systemAdmin.objectGrants.calloutSuffix")}
          </span>
        </div>

        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadData()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : (
          <>
            <div className={styles.tableSurface}>{renderBody()}</div>
            {listTotal > 0 ? (
              <TablePaginationBar
                current={pageState.page}
                onChange={setPagination}
                pageSize={pageState.pageSize}
                showSizeChanger
                showTotal={(count) => t("common.total", { total: count })}
                size="small"
                total={view === "all" ? listTotal : groupList.length}
              />
            ) : null}
          </>
        )}
      </section>

      {drawer.target ? (
        <ObjectAuthorizeDrawer
          objId={drawer.target.id}
          objName={drawer.target.name}
          objSub={drawer.target.sub}
          objType={drawer.target.type}
          onChanged={() => void loadData()}
          onClose={() => setDrawer({ open: false, target: null })}
          open={drawer.open}
        />
      ) : null}
    </>
  );
}
