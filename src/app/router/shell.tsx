import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";

export function AppShell() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <h1 className="app-header-title">{t("app.title")}</h1>
          <p className="app-header-subtitle">{t("app.subtitle")}</p>
        </div>
        <span className="app-header-mode">
          {runtimeConfig.mode === "standalone"
            ? "standalone"
            : "hosted"}
        </span>
      </header>
      <main className="app-content">
        <AntdProviders runtimeConfig={runtimeConfig}>
          <Outlet />
        </AntdProviders>
      </main>
    </div>
  );
}
