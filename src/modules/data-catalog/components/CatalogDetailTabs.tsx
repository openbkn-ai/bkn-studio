/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Tabs } from "antd";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { capabilityState } from "@/framework/entitlement/capability-state";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { RequireCapability } from "@/framework/entitlement/RequireCapability";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import {
  extensionCatalogDetailTabs,
  type ResolvedCatalogDetailTab,
} from "@/framework/extension/registry";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";
import type { CatalogRecord } from "@/shared/catalog/types";

type CatalogDetailTabsProps = {
  catalog: CatalogRecord;
  /** The built-in resource list, shown alone when no extension tab applies. */
  resources: ReactNode;
};

/**
 * The data-catalog detail: the built-in resource list plus the tabs installed extensions add for
 * this catalog. Without a matching tab the resource list renders exactly as before, with no tab
 * bar. A tab whose capability this image does not carry is left out; one the licence does not
 * cover keeps its tab, with an edition badge, and shows the upgrade card in place of its content.
 */
export function CatalogDetailTabs({ catalog, resources }: CatalogDetailTabsProps) {
  const { t } = useTranslation();
  const { snapshot } = useEntitlementContext();
  const tabs = extensionCatalogDetailTabs(catalog).filter(
    (tab) => capabilityState(tab.capability, snapshot) !== "not-installed",
  );

  if (tabs.length === 0) {
    return <>{resources}</>;
  }

  return (
    <Tabs
      destroyOnHidden
      items={[
        {
          key: "resources",
          label: t("dataCatalog.catalogDetail.resourcesTab"),
          children: resources,
        },
        ...tabs.map((tab) => ({
          key: tab.key,
          label: <CatalogDetailTabLabel tab={tab} />,
          children: (
            // Keyed by catalog as well, so a failure in one catalog does not stick when another is selected.
            <CatalogDetailTabBoundary
              fallback={
                <Alert message={t("dataCatalog.catalogDetail.tabFailed")} showIcon type="error" />
              }
              key={`${catalog.id}:${tab.key}`}
              tabKey={tab.key}
            >
              <GatedCatalogDetailTab catalog={catalog} tab={tab} />
            </CatalogDetailTabBoundary>
          ),
        })),
      ]}
    />
  );
}

function CatalogDetailTabLabel({ tab }: { tab: ResolvedCatalogDetailTab }) {
  const { t } = useTranslation();
  const minEdition = capabilityMinEdition(tab.capability);
  return (
    <span>
      {t(tab.labelKey)}
      {minEdition ? <EditionBadge capability={tab.capability} edition={minEdition} /> : null}
    </span>
  );
}

/** Same gate as extension routes: the edition upgrade card when the catalog knows the capability. */
function GatedCatalogDetailTab({
  catalog,
  tab,
}: {
  catalog: CatalogRecord;
  tab: ResolvedCatalogDetailTab;
}) {
  const minEdition = capabilityMinEdition(tab.capability);
  const content = <CatalogDetailTabContent catalog={catalog} tab={tab} />;
  return minEdition ? (
    <RequireEdition capability={tab.capability} minEdition={minEdition} mountLockedContent={false}>
      {content}
    </RequireEdition>
  ) : (
    <RequireCapability capability={tab.capability}>{content}</RequireCapability>
  );
}

/** Calls the extension's render inside the boundary, so a throwing render is caught too. */
function CatalogDetailTabContent({
  catalog,
  tab,
}: {
  catalog: CatalogRecord;
  tab: ResolvedCatalogDetailTab;
}) {
  return <>{tab.render(catalog)}</>;
}

type CatalogDetailTabBoundaryProps = { children: ReactNode; fallback: ReactNode; tabKey: string };

/** Keeps a failing extension tab from taking the whole catalog detail down. */
class CatalogDetailTabBoundary extends Component<
  CatalogDetailTabBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Catalog detail tab "${this.props.tabKey}" failed to render`, error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
