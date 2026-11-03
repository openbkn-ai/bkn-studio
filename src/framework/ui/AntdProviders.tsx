/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useLayoutEffect } from "react";

import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { App as AntdApp, ConfigProvider } from "antd";

import { createSemanticColors, semanticColorCssVariables } from "@/app/theme/semantic-colors";
import { useResolvedTheme } from "@/app/theme/theme-context";
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

export function AntdProviders({ children, runtimeConfig }: AntdProvidersProps) {
  const resolvedTheme = useResolvedTheme();

  useLayoutEffect(() => {
    const rootStyle = document.documentElement.style;
    const variables = semanticColorCssVariables(
      createSemanticColors(runtimeConfig.theme.primaryColor, resolvedTheme),
    );
    const previousValues = Object.fromEntries(
      Object.keys(variables).map((name) => [name, rootStyle.getPropertyValue(name)]),
    );

    Object.entries(variables).forEach(([name, value]) => rootStyle.setProperty(name, value));
    return () => {
      Object.entries(previousValues).forEach(([name, value]) => {
        if (value) {
          rootStyle.setProperty(name, value);
        } else {
          rootStyle.removeProperty(name);
        }
      });
    };
  }, [resolvedTheme, runtimeConfig.theme.primaryColor]);

  return (
    <ConfigProvider
      button={{ autoInsertSpace: false }}
      locale={antdLocaleMap[runtimeConfig.locale]}
      theme={createThemeConfig(runtimeConfig, resolvedTheme)}
    >
      <AntdApp>
        <AppServicesProviderBridge>{children}</AppServicesProviderBridge>
      </AntdApp>
    </ConfigProvider>
  );
}
