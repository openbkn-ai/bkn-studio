import { DownOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatches, useNavigate } from "react-router-dom";

import {
  consoleNavigation,
  findConsoleNavItemByPath,
} from "@/app/shell/console-navigation";
import type { AppRouteHandle } from "@/app/shell/route-meta";

type SelectedItem = {
  key: string;
  parentKey?: string;
};

export function SideNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const routeMenuKey = routeHandle?.console?.menuKey;

  const selectedItem = useMemo(
    () => findSelectedItem(routeMenuKey, location.pathname),
    [location.pathname, routeMenuKey],
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
    <aside className="console-sidenav">
      <div className="console-sidenav-scroll">
        <ul className="console-sidenav-list">
          {consoleNavigation.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isExpanded = expandedKeys.includes(item.key);
            const isSelected = selectedItem?.key === item.key;

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
                    type="button"
                  >
                    <span className="console-sidenav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="console-sidenav-label">{t(item.labelKey)}</span>
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
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleExpanded(item.key)}
                  type="button"
                >
                  <span className="console-sidenav-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="console-sidenav-label">{t(item.labelKey)}</span>
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
                </button>
                {isExpanded ? (
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
                          type="button"
                        >
                          <span className="console-sidenav-icon" aria-hidden>
                            {child.icon}
                          </span>
                          <span className="console-sidenav-label">
                            {t(child.labelKey)}
                          </span>
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
    </aside>
  );
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
