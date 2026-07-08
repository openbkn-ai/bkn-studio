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
  UserOutlined,
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
import { listObjectGrantsPage, revokeObjectGrant } from "@/modules/system-admin/services/authz.service";
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

const INNER_PAGE_SIZE = 10;

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
  const [objectInnerPage, setObjectInnerPage] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});
  const [granteeInnerPage, setGranteeInnerPage] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});
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

      const paginate = view === "all";
      const result = await listObjectGrantsPage({
        search: debouncedKeyword || undefined,
        resourceType: objTypeFilter,
        offset: paginate ? (pageState.page - 1) * pageState.pageSize : undefined,
        limit: paginate ? pageState.pageSize : undefined,
        includeSummary: true,
      });

      setGrants(result.grants);
      setTotal(result.total);
      setSummary(
        result.summary ?? {
          grants: result.total,
          objects: new Set(result.grants.map((grant) => `${grant.objType}:${grant.objId}`)).size,
          grantees: new Set(result.grants.map((grant) => grant.accessorId)).size,
        },
      );
      const accessorIds = [...new Set(result.grants.map((grant) => grant.accessorId))];
      await hydrateUserLookup(accessorIds);
      setLookupRevision((revision) => revision + 1);
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

  const byObject = useMemo(() => {
    const groups = new Map<string, ObjectGrant[]>();
    for (const grant of filteredGrants) {
      const key = `${grant.objType}::${grant.objId}`;
      const list = groups.get(key) ?? [];
      list.push(grant);
      groups.set(key, list);
    }
    return [...groups.values()];
  }, [filteredGrants]);

  const byGrantee = useMemo(() => {
    const groups = new Map<string, ObjectGrant[]>();
    for (const grant of filteredGrants) {
      const list = groups.get(grant.accessorId) ?? [];
      list.push(grant);
      groups.set(grant.accessorId, list);
    }
    return [...groups.values()];
  }, [filteredGrants]);

  const groupList = useMemo(() => {
    if (view === "object") {
      return byObject;
    }
    if (view === "grantee") {
      return byGrantee;
    }
    return [];
  }, [byGrantee, byObject, view]);

  const pagedGroups = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return groupList.slice(start, start + pageState.pageSize);
  }, [groupList, pageState.page, pageState.pageSize]);

  const pagedGrants = useMemo(() => {
    if (view === "all") {
      return filteredGrants;
    }
    const start = (pageState.page - 1) * pageState.pageSize;
    return filteredGrants.slice(start, start + pageState.pageSize);
  }, [filteredGrants, pageState.page, pageState.pageSize, view]);

  const listTotal = view === "all" ? total : groupList.length;

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
    if (!loading && filteredGrants.length === 0) {
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
          {pagedGroups.map((list) => {
            const head = list[0];
            const groupKey = `${head.objType}::${head.objId}`;
            const inner = objectInnerPage[groupKey] ?? {
              page: 1,
              pageSize: INNER_PAGE_SIZE,
            };
            const innerStart = (inner.page - 1) * inner.pageSize;
            const innerPaged = list.slice(innerStart, innerStart + inner.pageSize);

            return (
              <div className={styles.authzGroup} key={groupKey}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzAvatar}>
                      {OBJ_ICON[head.objType] ?? <AppstoreOutlined />}
                    </span>
                    <span className={styles.authzGroupName}>{head.objName}</span>
                    <Tag className={styles.roleTag}>{resourceTypeLabel(head.objType)}</Tag>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.granteeCount", { count: list.length })}
                    </span>
                  </span>
                  <AppButton
                    icon={<KeyOutlined />}
                    onClick={() =>
                      openDrawer({
                        id: head.objId,
                        name: head.objName,
                        sub: head.objSub,
                        type: head.objType,
                      })
                    }
                  >
                    {t("systemAdmin.objectGrants.manage")}
                  </AppButton>
                </div>
                <div className={styles.authzGroupBody}>
                  {innerPaged.map((grant) => (
                    <div className={styles.authzGrantLine} key={grantKey(grant)}>
                      {granteeCell(grant.accessorId)}
                      {opChips(grant)}
                      <AppButton
                        className={[styles.actionLink, styles.actionDanger].join(" ")}
                        danger
                        onClick={() => confirmRevoke(grant)}
                        type="link"
                      >
                        {t("systemAdmin.objectGrants.revoke")}
                      </AppButton>
                    </div>
                  ))}
                  {list.length > inner.pageSize ? (
                    <TablePaginationBar
                      current={inner.page}
                      onChange={(page, nextPageSize) => {
                        setObjectInnerPage((prev) => ({
                          ...prev,
                          [groupKey]: {
                            page,
                            pageSize: nextPageSize ?? inner.pageSize,
                          },
                        }));
                      }}
                      pageSize={inner.pageSize}
                      showSizeChanger
                      showTotal={(count) => t("common.total", { total: count })}
                      size="small"
                      total={list.length}
                    />
                  ) : null}
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
          {pagedGroups.map((list) => {
            const head = list[0];
            const grantee = resolveGrantee(head.accessorId);
            const inner = granteeInnerPage[head.accessorId] ?? {
              page: 1,
              pageSize: INNER_PAGE_SIZE,
            };
            const innerStart = (inner.page - 1) * inner.pageSize;
            const innerPaged = list.slice(innerStart, innerStart + inner.pageSize);

            return (
              <div className={styles.authzGroup} key={head.accessorId}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzGroupName}>{grantee.label}</span>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.objectCount", { count: list.length })}
                    </span>
                  </span>
                </div>
                <div className={styles.authzGroupBody}>
                  {innerPaged.map((grant) => (
                    <div className={styles.authzGrantLine} key={grantKey(grant)}>
                      <span className={styles.authzWho}>
                        <span className={styles.authzAvatar}>
                          {OBJ_ICON[grant.objType] ?? <AppstoreOutlined />}
                        </span>
                        <span className={styles.authzWhoName}>{grant.objName}</span>
                        <Tag className={styles.roleTag}>{resourceTypeLabel(grant.objType)}</Tag>
                      </span>
                      {opChips(grant)}
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
                    </div>
                  ))}
                  {list.length > inner.pageSize ? (
                    <TablePaginationBar
                      current={inner.page}
                      onChange={(page, nextPageSize) => {
                        setGranteeInnerPage((prev) => ({
                          ...prev,
                          [head.accessorId]: {
                            page,
                            pageSize: nextPageSize ?? inner.pageSize,
                          },
                        }));
                      }}
                      pageSize={inner.pageSize}
                      showSizeChanger
                      showTotal={(count) => t("common.total", { total: count })}
                      size="small"
                      total={list.length}
                    />
                  ) : null}
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
        dataSource={pagedGrants}
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
