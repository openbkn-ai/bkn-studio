/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { fetchEntitlement } from "@/framework/entitlement/entitlement.service";
import { FALLBACK_ENTITLEMENT, type Entitlement } from "@/framework/entitlement/types";

/**
 * 登录后拉一次集群授权档位,供导航与页面门禁使用。
 *
 * 必须挂在 AuthGate **之内**:接口是 token-gated 的(RequireUser),没有令牌时拿不到。
 *
 * 不阻塞渲染。授权档位只影响付费入口的显隐,社区能力本来就不受门控——为它多转一圈
 * 全屏 loading 是拿所有用户的启动时间换少数付费入口的一次闪现。首帧按社区版渲染,
 * 拿到结果再补上付费入口。
 */
export function EntitlementProvider({ children }: PropsWithChildren) {
  const [entitlement, setEntitlement] = useState<Entitlement>(FALLBACK_ENTITLEMENT);

  useEffect(() => {
    let cancelled = false;

    void fetchEntitlement().then((next) => {
      if (!cancelled) {
        setEntitlement(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EntitlementContext.Provider value={entitlement}>
      {children}
    </EntitlementContext.Provider>
  );
}
