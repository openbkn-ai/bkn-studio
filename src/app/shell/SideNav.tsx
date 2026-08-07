/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined, LeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatches, useNavigate } from "react-router-dom";

import {
  consoleNavigation,
  findConsoleNavItemByPath,
} from "@/app/shell/console-navigation";
import { useConsoleNavigation } from "@/app/shell/navigation/use-console-navigation";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { accountSideNavigation } from "@/modules/account/navigation";

type SelectedItem = {
  key: string;
  parentKey?: string;
};

type SideNavProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function SideNav({ collapsed, onToggleCollapsed }: SideNavProps) {
  const { t } = useTranslation();
  const consoleNavigationItems = useConsoleNavigation();
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const routeMenuKey = routeHandle?.console?.menuKey;
  const isAccountRoute = location.pathname.startsWith("/account");

  const navigationItems = useMemo(
    () => (isAccountRoute ? accountSideNavigation : consoleNavigationItems),
    [consoleNavigationItems, isAccountRoute],
  );

  const selectedItem = useMemo(
    () =>
      isAccountRoute
        ? findSelectedAccountItem(location.pathname)
        : findSelectedItem(routeMenuKey, location.pathname),
    [isAccountRoute, location.pathname, routeMenuKey],
  );

  const [expandedKeys, setExpandedKeys] = useState<string[]>(() =>
    selectedItem?.parentKey ? [selectedItem.parentKey] : [],
  );

  useEffect(() => {
    if (!selectedItem?.parentKey) {
      return;
    }

    setExpandedKeys((current) =>
      current.includes(selectedItem.parentKey!)
        ? current
        : [...current, selectedItem.parentKey!],
    );
  }, [selectedItem?.parentKey]);

  const toggleExpanded = (itemKey: string) => {
    setExpandedKeys((current) =>
      current.includes(itemKey)
        ? current.filter((key) => key !== itemKey)
        : [...current, itemKey],
    );
  };

  return (
    <aside className={collapsed ? "console-sidenav is-collapsed" : "console-sidenav"}>
      <div className="console-sidenav-scroll">
        {isAccountRoute ? (
          <>
            <button
              className="console-sidenav-return"
              onClick={() => void navigate("/home")}
              title={t("account.navigation.backToWorkspace")}
              type="button"
            >
              <span className="console-sidenav-icon" aria-hidden>
                <LeftOutlined />
              </span>
              {!collapsed ? (
                <span className="console-sidenav-label">{t("account.navigation.backToWorkspace")}</span>
              ) : null}
            </button>
          </>
        ) : null}
        <ul className="console-sidenav-list">
          {navigationItems.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isExpanded = expandedKeys.includes(item.key);
            const isSelected = selectedItem?.key === item.key;
            const hasSelectedChild = selectedItem?.parentKey === item.key;

            if (!hasChildren) {
              return (
                <li key={item.key} className="console-sidenav-item">
                  <button
                    className={[
                      "console-sidenav-link",
                      isSelected ? "is-active" : "",
                      item.disabled ? "is-disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.path) {
                        void navigate(item.path);
                      }
                    }}
                    title={t(item.labelKey)}
                    type="button"
                  >
                    <span className="console-sidenav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    {!collapsed ? (
                      <>
                        <span className="console-sidenav-label">{t(item.labelKey)}</span>
                        {item.lockedEdition ?? item.paidEdition ? (
                          <span className="console-sidenav-tier">
                            {t(
                              `common.entitlement.editionsShort.${item.lockedEdition ?? item.paidEdition}`,
                            )}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </button>
                </li>
              );
            }

            return (
              <li key={item.key} className="console-sidenav-item">
                <button
                  className={[
                    "console-sidenav-link",
                    isSelected ? "is-active" : "",
                    hasSelectedChild ? "is-parent-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (collapsed) {
                      onToggleCollapsed();
                      setExpandedKeys((current) =>
                        current.includes(item.key) ? current : [...current, item.key],
                      );
                      return;
                    }

                    toggleExpanded(item.key);
                  }}
                  title={t(item.labelKey)}
                  type="button"
                >
                  <span className="console-sidenav-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {!collapsed ? (
                    <>
                      <>
                        <span className="console-sidenav-label">{t(item.labelKey)}</span>
                        {item.lockedEdition ?? item.paidEdition ? (
                          <span className="console-sidenav-tier">
                            {t(
                              `common.entitlement.editionsShort.${item.lockedEdition ?? item.paidEdition}`,
                            )}
                          </span>
                        ) : null}
                      </>
                      <span
                        className={[
                          "console-sidenav-caret",
                          isExpanded ? "is-open" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-hidden
                      >
                        <DownOutlined />
                      </span>
                    </>
                  ) : null}
                </button>
                {!collapsed && isExpanded ? (
                  <ul className="console-sidenav-sublist">
                    {item.children!.map((child) => (
                      <li key={child.key} className="console-sidenav-item">
                        <button
                          className={[
                            "console-sidenav-link",
                            "is-child",
                            selectedItem?.key === child.key ? "is-active" : "",
                            child.disabled ? "is-disabled" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={child.disabled}
                          onClick={() => {
                            if (child.path) {
                              void navigate(child.path);
                            }
                          }}
                          title={t(child.labelKey)}
                          type="button"
                        >
                          <span className="console-sidenav-icon" aria-hidden>
                            {child.icon}
                          </span>
                          {!collapsed ? (
                            <>
                              <span className="console-sidenav-label">
                                {t(child.labelKey)}
                              </span>
                              {child.lockedEdition ?? child.paidEdition ? (
                                <span className="console-sidenav-tier">
                                  {t(
                                    `common.entitlement.editionsShort.${child.lockedEdition ?? child.paidEdition}`,
                                  )}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="console-sidenav-footer">
        <button
          aria-label={collapsed ? t("shell.expandSidenav") : t("shell.collapseSidenav")}
          className="console-sidenav-toggle"
          onClick={onToggleCollapsed}
          type="button"
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>
    </aside>
  );
}

function findSelectedAccountItem(pathname: string): SelectedItem | undefined {
  const matched = accountSideNavigation
    .filter((item) => item.path && pathname.startsWith(item.path))
    .sort((left, right) => (right.path?.length ?? 0) - (left.path?.length ?? 0))[0];

  return matched ? { key: matched.key } : undefined;
}

function findSelectedItem(menuKey: string | undefined, pathname: string): SelectedItem | undefined {
  for (const item of consoleNavigation) {
    if (item.key === menuKey) {
      return { key: item.key };
    }

    const child = item.children?.find((candidate) => candidate.key === menuKey);

    if (child) {
      return { key: child.key, parentKey: item.key };
    }
  }

  const matched = findConsoleNavItemByPath(pathname);

  if (!matched) {
    return undefined;
  }

  for (const item of consoleNavigation) {
    if (item.key === matched.key) {
      return { key: matched.key };
    }

    if (item.children?.some((candidate) => candidate.key === matched.key)) {
      return { key: matched.key, parentKey: item.key };
    }
  }

  return { key: matched.key };
}
