/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { BknProjectKbBadge, BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { extensionProjectKnowledgeBaseBuilds } from "@/framework/extension/registry";
import { ExistingIndexes } from "@/modules/bkn-project/components/build/ExistingIndexes";
import { IndexReadiness } from "@/modules/bkn-project/components/release/IndexReadiness";
import type { Project } from "@/modules/bkn-project/types/project";
import { BUILD_TABS, type BuildTab } from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectBuild.module.css";

const PREFIX = "bknProject.build";

/**
 * What the confirmed concept model is built into, one kind to a tab: the indexes structured
 * objects are searched by, in every edition, and the instances drawn from documents, in the
 * professional one. The tab lives in the URL, so links from other pages open on it.
 */
export function ProjectBuild({
  ownerIsCaller,
  project,
}: {
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const kbMode = useBknProjectKbMode();
  const KnowledgeBaseBuilds = extensionProjectKnowledgeBaseBuilds();
  const [searchParams, setSearchParams] = useSearchParams();

  const asked = BUILD_TABS.find((tab) => tab === searchParams.get("tab"));
  // The community image has no unstructured tab: a link to it opens the structured one.
  const activeTab: BuildTab =
    asked && (asked !== "unstructured" || kbMode !== "hidden") ? asked : "structured";
  const canRun = ownerIsCaller && !project.archived;

  return (
    <Tabs
      activeKey={activeTab}
      items={[
        {
          key: "structured",
          label: t(`${PREFIX}.tabs.structured`),
          children: (
            <div className={styles.tab}>
              <p className={styles.muted}>{t(`${PREFIX}.structured.description`)}</p>
              <IndexReadiness canRun={canRun} projectId={project.id} />
              {/* What the network already indexes: shown, not built, here. */}
              <ExistingIndexes networkId={project.knId} projectId={project.id} />
            </div>
          ),
        },
        // Professional: masked in an image without it, left out where it is hidden.
        ...(kbMode === "hidden"
          ? []
          : [
              {
                key: "unstructured",
                label: <BknProjectKbBadge>{t(`${PREFIX}.tabs.unstructured`)}</BknProjectKbBadge>,
                children: (
                  <div className={styles.tab}>
                    <p className={styles.muted}>{t(`${PREFIX}.unstructured.description`)}</p>
                    <BknProjectKbSlot
                      preview={
                        <p className={styles.muted}>{t(`${PREFIX}.unstructured.preview`)}</p>
                      }
                    >
                      {/* One mask for the tab while licensed away; the knowledge-base data refresh comes with the builds. */}
                      {KnowledgeBaseBuilds ? (
                        <KnowledgeBaseBuilds
                          canEdit={canRun}
                          canManageBuilds={ownerIsCaller}
                          lineageId={project.knId}
                          projectId={project.id}
                          // The build tasks and the instances they made are one tab now; the
                          // instances' preview comes with it.
                          section="instances"
                        />
                      ) : (
                        <p className={styles.muted}>{t(`${PREFIX}.unstructured.comingSoon`)}</p>
                      )}
                    </BknProjectKbSlot>
                  </div>
                ),
              },
            ]),
      ]}
      onChange={(tab) =>
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set("tab", tab);
          return next;
        })
      }
    />
  );
}
