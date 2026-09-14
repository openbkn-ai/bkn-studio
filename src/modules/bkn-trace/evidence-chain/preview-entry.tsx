/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createRoot } from "react-dom/client";
import { EvidenceChainPreview } from "./EvidenceChainPreview";
if (import.meta.env.DEV) {
  const element = document.getElementById("root");
  if (element) createRoot(element).render(<EvidenceChainPreview />);
}
