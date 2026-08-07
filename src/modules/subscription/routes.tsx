/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import type { AppRouteContribution } from "@/app/router/types";

const SubscriptionPage = lazy(async () => {
  const module = await import("@/modules/subscription/pages/SubscriptionPage");
  return { default: module.SubscriptionPage };
});

/**
 * 不设权限守卫。这页只暴露集群档位——`/safe/v1/capabilities` 本身就是只认证不鉴权的,
 * 任何登录用户都读得到——而它是产品里唯一说明「买了什么、还能买什么」的地方。挡在
 * `admin-license:view` 后面等于只给管理员看这份说明,普通用户碰到锁定入口时无处可去。
 */
export const subscriptionRoutes: RouteObject[] = [
  {
    path: "system/subscription",
    handle: {
      console: {
        descriptionKey: "subscription.subtitle",
        menuKey: "subscription",
        titleKey: "subscription.title",
      },
    },
    element: (
      <Suspense fallback={<RouteLoading />}>
        <SubscriptionPage />
      </Suspense>
    ),
  },
];

export const subscriptionRouteContribution: AppRouteContribution = {
  moduleId: "subscription",
  routes: subscriptionRoutes,
};
