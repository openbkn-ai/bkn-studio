/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DevTokenSetupForm } from "@/framework/auth/DevTokenSetupForm";
import {
  beginLogin,
  canAutoStartLogin,
  reloadForSharedAuthState,
  subscribeFlowLockRelease,
} from "@/framework/auth/oauth";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./SignInScreen.module.css";

type SignInScreenProps = {
  onDevTokenSaved: () => void;
};

export function SignInScreen({ onDevTokenSaved }: SignInScreenProps) {
  const { t } = useTranslation();
  const startedRef = useRef(false);
  const [redirecting, setRedirecting] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [deferredToOtherTab, setDeferredToOtherTab] = useState(false);
  const [showDevTokenForm, setShowDevTokenForm] = useState(false);

  useEffect(() => {
    if (showDevTokenForm) {
      return;
    }

    // Redirecting to hydra rewrites the browser's single login CSRF cookie, so
    // a background tab waking up mid-login would break the tab the user is
    // actually looking at. Only a visible tab that no other flow owns may go on
    // its own; otherwise wait and offer the manual button, which takes over.
    const startIfAllowed = () => {
      if (startedRef.current) {
        return true;
      }
      if (document.visibilityState !== "visible" || !canAutoStartLogin()) {
        return false;
      }

      startedRef.current = true;
      setDeferredToOtherTab(false);
      setRedirecting(true);
      const { hash, pathname, search } = window.location;

      beginLogin(`${pathname}${search}${hash}`).catch((cause: unknown) => {
        setRedirectError(cause instanceof Error ? cause.message : String(cause));
        setRedirecting(false);
        startedRef.current = false;
      });
      return true;
    };

    if (startIfAllowed()) {
      return;
    }

    setRedirecting(false);
    setDeferredToOtherTab(true);

    // Two wake-ups, deliberately different. visibilitychange reaches one tab at
    // a time, so that tab may start its own flow. A lock release reaches every
    // waiting tab at once — starting there would put them all on the wire
    // together, so they reload and pick up the shared cookie instead.
    const retry = () => void startIfAllowed();
    document.addEventListener("visibilitychange", retry);
    const unsubscribe = subscribeFlowLockRelease(reloadForSharedAuthState);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      unsubscribe();
    };
  }, [showDevTokenForm]);

  if (showDevTokenForm) {
    return <DevTokenSetupForm onSaved={onDevTokenSaved} />;
  }

  // Explicit intent overrides the other-tab lock: the user is here, so this is
  // the flow that should own the CSRF cookie.
  const handleSignIn = () => {
    startedRef.current = true;
    setRedirecting(true);
    setRedirectError(null);
    setDeferredToOtherTab(false);
    const { hash, pathname, search } = window.location;
    void beginLogin(`${pathname}${search}${hash}`).catch((cause: unknown) => {
      setRedirectError(cause instanceof Error ? cause.message : String(cause));
      setRedirecting(false);
      startedRef.current = false;
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("app.title")}</h1>
        {redirectError ? (
          <>
            <Alert
              message={t("auth.callbackErrorTitle")}
              description={redirectError}
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
              type="error"
            />
            <AppButton
              className={styles.submit}
              loading={redirecting}
              size="large"
              type="primary"
              onClick={handleSignIn}
            >
              {t("auth.signInButton")}
            </AppButton>
          </>
        ) : deferredToOtherTab ? (
          <>
            <Alert
              message={t("auth.signInOtherTabTitle")}
              description={t("auth.signInOtherTabHint")}
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
              type="info"
            />
            <AppButton
              className={styles.submit}
              loading={redirecting}
              size="large"
              type="primary"
              onClick={handleSignIn}
            >
              {t("auth.signInButton")}
            </AppButton>
          </>
        ) : (
          <>
            <Spin size="large" />
            <p className={styles.subtitle} style={{ marginTop: 16, marginBottom: 0 }}>
              {t("auth.signInSubtitle")}
            </p>
          </>
        )}
        {import.meta.env.DEV ? (
          <button
            className={styles.devToggle}
            type="button"
            onClick={() => setShowDevTokenForm(true)}
          >
            {t("auth.devTokenToggle")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
