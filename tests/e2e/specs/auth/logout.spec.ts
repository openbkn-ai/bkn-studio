/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Page } from "@playwright/test";

// Run against a local Vite server with VITE_USE_MOCK=false. The harness loads
// production auth modules, while API/OIDC responses are controlled by the test.
async function openHarness(page: Page, baseURL: string) {
  await page.route("**/studio/logout-regression", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Logout regression</body></html>",
    }),
  );
  await page.goto(`${baseURL}/studio/logout-regression`);
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the repository module; this is a browser import.
    const oauth = await import("/studio/src/framework/auth/oauth.ts");
    // @ts-expect-error Vite serves the repository module; this is a browser import.
    const store = await import("/studio/src/framework/auth/token-store.ts");
    if (!oauth.shouldUseOAuthGate("standalone")) {
      throw new Error("Start Vite with VITE_USE_MOCK=false for logout regression tests");
    }
    store.subscribeAuthBroadcast(() => window.location.reload());
    Object.assign(window, { logoutUnderTest: () => oauth.logout("standalone") });
  });
}

test("logout reaches Hydra without reloading its initiating page; other tabs reload", async ({
  context,
  page,
  baseURL,
}) => {
  const origin = baseURL!;
  await context.addCookies([
    { name: "bkn_access_token", value: "access-2913", url: origin },
    { name: "bkn_refresh_token", value: "refresh-2913", url: origin },
    { name: "bkn_id_token", value: "id-2913", url: origin },
  ]);
  let apiCalls = 0;
  await page.route("**/api/safe/v1/me/logout", async (route) => {
    apiCalls++;
    expect(route.request().headers().authorization).toBe("Bearer access-2913");
    expect(route.request().postDataJSON()).toEqual({
      refresh_token: "refresh-2913",
      id_token: "id-2913",
    });
    await route.fulfill({ status: 204 });
  });
  await page.route("**/oauth2/sessions/logout?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Hydra logout reached</body></html>",
    }),
  );
  const failures: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("/oauth2/sessions/logout"))
      failures.push(request.failure()?.errorText ?? "failed");
  });
  await openHarness(page, origin);
  const peer = await context.newPage();
  await openHarness(peer, origin);
  let peerLoads = 0;
  peer.on("load", () => peerLoads++);
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the repository module; this is a browser import.
    const { getRuntimeConfig } = await import("/studio/src/framework/runtime/config.ts");
    void (window as unknown as { logoutUnderTest: () => Promise<void> })
      .logoutUnderTest()
      .then(() => {
        // An API response may arrive after revocation but before Hydra loads.
        getRuntimeConfig().auth.tokenManager.onAuthFailure();
      });
  });
  await expect(page.getByText("Hydra logout reached")).toBeVisible();
  await expect.poll(() => peerLoads).toBe(1);
  expect(new URL(page.url()).searchParams.get("id_token_hint")).toBe("id-2913");
  expect(failures).toEqual([]);
  expect(apiCalls).toBe(1);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name.startsWith("bkn_") && cookie.name.endsWith("token"),
    ),
  ).toBe(false);
});

test("revocation failure retains credentials and does not navigate to Hydra", async ({
  context,
  page,
  baseURL,
}) => {
  await context.addCookies([{ name: "bkn_access_token", value: "access-2913", url: baseURL! }]);
  await page.route("**/api/safe/v1/me/logout", (route) => route.fulfill({ status: 503 }));
  await openHarness(page, baseURL!);
  const failed = await page.evaluate(async () => {
    try {
      await (window as unknown as { logoutUnderTest: () => Promise<void> }).logoutUnderTest();
      return false;
    } catch {
      return true;
    }
  });
  expect(failed).toBe(true);
  expect(page.url()).toContain("/studio/logout-regression");
  expect((await context.cookies()).some((cookie) => cookie.name === "bkn_access_token")).toBe(true);
});
