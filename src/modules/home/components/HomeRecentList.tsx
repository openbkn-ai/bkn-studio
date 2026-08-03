/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CloseOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type {
  RecentVisit,
  RecentVisitKind,
} from "@/modules/home/services/recent-visits.service";

import styles from "./HomeRecentList.module.css";

const KIND_ICONS: Record<RecentVisitKind, ReactNode> = {
  "data-resource": <DatabaseOutlined />,
  "execution-unit": <ToolOutlined />,
  "knowledge-network": <DeploymentUnitOutlined />,
};

type HomeRecentListProps = {
  onForget: (kind: RecentVisitKind, id: string) => void;
  visits: RecentVisit[];
};

export function HomeRecentList({ onForget, visits }: HomeRecentListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t("home.recent.title")}</h2>
      {visits.length === 0 ? (
        <p className={styles.empty}>{t("home.recent.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {visits.map((visit) => (
            <li className={styles.item} key={`${visit.kind}:${visit.id}`}>
              <button
                className={styles.itemLink}
                onClick={() => void navigate(visit.path)}
                title={visit.title}
                type="button"
              >
                <span className={styles.itemIcon} aria-hidden>
                  {KIND_ICONS[visit.kind]}
                </span>
                <span className={styles.itemTitle}>{visit.title}</span>
                <span className={styles.itemKind}>
                  {t(`home.recent.kind.${visit.kind}`)}
                </span>
              </button>
              <Tooltip title={t("home.recent.forget")}>
                <button
                  aria-label={t("home.recent.forget")}
                  className={styles.itemForget}
                  onClick={() => onForget(visit.kind, visit.id)}
                  type="button"
                >
                  <CloseOutlined />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
