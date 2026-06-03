/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

import type { RuntimeInput } from "@/framework/runtime/types";

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MOCK?: "true" | "false";
}

declare global {
  interface Window {
    __BKN_STUDIO_RUNTIME__?: RuntimeInput;
  }
}

export {};
