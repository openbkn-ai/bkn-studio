/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { SettingOutlined } from "@ant-design/icons";
import { Button, Popover, Radio, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type {
  DragMode,
  EdgeLabels,
  FrameGraphSettings,
} from "@/modules/knowledge-network/cypher/graph-style";

import styles from "./CypherQueryScene.module.css";

/** The graph's own settings, in its tool bar: they change this frame only. */
export function FrameGraphSettingsButton({
  value,
  onChange,
}: {
  value: FrameGraphSettings;
  onChange: (value: FrameGraphSettings) => void;
}) {
  const { t } = useTranslation();
  const content = (
    <div className={styles.settings}>
      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          {t("knowledgeNetwork.cypherQuery.settings.edgeLabels")}
        </div>
        <Radio.Group
          buttonStyle="solid"
          onChange={(event) => onChange({ ...value, edgeLabels: event.target.value as EdgeLabels })}
          optionType="button"
          options={[
            { value: "auto", label: t("knowledgeNetwork.cypherQuery.settings.auto") },
            { value: "on", label: t("knowledgeNetwork.cypherQuery.settings.on") },
            { value: "off", label: t("knowledgeNetwork.cypherQuery.settings.off") },
          ]}
          size="small"
          value={value.edgeLabels ?? "auto"}
        />
      </div>
      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          {t("knowledgeNetwork.cypherQuery.settings.dragMode")}
        </div>
        <Radio.Group
          buttonStyle="solid"
          data-testid="cypher-frame-drag-mode"
          onChange={(event) => onChange({ ...value, dragMode: event.target.value as DragMode })}
          optionType="button"
          options={[
            { value: "fixed", label: t("knowledgeNetwork.cypherQuery.settings.dragFixed") },
            { value: "force", label: t("knowledgeNetwork.cypherQuery.settings.dragForce") },
          ]}
          size="small"
          value={value.dragMode ?? "fixed"}
        />
      </div>
    </div>
  );
  return (
    <Popover
      content={content}
      placement="topRight"
      title={t("knowledgeNetwork.cypherQuery.settings.frameTitle")}
      trigger="click"
    >
      <Tooltip title={t("knowledgeNetwork.cypherQuery.settings.frameTitle")}>
        <Button
          aria-label={t("knowledgeNetwork.cypherQuery.settings.frameTitle")}
          data-testid="cypher-frame-graph-settings"
          icon={<SettingOutlined />}
          size="small"
          type="text"
        />
      </Tooltip>
    </Popover>
  );
}
