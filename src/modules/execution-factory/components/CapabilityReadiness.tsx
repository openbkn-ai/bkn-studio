/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Tag, Tooltip } from "antd";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { CapabilityManifest } from "@/modules/execution-factory/types/capability-manifest";
import {
  getCapabilityReadiness,
  READINESS_DIMENSIONS,
} from "@/modules/execution-factory/utils/capability-manifest";

import styles from "./CapabilityReadiness.module.css";

const DIMENSION_LABELS: Record<string, string> = {
  "business intent": "Business intent",
  "input semantics": "Input semantics",
  "output semantics": "Output semantics",
};

const DIMENSION_LABEL_KEYS: Record<string, string> = {
  "business intent": "businessIntent",
  "input semantics": "inputSemantics",
  "output semantics": "outputSemantics",
};

function readinessDimensionLabel(key: string, t: TFunction) {
  const labelKey = DIMENSION_LABEL_KEYS[key];
  if (!labelKey) {
    return key;
  }
  return t(`executionFactory.agentReadiness.dimensions.${labelKey}`, {
    defaultValue: DIMENSION_LABELS[key] ?? key,
  });
}

type CapabilityManifestProps = {
  manifest: CapabilityManifest;
};

/** 就绪度评分，挂在详情卡标题行上。 */
export function CapabilityReadinessScore({ manifest }: CapabilityManifestProps) {
  const { t } = useTranslation();
  const readiness = getCapabilityReadiness(manifest);

  return (
    <div className={styles.score} data-testid="capability-readiness-score">
      <Tooltip
        title={
          <div className={styles.scoreRuleTip}>
            <div className={styles.scoreRuleTitle}>
              {t("executionFactory.agentReadiness.scoreRuleTitle")}
            </div>
            {READINESS_DIMENSIONS.map((dim) => {
              const skipped = readiness.notApplicable.includes(dim.key);
              const met = !skipped && !readiness.missing.includes(dim.key);
              const label = readinessDimensionLabel(dim.key, t);

              return (
                <div
                  className={
                    met
                      ? styles.scoreRuleRow
                      : `${styles.scoreRuleRow} ${styles.scoreRuleRowMuted}`
                  }
                  key={dim.key}
                >
                  <span>{`${skipped ? "—" : met ? "✓" : "○"} ${label}`}</span>
                  <span>
                    {skipped
                      ? t("executionFactory.agentReadiness.notApplicable")
                      : dim.weight}
                  </span>
                </div>
              );
            })}
            {readiness.notApplicable.length > 0 ? (
              <div className={styles.scoreRuleNote}>
                {t("executionFactory.agentReadiness.notApplicableNote")}
              </div>
            ) : null}
          </div>
        }
      >
        <span className={styles.scoreLabel}>
          {t("executionFactory.agentReadiness.score")}
          <QuestionCircleOutlined className={styles.scoreInfoIcon} />
        </span>
      </Tooltip>
      {/* 百分数自己就说清了程度，进度条只是把同一个数再画一遍，还得占一段固定宽度。 */}
      <span
        className={
          readiness.level === "low" ? `${styles.scoreValue} ${styles.scoreValueLow}` : styles.scoreValue
        }
      >
        {readiness.score}%
      </span>
    </div>
  );
}

/**
 * 输入输出规模摘要，挂在「输入输出」面板标题上。刻意不做成标签行：
 * 这是计数不是属性，跟身份标签同权重排一排只会把卡片切碎。
 */
export function CapabilityIoCounts({ manifest }: CapabilityManifestProps) {
  const { t } = useTranslation();
  // "输入 0" is a real fact — the tool takes no arguments. "输出 0" is not:
  // MCP servers almost never declare an outputSchema, and reading that as
  // "returns nothing" is wrong. Say undeclared when nothing was declared.
  const input = String(manifest.inputSemantics?.length ?? 0);
  const output = (manifest.readinessNotApplicable ?? []).includes("output semantics")
    ? t("executionFactory.agentReadiness.ioUndeclared")
    : String(manifest.outputSemantics?.length ?? 0);

  return (
    <span className={styles.ioCounts}>
      {t("executionFactory.agentReadiness.ioCounts", { input, output })}
    </span>
  );
}

/**
 * 只在缺项时出声。齐备是常态，说一句「已齐备」等于把噪音铺满每张卡；
 * 状态已经由标题行的开关表达，不必再用文字复述一遍。
 */
export function CapabilityReadinessHint({ manifest }: CapabilityManifestProps) {
  const { t } = useTranslation();
  const readiness = getCapabilityReadiness(manifest);

  if (readiness.missing.length === 0) {
    return null;
  }

  return (
    <Alert
      description={
        <div className={styles.missingList}>
          {readiness.missing.map((item) => (
            <Tag key={item}>{readinessDimensionLabel(item, t)}</Tag>
          ))}
        </div>
      }
      message={t("executionFactory.agentReadiness.missingTitle")}
      showIcon
      type="info"
    />
  );
}
