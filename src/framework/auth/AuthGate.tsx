import type { PropsWithChildren } from "react";
import { useState } from "react";

import { hasDevAccessToken, seedDevTokensFromEnv } from "@/framework/auth/dev-auth";
import { isOAuthCallbackPath, shouldUseOAuthGate } from "@/framework/auth/oauth";
import { OAuthCallback } from "@/framework/auth/OAuthCallback";
import { SignInScreen } from "@/framework/auth/SignInScreen";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";

export function AuthGate({ children }: PropsWithChildren) {
  const runtimeConfig = useRuntimeConfig();
  // Dev remote-debug mode can still seed tokens from .env.local (no-op otherwise).
  const [, forceRender] = useState(() => {
    seedDevTokensFromEnv();
    return 0;
  });

  if (!shouldUseOAuthGate(runtimeConfig.mode)) {
    return children;
  }

  if (isOAuthCallbackPath()) {
    return <OAuthCallback />;
  }

  if (hasDevAccessToken()) {
    return children;
  }

  return (
    <SignInScreen onDevTokenSaved={() => forceRender((tick) => tick + 1)} />
  );
}
