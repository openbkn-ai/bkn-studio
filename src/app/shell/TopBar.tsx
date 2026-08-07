/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CloudServerOutlined,
  CrownOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMatches, useNavigate, useParams } from "react-router-dom";

import { getConsoleNavTrail } from "@/app/shell/console-navigation";
import openBknLogo from "@/assets/brand/openbkn-logo.png";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { logout } from "@/framework/auth/oauth";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  useEntitlement,
  useEntitlementContext,
} from "@/framework/entitlement/use-entitlement";
import { APP_VERSION } from "@/framework/runtime/app-version";
import { getInstallStatusUrl } from "@/framework/runtime/install-status-url";
import { BuildActivityChip } from "@/modules/data-catalog/components/BuildActivityChip";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";

export function TopBar() {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId?: string }>();
  const runtimeConfig = useRuntimeConfig();
  const entitlement = useEntitlement();
  const { snapshot } = useEntitlementContext();
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const [networkName, setNetworkName] = useState<string | null>(null);
  const isKnowledgeNetworkRoute =
    routeHandle?.console?.menuKey?.startsWith("domain-knowledge-network") ?? false;

  useEffect(() => {
    if (!isKnowledgeNetworkRoute || !networkId) {
      setNetworkName(null);
      return;
    }

    let disposed = false;
    setNetworkName(null);

    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!disposed) {
          setNetworkName(record?.name ?? networkId);
        }
      })
      .catch(() => {
        if (!disposed) {
          setNetworkName(networkId);
        }
      });

    return () => {
      disposed = true;
    };
  }, [isKnowledgeNetworkRoute, networkId]);

  const rawTrail = getConsoleNavTrail(routeHandle?.console?.menuKey);
  const trail = [
    ...rawTrail.map((item) => ({
      label: t(item.labelKey),
      path: item.path,
      title: t(item.labelKey),
    })),
    ...(networkName
      ? [
          {
            label: networkName,
            path: undefined,
            title: networkName,
          },
        ]
      : []),
  ];

  const installStatusUrl = getInstallStatusUrl();
  const canViewInstallStatus =
    runtimeConfig.currentUser.isAdmin && installStatusUrl !== null;
  const userMenuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      {
        disabled: true,
        key: "version",
        label: (
          <span className="console-user-menu-version">
            <strong>
              {t("shell.userMenuProductTitle", {
                product: t("app.title"),
                tagline: t("shell.userMenuTagline"),
              })}
            </strong>
            <span>{t("shell.versionLine", { version: APP_VERSION })}</span>
          </span>
        ),
      },
      { type: "divider" as const },
    ];

    /*
      档位入口。快照没到就不放这一项:先显示「社区版」再跳成「企业版」,比晚半秒出现更糟。
      「升级」尾巴只在无生效授权时出现——已经买了的人不需要天天看见一条广告。
    */
    if (snapshot) {
      items.push({
        icon: <CrownOutlined />,
        key: "subscription",
        label: (
          <span className="console-user-menu-edition">
            <span>{t(`common.entitlement.editions.${entitlement.edition}`)}</span>
            {entitlement.licensed ? null : (
              <span className="console-user-menu-edition-cta">
                {t("common.entitlement.upgrade")}
              </span>
            )}
          </span>
        ),
        onClick: () => {
          void navigate("/system/subscription");
        },
      });
    }

    items.push({
      icon: <UserOutlined />,
      key: "account",
      label: t("shell.items.account"),
      onClick: () => {
        void navigate("/account");
      },
    });

    if (canViewInstallStatus) {
      items.push({
        icon: <CloudServerOutlined />,
        key: "install-status",
        label: t("shell.items.installStatus"),
        onClick: () => {
          window.open(installStatusUrl, "_blank", "noopener,noreferrer");
        },
      });
    }

    items.push(
      { type: "divider" as const },
      {
        danger: true,
        icon: <LogoutOutlined />,
        key: "logout",
        label: t("auth.logout"),
        onClick: () => {
          logout(runtimeConfig.mode);
        },
      },
    );

    return items;
  }, [
    canViewInstallStatus,
    entitlement.edition,
    entitlement.licensed,
    installStatusUrl,
    navigate,
    runtimeConfig.mode,
    snapshot,
    t,
  ]);

  return (
    <header className="console-topbar">
      <div className="console-brand">
        <button
          aria-label={t("shell.items.home")}
          className="console-brand-home"
          onClick={() => {
            void navigate("/home");
          }}
          title={t("shell.items.home")}
          type="button"
        >
          <img className="console-brand-logo" src={openBknLogo} alt={t("app.title")} />
        </button>
        <div className="console-brand-row">
          {trail.length > 0 ? (
            <div className="console-brand-path">
              {trail.map((item, index) => (
                <span
                  className="console-brand-path-item"
                  key={`${item.label}-${index}`}
                  title={item.title}
                >
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
        <Dropdown
          menu={{ items: userMenuItems }}
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
