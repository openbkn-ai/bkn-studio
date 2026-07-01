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
import { Alert, Empty, Input, Modal, Segmented, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { listUsers } from "@/modules/system-admin/services/admin.service";
import {
  listAuthorizableObjects,
  listObjectGrants,
  revokeObjectGrant,
  summarizeGrants,
} from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import type { AuthorizableObject, ObjectGrant } from "@/modules/system-admin/types/authz";
import { authzObjectTypeOptions } from "@/modules/system-admin/utils/authz-catalog";
import {
  operationLabel,
  resourceTypeLabel,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "./admin.module.css";

type ViewMode = "all" | "object" | "grantee";

type DrawerTarget = { id: string; name: string; sub?: string; type: string };

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

const grantKey = (g: ObjectGrant) => `${g.accessorId}:${g.objType}:${g.objId}`;

export function ObjectAuthorizationScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();

  const [grants, setGrants] = useState<ObjectGrant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>("all");
  const [keyword, setKeyword] = useState("");
  const [objTypeFilter, setObjTypeFilter] = useState<string>();

  const [drawer, setDrawer] = useState<{ open: boolean; target: DrawerTarget | null }>({
    open: false,
    target: null,
  });

  const [picker, setPicker] = useState<{ loading: boolean; objects: AuthorizableObject[]; open: boolean; value?: string }>({
    loading: false,
    objects: [],
    open: false,
    value: undefined,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [grantList, userList] = await Promise.all([listObjectGrants(), listUsers()]);
      setGrants(grantList);
      setUsers(userList);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userName = useCallback((id: string) => userMap.get(id)?.name ?? id, [userMap]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return grants.filter((g) => {
      if (objTypeFilter && g.objType !== objTypeFilter) {
        return false;
      }
      if (query) {
        const hay = `${g.objName} ${userName(g.accessorId)} ${g.operations.join(" ")}`.toLowerCase();
        if (!hay.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [grants, keyword, objTypeFilter, userName]);

  const summary = useMemo(() => summarizeGrants(grants), [grants]);

  const userCell = (accessorId: string) => (
    <span className={styles.authzWho}>
      <span className={styles.authzAvatar}>
        <UserOutlined />
      </span>
      <span className={styles.authzWhoName}>{userName(accessorId)}</span>
    </span>
  );

  const opChips = (grant: ObjectGrant) => (
    <span className={styles.chipRow}>
      {grant.operations.map((op) => (
        <Tag className={styles.permChip} key={op} title={op}>
          {operationLabel(grant.objType, op)}
        </Tag>
      ))}
    </span>
  );

  const openDrawer = (target: DrawerTarget) => setDrawer({ open: true, target });

  const confirmRevoke = (grant: ObjectGrant) => {
    void modal.confirm({
      title: t("systemAdmin.objectGrants.revokeTitle"),
      content: t("systemAdmin.objectGrants.revokeConfirm", {
        name: userName(grant.accessorId),
        object: grant.objName,
      }),
      okText: t("systemAdmin.objectGrants.revoke"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revokeObjectGrant(grant.accessorId, grant.objType, grant.objId);
          message.success(t("systemAdmin.objectGrants.toast.revoked"));
          await loadData();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  // ---- new grant: pick object → open drawer ----
  const openPicker = async () => {
    setPicker({ loading: true, objects: [], open: true, value: undefined });
    try {
      const objects = await listAuthorizableObjects();
      setPicker({ loading: false, objects, open: true, value: undefined });
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
      setPicker({ loading: false, objects: [], open: false, value: undefined });
    }
  };

  const pickerOptions = useMemo(() => {
    const byType = new Map<string, AuthorizableObject[]>();
    for (const obj of picker.objects) {
      const list = byType.get(obj.type) ?? [];
      list.push(obj);
      byType.set(obj.type, list);
    }
    return [...byType.entries()].map(([type, list]) => ({
      label: resourceTypeLabel(type),
      options: list.map((obj) => ({
        label: obj.sub ? `${obj.name}（${obj.sub}）` : obj.name,
        value: `${obj.type}::${obj.id}`,
      })),
    }));
  }, [picker.objects]);

  const confirmPicker = () => {
    if (!picker.value) {
      void message.error(t("systemAdmin.objectGrants.pickObjectFirst"));
      return;
    }
    const [type, id] = picker.value.split("::");
    const obj = picker.objects.find((item) => item.type === type && item.id === id);
    setPicker((prev) => ({ ...prev, open: false }));
    if (obj) {
      openDrawer({ type: obj.type, id: obj.id, name: obj.name, sub: obj.sub });
    }
  };

  // ---- views ----
  const columns: ColumnsType<ObjectGrant> = [
    {
      title: t("systemAdmin.objectGrants.columns.object"),
      key: "object",
      render: (_, g) => (
        <div className={styles.nameCell}>
          <span className={styles.nameTitle}>{g.objName}</span>
          {g.objSub ? <span className={styles.subText}>{g.objSub}</span> : null}
        </div>
      ),
    },
    {
      title: t("systemAdmin.objectGrants.columns.type"),
      key: "type",
      render: (_, g) => <Tag className={styles.roleTag}>{resourceTypeLabel(g.objType)}</Tag>,
    },
    {
      title: t("systemAdmin.objectGrants.columns.grantee"),
      key: "grantee",
      render: (_, g) => userCell(g.accessorId),
    },
    {
      title: t("systemAdmin.objectGrants.columns.operations"),
      key: "operations",
      render: (_, g) => opChips(g),
    },
    {
      title: t("systemAdmin.objectGrants.columns.actions"),
      key: "actions",
      render: (_, g) => (
        <span className={styles.actionGroup}>
          <AppButton
            className={styles.actionLink}
            onClick={() => openDrawer({ type: g.objType, id: g.objId, name: g.objName, sub: g.objSub })}
            type="link"
          >
            {t("systemAdmin.objectGrants.manage")}
          </AppButton>
          <AppButton
            className={[styles.actionLink, styles.actionDanger].join(" ")}
            danger
            onClick={() => confirmRevoke(g)}
            type="link"
          >
            {t("systemAdmin.objectGrants.revoke")}
          </AppButton>
        </span>
      ),
    },
  ];

  const byObject = useMemo(() => {
    const groups = new Map<string, ObjectGrant[]>();
    for (const g of filtered) {
      const key = `${g.objType}::${g.objId}`;
      const list = groups.get(key) ?? [];
      list.push(g);
      groups.set(key, list);
    }
    return [...groups.values()];
  }, [filtered]);

  const byGrantee = useMemo(() => {
    const groups = new Map<string, ObjectGrant[]>();
    for (const g of filtered) {
      const list = groups.get(g.accessorId) ?? [];
      list.push(g);
      groups.set(g.accessorId, list);
    }
    return [...groups.values()];
  }, [filtered]);

  const renderBody = () => {
    if (loadError) {
      return (
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
      );
    }
    if (!loading && !filtered.length) {
      return <Empty description={t("systemAdmin.objectGrants.empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    if (view === "object") {
      return (
        <div className={styles.authzGroupList}>
          {byObject.map((list) => {
            const head = list[0];
            return (
              <div className={styles.authzGroup} key={`${head.objType}::${head.objId}`}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzAvatar}>{OBJ_ICON[head.objType] ?? <AppstoreOutlined />}</span>
                    <span className={styles.authzGroupName}>{head.objName}</span>
                    <Tag className={styles.roleTag}>{resourceTypeLabel(head.objType)}</Tag>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.granteeCount", { count: list.length })}
                    </span>
                  </span>
                  <AppButton
                    icon={<KeyOutlined />}
                    onClick={() =>
                      openDrawer({ type: head.objType, id: head.objId, name: head.objName, sub: head.objSub })
                    }
                  >
                    {t("systemAdmin.objectGrants.manage")}
                  </AppButton>
                </div>
                <div className={styles.authzGroupBody}>
                  {list.map((g) => (
                    <div className={styles.authzGrantLine} key={grantKey(g)}>
                      {userCell(g.accessorId)}
                      {opChips(g)}
                      <AppButton
                        className={[styles.actionLink, styles.actionDanger].join(" ")}
                        onClick={() => confirmRevoke(g)}
                        type="link"
                      >
                        {t("systemAdmin.objectGrants.revoke")}
                      </AppButton>
                    </div>
                  ))}
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
          {byGrantee.map((list) => {
            const head = list[0];
            return (
              <div className={styles.authzGroup} key={head.accessorId}>
                <div className={styles.authzGroupHead}>
                  <span className={styles.authzGroupTitle}>
                    <span className={styles.authzAvatar}>
                      <UserOutlined />
                    </span>
                    <span className={styles.authzGroupName}>{userName(head.accessorId)}</span>
                    <span className={styles.authzGroupCount}>
                      {t("systemAdmin.objectGrants.objectCount", { count: list.length })}
                    </span>
                  </span>
                </div>
                <div className={styles.authzGroupBody}>
                  {list.map((g) => (
                    <div className={styles.authzGrantLine} key={grantKey(g)}>
                      <span className={styles.authzWho}>
                        <span className={styles.authzAvatar}>{OBJ_ICON[g.objType] ?? <AppstoreOutlined />}</span>
                        <span className={styles.authzWhoName}>{g.objName}</span>
                        <Tag className={styles.roleTag}>{resourceTypeLabel(g.objType)}</Tag>
                      </span>
                      {opChips(g)}
                      <AppButton
                        className={styles.actionLink}
                        onClick={() => openDrawer({ type: g.objType, id: g.objId, name: g.objName, sub: g.objSub })}
                        type="link"
                      >
                        {t("systemAdmin.objectGrants.manage")}
                      </AppButton>
                    </div>
                  ))}
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
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        rowKey={grantKey}
      />
    );
  };

  return (
    <>
      <section className={styles.contentSurface}>
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
            <span className={styles.statValue}>{authzObjectTypeOptions().length}</span>
          </div>
        </div>

        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <PermissionGate permissions="admin-authz:grant">
                <AppButton icon={<PlusOutlined />} onClick={() => void openPicker()} type="primary">
                  {t("systemAdmin.objectGrants.create")}
                </AppButton>
              </PermissionGate>
              <AppButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  void loadData();
                  message.info(t("systemAdmin.objectGrants.toast.refreshed"));
                }}
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
              options={authzObjectTypeOptions()}
              placeholder={t("systemAdmin.objectGrants.filterObjType")}
              value={objTypeFilter}
            />
          </div>
        </div>

        <div className={styles.calloutBox} style={{ marginTop: 16 }}>
          <KeyOutlined />
          <span>
            {t("systemAdmin.objectGrants.calloutPrefix")}
            <AppButton
              className={styles.actionLink}
              onClick={() => navigate("/system/roles")}
              style={{ fontSize: 13 }}
              type="link"
            >
              {t("systemAdmin.roles.title")}
            </AppButton>
            {t("systemAdmin.objectGrants.calloutSuffix")}
          </span>
        </div>

        <div className={styles.tableSurface}>{renderBody()}</div>
      </section>

      {drawer.target ? (
        <ObjectAuthorizeDrawer
          objId={drawer.target.id}
          objName={drawer.target.name}
          objSub={drawer.target.sub}
          objType={drawer.target.type}
          onChanged={loadData}
          onClose={() => setDrawer({ open: false, target: null })}
          open={drawer.open}
        />
      ) : null}

      <Modal
        cancelText={t("common.cancel")}
        okText={t("systemAdmin.objectGrants.pickerNext")}
        onCancel={() => setPicker((prev) => ({ ...prev, open: false }))}
        onOk={confirmPicker}
        open={picker.open}
        title={t("systemAdmin.objectGrants.create")}
      >
        <p className={styles.subText} style={{ marginTop: 0 }}>
          {t("systemAdmin.objectGrants.pickerHint")}
        </p>
        <Select
          loading={picker.loading}
          onChange={(value) => setPicker((prev) => ({ ...prev, value }))}
          optionFilterProp="label"
          options={pickerOptions}
          placeholder={t("systemAdmin.objectGrants.pickerPlaceholder")}
          showSearch
          style={{ width: "100%" }}
          value={picker.value}
        />
      </Modal>
    </>
  );
}
