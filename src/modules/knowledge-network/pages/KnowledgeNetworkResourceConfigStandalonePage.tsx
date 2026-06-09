import { DownOutlined, HomeOutlined, UserOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";

type KnowledgeNetworkResourceConfigStandalonePageProps = {
  children: ReactNode;
  immersive?: boolean;
};

export function KnowledgeNetworkResourceConfigStandalonePage({
  children,
  immersive = false,
}: KnowledgeNetworkResourceConfigStandalonePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();

  return (
    <div
      className={
        immersive
          ? "knowledge-workspace-shell knowledge-workspace-shell-immersive"
          : "knowledge-workspace-shell"
      }
    >
      {immersive ? null : (
        <header className="knowledge-workspace-topbar">
          <div className="knowledge-workspace-brand">
            <div className="console-brand-mark" aria-hidden>
              <span className="console-brand-mark-core" />
              <span className="console-brand-mark-orbit console-brand-mark-orbit-left" />
              <span className="console-brand-mark-orbit console-brand-mark-orbit-right" />
            </div>
            <strong className="knowledge-workspace-brand-title">{t("app.title")}</strong>
            <nav className="knowledge-workspace-breadcrumb" aria-label="breadcrumb">
              <HomeOutlined className="knowledge-workspace-breadcrumb-home" />
              <span className="knowledge-workspace-breadcrumb-separator">/</span>
              <button
                className="knowledge-workspace-breadcrumb-link"
                onClick={() => {
                  void navigate("/knowledge-network");
                }}
                type="button"
              >
                {t("shell.items.globalBusinessKnowledgeNetwork")}
              </button>
              <span className="knowledge-workspace-breadcrumb-separator">/</span>
              <span className="knowledge-workspace-breadcrumb-current">
                {t("shell.items.domainKnowledgeNetwork")}
              </span>
            </nav>
          </div>

          <button className="knowledge-workspace-user" type="button">
            <span className="knowledge-workspace-user-avatar" aria-hidden>
              <UserOutlined />
            </span>
            <span className="knowledge-workspace-user-name">
              {runtimeConfig.currentUser.name}
            </span>
            <DownOutlined className="knowledge-workspace-user-caret" />
          </button>
        </header>
      )}

      <main className="knowledge-workspace-main">
        <AntdProviders runtimeConfig={runtimeConfig}>
          <div className="knowledge-workspace-scene-host">{children}</div>
        </AntdProviders>
      </main>
    </div>
  );
}
