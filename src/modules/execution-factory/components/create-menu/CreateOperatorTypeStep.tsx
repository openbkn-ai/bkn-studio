/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Radio } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

import styles from "./create-menu.module.css";

export type CreateOperatorMode = "openapi" | "function";

type CreateOperatorTypeStepProps = {
  mode?: CreateOperatorMode;
  onModeChange: (mode: CreateOperatorMode) => void;
  onSelect?: (mode: CreateOperatorMode) => void;
};

export function CreateOperatorTypeStep({
  mode,
  onModeChange,
  onSelect,
}: CreateOperatorTypeStepProps) {
  const { t } = useTranslation();

  const options = useMemo(
    () => [
      {
        key: "openapi" as const,
        icon: ApiOutlined,
        title: t("executionFactory.metadataTypes.openapi"),
        desc: t("executionFactory.createOperatorOpenApiDesc"),
      },
      {
        key: "function" as const,
        icon: ThunderboltOutlined,
        title: t("executionFactory.createOperatorFunctionTitle"),
        desc: t("executionFactory.createOperatorFunctionDesc"),
      },
    ],
    [t],
  );

  return (
    <div>
      <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.operatorCreateTop" />
      <p className={styles.modalHint}>{t("executionFactory.createOperatorModalHintLocked")}</p>
      <Radio.Group
        onChange={(event) => {
          const nextMode = event.target.value as CreateOperatorMode;
          onModeChange(nextMode);
          onSelect?.(nextMode);
        }}
        value={mode}
      >
        <div className={styles.optionGrid}>
          {options.map(({ key, title, desc, icon: Icon }) => (
            <label
              className={`${styles.optionCard} ${mode === key ? styles.optionCardActive : ""}`}
              key={key}
              onClick={() => {
                onModeChange(key);
                onSelect?.(key);
              }}
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
