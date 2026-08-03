/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { RightOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { ConsoleNavItem } from "@/app/shell/navigation/types";

import styles from "./HomeQuickActions.module.css";

type HomeQuickActionsProps = {
  items: ConsoleNavItem[];
};

export function HomeQuickActions({ items }: HomeQuickActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t("home.quickActions.title")}</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>{t("home.quickActions.empty")}</p>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <button
              className={styles.card}
              key={item.key}
              onClick={() => {
                if (item.path) {
                  void navigate(item.path);
                }
              }}
              type="button"
            >
              <span className={styles.cardIcon} aria-hidden>
                {item.icon}
              </span>
              <span className={styles.cardLabel}>{t(item.labelKey)}</span>
              <span className={styles.cardArrow} aria-hidden>
                <RightOutlined />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
