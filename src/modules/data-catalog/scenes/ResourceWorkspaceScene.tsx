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

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ResourceDetailPanel } from "@/modules/data-catalog/components/ResourceDetailPanel";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { ResourceIndexPanel } from "@/modules/data-catalog/components/ResourceIndexPanel";
import { ResourcePreviewPanel } from "@/modules/data-catalog/components/ResourcePreviewPanel";
import { ResourceSemanticUnderstandingPanel } from "@/modules/data-catalog/components/ResourceSemanticUnderstandingPanel";
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
  const [resource, setResource] = useState<CatalogResource | null>(null);
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
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
              <span className={styles.contextDivider}>·</span>
              <span className={styles.contextMeta}>
                {t("dataCatalog.resource.headerIndexState")}{" "}
                {formatIndexStateLabel(indexState, t)}
              </span>
            </div>
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
                  <ResourceDetailPanel catalog={catalog} onUpdated={loadAll} resource={resource} />
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
            {
              key: "semantic-understanding",
              label: t("dataCatalog.resourceWorkspace.tabSemanticUnderstanding"),
              children: (
                <div className={styles.tabPanel}>
                  <ResourceSemanticUnderstandingPanel active={tab === "semantic-understanding"} resource={resource} />
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
