/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { execSync } from "node:child_process";

import {
  expect,
  type APIResponse,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

/**
 * The live BKN project E2E runs against a deployed Studio and its real backend (for example
 * http://localhost:8081). It writes: it creates a project and a new knowledge network, publishes
 * and switches consumers. So it only runs when asked to, with E2E_LIVE=1, and never in CI.
 *
 *   E2E_LIVE=1                 run the live specs
 *   E2E_BASE_URL               the deployment, e.g. http://localhost:8081
 *   E2E_TOKEN_COMMAND          a command printing a current access token, run again when the
 *                              backend answers 401 (a run outlasts a token); never logged
 *   E2E_TOKEN                  a fixed access token instead, for a run shorter than its lifetime
 *   E2E_CATALOG                the data catalog to draft from (name, exact)
 *   E2E_PROJECT_ID             lk pass only: the project the ce flow published
 */
export const LIVE = process.env.E2E_LIVE === "1";
export const LIVE_SKIP_REASON =
  "live E2E: set E2E_LIVE=1, E2E_BASE_URL, E2E_TOKEN_COMMAND (or E2E_TOKEN) and E2E_CATALOG";

export function liveEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the live BKN project E2E`);
  }
  return value;
}

let token = "";

/** The current access token, read again from E2E_TOKEN_COMMAND when asked to. */
export function accessToken(renew = false): string {
  if (token && !renew) {
    return token;
  }
  const command = process.env.E2E_TOKEN_COMMAND?.trim();
  token = command
    ? execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    : liveEnv("E2E_TOKEN");
  if (!token) {
    throw new Error("E2E_TOKEN_COMMAND printed no token");
  }
  return token;
}

/**
 * Sends a request to the real backend with the current token. A 401 means the token expired
 * during the run: take a fresh one and send it again, before Studio sees it and signs out.
 */
export async function fetchSignedIn(route: Route): Promise<APIResponse> {
  const send = () =>
    route.fetch({
      headers: { ...route.request().headers(), authorization: `Bearer ${accessToken()}` },
    });
  const response = await send();
  if (response.status() !== 401 || !process.env.E2E_TOKEN_COMMAND) {
    return response;
  }
  accessToken(true);
  return send();
}

/** Signs the browser in with the token, the same cookie Studio writes after OAuth. */
export async function signIn(context: BrowserContext, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "bkn_access_token",
      value: encodeURIComponent(accessToken()),
      domain: url.hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    // An upload is left alone: intercepting it re-encodes the file. Uploads happen early in a
    // run, while the token Studio holds is still fresh.
    if ((request.headers()["content-type"] ?? "").startsWith("multipart/form-data")) {
      await route.fallback();
      return;
    }
    await route.fulfill({ response: await fetchSignedIn(route) });
  });
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
    const response = await fetchSignedIn(route);
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
