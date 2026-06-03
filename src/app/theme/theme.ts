import type { ThemeConfig } from "antd";

import type { RuntimeConfig } from "@/framework/runtime/types";

export function createThemeConfig(runtimeConfig: RuntimeConfig): ThemeConfig {
  return {
    token: {
      colorPrimary: runtimeConfig.theme.primaryColor,
      borderRadius: runtimeConfig.theme.borderRadius,
      colorBgLayout: "#f4f7f8",
      colorBgContainer: "#ffffff",
    },
  };
}

