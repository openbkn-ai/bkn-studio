import { ClockCircleOutlined } from "@ant-design/icons";
import { Tabs } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiKeyListScene } from "@/modules/api-keys/scenes/ApiKeyListScene";
import { getMyProfile, type MyProfile } from "@/modules/account/services/profile.service";

import styles from "./AccountScene.module.css";

function initials(name: string): string {
  const value = (name || "").trim();
  if (!value) return "U";
  if (/[一-龥]/.test(value)) return value.slice(-2);
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

/** 资料 / 安全 Tab 暂以占位呈现，真实可写实现见 OPE-25。 */
function ComingSoon({ text }: { text: string }) {
  return (
    <div className={styles.soon}>
      <ClockCircleOutlined className={styles.soonIcon} />
      <p>{text}</p>
      <span className={styles.soonRef}>OPE-25</span>
    </div>
  );
}

export function AccountScene() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MyProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.avatar}>{initials(profile?.name ?? "")}</span>
        <div className={styles.heroText}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{profile?.name ?? "—"}</h1>
            {(profile?.roles ?? []).map((role) => (
              <span key={role} className={styles.roleTag}>
                {role}
              </span>
            ))}
          </div>
          <div className={styles.sub}>
            <span className={styles.loginChip}>{profile?.account ?? "—"}</span>
            {profile?.email ? (
              <>
                <span className={styles.dot} />
                <span>{profile.email}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs
        className={styles.tabs}
        defaultActiveKey="keys"
        items={[
          {
            key: "profile",
            label: t("account.tabs.profile"),
            children: <ComingSoon text={t("account.profileSoon")} />,
          },
          {
            key: "security",
            label: t("account.tabs.security"),
            children: <ComingSoon text={t("account.securitySoon")} />,
          },
          {
            key: "keys",
            label: t("account.tabs.keys"),
            children: <ApiKeyListScene embedded />,
          },
        ]}
      />
    </section>
  );
}
