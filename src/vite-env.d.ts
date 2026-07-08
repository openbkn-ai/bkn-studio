/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

import type { RuntimeInput } from "@/framework/runtime/types";

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_ACCESS_TOKEN?: string;
  readonly VITE_DEV_AUTH_ORIGIN?: string;
  readonly VITE_DEV_REFRESH_TOKEN?: string;
  readonly VITE_SAFE_PROXY_TARGET?: string;
  readonly VITE_USE_MOCK?: "true" | "false";
  readonly VITE_CAPABILITY_UX_V2?: "true" | "false";
}

declare module "axios" {
  interface AxiosRequestConfig {
    skipErrorToast?: boolean;
  }
}

declare global {
  interface Window {
    __BKN_STUDIO_RUNTIME__?: RuntimeInput;
  }
}

export {};
