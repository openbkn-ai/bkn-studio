/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * The live BKN project E2E runs against a deployed Studio and its real backend (for example
 * http://localhost:8081). It writes: it creates a project and a new knowledge network, publishes
 * and switches consumers. So it only runs when asked to, with E2E_LIVE=1, and never in CI.
 *
 *   E2E_LIVE=1                 run the live specs
 *   E2E_BASE_URL               the deployment, e.g. http://localhost:8081
 *   E2E_TOKEN                  an access token for it, read by the shell, never logged
 *   E2E_CATALOG                the data catalog to draft from (name, exact)
 *   E2E_PROJECT_ID             lk pass only: the project the ce flow published
 */
export const LIVE = process.env.E2E_LIVE === "1";
export const LIVE_SKIP_REASON = "live E2E: set E2E_LIVE=1, E2E_BASE_URL, E2E_TOKEN and E2E_CATALOG";

export function liveEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the live BKN project E2E`);
  }
  return value;
}

/** Signs the browser in with the token, the same cookie Studio writes after OAuth. */
export async function signIn(context: BrowserContext, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "bkn_access_token",
      value: encodeURIComponent(liveEnv("E2E_TOKEN")),
      domain: url.hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

/**
 * The editions under test. A deployment is one of them at a time (8081 is professional and
 * licensed), so the spec shapes only the capability snapshot the backend returns:
 *
 *   community   no knowledge-base extension installed  (dropped from extensions and capabilities)
 *   licensed    installed, community licence            (dropped from capabilities only)
 *
 * Every other response, the whole flow's data included, comes from the real backend.
 */
export type Edition = "community" | "licensed";

const KNOWLEDGE_BASE = "knowledge_base";

export async function useEdition(page: Page, edition: Edition) {
  await page.route("**/api/safe/v1/capabilities", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { capabilities?: string[]; extensions?: string[] };
    const without = (list?: string[]) => (list ?? []).filter((item) => item !== KNOWLEDGE_BASE);
    await route.fulfill({
      response,
      json: {
        ...body,
        capabilities: without(body.capabilities),
        extensions: edition === "community" ? without(body.extensions) : body.extensions,
      },
    });
  });
}

/** A name for this run's project and network, e.g. e2e-1030-1412 / e2e_1030_1412. */
export function runStamp(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}`;
  return { project: `e2e-${stamp}`, network: `e2e_${stamp.replace("-", "_")}` };
}

/** Background work (drafting, publishing, regression) takes minutes; the page polls on its own. */
export const BACKGROUND = { timeout: 15 * 60_000 };

export async function openSection(page: Page, name: RegExp | string) {
  await page
    .getByRole("navigation", { name: /项目导航|Project navigation/ })
    .getByRole("button", { name, exact: typeof name === "string" })
    .click();
}

/** Collects uncaught page errors so each spec can assert there were none. */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return {
    expectNone: () => expect(errors).toEqual([]),
  };
}
