/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./SceneBackButton.module.css";

type SceneBackButtonProps = {
  children?: ReactNode;
  className?: string;
  onClick: () => void;
};

export function SceneBackButton({ children, className, onClick }: SceneBackButtonProps) {
  const { t } = useTranslation();

  return (
    <AppButton
      className={[styles.backButton, className].filter(Boolean).join(" ")}
      icon={<ArrowLeftOutlined />}
      onClick={onClick}
    >
      {children ?? t("common.back")}
    </AppButton>
  );
}
