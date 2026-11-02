/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ApartmentOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  ForkOutlined,
  LineChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  ReadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert } from "antd";
import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { Edition } from "@/framework/entitlement/edition";
import type { CapabilityState } from "@/framework/entitlement/types";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import type {
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { SkillsSparkIcon } from "@/modules/knowledge-network/components/shared/SkillsSparkIcon";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";
import { WorkspaceExtensionNavItems } from "@/modules/knowledge-network/scenes/workspace/WorkspaceExtensionNavItems";
import { visibleWorkspaceExtensionEntries } from "@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries";
import { WorkspaceOverviewSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection";
import { WorkspaceResourceSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceResourceSection";
import { updateKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "./KnowledgeNetworkWorkspaceScene.module.css";

// The query page brings its editor and chart; load them only when it is opened.
const CypherQueryScene = lazy(async () => ({
  default: (await import("@/modules/knowledge-network/components/cypher/CypherQueryScene"))
    .CypherQueryScene,
}));

type WorkspaceNavItem = {
  count?: number;
  icon: React.ReactNode;
  key: KnowledgeNetworkWorkspaceSection;
  label: string;
  paidCapability?: string;
  paidCapabilityState?: CapabilityState;
  paidEdition?: Edition;
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
  section,
}: KnowledgeNetworkWorkspaceSceneProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { hiddenNavigation } = useRuntimeConfig();
  const params = useParams<{ networkId: string }>();
  const activeNetworkId = networkId ?? params.networkId ?? "";
  const objectMetricsCapability = useCapability(CAPABILITIES.OBJECT_METRICS);
  const kbMode = useBknProjectKbMode();
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

  const [networkFormOpen, setNetworkFormOpen] = useState(false);
  const [upgradeItem, setUpgradeItem] = useState<WorkspaceNavItem | null>(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const childMetricDetailHandlesLoadState =
    section === "metrics" && /\/metrics\/[^/]+\/detail\/?$/.test(location.pathname);
  const canModify = hasKnowledgeNetworkRecordOperation(detail, "modify");
  const canDelete = hasKnowledgeNetworkRecordOperation(detail, "delete");
  const experienceNetwork = useMemo(
    () => (detail ? { id: detail.id, name: detail.name, slug: detail.identifier } : null),
    [detail],
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
        key: "experience-cypher",
        label: t("knowledgeNetwork.workspaceExperienceCypher"),
        icon: <NodeIndexOutlined />,
        path: `/knowledge-network/workspace/${activeNetworkId}/experience/cypher`,
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
      {
        key: "metrics",
        label: t("knowledgeNetwork.workspaceMetrics"),
        icon: <LineChartOutlined />,
        count: detail?.statistics.metricsTotal ?? 0,
        paidCapability: CAPABILITIES.OBJECT_METRICS,
        paidCapabilityState: objectMetricsCapability,
        paidEdition: "professional",
      },
      {
        key: "functions",
        label: t("knowledgeNetwork.workspaceFunctions"),
        icon: <CodeOutlined />,
        count: detail?.statistics.functionsTotal ?? 0,
      },
      {
        key: "apis",
        // Not ApiOutlined: relation types already own that icon in the group above.
        label: t("knowledgeNetwork.workspaceApis"),
        icon: <CloudServerOutlined />,
        count: detail?.statistics.apisTotal ?? 0,
      },
      {
        key: "mcp",
        label: t("knowledgeNetwork.workspaceMcpTools"),
        icon: <ForkOutlined />,
        // Backend counts these on its own: mcp_tool is a capability type of its own, so no split.
        count: detail?.statistics.mcpToolsTotal ?? 0,
      },
      {
        key: "skills",
        label: t("knowledgeNetwork.workspaceSkills"),
        icon: <SkillsSparkIcon />,
        count: detail?.statistics.skillsTotal ?? 0,
      },
      // Professional edition. Not in the community image at all; without the license the section
      // opens under the edition mask. No count: the network's statistics do not report one.
      ...(kbMode === "hidden"
        ? []
        : [
            {
              key: "knowledge-bases" as const,
              label: t("knowledgeNetwork.workspaceKnowledgeBases"),
              icon: <ReadOutlined />,
              paidEdition: "professional" as const,
            },
          ]),
    ];

    // Entries for services this deployment does not run (RuntimeConfig.hiddenNavigation).
    return hiddenNavigation.length > 0
      ? items.filter((item) => !hiddenNavigation.includes(item.key))
      : items;
  }, [activeNetworkId, detail, hiddenNavigation, kbMode, objectMetricsCapability, t]);

  const primaryNavItems = navigationItems.filter((item) => item.key === "overview");
  const experienceNavItems = navigationItems.filter(
    (item) => item.key === "experience-agent" || item.key === "experience-cypher",
  );
  const resourceNavItems = navigationItems.filter(
    (item) =>
      item.key === "concept-groups" ||
      item.key === "object-types" ||
      item.key === "relation-types" ||
      item.key === "action-types",
  );
  // Metrics, functions and SKILLs are one group: they are what the network can compute and call,
  // as opposed to the concept model that describes what it knows.
  const dynamicNavItems = navigationItems.filter(
    (item) =>
      item.key === "metrics" ||
      item.key === "functions" ||
      item.key === "apis" ||
      item.key === "mcp" ||
      item.key === "skills" ||
      item.key === "knowledge-bases",
  );

  const extensionEntries = visibleWorkspaceExtensionEntries(hiddenNavigation);
  // A group whose entries are all hidden loses its divider and title too.
  const hasAbilityVerification =
    experienceNavItems.length > 0 ||
    extensionEntries.items.length > 0 ||
    extensionEntries.upgrades.length > 0;

  const renderSideNavItem = (item: WorkspaceNavItem, options?: { showCount?: boolean }) => {
    const isActive =
      item.key === section || (item.path !== undefined && location.pathname === item.path);
    const capabilityUnavailable =
      item.paidCapability !== undefined && item.paidCapabilityState !== "available";
    const opensUpgradeDialog =
      capabilityUnavailable &&
      (item.paidCapabilityState === "not-installed" || item.paidCapabilityState === "not-licensed");
    const showCount = (options?.showCount ?? item.count !== undefined) && !capabilityUnavailable;

    return (
      <button
        className={isActive ? styles.sideItemActive : styles.sideItem}
        key={item.key}
        onClick={() => {
          if (opensUpgradeDialog) {
            setUpgradeItem(item);
            return;
          }

          void navigate(item.path ?? `/knowledge-network/workspace/${activeNetworkId}/${item.key}`);
        }}
        title={item.label}
        type="button"
      >
        <span className={styles.sideItemMeta}>
          {item.icon}
          {sideCollapsed ? null : <span>{item.label}</span>}
        </span>
        {!sideCollapsed && (item.paidEdition || showCount) ? (
          <span className={styles.sideItemStatus}>
            {item.paidEdition ? (
              <EditionBadge capability={item.paidCapability} edition={item.paidEdition} />
            ) : null}
            {showCount ? (
              <span className={styles.sideItemCount}>{formatNavCount(item.count)}</span>
            ) : null}
          </span>
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

    if (section === "experience-agent" || section === "experience-mcp") {
      const initialMode = section === "experience-mcp" ? "mcp" : "agent";

      return (
        <ExperienceScene embedded initialMode={initialMode} lockMode network={experienceNetwork} />
      );
    }

    if (section === "experience-cypher") {
      return detail ? (
        <Suspense fallback={null}>
          <CypherQueryScene
            key={detail.identifier || detail.id}
            knId={detail.identifier || detail.id}
            networkId={activeNetworkId}
          />
        </Suspense>
      ) : null;
    }

    return (
      <WorkspaceResourceSection
        canDelete={canDelete}
        canModify={canModify}
        data={workspaceData}
        networkId={activeNetworkId}
        networkName={detail?.name ?? activeNetworkId}
        section={section}
      />
    );
  };
  return (
    <section className={styles.workspace}>
      <div className={styles.workspaceLayout}>
        <aside
          className={`${styles.workspaceSide} ${sideCollapsed ? styles.workspaceSideCollapsed : ""}`}
        >
          <div className={styles.workspaceSideScroll}>
            {primaryNavItems.map((item) => renderSideNavItem(item, { showCount: false }))}
            {hasAbilityVerification ? (
              <>
                <div className={styles.sideDivider} />
                {sideCollapsed ? null : (
                  <div className={styles.sideTitle}>
                    {t("knowledgeNetwork.workspaceAbilityVerification")}
                  </div>
                )}
                {experienceNavItems.map((item) => renderSideNavItem(item, { showCount: false }))}
                <WorkspaceExtensionNavItems
                  collapsed={sideCollapsed}
                  hiddenKeys={hiddenNavigation}
                  networkId={activeNetworkId}
                />
              </>
            ) : null}
            {resourceNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {sideCollapsed ? null : (
                  <div className={styles.sideTitle}>
                    {t("knowledgeNetwork.workspaceConceptModel")}
                  </div>
                )}
                {resourceNavItems.map((item) => renderSideNavItem(item))}
              </>
            ) : null}
            {dynamicNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {sideCollapsed ? null : (
                  <div className={styles.sideTitle}>
                    {t("knowledgeNetwork.workspaceDynamicModel")}
                  </div>
                )}
                {dynamicNavItems.map((item) => renderSideNavItem(item))}
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
          {detailError && !childMetricDetailHandlesLoadState ? (
            <Alert className={styles.workspaceAlert} message={detailError} showIcon type="error" />
          ) : null}
          {sectionError && !childMetricDetailHandlesLoadState ? (
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
            <div
              className={
                section === "experience-agent" ||
                section === "experience-cypher" ||
                section === "metrics" ||
                section === "object-types" ||
                section === "relation-types" ||
                section === "action-types"
                  ? `${styles.workspaceSectionPage} ${styles.workspaceSectionFlush}`
                  : styles.workspaceSectionPage
              }
            >
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
      {upgradeItem?.paidCapability && upgradeItem.paidEdition ? (
        <CapabilityUpgradeDialog
          capability={upgradeItem.paidCapability}
          minEdition={upgradeItem.paidEdition}
          onClose={() => setUpgradeItem(null)}
          open
        />
      ) : null}
    </section>
  );
}
