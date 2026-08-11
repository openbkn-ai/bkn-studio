/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { anonymousRuntimeUser, fetchCurrentUser } from "@/framework/auth/current-user";
import type { RuntimeUser } from "@/framework/runtime/types";

type CurrentUserLoaderProps = PropsWithChildren<{
  onLoaded: (user: RuntimeUser) => void;
}>;

/**
 * After token validation and before rendering the main app, load /me and /me/permissions to
 * populate currentUser for the top-bar name and menu/button permissions. A failed /me does not
 * block the page: retain the existing currentUser while the backend still handles 401 per request.
 */
export function CurrentUserLoader({ children, onLoaded }: CurrentUserLoaderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          onLoaded(user);
        }
      })
      .catch(() => {
        // The HTTP interceptor handles 401. For every other error, use the fail-closed user with
        // no permissions; never retain the caller's default currentUser, which is a development
        // user with all permissions and would expose every system-admin entry to regular users (#176).
        // fetchCurrentUser already uses allSettled; this is a second safeguard.
        if (!cancelled) {
          onLoaded(anonymousRuntimeUser);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // Load only once on mount; callers drive updates after refreshing the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return children;
}
