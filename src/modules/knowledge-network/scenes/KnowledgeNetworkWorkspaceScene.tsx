/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  BranchesOutlined,
  DownOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  ControlOutlined,
} from "@ant-design/icons";
import { Alert } from "antd";
import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import type { EditionUpgradeCopy } from "@/framework/entitlement/RequireEdition";
import { WORKSPACE_MOUNT_SECTIONS } from "@/modules/knowledge-network/constants/workspace-mount-sections";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { Edition } from "@/framework/entitlement/edition";
import type { CapabilityState } from "@/framework/entitlement/types";
import { capabilitySatisfied } from "@/framework/entitlement/upgrade-reason";
import { useCapability, useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { extensionWorkspaceNavItems, extensionWorkspacePage } from "@/framework/extension/registry";
import { capabilityReportedByEndpoint } from "@/modules/subscription";
import type {
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
import {
  KnUnversionedBar,
  KnVersionBar,
} from "@/modules/knowledge-network/components/versions/KnVersionBar";
import { KnVersionsPanel } from "@/modules/knowledge-network/components/versions/KnVersionsPanel";
import { useKnVersionView } from "@/modules/knowledge-network/hooks/useKnVersionView";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { KnowledgeResourceIcon } from "@/modules/knowledge-network/components/shared/KnowledgeResourceIcon";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";
import { WorkspaceDevelopSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceDevelopSection";
import { WorkspaceExtensionNavItems } from "@/modules/knowledge-network/scenes/workspace/WorkspaceExtensionNavItems";
import { visibleWorkspaceExtensionEntries } from "@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries";
import { WorkspaceOverviewSection } from "@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection";
import { updateKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "./KnowledgeNetworkWorkspaceScene.module.css";

// The query page brings its editor and chart; load them only when it is opened.
const CypherQueryPage = lazy(async () => ({
  default: (await import("@/modules/knowledge-network/components/cypher/CypherQueryPage"))
    .CypherQueryPage,
}));

// Keep chat and resource editors off the overview's initial dependency path.
const ExperienceScene = lazy(async () => ({
  default: (await import("@/modules/knowledge-network/scenes/ExperienceScene")).ExperienceScene,
}));
const WorkspaceResourceSection = lazy(async () => ({
  default: (await import("@/modules/knowledge-network/scenes/workspace/WorkspaceResourceSection"))
    .WorkspaceResourceSection,
}));
const WorkspacePermissionMatrixSection = lazy(async () => ({
  default: (
    await import("@/modules/knowledge-network/scenes/workspace/WorkspacePermissionMatrixSection")
  ).WorkspacePermissionMatrixSection,
}));

type WorkspaceNavItem = {
  count?: number;
  disabled?: boolean;
  icon: React.ReactNode;
  key: KnowledgeNetworkWorkspaceSection;
  label: string;
  paidCapability?: string;
  paidCapabilityState?: CapabilityState;
  paidEdition?: Edition;
  path?: string;
  upgradeCopy?: EditionUpgradeCopy;
};

type WorkspaceNavGroup = "verification" | "analysis" | "concept" | "dynamic" | "governance";

function formatNavCount(count?: number) {
  if (count === undefined) {
    return "0";
  }

  return count > 9999 ? "9999+" : String(count);
}

export function KnowledgeNetworkWorkspaceScene({
  extensionKey,
  children,
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
  const { snapshot } = useEntitlementContext();
  const actionControlLicensed = capabilitySatisfied(
    CAPABILITIES.ACTION_GOVERNANCE,
    snapshot,
    "enterprise",
    false,
  );
  const permissionMatrixLicensed = capabilitySatisfied(
    CAPABILITIES.PERMISSION_MATRIX,
    snapshot,
    "enterprise",
    false,
  );
  // Use the same capability catalog as the route and badge license rule;
  // network admission belongs to the Eval page, not sidebar discovery.
  const evalLicensed = capabilitySatisfied(
    CAPABILITIES.EVAL,
    snapshot,
    "professional",
    capabilityReportedByEndpoint(CAPABILITIES.EVAL),
  );
  const professionalCapabilityState: CapabilityState = !snapshot
    ? "unknown"
    : capabilitySatisfied(CAPABILITIES.KN_TOOL_MOUNTS, snapshot, "professional", false)
      ? "available"
      : "not-licensed";
  const evalCapabilityState: CapabilityState = !snapshot
    ? "unknown"
    : evalLicensed
      ? "available"
      : "not-licensed";
  const objectMetricsCapability = useCapability(CAPABILITIES.OBJECT_METRICS, "professional");
  const fineGrainedCapability = useCapability(CAPABILITIES.PERM_OBJECT_LEVEL);
  const [versionView, setVersionView] = useKnVersionView(activeNetworkId);
  // Bumped when a publish, switch or reset changed what every page of the workspace reads.
  const [reloadTick, setReloadTick] = useState(0);
  const reloadKey = `${versionView}:${reloadTick}`;
  const workspaceData = useWorkspaceData(activeNetworkId, section, reloadKey);
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
  const versioning = detail?.versioning;
  const mayModify = hasKnowledgeNetworkRecordOperation(detail, "modify");
  const mayDelete = hasKnowledgeNetworkRecordOperation(detail, "delete");
  // Only the draft of a versioned network can be edited; every other version is read-only.
  const editable = !versioning || versionView === "draft";
  const canModify = mayModify && editable;
  const canDelete = mayDelete && editable;
  const hasCapabilities =
    (detail?.statistics.functionsTotal ?? 0) +
      (detail?.statistics.apisTotal ?? 0) +
      (detail?.statistics.mcpToolsTotal ?? 0) +
      (detail?.statistics.skillsTotal ?? 0) >
    0;
  const experienceNetwork = useMemo(
    () => (detail ? { id: detail.id, name: detail.name, slug: detail.identifier } : null),
    [detail],
  );

  const navigationItems: WorkspaceNavItem[] = useMemo(() => {
    const actionControlNavItem = extensionWorkspaceNavItems("risk-control").find(
      (item) => item.id === "action-control",
    );
    const items: WorkspaceNavItem[] = [
      {
        key: "overview",
        label: t("knowledgeNetwork.workspaceOverviewShort"),
        icon: <FileTextOutlined />,
      },
      {
        key: "develop",
        label: t("knowledgeNetwork.appDevelopment.nav"),
        icon: <AppstoreOutlined />,
      },
      {
        key: "versions",
        label: t("knowledgeNetwork.versions.nav"),
        icon: <BranchesOutlined />,
        paidCapability: CAPABILITIES.KN_DRAFT_VERSIONS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
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
        key: "evals",
        label: t("knowledgeNetwork.evalNav"),
        icon: <ExperimentOutlined />,
        path: `/knowledge-network/workspace/${activeNetworkId}/evals`,
        paidCapability: CAPABILITIES.EVAL,
        paidCapabilityState: evalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "permissions",
        label: t("knowledgeNetwork.permissionMatrix.nav"),
        icon: <SafetyCertificateOutlined />,
        paidCapability: CAPABILITIES.PERMISSION_MATRIX,
        paidCapabilityState: !snapshot
          ? "unknown"
          : permissionMatrixLicensed
            ? "available"
            : "not-licensed",
        paidEdition: "enterprise",
      },
      {
        key: "action-control",
        label: t(actionControlNavItem?.labelKey ?? "knowledgeNetwork.riskActionControlNav"),
        icon: <ControlOutlined />,
        paidCapability: CAPABILITIES.ACTION_GOVERNANCE,
        paidCapabilityState: !snapshot
          ? "unknown"
          : actionControlLicensed
            ? "available"
            : "not-licensed",
        paidEdition: "enterprise",
        path: actionControlNavItem?.path(activeNetworkId),
        disabled: (!snapshot || actionControlLicensed) && !actionControlNavItem,
      },
      {
        key: "concept-groups",
        label: t("knowledgeNetwork.workspaceConceptGroups"),
        icon: <KnowledgeResourceIcon kind="conceptGroup" />,
        count: detail?.statistics.conceptGroupsTotal ?? 0,
      },
      {
        key: "object-types",
        label: t("knowledgeNetwork.workspaceObjectTypes"),
        icon: <KnowledgeResourceIcon kind="objectType" />,
        count: detail?.statistics.objectTypesTotal ?? 0,
      },
      {
        key: "relation-types",
        label: t("knowledgeNetwork.workspaceRelationTypes"),
        icon: <KnowledgeResourceIcon kind="relationType" />,
        count: detail?.statistics.relationTypesTotal ?? 0,
      },
      {
        key: "action-types",
        label: t("knowledgeNetwork.workspaceActionTypes"),
        icon: <KnowledgeResourceIcon kind="action" />,
        count: detail?.statistics.actionTypesTotal ?? 0,
        paidCapability: CAPABILITIES.KN_ACTION_MODELING,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "event-classes",
        label: t("knowledgeNetwork.eventClasses.nav"),
        icon: <KnowledgeResourceIcon kind="eventClass" />,
        count: detail?.statistics.eventClassesTotal,
        paidCapability: CAPABILITIES.KN_EVENTS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "metrics",
        label: t("knowledgeNetwork.workspaceMetrics"),
        icon: <KnowledgeResourceIcon kind="metric" />,
        count: detail?.statistics.metricsTotal ?? 0,
        paidCapability: CAPABILITIES.OBJECT_METRICS,
        paidCapabilityState: objectMetricsCapability,
        paidEdition: "professional",
      },
      {
        key: "functions",
        label: t(WORKSPACE_MOUNT_SECTIONS.functions.titleKey),
        upgradeCopy: WORKSPACE_MOUNT_SECTIONS.functions,
        icon: <KnowledgeResourceIcon kind="function" />,
        count: detail?.statistics.functionsTotal ?? 0,
        paidCapability: CAPABILITIES.KN_TOOL_MOUNTS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "apis",
        label: t(WORKSPACE_MOUNT_SECTIONS.apis.titleKey),
        upgradeCopy: WORKSPACE_MOUNT_SECTIONS.apis,
        icon: <KnowledgeResourceIcon kind="api" />,
        count: detail?.statistics.apisTotal ?? 0,
        paidCapability: CAPABILITIES.KN_TOOL_MOUNTS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "mcp",
        label: t(WORKSPACE_MOUNT_SECTIONS.mcp.titleKey),
        upgradeCopy: WORKSPACE_MOUNT_SECTIONS.mcp,
        icon: <KnowledgeResourceIcon kind="mcp" />,
        count: detail?.statistics.mcpToolsTotal ?? 0,
        paidCapability: CAPABILITIES.KN_TOOL_MOUNTS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
      {
        key: "skills",
        label: t(WORKSPACE_MOUNT_SECTIONS.skills.titleKey),
        upgradeCopy: WORKSPACE_MOUNT_SECTIONS.skills,
        icon: <KnowledgeResourceIcon kind="skill" />,
        count: detail?.statistics.skillsTotal ?? 0,
        paidCapability: CAPABILITIES.KN_TOOL_MOUNTS,
        paidCapabilityState: professionalCapabilityState,
        paidEdition: "professional",
      },
    ];

    // Entries for services this deployment does not run (RuntimeConfig.hiddenNavigation).
    return items.filter((item) => !hiddenNavigation.includes(item.key));
  }, [
    activeNetworkId,
    actionControlLicensed,
    detail,
    evalCapabilityState,
    hiddenNavigation,
    objectMetricsCapability,
    permissionMatrixLicensed,
    professionalCapabilityState,
    snapshot,
    t,
  ]);

  const primaryNavItems = navigationItems.filter(
    (item) => item.key === "overview" || item.key === "versions",
  );
  const developmentNavItems = navigationItems.filter((item) => item.key === "develop");
  const evaluationNavItems = navigationItems.filter((item) => item.key === "evals");
  const experienceNavItems = navigationItems.filter(
    (item) => item.key === "experience-agent" || item.key === "experience-cypher",
  );
  const resourceNavItems = navigationItems.filter(
    (item) =>
      item.key === "concept-groups" || item.key === "object-types" || item.key === "relation-types",
  );
  // Tools may be mounted for direct network use or referenced by an action type. These are
  // separate relationships; an action reference does not require a manual mount.
  const dynamicNavItems = navigationItems.filter(
    (item) =>
      item.key === "action-types" ||
      item.key === "event-classes" ||
      item.key === "metrics" ||
      item.key === "functions" ||
      item.key === "apis" ||
      item.key === "mcp" ||
      item.key === "skills",
  );
  const governanceNavItems = (["permissions", "action-control"] as const).flatMap((key) =>
    navigationItems.filter((item) => item.key === key),
  );

  const extensionEntries = visibleWorkspaceExtensionEntries(hiddenNavigation);
  const activeExtensionKey = section === "extension" ? extensionKey : undefined;
  const analysisEntries = visibleWorkspaceExtensionEntries(hiddenNavigation, "analysis");
  // A group whose entries are all hidden loses its divider and title too.
  const hasAbilityVerification =
    experienceNavItems.length > 0 ||
    developmentNavItems.length > 0 ||
    evaluationNavItems.length > 0 ||
    extensionEntries.items.length > 0 ||
    extensionEntries.upgrades.length > 0;
  const activeGroup: WorkspaceNavGroup | undefined =
    section === "extension"
      ? evaluationNavItems.some((item) => item.path === location.pathname)
        ? "verification"
        : analysisEntries.items.some((item) => item.key === activeExtensionKey)
          ? "analysis"
          : governanceNavItems.some((item) => item.path === location.pathname)
            ? "governance"
            : "verification"
      : section === "experience-agent" ||
          section === "experience-mcp" ||
          section === "experience-cypher" ||
          section === "develop" ||
          section === "evals"
        ? "verification"
        : resourceNavItems.some((item) => item.key === section)
          ? "concept"
          : dynamicNavItems.some((item) => item.key === section)
            ? "dynamic"
            : governanceNavItems.some((item) => item.key === section)
              ? "governance"
              : undefined;
  const [expandedGroups, setExpandedGroups] = useState<Record<WorkspaceNavGroup, boolean>>({
    verification: activeGroup === "verification",
    analysis: activeGroup === "analysis",
    concept: activeGroup === "concept",
    dynamic: activeGroup === "dynamic",
    governance: activeGroup === "governance",
  });

  useEffect(() => {
    if (activeGroup) {
      setExpandedGroups((current) => ({ ...current, [activeGroup]: true }));
    }
  }, [activeGroup]);

  const renderGroupTitle = (group: WorkspaceNavGroup, label: string) =>
    sideCollapsed ? null : (
      <button
        aria-expanded={expandedGroups[group]}
        className={styles.sideTitle}
        onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !current[group] }))}
        type="button"
      >
        <span>{label}</span>
        {expandedGroups[group] ? <DownOutlined aria-hidden /> : <RightOutlined aria-hidden />}
      </button>
    );

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
        disabled={item.disabled}
        key={item.key}
        onClick={() => {
          if (item.disabled) return;
          if (opensUpgradeDialog) {
            setUpgradeItem(item);
            return;
          }

          void navigate(item.path ?? `/knowledge-network/workspace/${activeNetworkId}/${item.key}`);
        }}
        title={
          item.disabled ? `${item.label} · ${t("knowledgeNetwork.riskActionPending")}` : item.label
        }
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
          canCreateActionType={canModify && professionalCapabilityState === "available"}
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

    if (section === "develop") {
      return detail ? (
        <WorkspaceDevelopSection
          key={detail.identifier || detail.id}
          knId={detail.identifier || detail.id}
          networkId={activeNetworkId}
          networkName={detail.name || detail.identifier || detail.id}
        />
      ) : null;
    }

    if (section === "versions") {
      return (
        <KnVersionsPanel
          canDelete={mayDelete}
          canModify={mayModify}
          hasCapabilities={hasCapabilities}
          networkId={activeNetworkId}
          onChanged={() => setReloadTick((tick) => tick + 1)}
          onViewChange={setVersionView}
          versioning={versioning}
        />
      );
    }

    if (section === "permissions") {
      return (
        <Suspense fallback={null}>
          <WorkspacePermissionMatrixSection
            networkId={activeNetworkId}
            networkName={detail?.name || activeNetworkId}
            canAuthorize={hasKnowledgeNetworkRecordOperation(detail, "authorize")}
            fineGrainedAvailable={fineGrainedCapability === "available"}
            fineGrainedStatus={fineGrainedCapability}
            metricsAvailable={objectMetricsCapability === "available"}
          />
        </Suspense>
      );
    }

    if (section === "experience-agent" || section === "experience-mcp") {
      const initialMode = section === "experience-mcp" ? "mcp" : "agent";

      return (
        <Suspense fallback={null}>
          <ExperienceScene
            embedded
            initialMode={initialMode}
            lockMode
            network={experienceNetwork}
          />
        </Suspense>
      );
    }

    if (section === "extension") {
      if (children !== undefined) return children;
      const ExtensionPage = extensionKey
        ? extensionWorkspacePage(extensionKey)?.page.component
        : undefined;
      return ExtensionPage ? (
        <Suspense fallback={null}>
          <ExtensionPage />
        </Suspense>
      ) : null;
    }

    if (section === "experience-cypher") {
      return detail ? (
        <Suspense fallback={null}>
          <CypherQueryPage
            key={detail.identifier || detail.id}
            knId={detail.identifier || detail.id}
            networkId={activeNetworkId}
          />
        </Suspense>
      ) : null;
    }

    return (
      <Suspense fallback={null}>
        <WorkspaceResourceSection
          canDelete={canDelete}
          canModify={canModify}
          data={workspaceData}
          networkId={activeNetworkId}
          networkName={detail?.name ?? activeNetworkId}
          section={section}
        />
      </Suspense>
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
            {resourceNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {renderGroupTitle("concept", t("knowledgeNetwork.workspaceConceptModel"))}
                {sideCollapsed || expandedGroups.concept ? (
                  <div id="workspace-nav-concept">
                    {resourceNavItems.map((item) => renderSideNavItem(item))}
                  </div>
                ) : null}
              </>
            ) : null}
            {dynamicNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {renderGroupTitle("dynamic", t("knowledgeNetwork.workspaceDynamicModel"))}
                {sideCollapsed || expandedGroups.dynamic ? (
                  <div id="workspace-nav-dynamic">
                    {dynamicNavItems.map((item) => renderSideNavItem(item))}
                  </div>
                ) : null}
              </>
            ) : null}
            {hasAbilityVerification ? (
              <>
                <div className={styles.sideDivider} />
                {renderGroupTitle(
                  "verification",
                  t("knowledgeNetwork.workspaceAbilityVerification"),
                )}
                {sideCollapsed || expandedGroups.verification ? (
                  <div id="workspace-nav-verification">
                    {experienceNavItems.map((item) =>
                      renderSideNavItem(item, { showCount: false }),
                    )}
                    <WorkspaceExtensionNavItems
                      activeKey={activeExtensionKey}
                      collapsed={sideCollapsed}
                      hiddenKeys={hiddenNavigation}
                      networkId={activeNetworkId}
                    />
                    {developmentNavItems.map((item) =>
                      renderSideNavItem(item, { showCount: false }),
                    )}
                    {evaluationNavItems.map((item) =>
                      renderSideNavItem(item, { showCount: false }),
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
            {/* Shown only while another build lists an entry there. */}
            {analysisEntries.items.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {renderGroupTitle("analysis", t("knowledgeNetwork.workspaceAnalysis"))}
                {sideCollapsed || expandedGroups.analysis ? (
                  <div id="workspace-nav-analysis">
                    <WorkspaceExtensionNavItems
                      activeKey={activeExtensionKey}
                      collapsed={sideCollapsed}
                      hiddenKeys={hiddenNavigation}
                      networkId={activeNetworkId}
                      section="analysis"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {governanceNavItems.length > 0 ? (
              <>
                <div className={styles.sideDivider} />
                {renderGroupTitle("governance", t("knowledgeNetwork.workspaceRiskControl"))}
                {sideCollapsed || expandedGroups.governance ? (
                  <div id="workspace-nav-governance">
                    {governanceNavItems.map((item) =>
                      renderSideNavItem(item, { showCount: false }),
                    )}
                  </div>
                ) : null}
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
          {professionalCapabilityState === "available" && versioning && section !== "versions" ? (
            <KnVersionBar
              canModify={mayModify}
              hasCapabilities={hasCapabilities}
              networkId={activeNetworkId}
              onChanged={() => setReloadTick((tick) => tick + 1)}
              onViewChange={setVersionView}
              versioning={versioning}
              view={versionView}
            />
          ) : professionalCapabilityState === "available" && detail && section !== "versions" ? (
            <KnUnversionedBar
              canModify={mayModify}
              networkId={activeNetworkId}
              onChanged={() => setReloadTick((tick) => tick + 1)}
            />
          ) : null}
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
          {section === "overview" || (section === "extension" && children !== undefined) ? (
            <Fragment key={reloadKey}>{renderSectionContent()}</Fragment>
          ) : (
            <div
              // The versions page reloads itself; remounting it would close its open dialogs.
              key={section === "versions" ? section : reloadKey}
              className={
                section === "experience-agent" ||
                section === "experience-cypher" ||
                section === "extension" ||
                section === "metrics" ||
                section === "concept-groups" ||
                section === "object-types" ||
                section === "relation-types" ||
                section === "action-types" ||
                section === "event-classes"
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
          upgradeCopy={upgradeItem.upgradeCopy}
        />
      ) : null}
    </section>
  );
}
