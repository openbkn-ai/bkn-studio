import { DesktopOutlined, ThunderboltOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";

export function TopBar() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();

  return (
    <header className="console-topbar">
      <div className="console-brand">
        <div className="console-brand-mark" aria-hidden>
          <span className="console-brand-mark-core" />
          <span className="console-brand-mark-orbit console-brand-mark-orbit-left" />
          <span className="console-brand-mark-orbit console-brand-mark-orbit-right" />
        </div>
        <div className="console-brand-copy">
          <strong className="console-brand-title">{t("app.title")}</strong>
          <span className="console-brand-subtitle">{t("shell.productTagline")}</span>
        </div>
      </div>

      <div className="console-topbar-actions">
        <div className="console-topbar-chip">
          <DesktopOutlined />
          <span>{t("shell.workspace")}</span>
        </div>
        <div className="console-topbar-chip console-topbar-chip-accent">
          <ThunderboltOutlined />
          <span>
            {runtimeConfig.mode === "standalone"
              ? t("shell.modeStandalone")
              : t("shell.modeHosted")}
          </span>
        </div>
        <button className="console-user-pill" type="button">
          <span className="console-user-avatar" aria-hidden>
            <UserOutlined />
          </span>
          <span className="console-user-copy">
            <strong>{runtimeConfig.currentUser.name}</strong>
            <span>{runtimeConfig.currentUser.id}</span>
          </span>
        </button>
      </div>
    </header>
  );
}
