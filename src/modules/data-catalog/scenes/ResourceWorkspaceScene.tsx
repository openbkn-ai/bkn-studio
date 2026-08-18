/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ResourceDetailPanel } from "@/modules/data-catalog/components/ResourceDetailPanel";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import { ResourceIndexPanel } from "@/modules/data-catalog/components/ResourceIndexPanel";
import { ResourcePreviewPanel } from "@/modules/data-catalog/components/ResourcePreviewPanel";
import { ResourceSemanticUnderstandingPanel } from "@/modules/data-catalog/components/ResourceSemanticUnderstandingPanel";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import {
  indexStateOf,
  resourceGateOf,
  sortTasks,
} from "@/modules/data-catalog/lib/index-state";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { getCatalog } from "@/shared/catalog";
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
  const { modal } = useAppServices();
  const [resource, setResource] = useState<CatalogResource | null>(null);
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    setLoading(true);

    try {
      const detail = await getCatalogResource(resourceId);
      if (!detail) {
        setResource(null);
        setCatalog(null);
        setTasks([]);
        return;
      }

      const [catalogRecord, taskList] = await Promise.all([
        getCatalog(detail.catalogId),
        listBuildTasks({ resourceId }),
      ]);

      setResource(detail);
      setCatalog(catalogRecord);
      setTasks(taskList);
    } catch (error) {
      setResource(null);
      setCatalog(null);
      setTasks([]);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    return subscribeMockDb(() => {
      void loadAll();
    });
  }, [loadAll]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const indexState = useMemo(() => indexStateOf(sortedTasks), [sortedTasks]);
  const gate = resourceGateOf(catalog);
  const hideSemanticUnderstanding = Boolean(catalog?.internal);
  const discoveryFailed = resource?.lastDiscoverStatus === "error";
  const queryBlockReason = resource ? resourceQueryBlockReason(resource) : null;
  const resourceDisabled = queryBlockReason === "disabled";
  const resourceMissing = queryBlockReason === "missing";
  const resourceStale = queryBlockReason === "stale";
  const metadataUnavailable = queryBlockReason === "metadata_unavailable";

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

  if (loadError) {
    return (
      <section className={styles.contentSurface}>
        <Alert
          action={
            <AppButton onClick={() => void loadAll()} type="link">
              {t("common.retry")}
            </AppButton>
          }
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
                void navigate("/data-directory");
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

  const backTarget = catalog
    ? `/data-directory/catalog/${catalog.id}`
    : "/data-directory";

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
                        void navigate(`/data-directory/catalog/${catalog.id}`);
                      }}
                      type="button"
                    >
                      {catalog.name}
                    </button>
                  </span>
                </>
              ) : null}
              {!catalog?.internal ? (
                <>
                  <span className={styles.contextDivider}>·</span>
                  <span className={styles.contextMeta}>
                    {t("dataCatalog.resource.headerIndexState")}{" "}
                    {formatIndexStateLabel(indexState, t)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {discoveryFailed || queryBlockReason ? (
          <Alert
            action={!resourceDisabled && !resourceStale && (discoveryFailed || resourceMissing) ? (
              <AppButton
                onClick={() => {
                  void navigate(`/data-connect/discover?catalogId=${resource.catalogId}`);
                }}
                type="link"
              >
                {t("dataCatalog.resourceWorkspace.openDiscovery")}
              </AppButton>
            ) : undefined}
            className={styles.resourceAlert}
            description={(
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
            )}
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
                  <ResourceDetailPanel
                    active={tab === "detail"}
                    catalog={catalog}
                    onEditingChange={setDetailEditing}
                    onResourceRefreshed={handleResourceRefreshed}
                    onUpdated={loadAll}
                    resource={resource}
                  />
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
                    disabled={!gate.ok}
                    disabledMessage={previewDisabledMessage}
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
                    onRefresh={loadAll}
                    resource={resource}
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
                    /*
                      页签上直接挂档位徽标:这一片整体是付费能力,进去之后才发现要买,不如在
                      入口处就说清。徽标在证与镜像都满足时自己消失。
                    */
                    label: (
                      <span className="console-tab-with-tier">
                        {t("dataCatalog.resourceWorkspace.tabSemanticUnderstanding")}
                        <EditionBadge
                          capability={CAPABILITIES.SEMANTIC_TASK}
                          edition="professional"
                        />
                      </span>
                    ),
                    children: (
                      <div className={styles.tabPanel}>
                        {/* 整片盖蒙版而不是只拦「新建任务」:列表本身也是这项能力的一部分。 */}
                        <RequireEdition
                          capability={CAPABILITIES.SEMANTIC_TASK}
                          minEdition="professional"
                        >
                          <ResourceSemanticUnderstandingPanel active={tab === "semantic-understanding"} resource={resource} />
                        </RequireEdition>
                      </div>
                    ),
                  },
                ]),
          ]}
          onChange={handleTabChange}
        />
      </section>
    </>
  );
}
