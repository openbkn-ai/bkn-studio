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
  releaseFlowLock,
  stashCallbackError,
  takeStashedCallbackError,
} from "@/framework/auth/oauth";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./SignInScreen.module.css";

export function OAuthCallback() {
  const { i18n, t } = useTranslation();
  const loginLocale = i18n.resolvedLanguage ?? i18n.language;
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
    const fail = (cause: unknown) => {
      // This flow is dead — hand the lock back so other tabs stop waiting on
      // it instead of sitting out the full TTL. Prefer the stashed reason: on
      // a failed retry the current message describes the retry, not the cause.
      releaseFlowLock();
      const original = takeStashedCallbackError();
      setError(original ?? (cause instanceof Error ? cause.message : String(cause)));
    };

    if (isCsrfConflictCallback() && consumeCsrfRetry()) {
      stashCallbackError();
      beginLogin(getStoredReturnTo(), loginLocale).catch(fail);
      return;
    }

    completeLogin()
      .then((returnTo) => {
        window.location.replace(returnTo);
      })
      .catch(fail);
  }, [loginLocale]);

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
