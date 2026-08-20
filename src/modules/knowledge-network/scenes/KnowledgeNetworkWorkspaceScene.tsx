/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ApartmentOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  ForkOutlined,
  LeftOutlined,
  LineChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import type {
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";
import { WorkspaceOverviewSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection";
import { WorkspaceResourceSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceResourceSection";
import { updateKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  integrateWorkspaceMetrics,
} from "@/modules/knowledge-network/services/shared/runtime";
import type { KnowledgeNetworkMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "./KnowledgeNetworkWorkspaceScene.module.css";

type WorkspaceNavItem = {
  count?: number;
  icon: React.ReactNode;
  key: KnowledgeNetworkWorkspaceSection;
  label: string;
  path?: string;
};

function formatNavCount(count?: number) {
  if (count === undefined) {
    return "0";
  }

  return count > 9999 ? "9999+" : String(count);
}

export function KnowledgeNetworkWorkspaceScene({
  networkId,
  onBack,
  section,
}: KnowledgeNetworkWorkspaceSceneProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const params = useParams<{ networkId: string }>();
  const activeNetworkId = networkId ?? params.networkId ?? "";
  const workspaceData = useWorkspaceData(activeNetworkId, section);
  const {
    detail,
    detailError,
    detailLoading,
    loadRecentObjects,
    loadWorkspaceData,
    recentLoading,
    recentObjects,
    sectionError,
  } = workspaceData;

  useEffect(() => {
    if (!integrateWorkspaceMetrics && section === "metrics") {
      void navigate(`/knowledge-network/workspace/${activeNetworkId}/overview`, {
        replace: true,
      });
    }
  }, [activeNetworkId, navigate, section]);

  const [networkFormOpen, setNetworkFormOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const canModify = hasKnowledgeNetworkRecordOperation(detail, "modify");
  const canDelete = hasKnowledgeNetworkRecordOperation(detail, "delete");
  const canManageActionExecution = hasKnowledgeNetworkRecordOperation(
    detail,
    "task_manage",
  );

  const navigationItems: WorkspaceNavItem[] = useMemo(() => {
    const items: WorkspaceNavItem[] = [
      {
        key: "overview",
        label: t("knowledgeNetwork.workspaceOverviewShort"),
        icon: <FileTextOutlined />,
      },
      {
        key: "experience-agent",
        label: t("knowledgeNetwork.workspaceExperienceAgent"),
        icon: <MessageOutlined />,
        path: `/knowledge-network/workspace/${activeNetworkId}/experience/agent`,
      },
      {
        key: "experience-mcp",
        label: t("knowledgeNetwork.workspaceExperienceMcp"),
        icon: <ForkOutlined />,
        path: `/knowledge-network/workspace/${activeNetworkId}/experience/mcp`,
      },
      {
        key: "concept-groups",
        label: t("knowledgeNetwork.workspaceConceptGroups"),
        icon: <ApartmentOutlined />,
        count: detail?.statistics.conceptGroupsTotal ?? 0,
      },
      {
        key: "object-types",
        label: t("knowledgeNetwork.workspaceObjectTypes"),
        icon: <DatabaseOutlined />,
        count: detail?.statistics.objectTypesTotal ?? 0,
      },
      {
        key: "relation-types",
        label: t("knowledgeNetwork.workspaceRelationTypes"),
        icon: <ApiOutlined />,
        count: detail?.statistics.relationTypesTotal ?? 0,
      },
      {
        key: "action-types",
        label: t("knowledgeNetwork.workspaceActionTypes"),
        icon: <ThunderboltOutlined />,
        count: detail?.statistics.actionTypesTotal ?? 0,
      },
    ];

    if (integrateWorkspaceMetrics) {
      items.push({
        key: "metrics",
        label: t("knowledgeNetwork.workspaceMetrics"),
        icon: <LineChartOutlined />,
        count: detail?.statistics.metricsTotal ?? 0,
      });
    }

    return items;
  }, [activeNetworkId, detail, t]);

  const primaryNavItems = navigationItems.filter(
    (item) => item.key === "overview",
  );
  const experienceNavItems = navigationItems.filter(
    (item) =>
      item.key === "experience-agent" ||
      item.key === "experience-mcp",
  );
  const resourceNavItems = navigationItems.filter(
    (item) =>
      item.key === "concept-groups" ||
      item.key === "object-types" ||
      item.key === "relation-types" ||
      item.key === "action-types",
  );
  const metricNavItems = navigationItems.filter((item) => item.key === "metrics");

  const renderSideNavItem = (
    item: WorkspaceNavItem,
    options?: { showCount?: boolean },
  ) => {
    const isActive =
      item.key === section || (item.path !== undefined && location.pathname === item.path);
    const showCount = options?.showCount ?? item.count !== undefined;

    return (
      <button
        className={isActive ? styles.sideItemActive : styles.sideItem}
        key={item.key}
        onClick={() => {
          void navigate(item.path ?? `/knowledge-network/workspace/${activeNetworkId}/${item.key}`);
        }}
        title={item.label}
        type="button"
      >
        <span className={styles.sideItemMeta}>
          {item.icon}
          {sideCollapsed ? null : <span>{item.label}</span>}
        </span>
        {showCount && !sideCollapsed ? (
          <span className={styles.sideItemCount}>{formatNavCount(item.count)}</span>
        ) : null}
      </button>
    );
  };

  const renderSectionContent = () => {
    if (section === "overview") {
      return (
        <WorkspaceOverviewSection
          detail={detail}
          detailLoading={detailLoading}
          loadRecentObjects={loadRecentObjects}
          networkId={activeNetworkId}
          canModify={canModify}
          onEdit={() => setNetworkFormOpen(true)}
          recentLoading={recentLoading}
          recentObjects={recentObjects}
        />
      );
    }

    if (
      section === "experience-agent" ||
      section === "experience-mcp"
    ) {
      const initialMode = section === "experience-mcp" ? "mcp" : "agent";

      return <ExperienceScene embedded initialMode={initialMode} lockMode />;
    }

    return (
      <WorkspaceResourceSection
        canDelete={canDelete}
        canManageActionExecution={canManageActionExecution}
        canModify={canModify}
        data={workspaceData}
        networkId={activeNetworkId}
        section={section}
      />
    );
  };
  return (
    <section className={styles.workspace}>
      <div className={styles.workspaceHeader}>
        <button
          aria-label={t("common.back")}
          className={styles.workspaceBackButton}
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            void navigate("/knowledge-network");
          }}
          type="button"
        >
          <LeftOutlined />
        </button>
        <div className={styles.workspaceIdentity}>
          <span
            className={styles.workspaceNameIcon}
            style={{ color: detail?.color ?? "#1677ff" }}
          >
            <DeploymentUnitOutlined />
          </span>
          <h4 className={styles.workspaceNameTitle}>
            {detail?.name ?? t("knowledgeNetwork.workspaceTitle")}
          </h4>
        </div>
      </div>

      <div className={styles.workspaceLayout}>
        <aside className={`${styles.workspaceSide} ${sideCollapsed ? styles.workspaceSideCollapsed : ""}`}>
          <div className={styles.workspaceSideScroll}>
            {primaryNavItems.map((item) => renderSideNavItem(item, { showCount: false }))}
            <div className={styles.sideDivider} />
            {sideCollapsed ? null : (
              <div className={styles.sideTitle}>{t("knowledgeNetwork.workspaceAbilityVerification")}</div>
            )}
            {experienceNavItems.map((item) => renderSideNavItem(item, { showCount: false }))}
            <div className={styles.sideDivider} />
            {sideCollapsed ? null : (
              <div className={styles.sideTitle}>{t("knowledgeNetwork.workspaceOntologyModeling")}</div>
            )}
            {resourceNavItems.map((item) => renderSideNavItem(item))}
            {metricNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {sideCollapsed ? null : (
                  <div className={styles.sideTitle}>{t("knowledgeNetwork.workspaceMetricModeling")}</div>
                )}
                {metricNavItems.map((item) => renderSideNavItem(item))}
              </>
            ) : null}
          </div>
          <div className={styles.workspaceSideFooter}>
            <button
              aria-label={sideCollapsed ? t("shell.expandSidenav") : t("shell.collapseSidenav")}
              className={styles.sideCollapseButton}
              onClick={() => setSideCollapsed((current) => !current)}
              title={sideCollapsed ? t("shell.expandSidenav") : t("shell.collapseSidenav")}
              type="button"
            >
              {sideCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </div>
        </aside>
        <main
          className={
            section === "overview"
              ? `${styles.workspaceContent} ${styles.workspaceContentOverview}`
              : styles.workspaceContent
          }
        >
          {detailError ? (
            <Alert className={styles.workspaceAlert} message={detailError} showIcon type="error" />
          ) : null}
          {sectionError ? (
            <Alert
              className={styles.workspaceAlert}
              message={sectionError}
              showIcon
              type="warning"
            />
          ) : null}
          {section === "overview" ? (
            renderSectionContent()
          ) : (
            <div className={styles.workspaceSectionPage}>
              {renderSectionContent()}
            </div>
          )}
        </main>
      </div>
      <KnowledgeNetworkFormModal
        mode="edit"
        onCancel={() => setNetworkFormOpen(false)}
        onSubmit={async (values: KnowledgeNetworkMutationPayload) => {
          await updateKnowledgeNetwork(activeNetworkId, values);
          setNetworkFormOpen(false);
          void message.success(t("common.success"));
          await loadWorkspaceData();
        }}
        open={networkFormOpen}
        record={detail}
      />
    </section>
  );
}
