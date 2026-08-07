/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { setDevTokens } from "@/framework/auth/dev-auth";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./DevTokenSetupForm.module.css";

type DevTokenSetupFormProps = {
  onSaved: () => void;
};

export function DevTokenSetupForm({ onSaved }: DevTokenSetupFormProps) {
  const { t } = useTranslation();
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedAccess = accessToken.trim();

    if (!trimmedAccess) {
      setError(t("auth.devTokenAccessRequired"));
      return;
    }

    setDevTokens(trimmedAccess, refreshToken.trim() || undefined);
    setError(null);
    onSaved();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("auth.devTokenTitle")}</h1>
        <p className={styles.description}>{t("auth.devTokenDescription")}</p>
        <p className={styles.hint}>
          {t("auth.devTokenEnvPrefix")} <code>.env.local</code>{" "}
          {t("auth.devTokenEnvMiddle")} <code>VITE_DEV_ACCESS_TOKEN</code>
          {t("auth.devTokenEnvSuffix")}
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Access Token</span>
          <Input.TextArea
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder={t("auth.devTokenAccessPlaceholder")}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("auth.devTokenRefreshLabel")}</span>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t("auth.devTokenRefreshPlaceholder")}
            value={refreshToken}
            onChange={(event) => setRefreshToken(event.target.value)}
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <AppButton type="primary" onClick={handleSubmit}>
          {t("auth.devTokenSave")}
        </AppButton>
      </div>
    </div>
  );
}
