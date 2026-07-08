/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";

import styles from "./DataConnectPageHeader.module.css";

type DataConnectPageHeaderProps = {
  description?: string;
  extra?: ReactNode;
  layout?: "default" | "inline";
  onBack: () => void;
  title: string;
  trailing?: ReactNode;
  variant?: "card" | "plain";
};

export function DataConnectPageHeader({
  description,
  extra,
  layout = "default",
  onBack,
  title,
  trailing,
  variant = "card",
}: DataConnectPageHeaderProps) {
  const layoutClass =
    layout === "inline"
      ? styles.headerPanelInline
      : trailing
        ? styles.headerPanelWithTrailing
        : styles.headerPanelStandard;
  const variantClass = variant === "plain" ? styles.headerPanelPlain : "";

  return (
    <div className={`${styles.headerPanel} ${layoutClass} ${variantClass}`.trim()}>
      <SceneBackButton className={styles.headerBackButton} onClick={onBack} />
      <div className={styles.headerCopy}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
        {extra ? <div className={styles.headerExtra}>{extra}</div> : null}
      </div>
      {trailing ? <div className={styles.headerTrailing}>{trailing}</div> : null}
    </div>
  );
}
