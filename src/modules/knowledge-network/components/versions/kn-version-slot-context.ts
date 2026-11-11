/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

/**
 * Where the version picker goes when the section shows the network's own title (the overview),
 * and where publishing goes among that title's actions.
 */
export type KnVersionSlotValue = {
  actionHost: HTMLSpanElement | null;
  host: HTMLSpanElement | null;
  setActionHost: (host: HTMLSpanElement | null) => void;
  setHost: (host: HTMLSpanElement | null) => void;
};

export const KnVersionSlotContext = createContext<KnVersionSlotValue | null>(null);
