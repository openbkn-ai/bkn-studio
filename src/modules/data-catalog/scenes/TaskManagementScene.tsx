/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";

import { IndexBuildListScene } from "@/modules/data-catalog/scenes/IndexBuildListScene";

import { DiscoverTaskListPanel, SemanticUnderstandingTaskListPanel } from "./TaskManagementTaskPanels";
import styles from "./TaskManagementScene.module.css";

export function TaskManagementScene() {
  const { t } = useTranslation();

  return (
    <Tabs
      className={styles.tabs}
      items={[
        {
          key: "index-build",
          label: t("dataCatalog.taskManagement.tabs.indexBuild"),
          children: <IndexBuildListScene />,
        },
        {
          key: "discover",
          label: t("dataCatalog.taskManagement.tabs.discover"),
          children: <DiscoverTaskListPanel />,
        },
        {
          key: "semantic-understanding",
          label: t("dataCatalog.taskManagement.tabs.semanticUnderstanding"),
          children: <SemanticUnderstandingTaskListPanel />,
        },
      ]}
    />
  );
}
