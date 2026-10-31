/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  BuildOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { BknProjectKbBadge } from "@/framework/entitlement/BknProjectKbSlot";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import {
  KNOWLEDGE_BASE_SECTIONS,
  projectSectionPath,
  type ProjectSection,
} from "@/modules/bkn-project/types/workspace";
// The knowledge network workspace's side navigation: the project's looks and behaves the same.
import kn from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene.module.css";

type NavGroup = { sections: ProjectSection[]; titleKey?: string };

const NAV_GROUPS: NavGroup[] = [
  { sections: ["overview"] },
  // In the order a project is built: its inputs, the ontology, the scenarios that test it, then
  // the knowledge base drawn by the ontology.
  {
    sections: ["resources", "model", "scenarios", "instances"],
    titleKey: "bknProject.workspace.groupBuild",
  },
  { sections: ["release", "builds"], titleKey: "bknProject.workspace.groupRelease" },
];

const ICONS: Record<ProjectSection, ReactNode> = {
  builds: <BuildOutlined />,
  instances: <DatabaseOutlined />,
  model: <ApartmentOutlined />,
  overview: <FileTextOutlined />,
  release: <RocketOutlined />,
  resources: <FolderOpenOutlined />,
  scenarios: <FileSearchOutlined />,
};

/**
 * The project's own navigation, in place of the console's, drawn as the knowledge network
 * workspace's: an icon per page, counts where a page holds items, and a button that folds it to
 * icons. Items are never disabled; knowledge-base pages follow the three entitlement states.
 */
export function ProjectWorkspaceNav({
  active,
  counts = {},
  projectId,
}: {
  active: ProjectSection;
  /** How many items a page holds, such as catalogs, object types or questions; none while unknown. */
  counts?: Partial<Record<ProjectSection, number>>;
  projectId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kbMode = useBknProjectKbMode();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${kn.workspaceSide} ${collapsed ? kn.workspaceSideCollapsed : ""}`}>
      <nav aria-label={t("bknProject.workspace.navLabel")} className={kn.workspaceSideScroll}>
        {NAV_GROUPS.map((group, index) => {
          const sections = group.sections.filter(
            (section) => kbMode !== "hidden" || !KNOWLEDGE_BASE_SECTIONS.includes(section),
          );
          return (
            <Fragment key={group.titleKey ?? "top"}>
              {index ? <div className={kn.sideDivider} /> : null}
              {group.titleKey && !collapsed ? (
                <div className={kn.sideTitle}>{t(group.titleKey)}</div>
              ) : null}
              {sections.map((section) => {
                const label = t(`bknProject.workspace.sections.${section}`);
                const count = counts[section];
                return (
                  <button
                    aria-current={section === active ? "page" : undefined}
                    // Named by its page alone: the count beside it is not part of the name.
                    aria-label={label}
                    className={section === active ? kn.sideItemActive : kn.sideItem}
                    key={section}
                    onClick={() => void navigate(projectSectionPath(projectId, section))}
                    title={label}
                    type="button"
                  >
                    <span className={kn.sideItemMeta}>
                      {ICONS[section]}
                      {collapsed ? null : KNOWLEDGE_BASE_SECTIONS.includes(section) ? (
                        <BknProjectKbBadge>{label}</BknProjectKbBadge>
                      ) : (
                        <span>{label}</span>
                      )}
                    </span>
                    {!collapsed && count !== undefined ? (
                      <span className={kn.sideItemStatus}>
                        <span className={kn.sideItemCount}>{count}</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </nav>
      <div className={kn.workspaceSideFooter}>
        <button
          aria-label={collapsed ? t("shell.expandSidenav") : t("shell.collapseSidenav")}
          className={kn.sideCollapseButton}
          onClick={() => setCollapsed((current) => !current)}
          title={collapsed ? t("shell.expandSidenav") : t("shell.collapseSidenav")}
          type="button"
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>
    </aside>
  );
}
