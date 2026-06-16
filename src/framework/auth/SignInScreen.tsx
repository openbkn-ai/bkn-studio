import { useState } from "react";
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
  const [redirecting, setRedirecting] = useState(false);
  const [showDevTokenForm, setShowDevTokenForm] = useState(false);

  if (showDevTokenForm) {
    return <DevTokenSetupForm onSaved={onDevTokenSaved} />;
  }

  const handleSignIn = () => {
    setRedirecting(true);
    const { hash, pathname, search } = window.location;
    void beginLogin(`${pathname}${search}${hash}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("app.title")}</h1>
        <p className={styles.subtitle}>{t("auth.signInSubtitle")}</p>
        <AppButton
          className={styles.submit}
          loading={redirecting}
          size="large"
          type="primary"
          onClick={handleSignIn}
        >
          {t("auth.signInButton")}
        </AppButton>
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
