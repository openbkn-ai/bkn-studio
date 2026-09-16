/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

type AuthorizationRegistryFailureAlertProps = {
  error: unknown;
  onRetry: () => void;
};

/** Keep authorization authoring unavailable rather than falling back to stale operation metadata. */
export function AuthorizationRegistryFailureAlert({
  error,
  onRetry,
}: AuthorizationRegistryFailureAlertProps) {
  const { t } = useTranslation();
  if (!error) {
    return null;
  }
  return (
    <Alert
      action={<AppButton onClick={onRetry} type="link">{t("common.retry")}</AppButton>}
      message={t("systemAdmin.authorizationRegistry.loadFailed")}
      showIcon
      type="error"
    />
  );
}
