/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { LargeModelListPanel } from "@/modules/model-resources/components/models/LargeModelListPanel";
import { SmallModelListPanel } from "@/modules/model-resources/components/models/SmallModelListPanel";

import pageStyles from "./model-resources-page.module.css";
import styles from "./ModelListScene.module.css";

export function ModelListScene() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = searchParams.get("tab") === "small-model" ? "small-model" : "llm";

  const handleTabChange = (key: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (key === "llm") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", key);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.pageIntro}>
        <h2 className={pageStyles.pageIntroTitle}>{t("modelResources.models.title")}</h2>
        <p className={pageStyles.pageIntroDescription}>{t("modelResources.models.description")}</p>
      </div>

      <Tabs
        activeKey={activeKey}
        className={styles.tabs}
        items={[
          {
            key: "llm",
            label: t("modelResources.models.tabs.llm"),
            children: <LargeModelListPanel />,
          },
          {
            key: "small-model",
            label: t("modelResources.models.tabs.smallModel"),
            children: <SmallModelListPanel />,
          },
        ]}
        onChange={handleTabChange}
      />
    </section>
  );
}
