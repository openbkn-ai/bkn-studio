/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";

type KnowledgeNetworkAuthorizationActionLabelProps = {
  children: ReactNode;
};

/** Marks KN child-resource authorization as Professional-only at every entry point. */
export function KnowledgeNetworkAuthorizationActionLabel({
  children,
}: KnowledgeNetworkAuthorizationActionLabelProps) {
  return (
    <span className="console-tab-with-tier">
      {children}
      <EditionBadge
        capability={CAPABILITIES.PERM_FINE_GRAINED}
        edition="professional"
      />
    </span>
  );
}
