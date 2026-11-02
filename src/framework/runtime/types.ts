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
  id: string | null;
  /** `/me/permissions`.is_admin — super_admin without literal role `"admin"`. */
  isAdmin: boolean;
  /** Derived from the `*:*` resource wildcard or the controlled super-admin role. */
  isSuperAdmin: boolean;
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
  /**
   * Navigation keys to leave out of the console side navigation and the knowledge-network
   * workspace side navigation, for deployments that do not run the services behind them.
   * Matches `ConsoleNavItem.key` and the workspace entry keys (for example `"bkn-project"`,
   * `"observability"`, `"experience-agent"`, `"functions"`). Workspace extension entries match
   * `<extension id>:<entry id>` and upgrade entries their capability (for example
   * `"graph_explorer"`). Hiding a group hides its children, and a workspace group with nothing
   * left loses its title. Only navigation is affected; routes stay reachable by URL.
   */
  hiddenNavigation?: string[];
  locale?: string;
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
  /** See RuntimeInput.hiddenNavigation. Empty unless the deployment sets it. */
  hiddenNavigation: string[];
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
