/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Space, Tabs } from "antd";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { extractRequestErrorDetails, isRequestConflict } from "@/framework/request/error-message";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import type { CatalogRecord } from "@/shared/catalog";
import type { ApiResourceTab } from "../contracts/api-resource";
import {
  apiResourcePagingRule,
  apiResourceSupportsTotal,
  apiResourceView,
} from "../lib/api-resource";
import { getApiResource, queryApiResource } from "../services/api-resource.service";
import type { ApiResource } from "../types/api-resource";
import type { ResourcePreviewQuery } from "../types/data-catalog";
import { hasCatalogResourceOperation } from "../utils/resource-operations";
import { ResourceDetailPanel } from "./ResourceDetailPanel";
import { ApiResourceDefinitionTables } from "./ApiResourceDefinitionTables";
import { ResourcePreviewPanel, type ResourcePreviewData } from "./ResourcePreviewPanel";
import workspaceStyles from "../scenes/ResourceWorkspaceScene.module.css";
import styles from "./ApiResourceWorkspaceView.module.css";

type Props = {
  resource: ApiResource;
  catalog: CatalogRecord | null;
  canEdit: boolean;
  canQuery: boolean;
  actions: ReactNode;
  feedback: ReactNode;
  tab?: ApiResourceTab;
  onTabChange?: (tab: ApiResourceTab) => void;
  onBack?: () => void;
  onEdit: () => void;
  onConflict: () => void;
};

export function ApiResourceWorkspaceView({
  resource,
  catalog,
  canEdit,
  canQuery,
  actions,
  feedback,
  tab: requestedTab,
  onTabChange,
  onBack,
  onEdit,
  onConflict,
}: Props) {
  const { t } = useTranslation();
  const [localTab, setLocalTab] = useState<ApiResourceTab>("detail");
  const tab = requestedTab ?? localTab;
  const view = useMemo(() => apiResourceView(resource), [resource]);
  const rule = apiResourcePagingRule(resource.api_definition);
  const hasPaging = rule !== undefined;
  const supportsTotal = apiResourceSupportsTotal(resource.api_definition);
  const defaultLimit = typeof rule?.default_limit === "number" ? rule.default_limit : 10;
  const maxLimit = typeof rule?.max_limit === "number" ? rule.max_limit : 100;
  const pageSizes = [...new Set([defaultLimit, 10, 20, 50, 100])]
    .filter((value) => value > 0 && value <= maxLimit)
    .sort((a, b) => a - b)
    .map(String);
  const loadPreview = useCallback(
    async (
      id: string,
      query: ResourcePreviewQuery,
      signal: AbortSignal,
    ): Promise<ResourcePreviewData> => {
      const checkVersion = async () => {
        const latest = await getApiResource(id, signal);
        signal.throwIfAborted();
        if (String(latest.update_time) !== String(resource.update_time)) {
          onConflict();
          throw new Error(t("dataCatalog.apiResource.conflict"));
        }
        return latest;
      };
      const latest = await checkVersion();
      if (
        !latest.enabled ||
        latest.status !== "active" ||
        !hasCatalogResourceOperation(latest, "query_data")
      ) {
        throw new Error(t("dataCatalog.apiResource.errors.queryUnavailable"));
      }
      const data = await queryApiResource(
        id,
        {
          ...(query.filterCondition ? { filter_condition: query.filterCondition } : {}),
          ...(hasPaging
            ? { paging: { mode: "single" as const, offset: query.offset, limit: query.limit } }
            : {}),
          ...(supportsTotal ? { need_total: true } : {}),
        },
        signal,
      ).catch((error: unknown) => {
        if (
          !signal.aborted &&
          isRequestConflict(error) &&
          extractRequestErrorDetails(error).code === "VegaBackend.Resource.UpdateConflict"
        ) {
          onConflict();
        }
        throw error;
      });
      await checkVersion();
      return {
        rows: data.entries,
        querySource: "source",
        ...(data.total_count !== undefined ? { total: data.total_count } : {}),
        ...(data.warnings?.length ? { warnings: data.warnings } : {}),
      };
    },
    [resource, onConflict, t, hasPaging, supportsTotal],
  );
  return (
    <section className={workspaceStyles.contentSurface}>
      <div className={workspaceStyles.pageHeader}>
        {onBack ? <SceneBackButton onClick={onBack} /> : null}
        <div className={workspaceStyles.pageHeaderMain}>
          <div className={workspaceStyles.contextBar}>
            <span className={workspaceStyles.contextLabel}>
              {t("dataCatalog.resourceWorkspace.currentResource")}
            </span>
            <strong className={workspaceStyles.contextName}>{resource.name}</strong>
            {catalog ? (
              <>
                <span className={workspaceStyles.contextDivider}>·</span>
                <span className={workspaceStyles.contextMeta}>
                  {t("dataCatalog.resource.headerCatalog")}{" "}
                  <Link
                    className={workspaceStyles.textLink}
                    to={`/data-catalog/catalog/${encodeURIComponent(catalog.id)}`}
                  >
                    {catalog.name}
                  </Link>
                </span>
              </>
            ) : null}
          </div>
        </div>
        <Space className={workspaceStyles.pageHeaderActions} wrap>
          {actions}
        </Space>
      </div>
      {feedback}
      <Tabs
        activeKey={tab}
        onChange={(key) => {
          const nextTab = key === "preview" ? "preview" : "detail";
          setLocalTab(nextTab);
          onTabChange?.(nextTab);
        }}
        className={`${workspaceStyles.pageTabs} ${styles.tabs}`}
        items={[
          {
            key: "detail",
            label: t("dataCatalog.resourceWorkspace.tabDetail"),
            children: (
              <div className={workspaceStyles.tabPanel}>
                <ResourceDetailPanel
                  active={tab === "detail"}
                  resource={view}
                  catalog={catalog}
                  canEdit={canEdit}
                  onEdit={onEdit}
                  sourceMetadataContent={
                    <ApiDefinitionDetails definition={resource.api_definition} />
                  }
                />
              </div>
            ),
          },
          {
            key: "preview",
            label: t("dataCatalog.resourceWorkspace.tabPreview"),
            children: (
              <div className={`${workspaceStyles.tabPanel} ${workspaceStyles.tabPanelPreview}`}>
                {import.meta.env.VITE_USE_MOCK !== "false" ? (
                  <Alert
                    className={styles.previewHint}
                    type="info"
                    showIcon
                    message={t("dataCatalog.apiResource.mockTestHint")}
                  />
                ) : null}
                <ResourcePreviewPanel
                  key={`${resource.id}:${resource.update_time}`}
                  active={tab === "preview"}
                  resource={view}
                  disabled={!canQuery}
                  disabledMessage={t("dataCatalog.apiResource.errors.queryUnavailable")}
                  loadPreview={loadPreview}
                  initialPageSize={defaultLimit}
                  pageSizeOptions={hasPaging ? pageSizes : undefined}
                  apiPagingEnabled={hasPaging}
                />
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

function ApiDefinitionDetails({ definition }: { definition: Record<string, unknown> }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    variables: "variables",
    request: "request",
    response: "response",
    success_rule: "success",
    paging_rule: "paging",
  };
  const names = [
    ...Object.keys(labels),
    ...Object.keys(definition).filter((name) => !Object.hasOwn(labels, name)),
  ];
  return (
    <Tabs
      className={`${styles.definition} ${styles.tabs}`}
      defaultActiveKey="request"
      size="small"
      items={names.map((name) => ({
        key: name,
        label: Object.hasOwn(labels, name) ? t(`dataCatalog.apiResource.${labels[name]}`) : name,
        forceRender: true,
        children:
          Object.hasOwn(definition, name) && definition[name] !== undefined ? (
            <div className={styles.definitionContent}>
              <ApiResourceDefinitionTables name={name} value={definition[name]} />
            </div>
          ) : (
            <p className={styles.definitionEmpty}>{t("dataCatalog.apiResource.notConfigured")}</p>
          ),
      }))}
    />
  );
}
