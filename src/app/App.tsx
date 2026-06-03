import { useState } from "react";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRouter } from "@/app/router/create-router";
import type { RuntimeConfig } from "@/framework/runtime/types";

type AppProps = {
  runtimeConfig: RuntimeConfig;
};

export function App({ runtimeConfig }: AppProps) {
  const [router] = useState(() =>
    createAppRouter(runtimeConfig.router.basename),
  );

  return (
    <AppProviders runtimeConfig={runtimeConfig}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

