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
