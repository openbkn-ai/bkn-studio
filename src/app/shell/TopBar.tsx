import {
  DesktopOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import { useTranslation } from "react-i18next";
import { useMatches, useNavigate } from "react-router-dom";

import { getConsoleNavTrail } from "@/app/shell/console-navigation";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { logout } from "@/framework/auth/oauth";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { BuildActivityChip } from "@/modules/data-catalog/components/BuildActivityChip";

export function TopBar() {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const rawTrail = getConsoleNavTrail(routeHandle?.console?.menuKey);
  const trail = [
    ...(routeHandle?.console?.menuKey === "domain-knowledge-network"
      ? [
          {
            label: t("shell.items.globalBusinessKnowledgeNetwork"),
            path: undefined,
          },
        ]
      : []),
    ...rawTrail.map((item) => ({
      label: t(item.labelKey),
      path: item.path,
    })),
  ];

  return (
    <header className="console-topbar">
      <div className="console-brand">
        <div className="console-brand-mark" aria-hidden>
          <span className="console-brand-mark-core" />
          <span className="console-brand-mark-orbit console-brand-mark-orbit-left" />
          <span className="console-brand-mark-orbit console-brand-mark-orbit-right" />
        </div>
        <div className="console-brand-row">
          <strong className="console-brand-title">{t("app.title")}</strong>
          {trail.length > 0 ? (
            <div className="console-brand-path">
              {trail.map((item, index) => (
                <span className="console-brand-path-item" key={`${item.label}-${index}`}>
                  {item.path && index < trail.length - 1 ? (
                    <button
                      className="console-brand-path-link"
                      onClick={() => {
                        void navigate(item.path!);
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className={index === trail.length - 1 ? "is-current" : ""}>
                      {item.label}
                    </span>
                  )}
                  {index < trail.length - 1 ? (
                    <span className="console-brand-path-separator">/</span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="console-topbar-actions">
        <BuildActivityChip />
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
        <Dropdown
          menu={{
            items: [
              {
                danger: true,
                icon: <LogoutOutlined />,
                key: "logout",
                label: t("auth.logout"),
                onClick: () => {
                  logout(runtimeConfig.mode);
                },
              },
            ],
          }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <button className="console-user-pill" type="button">
            <span className="console-user-avatar" aria-hidden>
              <UserOutlined />
            </span>
            <span className="console-user-copy">
              <strong>{runtimeConfig.currentUser.name}</strong>
              {runtimeConfig.currentUser.roles.length > 0 ? (
                <span>{runtimeConfig.currentUser.roles.join("、")}</span>
              ) : null}
            </span>
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
