/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Result } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { Edition } from "@/framework/entitlement/edition";
import {
  useEditionGate,
  useEntitlement,
} from "@/framework/entitlement/use-entitlement";

type RequireEditionProps = {
  children: ReactNode;
  fallback?: ReactNode;
  minEdition: Edition;
};

/**
 * 路由级档位守卫。档位不够时不渲染 children——被守的页面不 mount,也就不会发出
 * 一串必然被服务端拒掉的请求(同 RequirePermission 的理由)。
 *
 * 强制力不在这里。服务端每个受控调用点自己判档位;这里只是别让用户走进一个
 * 满屏报错的页面。
 */
export function RequireEdition({
  children,
  fallback,
  minEdition,
}: RequireEditionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const { allowed, locked } = useEditionGate(minEdition);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // 社区镜像:菜单里本就不该有这一项(SideNav 已隐藏),直接输入 URL 才会到这里。
  // 付费实现不在这个二进制里,给升级引导等于指一条走不通的路,按 404 处理。
  if (!locked) {
    return (
      <Result
        status="404"
        subTitle={t("common.notFoundDescription")}
        title={t("common.pageNotFound")}
      />
    );
  }

  return (
    <Result
      extra={
        <Button onClick={() => void navigate("/system/license")} type="primary">
          {t("common.entitlement.viewLicense")}
        </Button>
      }
      status="403"
      subTitle={t("common.entitlement.lockedDescription", {
        current: t(`common.entitlement.editions.${entitlement.edition}`),
      })}
      title={t("common.entitlement.lockedTitle", {
        edition: t(`common.entitlement.editions.${minEdition}`),
      })}
    />
  );
}
