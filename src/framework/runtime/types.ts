export type SupportedLocale = "zh-CN" | "en-US";

export type TokenManager = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure?: () => void;
};

export type RuntimeUser = {
  businessDomainId: string | null;
  id: string | null;
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
