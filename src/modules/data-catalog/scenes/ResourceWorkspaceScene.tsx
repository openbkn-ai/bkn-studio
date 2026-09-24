/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, KeyOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Space, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { extractRequestErrorMessage, isRequestForbidden } from "@/framework/request/error-message";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { AppButton } from "@/framework/ui/common/AppButton";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ResourceDetailPanel } from "@/modules/data-catalog/components/ResourceDetailPanel";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { authzPoints } from "@/modules/system-admin/permissions";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import { ResourceIndexPanel } from "@/modules/data-catalog/components/ResourceIndexPanel";
import { ResourcePreviewPanel } from "@/modules/data-catalog/components/ResourcePreviewPanel";
import { ResourceSemanticUnderstandingPanel } from "@/modules/data-catalog/components/ResourceSemanticUnderstandingPanel";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { indexStateOf, resourceGateOf, sortTasks } from "@/modules/data-catalog/lib/index-state";
import { listBuildTaskPage } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import {
  discoverCatalogResource,
  getCatalogResource,
  setCatalogResourceEnabled,
} from "@/modules/data-catalog/services/resource.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { hasCatalogResourceOperation } from "@/modules/data-catalog/utils/resource-operations";
import { getCatalog, hasCatalogOperation } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./ResourceWorkspaceScene.module.css";

export type ResourceWorkspaceTab = "detail" | "index" | "preview" | "semantic-understanding";

type ResourceWorkspaceSceneProps = {
  indexView: ResourceIndexView;
  indexViewExplicit?: boolean;
  onIndexViewChange: (view: ResourceIndexView) => void;
  onTabChange: (tab: ResourceWorkspaceTab) => void;
  resourceId: string;
  tab: ResourceWorkspaceTab;
};

export function ResourceWorkspaceScene({
  indexView,
  indexViewExplicit = false,
  onIndexViewChange,
  onTabChange,
  resourceId,
  tab,
}: ResourceWorkspaceSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal, runtimeConfig } = useAppServices();
  const permissionRequestsEnabled = !isCommunityBuild(useEntitlement());
  // Reading this table's rows is granted on the table itself; its management verbs live on the
  // owning catalog (openbkn-ai/bkn-foundry#986). Shown to whoever may issue grants at all.
  const canAuthorizeGrants = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.grant,
  });
  const [resource, setResource] = useState<CatalogResource | null>(null);
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [catalogVisibilityRestricted, setCatalogVisibilityRestricted] = useState(false);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [taskStatusUnavailable, setTaskStatusUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resourceReadForbidden, setResourceReadForbidden] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [resourceAction, setResourceAction] = useState<"discover" | "enabled" | null>(null);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const previousTabRef = useRef(tab);
  const resourceVersionRef = useRef(0);
  const loadRequestIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    const resourceVersion = ++resourceVersionRef.current;
    const loadRequestId = ++loadRequestIdRef.current;
    setLoadError(null);
    setResourceReadForbidden(false);
    setTaskStatusUnavailable(false);
    setLoading(true);

    try {
      const detail = await getCatalogResource(resourceId);
      if (!detail) {
        if (
          resourceVersionRef.current === resourceVersion &&
          loadRequestIdRef.current === loadRequestId
        ) {
          setResource(null);
          setCatalog(null);
          setCatalogVisibilityRestricted(false);
          setTasks([]);
        }
        return;
      }

      const catalogRecord = await getCatalog(detail.catalogId, { skipErrorToast: true }).catch(
        (error) => {
          if (isRequestForbidden(error)) {
            return null;
          }
          throw error;
        },
      );
      let latestTasks: BuildTask[] = [];
      let taskLoadFailed = false;
      if (hasCatalogOperation(catalogRecord, "task_manage")) {
        try {
          const latestTaskPage = await listBuildTaskPage(
            {
              direction: "desc",
              limit: 1,
              resourceId,
              sort: "create_time",
            },
            { skipErrorToast: true },
          );
          latestTasks = latestTaskPage.items;
        } catch {
          taskLoadFailed = true;
        }
      }

      if (resourceVersionRef.current === resourceVersion) {
        setResource(detail);
        setResourceReadForbidden(false);
      }
      if (loadRequestIdRef.current === loadRequestId) {
        setCatalog(catalogRecord);
        setCatalogVisibilityRestricted(catalogRecord === null);
        setTasks(latestTasks);
        setTaskStatusUnavailable(taskLoadFailed);
      }
    } catch (error) {
      if (
        resourceVersionRef.current === resourceVersion &&
        loadRequestIdRef.current === loadRequestId
      ) {
        const forbidden = isRequestForbidden(error);
        setResource(null);
        setResourceReadForbidden(forbidden);
        setLoadError(forbidden ? null : extractRequestErrorMessage(error));
        setCatalog(null);
        setCatalogVisibilityRestricted(false);
        setTasks([]);
        setTaskStatusUnavailable(false);
      }
    } finally {
      if (loadRequestIdRef.current === loadRequestId) {
        setLoading(false);
      }
    }
  }, [resourceId]);

  const handleLatestTaskLoaded = useCallback(
    (loadedResourceId: string, latest: BuildTask | null) => {
      if (loadedResourceId !== resourceId) return;
      setTasks(latest ? [latest] : []);
      setTaskStatusUnavailable(false);
    },
    [resourceId],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshResource = useCallback(async () => {
    const resourceVersion = ++resourceVersionRef.current;
    try {
      const detail = await getCatalogResource(resourceId);
      if (detail && resourceVersionRef.current === resourceVersion) {
        setResource(detail);
        setResourceReadForbidden(false);
        return true;
      }
    } catch (error) {
      if (resourceVersionRef.current === resourceVersion) {
        if (isRequestForbidden(error)) {
          setResource(null);
          setCatalog(null);
          setTasks([]);
          setTaskStatusUnavailable(false);
          setResourceReadForbidden(true);
          setLoadError(null);
        } else {
          void message.error(extractRequestErrorMessage(error));
        }
      }
    }
    return false;
  }, [message, resourceId]);

  const refreshIndexContext = useCallback(async () => {
    if (!(await refreshResource()) || !hasCatalogOperation(catalog, "task_manage")) return;
    const resourceVersion = resourceVersionRef.current;
    try {
      const latestTaskPage = await listBuildTaskPage(
        {
          direction: "desc",
          limit: 1,
          resourceId,
          sort: "create_time",
        },
        { skipErrorToast: true },
      );
      if (resourceVersionRef.current !== resourceVersion) return;
      setTasks(latestTaskPage.items);
      setTaskStatusUnavailable(false);
    } catch {
      if (resourceVersionRef.current === resourceVersion) {
        setTaskStatusUnavailable(true);
      }
    }
  }, [catalog, refreshResource, resourceId]);

  useEffect(() => {
    const previousTab = previousTabRef.current;
    previousTabRef.current = tab;
    if (previousTab !== tab && (tab === "detail" || tab === "index" || tab === "preview")) {
      void refreshResource();
    }
  }, [refreshResource, tab]);

  useEffect(() => {
    return subscribeMockDb(() => {
      void loadAll();
    });
  }, [loadAll]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const indexState = useMemo(
    () => indexStateOf(sortedTasks, resource?.localIndexStatus ?? "unavailable"),
    [resource?.localIndexStatus, sortedTasks],
  );
  // A directly granted Resource remains readable even when its parent Catalog is hidden.
  // Do not infer any Catalog metadata or management permission in that restricted view.
  const gate = catalogVisibilityRestricted ? { ok: true } : resourceGateOf(catalog);
  const canManageCatalogTasks = hasCatalogOperation(catalog, "task_manage");
  const canModifyResource = hasCatalogOperation(catalog, "resource_manage");
  const canViewResourceDetail = hasCatalogResourceOperation(resource, "view_detail");
  const canQueryResource = hasCatalogResourceOperation(resource, "query_data");
  const canAuthorizeResource = Boolean(!catalog?.builtin && canAuthorizeGrants);
  // Internal catalogs do not support semantic-understanding tasks. Missing task permission is
  // handled inside the tab panel so the navigation remains discoverable and deep links stay valid.
  const hideSemanticUnderstanding = Boolean(catalog?.builtin);
  const discoveryFailed = resource?.lastDiscoverStatus === "error";
  const queryBlockReason = resource ? resourceQueryBlockReason(resource) : null;
  const resourceDisabled = queryBlockReason === "disabled";
  const resourceMissing = queryBlockReason === "missing";
  const resourceStale = queryBlockReason === "stale";
  const metadataUnavailable = queryBlockReason === "metadata_unavailable";

  useEffect(() => {
    if (!canViewResourceDetail) setDetailEditing(false);
  }, [canViewResourceDetail]);

  useEffect(() => {
    if (hideSemanticUnderstanding && tab === "semantic-understanding") {
      onTabChange("detail");
    }
  }, [hideSemanticUnderstanding, onTabChange, tab]);

  const previewDisabledMessage = catalog
    ? t("dataCatalog.gate.catalogDisabled", { name: catalog.name })
    : t("dataCatalog.gate.catalogDisabledShort");

  const handleResourceRefreshed = useCallback((latestResource: CatalogResource) => {
    setResource(latestResource);
  }, []);

  const triggerResourceDiscovery = useCallback(async () => {
    setResourceAction("discover");
    try {
      await discoverCatalogResource(resourceId);
      void message.success(t("dataCatalog.resourceWorkspace.discoveryQueued"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setResourceAction(null);
    }
  }, [message, resourceId, t]);

  const updateResourceEnabled = useCallback(
    async (enabled: boolean) => {
      setResourceAction("enabled");
      try {
        const latest = await setCatalogResourceEnabled(resourceId, enabled);
        if (latest) {
          setResource(latest);
        }
        void message.success(
          t(
            enabled
              ? "dataCatalog.resourceWorkspace.enableSuccess"
              : "dataCatalog.resourceWorkspace.disableSuccess",
          ),
        );
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setResourceAction(null);
      }
    },
    [message, resourceId, t],
  );

  const confirmResourceDiscovery = useCallback(() => {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("dataCatalog.resourceWorkspace.refreshMetadataConfirmDescription"),
      okText: t("dataCatalog.resourceWorkspace.refreshMetadataConfirm"),
      onOk: triggerResourceDiscovery,
      title: t("dataCatalog.resourceWorkspace.refreshMetadataConfirmTitle"),
    });
  }, [modal, t, triggerResourceDiscovery]);

  const confirmResourceEnabled = useCallback(
    (enabled: boolean) => {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t(
          enabled
            ? "dataCatalog.resourceWorkspace.enableConfirmDescription"
            : "dataCatalog.resourceWorkspace.disableConfirmDescription",
        ),
        okButtonProps: enabled ? undefined : { danger: true },
        okText: t(enabled ? "common.enable" : "common.disable"),
        onOk: () => updateResourceEnabled(enabled),
        title: t(
          enabled
            ? "dataCatalog.resourceWorkspace.enableConfirmTitle"
            : "dataCatalog.resourceWorkspace.disableConfirmTitle",
        ),
      });
    },
    [modal, t, updateResourceEnabled],
  );

  const handleTabChange = (key: string) => {
    const nextTab = key as ResourceWorkspaceTab;
    if (tab === "detail" && nextTab !== "detail" && detailEditing) {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("dataCatalog.resourceWorkspace.discardChangesDescription"),
        okButtonProps: { danger: true },
        okText: t("dataCatalog.resourceWorkspace.discardChangesConfirm"),
        onOk: () => onTabChange(nextTab),
        title: t("dataCatalog.resourceWorkspace.discardChangesTitle"),
      });
      return;
    }
    onTabChange(nextTab);
  };

  if (loading) {
    return (
      <section className={styles.contentSurface}>
        <div className={styles.placeholder}>
          <Spin />
        </div>
      </section>
    );
  }

  if (resourceReadForbidden) {
    const permissionWarning = (
      <div className={styles.tabPanel}>
        <Alert
          description={t("dataCatalog.resourceWorkspace.permissionRefreshHint")}
          message={t("dataCatalog.permissionRequired")}
          showIcon
          type="warning"
        />
      </div>
    );

    return (
      <section className={styles.contentSurface}>
        <div className={styles.pageHeader}>
          <SceneBackButton onClick={() => void navigate("/data-catalog")} />
        </div>
        <Tabs
          activeKey={tab}
          className={styles.pageTabs}
          items={(
            [
              ["detail", "tabDetail"],
              ["preview", "tabPreview"],
              ["index", "tabIndex"],
              ["semantic-understanding", "tabSemanticUnderstanding"],
            ] as const
          ).map(([key, label]) => ({
            key,
            label: t(`dataCatalog.resourceWorkspace.${label}`),
            children: permissionWarning,
          }))}
          onChange={handleTabChange}
        />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className={styles.contentSurface}>
        <Alert
          description={t("dataCatalog.resourceWorkspace.loadErrorRefreshHint")}
          message={loadError}
          showIcon
          type="error"
        />
      </section>
    );
  }

  if (!resource) {
    return (
      <section className={styles.contentSurface}>
        <EmptyStatePanel
          action={
            <SceneBackButton
              onClick={() => {
                void navigate("/data-catalog");
              }}
            />
          }
          description=""
          icon={<DatabaseOutlined />}
          title={t("dataCatalog.resource.notFound")}
        />
      </section>
    );
  }

  const backTarget = catalog ? `/data-catalog/catalog/${catalog.id}` : "/data-catalog";

  return (
    <>
      <section className={styles.contentSurface}>
        <div className={styles.pageHeader}>
          <SceneBackButton
            onClick={() => {
              void navigate(backTarget);
            }}
          />
          <div className={styles.pageHeaderMain}>
            <div className={styles.contextBar}>
              <span className={styles.contextLabel}>
                {t("dataCatalog.resourceWorkspace.currentResource")}
              </span>
              <strong className={styles.contextName}>{resource.name}</strong>
              {catalog ? (
                <>
                  <span className={styles.contextDivider}>·</span>
                  <span className={styles.contextMeta}>
                    {t("dataCatalog.resource.headerCatalog")}{" "}
                    <button
                      className={styles.textLink}
                      onClick={() => {
                        void navigate(`/data-catalog/catalog/${catalog.id}`);
                      }}
                      type="button"
                    >
                      {catalog.name}
                    </button>
                  </span>
                </>
              ) : null}
              {!catalog?.builtin ? (
                <>
                  <span className={styles.contextDivider}>·</span>
                  <span className={styles.contextMeta}>
                    {t("dataCatalog.resource.headerIndexState")}{" "}
                    {taskStatusUnavailable
                      ? t("dataCatalog.resourceWorkspace.indexStatusUnavailable")
                      : formatIndexStateLabel(indexState, t)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <Space>
            {canManageCatalogTasks ? (
              <AppButton
                disabled={detailEditing}
                icon={<ReloadOutlined />}
                loading={resourceAction === "discover"}
                onClick={confirmResourceDiscovery}
              >
                {t("dataCatalog.resourceWorkspace.refreshMetadata")}
              </AppButton>
            ) : null}
            {canModifyResource ? (
              <AppButton
                color={resource.enabled === false ? "green" : undefined}
                danger={resource.enabled !== false}
                disabled={detailEditing}
                loading={resourceAction === "enabled"}
                onClick={() => confirmResourceEnabled(resource.enabled === false)}
                type={resource.enabled === false ? "primary" : "default"}
                variant={resource.enabled === false ? "solid" : undefined}
              >
                {t(resource.enabled === false ? "common.enable" : "common.disable")}
              </AppButton>
            ) : null}
            {canAuthorizeResource ? (
              <AppButton icon={<KeyOutlined />} onClick={() => setAuthorizeOpen(true)}>
                {t("dataCatalog.catalog.authorize")}
                <EditionBadge capability={CAPABILITIES.PERM_FINE_GRAINED} edition="professional" />
              </AppButton>
            ) : null}
            {canRequestResourcePermission(
              "resource",
              resource.operations,
              permissionRequestsEnabled,
            ) ? (
              <ResourcePermissionRequestAction
                operations={resource.operations}
                resourceID={resource.id}
                resourceName={resource.name}
                resourceType="resource"
                trigger="button"
              />
            ) : null}
          </Space>
        </div>

        {taskStatusUnavailable ? (
          <Alert
            message={t("dataCatalog.resourceWorkspace.taskStatusUnavailable")}
            showIcon
            type="warning"
          />
        ) : null}

        {discoveryFailed || queryBlockReason ? (
          <Alert
            action={
              canManageCatalogTasks &&
              !resourceDisabled &&
              !resourceStale &&
              (discoveryFailed || resourceMissing) ? (
                <AppButton
                  onClick={() => {
                    void navigate(`/data-connect/${resource.catalogId}/discover`);
                  }}
                  type="link"
                >
                  {t("dataCatalog.resourceWorkspace.openDiscovery")}
                </AppButton>
              ) : undefined
            }
            className={styles.resourceAlert}
            description={
              <div>
                <div>
                  {t(
                    resourceDisabled
                      ? "dataCatalog.resourceWorkspace.resourceDisabledDescription"
                      : resourceMissing
                        ? "dataCatalog.resourceWorkspace.resourceMissingDescription"
                        : resourceStale
                          ? "dataCatalog.resourceWorkspace.resourceStaleDescription"
                          : metadataUnavailable
                            ? discoveryFailed
                              ? "dataCatalog.resourceWorkspace.discoveryFailedNoSchemaDescription"
                              : "dataCatalog.resourceWorkspace.metadataUnavailableDescription"
                            : "dataCatalog.resourceWorkspace.discoveryFailedStaleSchemaDescription",
                  )}
                </div>
                {resource.statusMessage ? (
                  <div className={styles.resourceStatusMessage}>
                    {t("dataCatalog.resourceWorkspace.statusMessageDetail", {
                      message: resource.statusMessage,
                    })}
                  </div>
                ) : null}
              </div>
            }
            message={t(
              resourceDisabled
                ? "dataCatalog.resourceWorkspace.resourceDisabledTitle"
                : resourceMissing
                  ? "dataCatalog.resourceWorkspace.resourceMissingTitle"
                  : resourceStale
                    ? "dataCatalog.resourceWorkspace.resourceStaleTitle"
                    : discoveryFailed
                      ? "dataCatalog.resourceWorkspace.discoveryFailedTitle"
                      : "dataCatalog.resourceWorkspace.metadataUnavailableTitle",
            )}
            showIcon
            type={queryBlockReason ? "error" : "warning"}
          />
        ) : null}

        <Tabs
          activeKey={tab}
          className={styles.pageTabs}
          items={[
            {
              key: "detail",
              label: t("dataCatalog.resourceWorkspace.tabDetail"),
              children: (
                <div className={styles.tabPanel}>
                  {canViewResourceDetail ? (
                    <ResourceDetailPanel
                      active={tab === "detail"}
                      canEdit={canModifyResource}
                      catalog={catalog}
                      onEditingChange={setDetailEditing}
                      onResourceRefreshed={handleResourceRefreshed}
                      onUpdated={loadAll}
                      resource={resource}
                    />
                  ) : (
                    <Alert message={t("dataCatalog.permissionRequired")} showIcon type="warning" />
                  )}
                </div>
              ),
            },
            {
              key: "preview",
              label: t("dataCatalog.resourceWorkspace.tabPreview"),
              children: (
                <div className={[styles.tabPanel, styles.tabPanelPreview].join(" ")}>
                  <ResourcePreviewPanel
                    active={tab === "preview"}
                    disabled={!gate.ok || !canQueryResource}
                    disabledMessage={
                      canQueryResource
                        ? previewDisabledMessage
                        : t("dataCatalog.permissionRequired")
                    }
                    resource={resource}
                  />
                </div>
              ),
            },
            {
              key: "index",
              label: t("dataCatalog.resourceWorkspace.tabIndex"),
              children: (
                <div className={styles.tabPanel}>
                  <ResourceIndexPanel
                    active={tab === "index"}
                    catalog={catalog}
                    indexView={indexView}
                    indexViewExplicit={indexViewExplicit}
                    onIndexViewChange={onIndexViewChange}
                    onLatestTaskLoaded={handleLatestTaskLoaded}
                    onRefresh={refreshIndexContext}
                    resource={resource}
                    taskStatusUnavailable={taskStatusUnavailable}
                    tasks={sortedTasks}
                  />
                </div>
              ),
            },
            ...(hideSemanticUnderstanding
              ? []
              : [
                  {
                    key: "semantic-understanding",
                    label: t("dataCatalog.resourceWorkspace.tabSemanticUnderstanding"),
                    children: (
                      <div className={styles.tabPanel}>
                        <ResourceSemanticUnderstandingPanel
                          active={tab === "semantic-understanding"}
                          catalog={catalog}
                          resource={resource}
                        />
                      </div>
                    ),
                  },
                ]),
          ]}
          onChange={handleTabChange}
        />
      </section>
      <ObjectAuthorizeDrawer
        objId={resource.id}
        objName={resource.name}
        objSub={catalog?.name}
        objType="resource"
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
      />
    </>
  );
}
