import {
  ApiOutlined,
  CloudServerOutlined,
  CodeOutlined,
  FileTextOutlined,
  FileZipOutlined,
} from "@ant-design/icons";
import { Radio } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CapabilityUxMode } from "@/modules/execution-factory/utils/capability-ux";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import styles from "./create-menu.module.css";

type AddCapabilityModeStepProps = {
  allowedModes?: CapabilityUxMode[];
  mode?: CapabilityUxMode;
  onModeChange: (mode: CapabilityUxMode) => void;
};

export function AddCapabilityModeStep({
  allowedModes,
  mode,
  onModeChange,
}: AddCapabilityModeStepProps) {
  const { t } = useTranslation();

  const allOptions = useMemo(
    () => [
      {
        key: "quick-api" as const,
        icon: ApiOutlined,
        title: t("executionFactory.addCapabilityQuickApiTitle"),
        desc: t("executionFactory.addCapabilityQuickApiDesc"),
      },
      {
        key: "import-openapi" as const,
        icon: FileTextOutlined,
        title: t("executionFactory.addCapabilityImportOpenApiTitle"),
        desc: t("executionFactory.addCapabilityImportOpenApiDesc"),
      },
      {
        key: "function" as const,
        icon: CodeOutlined,
        title: t("executionFactory.addCapabilityFunctionTitle"),
        desc: t("executionFactory.addCapabilityFunctionDesc"),
      },
      {
        key: "mcp" as const,
        icon: CloudServerOutlined,
        title: t("executionFactory.addCapabilityMcpTitle"),
        desc: t("executionFactory.addCapabilityMcpDesc"),
      },
      {
        key: "skill" as const,
        icon: FileZipOutlined,
        title: t("executionFactory.addCapabilitySkillTitle"),
        desc: t("executionFactory.addCapabilitySkillDesc"),
      },
    ],
    [t],
  );

  const options = useMemo(() => {
    if (!allowedModes?.length) {
      return allOptions;
    }

    const allowed = new Set(allowedModes);
    return allOptions.filter((option) => allowed.has(option.key));
  }, [allOptions, allowedModes]);

  return (
    <div>
      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.addCapabilityWizard" />
      <Radio.Group
        onChange={(event) => onModeChange(event.target.value as CapabilityUxMode)}
        value={mode}
      >
        <div
          className={`${styles.optionGrid} ${
            options.length <= 2 ? styles.optionGridTwo : styles.optionGridThree
          }`}
        >
          {options.map(({ key, title, desc, icon: Icon }) => (
            <label
              className={`${styles.optionCard} ${mode === key ? styles.optionCardActive : ""}`}
              key={key}
              onClick={() => onModeChange(key)}
            >
              <Radio value={key} />
              <Icon style={{ fontSize: 22, color: "#1677ff" }} />
              <div className={styles.optionTitle}>{title}</div>
              <div className={styles.optionDesc}>{desc}</div>
            </label>
          ))}
        </div>
      </Radio.Group>
    </div>
  );
}
