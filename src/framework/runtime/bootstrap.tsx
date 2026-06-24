import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import i18n from "@/app/locales/i18n";
import {
  createRuntimeConfig,
  readWindowRuntimeInput,
  setRuntimeConfig,
} from "@/framework/runtime/config";
import type { RuntimeInput } from "@/framework/runtime/types";

const roots = new WeakMap<Element, ReturnType<typeof createRoot>>();

export function mountApp(container: Element, runtimeInput: RuntimeInput = {}) {
  const runtimeConfig = createRuntimeConfig(runtimeInput);
  setRuntimeConfig(runtimeConfig);
  void i18n.changeLanguage(runtimeConfig.locale);

  const existingRoot = roots.get(container);

  if (existingRoot) {
    existingRoot.render(
      <StrictMode>
        <App runtimeConfig={runtimeConfig} />
      </StrictMode>,
    );
    return;
  }

  const root = createRoot(container);
  roots.set(container, root);
  root.render(
    <StrictMode>
      <App runtimeConfig={runtimeConfig} />
    </StrictMode>,
  );
}

export function unmountApp(container: Element) {
  const root = roots.get(container);

  if (!root) {
    return;
  }

  root.unmount();
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

