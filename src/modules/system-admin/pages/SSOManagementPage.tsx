/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { SSOManagementScene } from "@/modules/system-admin/scenes/SSOManagementScene";

export function SSOManagementPage() {
  return (
    <RequireEdition
      capability={CAPABILITIES.SSO}
      minEdition="professional"
      mountLockedContent={false}
    >
      <SSOManagementScene />
    </RequireEdition>
  );
}
