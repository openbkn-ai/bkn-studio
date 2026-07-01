/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useState } from "react";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRouter } from "@/app/router/create-router";
import { AuthGate } from "@/framework/auth/AuthGate";
import { setRuntimeConfig } from "@/framework/runtime/config";
import type { RuntimeConfig, RuntimeUser } from "@/framework/runtime/types";

type AppProps = {
  runtimeConfig: RuntimeConfig;
};

export function App({ runtimeConfig }: AppProps) {
  const [config, setConfig] = useState(runtimeConfig);
  const [router] = useState(() => createAppRouter(runtimeConfig.router.basename));

  // 登录后 /me 回填真实用户:更新 context(驱动顶栏/权限重渲染)+ 全局
  // runtimeConfig(http 拦截器等读 getRuntimeConfig)。
  const handleCurrentUser = useCallback((currentUser: RuntimeUser) => {
    setConfig((previous) => {
      const next = { ...previous, currentUser };
      setRuntimeConfig(next);
      return next;
    });
  }, []);

  return (
    <AppProviders runtimeConfig={config}>
      <AuthGate onCurrentUser={handleCurrentUser}>
        <RouterProvider router={router} />
      </AuthGate>
    </AppProviders>
  );
}
