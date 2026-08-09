/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ObservabilityCapabilityBoundary } from "@/modules/bkn-trace/components/ObservabilityCapabilityBoundary";
import { BknTracePrototypeScene } from "@/modules/bkn-trace/prototype/BknTracePrototypeScene";

export function BknTracePrototypePage() {
  return (
    <ObservabilityCapabilityBoundary
      allow={(profile) => profile.businessProvenanceOwn || profile.businessProvenanceManagedNetworks}
    >
      <BknTracePrototypeScene />
    </ObservabilityCapabilityBoundary>
  );
}
