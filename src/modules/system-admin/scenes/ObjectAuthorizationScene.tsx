/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Tabs } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { MemberAuthorizationPanel } from "@/modules/system-admin/components/MemberAuthorizationPanel";
import { TopResourceAuthorizationPanel } from "@/modules/system-admin/components/TopResourceAuthorizationPanel";
import { authzPoints } from "@/modules/system-admin/permissions";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";
import { getCachedDepartments } from "@/modules/system-admin/utils/audit-lookup-cache";

import styles from "./admin.module.css";

type ViewMode = "resource" | "user";

type DrawerTarget = {
  id: string;
  name: string;
  sub?: string;
  type: string;
};

export function ObjectAuthorizationScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fineGrained = useCapability(CAPABILITIES.PERM_FINE_GRAINED) === "available";
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [view, setView] = useState<ViewMode>("resource");
  const [drawer, setDrawer] = useState<{ open: boolean; target: DrawerTarget | null }>({
    open: false,
    target: null,
  });

  // Refresh reloads the mounted workbench and refreshes the organization navigator without
  // downloading the retired flattened permission-record list.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const departmentList = await getCachedDepartments();
      setDepartments(departmentList);
      setWorkspaceRevision((current) => current + 1);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openDrawer = useCallback((target: DrawerTarget) => {
    setDrawer({ open: true, target });
  }, []);

  const renderWorkspace = (workspace: ViewMode) => {
    if (workspace === "user" && loadError) {
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
    if (workspace === "resource") {
      return (
        <TopResourceAuthorizationPanel
          fineGrained={fineGrained}
          key={`resource-${workspaceRevision}`}
          onManage={(target) =>
            openDrawer({
              id: target.id,
              name: target.name,
              sub: target.sub,
              type: target.type,
            })
          }
        />
      );
    }
    return <MemberAuthorizationPanel key={`user-${workspaceRevision}`} departments={departments} />;
  };

  return (
    <>
      <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>
        <div className={styles.authzGlobalActions}>
          <PermissionGate permissions={authzPoints.grant}>
            <AppButton
              icon={<PlusOutlined />}
              onClick={() => void navigate("/system/authorizations/new")}
              type="primary"
            >
              {t("systemAdmin.objectGrants.create")}
            </AppButton>
          </PermissionGate>
          <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
            {t("common.refresh")}
          </AppButton>
        </div>

        <Tabs
          activeKey={view}
          className={styles.authzWorkspaceTabs}
          items={[
            {
              children: (
                <div className={styles.authzWorkspacePane}>
                  <div className={styles.objectWorkbenchSurface}>{renderWorkspace("resource")}</div>
                </div>
              ),
              key: "resource",
              label: t("systemAdmin.objectGrants.tabResource"),
            },
            {
              children: (
                <div className={styles.authzWorkspacePane}>
                  <div className={styles.tableSurface}>{renderWorkspace("user")}</div>
                </div>
              ),
              key: "user",
              label: t("systemAdmin.objectGrants.tabUser"),
            },
          ]}
          onChange={(key) => setView(key as ViewMode)}
        />
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
