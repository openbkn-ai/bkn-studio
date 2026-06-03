import { createContext } from "react";

import type { MessageInstance } from "antd/es/message/interface";
import type { HookAPI } from "antd/es/modal/useModal";

import type { RuntimeConfig } from "@/framework/runtime/types";

export type AppServicesContextValue = {
  message: MessageInstance;
  modal: HookAPI;
  runtimeConfig: RuntimeConfig;
};

export type PendingContextValue = {
  runtimeConfig: RuntimeConfig;
};

export const AppServicesContext =
  createContext<AppServicesContextValue | null>(null);

export const PendingContext = createContext<PendingContextValue | null>(null);

