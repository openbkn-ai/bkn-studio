/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined } from "@ant-design/icons";
import { Dropdown, Tooltip } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { isRequestNotFound } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  exportRequirements,
  type ExportTarget,
} from "@/modules/bkn-project/services/requirements.service";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements.export";

const TARGETS: ExportTarget[] = ["workshop", "eval"];

/**
 * Exports the ready specification as a file, for Workshop (capability questions and rules) or for
 * evaluation (knowledge questions and their test questions). No value of a record is exported.
 */
export function RequirementsExport({ projectId, ready }: { projectId: string; ready: boolean }) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [exporting, setExporting] = useState(false);

  const download = async (target: ExportTarget) => {
    setExporting(true);
    try {
      await exportRequirements(projectId, target);
    } catch (error) {
      message.error(t(`${PREFIX}.${isRequestNotFound(error) ? "notReady" : "failed"}`));
    } finally {
      setExporting(false);
    }
  };

  const button = (
    <AppButton disabled={!ready} loading={exporting}>
      {t(`${PREFIX}.button`)} <DownOutlined />
    </AppButton>
  );
  if (!ready) {
    return (
      <Tooltip title={t(`${PREFIX}.notReady`)}>
        <span>{button}</span>
      </Tooltip>
    );
  }
  return (
    <Dropdown
      menu={{
        items: [
          {
            // What every export leaves out heads the choices.
            children: TARGETS.map((target) => ({
              key: target,
              label: (
                <span className={styles.exportItem}>
                  <span>{t(`${PREFIX}.${target}.label`)}</span>
                  <span className={styles.muted}>{t(`${PREFIX}.${target}.hint`)}</span>
                </span>
              ),
            })),
            key: "targets",
            label: <span className={styles.exportNote}>{t(`${PREFIX}.noValues`)}</span>,
            type: "group",
          },
        ],
        onClick: ({ key }) => void download(key as ExportTarget),
      }}
      trigger={["click"]}
    >
      {button}
    </Dropdown>
  );
}
