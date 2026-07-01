/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useContext } from "react";

import { PendingContext } from "@/framework/context/contexts";

export function useRuntimeConfig() {
  const context = useContext(PendingContext);

  if (!context) {
    throw new Error("useRuntimeConfig must be used within AppServicesProvider.");
  }

  return context.runtimeConfig;
}

