import { useContext } from "react";

import { AppServicesContext } from "@/framework/context/contexts";

export function useAppServices() {
  const context = useContext(AppServicesContext);

  if (!context) {
    throw new Error("useAppServices must be used within AppServicesProvider.");
  }

  return context;
}
