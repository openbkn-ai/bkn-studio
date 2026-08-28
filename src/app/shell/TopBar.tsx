/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckOutlined,
  CloudServerOutlined,
  GlobalOutlined,
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
import openBknLogo from "@/assets/brand/openbkn-logo-compact.webp";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { logout } from "@/framework/auth/oauth";
import { useRuntimeConfig, useUpdateLocale } from "@/framework/context/use-runtime-config";
import { useEntitlement, useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { APP_VERSION } from "@/framework/runtime/app-version";
import { getInstallStatusUrl } from "@/framework/runtime/install-status-url";
import type { SupportedLocale } from "@/framework/runtime/types";
import { BuildActivityChip } from "@/modules/data-catalog/components/BuildActivityChip";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";

export function TopBar() {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId?: string }>();
  const runtimeConfig = useRuntimeConfig();
  const updateLocale = useUpdateLocale();
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
      Do not render the edition entry until the snapshot arrives, preventing an inaccurate edition
      from flashing before the real one. Show an upgrade CTA while a higher edition exists; only
      the top industry edition has no upgrade path.
    */
    if (snapshot) {
      items.push({
        icon: <CrownOutlined />,
        key: "subscription",
        label: (
          <span className="console-user-menu-edition">
            <span className={`console-user-menu-edition-${entitlement.edition}`}>
              {t(`common.entitlement.editions.${entitlement.edition}`)}
            </span>
            {entitlement.edition === "industry" ? null : (
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
      {
        children: [
          {
            key: "locale:zh-CN",
            label: (
              <span className="console-language-menu-option">
                <span>{t("shell.language.zhCN")}</span>
                {runtimeConfig.locale === "zh-CN" ? <CheckOutlined /> : null}
              </span>
            ),
            onClick: () => {
              void updateLocale("zh-CN" satisfies SupportedLocale);
            },
          },
          {
            key: "locale:en-US",
            label: (
              <span className="console-language-menu-option">
                <span>{t("shell.language.enUS")}</span>
                {runtimeConfig.locale === "en-US" ? <CheckOutlined /> : null}
              </span>
            ),
            onClick: () => {
              void updateLocale("en-US" satisfies SupportedLocale);
            },
          },
        ],
        icon: <GlobalOutlined />,
        key: "language",
        label: t("shell.language.label"),
      },
      { type: "divider" as const },
      {
        danger: true,
        icon: <LogoutOutlined />,
        key: "logout",
        label: t("auth.logout"),
        onClick: () => {
          void logout(runtimeConfig.mode);
        },
      },
    );

    return items;
  }, [
    canViewInstallStatus,
    entitlement.edition,
    installStatusUrl,
    navigate,
    runtimeConfig.locale,
    runtimeConfig.mode,
    snapshot,
    t,
    updateLocale,
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
