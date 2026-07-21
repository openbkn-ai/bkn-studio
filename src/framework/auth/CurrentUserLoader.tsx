/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { anonymousRuntimeUser, fetchCurrentUser } from "@/framework/auth/current-user";
import type { RuntimeUser } from "@/framework/runtime/types";

type CurrentUserLoaderProps = PropsWithChildren<{
  onLoaded: (user: RuntimeUser) => void;
}>;

/**
 * Token 校验通过后、渲染主应用前,拉一次 /me + /me/permissions 填充
 * currentUser(顶栏用户名 + 菜单/按钮权限)。/me 失败不阻塞页面:
 * 退回已有 currentUser,后端仍逐请求 401 兜底。
 */
export function CurrentUserLoader({ children, onLoaded }: CurrentUserLoaderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          onLoaded(user);
        }
      })
      .catch(() => {
        // 401 由 http 拦截器处理。其它错误一律退回 fail-closed 用户(无权限),
        // 绝不沿用调用方的默认 currentUser——那是带全量权限的开发态用户,
        // 沿用它会让普通用户看到全部系统管理入口(#176)。fetchCurrentUser 已
        // allSettled 兜底,这里是二次保险。
        if (!cancelled) {
          onLoaded(anonymousRuntimeUser);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // 仅在挂载时加载一次;刷新 token 后的更新由调用方驱动。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return children;
}
