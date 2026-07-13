/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

type DevAuthPluginOptions = {
  origin?: string;
};

type OAuthClient = {
  client_id: string;
  client_secret: string;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
};

export function viteDevAuthPlugin(options: DevAuthPluginOptions = {}): Plugin {
  const origin = options.origin ?? "http://127.0.0.1:9000";
  let activeServer: ViteDevServer | undefined;
  let clientCache: OAuthClient | null = null;
  let clientCachePromise: Promise<OAuthClient> | null = null;

  const parseCookies = (cookieHeader = "") => {
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((part) => {
      const [rawKey, ...rest] = part.trim().split("=");
      if (!rawKey) {
        return;
      }
      cookies[rawKey] = decodeURIComponent(rest.join("="));
    });
    return cookies;
  };

  const getPort = (server: ViteDevServer) => {
    const address = server.httpServer?.address();
    if (address && typeof address === "object") {
      return address.port;
    }

    return server.config.server.port ?? 5173;
  };

  const getConfig = (server: ViteDevServer) => {
    const port = getPort(server);
    const redirectUri = `http://localhost:${port}/api/dev-auth/v1/login/callback`;
    return {
      postLogoutRedirectUri: `http://localhost:${port}/`,
      redirectUri,
    };
  };

  const registerClient = async (server: ViteDevServer) => {
    if (clientCache) {
      return clientCache;
    }

    if (clientCachePromise) {
      return clientCachePromise;
    }

    clientCachePromise = (async () => {
      const config = getConfig(server);
      const response = await fetch(`${origin}/oauth2/clients`, {
        body: JSON.stringify({
          client_name: "BknStudioDev",
          grant_types: ["authorization_code", "refresh_token", "implicit"],
          metadata: {
            device: {
              client_type: "unknown",
              description: "BknStudioDev",
              name: "BknStudioDev",
            },
          },
          post_logout_redirect_uris: [config.postLogoutRedirectUri],
          redirect_uris: [config.redirectUri],
          response_types: ["token id_token", "code", "token"],
          scope: "offline openid all",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.text();
        clientCachePromise = null;
        throw new Error(`OAuth client registration failed (${response.status}): ${body}`);
      }

      clientCache = (await response.json()) as OAuthClient;
      clientCachePromise = null;
      return clientCache;
    })();

    return clientCachePromise;
  };

  const sendHtml = (res: ServerResponse, statusCode: number, html: string) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  };

  const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  };

  const exchangeRefreshToken = async (refreshToken: string) => {
    if (!activeServer) {
      throw new Error("Dev auth server is not initialized.");
    }

    const client = await registerClient(activeServer);
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const response = await fetch(`${origin}/oauth2/token`, {
      body: params,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${encodeURIComponent(client.client_id)}:${encodeURIComponent(client.client_secret)}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Refresh token failed (${response.status}): ${body}`);
    }

    return (await response.json()) as TokenPayload;
  };

  const readRequestBody = async (req: IncomingMessage) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  };

  const handleDevAuthRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
    server: ViteDevServer,
  ) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/dev-auth/v1/login" && req.method === "GET") {
      const config = getConfig(server);
      const client = await registerClient(server);
      const asRedirect = url.searchParams.get("asredirect") || "/knowledge-network";
      const state = Buffer.from(asRedirect, "utf8").toString("base64url");
      const nonce = randomBytes(16).toString("base64url");

      res.setHeader("Set-Cookie", [
        `bkn_dev_auth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax`,
        `bkn_dev_auth_nonce=${encodeURIComponent(nonce)}; Path=/; HttpOnly; SameSite=Lax`,
      ]);

      const authUrl = new URL(`${origin}/oauth2/auth`);
      authUrl.searchParams.set("client_id", client.client_id);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "offline openid all");
      authUrl.searchParams.set("redirect_uri", config.redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", nonce);
      authUrl.searchParams.set("lang", "zh-cn");
      authUrl.searchParams.set("product", "adp");

      res.statusCode = 302;
      res.setHeader("Location", authUrl.toString());
      res.end();
      return;
    }

    if (url.pathname === "/api/dev-auth/v1/login/callback" && req.method === "GET") {
      const config = getConfig(server);
      const client = await registerClient(server);
      const cookies = parseCookies(req.headers.cookie);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const oauthError = url.searchParams.get("error");

      if (oauthError) {
        sendHtml(
          res,
          400,
          `<h1>OAuth failed</h1><pre>${oauthError}: ${url.searchParams.get("error_description") ?? ""}</pre>`,
        );
        return;
      }

      if (!code) {
        sendHtml(res, 400, "<h1>Missing OAuth code</h1>");
        return;
      }

      if (!cookies.bkn_dev_auth_state || cookies.bkn_dev_auth_state !== state) {
        sendHtml(res, 400, "<h1>Invalid OAuth state</h1>");
        return;
      }

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", config.redirectUri);

      const tokenResponse = await fetch(`${origin}/oauth2/token`, {
        body: params,
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${encodeURIComponent(client.client_id)}:${encodeURIComponent(client.client_secret)}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        sendHtml(res, 500, `<h1>Token exchange failed</h1><pre>${body}</pre>`);
        return;
      }

      const tokenPayload = (await tokenResponse.json()) as TokenPayload;
      const redirectPath = Buffer.from(state, "base64url").toString("utf8") || "/knowledge-network";
      const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/knowledge-network";

      sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>登录成功</title></head>
  <body>
    <p>登录成功，正在进入 BKN Studio…</p>
    <script>
      sessionStorage.setItem("bkn_access_token", ${JSON.stringify(tokenPayload.access_token ?? "")});
      sessionStorage.setItem("bkn_refresh_token", ${JSON.stringify(tokenPayload.refresh_token ?? "")});
      window.location.replace(${JSON.stringify(safeRedirect)});
    </script>
  </body>
</html>`,
      );
      return;
    }

    if (url.pathname === "/api/dev-auth/v1/refresh" && req.method === "POST") {
      const body = await readRequestBody(req);
      const payload = body ? (JSON.parse(body) as { refresh_token?: string }) : {};
      if (!payload.refresh_token) {
        sendJson(res, 400, { message: "refresh_token is required" });
        return;
      }

      const tokenPayload = await exchangeRefreshToken(payload.refresh_token);
      sendJson(res, 200, tokenPayload);
      return;
    }

    if (url.pathname === "/api/dev-auth/v1/logout" && req.method === "GET") {
      sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>已退出</title></head>
  <body>
    <p>已退出登录。</p>
    <script>
      sessionStorage.removeItem("bkn_access_token");
      sessionStorage.removeItem("bkn_refresh_token");
      window.location.replace("/api/dev-auth/v1/login?asredirect=/knowledge-network");
    </script>
  </body>
</html>`,
      );
      return;
    }

    sendJson(res, 404, { message: "Not found" });
  };

  return {
    configureServer(server: ViteDevServer) {
      activeServer = server;

      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/dev-auth/")) {
          next();
          return;
        }

        void handleDevAuthRequest(req, res, server).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Dev auth failed";
          sendHtml(res, 500, `<h1>Dev auth error</h1><pre>${message}</pre>`);
        });
      });
    },
    name: "bkn-dev-auth",
  };
}
