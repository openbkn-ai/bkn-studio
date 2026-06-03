import { useContext } from "react";

import { PendingContext } from "@/framework/context/contexts";

export function useRuntimeConfig() {
  const context = useContext(PendingContext);

  if (!context) {
    throw new Error("useRuntimeConfig must be used within AppServicesProvider.");
  }

  return context.runtimeConfig;
}

