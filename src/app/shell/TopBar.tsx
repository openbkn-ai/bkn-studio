/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMatches, useNavigate, useParams } from "react-router-dom";

import { getConsoleNavTrail } from "@/app/shell/console-navigation";
import openBknLogo from "@/assets/brand/openbkn-logo.png";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { logout } from "@/framework/auth/oauth";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { BuildActivityChip } from "@/modules/data-catalog/components/BuildActivityChip";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";

export function TopBar() {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId?: string }>();
  const runtimeConfig = useRuntimeConfig();
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const [networkName, setNetworkName] = useState<string | null>(null);
  const isKnowledgeNetworkRoute =
    routeHandle?.console?.menuKey === "domain-knowledge-network";

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

  return (
    <header className="console-topbar">
      <div className="console-brand">
        <img className="console-brand-logo" src={openBknLogo} alt={t("app.title")} />
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
          menu={{
            items: [
              {
                icon: <UserOutlined />,
                key: "account",
                label: t("shell.items.account"),
                onClick: () => {
                  void navigate("/account");
                },
              },
              { type: "divider" },
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
