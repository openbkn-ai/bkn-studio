import { useTranslation } from "react-i18next";

import styles from "./create-menu/create-menu.module.css";

type CapabilityBusinessIntroProps = {
  messageKey: string;
  variant?: "primary" | "section";
};

export function CapabilityBusinessIntro({
  messageKey,
  variant = "primary",
}: CapabilityBusinessIntroProps) {
  const { t } = useTranslation();

  return (
    <p
      className={variant === "primary" ? styles.businessIntro : styles.sectionIntro}
      data-testid="capability-business-intro"
    >
      {t(messageKey)}
    </p>
  );
}

type ToolboxPlacementIntroProps = {
  mode: "existing" | "new";
};

export function ToolboxPlacementIntro({ mode }: ToolboxPlacementIntroProps) {
  return (
    <CapabilityBusinessIntro
      messageKey={
        mode === "new"
          ? "executionFactory.businessIntro.toolboxPlacementNew"
          : "executionFactory.businessIntro.toolboxPlacementExisting"
      }
      variant="section"
    />
  );
}
