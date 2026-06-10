import { Tabs } from "antd";
import { useTranslation } from "react-i18next";

import { LargeModelListPanel } from "@/modules/model-resources/components/models/LargeModelListPanel";
import { SmallModelListPanel } from "@/modules/model-resources/components/models/SmallModelListPanel";

import pageStyles from "./model-resources-page.module.css";
import styles from "./ModelListScene.module.css";

export function ModelListScene() {
  const { t } = useTranslation();

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.pageIntro}>
        <h2 className={pageStyles.pageIntroTitle}>{t("modelResources.models.title")}</h2>
        <p className={pageStyles.pageIntroDescription}>{t("modelResources.models.description")}</p>
      </div>

      <Tabs
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
      />
    </section>
  );
}
