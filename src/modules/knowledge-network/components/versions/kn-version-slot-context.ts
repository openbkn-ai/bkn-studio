/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

/** Where the version picker goes when the section shows the network's own title (the overview). */
export type KnVersionSlotValue = {
  host: HTMLSpanElement | null;
  setHost: (host: HTMLSpanElement | null) => void;
};

export const KnVersionSlotContext = createContext<KnVersionSlotValue | null>(null);
