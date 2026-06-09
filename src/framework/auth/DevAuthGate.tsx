import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { DevTokenSetupForm } from "@/framework/auth/DevTokenSetupForm";
import {
  hasDevAccessToken,
  seedDevTokensFromEnv,
  shouldUseDevAuth,
} from "@/framework/auth/dev-auth";

export function DevAuthGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(() => !shouldUseDevAuth() || hasDevAccessToken());

  useEffect(() => {
    if (!shouldUseDevAuth()) {
      return;
    }

    seedDevTokensFromEnv();
    setReady(hasDevAccessToken());
  }, []);

  if (!shouldUseDevAuth()) {
    return children;
  }

  if (!ready) {
    return <DevTokenSetupForm onSaved={() => setReady(true)} />;
  }

  return children;
}
