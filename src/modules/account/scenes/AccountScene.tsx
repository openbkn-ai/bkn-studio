/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ProfilePanel } from "@/modules/account/components/ProfilePanel";
import { SecurityPanel } from "@/modules/account/components/SecurityPanel";
import { getMyProfile, type MyProfile } from "@/modules/account/services/profile.service";
import { ApiKeyListScene } from "@/modules/api-keys/scenes/ApiKeyListScene";

import styles from "./AccountScene.module.css";

export type AccountSection = "profile" | "security" | "api-keys";

function sectionKey(section: AccountSection) {
  return section === "api-keys" ? "apiKeys" : section;
}

export function AccountScene({ section }: { section: AccountSection }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSection = sectionKey(section);
  const title = t(`account.sections.${currentSection}.title`);
  const description = t(`account.sections.${currentSection}.description`);

  const renderSection = () => {
    if (section === "api-keys") {
      return <ApiKeyListScene embedded />;
    }

    if (profileLoading) {
      return (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      );
    }

    if (section === "security") {
      return <SecurityPanel account={profile?.account ?? ""} />;
    }

    return profile ? <ProfilePanel profile={profile} onSaved={setProfile} /> : null;
  };

  return (
    <section className={styles.page}>
      <header className={styles.contentHeader}>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className={styles.contentBody}>{renderSection()}</div>
    </section>
  );
}
