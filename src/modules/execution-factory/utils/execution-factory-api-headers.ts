/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";


export function getExecutionFactoryApiHeaders() {
  const runtime = getRuntimeConfig();
  const headers: Record<string, string> = {
  };

  if (runtime.currentUser.id) {
    headers.user_id = runtime.currentUser.id;
  }

  return headers;
}
