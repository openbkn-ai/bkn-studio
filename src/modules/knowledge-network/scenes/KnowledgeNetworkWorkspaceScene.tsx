import {
  ApiOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FileTextOutlined,
  LeftOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import type {
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";
import { WorkspaceOverviewSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection";
import { WorkspacePreviewSection } from "@/modules/knowledge-network/scenes/workspace/WorkspacePreviewSection";
import { WorkspaceResourceSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceResourceSection";
import { updateKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  integrateWorkspaceMetrics,
  integrateWorkspaceTasks,
} from "@/modules/knowledge-network/services/shared/runtime";
import type { KnowledgeNetworkMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkWorkspaceScene.module.css";

type WorkspaceNavItem = {
  count?: number;
  icon: React.ReactNode;
  key: KnowledgeNetworkWorkspaceSection;
  label: string;
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
  const navigate = useNavigate();
  const { message } = useAppServices();
  const params = useParams<{ networkId: string }>();
  const activeNetworkId = networkId ?? params.networkId ?? "";
  const workspaceData = useWorkspaceData(activeNetworkId);
  const { detail, loadError, loading, loadWorkspaceData, metrics, previewGraph, recentObjects } =
    workspaceData;

  useEffect(() => {
    if (
      (!integrateWorkspaceMetrics && section === "metrics") ||
      (!integrateWorkspaceTasks && section === "tasks")
    ) {
      void navigate(`/knowledge-network/workspace/${activeNetworkId}/overview`, {
        replace: true,
      });
    }
  }, [activeNetworkId, navigate, section]);

  const [networkFormOpen, setNetworkFormOpen] = useState(false);

  const navigationItems: WorkspaceNavItem[] = useMemo(() => {
    const items: WorkspaceNavItem[] = [
      {
        key: "overview",
        label: t("knowledgeNetwork.workspaceOverviewShort"),
        icon: <FileTextOutlined />,
      },
      {
        key: "preview",
        label: t("knowledgeNetwork.workspacePreviewModeling"),
        icon: <ClusterOutlined />,
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
      {
        key: "concept-groups",
        label: t("knowledgeNetwork.workspaceConceptGroups"),
        icon: <ApartmentOutlined />,
        count: detail?.statistics.conceptGroupsTotal ?? 0,
      },
    ];

    if (integrateWorkspaceMetrics) {
      items.splice(5, 0, {
        key: "metrics",
        label: t("knowledgeNetwork.workspaceMetrics"),
        icon: <LineChartOutlined />,
        count: detail?.statistics.metricsTotal ?? metrics.length,
      });
    }

    if (integrateWorkspaceTasks) {
      items.push({
        key: "tasks",
        label: t("knowledgeNetwork.workspaceTaskManagement"),
        icon: <ClockCircleOutlined />,
      });
    }

    return items;
  }, [detail, metrics.length, t]);

  const resourceNavItems = navigationItems.filter(
    (item) =>
      item.key === "object-types" ||
      item.key === "relation-types" ||
      item.key === "action-types" ||
      (integrateWorkspaceMetrics && item.key === "metrics"),
  );
  const conceptGroupNavItem = navigationItems.find(
    (item) => item.key === "concept-groups",
  );
  const taskNavItem = navigationItems.find((item) => item.key === "tasks");

  const renderSideNavItem = (
    item: WorkspaceNavItem,
    options?: { showCount?: boolean },
  ) => {
    const isActive = item.key === section;
    const showCount = options?.showCount ?? item.count !== undefined;

    return (
      <button
        className={isActive ? styles.sideItemActive : styles.sideItem}
        key={item.key}
        onClick={() => {
          void navigate(`/knowledge-network/workspace/${activeNetworkId}/${item.key}`);
        }}
        type="button"
      >
        <span className={styles.sideItemMeta}>
          {item.icon}
          <span>{item.label}</span>
        </span>
        {showCount ? (
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
          networkId={activeNetworkId}
          onEdit={() => setNetworkFormOpen(true)}
          recentObjects={recentObjects}
        />
      );
    }

    if (section === "preview") {
      return <WorkspacePreviewSection previewGraph={previewGraph} />;
    }

    return (
      <WorkspaceResourceSection
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
            style={{ backgroundColor: detail?.color ?? "#1677ff" }}
          >
            {renderResourceIcon(detail?.icon)}
          </span>
          <h4 className={styles.workspaceNameTitle}>
            {detail?.name ?? t("knowledgeNetwork.workspaceTitle")}
          </h4>
        </div>
      </div>

      <div className={styles.workspaceLayout}>
        <aside className={styles.workspaceSide}>
          <button
            className={section === "overview" ? styles.sideItemActive : styles.sideItem}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${activeNetworkId}/overview`,
              );
            }}
            type="button"
          >
            <span className={styles.sideItemMeta}>
              <AppstoreOutlined />
              <span>{t("knowledgeNetwork.workspaceOverviewShort")}</span>
            </span>
          </button>
          <button
            className={section === "preview" ? styles.sideItemActive : styles.sideItem}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${activeNetworkId}/preview`,
              );
            }}
            type="button"
          >
            <span className={styles.sideItemMeta}>
              <EyeOutlined />
              <span>{t("knowledgeNetwork.workspacePreviewModeling")}</span>
            </span>
          </button>
          <div className={styles.sideDivider} />
          <div className={styles.sideTitle}>{t("knowledgeNetwork.workspaceResources")}</div>
          {resourceNavItems.map((item) => renderSideNavItem(item))}
          <div className={styles.sideDivider} />
          {conceptGroupNavItem ? renderSideNavItem(conceptGroupNavItem) : null}
          {taskNavItem ? renderSideNavItem(taskNavItem, { showCount: false }) : null}
        </aside>
        <main
          className={
            section === "overview"
              ? `${styles.workspaceContent} ${styles.workspaceContentOverview}`
              : styles.workspaceContent
          }
        >
          {loadError ? (
            <Alert message={loadError} showIcon type="error" />
          ) : loading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : section === "overview" ? (
            renderSectionContent()
          ) : (
            <div className={styles.workspaceSectionPage}>{renderSectionContent()}</div>
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
