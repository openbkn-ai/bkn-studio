/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";

import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { App as AntdApp, ConfigProvider } from "antd";

import { createThemeConfig } from "@/app/theme/theme";
import { AppServicesProviderBridge } from "@/framework/context/app-context";
import type { RuntimeConfig } from "@/framework/runtime/types";

const antdLocaleMap = {
  "en-US": enUS,
  "zh-CN": zhCN,
} as const;

type AntdProvidersProps = PropsWithChildren<{
  runtimeConfig: RuntimeConfig;
}>;

export function AntdProviders({
  children,
  runtimeConfig,
}: AntdProvidersProps) {
  return (
    <ConfigProvider
      locale={antdLocaleMap[runtimeConfig.locale]}
      theme={createThemeConfig(runtimeConfig)}
    >
      <AntdApp>
        <AppServicesProviderBridge>{children}</AppServicesProviderBridge>
      </AntdApp>
    </ConfigProvider>
  );
}

