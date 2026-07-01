/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Badge, Button, Select, Tag } from "antd";

import { useState } from "react";

import { useTranslation } from "react-i18next";

import { LabPermissionHint } from "@/modules/execution-factory-lab/components/LabPermissionHint";
import { AppButton } from "@/framework/ui/common/AppButton";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import type { CatalogEntry } from "@/modules/execution-factory-lab/types/catalog";
import type { ImpexImportMode } from "@/modules/execution-factory-lab/services/capabilities-lab.service";

import styles from "../scenes/capability-lab.module.css";

type CatalogCardProps = {
  entry: CatalogEntry;
  installing?: boolean;
  onInstall: (entry: CatalogEntry, mode: ImpexImportMode) => void;
};

export function CatalogCard({ entry, installing, onInstall }: CatalogCardProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [installMode, setInstallMode] = useState<ImpexImportMode>("upsert");

  const handleInstall = () => {
    onInstall(entry, showAdvanced ? installMode : "create");
  };

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{entry.name}</h3>
        <Tag color="blue">{entry.kind.toUpperCase()}</Tag>
      </div>
      <div className={styles.cardMeta}>
        {entry.description ? <span>{entry.description}</span> : null}
        {entry.version ? <span>v{entry.version}</span> : null}
        {entry.installed ? (
          <Badge status="success" text={t("executionFactoryLab.catalogInstalled")} />
        ) : null}
      </div>
      <div className={styles.cardActions}>
        {showAdvanced ? (
          <Select
            disabled={entry.installed || installing}
            onChange={(value) => setInstallMode(value as ImpexImportMode)}
            options={[
              { value: "create", label: t("executionFactoryLab.catalogInstallModeCreate") },
              { value: "upsert", label: t("executionFactoryLab.catalogInstallModeUpsert") },
            ]}
            size="small"
            style={{ width: 140, marginRight: 8 }}
            value={installMode}
          />
        ) : null}
        <LabPermissionHint permissions={executionFactoryLabPermissions.catalogInstall}>
          <AppButton
            disabled={entry.installed || installing}
            loading={installing}
            onClick={handleInstall}
            type="primary"
          >
            {entry.installed
              ? t("executionFactoryLab.catalogInstalled")
              : t("executionFactoryLab.catalogInstallAction")}
          </AppButton>
        </LabPermissionHint>
        {!entry.installed ? (
          <Button onClick={() => setShowAdvanced((value) => !value)} size="small" type="link">
            {showAdvanced
              ? t("executionFactoryLab.catalogInstallSimple")
              : t("executionFactoryLab.catalogInstallAdvanced")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
