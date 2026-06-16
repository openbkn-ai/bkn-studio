import { Alert, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DevTokenSetupForm } from "@/framework/auth/DevTokenSetupForm";
import { beginLogin } from "@/framework/auth/oauth";
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
  const [showDevTokenForm, setShowDevTokenForm] = useState(false);

  useEffect(() => {
    if (showDevTokenForm || startedRef.current) {
      return;
    }

    startedRef.current = true;
    const { hash, pathname, search } = window.location;

    beginLogin(`${pathname}${search}${hash}`).catch((cause: unknown) => {
      setRedirectError(cause instanceof Error ? cause.message : String(cause));
      setRedirecting(false);
      startedRef.current = false;
    });
  }, [showDevTokenForm]);

  if (showDevTokenForm) {
    return <DevTokenSetupForm onSaved={onDevTokenSaved} />;
  }

  const handleSignIn = () => {
    setRedirecting(true);
    setRedirectError(null);
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
