/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate } from "react-router-dom";

import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { AccountScene, type AccountSection } from "@/modules/account/scenes/AccountScene";

export function AccountPage({ section }: { section: AccountSection }) {
  const entitlement = useEntitlement();
  if (section === "permission-requests" && isCommunityBuild(entitlement)) {
    return <Navigate replace to="/account/profile" />;
  }
  return <AccountScene section={section} />;
}
