/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Empty, Spin } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import styles from "./ExecutionUnitDetailDrawerLayout.module.css";

type ExecutionUnitDetailDrawerLayoutProps = {
  children?: ReactNode;
  empty?: boolean;
  footerDanger?: ReactNode;
  footerPrimary?: ReactNode;
  footerSecondary?: ReactNode;
  headerExtra?: ReactNode;
  loadError?: string | null;
  loading?: boolean;
  marketMode?: boolean;
  onClose: () => void;
  open: boolean;
  title: string;
  width?: number;
};

export function ExecutionUnitDetailDrawerLayout({
  children,
  empty = false,
  footerDanger,
  footerPrimary,
  footerSecondary,
  headerExtra,
  loadError,
  loading = false,
  marketMode = false,
  onClose,
  open,
  title,
  width = 720,
}: ExecutionUnitDetailDrawerLayoutProps) {
  const { t } = useTranslation();
  const hasFooter = Boolean(footerPrimary || footerSecondary || footerDanger);

  return (
    <Drawer
      className={[styles.drawer, marketMode ? styles.drawerMarket : ""].filter(Boolean).join(" ")}
      destroyOnClose
      extra={headerExtra}
      footer={
        hasFooter ? (
          <div className={styles.footer}>
            <div className={styles.footerDanger}>{footerDanger}</div>
            <div className={styles.footerActions}>
              {footerSecondary}
              {footerPrimary}
            </div>
          </div>
        ) : undefined
      }
      onClose={onClose}
      open={open}
      title={title}
      width={width}
    >
      {loading ? (
        <div className={styles.stateWrap}>
          <Spin />
        </div>
      ) : null}
      {!loading && loadError ? (
        <Alert message={loadError} showIcon type="error" />
      ) : null}
      {!loading && !loadError && empty ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && !empty ? children : null}
    </Drawer>
  );
}
