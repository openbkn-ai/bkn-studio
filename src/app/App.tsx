/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useState } from "react";
import { RouterProvider } from "react-router-dom";

import i18n from "@/app/locales/i18n";
import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRouter } from "@/app/router/create-router";
import { AuthGate } from "@/framework/auth/AuthGate";
import { EntitlementProvider } from "@/framework/entitlement/EntitlementProvider";
import {
  persistLocale,
  resolveAuthenticatedStandaloneLocale,
} from "@/framework/i18n/locale";
import { setRuntimeConfig } from "@/framework/runtime/config";
import type { RuntimeConfig, RuntimeUser, SupportedLocale } from "@/framework/runtime/types";

type AppProps = {
  runtimeConfig: RuntimeConfig;
};

export function App({ runtimeConfig }: AppProps) {
  const [config, setConfig] = useState(runtimeConfig);
  const [router] = useState(() => createAppRouter(runtimeConfig.router.basename));

  // After login, hydrate the real user from /me, update context (which rerenders the top bar and
  // permissions), and update global runtimeConfig read by HTTP interceptors and other consumers.
  const handleCurrentUser = useCallback((currentUser: RuntimeUser) => {
    setConfig((previous) => {
      const locale = resolveAuthenticatedStandaloneLocale(
        previous.locale,
        previous.mode,
        previous.router.basename,
      );
      if (locale !== previous.locale) {
        persistLocale(locale);
        void i18n.changeLanguage(locale);
      }
      const next = { ...previous, currentUser, locale };
      setRuntimeConfig(next);
      return next;
    });
  }, []);

  const handleLocaleChange = useCallback(async (locale: SupportedLocale) => {
    persistLocale(locale);
    await i18n.changeLanguage(locale);
    setConfig((previous) => {
      const next = { ...previous, locale };
      setRuntimeConfig(next);
      return next;
    });
  }, []);

  return (
    <AppProviders runtimeConfig={config} updateLocale={handleLocaleChange}>
      <AuthGate onCurrentUser={handleCurrentUser}>
        {/* Entitlements require an authentication token, so load them inside AuthGate. */}
        <EntitlementProvider>
          <RouterProvider router={router} />
        </EntitlementProvider>
      </AuthGate>
    </AppProviders>
  );
}
