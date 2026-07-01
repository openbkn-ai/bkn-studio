/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";

import { AppServicesProvider } from "@/framework/context/app-context";
import type { RuntimeConfig } from "@/framework/runtime/types";

type AppProvidersProps = PropsWithChildren<{
  runtimeConfig: RuntimeConfig;
}>;

export function AppProviders({
  children,
  runtimeConfig,
}: AppProvidersProps) {
  return (
    <AppServicesProvider runtimeConfig={runtimeConfig}>
      {children}
    </AppServicesProvider>
  );
}
