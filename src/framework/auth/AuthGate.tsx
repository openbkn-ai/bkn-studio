/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useState } from "react";

import { CurrentUserLoader } from "@/framework/auth/CurrentUserLoader";
import { hasDevAccessToken, seedDevTokensFromEnv } from "@/framework/auth/dev-auth";
import { isOAuthCallbackPath, shouldUseOAuthGate } from "@/framework/auth/oauth";
import { OAuthCallback } from "@/framework/auth/OAuthCallback";
import { SignInScreen } from "@/framework/auth/SignInScreen";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import type { RuntimeUser } from "@/framework/runtime/types";

type AuthGateProps = PropsWithChildren<{
  onCurrentUser: (user: RuntimeUser) => void;
}>;

export function AuthGate({ children, onCurrentUser }: AuthGateProps) {
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
    return <CurrentUserLoader onLoaded={onCurrentUser}>{children}</CurrentUserLoader>;
  }

  return (
    <SignInScreen onDevTokenSaved={() => forceRender((tick) => tick + 1)} />
  );
}
