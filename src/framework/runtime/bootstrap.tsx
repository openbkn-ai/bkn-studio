/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import i18n from "@/app/locales/i18n";
import { subscribeAuthBroadcast } from "@/framework/auth/token-store";
import { preserveDocumentLanguage } from "@/framework/i18n/locale";
import {
  createRuntimeConfig,
  readWindowRuntimeInput,
  setRuntimeConfig,
} from "@/framework/runtime/config";
import type { RuntimeInput } from "@/framework/runtime/types";

type MountedRoot = {
  releaseDocumentLanguage: () => void;
  root: ReturnType<typeof createRoot>;
};

const roots = new WeakMap<Element, MountedRoot>();

let authBroadcastUnsub: (() => void) | undefined;

function ensureAuthBroadcastListener() {
  if (authBroadcastUnsub) {
    return;
  }
  authBroadcastUnsub = subscribeAuthBroadcast(() => {
    // Another tab cleared cookies; reload so AuthGate drops to sign-in.
    window.location.reload();
  });
}

export function mountApp(container: Element, runtimeInput: RuntimeInput = {}) {
  ensureAuthBroadcastListener();
  const runtimeConfig = createRuntimeConfig(runtimeInput);
  setRuntimeConfig(runtimeConfig);

  const existingRoot = roots.get(container);

  if (existingRoot) {
    void i18n.changeLanguage(runtimeConfig.locale);
    existingRoot.root.render(
      <StrictMode>
        <App runtimeConfig={runtimeConfig} />
      </StrictMode>,
    );
    return;
  }

  const releaseDocumentLanguage = preserveDocumentLanguage();
  const root = createRoot(container);
  roots.set(container, { releaseDocumentLanguage, root });
  void i18n.changeLanguage(runtimeConfig.locale);
  root.render(
    <StrictMode>
      <App runtimeConfig={runtimeConfig} />
    </StrictMode>,
  );
}

export function unmountApp(container: Element) {
  const mountedRoot = roots.get(container);

  if (!mountedRoot) {
    return;
  }

  mountedRoot.root.unmount();
  mountedRoot.releaseDocumentLanguage();
  roots.delete(container);
}

export function startStandaloneApp() {
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Root container #root was not found.");
  }

  const runtimeInput = readWindowRuntimeInput();
  mountApp(container, {
    ...runtimeInput,
    // Default: standalone (runs its own OAuth gate). A no-bkn-safe deploy injects
    // mode:"hosted" via config.js to run gate-less with the default user — see
    // public/config.js. Honour the injected value instead of forcing standalone.
    mode: runtimeInput.mode ?? "standalone",
  });
}
