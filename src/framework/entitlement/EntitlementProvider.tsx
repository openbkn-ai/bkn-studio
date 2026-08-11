/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { fetchEntitlement } from "@/framework/entitlement/entitlement.service";
import type { Entitlement } from "@/framework/entitlement/types";

/**
 * 拉一次集群授权状态并提供给全树。
 *
 * 拉一次而不是每次用的时候拉:它是集群属性,只在导入/吊销证书时变,与路由和用户都无关。
 * 每个 Gate 各拉一次会在首屏打出几十个相同请求。
 *
 * **必须挂在 AuthGate 之内**:接口 token-gated(RequireUser),而 AuthGate 在拿到令牌前
 * 根本不渲染 children。挂在它外面会在未登录时打出一个必然 401 的请求,之后又没有第二次
 * 触发点——快照会一直停在 null,付费入口永久消失。
 *
 * **不阻塞首屏。** 社区部署是多数,它们等这个请求毫无意义;而企业部署里付费入口晚半秒
 * 出现,远好过整个控制台白屏等一个可能超时的请求。加载期间 snapshot 为 null,下游按
 * 「未知」处理——不可用,但也不出升级引导。
 */
export function EntitlementProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  // 卸载后不再 setState。refresh() 可能在页面跳转前后触发,StrictMode 下 effect 还会
  // 跑两遍。
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await fetchEntitlement();
      if (mounted.current) {
        setSnapshot(next);
      }
    } catch {
      // 拿不到就维持「未知」,绝不退化成「全都能用」。bkn-safe 不可达时整个产品都登不
      // 进去,这里不是独立故障面,藏掉付费入口是可以接受的降级。
      if (mounted.current) {
        setSnapshot(null);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
    };
  }, [load]);

  const value = useMemo(
    () => ({ loading, refresh: load, snapshot }),
    [loading, load, snapshot],
  );

  return (
    <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
  );
}
