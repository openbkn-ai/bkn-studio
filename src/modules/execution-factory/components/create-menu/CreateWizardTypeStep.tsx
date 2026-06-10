import {
  ApiOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Radio } from "antd";
import { useTranslation } from "react-i18next";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import styles from "./create-menu.module.css";

type CreateWizardTypeStepProps = {
  onChange: (tab: ExecutionUnitTab) => void;
  value: ExecutionUnitTab;
};

const TAB_OPTIONS: Array<{
  key: ExecutionUnitTab;
  icon: typeof ApiOutlined;
}> = [
  { key: "mcp", icon: ApiOutlined },
  { key: "toolbox", icon: ToolOutlined },
  { key: "operator", icon: DeploymentUnitOutlined },
  { key: "skill", icon: ThunderboltOutlined },
];

export function CreateWizardTypeStep({ onChange, value }: CreateWizardTypeStepProps) {
  const { t } = useTranslation();

  return (
    <div>
      <p className={styles.modalHint}>{t("executionFactory.createWizardTypeHint")}</p>
      <Radio.Group
        onChange={(event) => onChange(event.target.value as ExecutionUnitTab)}
        value={value}
      >
        <div className={styles.wizardTypeGrid}>
          {TAB_OPTIONS.map(({ key, icon: Icon }) => (
            <label
              className={`${styles.optionCard} ${value === key ? styles.optionCardActive : ""}`}
              key={key}
            >
              <Radio value={key} />
              <Icon style={{ fontSize: 22, color: "#1677ff" }} />
              <div className={styles.optionTitle}>
                {t(`executionFactory.executionUnitTabs.${key}`)}
              </div>
              <div className={styles.optionDesc}>
                {t(`executionFactory.createWizardTypeDesc.${key}`)}
              </div>
            </label>
          ))}
        </div>
      </Radio.Group>
    </div>
  );
}
