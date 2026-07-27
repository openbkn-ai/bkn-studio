/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type { CapabilityManifest } from "@/modules/execution-factory/types/capability-manifest";
import { getCapabilityReadiness } from "@/modules/execution-factory/utils/capability-manifest";

import styles from "./CapabilityReadiness.module.css";

const READINESS_DIMENSIONS: Array<{ key: string; label: string; weight: number }> = [
  { key: "business intent", label: "业务用途", weight: 40 },
  { key: "input semantics", label: "输入语义", weight: 35 },
  { key: "output semantics", label: "输出语义", weight: 25 },
];

function readinessDimensionLabel(key: string) {
  return READINESS_DIMENSIONS.find((dim) => dim.key === key)?.label ?? key;
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
              {t("executionFactory.agentReadiness.scoreRuleTitle", {
                defaultValue: "就绪度评分规则",
              })}
            </div>
            {READINESS_DIMENSIONS.map((dim) => {
              const met = !readiness.missing.includes(dim.key);
              return (
                <div
                  className={
                    met
                      ? styles.scoreRuleRow
                      : `${styles.scoreRuleRow} ${styles.scoreRuleRowMuted}`
                  }
                  key={dim.key}
                >
                  <span>{`${met ? "✓" : "○"} ${dim.label}`}</span>
                  <span>{dim.weight}</span>
                </div>
              );
            })}
          </div>
        }
      >
        <span className={styles.scoreLabel}>
          {t("executionFactory.agentReadiness.score", {
            defaultValue: "就绪度",
          })}
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
  const inputCount = manifest.inputSemantics?.length ?? 0;
  const outputCount = manifest.outputSemantics?.length ?? 0;

  return (
    <span className={styles.ioCounts}>
      {t("executionFactory.agentReadiness.ioCounts", {
        input: inputCount,
        output: outputCount,
        defaultValue: `输入 ${inputCount} · 输出 ${outputCount}`,
      })}
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
            <Tag key={item}>{readinessDimensionLabel(item)}</Tag>
          ))}
        </div>
      }
      message={t("executionFactory.agentReadiness.missingTitle", {
        defaultValue: "建议补齐后再开放给 Agent 自动调用",
      })}
      showIcon
      type="info"
    />
  );
}
