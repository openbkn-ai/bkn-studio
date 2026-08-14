/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LargeModelListPanel } from "@/modules/model-resources/components/models/LargeModelListPanel";
import { SmallModelListPanel } from "@/modules/model-resources/components/models/SmallModelListPanel";
import { getModelViewAccess } from "@/modules/model-resources/utils/model-access";

import pageStyles from "./model-resources-page.module.css";
import styles from "./ModelListScene.module.css";

export function ModelListScene() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canViewLargeModel, canViewSmallModel } = getModelViewAccess(
    runtimeConfig.currentUser.permissions,
  );
  const requestedKey = searchParams.get("tab") === "small-model" ? "small-model" : "llm";
  const activeKey =
    requestedKey === "small-model" && canViewSmallModel
      ? "small-model"
      : canViewLargeModel
        ? "llm"
        : "small-model";

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

      {canViewLargeModel || canViewSmallModel ? (
        <Tabs
          activeKey={activeKey}
          className={styles.tabs}
          items={[
            ...(canViewLargeModel
              ? [
                  {
                    key: "llm",
                    label: t("modelResources.models.tabs.llm"),
                    children: <LargeModelListPanel />,
                  },
                ]
              : []),
            ...(canViewSmallModel
              ? [
                  {
                    key: "small-model",
                    label: t("modelResources.models.tabs.smallModel"),
                    children: <SmallModelListPanel />,
                  },
                ]
              : []),
          ]}
          onChange={handleTabChange}
        />
      ) : (
        <EmptyStatePanel title={t("common.noPermission")} />
      )}
    </section>
  );
}
