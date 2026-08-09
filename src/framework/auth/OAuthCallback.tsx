/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getAppHomePath } from "@/app/router/app-paths";
import { Alert, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  beginLogin,
  completeLogin,
  consumeCsrfRetry,
  getStoredReturnTo,
  isCsrfConflictCallback,
} from "@/framework/auth/oauth";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./SignInScreen.module.css";

export function OAuthCallback() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects; the authorization code is single-use.
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    // hydra rejected the authorize request because the browser's login CSRF
    // cookie belongs to another flow. A fresh /oauth2/auth rewrites the cookie,
    // so retry once instead of stranding the user on a dead error page — this
    // is the path a forced first-login password change lands on.
    if (isCsrfConflictCallback() && consumeCsrfRetry()) {
      beginLogin(getStoredReturnTo()).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
      return;
    }

    completeLogin()
      .then((returnTo) => {
        window.location.replace(returnTo);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {error ? (
          <>
            <Alert
              message={t("auth.callbackErrorTitle")}
              description={error}
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
              type="error"
            />
            <AppButton
              className={styles.submit}
              type="primary"
              onClick={() => window.location.replace(getAppHomePath())}
            >
              {t("auth.backToSignIn")}
            </AppButton>
          </>
        ) : (
          <>
            <Spin size="large" />
            <p className={styles.subtitle} style={{ marginTop: 16 }}>
              {t("auth.callbackProcessing")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
