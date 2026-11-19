/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";

/**
 * Whether something opened at least once is to stay mounted: an AI panel hidden keeps its
 * conversation, and one never opened asks nothing.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) {
    setOpened(true);
  }
  return opened || open;
}
