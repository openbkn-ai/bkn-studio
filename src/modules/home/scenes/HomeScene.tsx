/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { useConsoleNavigation } from "@/app/shell/navigation/use-console-navigation";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { HomeQuickActions } from "@/modules/home/components/HomeQuickActions";
import { HomeRecentList } from "@/modules/home/components/HomeRecentList";
import { useRecentVisits } from "@/modules/home/hooks/use-recent-visits";

import styles from "./HomeScene.module.css";

/**
 * 快捷入口只挑选常用的几个叶子菜单,顺序按这里的排列固定;
 * 无权限或被特性开关隐藏的项会随导航一起消失,不需要在这里再维护一份权限表。
 */
const QUICK_ACTION_KEYS = [
  "domain-knowledge-network-management",
  "data-connection",
  "execution-unit-management",
  "index-builds",
];

function collectLeafItems(items: ConsoleNavItem[]): ConsoleNavItem[] {
  return items.flatMap((item) =>
    item.children?.length ? collectLeafItems(item.children) : [item],
  );
}

function greetingKey(hour: number) {
  if (hour < 12) {
    return "home.greeting.morning";
  }

  if (hour < 18) {
    return "home.greeting.afternoon";
  }

  return "home.greeting.evening";
}

export function HomeScene() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();
  const navigation = useConsoleNavigation();
  const { forget, visits } = useRecentVisits();

  const quickActions = useMemo(() => {
    const byKey = new Map(
      collectLeafItems(navigation)
        .filter((item) => item.path && !item.disabled)
        .map((item) => [item.key, item]),
    );

    return QUICK_ACTION_KEYS.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    });
  }, [navigation]);

  const greeting = t(greetingKey(new Date().getHours()), {
    name: runtimeConfig.currentUser.name ?? t("home.title"),
  });

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <h1>{greeting}</h1>
        <p>{t("home.description")}</p>
      </header>
      <div className={styles.body}>
        <HomeQuickActions items={quickActions} />
        <HomeRecentList onForget={forget} visits={visits} />
      </div>
    </section>
  );
}
