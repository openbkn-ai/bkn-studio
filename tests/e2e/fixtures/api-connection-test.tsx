/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ConfigProvider } from "antd";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import i18n from "@/app/locales/i18n";
import { AppProviders } from "@/app/providers/AppProviders";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import "@/styles/global.css";
import { normalizeSupportedLocale } from "@/framework/i18n/locale";
import { createRuntimeConfig } from "@/framework/runtime/config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { ApiCatalogConnectionTestModal } from "@/modules/data-connect/components/ApiCatalogConnectionTestModal";

// Mount the production modal, translations and styles without executing connection requests.
const runtimeConfig = createRuntimeConfig({
  locale: normalizeSupportedLocale(new URLSearchParams(location.search).get("language")) ?? "zh-CN",
});
await i18n.changeLanguage(runtimeConfig.locale);

function Fixture() {
  const [lastTest, setLastTest] = useState("");
  return (
    <>
      <output aria-label="Last test">{lastTest}</output>
      <ApiCatalogConnectionTestModal
        saved
        catalogId="layout-catalog"
        catalogEnabled
        draftLogin
        savedLogin
        defaultScope="draft"
        canTestDraft
        canTestSaved
        loading={false}
        result={null}
        revision={0}
        onRun={(scope, kind) => setLastTest(`${scope}:${kind}`)}
        onClose={() => undefined}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <AppProviders runtimeConfig={runtimeConfig} updateLocale={async () => {}}>
    <ThemeProvider>
      <AntdProviders runtimeConfig={runtimeConfig}>
        {/* Keep production configuration; disable animation only for stable geometry checks. */}
        <ConfigProvider theme={{ token: { motion: false } }}>
          <Fixture />
        </ConfigProvider>
      </AntdProviders>
    </ThemeProvider>
  </AppProviders>,
);
