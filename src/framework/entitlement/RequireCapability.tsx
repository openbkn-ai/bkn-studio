/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Result, Skeleton } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  useCapability,
  useEntitlementContext,
} from "@/framework/entitlement/use-entitlement";

type RequireCapabilityProps = {
  capability: string;
  children: ReactNode;
  /** 覆盖「装了没买」时的整页引导。 */
  upgradeFallback?: ReactNode;
};

/**
 * 整页付费能力的路由守卫。与 RequirePermission 同形:不满足时不渲染 children,被守卫的
 * 页面因此不会 mount,也就不会打出一串注定失败的请求。
 *
 * **三种不可用渲染三种结果**,因为客户的处置完全不同:
 *
 *   没装      → 404。这个镜像里就是没有这个页面,与服务端逐字节伪装成不存在同义。
 *   装了没买  → 升级引导 + 去版本与订阅页。唯一能靠买证书解决的状态。
 *   未知      → 加载中给骨架;拉取失败给错误页,不给 404——把一次网络抖动说成「页面不
 *               存在」会让人去查路由配置。
 */
export function RequireCapability({
  capability,
  children,
  upgradeFallback,
}: RequireCapabilityProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading } = useEntitlementContext();
  const state = useCapability(capability);

  if (state === "available") {
    return <>{children}</>;
  }

  if (state === "unknown") {
    return loading ? (
      <Skeleton active paragraph={{ rows: 6 }} />
    ) : (
      <Result
        status="warning"
        subTitle={t("common.entitlement.unknownDescription")}
        title={t("common.entitlement.unknownTitle")}
      />
    );
  }

  if (state === "not-licensed") {
    return (
      <>
        {upgradeFallback ?? (
          <Result
            extra={
              <Button
                onClick={() => {
                  void navigate("/system/subscription");
                }}
                type="primary"
              >
                {t("subscription.title")}
              </Button>
            }
            status="info"
            subTitle={t("common.entitlement.notLicensedDescription")}
            title={t("common.entitlement.notLicensedTitle")}
          />
        )}
      </>
    );
  }

  // not-installed:这套镜像没有这段代码,买证书也变不出来。按「页面不存在」处理,与
  // 服务端对同一能力的应答保持同义。
  return (
    <Result
      status="404"
      subTitle={t("common.notFoundDescription")}
      title={t("common.pageNotFound")}
    />
  );
}
