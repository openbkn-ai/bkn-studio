import type { PropsWithChildren } from "react";

import { RightOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMatches, useNavigate } from "react-router-dom";

import { getConsoleNavTrail } from "@/app/shell/console-navigation";
import type { AppRouteHandle } from "@/app/shell/route-meta";
import { WorkspaceSlotsContext } from "@/app/shell/workspace-slots-context";

export function WorkspaceLayout({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const matches = useMatches();
  const navigate = useNavigate();
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const consoleMeta = routeHandle?.console;

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ key: string; label: string; path?: string }> = getConsoleNavTrail(
      consoleMeta?.menuKey,
    ).map((item) => ({
      key: item.key,
      label: t(item.labelKey),
      path: item.path,
    }));

    const currentTitle = consoleMeta?.titleKey ? t(consoleMeta.titleKey) : "";
    const lastLabel = items[items.length - 1]?.label;

    if (currentTitle && currentTitle !== lastLabel) {
      items.push({
        key: `${consoleMeta?.menuKey ?? "page"}-current`,
        label: currentTitle,
      });
    }

    return items;
  }, [consoleMeta?.menuKey, consoleMeta?.titleKey, t]);

  const hasHero = breadcrumbItems.length > 0 || Boolean(consoleMeta?.titleKey);

  return (
    <WorkspaceSlotsContext.Provider value={{ toolbarHost }}>
      <div className="workspace-shell">
        {hasHero ? (
          <div className="workspace-hero">
            <div className="workspace-hero-noise" aria-hidden />
            <div className="workspace-breadcrumbs">
              {breadcrumbItems.map((item, index) => {
                const isLast = index === breadcrumbItems.length - 1;

                return (
                  <div className="workspace-breadcrumb-item" key={item.key}>
                    {item.path && !isLast ? (
                      <button
                        className="workspace-breadcrumb-link"
                        onClick={() => {
                          void navigate(item.path!);
                        }}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span className={isLast ? "is-current" : ""}>{item.label}</span>
                    )}
                    {!isLast ? (
                      <RightOutlined className="workspace-breadcrumb-separator" />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {consoleMeta?.titleKey ? (
              <div className="workspace-header">
                <div className="workspace-header-copy">
                  <h2 className="workspace-title">{t(consoleMeta.titleKey)}</h2>
                  {consoleMeta.descriptionKey ? (
                    <p className="workspace-description">{t(consoleMeta.descriptionKey)}</p>
                  ) : null}
                </div>
                <div className="workspace-header-aside">{t("shell.headerAside")}</div>
              </div>
            ) : null}
            <div className="workspace-toolbar-host" ref={setToolbarHost} />
          </div>
        ) : null}
        <div className={hasHero ? "workspace-content" : "workspace-content is-standalone"}>
          {children}
        </div>
      </div>
    </WorkspaceSlotsContext.Provider>
  );
}
