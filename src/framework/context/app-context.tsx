/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useContext, useEffect, useMemo } from "react";

import { App as AntdApp } from "antd";

import type { RuntimeConfig } from "@/framework/runtime/types";
import {
  AppServicesContext,
  PendingContext,
} from "@/framework/context/contexts";
import { setRequestErrorHandler } from "@/framework/request/http";

type AppServicesProviderProps = PropsWithChildren<{
  runtimeConfig: RuntimeConfig;
}>;

export function AppServicesProvider({
  children,
  runtimeConfig,
}: AppServicesProviderProps) {
  const pendingValue = useMemo(
    () => ({
      runtimeConfig,
    }),
    [runtimeConfig],
  );

  return (
    <PendingContext.Provider value={pendingValue}>
      {children}
    </PendingContext.Provider>
  );
}

export function AppServicesProviderBridge({ children }: PropsWithChildren) {
  const pending = useContext(PendingContext);
  const { message, modal } = AntdApp.useApp();

  if (!pending) {
    throw new Error("App services pending context is missing.");
  }

  const value = {
    message,
    modal,
    runtimeConfig: pending.runtimeConfig,
  };

  useEffect(() => {
    setRequestErrorHandler((nextMessage) => {
      void message.error(nextMessage);
    });

    return () => {
      setRequestErrorHandler(null);
    };
  }, [message]);

  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
}
