/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { BknProjectKbBadge } from "@/framework/entitlement/BknProjectKbSlot";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import {
  KNOWLEDGE_BASE_SECTIONS,
  projectSectionPath,
  type ProjectSection,
} from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectWorkspaceNav.module.css";

type NavGroup = { sections: ProjectSection[]; titleKey?: string };

const NAV_GROUPS: NavGroup[] = [
  { sections: ["overview"] },
  { sections: ["requirements", "model", "instances"], titleKey: "bknProject.workspace.groupBuild" },
  { sections: ["release", "builds"], titleKey: "bknProject.workspace.groupRelease" },
];

/**
 * The project's own navigation, in place of the console's. Items are never disabled and carry no
 * counts or status marks; knowledge-base pages follow the three entitlement states.
 */
export function ProjectWorkspaceNav({
  active,
  projectId,
}: {
  active: ProjectSection;
  projectId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kbMode = useBknProjectKbMode();

  return (
    <nav aria-label={t("bknProject.workspace.navLabel")} className={styles.nav}>
      {NAV_GROUPS.map((group) => {
        const sections = group.sections.filter(
          (section) => kbMode !== "hidden" || !KNOWLEDGE_BASE_SECTIONS.includes(section),
        );
        return (
          <div className={styles.group} key={group.titleKey ?? "top"}>
            {group.titleKey ? <div className={styles.groupTitle}>{t(group.titleKey)}</div> : null}
            {sections.map((section) => {
              const label = t(`bknProject.workspace.sections.${section}`);
              return (
                <button
                  aria-current={section === active ? "page" : undefined}
                  className={section === active ? styles.itemActive : styles.item}
                  key={section}
                  onClick={() => void navigate(projectSectionPath(projectId, section))}
                  type="button"
                >
                  {KNOWLEDGE_BASE_SECTIONS.includes(section) ? (
                    <BknProjectKbBadge>{label}</BknProjectKbBadge>
                  ) : (
                    label
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
