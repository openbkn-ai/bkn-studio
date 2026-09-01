/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { IndexBuildListScene } from "@/modules/data-catalog/scenes/IndexBuildListScene";

import { DiscoverTaskListPanel, SemanticUnderstandingTaskListPanel } from "./TaskManagementTaskPanels";
import styles from "./TaskManagementScene.module.css";

type TaskManagementTab = "discover" | "index-build" | "semantic-understanding";

function resolveTaskManagementTab(value: string | null): TaskManagementTab {
  if (value === "index-build" || value === "semantic-understanding") {
    return value;
  }
  return "discover";
}

export function TaskManagementScene() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTaskManagementTab(searchParams.get("tab"));

  useEffect(() => {
    if (searchParams.get("tab") === activeTab) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  return (
    <section className={styles.page}>
      <div className={styles.pageIntro}>
        <h2 className={styles.pageIntroTitle}>{t("dataCatalog.indexBuildTitle")}</h2>
        <p className={styles.pageIntroDescription}>
          {t("dataCatalog.indexBuildDescription")}
        </p>
      </div>

      <Tabs
        activeKey={activeTab}
        className={styles.tabs}
        items={[
          {
            key: "discover",
            label: t("dataCatalog.taskManagement.tabs.discover"),
            children: <DiscoverTaskListPanel />,
          },
          {
            key: "index-build",
            label: t("dataCatalog.taskManagement.tabs.indexBuild"),
            children: <IndexBuildListScene />,
          },
          {
            key: "semantic-understanding",
            label: t("dataCatalog.taskManagement.tabs.semanticUnderstanding"),
            children: <SemanticUnderstandingTaskListPanel />,
          },
        ]}
        onChange={(nextTab) => {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("tab", nextTab);
          setSearchParams(nextParams, { replace: true });
        }}
      />
    </section>
  );
}
