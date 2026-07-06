/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Spin, Tabs } from "antd";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ResourceDetailPanel } from "@/modules/data-catalog/components/ResourceDetailPanel";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { ResourceIndexPanel } from "@/modules/data-catalog/components/ResourceIndexPanel";
import { ResourcePreviewPanel } from "@/modules/data-catalog/components/ResourcePreviewPanel";
import {
  indexStateOf,
  resourceGateOf,
  sortTasks,
} from "@/modules/data-catalog/lib/index-state";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type { BuildTask, CatalogResource, IndexState } from "@/modules/data-catalog/types/data-catalog";
import { getDataConnectRecord } from "@/modules/data-connect/services/data-connect.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

import styles from "./ResourceWorkspaceScene.module.css";

export type ResourceWorkspaceTab = "detail" | "index" | "preview";

type ResourceWorkspaceSceneProps = {
  indexView: ResourceIndexView;
  onIndexViewChange: (view: ResourceIndexView) => void;
  onTabChange: (tab: ResourceWorkspaceTab) => void;
  resourceId: string;
  tab: ResourceWorkspaceTab;
};

function formatIndexStateLabel(state: IndexState, t: TFunction) {
  if (state.key === "failed-stale") {
    return `${t("dataCatalog.indexState.rebuildFailed")} / ${t("dataCatalog.indexState.staleServing")}`;
  }

  let label = t(`dataCatalog.indexState.${state.key}`);

  if (
    (state.key === "building" || state.key === "rebuilding") &&
    state.latest &&
    state.latest.totalCount > 0
  ) {
    const percent = Math.min(
      100,
      Math.round((state.latest.vectorizedCount / state.latest.totalCount) * 100),
    );
    label = `${label} ${percent}%`;
  }

  return label;
}

export function ResourceWorkspaceScene({
  indexView,
  onIndexViewChange,
  onTabChange,
  resourceId,
  tab,
}: ResourceWorkspaceSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [resource, setResource] = useState<CatalogResource | null>(null);
  const [catalog, setCatalog] = useState<DataConnectRecord | null>(null);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        getDataConnectRecord(detail.catalogId),
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

  const previewDisabledMessage = catalog
    ? t("dataCatalog.gate.catalogDisabled", { name: catalog.name })
    : t("dataCatalog.gate.catalogDisabledShort");

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
            <AppButton
              onClick={() => {
                void navigate("/data-directory");
              }}
            >
              {t("dataCatalog.backToCatalog")}
            </AppButton>
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
              <span className={styles.contextDivider}>·</span>
              <span className={styles.contextMeta}>
                {t("dataCatalog.resource.headerIndexState")}{" "}
                {formatIndexStateLabel(indexState, t)}
              </span>
            </div>
          </div>
          <div className={styles.pageHeaderActions}>
            <AppButton
              onClick={() => {
                void navigate(backTarget);
              }}
            >
              {t("dataCatalog.backToCatalog")}
            </AppButton>
          </div>
        </div>

        <Tabs
          activeKey={tab}
          className={styles.pageTabs}
          items={[
            {
              key: "detail",
              label: t("dataCatalog.resourceWorkspace.tabDetail"),
              children: (
                <div className={styles.tabPanel}>
                  <ResourceDetailPanel catalog={catalog} resource={resource} />
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
                    onIndexViewChange={onIndexViewChange}
                    onRefresh={loadAll}
                    resource={resource}
                    tasks={sortedTasks}
                  />
                </div>
              ),
            },
          ]}
          onChange={(key) => {
            onTabChange(key as ResourceWorkspaceTab);
          }}
        />
      </section>
    </>
  );
}
