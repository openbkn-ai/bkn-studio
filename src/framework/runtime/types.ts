/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type SupportedLocale = "zh-CN" | "en-US";

export type TokenManager = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure?: () => void;
};

export type RuntimeUser = {
  businessDomainId: string | null;
  id: string | null;
  /** `/me/permissions`.is_admin — super_admin without literal role `"admin"`. */
  isAdmin: boolean;
  name: string | null;
  permissions: string[];
  roles: string[];
};

export type RuntimeInput = {
  apiBaseUrl?: string;
  auth?: {
    tokenManager?: TokenManager;
  };
  currentUser?: Partial<RuntimeUser>;
  features?: {
    capabilityUxV2?: boolean;
    marketCatalog?: boolean;
    executionFactoryLab?: Partial<{
      catalog: boolean;
      function: boolean;
      impex: boolean;
      mcp_sse_wizard: boolean;
      skill_files: boolean;
      hide_legacy_execution_factory_menu: boolean;
    }>;
  };
  locale?: SupportedLocale;
  mode?: "hosted" | "standalone";
  router?: {
    basename?: string;
  };
  theme?: {
    borderRadius?: number;
    primaryColor?: string;
  };
};

export type RuntimeConfig = {
  apiBaseUrl: string;
  auth: {
    tokenManager: TokenManager;
  };
  currentUser: RuntimeUser;
  features?: {
    capabilityUxV2?: boolean;
    marketCatalog?: boolean;
    executionFactoryLab?: Partial<{
      catalog: boolean;
      function: boolean;
      impex: boolean;
      mcp_sse_wizard: boolean;
      skill_files: boolean;
      hide_legacy_execution_factory_menu: boolean;
    }>;
  };
  locale: SupportedLocale;
  mode: "hosted" | "standalone";
  router: {
    basename: string;
  };
  theme: {
    borderRadius: number;
    primaryColor: string;
  };
};
